/** Lecture des référentiels : équipements, nomenclature, configuration. */

import type {
  EntreeConfiguration,
  EntreeSDCR,
  Equipement,
  Intervention,
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
 * Fiches consultables par les techniciens : validées uniquement (FP1), plus
 * les contributions de l'utilisateur lui-même quel que soit leur statut —
 * sans quoi il ne verrait pas ce qu'il vient de saisir (A12).
 */
export function listerEntreesSDCR(idUtilisateur: number, depuis?: string): Promise<EntreeSDCR[]> {
  const filtreDate = depuis ? 'and date_modification > $2' : '';
  const parametres: unknown[] = depuis ? [idUtilisateur, depuis] : [idUtilisateur];

  return requete<EntreeSDCR>(
    `select ${COLONNES_SDCR}
       from entree_sdcr
      where (statut = 'validee' or id_contributeur = $1)
        ${filtreDate}
      order by date_modification`,
    parametres,
  );
}

/** Interventions du technicien — pour retrouver un chantier en cours après rechargement. */
export function listerInterventions(idTechnicien: number, depuis?: string): Promise<Intervention[]> {
  const filtreDate = depuis ? 'and datetime_ouverture > $2' : '';
  const parametres: unknown[] = depuis ? [idTechnicien, depuis] : [idTechnicien];

  return requete<Intervention>(
    `select id_intervention, id_technicien, id_equipement, id_sdcr,
            datetime_ouverture, datetime_cause_confirmee, datetime_cloture
       from intervention
      where id_technicien = $1
        ${filtreDate}
      order by datetime_ouverture desc
      limit 200`,
    parametres,
  );
}
