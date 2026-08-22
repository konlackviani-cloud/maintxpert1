/**
 * Cache local IndexedDB (Dexie) — socle de la règle « hors ligne d'abord ».
 *
 * Trois natures de tables :
 *   - MIROIRS des tables serveur, alimentés par la synchronisation descendante.
 *     Toute consultation lit ici, jamais le réseau.
 *   - INTERVENTIONS LOCALES : le chantier en cours du technicien. Elles existent
 *     avant d'avoir un identifiant serveur, d'où une clé locale (UUID).
 *   - FILES D'ATTENTE montantes, volontairement SÉPARÉES pour le texte et les
 *     photos : une photo lourde ou en échec ne doit jamais retarder la remontée
 *     d'une fiche SDCR.
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
  MutationSortante,
  TermeNomenclature,
} from '@maintxpert/shared';

/* -------------------------------------------------------------------------- */
/* Intervention en cours sur le terminal                                       */
/* -------------------------------------------------------------------------- */

/**
 * Une intervention vit d'abord localement. Son `id_local` sert de référence
 * aux jalons T1.5 et T2 tant que le serveur n'a pas attribué d'identifiant —
 * ce qui peut prendre toute une nuit de travail hors réseau.
 */
export interface InterventionLocale {
  id_local: string;
  /** Attribué par le serveur à la synchronisation. `null` tant qu'elle n'est pas remontée. */
  id_intervention: number | null;
  id_technicien: number;
  id_equipement: number;
  id_sdcr: number | null;
  /** T1 — instant réel d'arrivée devant la machine. */
  datetime_ouverture: string;
  /** T1.5 */
  datetime_cause_confirmee: string | null;
  /** T2 */
  datetime_cloture: string | null;
}

/** Photos compressées en attente d'envoi vers le stockage objet (phase 5). */
export interface PhotoEnAttente {
  id_local: string;
  id_mutation_liee: string | null;
  cible: 'sdcr' | 'csd';
  blob: Blob;
  type_mime: string;
  taille_octets: number;
  nb_tentatives: number;
  derniere_erreur: string | null;
}

/** Une mutation en file, augmentée du suivi des tentatives. */
export interface MutationEnAttente extends MutationSortante {
  nb_tentatives: number;
  derniere_erreur: string | null;
}

export interface MetaSync {
  cle: string;
  valeur: string;
}

/* -------------------------------------------------------------------------- */

export class BaseLocale extends Dexie {
  // Miroirs — alimentés par /sync/pull.
  equipements!: Table<Equipement, number>;
  termes!: Table<TermeNomenclature, number>;
  entreesSdcr!: Table<EntreeSDCR, number>;
  fichesCsd!: Table<FicheCSD, number>;
  modesAmdec!: Table<ModeAMDEC, number>;
  defaillogrammes!: Table<Defaillogramme, number>;
  interventions!: Table<Intervention, number>;
  configuration!: Table<EntreeConfiguration, string>;

  // Travail en cours et files montantes.
  interventionsLocales!: Table<InterventionLocale, string>;
  fileMutations!: Table<MutationEnAttente, string>;
  filePhotos!: Table<PhotoEnAttente, string>;
  metaSync!: Table<MetaSync, string>;

  constructor() {
    super('maintxpert');

    this.version(2).stores({
      equipements: 'id_equipement, chaine, famille, [chaine+famille]',

      termes: 'id_terme, id_equipement, type, statut, [id_equipement+type], compteur_usage',

      // FP1 s'appuie sur id_equipement ; le tri par fréquence est appliqué en
      // mémoire par comparerParFrequence() pour rester identique au tri serveur.
      entreesSdcr:
        'id_sdcr, id_equipement, statut, symptome, [id_equipement+symptome], ' +
        'frequence_observee, id_contributeur, date_modification',

      fichesCsd: 'id_csd, id_equipement',
      modesAmdec: 'id_mode, ipr',
      defaillogrammes: 'id_defaillogramme, id_equipement',
      interventions: 'id_intervention, id_technicien, id_equipement, datetime_ouverture',
      configuration: 'cle',

      interventionsLocales: 'id_local, id_technicien, id_equipement, datetime_ouverture',
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
/** Horodatage du dernier pull réussi, renvoyé au suivant pour obtenir un delta. */
export const CLE_CURSEUR_PULL = 'curseur_pull';

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
