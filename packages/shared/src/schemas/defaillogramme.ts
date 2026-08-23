/**
 * B8 / UC3 — validation du défaillogramme.
 *
 * La topologie est FIXE : exactement deux branches contributives, une
 * convergence, une cause intermédiaire, une cause première. Le schéma la fige —
 * aucun champ n'est un tableau, aucune branche ne peut être ajoutée. L'éditeur
 * graphique à topologie libre est explicitement hors périmètre v1.0.
 */

import { z } from 'zod';

const bloc = z
  .string()
  .trim()
  .min(3, 'Renseignez ce bloc (3 caractères minimum).')
  .max(150, 'Libellé limité à 150 caractères.');

const analyse = z
  .string()
  .trim()
  .min(10, 'Décrivez l’analyse (10 caractères minimum).')
  .max(2000, 'Texte trop long.');

export const schemaDefaillogramme = z.object({
  /** Fiche SDCR de convergence — la récurrence analysée. */
  id_sdcr: z.number().int().positive(),

  branche1_objet: bloc,
  branche1_defaut: bloc,
  branche2_objet: bloc,
  branche2_defaut: bloc,

  cause_intermediaire: analyse,
  cause_premiere: analyse,
});

export type SaisieDefaillogramme = z.infer<typeof schemaDefaillogramme>;

/**
 * Les deux branches doivent être distinctes.
 *
 * Deux branches identiques ne convergent pas : elles décrivent la même
 * contribution écrite deux fois, et le défaillogramme perd tout son sens —
 * il ne montrerait plus la rencontre de deux causes indépendantes.
 */
export function branchesDistinctes(saisie: {
  branche1_objet: string;
  branche1_defaut: string;
  branche2_objet: string;
  branche2_defaut: string;
}): boolean {
  const normaliser = (v: string): string => v.trim().replace(/\s+/g, ' ').toLocaleLowerCase('fr-FR');
  return (
    `${normaliser(saisie.branche1_objet)}|${normaliser(saisie.branche1_defaut)}` !==
    `${normaliser(saisie.branche2_objet)}|${normaliser(saisie.branche2_defaut)}`
  );
}
