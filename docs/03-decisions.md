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

## D17 — Les écrans du responsable travaillent en ligne
**Statut :** décidé le 2026-08-22 (phase 4) — **écart signalé**

La file de validation (B1) et la gestion de la nomenclature (B2) appellent l'API directement, sans
passer par le cache local.

Le cahier des charges exige que « 100 % des fonctions de **consultation** » fonctionnent hors ligne.
Valider une contribution n'est pas de la consultation : c'est une écriture qui engage toute la base
lue par les techniciens. La faire sur des données périmées ferait valider deux fois le même doublon,
ou trancher sur une fiche qu'un autre responsable vient de traiter. C'est du travail de bureau, sur
poste connecté.

La règle hors ligne reste entière pour le technicien, et s'appliquera au **tableau de bord (B5,
phase 7)**, qui est bien de la consultation.

Conséquence traitée : `ErreurReseau` porte par défaut « vos saisies seront envoyées plus tard », vrai
pour le technicien mais faux ici. Les écrans responsable ont leur propre message
(`messageErreurPilotage`) — sans quoi le responsable quitterait l'écran en croyant avoir publié une
fiche.

---

## D18 — Résolution du point ouvert O5 : les deux voies coexistent
**Statut :** décidé le 2026-08-22 (phase 4) — **à confirmer**

Le point O5 demandait si `en_correction` signifie « le responsable corrige lui-même » ou « la fiche
repart au technicien ». Les deux sont implémentés, car ils répondent à des cas différents :

- **Correction directe** — le responsable rattache les niveaux saisis librement à la nomenclature,
  puis valide. Chemin courant, celui qui construit la nomenclature.
- **Renvoi en correction** — la fiche passe à `en_correction` quand le contenu technique lui-même
  est douteux et que seul son auteur peut trancher.

**Limite connue :** le motif du renvoi (comme celui du rejet) est exigé par le schéma mais **n'est
pas persisté** — `entree_sdcr` n'a pas de champ pour cela. Le technicien voit donc sa fiche revenir
sans savoir pourquoi. Voir point ouvert O11.

---

## D19 — Dépôt des photos : disque en attendant le stockage objet Supabase
**Statut :** décidé le 2026-08-22 (phase 5) — **écart temporaire**

Le cahier des charges prévoit le **stockage objet Supabase**. Tant que l'instance n'est pas
provisionnée, `apps/api/src/modules/photos/depot.ts` écrit sur disque
(`STOCKAGE_PHOTOS`, défaut `./donnees/photos`).

Le reste de l'application ne voit qu'une interface — `deposer` / `lire` / `supprimer`. Basculer
consistera à écrire un second adaptateur ; aucun appelant ne change.

Deux points de sécurité tenus dès maintenant :
- le nom de fichier est un **UUID généré côté serveur**, jamais celui fourni par le client — un nom
  venu du terminal pourrait contenir `../` ;
- toute lecture est **contrainte au dossier de stockage** (`resolve` puis vérification du préfixe).

Les photos sont servies **authentifiées** : elles montrent l'intérieur des machines de l'usine.

---

## D20 — Suppression physique des photos remplacées
**Statut :** décidé le 2026-08-22 (phase 5)

Seule exception à l'interdiction de supprimer : quand une photo de référence CSD est remplacée,
l'ancienne est effacée du dépôt.

L'interdiction porte sur les **données métier** — fiches, termes — pour l'auditabilité. Une photo
qui n'est plus référencée par aucune ligne n'apporte aucune traçabilité, seulement du stockage
occupé.

---

## D21 — Pipeline photo vérifié contre les seuils chiffrés
**Statut :** vérifié le 2026-08-22 (phase 5)

Mesures réelles dans le navigateur, `apps/web/src/medias/compression-photo.ts` :

| Source | Sortie | Passes | Poids final |
|---|---|---|---|
| 4000 × 3000, 35,9 Mo | 1600 × 1200 WebP | 0,78 puis 0,70 | 369 Ko |
| 3000 × 4000 (portrait) | 1200 × 1600 WebP | 0,78 puis 0,70 | 369 Ko |
| 800 × 600 | inchangée | 0,78 seule | 250 Ko |

La compression a lieu **à la sélection**, pas à l'envoi : le technicien voit le poids réel de ce qui
partira, et une photo de 36 Mo ne séjourne jamais dans IndexedDB.

La file de photos est **séparée** de celle du texte. Une photo en échec au fond d'un bâtiment ne doit
pas bloquer la remontée des jalons d'intervention qui la suivent. Les photos partent **après** le
texte : une fiche créée hors ligne doit avoir reçu son identifiant serveur avant que sa photo puisse
s'y rattacher.

---

## D22 — `mode_amdec.id_equipement` (résout O2)
**Statut :** décidé le 2026-08-22 (phase 6)

Migration 0011. Le dictionnaire ne donne à `mode_amdec` qu'un `composant` en texte libre : impossible
de filtrer l'analyse par chaîne ou par équipement, alors que UC4 le demande et qu'une AMDEC n'a de
sens que rapportée à une machine.

`composant` est conservé : il désigne la **pièce** (« capteur de niveau »), pas la machine.
Unicité ajoutée sur (équipement, composant, mode de défaillance) — un même mode ne se décrit qu'une
fois.

---

## D23 — Suppression admise pour les modes AMDEC
**Statut :** décidé le 2026-08-22 (phase 6)

Seconde exception à l'interdiction de supprimer, après les photos remplacées (D20).

L'interdiction protège le **retour d'expérience** : fiches SDCR et termes de nomenclature, auxquels
des interventions sont rattachées. Un mode AMDEC est une **hypothèse d'analyse**, sans historique en
dépendance. La retirer quand elle se révèle fausse vaut mieux que de la laisser fausser le
classement de criticité.

---

## D24 — Import CSV : analyse côté navigateur, aperçu avant écriture
**Statut :** décidé le 2026-08-22 (phase 6)

Le fichier est lu, découpé et rattaché **dans le navigateur** ; l'API ne reçoit que des lignes déjà
structurées. Le responsable voit donc l'aperçu et corrige le rattachement des colonnes **avant** que
quoi que ce soit n'atteigne la base — un rattachement erroné créerait des centaines d'équipements
faux.

Analyseur écrit à la main plutôt qu'emprunté : l'export attendu vient d'Excel francophone
(point-virgule, BOM UTF-8, guillemets doublés), et le format réel de DimoMaint n'ayant pas été
fourni (**O7**), séparateur et colonnes sont **détectés, jamais présumés**.

Insertion idempotente (`on conflict (chaine, nom) do nothing`) : un import initial se relance
souvent après correction, rejouer le fichier ne doit pas dupliquer.

Vérifié sur un export réaliste : BOM retiré, `;` détecté malgré une virgule dans un libellé cité,
`Libellé équipement`/`Type`/`Ligne` rattachés correctement, guillemets doublés restitués, doublons
internes fusionnés, `ch02` normalisé, lignes fautives rejetées avec leur numéro. 24 tests unitaires.

---

## D25 — Le tableau de bord lit le cache, pas le réseau
**Statut :** décidé le 2026-08-23 (phase 7)

Contrairement à la validation et à la nomenclature (D17), le tableau de bord (B5) et la recherche
avancée (B3) sont de la **consultation** : la règle « hors ligne d'abord » s'y applique pleinement.
Pareto, indicateurs et filtres sont calculés dans le navigateur, sur IndexedDB.

Conséquence sur la synchronisation descendante, désormais **sensible au rôle** :

| | Technicien | Responsable |
|---|---|---|
| Fiches SDCR | validées + ses contributions | **toutes** |
| Interventions | les siennes | **toutes** |
| Modes AMDEC | tous | tous |
| Fiches CSD | toutes | toutes |

Le responsable a besoin des fiches en attente pour son compteur de file, et de toutes les
interventions pour le TTDi médian du service — le restreindre fausserait les deux indicateurs.

---

## D26 — Pareto pondéré par la fréquence observée
**Statut :** décidé le 2026-08-23 (phase 7)

`construirePareto()` somme `frequence_observee`, **pas** le nombre de fiches : une cause constatée
douze fois pèse douze arrêts, pas un. C'est cette pondération qui fait du Pareto un outil de
décision plutôt qu'un inventaire.

Deux choix qui en découlent :

- **La cause qui fait franchir le seuil en fait partie.** Avec 50 / 30 / 20, le cumul atteint 80 %
  à la deuxième : `nb_causes_seuil = 2`. C'est bien elle qu'il faut traiter pour atteindre les 80 %.
- **Médiane, pas moyenne**, pour le TTDi et la durée totale. Une seule intervention laissée ouverte
  toute une nuit décalerait la moyenne au point de la rendre inutilisable ; la médiane décrit le cas
  courant. Un test le vérifie sur une valeur aberrante.

Le taux de nomenclature libre (**B5**) se calcule sur les fiches **validées** : c'est ce que voit le
technicien qui cherche, donc ce que l'indicateur doit mesurer.

---

## D27 — Défaillogramme : liens et traçabilité de la décision (résout O1)
**Statut :** décidé le 2026-08-23 (phase 8)

Migration 0012, deux colonnes.

**`id_sdcr`** — résout O1. Le dictionnaire décrivait `symptome_convergence` comme « lié à une
EntreeSDCR » mais le typait en VARCHAR : le lien était décrit sans exister. Sans lui, impossible de
savoir quelle récurrence a déclenché l'analyse. Un index unique interdit d'en ouvrir deux sur la
même fiche — deux analyses de la même panne produiraient deux vérités concurrentes.

`symptome_convergence` est **conservé** : il fige le symptôme tel qu'il était au moment de l'analyse.
Si le responsable renomme le terme plus tard (B2), le défaillogramme doit continuer de dire ce qui a
été analysé.

**`id_responsable`** — ajout hors dictionnaire. Le cahier des charges insiste : l'ouverture est
**toujours** une décision manuelle (initiative a posteriori). Sans trace de qui a décidé, ce principe
n'est pas auditable : rien ne distinguerait une analyse décidée d'une analyse produite
automatiquement.

---

## D28 — Topologie fixe, garantie par le schéma
**Statut :** décidé le 2026-08-23 (phase 8)

`schemaDefaillogramme` déclare quatre champs de branche nommés — aucun tableau. Une troisième
branche n'est pas rejetée : elle n'a **pas de place** dans le schéma. C'est ce qui rend impossible la
dérive vers l'éditeur à topologie libre, explicitement hors périmètre v1.0.

Deux garde-fous supplémentaires, tous deux testés :

- **Les deux branches doivent être distinctes.** Deux branches identiques ne convergent pas : elles
  décrivent la même contribution écrite deux fois, et le défaillogramme perd son sens. Vérifié à la
  casse et aux espaces près. Un même objet avec deux défauts différents reste valide.
- **Seule une fiche validée** peut faire l'objet d'un défaillogramme : une contribution non relue ne
  constitue pas une récurrence établie.

Le symptôme et l'équipement ne sont **pas** fournis par le client : ils sont lus sur la fiche.
Les laisser saisir permettrait de créer un défaillogramme qui ne correspond pas à la récurrence
qu'il prétend analyser.

---

## D29 — Export des mesures généré côté navigateur
**Statut :** décidé le 2026-08-23 (phase 9)

Le CSV du protocole de mesure est produit **dans le navigateur, depuis le cache** — aucun appel
réseau. Deux raisons :

1. L'extraction reste possible hors ligne, comme le reste de la consultation.
2. Aucun traitement serveur intermédiaire n'a besoin d'être décrit dans le mémoire : ce qui est
   exporté est exactement ce que l'application a enregistré.

Format point-virgule, virgule décimale, BOM UTF-8 : Excel francophone ouvre le fichier sans étape
d'import. Un export qu'on doit reformater à la main n'est pas exploitable.

**Les interventions incomplètes figurent dans l'export**, marquées `complete = non`. Une intervention
sans T1.5 est une donnée du protocole — un cas où le technicien n'a pas trouvé, ou a été interrompu —
pas un déchet à masquer. Le taux d'incomplétude est lui-même un résultat.

Protocole complet : `docs/04-protocole-mesure-ttdi.md`.

---

## D30 — Garde-fou de rendu
**Statut :** décidé le 2026-08-23 (phase 9)

Sans limite d'erreur React, une exception dans un composant démonte tout l'arbre et laisse un écran
blanc. Sur le terrain, de nuit, le technicien n'a alors aucun moyen de comprendre ni de repartir.

`GardeFou` affiche le message d'erreur et deux issues : recharger, ou revenir à l'accueil.

**Ce qu'il ne fait pas : purger le cache.** Les saisies en attente d'envoi y sont stockées ; les
effacer sur un simple plantage d'affichage perdrait le travail d'un quart entier. L'interface le dit
explicitement au technicien — « rien n'est perdu ».

---

## Lacunes de couverture connues

| Quoi | Pourquoi | Où |
|---|---|---|
| `supprimerMode` (AMDEC) | pg-mem refuse tout `DELETE` sur une table portant une colonne `generated always as … stored` ; PostgreSQL l'accepte. Reproduire le cas exigerait de retirer du schéma de test précisément ce que les autres tests vérifient. | `amdec.integration.test.ts` |
| Aller-retour photo complet | Envoi, stockage, relecture authentifiée : demande l'API en marche. Le pipeline de compression est mesuré dans le navigateur. | phase 5 |
| Enregistrement du service worker sur le build de production | Le sw.js produit est correct — vérifié par inspection : 15 entrées préchargées dont index.html, route de navigation pour la coquille hors ligne, /api/ en NetworkOnly, images en CacheFirst. Le manifeste satisfait tous les critères d'installabilité Android. Le service worker s'enregistre bien en développement. Sous ite preview, dans le navigateur embarqué, l'enregistrement échoue sur une erreur opaque non résolue. **À vérifier sur un vrai Chrome / un vrai terminal Android.** | phase 9 |
| Toutes les migrations | Écrites et validées syntaxiquement, jamais exécutées contre PostgreSQL. Les tests d'intégration tournent sur pg-mem, qui a déjà divergé sur `= any($1)` et sur `DELETE`. | — |

---

## Points ouverts (non tranchés)

| # | Point | Phase concernée |
|---|---|---|
| **O4** | `TermeNomenclature` propre à un équipement (conforme au mémoire) → duplication des libellés courants sur les 4 chaînes. Rattachement à la `famille` avec surcharge ? | 4 |
| **O6** | `archivee` : qui archive, sur quel critère ? | 4 |
| **O7** | Format réel du CSV DimoMaint (colonnes) — extrait à fournir. | 6 |
| **O8** | Volume de cache : le technicien met-il en cache les 4 chaînes ou seulement la sienne ? | 3 |
| **O9** | Format réel des matricules SABC. Le motif accepté est volontairement permissif (`[A-Z0-9_-]`, 3 à 20 caractères) faute d'exemples réels. | 2 |
| **O10** | Version **carrée** du pictogramme MaintXpert. Le symbole actuel est un demi-engrenage large (~2,9:1), coupé par le mot-symbole : dans une icône carrée il n'occupe qu'une bande centrale. Un SVG donnerait aussi des icônes nettes — la source est un bitmap de 215 px. | 9 |

| **O11** | Motif de rejet et de renvoi en correction : exigé par l'interface mais non persisté, `entree_sdcr` n'ayant pas de champ pour cela. Le technicien voit sa fiche revenir sans savoir pourquoi. Ajouter `motif_decision TEXT` ? | 4 |



