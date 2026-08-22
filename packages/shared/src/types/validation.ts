/** B1 / B2 — circuit contributeur → valideur, et gestion de la nomenclature. */

import type { EntreeSDCR, TermeNomenclature } from './entites.js';

/* -------------------------------------------------------------------------- */
/* B1 — file de validation                                                     */
/* -------------------------------------------------------------------------- */

/** Une entrée de la file, enrichie de ce qu'il faut pour décider sans requête supplémentaire. */
export interface ContributionAValider {
  fiche: EntreeSDCR;
  equipement: { id_equipement: number; nom: string; chaine: string; famille: string };
  contributeur: { id_utilisateur: number; nom: string; prenom: string; matricule: string };
  /** Jours écoulés depuis la soumission — matérialise l'ancienneté dans la file. */
  age_jours: number;
  /** Nombre de niveaux saisis hors nomenclature (0 à 4). Alimente l'indicateur B5. */
  niveaux_libres: number;
}

/**
 * Fiche déjà validée présentant le même triplet défaut / cause / remède.
 * C'est le cas du doublon : même panne, symptôme décrit autrement. Fusionner
 * incrémente la fréquence existante au lieu de diluer la base.
 */
export interface DoublonPotentiel {
  fiche: EntreeSDCR;
  /** `true` si le symptôme diffère — seul cas où la fusion apporte quelque chose. */
  symptome_different: boolean;
}

export interface DetailContribution extends ContributionAValider {
  doublons: DoublonPotentiel[];
  /** Termes actifs de l'équipement, pour rattacher les saisies libres. */
  termes: TermeNomenclature[];
}

/**
 * Rattachement d'un niveau saisi librement à un terme de la nomenclature.
 * `id_terme` nul avec un libellé signifie « corriger le libellé sans rattacher ».
 */
export interface CorrectionNiveau {
  id_terme: number | null;
  libelle: string;
}

/** Corrections appliquées au moment de valider (UC2 — « corriger le libellé »). */
export interface CorrectionsFiche {
  symptome?: CorrectionNiveau;
  defaut?: CorrectionNiveau;
  cause?: CorrectionNiveau;
  remede?: CorrectionNiveau;
}

/* -------------------------------------------------------------------------- */
/* B2 — nomenclature                                                           */
/* -------------------------------------------------------------------------- */

/** Terme enrichi du nombre de fiches qui le référencent — on ne fusionne pas à l'aveugle. */
export interface TermeGere extends TermeNomenclature {
  nb_fiches: number;
  /** Libellé du terme qui le remplace, si archivé par fusion. */
  libelle_remplacant: string | null;
}
