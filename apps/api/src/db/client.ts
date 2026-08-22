/** Pool de connexions PostgreSQL. Une seule instance pour tout le processus. */

import pg from 'pg';
import { env } from '../config/env.js';

export const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', (erreur) => {
  console.error('[db] erreur sur une connexion inactive du pool :', erreur.message);
});

/** Requête typée. */
export async function requete<T extends pg.QueryResultRow>(
  texte: string,
  parametres: readonly unknown[] = [],
): Promise<T[]> {
  const resultat = await pool.query<T>(texte, parametres as unknown[]);
  return resultat.rows;
}

/** La base répond-elle ? Utilisé par la sonde de santé. */
export async function verifierConnexion(): Promise<boolean> {
  try {
    await pool.query('select 1');
    return true;
  } catch {
    return false;
  }
}

export async function fermerPool(): Promise<void> {
  await pool.end();
}
