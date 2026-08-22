/**
 * Constantes métier MaintXpert.
 * Source unique — ne jamais redéclarer ces valeurs dans apps/web ou apps/api.
 */

/* -------------------------------------------------------------------------- */
/* Récurrence — FP5                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Seuil par défaut de déclenchement de la SUGGESTION de défaillogramme.
 * Configurable en base (table `configuration`, clé `seuil_recurrence`).
 * L'ouverture effective du défaillogramme reste TOUJOURS une décision manuelle
 * du responsable (principe d'initiative a posteriori) — jamais automatisée.
 */
export const SEUIL_RECURRENCE_DEFAUT = 3;

/* -------------------------------------------------------------------------- */
/* AMDEC — B4                                                                  */
/* -------------------------------------------------------------------------- */

/** IPR à partir duquel un mode de défaillance est considéré critique. */
export const SEUIL_IPR_CRITIQUE = 12;

/** Bornes de cotation AMDEC (gravité, fréquence, détection). */
export const COTATION_AMDEC_MIN = 1;
export const COTATION_AMDEC_MAX = 4;

/* -------------------------------------------------------------------------- */
/* Photos — spécification stricte du cahier des charges                        */
/* -------------------------------------------------------------------------- */

export const PHOTO = {
  /** Côté maximal après redimensionnement, en pixels. */
  COTE_MAX_PX: 1600,
  /** Format cible. */
  FORMAT_CIBLE: 'image/webp',
  /** Format de repli si WebP indisponible sur le terminal. */
  FORMAT_REPLI: 'image/jpeg',
  /** Qualité de première passe. */
  QUALITE_INITIALE: 0.78,
  /** Qualité de recompression si le résultat dépasse TAILLE_CIBLE_OCTETS. */
  QUALITE_RECOMPRESSION: 0.7,
  /** Seuil déclenchant la recompression : 400 Ko. */
  TAILLE_CIBLE_OCTETS: 400 * 1024,
  /** Une seule photo par fiche SDCR ou CSD. */
  NB_MAX_PAR_FICHE: 1,
} as const;

/* -------------------------------------------------------------------------- */
/* Session — A1                                                                */
/* -------------------------------------------------------------------------- */

/** Durée de validité du jeton d'accès. Contrainte BYOD : session expirable. */
export const DUREE_JETON_ACCES_SECONDES = 60 * 60 * 8; // 8 h — couvre un quart complet

/** Durée de validité du jeton de rafraîchissement. */
export const DUREE_JETON_RAFRAICHISSEMENT_SECONDES = 60 * 60 * 24 * 7; // 7 j

/* -------------------------------------------------------------------------- */
/* UX terrain                                                                  */
/* -------------------------------------------------------------------------- */

/** Cible tactile minimale — usage avec gants. */
export const TAILLE_CIBLE_TACTILE_PX = 56;

/** Chaînes d'embouteillage de l'usine Terrain Court. */
export const CHAINES = ['CH02', 'CH05', 'CH06', 'CH09'] as const;
export type Chaine = (typeof CHAINES)[number];
