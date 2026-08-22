/**
 * B4 — Indice de Priorité de Risque (AMDEC).
 * IPR = gravité x fréquence x détection, cotations de 1 à 4, critique si >= 12.
 */

import { COTATION_AMDEC_MAX, COTATION_AMDEC_MIN, SEUIL_IPR_CRITIQUE } from '../constantes.js';

export interface ResultatIPR {
  ipr: number;
  critique: boolean;
}

/** Une cotation AMDEC est-elle dans les bornes (entier de 1 à 4) ? */
export function estCotationValide(valeur: number): boolean {
  return (
    Number.isInteger(valeur) && valeur >= COTATION_AMDEC_MIN && valeur <= COTATION_AMDEC_MAX
  );
}

/**
 * @throws {RangeError} si l'une des cotations sort des bornes 1–4.
 *   L'IPR ne doit jamais être calculé sur des cotations invalides : un IPR faux
 *   fausse tout le classement de criticité du tableau de bord.
 */
export function calculerIPR(gravite: number, frequence: number, detection: number): ResultatIPR {
  for (const [nom, valeur] of [
    ['gravité', gravite],
    ['fréquence', frequence],
    ['détection', detection],
  ] as const) {
    if (!estCotationValide(valeur)) {
      throw new RangeError(
        `Cotation AMDEC invalide : ${nom} = ${valeur}. ` +
          `Attendu un entier entre ${COTATION_AMDEC_MIN} et ${COTATION_AMDEC_MAX}.`,
      );
    }
  }

  const ipr = gravite * frequence * detection;
  return { ipr, critique: ipr >= SEUIL_IPR_CRITIQUE };
}

/** Un IPR déjà calculé (colonne générée en base) est-il critique ? */
export function estIPRCritique(ipr: number, seuil: number = SEUIL_IPR_CRITIQUE): boolean {
  return ipr >= seuil;
}
