/**
 * Lecture et validation de la configuration d'environnement.
 * Échec immédiat au démarrage si une variable requise manque : mieux vaut un
 * refus de démarrer qu'une API qui tourne avec un secret vide.
 */

import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  /** Chaîne de connexion PostgreSQL (Supabase local ou distant). */
  DATABASE_URL: z.string().min(1, 'DATABASE_URL est requis'),

  /** Secret de signature des JWT. Utilisé en phase 2 (A1). */
  JWT_SECRET: z.string().min(32, 'JWT_SECRET doit faire au moins 32 caractères'),

  /** Origines autorisées pour CORS, séparées par des virgules. */
  ORIGINES_AUTORISEES: z
    .string()
    .default('http://localhost:5173')
    .transform((v) => v.split(',').map((o) => o.trim()).filter(Boolean)),
});

export type Env = z.infer<typeof schema>;

function chargerEnv(): Env {
  const resultat = schema.safeParse(process.env);

  if (!resultat.success) {
    const details = resultat.error.issues
      .map((i) => `  - ${i.path.join('.')} : ${i.message}`)
      .join('\n');
    throw new Error(`Configuration d'environnement invalide :\n${details}`);
  }

  return resultat.data;
}

export const env = chargerEnv();
export const enProduction = env.NODE_ENV === 'production';
