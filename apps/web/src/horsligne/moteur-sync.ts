/**
 * Moteur de synchronisation.
 *
 * Ordre imposé : on POUSSE avant de TIRER. Sinon un instantané descendant
 * écraserait dans le cache les fiches que le technicien vient de modifier et
 * qui n'ont pas encore quitté le terminal.
 *
 * Aucune fonction d'ici n'est requise pour consulter : la synchronisation
 * enrichit le cache, elle ne conditionne jamais l'affichage.
 */

import {
  TAILLE_LOT_PUSH,
  type InstantaneSync,
  type ReponsePush,
} from '@maintxpert/shared';

import { ErreurReseau, appelerApi } from '../lib/client-api.js';
import {
  CLE_CURSEUR_PULL,
  CLE_DERNIERE_SYNCHRO,
  baseLocale,
  ecrireMeta,
  lireMeta,
} from './db.js';

/** Au-delà, une mutation est considérée comme définitivement en échec. */
const TENTATIVES_MAX = 5;

export interface BilanSync {
  poussees: number;
  refusees: number;
  recues: number;
  /** Messages des mutations refusées, à présenter au technicien. */
  refus: string[];
  erreur: string | null;
}

/* -------------------------------------------------------------------------- */
/* Montant                                                                     */
/* -------------------------------------------------------------------------- */

async function pousser(bilan: BilanSync): Promise<void> {
  // Ordre chronologique du terrain : une ouverture d'intervention doit partir
  // avant le jalon qui s'y rattache.
  const enAttente = await baseLocale.fileMutations.orderBy('horodatage_terrain').toArray();
  if (enAttente.length === 0) return;

  for (let debut = 0; debut < enAttente.length; debut += TAILLE_LOT_PUSH) {
    const lot = enAttente.slice(debut, debut + TAILLE_LOT_PUSH);

    const reponse = await appelerApi<ReponsePush>('/sync/push', {
      methode: 'POST',
      corps: {
        mutations: lot.map(({ id_local, type, charge, horodatage_terrain }) => ({
          id_local,
          type,
          charge,
          horodatage_terrain,
        })),
      },
    });

    for (const resultat of reponse.resultats) {
      if (resultat.statut === 'applique' || resultat.statut === 'deja_applique') {
        await reconcilier(resultat.id_local, resultat.resultat);
        await baseLocale.fileMutations.delete(resultat.id_local);
        bilan.poussees += 1;
        continue;
      }

      // Refus : erreur métier, pas un incident réseau. La rejouer donnerait le
      // même refus, on la retire de la file en le signalant.
      await baseLocale.fileMutations.delete(resultat.id_local);
      bilan.refusees += 1;
      if (resultat.motif) bilan.refus.push(resultat.motif);
    }
  }
}

/** Inscrit l'identifiant serveur sur l'intervention locale correspondante. */
async function reconcilier(
  idLocal: string,
  resultat: { id_sdcr?: number; id_intervention?: number } | undefined,
): Promise<void> {
  if (resultat?.id_intervention === undefined) return;

  const intervention = await baseLocale.interventionsLocales.get(idLocal);
  if (intervention && intervention.id_intervention === null) {
    await baseLocale.interventionsLocales.put({
      ...intervention,
      id_intervention: resultat.id_intervention,
    });
  }
}

/** Marque une tentative infructueuse sur toute la file. */
async function marquerEchec(motif: string): Promise<void> {
  const enAttente = await baseLocale.fileMutations.toArray();
  await Promise.all(
    enAttente.map((m) =>
      baseLocale.fileMutations.put({
        ...m,
        nb_tentatives: m.nb_tentatives + 1,
        derniere_erreur: motif,
      }),
    ),
  );
}

/** Mutations bloquées après trop de tentatives — à signaler au technicien. */
export async function listerMutationsBloquees(): Promise<number> {
  return baseLocale.fileMutations.filter((m) => m.nb_tentatives >= TENTATIVES_MAX).count();
}

/* -------------------------------------------------------------------------- */
/* Descendant                                                                  */
/* -------------------------------------------------------------------------- */

async function tirer(bilan: BilanSync): Promise<void> {
  const curseur = await lireMeta(CLE_CURSEUR_PULL);
  const requete = curseur ? `/sync/pull?depuis=${encodeURIComponent(curseur)}` : '/sync/pull';

  const instantane = await appelerApi<InstantaneSync>(requete);

  await baseLocale.transaction(
    'rw',
    [
      baseLocale.equipements,
      baseLocale.termes,
      baseLocale.entreesSdcr,
      baseLocale.configuration,
      baseLocale.interventions,
    ],
    async () => {
      // Référentiels : toujours complets, donc remplacés en bloc. Un terme
      // archivé côté serveur disparaît ainsi vraiment des listes déroulantes.
      if (!instantane.partiel) {
        await baseLocale.equipements.clear();
        await baseLocale.termes.clear();
      }
      await baseLocale.equipements.bulkPut(instantane.equipements);
      await baseLocale.termes.bulkPut(instantane.termes);
      await baseLocale.configuration.bulkPut(instantane.configuration);
      await baseLocale.entreesSdcr.bulkPut(instantane.entrees_sdcr);
      await baseLocale.interventions.bulkPut(instantane.interventions);
    },
  );

  bilan.recues =
    instantane.entrees_sdcr.length + instantane.equipements.length + instantane.termes.length;

  await ecrireMeta(CLE_CURSEUR_PULL, instantane.horodatage);
  await ecrireMeta(CLE_DERNIERE_SYNCHRO, new Date().toISOString());
}

/* -------------------------------------------------------------------------- */

let enCours = false;

/**
 * Cycle complet. Ne lève jamais : une synchronisation qui échoue est un
 * non-événement pour le technicien, qui continue de travailler sur son cache.
 * Le bilan retourné alimente l'indicateur de l'interface.
 */
export async function synchroniser(): Promise<BilanSync> {
  const bilan: BilanSync = { poussees: 0, refusees: 0, recues: 0, refus: [], erreur: null };

  // Un seul cycle à la fois : le déclencheur périodique et l'événement
  // « retour en ligne » peuvent survenir en même temps.
  if (enCours) {
    bilan.erreur = 'Synchronisation déjà en cours.';
    return bilan;
  }
  enCours = true;

  try {
    await pousser(bilan);
    await tirer(bilan);
  } catch (erreur) {
    bilan.erreur =
      erreur instanceof ErreurReseau
        ? 'Serveur injoignable. Vos saisies restent en attente sur ce terminal.'
        : erreur instanceof Error
          ? erreur.message
          : 'Synchronisation impossible.';
    await marquerEchec(bilan.erreur);
  } finally {
    enCours = false;
  }

  return bilan;
}
