# MaintXpert

PWA de diagnostic guidé des défaillances industrielles — modèle **SDCR** (Symptôme, Défaut, Cause,
Remède). Service maintenance, usine Terrain Court (SABC, Yaoundé), chaînes CH02, CH05, CH06, CH09.

Le contexte projet complet est dans [`CLAUDE.md`](CLAUDE.md).
Les arbitrages techniques sont consignés dans [`docs/03-decisions.md`](docs/03-decisions.md).
Le protocole de mesure du mémoire : [`docs/04-protocole-mesure-ttdi.md`](docs/04-protocole-mesure-ttdi.md).

---

## Mise en route

### 1. Installer les dépendances

```bash
npm install
```

### 2. Obtenir une base PostgreSQL

**Option recommandée — Supabase, sans rien installer :**

1. Créer un compte sur [supabase.com](https://supabase.com) → **New project** (offre gratuite).
2. Noter le mot de passe de la base, il n'est affiché qu'une fois.
3. Récupérer la chaîne de connexion : *Project Settings → Database → Connection string → URI*.

**Option locale — nécessite Docker Desktop :**

```bash
npm run db:start
```

### 3. Configurer l'API

Copier `apps/api/.env.example` vers `apps/api/.env`, puis renseigner :

- `DATABASE_URL` — la chaîne de connexion de l'étape 2 ;
- `JWT_SECRET` — 32 caractères minimum, à générer :

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

### 4. Créer le schéma

```bash
npm run migrer -- --seed
```

Applique les migrations manquantes dans l'ordre, chacune dans une transaction, et amorce le parc
d'équipements de démonstration. `npm run migrer -- --etat` liste sans rien appliquer.

### 5. Créer les comptes

Il n'y a pas de rôle Administrateur en v1.0 : les comptes se créent en ligne de commande, jamais par
un INSERT avec un mot de passe en clair.

```bash
npm run creer-utilisateur -- --matricule TC-2841 --nom Mballa --prenom Alain --role technicien
```

```bash
npm run creer-utilisateur -- --matricule TC-0412 --nom "Ngo Bell" --prenom Julie --role responsable
```

Un mot de passe aléatoire est généré et **affiché une seule fois** — il n'est stocké que haché.

### 6. Lancer

Deux terminaux :

```bash
npm run dev:api
```

```bash
npm run dev:web
```

Puis ouvrir **http://localhost:5173** et se connecter avec un matricule.

---

## Premiers pas dans l'application

**En responsable** — commencer par remplir le référentiel, sans quoi le technicien n'aura rien à
sélectionner :

1. *Import* — charger le parc réel depuis un export CSV DimoMaint (facultatif, le seed suffit pour
   essayer).
2. *Nomenclature* — ajouter quelques symptômes, défauts, causes et remèdes sur un équipement.
3. *Fiches CSD* — documenter l'état de référence d'une machine.

**En technicien** — le parcours de diagnostic : chaîne → équipement → symptôme → fiches triées par
fréquence → confirmation de la cause → clôture.

**De retour en responsable** — *Validation* pour relire la contribution, puis *Tableau de bord* pour
voir le Pareto, les indicateurs et le TTDi.

---

## Essayer sur un téléphone Android

Le serveur de développement n'écoute que sur `localhost`. Pour y accéder depuis un mobile du même
réseau :

```bash
npm run dev:web -- --host
```

Vite affiche alors une adresse `http://192.168.x.x:5173`. L'installation de la PWA (« Ajouter à
l'écran d'accueil ») exige **HTTPS ou localhost** : sur une adresse IP en clair, Chrome affiche
l'application mais ne proposera pas de l'installer. Pour un vrai test d'installation, déployer le
build derrière HTTPS.

---

## Vérifications

```bash
npm run test
```

```bash
npm run typecheck
```

```bash
npm run build
```

---

## Organisation

| Chemin | Rôle |
|---|---|
| `packages/shared` | Types du domaine et **règles métier** — source unique, exécutée côté front (hors ligne) et côté API (autorité) |
| `apps/api` | Couche 2 — API REST Express |
| `apps/web` | Couche 1 — PWA React, cache IndexedDB, service worker |
| `supabase/migrations` | Schéma PostgreSQL versionné |
| `design/maquettes` | Sources des maquettes (`.dc.html`) |
| `docs` | Journal des décisions, protocole de mesure |

**Règle structurante :** aucune règle métier n'est écrite dans `apps/web` ou `apps/api`.
Elles vivent toutes dans `packages/shared/src/regles/`.
