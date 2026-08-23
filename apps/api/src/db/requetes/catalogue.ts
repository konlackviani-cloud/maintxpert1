/** Lecture des référentiels : équipements, nomenclature, configuration. */

import type {
  EntreeConfiguration,
  EntreeSDCR,
  Equipement,
  Intervention,
  ModeAMDEC,
  RoleUtilisateur,
  TermeNomenclature,
} from '@maintxpert/shared';
import { requete } from '../client.js';

const COLONNES_SDCR = `
  id_sdcr, id_equipement,
  id_terme_symptome, symptome, id_terme_defaut, defaut,
  id_terme_cause, cause, id_terme_remede, remede,
  frequence_observee, via_nomenclature, statut, photo_url,
  id_contributeur, id_valideur, date_creation, date_modification`;

export const listerEquipements = (): Promise<Equipement[]> =>
  requete<Equipement>(
    'select id_equipement, nom, famille, chaine from equipement order by chaine, famille, nom',
  );

/** Termes actifs uniquement : un terme archivé ne doit plus être proposé (A3, A10). */
export const listerTermesActifs = (): Promise<TermeNomenclature[]> =>
  requete<TermeNomenclature>(
    `select id_terme, libelle, type, id_equipement, statut, compteur_usage, categorie_afnor
       from terme_nomenclature
      where statut = 'actif'
      order by id_equipement, type, compteur_usage desc, libelle`,
  );

export const listerConfiguration = (): Promise<EntreeConfiguration[]> =>
  requete<EntreeConfiguration>('select cle, valeur, description from configuration');

/**
 * Fiches descendues dans le cache.
 *
 * Technicien : validées uniquement (FP1), plus ses propres contributions quel
 * que soit leur statut — sans quoi il ne verrait pas ce qu'il vient de saisir (A12).
 *
 * Responsable : tout. Son tableau de bord doit compter les fiches en attente et
 * calculer le taux de recours à la nomenclature libre (B5) ; le restreindre aux
 * fiches validées fausserait les deux.
 */
export function listerEntreesSDCR(
  idUtilisateur: number,
  role: RoleUtilisateur,
  depuis?: string,
): Promise<EntreeSDCR[]> {
  const parametres: unknown[] = [];
  const conditions: string[] = [];

  if (role !== 'responsable') {
    parametres.push(idUtilisateur);
    conditions.push(`(statut = 'validee' or id_contributeur = $${parametres.length})`);
  }
  if (depuis) {
    parametres.push(depuis);
    conditions.push(`date_modification > $${parametres.length}`);
  }

  const filtre = conditions.length > 0 ? `where ${conditions.join(' and ')}` : '';

  return requete<EntreeSDCR>(
    `select ${COLONNES_SDCR} from entree_sdcr ${filtre} order by date_modification`,
    parametres,
  );
}

/**
 * Interventions descendues dans le cache.
 *
 * Technicien : les siennes, pour retrouver un chantier en cours après un
 * rechargement. Responsable : toutes — le TTDi médian (B5) porte sur l'ensemble
 * du service, pas sur ses propres interventions, qu'il n'a pas.
 */
export function listerInterventions(
  idUtilisateur: number,
  role: RoleUtilisateur,
  depuis?: string,
): Promise<Intervention[]> {
  const parametres: unknown[] = [];
  const conditions: string[] = [];

  if (role !== 'responsable') {
    parametres.push(idUtilisateur);
    conditions.push(`id_technicien = $${parametres.length}`);
  }
  if (depuis) {
    parametres.push(depuis);
    conditions.push(`datetime_ouverture > $${parametres.length}`);
  }

  const filtre = conditions.length > 0 ? `where ${conditions.join(' and ')}` : '';

  return requete<Intervention>(
    `select id_intervention, id_technicien, id_equipement, id_sdcr,
            datetime_ouverture, datetime_cause_confirmee, datetime_cloture
       from intervention
       ${filtre}
      order by datetime_ouverture desc
      limit 2000`,
    parametres,
  );
}

/** Modes AMDEC — descendus en entier pour que le tableau de bord (B4) tienne hors ligne. */
export const listerModesAmdec = (): Promise<ModeAMDEC[]> =>
  requete<ModeAMDEC>(
    `select id_mode, id_equipement, composant, mode_defaillance, cause, effet,
            gravite, frequence, detection, ipr
       from mode_amdec
      order by ipr desc`,
  );

