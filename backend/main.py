from dotenv import load_dotenv
load_dotenv()
from fastapi import FastAPI, APIRouter, HTTPException, Request, Response
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os, logging, uuid, json, httpx, bcrypt, jwt
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone, timedelta

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]
JWT_ALG = "HS256"
def jwt_secret(): return os.environ["JWT_SECRET"]
def hash_pw(pw): return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()
def check_pw(plain, hashed): return bcrypt.checkpw(plain.encode(), hashed.encode())
def mk_at(uid, email): return jwt.encode({"sub": uid, "email": email, "exp": datetime.now(timezone.utc)+timedelta(hours=24), "type": "access"}, jwt_secret(), algorithm=JWT_ALG)
def mk_rt(uid): return jwt.encode({"sub": uid, "exp": datetime.now(timezone.utc)+timedelta(days=7), "type": "refresh"}, jwt_secret(), algorithm=JWT_ALG)

# ============================
# OLLAMA CONFIGURATION
# ============================
OLLAMA_URL = "http://localhost:11434"
OLLAMA_MODEL = "llama3.2:1b"  # Petit modèle rapide. Fallback rule-based si échec.

app = FastAPI(title="FoodScan API")
api = APIRouter(prefix="/api")
auth = APIRouter(prefix="/auth")
users = APIRouter(prefix="/users")
products = APIRouter(prefix="/products")
scan = APIRouter(prefix="/scan")

async def get_user(req: Request):
    token = None
    h = req.headers.get("Authorization", "")
    if h.startswith("Bearer "): token = h[7:]
    if not token: token = req.cookies.get("access_token")
    if not token: raise HTTPException(401, "Not authenticated")
    try:
        p = jwt.decode(token, jwt_secret(), algorithms=[JWT_ALG])
        if p.get("type") != "access": raise HTTPException(401, "Bad token")
        u = await db.users.find_one({"user_id": p["sub"]}, {"_id": 0})
        if not u: raise HTTPException(401, "User not found")
        u.pop("password_hash", None)
        return u
    except jwt.ExpiredSignatureError: raise HTTPException(401, "Token expired")
    except jwt.InvalidTokenError: raise HTTPException(401, "Invalid token")

async def get_user_optional(req: Request) -> Optional[Dict[str, Any]]:
    """Same as get_user but returns None instead of raising if not authenticated."""
    try:
        return await get_user(req)
    except HTTPException:
        return None

class Reg(BaseModel): email: str; password: str; name: str
class Login(BaseModel): email: str; password: str

class AltReq(BaseModel):
    product_name: str
    nutri_score: str
    nova_group: int
    calories: Optional[float] = None
    sugars: Optional[float] = None
    fat: Optional[float] = None
    salt: Optional[float] = None

class ObjectivesUpdate(BaseModel):
    low_sugar: Optional[bool] = None
    low_salt: Optional[bool] = None
    low_fat: Optional[bool] = None
    high_protein: Optional[bool] = None
    high_fiber: Optional[bool] = None
    vegetarian: Optional[bool] = None
    vegan: Optional[bool] = None
    gluten_free: Optional[bool] = None
    lactose_free: Optional[bool] = None
    daily_calorie_goal: Optional[int] = Field(default=None, ge=800, le=5000)

class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    objectives: Optional[ObjectivesUpdate] = None

class CoachReq(BaseModel):
    question: Optional[str] = None  # if user asks something specific

# ============================
# AUTH ENDPOINTS
# ============================
@auth.post("/register")
async def register(d: Reg):
    email = d.email.lower().strip()
    if await db.users.find_one({"email": email}): raise HTTPException(400, "Email already registered")
    uid = f"user_{uuid.uuid4().hex[:12]}"
    await db.users.insert_one({
        "user_id": uid, "email": email, "name": d.name,
        "password_hash": hash_pw(d.password),
        "role": "user",
        "objectives": {},
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    return {"user_id": uid, "email": email, "name": d.name, "role": "user", "access_token": mk_at(uid, email), "refresh_token": mk_rt(uid)}

@auth.post("/login")
async def login(d: Login):
    email = d.email.lower().strip()
    u = await db.users.find_one({"email": email}, {"_id": 0})
    if not u or (u.get("password_hash") and not check_pw(d.password, u["password_hash"])):
        raise HTTPException(401, "Invalid email or password")
    return {"user_id": u["user_id"], "email": u["email"], "name": u.get("name", ""), "role": u.get("role", "user"), "picture": u.get("picture"), "access_token": mk_at(u["user_id"], email), "refresh_token": mk_rt(u["user_id"])}

@auth.post("/logout")
async def logout(): return {"message": "OK"}

@auth.get("/me")
async def me(req: Request):
    u = await get_user(req)
    return {"user_id": u["user_id"], "email": u["email"], "name": u.get("name", ""), "role": u.get("role", "user"), "picture": u.get("picture")}

# ============================
# GOOGLE OAUTH
# ============================
@auth.post("/session")
async def google_session(req: Request):
    body = await req.json()
    sid = body.get("session_id")
    if not sid:
        raise HTTPException(400, "Session ID required")

    async with httpx.AsyncClient(timeout=15.0) as c:
        try:
            r = await c.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": sid}
            )
            if r.status_code != 200:
                logging.error(f"Google OAuth session error: status={r.status_code}, body={r.text}")
                raise HTTPException(401, "Session invalide ou expirée. Réessayez la connexion Google.")
            sd = r.json()
        except httpx.TimeoutException:
            raise HTTPException(504, "Timeout lors de la vérification Google. Réessayez.")
        except HTTPException:
            raise
        except Exception as e:
            logging.error(f"Google OAuth error: {e}")
            raise HTTPException(500, f"Erreur authentification Google: {str(e)}")

    email = sd.get("email", "").lower()
    name = sd.get("name", "")
    picture = sd.get("picture", "")

    if not email:
        raise HTTPException(400, "Email non fourni par Google")

    ex = await db.users.find_one({"email": email}, {"_id": 0})
    if ex:
        uid = ex["user_id"]
        await db.users.update_one({"email": email}, {"$set": {"name": name, "picture": picture}})
    else:
        uid = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": uid,
            "email": email,
            "name": name,
            "picture": picture,
            "role": "user",
            "auth_type": "google",
            "objectives": {},
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        logging.info(f"New Google user created: {email}")

    return {
        "user_id": uid,
        "email": email,
        "name": name,
        "role": "user",
        "picture": picture,
        "access_token": mk_at(uid, email),
        "refresh_token": mk_rt(uid)
    }

# ============================
# USER PROFILE & OBJECTIVES (Feature: dietary objectives)
# ============================
@users.get("/profile")
async def get_profile(req: Request):
    u = await get_user(req)
    return {
        "user_id": u["user_id"],
        "email": u["email"],
        "name": u.get("name", ""),
        "picture": u.get("picture"),
        "role": u.get("role", "user"),
        "auth_type": u.get("auth_type", "password"),
        "created_at": u.get("created_at"),
        "objectives": u.get("objectives", {})
    }

@users.put("/profile")
async def update_profile(d: ProfileUpdate, req: Request):
    u = await get_user(req)
    updates: Dict[str, Any] = {}

    if d.name is not None and d.name.strip():
        updates["name"] = d.name.strip()

    if d.objectives is not None:
        # Merge with existing objectives instead of replacing
        current = u.get("objectives", {}) or {}
        for key, val in d.objectives.model_dump(exclude_unset=True).items():
            if val is None:
                current.pop(key, None)
            else:
                current[key] = val
        updates["objectives"] = current

    if updates:
        await db.users.update_one({"user_id": u["user_id"]}, {"$set": updates})

    fresh = await db.users.find_one({"user_id": u["user_id"]}, {"_id": 0, "password_hash": 0})
    return {
        "user_id": fresh["user_id"],
        "email": fresh["email"],
        "name": fresh.get("name", ""),
        "objectives": fresh.get("objectives", {})
    }

@users.get("/stats")
async def user_stats(req: Request):
    """Aggregate stats from the user's scan history (used by Profile screen)."""
    u = await get_user(req)
    history = await db.scan_history.find({"user_id": u["user_id"]}, {"_id": 0}).to_list(1000)
    total = len(history)
    by_grade: Dict[str, int] = {}
    by_nova: Dict[str, int] = {}
    for h in history:
        g = (h.get("nutriscore_grade") or "?").upper()
        by_grade[g] = by_grade.get(g, 0) + 1
        n = str(h.get("nova_group") or "?")
        by_nova[n] = by_nova.get(n, 0) + 1
    healthy = by_grade.get("A", 0) + by_grade.get("B", 0)
    return {
        "total_scans": total,
        "healthy_scans": healthy,
        "healthy_ratio": round(healthy / total, 2) if total else 0,
        "by_nutriscore": by_grade,
        "by_nova": by_nova
    }

# ============================
# PRODUCTS - OPEN FOOD FACTS
# ============================
HDR = {"User-Agent": "FoodScanAI/1.0 (university-project)"}

@products.get("/search")
async def search_products(query: str):
    async with httpx.AsyncClient() as c:
        try:
            r = await c.get(
                "https://world.openfoodfacts.org/cgi/search.pl",
                params={"search_terms": query, "search_simple": 1, "action": "process", "json": 1, "page_size": 20},
                headers=HDR, timeout=10.0
            )
            if r.status_code != 200 or "html" in r.headers.get("content-type", "").lower():
                r = await c.get(
                    "https://world.openfoodfacts.org/api/v2/search",
                    params={
                        "search_terms": query, "page_size": 20,
                        "fields": "code,product_name,brands,image_url,image_small_url,nutriscore_grade,nova_group,categories"
                    },
                    headers=HDR, timeout=10.0
                )
            data = r.json()
            return {
                "products": [{
                    "code": p.get("code", ""),
                    "product_name": p.get("product_name", "Unknown"),
                    "brands": p.get("brands", ""),
                    "image_url": p.get("image_url", ""),
                    "image_small_url": p.get("image_small_url", ""),
                    "nutriscore_grade": (p.get("nutriscore_grade", "") or "").upper(),
                    "nova_group": p.get("nova_group"),
                    "categories": p.get("categories", "")
                } for p in data.get("products", [])],
                "count": len(data.get("products", []))
            }
        except Exception as e:
            raise HTTPException(500, f"Search error: {e}")

@products.get("/barcode/{barcode}")
async def get_product(barcode: str):
    async with httpx.AsyncClient() as c:
        r = await c.get(f"https://world.openfoodfacts.org/api/v2/product/{barcode}", headers=HDR, timeout=10.0)
        data = r.json()
        if data.get("status") != 1: raise HTTPException(404, "Product not found")
        p = data["product"]; n = p.get("nutriments", {})
        return {
            "code": p.get("code", barcode), "product_name": p.get("product_name", ""),
            "brands": p.get("brands", ""), "image_url": p.get("image_url", ""),
            "image_front_url": p.get("image_front_url", ""), "image_small_url": p.get("image_small_url", ""),
            "nutriscore_grade": (p.get("nutriscore_grade", "") or "").upper(),
            "nova_group": p.get("nova_group"), "categories": p.get("categories", ""),
            "ingredients_text": p.get("ingredients_text", ""), "allergens": p.get("allergens", ""),
            "quantity": p.get("quantity", ""),
            "nutriments": {
                "energy_kcal_100g": n.get("energy-kcal_100g"), "fat_100g": n.get("fat_100g"),
                "saturated_fat_100g": n.get("saturated-fat_100g"), "carbohydrates_100g": n.get("carbohydrates_100g"),
                "sugars_100g": n.get("sugars_100g"), "fiber_100g": n.get("fiber_100g"),
                "proteins_100g": n.get("proteins_100g"), "salt_100g": n.get("salt_100g"),
                "sodium_100g": n.get("sodium_100g")
            }
        }

# ============================
# ALTERNATIVES IA - OLLAMA + smart rule-based fallback
# ============================
def _objectives_prompt_addendum(objectives: Optional[Dict[str, Any]]) -> str:
    if not objectives: return ""
    lines = []
    if objectives.get("low_sugar"): lines.append("- Privilégier les produits faibles en sucre")
    if objectives.get("low_salt"): lines.append("- Privilégier les produits faibles en sel")
    if objectives.get("low_fat"): lines.append("- Privilégier les produits faibles en graisses")
    if objectives.get("high_protein"): lines.append("- Privilégier les produits riches en protéines")
    if objectives.get("high_fiber"): lines.append("- Privilégier les produits riches en fibres")
    if objectives.get("vegetarian"): lines.append("- L'utilisateur est végétarien (pas de viande ni poisson)")
    if objectives.get("vegan"): lines.append("- L'utilisateur est végan (aucun produit animal)")
    if objectives.get("gluten_free"): lines.append("- L'utilisateur évite le gluten")
    if objectives.get("lactose_free"): lines.append("- L'utilisateur évite le lactose")
    if not lines: return ""
    return "\n\nObjectifs nutritionnels de l'utilisateur :\n" + "\n".join(lines)


def _smart_fallback(d: AltReq, objectives: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Generate alternatives without Ollama, using the product's actual macros + user objectives."""
    objectives = objectives or {}
    name = d.product_name or "ce produit"

    issues: List[str] = []
    if (d.sugars or 0) > 15: issues.append("sucre élevé")
    if (d.fat or 0) > 20: issues.append("graisses élevées")
    if (d.salt or 0) > 1.5: issues.append("sel élevé")
    if d.nova_group and d.nova_group >= 4: issues.append("ultra-transformé")
    if (d.calories or 0) > 400: issues.append("très calorique")

    alternatives = []

    # Alt 1: home-made
    home_benefits = ["Pas d'additifs", "Adapté à vos goûts"]
    if objectives.get("low_sugar"): home_benefits.append("Sucre maîtrisé")
    if objectives.get("low_salt"): home_benefits.append("Sel maîtrisé")
    alternatives.append({
        "name": f"Version maison de {name.lower()}",
        "reason": "Préparer soi-même permet de contrôler tous les ingrédients et d'éviter les additifs industriels.",
        "benefits": home_benefits[:3]
    })

    # Alt 2: organic / less processed
    bio_benefits = ["Moins d'additifs", "Moins de pesticides"]
    if d.nova_group and d.nova_group >= 3:
        bio_benefits.append("Moins transformé")
    alternatives.append({
        "name": f"Version bio et peu transformée",
        "reason": "Les produits bio Nova 1 ou 2 ont généralement un meilleur profil nutritionnel.",
        "benefits": bio_benefits[:3]
    })

    # Alt 3: tailored to the worst issue
    if "sucre élevé" in issues:
        alt3 = {
            "name": "Équivalent sans sucres ajoutés",
            "reason": "Réduire les sucres ajoutés améliore le Nutri-Score et la santé métabolique.",
            "benefits": ["Moins de sucre", "Meilleur Nutri-Score", "Moins de calories vides"]
        }
    elif "sel élevé" in issues:
        alt3 = {
            "name": "Équivalent à teneur réduite en sel",
            "reason": "Trop de sel est associé à l'hypertension. Cherchez < 1,5 g/100 g.",
            "benefits": ["Moins de sel", "Meilleur pour le cœur"]
        }
    elif "graisses élevées" in issues:
        alt3 = {
            "name": "Alternative à faible teneur en matières grasses",
            "reason": "Réduire les graisses, surtout saturées, allège l'apport calorique.",
            "benefits": ["Moins de graisses saturées", "Moins de calories"]
        }
    elif "ultra-transformé" in issues:
        alt3 = {
            "name": "Équivalent peu transformé (Nova 1-2)",
            "reason": "Les aliments peu transformés conservent plus de nutriments et moins d'additifs.",
            "benefits": ["Nova 1-2", "Plus de nutriments naturels"]
        }
    else:
        alt3 = {
            "name": "Alternative riche en fibres et protéines",
            "reason": "Un meilleur ratio fibres/protéines améliore la satiété et la qualité nutritionnelle.",
            "benefits": ["Plus de fibres", "Plus de protéines", "Satiété accrue"]
        }
    alternatives.append(alt3)

    advice_bits = [
        f"Le produit '{name}' a un Nutri-Score {d.nutri_score} et un groupe Nova {d.nova_group}.",
    ]
    if issues:
        advice_bits.append("Points faibles repérés : " + ", ".join(issues) + ".")
    advice_bits.append("Privilégiez les produits Nutri-Score A ou B et Nova 1 ou 2.")
    if objectives.get("low_sugar"): advice_bits.append("Comme vous visez peu de sucre, vérifiez la ligne 'dont sucres'.")
    if objectives.get("high_protein"): advice_bits.append("Pour vos objectifs protéines, regardez 'protéines (g)' par 100 g.")

    return {
        "alternatives": alternatives,
        "general_advice": " ".join(advice_bits),
        "source": "rule-based-fallback"
    }


@products.post("/alternatives")
async def get_alternatives(d: AltReq, req: Request):
    """
    Génère des alternatives plus saines via Ollama (llama3.1 en local).
    Fallback intelligent basé sur les valeurs nutritionnelles si Ollama échoue.
    """
    # Try to read objectives if user is logged in (optional - works without auth too)
    me = await get_user_optional(req)
    objectives = (me or {}).get("objectives", {}) if me else {}

    prompt = f"""Tu es un nutritionniste expert français. Un utilisateur a scanné ce produit alimentaire :

- Nom du produit : {d.product_name}
- Nutri-Score : {d.nutri_score}
- Groupe Nova : {d.nova_group}
- Calories : {d.calories or 'Non disponible'} kcal/100g
- Sucres : {d.sugars or 'Non disponible'} g/100g
- Graisses : {d.fat or 'Non disponible'} g/100g
- Sel : {d.salt or 'Non disponible'} g/100g{_objectives_prompt_addendum(objectives)}

Suggère exactement 3 alternatives alimentaires plus saines dans la même catégorie.

Réponds UNIQUEMENT en JSON valide avec ce format exact, rien d'autre :
{{
  "alternatives": [
    {{
      "name": "Nom du produit alternatif",
      "reason": "Raison courte pourquoi c'est meilleur",
      "benefits": ["Bénéfice 1", "Bénéfice 2"]
    }},
    {{
      "name": "Deuxième alternative",
      "reason": "Raison courte",
      "benefits": ["Bénéfice 1", "Bénéfice 2"]
    }},
    {{
      "name": "Troisième alternative",
      "reason": "Raison courte",
      "benefits": ["Bénéfice 1", "Bénéfice 2"]
    }}
  ],
  "general_advice": "Un conseil nutritionnel général pour cette catégorie de produits"
}}"""

    models_to_try = [OLLAMA_MODEL]

    for model in models_to_try:
        try:
            async with httpx.AsyncClient(timeout=60.0) as c:
                response = await c.post(
                    f"{OLLAMA_URL}/api/chat",
                    json={
                        "model": model,
                        "messages": [
                            {"role": "system", "content": "Tu es un nutritionniste expert. Tu réponds toujours en JSON valide, sans texte supplémentaire. Tes réponses sont en français."},
                            {"role": "user", "content": prompt}
                        ],
                        "stream": False,
                        "format": "json",
                        "options": {"temperature": 0.7, "num_predict": 1024}
                    }
                )

                if response.status_code != 200:
                    logging.warning(f"Ollama model {model} returned status {response.status_code}")
                    continue

                result = response.json()
                content = result.get("message", {}).get("content", "")

                if not content:
                    logging.warning(f"Ollama model {model} returned empty content")
                    continue

                try:
                    parsed = json.loads(content)
                    if "alternatives" in parsed and isinstance(parsed["alternatives"], list):
                        parsed["source"] = f"ollama:{model}"
                        logging.info(f"Ollama ({model}) generated {len(parsed['alternatives'])} alternatives")
                        return parsed
                    else:
                        logging.warning(f"Ollama ({model}) returned invalid structure: {content[:200]}")
                        continue
                except json.JSONDecodeError as je:
                    logging.warning(f"Ollama ({model}) JSON parse error: {je}")
                    try:
                        start = content.find('{')
                        end = content.rfind('}') + 1
                        if start >= 0 and end > start:
                            parsed = json.loads(content[start:end])
                            if "alternatives" in parsed:
                                parsed["source"] = f"ollama:{model}-recovered"
                                return parsed
                    except:
                        pass
                    continue

        except httpx.ConnectError:
            logging.error(f"Cannot connect to Ollama at {OLLAMA_URL}. Is Ollama running?")
            break
        except httpx.TimeoutException:
            logging.warning(f"Ollama model {model} timeout (>120s)")
            continue
        except Exception as e:
            logging.error(f"Ollama error with model {model}: {e}")
            continue

    logging.warning("All Ollama models failed. Using smart rule-based fallback.")
    return _smart_fallback(d, objectives)


# ============================
# AI COACH (general nutrition tips) - powers the "Mangez mieux avec l'IA" card
# ============================
@products.post("/coach-tips")
async def coach_tips(d: CoachReq, req: Request):
    """Generates general nutrition advice based on the user's recent scan history."""
    me = await get_user_optional(req)
    objectives = (me or {}).get("objectives", {}) if me else {}

    history: List[Dict[str, Any]] = []
    if me:
        history = await db.scan_history.find(
            {"user_id": me["user_id"]}, {"_id": 0}
        ).sort("scanned_at", -1).limit(15).to_list(15)

    history_summary = ""
    if history:
        scores = [(h.get("product_name", "?"), (h.get("nutriscore_grade") or "?").upper(), h.get("nova_group") or "?") for h in history[:10]]
        history_summary = "\nDerniers produits scannés (nom, Nutri-Score, Nova) :\n" + "\n".join(
            f"- {n} : {g} / {nv}" for n, g, nv in scores
        )

    user_q = (d.question or "").strip() or "Donne-moi 3 conseils nutritionnels pertinents pour mes habitudes."

    prompt = f"""Tu es un coach nutritionnel français. {_objectives_prompt_addendum(objectives)}
{history_summary}

Question de l'utilisateur : {user_q}

Réponds en JSON valide, format strict :
{{
  "summary": "Une phrase de synthèse personnalisée",
  "tips": [
    {{"title": "Titre court", "content": "Conseil détaillé en 1-2 phrases"}},
    {{"title": "Titre court", "content": "Conseil détaillé"}},
    {{"title": "Titre court", "content": "Conseil détaillé"}}
  ]
}}"""

    for model in [OLLAMA_MODEL]:
        try:
            async with httpx.AsyncClient(timeout=60.0) as c:
                r = await c.post(
                    f"{OLLAMA_URL}/api/chat",
                    json={
                        "model": model,
                        "messages": [
                            {"role": "system", "content": "Tu es un coach nutritionnel. Tu réponds uniquement en JSON valide en français."},
                            {"role": "user", "content": prompt}
                        ],
                        "stream": False,
                        "format": "json",
                        "options": {"temperature": 0.7, "num_predict": 700}
                    }
                )
                if r.status_code != 200:
                    continue
                content = r.json().get("message", {}).get("content", "")
                try:
                    parsed = json.loads(content)
                    if "tips" in parsed:
                        parsed["source"] = f"ollama:{model}"
                        return parsed
                except json.JSONDecodeError:
                    try:
                        start = content.find('{'); end = content.rfind('}') + 1
                        if start >= 0 and end > start:
                            parsed = json.loads(content[start:end])
                            if "tips" in parsed:
                                parsed["source"] = f"ollama:{model}-recovered"
                                return parsed
                    except: pass
                    continue
        except httpx.ConnectError:
            break
        except Exception:
            continue

    # Fallback: rule-based advice from history + objectives
    tips: List[Dict[str, str]] = []
    if history:
        bad = [h for h in history if (h.get("nutriscore_grade") or "").upper() in ("D", "E") or (h.get("nova_group") or 0) >= 4]
        if bad:
            tips.append({
                "title": "Réduire les produits ultra-transformés",
                "content": f"Vous avez scanné {len(bad)} produit(s) au profil défavorable (Nutri-Score D/E ou Nova 4). Essayez de remplacer un de ces produits par une version peu transformée."
            })
        good = [h for h in history if (h.get("nutriscore_grade") or "").upper() in ("A", "B")]
        if good:
            tips.append({
                "title": "Continuez sur cette lancée",
                "content": f"Bravo, {len(good)} produit(s) récents sont Nutri-Score A ou B. Cherchez à maintenir cette proportion."
            })

    if objectives.get("low_sugar"):
        tips.append({"title": "Sucre maîtrisé", "content": "Visez moins de 5 g de sucres pour 100 g sur les produits courants et évitez les boissons sucrées."})
    if objectives.get("high_protein"):
        tips.append({"title": "Apport en protéines", "content": "Pour une alimentation riche en protéines, visez 15-20 g par repas via œufs, légumineuses, viandes maigres ou produits laitiers."})
    if objectives.get("high_fiber"):
        tips.append({"title": "Fibres alimentaires", "content": "Préférez les pains complets et les légumineuses : visez au moins 25 g de fibres par jour."})

    while len(tips) < 3:
        tips.append({
            "title": ["Hydratez-vous", "Mangez varié", "Lisez les étiquettes"][len(tips) % 3],
            "content": [
                "Boire 1,5 L d'eau par jour aide la digestion et réduit la sensation de faim.",
                "Une assiette équilibrée combine légumes, féculents complets et une source de protéines.",
                "Vérifiez la liste des ingrédients : plus elle est courte et compréhensible, mieux c'est."
            ][len(tips) % 3]
        })

    return {
        "summary": "Voici des recommandations personnalisées basées sur votre historique" + (" et vos objectifs." if objectives else "."),
        "tips": tips[:3],
        "source": "rule-based-fallback"
    }


# ============================
# ENDPOINT TEST OLLAMA
# ============================
@products.get("/ollama-status")
async def check_ollama():
    try:
        async with httpx.AsyncClient(timeout=5.0) as c:
            r = await c.get(f"{OLLAMA_URL}/api/tags")
            if r.status_code == 200:
                models = [m["name"] for m in r.json().get("models", [])]
                return {"status": "connected", "url": OLLAMA_URL, "models": models, "default_model": OLLAMA_MODEL}
            else:
                return {"status": "error", "message": f"Ollama responded with status {r.status_code}"}
    except httpx.ConnectError:
        return {"status": "disconnected", "message": f"Cannot connect to Ollama at {OLLAMA_URL}. Run: ollama serve"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

# ============================
# SCAN HISTORY
# ============================
@scan.post("/save")
async def save_scan(req: Request):
    u = await get_user(req); body = await req.json()
    doc = {
        "scan_id": f"scan_{uuid.uuid4().hex[:12]}",
        "user_id": u["user_id"],
        "barcode": body.get("barcode"),
        "product_name": body.get("product_name"),
        "nutriscore_grade": body.get("nutriscore_grade"),
        "nova_group": body.get("nova_group"),
        "image_url": body.get("image_url"),
        "scanned_at": datetime.now(timezone.utc).isoformat()
    }
    await db.scan_history.insert_one(doc)
    return {"message": "Saved", "scan_id": doc["scan_id"]}

@scan.get("/history")
async def get_history(req: Request):
    u = await get_user(req)
    return {"history": await db.scan_history.find({"user_id": u["user_id"]}, {"_id": 0}).sort("scanned_at", -1).limit(50).to_list(50)}

@scan.delete("/history/{scan_id}")
async def delete_scan(scan_id: str, req: Request):
    u = await get_user(req)
    res = await db.scan_history.delete_one({"scan_id": scan_id, "user_id": u["user_id"]})
    if res.deleted_count == 0:
        raise HTTPException(404, "Scan not found")
    return {"message": "Deleted"}

@scan.delete("/history")
async def clear_history(req: Request):
    u = await get_user(req)
    res = await db.scan_history.delete_many({"user_id": u["user_id"]})
    return {"message": "Cleared", "deleted": res.deleted_count}

# ============================
# ROOT
# ============================
@api.get("/")
async def root(): return {"message": "FoodScan API", "status": "healthy", "ai_backend": "ollama", "model": OLLAMA_MODEL}

api.include_router(auth)
api.include_router(users)
api.include_router(products)
api.include_router(scan)
app.include_router(api)

# CORS
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.scan_history.create_index("user_id")
    ae = os.environ.get("ADMIN_EMAIL", "admin@foodscan.com")
    ap = os.environ.get("ADMIN_PASSWORD", "Admin123!")
    if not await db.users.find_one({"email": ae}):
        await db.users.insert_one({
            "user_id": f"user_{uuid.uuid4().hex[:12]}",
            "email": ae, "password_hash": hash_pw(ap),
            "name": "Admin", "role": "admin",
            "objectives": {},
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        logging.info(f"Admin created: {ae}")
    try:
        async with httpx.AsyncClient(timeout=3.0) as c:
            r = await c.get(f"{OLLAMA_URL}/api/tags")
            if r.status_code == 200:
                models = [m["name"] for m in r.json().get("models", [])]
                logging.info(f"Ollama connected. Available models: {models}")
            else:
                logging.warning(f"Ollama responded with status {r.status_code}")
    except:
        logging.warning(f"Ollama not reachable at {OLLAMA_URL}. AI alternatives will use fallback.")

@app.on_event("shutdown")
async def shutdown(): client.close()
