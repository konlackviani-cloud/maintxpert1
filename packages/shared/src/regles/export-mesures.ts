/**
 * Export des mesures d'intervention — protocole d'évaluation du mémoire.
 *
 * Produit le fichier CSV à partir duquel se calculent le TTDi et la durée
 * totale d'intervention. Généré côté navigateur, depuis le cache : l'extraction
 * doit rester possible même sans réseau, et surtout elle ne doit dépendre
 * d'aucun traitement serveur qu'il faudrait ensuite décrire dans le mémoire.
 *
 * Format : point-virgule et virgule décimale, pour qu'Excel francophone ouvre
 * le fichier sans étape d'import. Un export qu'on doit reformater à la main
 * n'est pas exploitable.
 */

import type { Equipement, Intervention } from '../types/entites.js';

/** Colonnes du fichier, dans l'ordre. */
export const COLONNES_EXPORT = [
  'id_intervention',
  'chaine',
  'equipement',
  'id_technicien',
  'T1_ouverture',
  'T1_5_cause_confirmee',
  'T2_cloture',
  'ttdi_secondes',
  'ttdi_minutes',
  'duree_totale_secondes',
  'duree_totale_minutes',
  'complete',
] as const;

export interface MesureIntervention {
  id_intervention: number;
  chaine: string;
  equipement: string;
  id_technicien: number;
  t1: string;
  t1_5: string | null;
  t2: string | null;
  ttdi_secondes: number | null;
  duree_totale_secondes: number | null;
  /** `true` si les trois jalons sont posés — seules ces lignes entrent dans les statistiques. */
  complete: boolean;
}

const secondesEntre = (debut: string, fin: string): number =>
  Math.round((new Date(fin).getTime() - new Date(debut).getTime()) / 1000);

export function calculerMesures(
  interventions: readonly Intervention[],
  equipements: readonly Equipement[],
): MesureIntervention[] {
  const parId = new Map(equipements.map((e) => [e.id_equipement, e]));

  return interventions
    .map((i) => {
      const equipement = parId.get(i.id_equipement);
      return {
        id_intervention: i.id_intervention,
        chaine: equipement?.chaine ?? '',
        equipement: equipement?.nom ?? '',
        id_technicien: i.id_technicien,
        t1: i.datetime_ouverture,
        t1_5: i.datetime_cause_confirmee,
        t2: i.datetime_cloture,
        ttdi_secondes:
          i.datetime_cause_confirmee === null
            ? null
            : secondesEntre(i.datetime_ouverture, i.datetime_cause_confirmee),
        duree_totale_secondes:
          i.datetime_cloture === null ? null : secondesEntre(i.datetime_ouverture, i.datetime_cloture),
        complete: i.datetime_cause_confirmee !== null && i.datetime_cloture !== null,
      };
    })
    .sort((a, b) => (a.t1 < b.t1 ? -1 : 1));
}

/** Échappe un champ CSV : guillemets doublés, encadrement si nécessaire. */
function echapper(valeur: string): string {
  if (!/[";\r\n]/.test(valeur)) return valeur;
  return `"${valeur.replace(/"/g, '""')}"`;
}

/** Minutes à une décimale, virgule décimale — lisible directement dans Excel francophone. */
function minutes(secondes: number | null): string {
  return secondes === null ? '' : (secondes / 60).toFixed(1).replace('.', ',');
}

/**
 * Assemble le CSV.
 *
 * Le BOM UTF-8 est ajouté : sans lui, Excel lit le fichier en ANSI et les
 * accents des noms d'équipement deviennent illisibles.
 */
export function exporterMesuresCsv(
  interventions: readonly Intervention[],
  equipements: readonly Equipement[],
): string {
  const lignes = [COLONNES_EXPORT.join(';')];

  for (const m of calculerMesures(interventions, equipements)) {
    lignes.push(
      [
        String(m.id_intervention),
        echapper(m.chaine),
        echapper(m.equipement),
        String(m.id_technicien),
        m.t1,
        m.t1_5 ?? '',
        m.t2 ?? '',
        m.ttdi_secondes === null ? '' : String(m.ttdi_secondes),
        minutes(m.ttdi_secondes),
        m.duree_totale_secondes === null ? '' : String(m.duree_totale_secondes),
        minutes(m.duree_totale_secondes),
        m.complete ? 'oui' : 'non',
      ].join(';'),
    );
  }

  return `﻿${lignes.join('\r\n')}\r\n`;
}

/** Nom de fichier horodaté — deux exports ne s'écrasent pas. */
export function nomFichierExport(instant = new Date()): string {
  const p = (n: number): string => String(n).padStart(2, '0');
  return `maintxpert-mesures-${instant.getFullYear()}${p(instant.getMonth() + 1)}${p(instant.getDate())}-${p(instant.getHours())}${p(instant.getMinutes())}.csv`;
}
