/** Validation des actions du responsable maintenance (B1, B2). */

import { z } from 'zod';

const libelle = z.string().trim().min(2, 'Libellé trop court.').max(150, 'Libellé trop long.');

const correctionNiveau = z.object({
  id_terme: z.number().int().positive().nullable(),
  libelle,
});

/**
 * Corrections appliquées à la validation. Toutes facultatives : valider sans
 * rien corriger est le cas courant.
 */
export const schemaCorrections = z.object({
  symptome: correctionNiveau.optional(),
  defaut: correctionNiveau.optional(),
  cause: correctionNiveau.optional(),
  remede: correctionNiveau.optional(),
});

export const schemaValider = z.object({
  corrections: schemaCorrections.optional(),
});

/**
 * Un rejet exige un motif : le technicien doit comprendre pourquoi sa
 * contribution n'entre pas dans la base, sinon il cesse de contribuer.
 */
export const schemaRejeter = z.object({
  motif: z.string().trim().min(5, 'Indiquez un motif de rejet.').max(500),
});

export const schemaRenvoyerEnCorrection = z.object({
  motif: z.string().trim().min(5, 'Indiquez ce qui doit être corrigé.').max(500),
});

export const schemaFusionnerFiches = z.object({
  id_sdcr_cible: z.number().int().positive(),
});

/* -------------------------------------------------------------------------- */
/* B2                                                                          */
/* -------------------------------------------------------------------------- */

export const schemaCreerTerme = z.object({
  libelle,
  type: z.enum(['symptome', 'defaut', 'cause', 'remede']),
  id_equipement: z.number().int().positive(),
  categorie_afnor: z.string().trim().max(100).nullable().optional(),
});

export const schemaRenommerTerme = z.object({ libelle });

export const schemaFusionnerTermes = z.object({
  /** Terme conservé. La source est archivée et redirigée vers lui. */
  id_terme_cible: z.number().int().positive(),
});
