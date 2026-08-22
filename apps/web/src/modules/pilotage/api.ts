/**
 * Accès API du responsable maintenance (B1, B2).
 *
 * EXCEPTION ASSUMÉE à la règle « hors ligne d'abord » : ces écrans appellent le
 * réseau directement, sans passer par le cache.
 *
 * Raison : valider une contribution est un acte d'écriture qui engage toute la
 * base consultée par les techniciens. Le faire sur des données périmées ferait
 * courir le risque de valider deux fois le même doublon, ou de trancher sur une
 * fiche qu'un autre responsable vient de traiter. C'est du travail de bureau,
 * sur poste connecté — pas du terrain.
 *
 * La règle hors ligne reste entière pour la consultation du technicien, et
 * s'appliquera au tableau de bord (B5, phase 7), qui est bien de la
 * consultation. Voir docs/03-decisions.md (D17).
 */

import type {
  ContributionAValider,
  CorrectionsFiche,
  DetailContribution,
  EquipementImporte,
  FicheCSD,
  ModeAMDEC,
  TermeGere,
  TermeNomenclature,
  TypeTerme,
} from '@maintxpert/shared';

import { ErreurApi, ErreurReseau, appelerApi } from '../../lib/client-api.js';

/**
 * Message d'erreur adapté au responsable.
 *
 * `ErreurReseau` porte par défaut « Vos saisies seront envoyées plus tard » :
 * vrai pour le technicien, dont les gestes sont mis en file, mais faux ici —
 * ces écrans n'ont pas de file d'attente, et laisser croire au responsable que
 * sa validation partira plus tard lui ferait quitter l'écran en pensant avoir
 * publié une fiche.
 */
export function messageErreurPilotage(erreur: unknown): string {
  if (erreur instanceof ErreurReseau) {
    return 'Serveur injoignable. Aucune modification n’a été enregistrée — reconnectez-vous au réseau et réessayez.';
  }
  if (erreur instanceof ErreurApi) return erreur.message;
  return 'Action impossible.';
}

/* -------------------------------------------------------------------------- */
/* B1 — validation                                                             */
/* -------------------------------------------------------------------------- */

export const chargerFile = (): Promise<{ contributions: ContributionAValider[] }> =>
  appelerApi('/validation');

export const chargerDetail = (idSdcr: number): Promise<DetailContribution> =>
  appelerApi(`/validation/${idSdcr}`);

export const validerContribution = (idSdcr: number, corrections?: CorrectionsFiche): Promise<void> =>
  appelerApi(`/validation/${idSdcr}/valider`, { methode: 'POST', corps: { corrections } });

export const rejeterContribution = (idSdcr: number, motif: string): Promise<void> =>
  appelerApi(`/validation/${idSdcr}/rejeter`, { methode: 'POST', corps: { motif } });

export const renvoyerEnCorrection = (idSdcr: number, motif: string): Promise<void> =>
  appelerApi(`/validation/${idSdcr}/renvoyer-en-correction`, { methode: 'POST', corps: { motif } });

export const fusionnerAvec = (idSdcr: number, idCible: number): Promise<void> =>
  appelerApi(`/validation/${idSdcr}/fusionner`, {
    methode: 'POST',
    corps: { id_sdcr_cible: idCible },
  });

/* -------------------------------------------------------------------------- */
/* B2 — nomenclature                                                           */
/* -------------------------------------------------------------------------- */

export const chargerTermes = (idEquipement: number): Promise<{ termes: TermeGere[] }> =>
  appelerApi(`/nomenclature?id_equipement=${idEquipement}`);

export const creerTerme = (
  libelle: string,
  type: TypeTerme,
  idEquipement: number,
): Promise<TermeNomenclature> =>
  appelerApi('/nomenclature', {
    methode: 'POST',
    corps: { libelle, type, id_equipement: idEquipement },
  });

export const renommerTerme = (idTerme: number, libelle: string): Promise<void> =>
  appelerApi(`/nomenclature/${idTerme}`, { methode: 'PATCH', corps: { libelle } });

export const archiverTerme = (idTerme: number): Promise<void> =>
  appelerApi(`/nomenclature/${idTerme}/archiver`, { methode: 'POST' });

export const fusionnerTermes = (idSource: number, idCible: number): Promise<void> =>
  appelerApi(`/nomenclature/${idSource}/fusionner`, {
    methode: 'POST',
    corps: { id_terme_cible: idCible },
  });

/* -------------------------------------------------------------------------- */
/* B6 — fiches CSD                                                             */
/* -------------------------------------------------------------------------- */

export const chargerFicheCSD = (idEquipement: number): Promise<FicheCSD> =>
  appelerApi(`/csd/${idEquipement}`);

export const enregistrerFicheCSD = (idEquipement: number, description: string): Promise<FicheCSD> =>
  appelerApi(`/csd/${idEquipement}`, { methode: 'PUT', corps: { description } });

/**
 * Envoi direct, sans passer par la file de photos : le responsable est sur un
 * poste connecté et attend une confirmation immédiate.
 */
export const envoyerPhotoCSD = (
  idEquipement: number,
  donnees: Blob,
  typeMime: string,
): Promise<{ photo_url: string }> =>
  appelerApi(`/photos/csd/${idEquipement}`, {
    methode: 'POST',
    corpsBinaire: { donnees, typeMime },
    delaiMs: 60_000,
  });

/* -------------------------------------------------------------------------- */
/* B4 — AMDEC                                                                  */
/* -------------------------------------------------------------------------- */

export interface ModeAmdecDetaille extends ModeAMDEC {
  id_equipement: number;
  eq_nom: string;
  eq_chaine: string;
}

export interface ReponseAmdec {
  modes: ModeAmdecDetaille[];
  nb_total: number;
  nb_critiques: number;
  ipr_maximal: number;
}

export const chargerModesAmdec = (idEquipement: number): Promise<ReponseAmdec> =>
  appelerApi(`/amdec?id_equipement=${idEquipement}`);

export interface SaisieModeAmdec {
  id_equipement: number;
  composant: string;
  mode_defaillance: string;
  cause: string;
  effet: string;
  gravite: number;
  frequence: number;
  detection: number;
}

export const creerModeAmdec = (saisie: SaisieModeAmdec): Promise<ModeAMDEC> =>
  appelerApi('/amdec', { methode: 'POST', corps: saisie });

export const recoterModeAmdec = (
  idMode: number,
  cotations: { gravite: number; frequence: number; detection: number },
): Promise<ModeAMDEC> => appelerApi(`/amdec/${idMode}`, { methode: 'PATCH', corps: cotations });

export const supprimerModeAmdec = (idMode: number): Promise<void> =>
  appelerApi(`/amdec/${idMode}`, { methode: 'DELETE' });

/* -------------------------------------------------------------------------- */
/* B7 — import DimoMaint                                                       */
/* -------------------------------------------------------------------------- */

export const importerEquipements = (
  equipements: EquipementImporte[],
): Promise<{ crees: number; existants: number; total: number }> =>
  appelerApi('/import/equipements', { methode: 'POST', corps: { equipements }, delaiMs: 120_000 });


