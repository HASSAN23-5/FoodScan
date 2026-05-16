# FoodScan AI — version corrigée

## Ce qui a été corrigé / ajouté

### Corrections (2 bugs)

1. **Connexion Google → "Unmatched Route"** : la route `/auth-callback`
   n'existait pas. Elle a été créée (`app/auth-callback.tsx`) et enregistrée
   dans `app/_layout.tsx`. Le flux est :
   - Web : `loginWithGoogle()` redirige le navigateur vers l'auth Emergent,
     qui renvoie sur `/auth-callback#session_id=...`. Cette route lit le
     `session_id`, l'échange contre un JWT via `POST /api/auth/session`,
     puis va sur `/(tabs)`.
   - Mobile : `WebBrowser.openAuthSessionAsync` capture le retour comme avant,
     `AuthContext` finalise l'auth en interne.

2. **Carte "Mangez mieux avec l'IA" non cliquable** : c'était un `<View>` au
   lieu d'un `<TouchableOpacity>`. Elle pointe maintenant vers un vrai écran
   **`app/ai-coach.tsx`** branché sur l'endpoint backend
   `POST /api/products/coach-tips` qui génère des conseils personnalisés à
   partir de l'historique de scans et des objectifs utilisateur.

### 2 fonctionnalités ajoutées

3. **Profil + Objectifs nutritionnels** (`app/(tabs)/profile.tsx`, nouvel
   onglet) : couvre la user-story "Personnaliser et sauvegarder les données
   de l'utilisateur" et "Possibilité de définir des objectifs" de votre
   charte. L'utilisateur peut activer : peu de sucre, peu de sel, peu de
   graisses, riche en protéines, riche en fibres, végétarien, végan, sans
   gluten, sans lactose. Ces objectifs sont **envoyés à l'IA** quand on
   demande des alternatives ou des conseils. Statistiques personnelles +
   répartition des Nutri-Scores incluses.

4. **Comparer 2 produits** (`app/compare.tsx`) : couvre la user-story
   "Donner le choix de comparer avec différentes données". Choisir 2
   produits de l'historique, voir leurs valeurs nutritionnelles côte à côte,
   savoir lequel gagne sur chaque critère, et avoir un verdict global.
   Accessible depuis l'accueil, l'historique et le profil.

### Améliorations backend (`backend/main.py`)

- Nouveaux endpoints : `GET/PUT /api/users/profile`, `GET /api/users/stats`,
  `POST /api/products/coach-tips`, `DELETE /api/scan/history/{id}`,
  `DELETE /api/scan/history`.
- L'endpoint `/api/products/alternatives` lit maintenant les objectifs de
  l'utilisateur (si connecté) et les passe à l'IA.
- **Fallback rule-based intelligent** : si Ollama n'est pas joignable, les
  alternatives sont générées à partir des vraies macros du produit
  (sucre, sel, graisse, Nova) et adaptées aux objectifs, au lieu de
  réponses génériques.

### Améliorations UI

- Login : blob décoratif, ombres, animation de chargement Google
- Accueil : carte AI maintenant cliquable, raccourci Comparer, blobs,
  ombres douces
- Historique : long-press pour supprimer, bouton tout effacer, raccourci
  Comparer
- Tab bar : icônes "filled" quand actif, 5e onglet "Profil"

### Tests effectués

- **Backend** : 21 tests end-to-end passent (uvicorn + mongomock).
  Couvrent auth (register/login/me/logout/duplicate/bad password),
  profile (get/put/objectifs), stats, scan (save/history/delete/clear),
  alternatives (avec et sans auth), coach-tips, ollama-status.
- **TypeScript** : `tsc --noEmit --strict` retourne 0 erreurs sur les
  4067 lignes de code.
- **Icônes** : les 56 noms `Ionicons` utilisés ont été vérifiés contre
  le glyph map officiel.
- **Cohérence des routes** : chaque `router.push(...)` pointe vers un
  fichier existant.

### Ce qui n'a PAS pu être testé (limites du sandbox)

- Le flux Google OAuth réel (nécessite un vrai compte Google + le
  service `emergentagent.com` qui ne tourne pas chez moi)
- Le rendu visuel sur Android/iOS (je n'ai pas d'émulateur)
- La génération Ollama (je n'ai pas llama3.1 installé) — mais le
  fallback est testé

## Lancer l'application

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate   # ou: venv\Scripts\activate sur Windows
pip install -r requirements.txt
# Configurez .env (MONGO_URL, JWT_SECRET, etc. — déjà fait)
uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

### Frontend (Expo)

```bash
npm install
npx expo start
```

**Important** : avant le premier lancement, mettez à jour l'IP dans
`services/api.ts` :

```ts
const API_URL = 'http://VOTRE_IP_LOCAL:8001/api';
```

### Ollama (optionnel — fallback intelligent si absent)

```bash
ollama serve
ollama pull llama3.1
# Plus rapide : ollama pull gemma2:2b puis OLLAMA_MODEL="gemma2:2b" dans main.py
```

## Alternative IA plus rapide que llama3.1 (optionnel)

Si llama3.1 est trop lent sur votre machine, deux options :

- **gemma2:2b** (sur Ollama, gratuit, 10x plus rapide, qualité correcte)
  → `ollama pull gemma2:2b` puis dans `main.py` ligne 24 :
  `OLLAMA_MODEL = "gemma2:2b"`
- **API Groq** (gratuit, très rapide, hébergé, demande une clé API
  gratuite sur console.groq.com) — me redemander si vous voulez ce path

## Comptes par défaut

- Admin : `admin@foodscan.com` / `Admin123!` (créé au démarrage du backend)
- Nouveaux comptes : via le bouton "S'inscrire" ou la connexion Google
