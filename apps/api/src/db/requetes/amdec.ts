/** B4 — analyse AMDEC. `ipr` est une colonne calculée : jamais écrite ici. */

import type { ModeAMDEC } from '@maintxpert/shared';
import { requete } from '../client.js';

const COLONNES = `id_mode, id_equipement, composant, mode_defaillance, cause, effet,
                  gravite, frequence, detection, ipr`;

export interface ModeAMDECAvecEquipement extends ModeAMDEC {
  id_equipement: number;
  eq_nom: string;
  eq_chaine: string;
}

/**
 * Modes d'un périmètre, les plus critiques en tête — c'est l'ordre dans lequel
 * le responsable doit les traiter.
 */
export function listerModes(
  idEquipement?: number,
  chaine?: string,
): Promise<ModeAMDECAvecEquipement[]> {
  const conditions: string[] = [];
  const parametres: unknown[] = [];

  if (idEquipement !== undefined) {
    parametres.push(idEquipement);
    conditions.push(`m.id_equipement = $${parametres.length}`);
  }
  if (chaine !== undefined) {
    parametres.push(chaine);
    conditions.push(`e.chaine = $${parametres.length}`);
  }

  const filtre = conditions.length > 0 ? `where ${conditions.join(' and ')}` : '';

  return requete<ModeAMDECAvecEquipement>(
    `select m.id_mode, m.id_equipement, m.composant, m.mode_defaillance, m.cause, m.effet,
            m.gravite, m.frequence, m.detection, m.ipr,
            e.nom as eq_nom, e.chaine as eq_chaine
       from mode_amdec m
       join equipement e on e.id_equipement = m.id_equipement
       ${filtre}
      order by m.ipr desc, m.composant`,
    parametres,
  );
}

export interface SaisieMode {
  id_equipement: number;
  composant: string;
  mode_defaillance: string;
  cause: string;
  effet: string;
  gravite: number;
  frequence: number;
  detection: number;
}

export async function creerMode(saisie: SaisieMode): Promise<ModeAMDEC> {
  const lignes = await requete<ModeAMDEC>(
    `insert into mode_amdec (id_equipement, composant, mode_defaillance, cause, effet,
                             gravite, frequence, detection)
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     returning ${COLONNES}`,
    [
      saisie.id_equipement,
      saisie.composant,
      saisie.mode_defaillance,
      saisie.cause,
      saisie.effet,
      saisie.gravite,
      saisie.frequence,
      saisie.detection,
    ],
  );
  return lignes[0]!;
}

/**
 * Recote un mode. Seules les trois cotations changent : le libellé d'un mode de
 * défaillance décrit un fait technique, il ne se révise pas au fil des
 * réévaluations de criticité.
 */
export async function recoterMode(
  idMode: number,
  gravite: number,
  frequence: number,
  detection: number,
): Promise<ModeAMDEC | null> {
  const lignes = await requete<ModeAMDEC>(
    `update mode_amdec
        set gravite = $1, frequence = $2, detection = $3
      where id_mode = $4
      returning ${COLONNES}`,
    [gravite, frequence, detection, idMode],
  );
  return lignes[0] ?? null;
}

/**
 * Suppression physique — admise ici.
 *
 * L'interdiction de supprimer protège le retour d'expérience : fiches SDCR et
 * termes de nomenclature, auxquels des interventions sont rattachées. Un mode
 * AMDEC est une hypothèse d'analyse, sans historique en dépendance. La retirer
 * quand elle se révèle fausse vaut mieux que de la laisser fausser le Pareto.
 */
export async function supprimerMode(idMode: number): Promise<boolean> {
  const lignes = await requete<{ id_mode: number }>(
    'delete from mode_amdec where id_mode = $1 returning id_mode',
    [idMode],
  );
  return lignes.length > 0;
}

export async function modeExiste(
  idEquipement: number,
  composant: string,
  modeDefaillance: string,
): Promise<boolean> {
  const lignes = await requete<{ id_mode: number }>(
    `select id_mode from mode_amdec
      where id_equipement = $1
        and normaliser_libelle(composant) = normaliser_libelle($2)
        and normaliser_libelle(mode_defaillance) = normaliser_libelle($3)`,
    [idEquipement, composant, modeDefaillance],
  );
  return lignes.length > 0;
}
