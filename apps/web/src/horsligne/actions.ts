/**
 * Écritures du technicien — A5, A6, A8, A9, A10, A11.
 *
 * Principe : chaque geste est appliqué IMMÉDIATEMENT au cache local, puis
 * déposé dans la file de synchronisation. L'interface ne dépend jamais du
 * réseau pour répondre — un technicien dans une cave d'usine doit voir sa
 * confirmation prise en compte instantanément.
 *
 * L'horodatage retenu est celui du geste, pas celui de l'envoi : c'est ce qui
 * rend le TTDi mesurable même quand la synchronisation a lieu six heures plus
 * tard.
 */

import type {
  ChargeCloturerIntervention,
  ChargeConfirmerCause,
  ChargeConfirmerCauseIntervention,
  ChargeCreerEntreeSDCR,
  ChargeOuvrirIntervention,
  ChargeMutation,
  TypeMutation,
} from '@maintxpert/shared';

import { baseLocale, type InterventionLocale } from './db.js';

const uuid = (): string => crypto.randomUUID();
const maintenant = (): string => new Date().toISOString();

/** Dépose une mutation dans la file montante. */
async function enfiler(
  type: TypeMutation,
  charge: ChargeMutation,
  horodatageTerrain: string,
): Promise<string> {
  const idLocal = uuid();
  await baseLocale.fileMutations.put({
    id_local: idLocal,
    type,
    charge,
    horodatage_terrain: horodatageTerrain,
    nb_tentatives: 0,
    derniere_erreur: null,
  });
  return idLocal;
}

/* -------------------------------------------------------------------------- */
/* A8 — ouverture d'intervention, jalon T1                                     */
/* -------------------------------------------------------------------------- */

/**
 * @param instantArrivee  Instant où le technicien s'est présenté devant la
 *   machine, capté à la sélection de l'équipement. L'intervention n'est créée
 *   qu'au moment où un diagnostic commence réellement — parcourir la liste des
 *   équipements ne doit pas ouvrir de chantier — mais elle est horodatée à
 *   l'arrivée, sans quoi le TTDi serait amputé du temps de navigation.
 *   Voir docs/03-decisions.md (D14).
 */
export async function ouvrirIntervention(
  idTechnicien: number,
  idEquipement: number,
  instantArrivee: string,
): Promise<InterventionLocale> {
  const charge: ChargeOuvrirIntervention = { id_equipement: idEquipement, id_sdcr: null };
  const idLocal = await enfiler('ouvrir_intervention', charge, instantArrivee);

  const intervention: InterventionLocale = {
    id_local: idLocal,
    id_intervention: null,
    id_technicien: idTechnicien,
    id_equipement: idEquipement,
    id_sdcr: null,
    datetime_ouverture: instantArrivee,
    datetime_cause_confirmee: null,
    datetime_cloture: null,
  };

  await baseLocale.interventionsLocales.put(intervention);
  return intervention;
}

/* -------------------------------------------------------------------------- */
/* A5 + A9 — confirmation de la cause retenue, jalon T1.5                      */
/* -------------------------------------------------------------------------- */

/**
 * Un seul geste du technicien, deux effets métier :
 *   - A5 : la fréquence observée de la fiche augmente (elle remontera dans FP1) ;
 *   - A9 : le jalon T1.5 est posé, ce qui arrête le chronomètre du diagnostic.
 *
 * Le second n'a lieu que si le jalon n'est pas déjà posé : reconfirmer une cause
 * ne doit pas rallonger artificiellement le TTDi.
 */
export async function confirmerCause(idLocalIntervention: string, idSdcr: number): Promise<void> {
  const instant = maintenant();
  const intervention = await baseLocale.interventionsLocales.get(idLocalIntervention);
  if (!intervention) throw new Error('Intervention introuvable sur ce terminal.');

  // A5 — incrément local immédiat, pour que la carte remonte tout de suite.
  const fiche = await baseLocale.entreesSdcr.get(idSdcr);
  if (fiche && fiche.statut === 'validee') {
    await baseLocale.entreesSdcr.put({
      ...fiche,
      frequence_observee: fiche.frequence_observee + 1,
      date_modification: instant,
    });
    const charge: ChargeConfirmerCause = { id_sdcr: idSdcr };
    await enfiler('confirmer_cause', charge, instant);
  }

  // A9 — jalon T1.5, une seule fois.
  if (intervention.datetime_cause_confirmee === null) {
    const charge: ChargeConfirmerCauseIntervention = {
      id_local_intervention: idLocalIntervention,
      id_sdcr: idSdcr,
    };
    await enfiler('confirmer_cause_intervention', charge, instant);
  }

  await baseLocale.interventionsLocales.put({
    ...intervention,
    id_sdcr: idSdcr,
    datetime_cause_confirmee: intervention.datetime_cause_confirmee ?? instant,
  });
}

/* -------------------------------------------------------------------------- */
/* A6 / A10 — nouvelle fiche SDCR                                              */
/* -------------------------------------------------------------------------- */

export interface SaisieFiche {
  id_equipement: number;
  id_terme_symptome: number | null;
  symptome: string;
  id_terme_defaut: number | null;
  defaut: string;
  id_terme_cause: number | null;
  cause: string;
  id_terme_remede: number | null;
  remede: string;
}

/**
 * La fiche est créée en `en_attente` et n'apparaîtra dans FP1 qu'après
 * validation du responsable. Elle est tout de même écrite au cache local avec
 * un identifiant NÉGATIF provisoire, pour que son auteur la retrouve
 * immédiatement dans « mes contributions » (A12) — la synchronisation la
 * remplacera par la version serveur.
 */
export async function creerFiche(
  saisie: SaisieFiche,
  idContributeur: number,
  idLocalIntervention: string | null,
): Promise<number> {
  const instant = maintenant();

  const charge: ChargeCreerEntreeSDCR = {
    ...saisie,
    id_local_intervention: idLocalIntervention,
  };
  await enfiler('creer_entree_sdcr', charge, instant);

  const viaNomenclature =
    saisie.id_terme_symptome !== null &&
    saisie.id_terme_defaut !== null &&
    saisie.id_terme_cause !== null &&
    saisie.id_terme_remede !== null;

  // Identifiant provisoire négatif : aucune collision possible avec les
  // identifiants serveur, qui sont positifs.
  const provisoires = await baseLocale.entreesSdcr.where('id_sdcr').below(0).toArray();
  const idProvisoire = Math.min(0, ...provisoires.map((f) => f.id_sdcr)) - 1;

  await baseLocale.entreesSdcr.put({
    id_sdcr: idProvisoire,
    ...saisie,
    frequence_observee: 1,
    via_nomenclature: viaNomenclature,
    statut: 'en_attente',
    photo_url: null,
    id_contributeur: idContributeur,
    id_valideur: null,
    date_creation: instant,
    date_modification: instant,
  });

  return idProvisoire;
}

/* -------------------------------------------------------------------------- */
/* A11 — clôture, jalon T2                                                     */
/* -------------------------------------------------------------------------- */

export async function cloturerIntervention(idLocalIntervention: string): Promise<void> {
  const intervention = await baseLocale.interventionsLocales.get(idLocalIntervention);
  if (!intervention) throw new Error('Intervention introuvable sur ce terminal.');
  if (intervention.datetime_cloture !== null) return;

  const instant = maintenant();
  const charge: ChargeCloturerIntervention = { id_local_intervention: idLocalIntervention };
  await enfiler('cloturer_intervention', charge, instant);

  await baseLocale.interventionsLocales.put({ ...intervention, datetime_cloture: instant });
}

/* -------------------------------------------------------------------------- */
/* Mesure — ENF « testabilité »                                                */
/* -------------------------------------------------------------------------- */

export interface MesureIntervention {
  /** T1.5 − T1, en secondes. `null` tant que la cause n'est pas confirmée. */
  ttdi_secondes: number | null;
  /** T2 − T1, en secondes. `null` tant que l'intervention est ouverte. */
  duree_totale_secondes: number | null;
}

export function mesurer(intervention: InterventionLocale): MesureIntervention {
  const t1 = new Date(intervention.datetime_ouverture).getTime();
  const secondes = (iso: string | null): number | null =>
    iso === null ? null : Math.round((new Date(iso).getTime() - t1) / 1000);

  return {
    ttdi_secondes: secondes(intervention.datetime_cause_confirmee),
    duree_totale_secondes: secondes(intervention.datetime_cloture),
  };
}

/** Formatage court d'une durée, pour l'affichage terrain. */
export function formaterDuree(secondes: number | null): string {
  if (secondes === null) return '—';
  if (secondes < 60) return `${secondes} s`;

  const minutes = Math.floor(secondes / 60);
  if (minutes < 60) return `${minutes} min`;

  const heures = Math.floor(minutes / 60);
  return `${heures} h ${String(minutes % 60).padStart(2, '0')}`;
}
