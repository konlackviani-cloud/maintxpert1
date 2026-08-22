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
import { routesAuth } from './modules/auth/routes.js';
import { routesCSD } from './modules/csd/routes.js';
import { routesNomenclature } from './modules/nomenclature/routes.js';
import { routesPhotos } from './modules/photos/routes.js';
import { routesSync } from './modules/sync/routes.js';
import { routesValidation } from './modules/validation/routes.js';

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

  app.use('/api/v1/auth', routesAuth);
  app.use('/api/v1/sync', routesSync);
  app.use('/api/v1/validation', routesValidation);
  app.use('/api/v1/nomenclature', routesNomenclature);
  app.use('/api/v1/csd', routesCSD);
  app.use('/api/v1/photos', routesPhotos);

  // Les modules métier se branchent ici au fil des phases :
  //   phase 6 — /api/v1/amdec, /api/v1/import
  //   ...
  //
  // La consultation ne passe PAS par l'API : elle lit le cache IndexedDB,
  // alimenté par /sync/pull. Voir CLAUDE.md, « hors ligne d'abord ».

  app.use(routeIntrouvable);
  app.use(gestionnaireErreurs);

  return app;
}

