/**
 * Moteur de synchronisation — couche 2, autorité sur les écritures.
 *
 * Le sens montant traite une file de mutations produites hors ligne. Trois
 * garanties :
 *   1. IDEMPOTENCE — un `id_local` déjà journalisé renvoie son résultat
 *      d'origine sans rien réappliquer.
 *   2. HORODATAGE TERRAIN — les jalons T1/T1.5/T2 portent l'instant du geste,
 *      jamais celui de l'envoi. Le TTDi mesure le diagnostic, pas le réseau.
 *   3. ORDRE — les mutations sont traitées en séquence : une intervention doit
 *      exister avant qu'on y pose T1.5, alors que les deux peuvent arriver dans
 *      le même lot.
 */

import {
  schemaCloturerIntervention,
  schemaConfirmerCause,
  schemaConfirmerCauseIntervention,
  schemaCreerEntreeSDCR,
  schemaOuvrirIntervention,
  type InstantaneSync,
  type MutationSortante,
  type ResultatMutation,
} from '@maintxpert/shared';

import {
  listerConfiguration,
  listerEntreesSDCR,
  listerEquipements,
  listerInterventions,
  listerTermesActifs,
} from '../../db/requetes/catalogue.js';
import {
  cloturerIntervention,
  confirmerCause,
  creerEntreeSDCR,
  journaliser,
  lireMutationAppliquee,
  marquerCauseConfirmee,
  ouvrirIntervention,
} from '../../db/requetes/mutations.js';

/* -------------------------------------------------------------------------- */
/* Descendant                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Équipements, nomenclature et configuration partent toujours en entier : ce
 * sont quelques centaines de lignes, et un delta sur des tables sans horodatage
 * de modification serait faux. Seules les fiches SDCR et les interventions,
 * volumineuses et croissantes, acceptent un delta.
 */
export async function construireInstantane(
  idUtilisateur: number,
  depuis?: string,
): Promise<InstantaneSync> {
  const horodatage = new Date().toISOString();

  const [equipements, termes, configuration, entrees, interventions] = await Promise.all([
    listerEquipements(),
    listerTermesActifs(),
    listerConfiguration(),
    listerEntreesSDCR(idUtilisateur, depuis),
    listerInterventions(idUtilisateur, depuis),
  ]);

  return {
    horodatage,
    partiel: depuis !== undefined,
    equipements,
    termes,
    configuration,
    entrees_sdcr: entrees,
    interventions,
  };
}

/* -------------------------------------------------------------------------- */
/* Montant                                                                     */
/* -------------------------------------------------------------------------- */

/** Correspondance id_local → id_intervention, valable le temps d'un lot. */
type CorrespondanceInterventions = Map<string, number>;

const refus = (idLocal: string, motif: string): ResultatMutation => ({
  id_local: idLocal,
  statut: 'refuse',
  motif,
});

async function appliquerUne(
  mutation: MutationSortante,
  idUtilisateur: number,
  interventions: CorrespondanceInterventions,
): Promise<ResultatMutation> {
  const { id_local: idLocal, type, charge, horodatage_terrain: horodatage } = mutation;

  switch (type) {
    case 'creer_entree_sdcr': {
      const analyse = schemaCreerEntreeSDCR.safeParse(charge);
      if (!analyse.success) return refus(idLocal, 'Fiche SDCR incomplète ou invalide.');

      const idSdcr = await creerEntreeSDCR(analyse.data, idUtilisateur, horodatage);
      return { id_local: idLocal, statut: 'applique', resultat: { id_sdcr: idSdcr } };
    }

    case 'confirmer_cause': {
      const analyse = schemaConfirmerCause.safeParse(charge);
      if (!analyse.success) return refus(idLocal, 'Confirmation invalide.');

      const applique = await confirmerCause(analyse.data.id_sdcr);
      return applique
        ? { id_local: idLocal, statut: 'applique', resultat: { id_sdcr: analyse.data.id_sdcr } }
        : refus(idLocal, 'Cette fiche n’est plus validée : la confirmation n’a pas été enregistrée.');
    }

    case 'ouvrir_intervention': {
      const analyse = schemaOuvrirIntervention.safeParse(charge);
      if (!analyse.success) return refus(idLocal, 'Ouverture d’intervention invalide.');

      const idIntervention = await ouvrirIntervention(
        idUtilisateur,
        analyse.data.id_equipement,
        analyse.data.id_sdcr,
        horodatage,
      );
      // L'id_local de la mutation d'ouverture EST la référence de l'intervention
      // pour les jalons suivants du même lot.
      interventions.set(idLocal, idIntervention);
      return { id_local: idLocal, statut: 'applique', resultat: { id_intervention: idIntervention } };
    }

    case 'confirmer_cause_intervention': {
      const analyse = schemaConfirmerCauseIntervention.safeParse(charge);
      if (!analyse.success) return refus(idLocal, 'Jalon invalide.');

      const idIntervention = await resoudreIntervention(
        analyse.data.id_local_intervention,
        interventions,
      );
      if (idIntervention === null) {
        return refus(idLocal, 'Intervention introuvable : le jalon n’a pas pu être posé.');
      }

      const applique = await marquerCauseConfirmee(
        idIntervention,
        idUtilisateur,
        analyse.data.id_sdcr,
        horodatage,
      );
      return applique
        ? { id_local: idLocal, statut: 'applique', resultat: { id_intervention: idIntervention } }
        : { id_local: idLocal, statut: 'deja_applique', resultat: { id_intervention: idIntervention } };
    }

    case 'cloturer_intervention': {
      const analyse = schemaCloturerIntervention.safeParse(charge);
      if (!analyse.success) return refus(idLocal, 'Clôture invalide.');

      const idIntervention = await resoudreIntervention(
        analyse.data.id_local_intervention,
        interventions,
      );
      if (idIntervention === null) {
        return refus(idLocal, 'Intervention introuvable : la clôture n’a pas pu être enregistrée.');
      }

      const applique = await cloturerIntervention(idIntervention, idUtilisateur, horodatage);
      return applique
        ? { id_local: idLocal, statut: 'applique', resultat: { id_intervention: idIntervention } }
        : { id_local: idLocal, statut: 'deja_applique', resultat: { id_intervention: idIntervention } };
    }

    default:
      return refus(idLocal, `Type de mutation inconnu : ${String(type)}.`);
  }
}

/**
 * Retrouve l'identifiant serveur d'une intervention désignée par son id_local.
 * D'abord dans le lot courant, puis dans le journal — l'ouverture a pu être
 * synchronisée lors d'un envoi précédent.
 */
async function resoudreIntervention(
  idLocalIntervention: string,
  interventions: CorrespondanceInterventions,
): Promise<number | null> {
  const duLot = interventions.get(idLocalIntervention);
  if (duLot !== undefined) return duLot;

  const journalisee = await lireMutationAppliquee(idLocalIntervention);
  const idIntervention = journalisee?.resultat?.id_intervention;
  if (idIntervention !== undefined) {
    interventions.set(idLocalIntervention, idIntervention);
    return idIntervention;
  }

  return null;
}

/**
 * Traite un lot. Séquentiel et non transactionnel : une mutation refusée ne
 * doit pas annuler les précédentes, déjà journalisées. Le client reçoit un
 * statut par mutation et ne retire de sa file que celles qui ont abouti.
 */
export async function appliquerLot(
  mutations: MutationSortante[],
  idUtilisateur: number,
): Promise<ResultatMutation[]> {
  const interventions: CorrespondanceInterventions = new Map();
  const resultats: ResultatMutation[] = [];

  for (const mutation of mutations) {
    const deja = await lireMutationAppliquee(mutation.id_local);
    if (deja) {
      if (deja.resultat?.id_intervention !== undefined) {
        interventions.set(mutation.id_local, deja.resultat.id_intervention);
      }
      resultats.push({
        id_local: mutation.id_local,
        statut: 'deja_applique',
        ...(deja.resultat ? { resultat: deja.resultat } : {}),
      });
      continue;
    }

    const resultat = await appliquerUne(mutation, idUtilisateur, interventions);

    // Un refus n'est pas journalisé : c'est une erreur métier, pas un doublon.
    // Le client l'écarte de sa file et le signale, il ne le rejouera pas.
    if (resultat.statut === 'applique') {
      await journaliser(mutation.id_local, mutation.type, idUtilisateur, resultat.resultat ?? null);
    }

    resultats.push(resultat);
  }

  return resultats;
}
