/** Routes de synchronisation — le SEUL point de contact PWA ↔ API en usage courant. */

import { schemaPull, schemaPush, type MutationSortante } from '@maintxpert/shared';
import { Router, type NextFunction, type Request, type Response } from 'express';

import { exigeAuthentification } from '../../middlewares/auth-jwt.js';
import { erreurRequete } from '../../middlewares/erreurs.js';
import { appliquerLot, construireInstantane } from './service.js';

function asynchrone(
  gestionnaire: (req: Request, res: Response) => Promise<void>,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    gestionnaire(req, res).catch(next);
  };
}

export const routesSync = Router();

routesSync.use(exigeAuthentification);

/**
 * GET /api/v1/sync/pull?depuis=<ISO 8601>
 * Sans `depuis` : instantané complet, pour un premier démarrage.
 */
routesSync.get(
  '/pull',
  asynchrone(async (req, res) => {
    const analyse = schemaPull.safeParse(req.query);
    if (!analyse.success) {
      throw erreurRequete('Paramètre « depuis » invalide : horodatage ISO 8601 attendu.');
    }

    res
      .status(200)
      .json(
        await construireInstantane(
          req.utilisateur!.id_utilisateur,
          req.utilisateur!.role,
          analyse.data.depuis,
        ),
      );
  }),
);

/** POST /api/v1/sync/push — rejeu de la file d'attente du terminal. */
routesSync.post(
  '/push',
  asynchrone(async (req, res) => {
    const analyse = schemaPush.safeParse(req.body);
    if (!analyse.success) {
      throw erreurRequete(
        'Lot de synchronisation invalide.',
        analyse.error.issues.map((i) => ({ champ: i.path.join('.'), message: i.message })),
      );
    }

    const resultats = await appliquerLot(
      analyse.data.mutations as MutationSortante[],
      req.utilisateur!.id_utilisateur,
    );

    res.status(200).json({ resultats });
  }),
);

