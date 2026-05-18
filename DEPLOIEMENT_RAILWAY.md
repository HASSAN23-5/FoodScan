# Déploiement cloud — Railway + Groq

> Tout sur internet, IA rapide, **un seul compte** (Railway gère aussi MongoDB).
> Temps total : ~30 minutes.

## Étape 1 — Clé API Groq (3 min)

1. Va sur https://console.groq.com et crée un compte (sign-in Google ou GitHub)
2. Une fois connecté, va sur https://console.groq.com/keys
3. Clique "Create API Key" → nomme-la `foodscan`
4. **Copie la clé** (elle commence par `gsk_…`) — tu ne pourras pas la revoir
5. Note-la quelque part en sécurité

C'est gratuit, pas de carte bancaire demandée, 14 400 requêtes par jour.

## Étape 2 — Repo GitHub (5 min)

Si pas encore fait :

```bash
cd ~/FoodScan
# Crée le .gitignore d'abord pour ne PAS commiter le .env
cat > .gitignore << 'EOF'
node_modules/
backend/venv/
backend/__pycache__/
backend/.env
.expo/
*.log
.DS_Store
.idea/
.vscode/
EOF

git init
git add .
git rm --cached backend/.env 2>/dev/null
git commit -m "feat: initial FoodScan AI project"
```

Puis sur github.com → "New repository" → nom `foodscan-ai` → Create.

```bash
git remote add origin https://github.com/TON_USER/foodscan-ai.git
git branch -M main
git push -u origin main
```

## Étape 3 — Railway (15 min)

1. Va sur https://railway.app et sign-in avec GitHub
2. Dashboard → **"New Project"** → **"Deploy from GitHub repo"**
3. Sélectionne `foodscan-ai`
4. Railway détecte Python automatiquement et lance un premier build (qui va planter, c'est normal — il manque les variables et MongoDB)
5. Dans le projet créé, clique **"+ New"** en haut à droite → **"Database"** → **"Add MongoDB"**
6. MongoDB est créé en quelques secondes. Clique dessus → onglet **"Variables"** → copie la valeur de `MONGO_URL` (le format est `mongodb://mongo:...@mongo.railway.internal:27017`)
7. Retourne sur ton service `foodscan-ai` → onglet **"Variables"** → ajoute :

| Variable | Valeur |
|---|---|
| `MONGO_URL` | colle l'URL MongoDB de l'étape 6 |
| `DB_NAME` | `foodscan_db` |
| `JWT_SECRET` | une longue chaîne aléatoire (ex: `random-secret-do-not-share-32chars`) |
| `ADMIN_EMAIL` | `admin@foodscan.com` |
| `ADMIN_PASSWORD` | `Admin123!` |
| `GROQ_API_KEY` | ta clé Groq de l'étape 1 (commence par `gsk_…`) |
| `GROQ_MODEL` | `llama-3.1-8b-instant` |

8. Onglet **"Settings"** → section "Build" → vérifie :
   - **Root Directory** : laisse vide (le `Procfile` à la racine gère ça)
   - **Build Command** : `cd backend && pip install -r requirements.txt`
   - **Start Command** : `cd backend && uvicorn main:app --host 0.0.0.0 --port $PORT`

9. Clique **"Generate Domain"** dans l'onglet "Settings" → Networking
10. Railway te donne une URL : `https://foodscan-ai-production-XXXX.up.railway.app`

## Étape 4 — Tester (2 min)

Va sur `https://foodscan-ai-production-XXXX.up.railway.app/api/`

Tu dois voir :
```json
{"message":"FoodScan API","status":"healthy","ai_backend":"groq","model":"llama-3.1-8b-instant"}
```

Si `ai_backend` affiche `"groq"` → **tout est OK, IA en cloud fonctionnelle**

## Étape 5 — Pointer l'appli mobile (1 min)

Édite `services/api.ts` :

```ts
const API_URL = 'https://foodscan-ai-production-XXXX.up.railway.app/api';
```

Relance `npx expo start --clear`. C'est fini.

## Vérifier que Groq fonctionne (test live)

Dans le frontend de l'appli :
1. Scanne un produit (ex: Nutella, code-barres 3017620422003)
2. Clique "Trouver des alternatives"
3. La réponse arrive en **1-2 secondes** au lieu de 60s+

Dans les logs Railway (onglet "Deployments" → "View Logs") tu verras :
```
INFO - Groq generated 3 alternatives
```

## Ce qu'il faut dire au jury

> « Le backend est déployé sur Railway avec une base MongoDB managée. L'IA utilise Groq Cloud (clé API hébergée gratuitement chez Groq.com) pour générer les alternatives en moins de 2 secondes. Pour le développement local, le code détecte automatiquement Ollama s'il tourne. En cas de défaillance des deux backends IA, un fallback rule-based intelligent prend le relais — l'application reste fonctionnelle. »

C'est une réponse de niveau pro : multi-backend, fallback, configuration par variables d'environnement.

## Si quelque chose plante

| Problème | Solution |
|---|---|
| Build Railway échoue | Vérifie les logs, souvent c'est un manque de `pip install` |
| `503 Service Unavailable` | Le service redémarre, attends 30s |
| Frontend ne se connecte pas | Vérifie l'URL dans `services/api.ts` (avec `/api` à la fin) |
| Erreur CORS | Le backend autorise déjà `*`, c'est OK |
| Pas de réponse IA | Va sur `/api/products/ai-status` pour diagnostiquer |
