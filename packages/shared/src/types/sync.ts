/**
 * Contrat de synchronisation entre la PWA et l'API.
 *
 * Deux sens, volontairement dissymétriques :
 *   - DESCENDANT (pull) : instantané complet des référentiels, delta sur les
 *     fiches SDCR. Alimente le cache de consultation.
 *   - MONTANT (push) : file de mutations horodatées au moment du geste sur le
 *     terrain, rejouable et idempotente.
 */

import type {
  EntreeConfiguration,
  EntreeSDCR,
  Equipement,
  Intervention,
  TermeNomenclature,
} from './entites.js';

/* -------------------------------------------------------------------------- */
/* Descendant                                                                  */
/* -------------------------------------------------------------------------- */

export interface InstantaneSync {
  /** Horodatage serveur de cet instantané — à renvoyer au prochain pull. */
  horodatage: string;
  /** `true` si les fiches SDCR sont un delta et non l'ensemble. */
  partiel: boolean;
  equipements: Equipement[];
  termes: TermeNomenclature[];
  entrees_sdcr: EntreeSDCR[];
  configuration: EntreeConfiguration[];
  interventions: Intervention[];
}

/* -------------------------------------------------------------------------- */
/* Montant                                                                     */
/* -------------------------------------------------------------------------- */

export type TypeMutation =
  | 'creer_entree_sdcr'
  | 'confirmer_cause'
  | 'ouvrir_intervention'
  | 'confirmer_cause_intervention'
  | 'cloturer_intervention';

/** A6 / A10 — nouvelle fiche SDCR. */
export interface ChargeCreerEntreeSDCR {
  id_equipement: number;
  id_terme_symptome: number | null;
  symptome: string;
  id_terme_defaut: number | null;
  defaut: string;
  id_terme_cause: number | null;
  cause: string;
  id_terme_remede: number | null;
  remede: string;
  /** Identifiant local de l'intervention associée, s'il y en a une. */
  id_local_intervention: string | null;
}

/** A5 — le technicien confirme qu'une fiche existante correspond. */
export interface ChargeConfirmerCause {
  id_sdcr: number;
}

/** A8 — ouverture, jalon T1. */
export interface ChargeOuvrirIntervention {
  id_equipement: number;
  id_sdcr: number | null;
}

/** A9 — jalon T1.5. */
export interface ChargeConfirmerCauseIntervention {
  /** Référence locale : l'intervention peut ne pas encore exister côté serveur. */
  id_local_intervention: string;
  id_sdcr: number | null;
}

/** A11 — jalon T2. */
export interface ChargeCloturerIntervention {
  id_local_intervention: string;
}

export type ChargeMutation =
  | ChargeCreerEntreeSDCR
  | ChargeConfirmerCause
  | ChargeOuvrirIntervention
  | ChargeConfirmerCauseIntervention
  | ChargeCloturerIntervention;

export interface MutationSortante {
  /** UUID généré sur le terminal — clé d'idempotence côté serveur. */
  id_local: string;
  type: TypeMutation;
  charge: ChargeMutation;
  /**
   * Instant du geste RÉEL sur le terrain, pas de l'envoi.
   * Le TTDi mesure le travail du technicien, jamais la latence réseau.
   */
  horodatage_terrain: string;
}

export type StatutMutation = 'applique' | 'deja_applique' | 'refuse';

export interface ResultatMutation {
  id_local: string;
  statut: StatutMutation;
  /** Identifiants attribués par le serveur, à réconcilier dans le cache local. */
  resultat?: { id_sdcr?: number; id_intervention?: number };
  /** Renseigné si `statut === 'refuse'` — message en français, affichable. */
  motif?: string;
}

export interface ReponsePush {
  resultats: ResultatMutation[];
}
