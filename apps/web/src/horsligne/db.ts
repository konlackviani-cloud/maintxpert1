/**
 * Cache local IndexedDB (Dexie) — socle de la règle « hors ligne d'abord ».
 *
 * Deux natures de tables :
 *   - les MIROIRS des tables serveur, alimentés par la synchronisation descendante.
 *     Toute consultation (FP1, fiches CSD, dashboard) lit ici, jamais le réseau.
 *   - les FILES D'ATTENTE de synchronisation montante, volontairement SÉPARÉES
 *     pour le texte et les photos : une photo lourde ou en échec ne doit jamais
 *     retarder la remontée d'une fiche SDCR.
 *
 * Le moteur de synchronisation lui-même arrive en phase 3.
 */

import Dexie, { type Table } from 'dexie';
import type {
  Defaillogramme,
  EntreeConfiguration,
  EntreeSDCR,
  Equipement,
  FicheCSD,
  Intervention,
  ModeAMDEC,
  TermeNomenclature,
} from '@maintxpert/shared';

/* -------------------------------------------------------------------------- */
/* Files d'attente                                                             */
/* -------------------------------------------------------------------------- */

/** Opérations d'écriture créées hors ligne, à rejouer contre l'API. */
export type TypeMutation =
  | 'creer_entree_sdcr' // A6, A10
  | 'confirmer_cause' // A5 — incrément de frequence_observee
  | 'ouvrir_intervention' // A8  (T1)
  | 'confirmer_cause_intervention' // A9  (T1.5)
  | 'cloturer_intervention'; // A11 (T2)

export interface MutationEnAttente {
  /** UUID généré localement — identifiant d'idempotence côté serveur. */
  id_local: string;
  type: TypeMutation;
  charge: unknown;
  /**
   * Horodatage de l'action RÉELLE sur le terrain, pas de la synchronisation.
   * Indispensable : le TTDi mesure le travail du technicien, pas la latence réseau.
   */
  horodatage_terrain: string;
  nb_tentatives: number;
  derniere_erreur: string | null;
}

/** Photos compressées en attente d'envoi vers le stockage objet. */
export interface PhotoEnAttente {
  id_local: string;
  /** Mutation texte à laquelle rattacher l'URL une fois la photo montée. */
  id_mutation_liee: string | null;
  cible: 'sdcr' | 'csd';
  blob: Blob;
  type_mime: string;
  taille_octets: number;
  nb_tentatives: number;
  derniere_erreur: string | null;
}

/** Métadonnées du moteur de synchronisation (curseurs, dernière synchro). */
export interface MetaSync {
  cle: string;
  valeur: string;
}

/* -------------------------------------------------------------------------- */

export class BaseLocale extends Dexie {
  // Miroirs — lecture seule côté client, alimentés par la synchronisation.
  equipements!: Table<Equipement, number>;
  termes!: Table<TermeNomenclature, number>;
  entreesSdcr!: Table<EntreeSDCR, number>;
  fichesCsd!: Table<FicheCSD, number>;
  modesAmdec!: Table<ModeAMDEC, number>;
  defaillogrammes!: Table<Defaillogramme, number>;
  interventions!: Table<Intervention, number>;
  configuration!: Table<EntreeConfiguration, string>;

  // Files d'attente montantes.
  fileMutations!: Table<MutationEnAttente, string>;
  filePhotos!: Table<PhotoEnAttente, string>;
  metaSync!: Table<MetaSync, string>;

  constructor() {
    super('maintxpert');

    this.version(1).stores({
      equipements: 'id_equipement, chaine, famille, [chaine+famille]',

      // Sélection des listes déroulantes : (équipement, type), tri par usage.
      termes: 'id_terme, id_equipement, type, statut, [id_equipement+type], compteur_usage',

      // FP1 s'appuie sur l'index composé [id_equipement+symptome].
      // Le tri par fréquence est appliqué en mémoire par comparerParFrequence()
      // pour rester strictement identique au tri serveur.
      entreesSdcr:
        'id_sdcr, id_equipement, statut, symptome, [id_equipement+symptome], ' +
        'frequence_observee, id_contributeur, date_modification',

      fichesCsd: 'id_csd, id_equipement',
      modesAmdec: 'id_mode, ipr',
      defaillogrammes: 'id_defaillogramme, id_equipement',
      interventions: 'id_intervention, id_technicien, id_equipement, datetime_ouverture',
      configuration: 'cle',

      fileMutations: 'id_local, type, horodatage_terrain',
      filePhotos: 'id_local, id_mutation_liee, cible',
      metaSync: 'cle',
    });
  }
}

export const baseLocale = new BaseLocale();

/* -------------------------------------------------------------------------- */
/* Métadonnées de synchronisation                                              */
/* -------------------------------------------------------------------------- */

export const CLE_DERNIERE_SYNCHRO = 'derniere_synchro';

export async function lireMeta(cle: string): Promise<string | null> {
  const ligne = await baseLocale.metaSync.get(cle);
  return ligne?.valeur ?? null;
}

export async function ecrireMeta(cle: string, valeur: string): Promise<void> {
  await baseLocale.metaSync.put({ cle, valeur });
}

/** Nombre d'écritures en attente — alimente l'indicateur permanent de l'interface. */
export async function compterEnAttente(): Promise<{ mutations: number; photos: number }> {
  const [mutations, photos] = await Promise.all([
    baseLocale.fileMutations.count(),
    baseLocale.filePhotos.count(),
  ]);
  return { mutations, photos };
}

/**
 * Purge totale du cache. Réservée à la déconnexion : contrainte BYOD, aucune
 * donnée industrielle ne doit subsister sur un terminal après déconnexion.
 */
export async function purgerCache(): Promise<void> {
  await baseLocale.delete();
}
