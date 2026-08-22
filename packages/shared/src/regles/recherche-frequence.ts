/**
 * FP1 — recherche dans la base SDCR et tri par fréquence.
 *
 * Appariement par ÉGALITÉ STRICTE (symptôme + équipement).
 * Aucune distance calculée, aucune similarité floue, aucun scoring : c'est un
 * choix explicite du mémoire, pas une simplification d'implémentation.
 *
 * Exécutée côté front sur le cache IndexedDB (consultation hors ligne) et côté
 * API sur PostgreSQL (autorité). Même code, deux points d'exécution.
 */

import type { EntreeSDCR } from '../types/entites.js';

/** Critère d'entrée de la recherche : A2 (équipement) + A3 (symptôme). */
export interface CritereRechercheFP1 {
  symptome: string;
  id_equipement: number;
}

/**
 * Normalisation appliquée avant comparaison.
 *
 * Elle absorbe uniquement les écarts de saisie sans valeur sémantique
 * (casse, espaces surnuméraires). Ce n'est PAS une similarité approchée :
 * deux libellés différents restent différents.
 */
export function normaliserLibelle(libelle: string): string {
  return libelle.trim().replace(/\s+/g, ' ').toLocaleLowerCase('fr-FR');
}

/** Une entrée correspond-elle au critère de recherche ? */
export function correspondAuCritere(entree: EntreeSDCR, critere: CritereRechercheFP1): boolean {
  return (
    entree.statut === 'validee' &&
    entree.id_equipement === critere.id_equipement &&
    normaliserLibelle(entree.symptome) === normaliserLibelle(critere.symptome)
  );
}

/**
 * Tri des résultats : fréquence observée décroissante.
 *
 * Départages successifs, pour que l'ordre reste stable et reproductible entre
 * le cache local et la base (deux moteurs de tri différents) :
 *   1. fréquence décroissante ;
 *   2. entrées issues de la nomenclature contrôlée avant les saisies libres ;
 *   3. plus récemment modifiée d'abord ;
 *   4. id croissant.
 */
export function comparerParFrequence(a: EntreeSDCR, b: EntreeSDCR): number {
  if (a.frequence_observee !== b.frequence_observee) {
    return b.frequence_observee - a.frequence_observee;
  }
  if (a.via_nomenclature !== b.via_nomenclature) {
    return a.via_nomenclature ? -1 : 1;
  }
  if (a.date_modification !== b.date_modification) {
    return a.date_modification < b.date_modification ? 1 : -1;
  }
  return a.id_sdcr - b.id_sdcr;
}

/**
 * FP1 complète : filtre puis trie.
 *
 * @param entrees Ensemble à parcourir — cache IndexedDB côté front,
 *                résultat de requête côté API.
 */
export function rechercher(
  entrees: readonly EntreeSDCR[],
  critere: CritereRechercheFP1,
): EntreeSDCR[] {
  return entrees.filter((e) => correspondAuCritere(e, critere)).sort(comparerParFrequence);
}
