/**
 * Normalisation et validation du matricule — identifiant de connexion (A1).
 *
 * Partagé par les trois points d'entrée : l'écran de connexion, l'API, et le
 * script de création de comptes. Si ces trois-là ne normalisent pas de la même
 * façon, un compte créé « tc-2841 » devient inaccessible à qui saisit « TC-2841 ».
 */

/**
 * Forme canonique : majuscules, sans espaces.
 * Les espaces internes sont supprimés, pas seulement rognés : sur un clavier
 * mobile avec des gants, un espace parasite au milieu est fréquent.
 */
export function normaliserMatricule(matricule: string): string {
  return matricule.replace(/\s+/g, '').toUpperCase();
}

/** Longueur maximale — contrainte du dictionnaire de données : VARCHAR(20). */
export const MATRICULE_LONGUEUR_MAX = 20;
export const MATRICULE_LONGUEUR_MIN = 3;

/**
 * Jeu de caractères admis : lettres, chiffres, tiret et tiret bas.
 * Volontairement permissif — le format réel des matricules SABC n'est pas
 * arrêté (voir docs/03-decisions.md, point ouvert O9). Ne pas durcir ce motif
 * sans avoir vu de vrais matricules.
 */
const MOTIF_MATRICULE = /^[A-Z0-9_-]+$/;

export interface ResultatValidation {
  valide: boolean;
  /** Message destiné à l'utilisateur, en français. `null` si valide. */
  motif: string | null;
}

export function validerMatricule(matriculeBrut: string): ResultatValidation {
  const matricule = normaliserMatricule(matriculeBrut);

  if (matricule.length === 0) {
    return { valide: false, motif: 'Le matricule est obligatoire.' };
  }
  if (matricule.length < MATRICULE_LONGUEUR_MIN) {
    return {
      valide: false,
      motif: `Le matricule doit compter au moins ${MATRICULE_LONGUEUR_MIN} caractères.`,
    };
  }
  if (matricule.length > MATRICULE_LONGUEUR_MAX) {
    return {
      valide: false,
      motif: `Le matricule ne peut pas dépasser ${MATRICULE_LONGUEUR_MAX} caractères.`,
    };
  }
  if (!MOTIF_MATRICULE.test(matricule)) {
    return {
      valide: false,
      motif: 'Le matricule ne peut contenir que des lettres, des chiffres, « - » et « _ ».',
    };
  }

  return { valide: true, motif: null };
}

/* -------------------------------------------------------------------------- */
/* Mot de passe                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Longueur minimale. Volontairement modeste : imposer une politique complexe à
 * des techniciens qui saisissent avec des gants, de nuit, produit des mots de
 * passe écrits sur l'armoire électrique. La protection réelle vient du hachage
 * argon2id et de l'expiration de session.
 */
export const MOT_DE_PASSE_LONGUEUR_MIN = 8;
export const MOT_DE_PASSE_LONGUEUR_MAX = 128;

export function validerMotDePasse(motDePasse: string): ResultatValidation {
  if (motDePasse.length < MOT_DE_PASSE_LONGUEUR_MIN) {
    return {
      valide: false,
      motif: `Le mot de passe doit compter au moins ${MOT_DE_PASSE_LONGUEUR_MIN} caractères.`,
    };
  }
  if (motDePasse.length > MOT_DE_PASSE_LONGUEUR_MAX) {
    return {
      valide: false,
      motif: `Le mot de passe ne peut pas dépasser ${MOT_DE_PASSE_LONGUEUR_MAX} caractères.`,
    };
  }
  return { valide: true, motif: null };
}
