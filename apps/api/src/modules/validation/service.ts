/**
 * B1 / UC2 — validation des contributions.
 *
 * La légalité de chaque transition vient de `verifierTransition()`
 * (@maintxpert/shared) : cette couche n'invente aucune règle d'état, elle
 * applique celle qui est écrite une seule fois dans le paquet partagé.
 */

import {
  normaliserLibelle,
  verifierTransition,
  type ContributionAValider,
  type CorrectionsFiche,
  type DetailContribution,
  type StatutSDCR,
} from '@maintxpert/shared';

import { listerTermesActifs } from '../../db/requetes/catalogue.js';
import {
  appliquerCorrections,
  changerStatut,
  chercherDoublons,
  fusionnerFiches,
  lireContribution,
  lireStatut,
  listerFile,
} from '../../db/requetes/validation.js';
import { erreurConflit, erreurIntrouvable, erreurRequete } from '../../middlewares/erreurs.js';

export const file = (): Promise<ContributionAValider[]> => listerFile();

export async function detail(idSdcr: number): Promise<DetailContribution> {
  const contribution = await lireContribution(idSdcr);
  if (!contribution) throw erreurIntrouvable('Cette contribution n’existe pas.');

  const [candidats, termes] = await Promise.all([
    chercherDoublons(
      idSdcr,
      contribution.fiche.id_equipement,
      contribution.fiche.defaut,
      contribution.fiche.cause,
    ),
    listerTermesActifs(),
  ]);

  return {
    ...contribution,
    doublons: candidats.map((fiche) => ({
      fiche,
      symptome_different:
        normaliserLibelle(fiche.symptome) !== normaliserLibelle(contribution.fiche.symptome),
    })),
    termes: termes.filter((t) => t.id_equipement === contribution.fiche.id_equipement),
  };
}

/**
 * Vérifie la transition et l'applique.
 * @throws si la fiche n'existe pas, si la transition est interdite, ou si un
 *   autre responsable a traité la fiche entre-temps.
 */
async function transitionner(
  idSdcr: number,
  vers: StatutSDCR,
  idValideur: number,
): Promise<StatutSDCR> {
  const depuis = await lireStatut(idSdcr);
  if (depuis === null) throw erreurIntrouvable('Cette contribution n’existe pas.');

  const verdict = verifierTransition(depuis, vers, 'responsable');
  if (!verdict.autorisee) throw erreurRequete(verdict.motif ?? 'Transition interdite.');

  const applique = await changerStatut(idSdcr, vers, depuis, idValideur);
  if (!applique) {
    throw erreurConflit(
      'Cette contribution vient d’être traitée par quelqu’un d’autre. Rechargez la file.',
    );
  }

  return depuis;
}

/**
 * Valider — avec corrections facultatives (UC2, « corriger le libellé »).
 * Les corrections sont écrites AVANT le changement de statut : si le statut
 * bascule d'abord et que la correction échoue, une fiche mal libellée devient
 * immédiatement consultable par tous les techniciens.
 */
export async function valider(
  idSdcr: number,
  idValideur: number,
  corrections?: CorrectionsFiche,
): Promise<void> {
  const depuis = await lireStatut(idSdcr);
  if (depuis === null) throw erreurIntrouvable('Cette contribution n’existe pas.');

  const verdict = verifierTransition(depuis, 'validee', 'responsable');
  if (!verdict.autorisee) throw erreurRequete(verdict.motif ?? 'Transition interdite.');

  if (corrections && Object.keys(corrections).length > 0) {
    await appliquerCorrections(idSdcr, corrections);
  }

  const applique = await changerStatut(idSdcr, 'validee', depuis, idValideur);
  if (!applique) {
    throw erreurConflit(
      'Cette contribution vient d’être traitée par quelqu’un d’autre. Rechargez la file.',
    );
  }
}

export const rejeter = (idSdcr: number, idValideur: number): Promise<StatutSDCR> =>
  transitionner(idSdcr, 'rejetee', idValideur);

export const renvoyerEnCorrection = (idSdcr: number, idValideur: number): Promise<StatutSDCR> =>
  transitionner(idSdcr, 'en_correction', idValideur);

export const archiver = (idSdcr: number, idValideur: number): Promise<StatutSDCR> =>
  transitionner(idSdcr, 'archivee', idValideur);

/**
 * Fusionner une contribution dans une fiche déjà validée : la fréquence est
 * reportée, la source archivée. Le doublon n'est pas perdu, il est absorbé.
 */
export async function fusionner(
  idSource: number,
  idCible: number,
  idValideur: number,
): Promise<void> {
  if (idSource === idCible) throw erreurRequete('Une fiche ne peut pas être fusionnée avec elle-même.');

  const statutSource = await lireStatut(idSource);
  if (statutSource === null) throw erreurIntrouvable('Cette contribution n’existe pas.');
  if (statutSource === 'archivee') throw erreurRequete('Cette fiche est déjà archivée.');

  const applique = await fusionnerFiches(idSource, idCible, idValideur);
  if (!applique) {
    throw erreurRequete('La fiche cible n’est pas validée : la fusion n’a pas été effectuée.');
  }
}
