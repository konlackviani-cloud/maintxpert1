/** Validation des mutations montantes. Appliquée côté API, autorité finale. */

import { z } from 'zod';

const LIBELLE_MAX = 150;
const libelle = z
  .string()
  .trim()
  .min(2, 'Libellé trop court.')
  .max(LIBELLE_MAX, `Libellé limité à ${LIBELLE_MAX} caractères.`);

const idTerme = z.number().int().positive().nullable();
const idLocal = z.string().uuid('Identifiant local invalide.');

export const schemaCreerEntreeSDCR = z.object({
  id_equipement: z.number().int().positive(),
  id_terme_symptome: idTerme,
  symptome: libelle,
  id_terme_defaut: idTerme,
  defaut: libelle,
  id_terme_cause: idTerme,
  cause: libelle,
  id_terme_remede: idTerme,
  remede: libelle,
  id_local_intervention: idLocal.nullable(),
});

export const schemaConfirmerCause = z.object({
  id_sdcr: z.number().int().positive(),
});

export const schemaOuvrirIntervention = z.object({
  id_equipement: z.number().int().positive(),
  id_sdcr: z.number().int().positive().nullable(),
});

export const schemaConfirmerCauseIntervention = z.object({
  id_local_intervention: idLocal,
  id_sdcr: z.number().int().positive().nullable(),
});

export const schemaCloturerIntervention = z.object({
  id_local_intervention: idLocal,
});

/**
 * Une mutation de la file. `charge` est validée séparément selon `type`
 * (voir apps/api/src/modules/sync/service.ts) : un discriminant zod aurait
 * imposé de porter `type` à l'intérieur de chaque charge.
 */
export const schemaMutation = z.object({
  id_local: idLocal,
  type: z.enum([
    'creer_entree_sdcr',
    'confirmer_cause',
    'ouvrir_intervention',
    'confirmer_cause_intervention',
    'cloturer_intervention',
  ]),
  charge: z.unknown(),
  horodatage_terrain: z.string().datetime({ offset: true }),
});

/** Taille de lot : une file plus longue est envoyée en plusieurs requêtes. */
export const TAILLE_LOT_PUSH = 50;

export const schemaPush = z.object({
  mutations: z.array(schemaMutation).min(1).max(TAILLE_LOT_PUSH),
});

export const schemaPull = z.object({
  depuis: z.string().datetime({ offset: true }).optional(),
});
