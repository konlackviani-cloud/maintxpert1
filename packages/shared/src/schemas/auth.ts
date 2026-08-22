/**
 * Schémas de validation de l'authentification.
 * Utilisés par l'API (validation d'entrée) et par le front (validation avant envoi) :
 * un seul jeu de règles, un seul jeu de messages d'erreur en français.
 */

import { z } from 'zod';
import {
  MATRICULE_LONGUEUR_MAX,
  MOT_DE_PASSE_LONGUEUR_MAX,
  MOT_DE_PASSE_LONGUEUR_MIN,
  normaliserMatricule,
  validerMatricule,
} from '../regles/matricule.js';

export const schemaIdentifiants = z.object({
  matricule: z
    .string({ required_error: 'Le matricule est obligatoire.' })
    .max(MATRICULE_LONGUEUR_MAX + 10, 'Matricule trop long.')
    .transform(normaliserMatricule)
    .superRefine((matricule, ctx) => {
      const resultat = validerMatricule(matricule);
      if (!resultat.valide) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: resultat.motif ?? 'Matricule invalide.' });
      }
    }),
  mot_de_passe: z
    .string({ required_error: 'Le mot de passe est obligatoire.' })
    .min(MOT_DE_PASSE_LONGUEUR_MIN, `Le mot de passe doit compter au moins ${MOT_DE_PASSE_LONGUEUR_MIN} caractères.`)
    .max(MOT_DE_PASSE_LONGUEUR_MAX, 'Mot de passe trop long.'),
});

export type EntreeIdentifiants = z.input<typeof schemaIdentifiants>;

export const schemaRafraichissement = z.object({
  jeton_rafraichissement: z
    .string({ required_error: 'Jeton de rafraîchissement manquant.' })
    .min(1, 'Jeton de rafraîchissement manquant.'),
});
