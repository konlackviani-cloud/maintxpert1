/**
 * Machine à états de EntreeSDCR — circuit contributeur -> valideur.
 *
 *   en_attente    -> validee | rejetee | en_correction
 *   en_correction -> validee | rejetee
 *   validee       -> archivee
 *   rejetee       -> archivee
 *   archivee      -> (terminal)
 *
 * Une entrée `validee` devient IMMÉDIATEMENT consultable par tous les techniciens (FP1).
 * Une entrée `archivee` reste liée aux interventions déjà réalisées : jamais de DELETE.
 */

import type { RoleUtilisateur, StatutSDCR } from '../types/enums.js';

/** Transitions autorisées, par état de départ. */
const TRANSITIONS: Readonly<Record<StatutSDCR, readonly StatutSDCR[]>> = {
  en_attente: ['validee', 'rejetee', 'en_correction'],
  en_correction: ['validee', 'rejetee'],
  validee: ['archivee'],
  rejetee: ['archivee'],
  archivee: [],
};

/** Seul le responsable maintenance opère les transitions (B1). */
const ROLE_HABILITE: RoleUtilisateur = 'responsable';

export function transitionsPossibles(depuis: StatutSDCR): readonly StatutSDCR[] {
  return TRANSITIONS[depuis];
}

export function transitionAutorisee(depuis: StatutSDCR, vers: StatutSDCR): boolean {
  return TRANSITIONS[depuis].includes(vers);
}

/** Un statut terminal n'accepte plus aucune transition. */
export function estStatutTerminal(statut: StatutSDCR): boolean {
  return TRANSITIONS[statut].length === 0;
}

/** Une entrée est-elle exploitable par la recherche FP1 ? */
export function estConsultable(statut: StatutSDCR): boolean {
  return statut === 'validee';
}

export interface ResultatTransition {
  autorisee: boolean;
  /** Message destiné à l'utilisateur, en français. `null` si autorisée. */
  motif: string | null;
}

/**
 * Vérification complète d'une transition : rôle + machine à états.
 * Appelée par l'API (autorité) et par le front pour n'afficher que les actions
 * réellement possibles.
 */
export function verifierTransition(
  depuis: StatutSDCR,
  vers: StatutSDCR,
  role: RoleUtilisateur,
): ResultatTransition {
  if (role !== ROLE_HABILITE) {
    return {
      autorisee: false,
      motif: 'Seul un responsable maintenance peut modifier le statut d’une fiche SDCR.',
    };
  }

  if (depuis === vers) {
    return { autorisee: false, motif: `La fiche est déjà au statut « ${depuis} ».` };
  }

  if (estStatutTerminal(depuis)) {
    return {
      autorisee: false,
      motif: `Une fiche archivée ne peut plus changer de statut. Son historique d’interventions est conservé.`,
    };
  }

  if (!transitionAutorisee(depuis, vers)) {
    const possibles = transitionsPossibles(depuis).join(', ');
    return {
      autorisee: false,
      motif: `Transition « ${depuis} » → « ${vers} » interdite. Transitions possibles : ${possibles}.`,
    };
  }

  return { autorisee: true, motif: null };
}
