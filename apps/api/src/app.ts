/**
 * Assemblage de l'application Express.
 * Séparé de index.ts pour rester testable sans ouvrir de port.
 */

import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';

import { env } from './config/env.js';
import { verifierConnexion } from './db/client.js';
import { gestionnaireErreurs, routeIntrouvable } from './middlewares/erreurs.js';

export function creerApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: env.ORIGINES_AUTORISEES, credentials: true }));

  // Limite volontairement basse : les photos passent par le stockage objet,
  // jamais par le corps JSON de l'API.
  app.use(express.json({ limit: '256kb' }));

  /** Sonde de santé — ne requiert pas d'authentification. */
  app.get('/api/v1/sante', async (_req, res) => {
    const baseAccessible = await verifierConnexion();
    res.status(baseAccessible ? 200 : 503).json({
      service: 'maintxpert-api',
      version: '1.0.0',
      environnement: env.NODE_ENV,
      base_de_donnees: baseAccessible ? 'accessible' : 'inaccessible',
      horodatage: new Date().toISOString(),
    });
  });

  // Les modules métier se branchent ici au fil des phases :
  //   phase 2 — /api/v1/auth
  //   phase 3 — /api/v1/equipements, /api/v1/entrees-sdcr, /api/v1/interventions
  //   phase 4 — /api/v1/nomenclature
  //   ...

  app.use(routeIntrouvable);
  app.use(gestionnaireErreurs);

  return app;
}
