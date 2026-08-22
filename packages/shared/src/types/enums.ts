/** Énumérations du domaine — miroir exact des types PostgreSQL (migration 0001). */

export const ROLES = ['technicien', 'responsable'] as const;
export type RoleUtilisateur = (typeof ROLES)[number];

export const STATUTS_SDCR = [
  'en_attente',
  'validee',
  'rejetee',
  'en_correction',
  'archivee',
] as const;
export type StatutSDCR = (typeof STATUTS_SDCR)[number];

/** Les quatre niveaux du modèle SDCR. */
export const TYPES_TERME = ['symptome', 'defaut', 'cause', 'remede'] as const;
export type TypeTerme = (typeof TYPES_TERME)[number];

export const STATUTS_TERME = ['actif', 'archive'] as const;
export type StatutTerme = (typeof STATUTS_TERME)[number];
