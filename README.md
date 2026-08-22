# MaintXpert

PWA de diagnostic guidé des défaillances industrielles — modèle **SDCR** (Symptôme, Défaut, Cause,
Remède). Service maintenance, usine Terrain Court (SABC, Yaoundé), chaînes CH02, CH05, CH06, CH09.

Le contexte projet complet est dans [`CLAUDE.md`](CLAUDE.md).
Les arbitrages techniques sont consignés dans [`docs/03-decisions.md`](docs/03-decisions.md).

---

## Démarrage

```bash
npm install
npm run icones                     # icônes PWA (déjà générées)
cp apps/api/.env.example apps/api/.env   # puis renseigner JWT_SECRET et DATABASE_URL
```

### Base de données

La stack Supabase locale requiert **Docker Desktop** :

```bash
npm run db:start     # démarre PostgreSQL (54322), Studio (54323)
npm run db:reset     # rejoue toutes les migrations + seed
```

Sans Docker, appliquer les fichiers de `supabase/migrations/` **dans l'ordre** via le SQL Editor
d'un projet Supabase distant, puis `supabase/seed.sql`, et pointer `DATABASE_URL` dessus.

### Développement

```bash
npm run dev:api      # API Express        http://localhost:3000
npm run dev:web      # PWA Vite           http://localhost:5173
```

Le serveur Vite proxifie `/api` vers l'API — pas de configuration CORS à faire en local.

### Vérifications

```bash
npm run test         # vitest
npm run typecheck    # tsc --noEmit sur les trois workspaces
npm run build        # build API (tsup) + PWA (vite)
```

---

## Organisation

| Chemin | Rôle |
|---|---|
| `packages/shared` | Types du domaine et **règles métier** — source unique, exécutée côté front (hors ligne) et côté API (autorité) |
| `apps/api` | Couche 2 — API REST Express |
| `apps/web` | Couche 1 — PWA React, cache IndexedDB, service worker |
| `supabase/migrations` | Schéma PostgreSQL versionné |
| `docs` | Journal des décisions |

**Règle structurante :** aucune règle métier n'est écrite dans `apps/web` ou `apps/api`.
Elles vivent toutes dans `packages/shared/src/regles/`.
