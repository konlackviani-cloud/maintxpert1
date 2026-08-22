/**
 * FP5 — détection de récurrence et SUGGESTION de défaillogramme.
 *
 * Règle cardinale : ce module ne fait que SIGNALER. L'ouverture effective d'un
 * défaillogramme est toujours une décision manuelle du responsable (principe
 * d'initiative a posteriori). Aucune fonction de ce fichier ne doit créer,
 * pré-remplir ou pré-instancier un défaillogramme.
 */

import { SEUIL_RECURRENCE_DEFAUT } from '../constantes.js';
import type { EntreeSDCR } from '../types/entites.js';

export interface SuggestionDefaillogramme {
  id_sdcr: number;
  id_equipement: number;
  symptome: string;
  cause: string;
  frequence_observee: number;
  seuil_applique: number;
}

/**
 * L'entrée franchit-elle le seuil de récurrence ?
 * Seule une entrée `validee` peut être signalée : une contribution non validée
 * ne constitue pas un retour d'expérience fiable.
 */
export function estRecurrente(
  entree: EntreeSDCR,
  seuil: number = SEUIL_RECURRENCE_DEFAUT,
): boolean {
  return entree.statut === 'validee' && entree.frequence_observee >= seuil;
}

/** Construit la suggestion à afficher au tableau de bord responsable. */
export function construireSuggestion(
  entree: EntreeSDCR,
  seuil: number = SEUIL_RECURRENCE_DEFAUT,
): SuggestionDefaillogramme | null {
  if (!estRecurrente(entree, seuil)) return null;

  return {
    id_sdcr: entree.id_sdcr,
    id_equipement: entree.id_equipement,
    symptome: entree.symptome,
    cause: entree.cause,
    frequence_observee: entree.frequence_observee,
    seuil_applique: seuil,
  };
}

/**
 * Suggestions à afficher au tableau de bord, les plus récurrentes en tête.
 * Retourne un tableau vide si aucune récurrence — le tableau de bord affiche
 * alors un état vide, jamais une erreur (UC4).
 */
export function collecterSuggestions(
  entrees: readonly EntreeSDCR[],
  seuil: number = SEUIL_RECURRENCE_DEFAUT,
): SuggestionDefaillogramme[] {
  return entrees
    .filter((e) => estRecurrente(e, seuil))
    .sort((a, b) => b.frequence_observee - a.frequence_observee)
    .map((e) => construireSuggestion(e, seuil))
    .filter((s): s is SuggestionDefaillogramme => s !== null);
}

/** Lecture du seuil depuis la table `configuration`, avec repli sur le défaut. */
export function lireSeuilRecurrence(valeurConfiguree: string | null | undefined): number {
  if (valeurConfiguree == null) return SEUIL_RECURRENCE_DEFAUT;
  const seuil = Number.parseInt(valeurConfiguree, 10);
  return Number.isInteger(seuil) && seuil > 0 ? seuil : SEUIL_RECURRENCE_DEFAUT;
}
