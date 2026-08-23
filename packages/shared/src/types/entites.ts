/**
 * Entités du domaine — miroir du dictionnaire de données (mémoire, section 3),
 * augmenté des trois ajouts validés (voir docs/03-decisions.md, D5).
 *
 * Les dates sont typées `string` (ISO 8601) : c'est la forme transportée par
 * l'API et stockée dans IndexedDB. La conversion en `Date` est de la
 * responsabilité de la couche présentation.
 */

import type { RoleUtilisateur, StatutSDCR, StatutTerme, TypeTerme } from './enums.js';

/* -------------------------------------------------------------------------- */

export interface Utilisateur {
  id_utilisateur: number;
  nom: string;
  prenom: string;
  /** Identifiant de connexion (A1). Jamais un email. */
  matricule: string;
  role: RoleUtilisateur;
  actif: boolean;
}

/** Utilisateur tel que stocké en base. Ne doit JAMAIS franchir la frontière de l'API. */
export interface UtilisateurAvecSecret extends Utilisateur {
  mot_de_passe_hash: string;
}

/* -------------------------------------------------------------------------- */

export interface Equipement {
  id_equipement: number;
  nom: string;
  famille: string;
  chaine: string;
}

/* -------------------------------------------------------------------------- */

export interface TermeNomenclature {
  id_terme: number;
  libelle: string;
  type: TypeTerme;
  /** Un terme est propre à un équipement (choix du mémoire). */
  id_equipement: number;
  statut: StatutTerme;
  /** Incrémenté à chaque sélection — oriente le tri des listes déroulantes. */
  compteur_usage: number;
  categorie_afnor: string | null;
  /** Renseigné par une fusion (B2) : ce terme est archivé et redirige vers celui-ci. */
  id_terme_remplacant: number | null;
}

/* -------------------------------------------------------------------------- */

/**
 * Quadruplet complet attesté S -> D -> C -> R sur un équipement donné.
 * Chaque niveau porte une FK vers la nomenclature (nullable) ET le libellé
 * dénormalisé : le libellé rend FP1 exécutable sans jointure sur IndexedDB.
 */
export interface EntreeSDCR {
  id_sdcr: number;
  id_equipement: number;

  id_terme_symptome: number | null;
  symptome: string;
  id_terme_defaut: number | null;
  defaut: string;
  id_terme_cause: number | null;
  cause: string;
  id_terme_remede: number | null;
  remede: string;

  /** Incrémentée à chaque confirmation de cause (A5). Clé du tri FP1. */
  frequence_observee: number;
  /** Faux si saisie via « Autre » — alimente l'indicateur B5. */
  via_nomenclature: boolean;
  statut: StatutSDCR;
  photo_url: string | null;

  id_contributeur: number;
  id_valideur: number | null;

  date_creation: string;
  date_modification: string;
}

/* -------------------------------------------------------------------------- */

/** Configuration Sans Défaut — état de référence, une fiche par équipement. */
export interface FicheCSD {
  id_csd: number;
  id_equipement: number;
  description: string;
  photo_url: string | null;
}

/* -------------------------------------------------------------------------- */

export interface ModeAMDEC {
  id_mode: number;
  /** Équipement analysé (migration 0011, résout O2). */
  id_equipement: number;
  /** Pièce à l'intérieur de l'équipement, pas la machine elle-même. */
  composant: string;
  mode_defaillance: string;
  cause: string;
  effet: string;
  /** Cotations 1 à 4. */
  gravite: number;
  frequence: number;
  detection: number;
  /** Calculé : gravite x frequence x detection. */
  ipr: number;
}

/* -------------------------------------------------------------------------- */

/** Niveau 2 — topologie FIXE à deux branches contributives convergentes. */
export interface Defaillogramme {
  id_defaillogramme: number;
  id_equipement: number;
  /** Fiche SDCR de convergence — la récurrence à l'origine de l'analyse (migration 0012, résout O1). */
  id_sdcr: number;
  /** Responsable ayant décidé de l'ouverture — rend auditable l'initiative a posteriori. */
  id_responsable: number;
  branche1_objet: string;
  branche1_defaut: string;
  branche2_objet: string;
  branche2_defaut: string;
  symptome_convergence: string;
  cause_intermediaire: string;
  cause_premiere: string;
  date_creation: string;
}

/* -------------------------------------------------------------------------- */

export interface Intervention {
  id_intervention: number;
  id_technicien: number;
  id_equipement: number;
  id_sdcr: number | null;
  /** T1 — ouverture (A8). */
  datetime_ouverture: string;
  /** T1.5 — cause confirmée (A9). */
  datetime_cause_confirmee: string | null;
  /** T2 — clôture (A11). */
  datetime_cloture: string | null;
}

/* -------------------------------------------------------------------------- */

export interface EntreeConfiguration {
  cle: string;
  valeur: string;
  description: string;
}

