# Journal des décisions (ADR)

Toute décision qui s'écarte du cahier des charges, ou qui l'interprète, est consignée ici.

---

## D1 — Couche 2 : Node.js + Express
**Statut :** validé le 2026-08-22

API REST Express, PostgreSQL Supabase en couche 3, stockage objet Supabase pour les photos.

Alternatives écartées : Supabase Edge Functions (débogage local lourd, contournements requis pour
l'authentification par matricule) ; PostgREST + RLS seul (supprime la couche 2 et s'écarte de
l'architecture trois couches du mémoire).

---

## D2 — Authentification : JWT maison adossé au matricule
**Statut :** validé le 2026-08-22

Table `utilisateur` conforme au dictionnaire, hachage **argon2id**, JWT signé par l'API avec
expiration (8 h — couvre un quart) + jeton de rafraîchissement (7 j).

`[auth]` est désactivé dans `supabase/config.toml` : Supabase Auth impose un email comme identifiant,
alors que le dictionnaire désigne le **matricule**. Fabriquer un email fictif aurait ajouté un
identifiant artificiel en base sans bénéfice.

---

## D3 — Champs SDCR : clé étrangère **et** libellé dénormalisé
**Statut :** validé le 2026-08-22

Chaque niveau S/D/C/R de `entree_sdcr` est stocké en couple `id_terme_*` (FK nullable) + libellé
`varchar`.

- La **FK** rend possibles la fusion, le renommage et l'archivage de termes (B2) sans
  rechercher-remplacer massif, et fiabilise `compteur_usage`.
- Le **libellé** accueille la saisie libre (« Autre », `via_nomenclature = false`) et rend FP1
  exécutable sur IndexedDB sans jointure — condition de la consultation hors ligne.

La contrainte `chk_via_nomenclature` garantit que `via_nomenclature = true` implique les quatre FK
renseignées.

---

## D4 — Environnement Supabase : local via CLI, **Docker absent du poste**
**Statut :** validé le 2026-08-22, **avec réserve**

Décision retenue : stack Supabase locale (`npm run db:start`), migrations versionnées dans le dépôt.

**Réserve constatée à l'exécution :** Docker Desktop n'est pas installé sur le poste de
développement. `supabase start` ne peut donc pas s'exécuter en l'état. Les migrations sont écrites
et versionnées ; leur application nécessite soit l'installation de Docker Desktop, soit un repli
temporaire sur un projet Supabase distant (`DATABASE_URL` dans `apps/api/.env`).

---

## D5 — Trois ajouts au dictionnaire de données
**Statut :** validé le 2026-08-22

Ajouts sans lesquels des fonctionnalités demandées sont infaisables :

| Ajout | Table | Motif |
|---|---|---|
| `id_contributeur` (FK Utilisateur, NOT NULL) | `entree_sdcr` | **A12** — « consulter le statut de *ses* contributions » suppose de savoir qui a contribué. |
| `date_creation`, `date_modification` | `entree_sdcr` | **B5 / UC4** — filtres par période, indicateurs de suivi, file de validation ordonnée. |
| `id_equipement` (FK Equipement, NOT NULL) | `intervention` | Une intervention ouverte hors fiche existante (parcours **A6**) n'était rattachable à aucun équipement ; le **TTDi** n'était pas ventilable par chaîne. |

---

## D6 — Table `configuration`
**Statut :** décidé le 2026-08-22

Le cahier des charges impose un seuil de récurrence « configurable » (FP5) sans lui donner de support
de persistance. Table clé/valeur `configuration`, amorcée avec `seuil_recurrence = 3` et
`seuil_ipr_critique = 12`.

Ce n'est pas une extension fonctionnelle : c'est le support d'une exigence déjà écrite.

---

## D7 — Règles métier dans `packages/shared`
**Statut :** décidé le 2026-08-22 — **écart d'interprétation signalé**

Le mémoire place la recherche par fréquence, le calcul d'IPR et la validation des transitions dans la
couche 2 (API). L'exigence « hors ligne d'abord » impose que la consultation (dont FP1) fonctionne
sans réseau, donc dans le navigateur. Les deux ne peuvent être vrais littéralement.

Résolution : **une seule implémentation** des règles, en fonctions pures dans `packages/shared`.
Le front les exécute sur IndexedDB (consultation hors ligne), l'API les exécute sur PostgreSQL et
fait **autorité** à la synchronisation. Aucune règle métier n'est dupliquée dans `apps/web` ou
`apps/api`.

---

## D8 — Normalisation des libellés avant comparaison FP1
**Statut :** décidé le 2026-08-22

`normaliserLibelle()` réduit casse et espaces surnuméraires avant comparaison. Ce **n'est pas** une
similarité approchée : deux libellés différents restent différents, conformément à l'exigence
d'égalité stricte.

La fonction SQL `normaliser_libelle()` (migration 0004) en est le **miroir exact**, et l'index
`idx_sdcr_fp1` est construit dessus. Toute modification doit être répercutée des deux côtés, sans
quoi la recherche hors ligne et la recherche serveur divergent.

---

## D9 — Jetons sans état, révocation par `actif`
**Statut :** décidé le 2026-08-22 (phase 2)

Jeton d'accès **8 h** (couvre un quart), jeton de rafraîchissement **7 j**, tous deux signés HS256
avec le même secret mais porteurs d'un champ `type` : un jeton de rafraîchissement présenté comme
jeton d'accès est rejeté, et réciproquement.

Aucune table de sessions : les jetons sont sans état. Le **seul point de révocation** est le drapeau
`utilisateur.actif`, relu en base à chaque rafraîchissement et à chaque lecture de profil.

**Conséquence assumée :** désactiver un compte coupe l'accès au plus tard à l'expiration du jeton
d'accès en cours, donc jusqu'à 8 h plus tard. Acceptable tant que le nombre d'utilisateurs reste
limité et qu'aucun rôle Administrateur n'existe (hors périmètre v1.0). À revoir si un vol de
terminal doit être traité en temps réel.

---

## D10 — Hachage argon2id via `@node-rs/argon2`
**Statut :** décidé le 2026-08-22 (phase 2)

Paramètres OWASP : 19 MiB de mémoire, 2 itérations, parallélisme 1.

`@node-rs/argon2` plutôt que `argon2` : binaires précompilés, aucun compilateur C++ requis sur le
poste Windows de développement.

L'algorithme n'est **pas** passé explicitement (`Algorithm` est un const enum ambiant, incompatible
avec `verbatimModuleSyntax`). argon2id est le défaut de la librairie, et un test vérifie que
l'empreinte produite commence bien par `$argon2id$` — c'est ce contrôle qui fait foi.

---

## D11 — Pas d'oracle d'énumération des matricules
**Statut :** décidé le 2026-08-22 (phase 2)

Un matricule inconnu déclenche quand même une vérification argon2 contre une empreinte factice, et
renvoie **le même message** qu'un mot de passe faux : « Matricule ou mot de passe incorrect. »

Sans cela, la différence de temps de réponse et de message permettrait d'énumérer les matricules du
personnel. Un compte **désactivé** reçoit en revanche un message distinct — mais seulement après
validation du mot de passe, donc uniquement pour son titulaire légitime.

---

## D12 — Jetons en `localStorage`
**Statut :** décidé le 2026-08-22 (phase 2)

Pas de cookie : le terminal est un appareil personnel partagé entre quarts, il faut pouvoir tout
effacer d'un geste. `seDeconnecter()` efface les jetons **et** purge le cache IndexedDB — exigence
BYOD.

**Conséquence assumée :** une faille XSS dans la PWA exposerait les jetons. Risque contenu par
l'expiration 8 h et par l'absence de tout contenu tiers dans l'application.

---

## D13 — Palette dérivée du logo MaintXpert
**Statut :** décidé le 2026-08-22

Couleurs échantillonnées dans `design/logo/maintxpert.png` par
`scripts/analyser-logo.mjs` (classement des pixels par teinte puis moyenne du cœur des aplats — la
source est un bitmap compressé, aucune zone n'y est strictement uniforme).

| Jeton | Valeur | Contraste sur blanc | Usage |
|---|---|---|---|
| `--c-marque-bleu` | `#3174DA` | 4,52:1 | Bleu **exact** du logo. Aplats, pictogrammes, barres. Pas de texte courant. |
| `--c-marque-nuit` | `#050F2F` | 18,82:1 | Bleu nuit **exact** du logo. Repris par `--c-texte`. |
| `--c-primaire` | `#275DAE` | 6,44:1 | Bleu du logo assombri, même teinte. Boutons, texte bleu, bordures. |
| `--c-primaire-fonce` | `#1E4887` | 9,01:1 | Survol, pression. |
| `--c-primaire` (nuit) | `#4F9FFF` | 5,98:1 sur `#16212F` | Bleu du logo éclairci pour le mode sombre. |

**Le logo ne contient pas d'orange.** Une lecture de la vignette m'avait fait introduire un jeton
`--c-marque-orange` : l'analyse du fichier a montré qu'il n'existe pas — le « X » de *maintXpert* est
bleu. Le jeton a été retiré. L'orange reste donc purement sémantique dans l'interface (en attente,
récurrence signalée, hors ligne).

Icônes PWA regénérées depuis le pictogramme du logo par `npm run icones` (`scripts/generer-icones.mjs`,
détourage x 53–161 / y 2–40 — au-delà de y=40 on capture le haut du grand « X » bleu du mot-symbole).

---

## D14 — T1 est daté de l'arrivée devant la machine
**Statut :** décidé le 2026-08-22 (phase 3) — **interprétation à confirmer**

UC1 énumère l'ouverture de l'intervention (A8) en 4ᵉ position, après la confirmation de la cause
(A5). Pris à la lettre, T1 serait postérieur au diagnostic et **le TTDi (T1.5 − T1) vaudrait zéro** :
l'indicateur central du mémoire serait vide de sens.

L'énumération de UC1 est donc lue comme une liste de fonctionnalités, pas comme une chronologie.
Mise en œuvre :

- **T1 est capté à la sélection de l'équipement** — l'instant où le technicien se présente devant la
  machine (`marquerArrivee`, en `sessionStorage`).
- **L'intervention n'est créée qu'à l'ouverture des résultats**, quand un diagnostic commence
  vraiment : parcourir la liste des équipements ne doit pas ouvrir de chantier.
- Elle porte alors l'horodatage d'arrivée, pas celui de sa création.

Le TTDi mesure ainsi le temps réel de diagnostic. **À confirmer** : si le mémoire exige la
chronologie littérale de UC1, il faudra l'assumer et renoncer à la mesure.

---

## D15 — Horodatage terrain, pas horodatage d'envoi
**Statut :** décidé le 2026-08-22 (phase 3)

Chaque mutation de la file porte `horodatage_terrain`, fixé au moment du geste. Le serveur l'utilise
tel quel pour T1, T1.5 et T2.

Sans cela, un technicien travaillant toute une nuit hors réseau verrait ses trois jalons écrasés à
la même seconde lors de la synchronisation du matin — et tout le protocole de mesure du mémoire
s'effondrerait.

---

## D16 — Idempotence de la synchronisation montante
**Statut :** décidé le 2026-08-22 (phase 3)

Table d'infrastructure `mutation_appliquee` (migration 0009), clé = UUID généré sur le terminal.
Un rejeu renvoie le résultat d'origine sans rien réappliquer.

Nécessaire car un rejeu est normal : réseau coupé après traitement mais avant l'accusé de réception.
Sans journal, une confirmation rejouée incrémenterait deux fois `frequence_observee` — la valeur qui
ordonne FP1 et déclenche la suggestion de défaillogramme.

Deux protections complémentaires, pour les cas que le journal ne couvre pas :
- les jalons T1.5 et T2 ne s'écrivent que si le champ est `null` (`is null` dans le `WHERE`), donc un
  second geste avec un autre `id_local` ne peut pas réécrire un horodatage déjà posé ;
- côté terminal, `obtenirInterventionCourante` fait sa lecture-puis-création dans **une transaction
  IndexedDB** : deux appels concurrents ne peuvent plus ouvrir deux chantiers pour un même
  équipement (défaut constaté et corrigé en vérification navigateur).

---

## Points ouverts (non tranchés)

| # | Point | Phase concernée |
|---|---|---|
| **O1** | `defaillogramme.symptome_convergence` est décrit « lié à une EntreeSDCR » mais typé VARCHAR. Ajouter une FK `id_sdcr` ? | 8 |
| **O2** | `mode_amdec` n'a aucun rattachement à `equipement` (seulement `composant` en texte) : le tableau de bord B4 ne peut pas filtrer par chaîne. Ajouter `id_equipement` ? | 6 |
| **O3** | B2 « fusion » de termes : sans suppression physique, il faut une redirection (`id_terme_remplacant` FK nullable + réécriture des entrées). | 4 |
| **O4** | `TermeNomenclature` propre à un équipement (conforme au mémoire) → duplication des libellés courants sur les 4 chaînes. Rattachement à la `famille` avec surcharge ? | 4 |
| **O5** | Statut `en_correction` : le responsable édite lui-même puis valide, ou renvoie la fiche au technicien ? | 4 |
| **O6** | `archivee` : qui archive, sur quel critère ? | 4 |
| **O7** | Format réel du CSV DimoMaint (colonnes) — extrait à fournir. | 6 |
| **O8** | Volume de cache : le technicien met-il en cache les 4 chaînes ou seulement la sienne ? | 3 |
| **O9** | Format réel des matricules SABC. Le motif accepté est volontairement permissif (`[A-Z0-9_-]`, 3 à 20 caractères) faute d'exemples réels. | 2 |
| **O10** | Version **carrée** du pictogramme MaintXpert. Le symbole actuel est un demi-engrenage large (~2,9:1), coupé par le mot-symbole : dans une icône carrée il n'occupe qu'une bande centrale. Un SVG donnerait aussi des icônes nettes — la source est un bitmap de 215 px. | 9 |
