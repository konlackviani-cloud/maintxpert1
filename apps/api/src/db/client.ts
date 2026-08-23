/**
 * Pool de connexions PostgreSQL. Une seule instance pour tout le processus.
 *
 * Les réglages ci-dessous ne sont pas cosmétiques : entre l'API et la base il y
 * a un pooler distant et un poste de travail qui change de réseau, se met en
 * veille, ou perd le Wi-Fi de l'usine. Sans eux, le pool conservait des sockets
 * mortes que Node ne détectait jamais : le serveur continuait d'accepter les
 * connexions TCP mais aucune requête n'aboutissait plus. Vu en conditions
 * réelles — l'écran affichait « Serveur injoignable » alors que la base
 * répondait en 2 s, et seul un redémarrage de l'API débloquait la situation.
 */

import pg from 'pg';
import { env } from '../config/env.js';

export const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,

  // Détecte une socket morte au lieu d'attendre indéfiniment dessus.
  keepAlive: true,
  keepAliveInitialDelayMillis: 10_000,

  // Recycle les connexions avant que le pooler distant ne les coupe de son côté.
  maxLifetimeSeconds: 900,

  // Plafond dur : aucune requête ne peut immobiliser le serveur pour toujours.
  // Généreux pour l'import CSV, qui est la requête la plus lourde de l'API.
  query_timeout: 30_000,
  statement_timeout: 30_000,
  idle_in_transaction_session_timeout: 30_000,
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

/**
 * La base répond-elle ? Utilisé par la sonde de santé.
 *
 * Délai propre, bien plus court que celui des requêtes métier : une sonde qui
 * met trente secondes à répondre « ça va mal » ne sert à rien. Elle doit dire
 * vite que la base ne suit pas, pas attendre la preuve définitive.
 */
const DELAI_SONDE_MS = 3_000;

export async function verifierConnexion(): Promise<boolean> {
  let minuterie: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      pool.query('select 1').then(() => true),
      new Promise<boolean>((resoudre) => {
        minuterie = setTimeout(() => resoudre(false), DELAI_SONDE_MS);
      }),
    ]);
  } catch {
    return false;
  } finally {
    clearTimeout(minuterie);
  }
}

export async function fermerPool(): Promise<void> {
  await pool.end();
}
