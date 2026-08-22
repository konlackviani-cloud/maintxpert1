# MaintXpert — contexte projet

PWA de diagnostic guidé des défaillances industrielles. Mémoire d'ingénieur génie mécanique,
SABC, usine Terrain Court (Yaoundé) — 4 chaînes d'embouteillage : CH02, CH05, CH06, CH09.

Le cahier des charges du mémoire est **la source de vérité**. Tout écart doit être signalé et
validé explicitement (voir `docs/03-decisions.md`).

---

## 1. Modèle métier — SDCR

Raisonnement en **entonnoir à deux étages**, pas une chaîne linéaire :

| Niveau | Rôle |
|---|---|
| **S** — Symptôme | Effet perçu à l'arrivée. Clé d'entrée de la recherche (avec l'équipement). |
| **D** — Défaut | Constat vérifiable **sans coût**. Rôle **discriminant** : restreint l'espace de recherche entre S et C. |
| **C** — Cause | Cause **directe**. On ne remonte pas plus haut au niveau 1. |
| **R** — Remède | Action corrective qui rétablit le service. |

`1 symptôme → n défauts possibles` puis `1 défaut constaté → sous-ensemble de causes`.

Une `EntreeSDCR` est un **quadruplet complet attesté** (un chemin S→D→C→R déjà rencontré sur cet
équipement), pas un nœud d'arbre. `frequence_observee` qualifie ce chemin entier.

### Niveau 2 — défaillogramme
Pour les défaillances récurrentes (`frequence_observee >= seuil`, défaut 3, configurable), le
défaillogramme **prolonge** la cause directe : cause directe → cause intermédiaire → cause première.
Formalisme MAXER allégé, **topologie fixe à deux branches contributives convergentes**.
Objectif : fiabilisation (≠ remise en service).

---

## 2. Interdits absolus (ne jamais proposer ni implémenter)

- **Pas de similarité floue** dans la recherche FP1 : égalité stricte `symptome` + `id_equipement` uniquement.
- **Pas d'ouverture automatique** de défaillogramme : la suggestion s'affiche, l'ouverture est
  **toujours** une décision manuelle du responsable (initiative a posteriori).
- **Pas de suppression physique** : `TermeNomenclature.statut = 'archive'`, `EntreeSDCR.statut = 'archivee'`.
  Une entrée archivée reste liée aux interventions déjà réalisées.
- **Pas de multi-rôle** : un seul rôle actif par utilisateur en v1.0.
- **Pas de topologie libre** pour le défaillogramme.

### Hors périmètre v1.0
Gestion des comptes / rôle Administrateur · stocks de pièces détachées · planification préventive ·
interfaçage temps réel DimoMaint · MTTR/MTBF temps réel · éditeur graphique de chaîne causale.

---

## 3. Architecture

Trois couches, conformes au mémoire :

1. **Présentation** — PWA React + Vite + TypeScript, service worker, cache local IndexedDB (Dexie).
2. **Logique métier** — API REST Node.js + Express.
3. **Données** — PostgreSQL (Supabase) + stockage objet Supabase pour les photos.

### Règle d'or : hors ligne d'abord
La liaison présentation ↔ API n'est sollicitée **que par la synchronisation**, jamais par la
consultation. 100 % des fonctions de consultation (recherche SDCR, fiches CSD, dashboard en cache)
doivent fonctionner sans réseau.

### Conséquence : `packages/shared`
Les règles métier (recherche/tri FP1, IPR, transitions d'état, seuil de récurrence) sont écrites
**une seule fois**, en fonctions pures TypeScript dans `packages/shared/src/regles/`.

- Le **front** les exécute sur le cache IndexedDB → consultation hors ligne.
- L'**API** les exécute sur PostgreSQL et fait **autorité** à la synchronisation.

Ne jamais dupliquer une règle métier dans `apps/web` ou `apps/api`. Si une règle manque, elle
s'ajoute dans `packages/shared`.

---

## 4. Traitement des photos (spécification stricte)

- Compression **côté client**, avant mise en file.
- Redimensionnement : **1600 px** de côté max.
- Format **WebP qualité 78 %**, repli **JPEG** si WebP indisponible.
- Recompression à **70 %** si le résultat dépasse **400 Ko**.
- **Une seule photo** par fiche SDCR ou CSD.
- File de synchronisation **indépendante** de celle du texte (`file-photos` ≠ `file-mutations`).

Constantes dans `packages/shared/src/constantes.ts` — ne pas les redéclarer ailleurs.

---

## 5. Machine à états `EntreeSDCR`

```
en_attente → validee | rejetee | en_correction
en_correction → validee | rejetee
validee → archivee
rejetee → archivee
```

Une entrée `validee` devient **immédiatement** consultable par tous les techniciens (FP1).
Transitions implémentées dans `packages/shared/src/regles/statut-sdcr.ts` — seule référence.

---

## 6. Jalons d'intervention (mesure du mémoire)

| Jalon | Champ | Fonctionnalité |
|---|---|---|
| **T1** | `datetime_ouverture` | A8 — ouverture |
| **T1.5** | `datetime_cause_confirmee` | A9 — cause confirmée |
| **T2** | `datetime_cloture` | A11 — clôture |

- **TTDi** = T1.5 − T1 (temps de diagnostic, indicateur central du mémoire)
- **Durée totale** = T2 − T1

Exposés par la vue SQL `vue_mesure_intervention`.

---

## 7. Périmètre — codes de fonctionnalité

Chaque module porte en en-tête le(s) code(s) qu'il couvre : `// A4 — affichage cartes triées par fréquence`.

**Technicien** — A1 auth · A2 chaîne/équipement · A3 symptôme · A4 cartes triées par fréquence ·
A5 confirmer la cause · A6 créer fiche si aucune ne correspond · A7 consulter CSD · A8 ouvrir (T1) ·
A9 cause confirmée (T1.5) · A10 saisir entrée SDCR · A11 clôturer (T2) · A12 statut de ses contributions.

**Responsable** — B1 valider/rejeter/corriger · B2 nomenclature (ajout, fusion, archivage) ·
B3 recherche avancée · B4 AMDEC/IPR · B5 tableau de bord · B6 fiches CSD · B7 import CSV DimoMaint ·
B8 défaillogramme.

---

## 8. Conventions

| Élément | Convention | Exemple |
|---|---|---|
| Tables / colonnes SQL | `snake_case`, français | `entree_sdcr.frequence_observee` |
| Types & interfaces TS | `PascalCase`, français métier | `EntreeSDCR`, `StatutSDCR` |
| Fichiers | `kebab-case` | `recherche-frequence.ts` |
| Composants React | `PascalCase`, 1 par fichier | `CarteSDCR.tsx` |
| Fonctions | `camelCase` — français métier, anglais technique | `calculerIPR()`, `fetchWithRetry()` |
| Routes API | `/api/v1/<ressource-kebab>` | `/api/v1/entrees-sdcr/:id/valider` |
| Tests | `*.test.ts` co-localisé | `ipr.test.ts` |

Interface **100 % française**, messages d'erreur inclus.

---

## 9. UX terrain (contraintes fortes)

Techniciens en horaires décalés / de nuit, mains gantées, réseau non fiable.

- Cibles tactiles **≥ 56 px**, texte de base **17 px**.
- **Listes déroulantes filtrables** prioritaires, saisie libre minimisée.
- Indicateur permanent d'état de connexion + file de synchronisation en attente + dernière synchro.
- **États vides explicites partout** — jamais d'écran cassé ni d'erreur quand il n'y a pas de donnée.
- Contraste élevé (éclairage d'usine / extérieur).

---

## 10. Commandes

```bash
npm install              # à la racine (workspaces)
npm run dev:api          # API Express, port 3000
npm run dev:web          # PWA Vite, port 5173
npm run test             # vitest sur tous les workspaces
npm run typecheck        # tsc --noEmit partout
npm run db:start         # supabase start (nécessite Docker Desktop)
npm run db:reset         # rejoue migrations + seed
```

---

## 11. Plan de développement — avancement

| Phase | Contenu | État |
|---|---|---|
| 1 | Setup monorepo, migrations, PWA | fait |
| 2 | Authentification A1 (JWT matricule) | fait |
| 3 | Cœur technicien A2–A12 + offline-first | fait |
| 4 | Nomenclature & validation B1, B2 | à faire |
| 5 | CSD & photos A7, B6 | à faire |
| 6 | AMDEC & import CSV B4, B7 | à faire |
| 7 | Dashboard B5, B3 | à faire |
| 8 | Défaillogramme B8 | à faire |
| 9 | Durcissement, tests, mesure TTDi | à faire |

**Ne pas passer à la phase suivante sans validation explicite de l'utilisateur.**
