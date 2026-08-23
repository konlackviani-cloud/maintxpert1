# Protocole de mesure du TTDi

Ce document décrit **comment MaintXpert produit les chiffres** qui serviront à l'évaluation du
mémoire. Il est destiné à être défendu : chaque choix de mesure y est explicité, y compris ceux qui
s'écartent d'une lecture littérale du cahier des charges.

---

## 1. Les trois jalons

| Jalon | Champ | Posé par | Geste du technicien |
|---|---|---|---|
| **T1** | `intervention.datetime_ouverture` | A8 | Sélectionne l'équipement — il est devant la machine |
| **T1.5** | `intervention.datetime_cause_confirmee` | A9 | Touche « Confirmer cette cause » |
| **T2** | `intervention.datetime_cloture` | A11 | Touche « Clôturer l'intervention » |

- **TTDi** = T1.5 − T1 — *temps de diagnostic*, indicateur central
- **Durée totale** = T2 − T1

---

## 2. Où T1 est placé, et pourquoi

**Point à valider avec l'encadrement** (voir `03-decisions.md`, D14).

UC1 énumère l'ouverture de l'intervention (A8) en 4ᵉ position, **après** la confirmation de la cause
(A5). Pris à la lettre, T1 serait postérieur au diagnostic et **le TTDi vaudrait zéro** : l'indicateur
central du mémoire serait vide de sens.

L'énumération de UC1 est donc lue comme une **liste de fonctionnalités**, pas comme une chronologie.
Mise en œuvre retenue :

1. Le technicien sélectionne l'équipement → l'instant est capté (`marquerArrivee`, en mémoire de
   session). Il est devant la machine.
2. Il choisit un symptôme et ouvre les résultats → **l'intervention est créée**, horodatée à
   l'instant capté en 1. Parcourir la liste des équipements sans rien diagnostiquer n'ouvre donc
   aucun chantier.
3. Il confirme une cause → T1.5.
4. Il clôture → T2.

**Si le jury exige la chronologie littérale de UC1**, il faudra l'assumer et renoncer à la mesure.
C'est le seul écart qui touche directement la validité des résultats.

---

## 3. Ce qui garantit la fiabilité des horodatages

### 3.1 Horodatage terrain, pas horodatage d'envoi

Chaque geste est enregistré avec l'instant où il a eu lieu (`horodatage_terrain`), pas celui de la
synchronisation. Un technicien travaillant toute une nuit hors réseau verrait sinon ses trois jalons
écrasés à la même seconde le lendemain matin, et **toutes les mesures de la nuit seraient perdues**.

### 3.2 Un jalon ne se pose qu'une fois

Les mises à jour de T1.5 et T2 portent `and datetime_… is null` : un rejeu tardif de la file de
synchronisation ne peut pas réécrire un horodatage déjà posé. Reconfirmer une cause n'allonge pas
artificiellement le TTDi.

### 3.3 Pas de double comptage

Un journal d'idempotence (`mutation_appliquee`, clé = UUID généré sur le terminal) garantit qu'une
mutation rejouée renvoie son résultat d'origine sans rien réappliquer.

### 3.4 Une seule intervention par équipement à la fois

La lecture-puis-création se fait dans une transaction IndexedDB. Sans cela, deux appels concurrents
ouvraient **deux chantiers** pour le même équipement — défaut constaté et corrigé en phase 3.

---

## 4. Extraction des données

Tableau de bord responsable → **« Exporter les mesures »**.

Le fichier est généré **dans le navigateur, depuis le cache** : aucun appel réseau, donc
l'extraction reste possible hors ligne, et aucun traitement serveur intermédiaire n'a besoin d'être
décrit dans le mémoire.

Format : point-virgule, virgule décimale, BOM UTF-8 — Excel francophone l'ouvre sans étape d'import.

| Colonne | Contenu |
|---|---|
| `id_intervention` | Identifiant serveur |
| `chaine`, `equipement` | Périmètre |
| `id_technicien` | Permet l'analyse par opérateur |
| `T1_ouverture`, `T1_5_cause_confirmee`, `T2_cloture` | Horodatages ISO 8601 |
| `ttdi_secondes`, `ttdi_minutes` | T1.5 − T1 |
| `duree_totale_secondes`, `duree_totale_minutes` | T2 − T1 |
| `complete` | `oui` si les trois jalons sont posés |
| `id_sdcr` | Fiche à laquelle l'intervention a abouti, quel que soit le chemin |
| `issue` | `cause_confirmee` · `fiche_documentee` · `sans_conclusion` |

**Les interventions incomplètes figurent dans l'export.** Une intervention sans T1.5 est une donnée
du protocole, pas un déchet à masquer. Filtrer sur `complete = oui` avant de calculer les
statistiques, et **rapporter le taux d'incomplétude** : il est lui-même un résultat.

### 4.1 T1.5 vide recouvre deux situations opposées

Ne pas les confondre : c'est la lecture même du taux d'incomplétude qui en dépend.

| `issue` | Ce qui s'est passé | TTDi |
|---|---|---|
| `cause_confirmee` | Le technicien a retrouvé une fiche et confirmé sa cause (A5→A9) | mesuré |
| `fiche_documentee` | Aucune fiche ne correspondait : il en a documenté une (A6) | **non mesuré** |
| `sans_conclusion` | Ni confirmation ni fiche : interrompu, ou n'a pas trouvé | non mesuré |

**Seul A9 pose T1.5** — décision assumée, fidèle à la lettre du cahier des charges (D34). Un
diagnostic mené sans l'aide de la base aboutit donc à une intervention `fiche_documentee`, sans
TTDi : il a réussi, mais il n'est pas chronométré.

**Conséquence à énoncer dans le mémoire.** Le TTDi ne mesure que les diagnostics **assistés** par la
base. Il ne faut donc pas le présenter comme le temps de diagnostic « toutes causes », ni le comparer
à une durée de référence qui inclurait les recherches non assistées : la comparaison jouerait
mécaniquement en faveur de l'outil. La proportion `fiche_documentee` / `cause_confirmee` est à
rapporter — elle dit à quel point la base couvrait déjà le terrain pendant la campagne, et elle
diminue à mesure que la base se remplit.

Une vue SQL équivalente existe côté base : `vue_mesure_intervention` (migration 0006).

---

## 5. Statistique retenue : la médiane

Le tableau de bord affiche la **médiane**, pas la moyenne.

Une seule intervention qu'un technicien oublie de clôturer avant de partir décale la moyenne au point
de la rendre inutilisable. Exemple vérifié par test : sur `[10, 20, 30, 10 000]` secondes, la moyenne
vaut 2 515 s et la médiane 25 s. C'est la médiane qui décrit le cas courant.

Pour le mémoire, disposer du fichier complet permet de rapporter les deux, plus les quartiles.

---

## 6. Protocole de campagne suggéré

Ce qui suit est une proposition, à ajuster selon les contraintes de l'usine.

1. **Mesure de référence (avant MaintXpert).** Relever manuellement, sur un nombre représentatif
   d'interventions correctives, le temps entre l'arrivée du technicien et l'identification de la
   cause. Sans ce point de départ, aucune amélioration n'est démontrable.
2. **Amorçage.** Charger le parc via l'import DimoMaint (B7), saisir une nomenclature initiale par
   équipement, documenter les fiches CSD des machines les plus critiques.
3. **Campagne.** Faire travailler les techniciens sur l'application pendant une période couvrant
   plusieurs quarts, nuits comprises — c'est là que le mode hors ligne est réellement sollicité.
4. **Extraction et analyse.** Exporter, filtrer sur `complete = oui`, comparer à la référence.

**Deux biais à mentionner dans le mémoire :**

- **Effet d'apprentissage.** Le TTDi baisse mécaniquement à mesure que la base SDCR se remplit — ce
  qui est l'effet recherché, mais se confond avec la prise en main de l'outil. Comparer les premières
  et dernières semaines permet de les séparer partiellement.
- **Effet Hawthorne.** Un technicien qui sait son temps mesuré ne travaille pas comme d'habitude.
  L'affichage du TTDi à l'écran est un choix assumé — retour utile plutôt que surveillance cachée —
  mais il accentue ce biais et doit être signalé.

---

## 7. Indicateurs complémentaires

| Indicateur | Où | Ce qu'il montre |
|---|---|---|
| Taux de recours à la nomenclature non contrôlée | Tableau de bord (B5) | Qualité de la nomenclature. Un taux qui baisse signale qu'elle se stabilise. |
| Pareto des causes | Tableau de bord | Concentration des arrêts. Le nombre de causes couvrant 80 % est un résultat en soi. |
| Fiches en attente de validation | Tableau de bord | Réactivité du circuit contributeur → valideur. |
| Nombre de défaillogrammes ouverts | Base | Passage effectif du niveau 1 au niveau 2. |
