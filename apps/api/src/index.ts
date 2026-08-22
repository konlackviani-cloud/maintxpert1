/** Point d'entrée du serveur MaintXpert. */

import { creerApp } from './app.js';
import { env } from './config/env.js';
import { fermerPool } from './db/client.js';

const app = creerApp();

const serveur = app.listen(env.PORT, () => {
  console.log(`[api] MaintXpert écoute sur http://localhost:${env.PORT} (${env.NODE_ENV})`);
  console.log(`[api] santé : http://localhost:${env.PORT}/api/v1/sante`);
});

/** Arrêt propre : on cesse d'accepter, puis on ferme le pool. */
async function arreter(signal: string): Promise<void> {
  console.log(`[api] ${signal} reçu, arrêt en cours…`);
  serveur.close(async () => {
    await fermerPool();
    console.log('[api] arrêt terminé.');
    process.exit(0);
  });

  // Filet de sécurité si une connexion refuse de se fermer.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => void arreter('SIGTERM'));
process.on('SIGINT', () => void arreter('SIGINT'));
