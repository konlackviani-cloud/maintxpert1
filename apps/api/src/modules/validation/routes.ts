/** B1 — routes de validation. Réservées au responsable maintenance. */

import {
  schemaFusionnerFiches,
  schemaRejeter,
  schemaRenvoyerEnCorrection,
  schemaValider,
} from '@maintxpert/shared';
import { Router, type NextFunction, type Request, type Response } from 'express';

import { exigeAuthentification, exigeRole } from '../../middlewares/auth-jwt.js';
import { erreurRequete } from '../../middlewares/erreurs.js';
import {
  archiver,
  detail,
  file,
  fusionner,
  rejeter,
  renvoyerEnCorrection,
  valider,
} from './service.js';

function asynchrone(
  gestionnaire: (req: Request, res: Response) => Promise<void>,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    gestionnaire(req, res).catch(next);
  };
}

/** Identifiant de fiche pris dans l'URL. */
function idFiche(req: Request): number {
  const id = Number.parseInt(req.params['id'] ?? '', 10);
  if (!Number.isInteger(id) || id <= 0) throw erreurRequete('Identifiant de fiche invalide.');
  return id;
}

export const routesValidation = Router();

routesValidation.use(exigeAuthentification, exigeRole('responsable'));

/** GET /api/v1/validation — file d'attente, plus anciennes en tête. */
routesValidation.get(
  '/',
  asynchrone(async (_req, res) => {
    res.status(200).json({ contributions: await file() });
  }),
);

/** GET /api/v1/validation/:id — détail, doublons potentiels et nomenclature. */
routesValidation.get(
  '/:id',
  asynchrone(async (req, res) => {
    res.status(200).json(await detail(idFiche(req)));
  }),
);

/** POST /api/v1/validation/:id/valider */
routesValidation.post(
  '/:id/valider',
  asynchrone(async (req, res) => {
    const analyse = schemaValider.safeParse(req.body ?? {});
    if (!analyse.success) throw erreurRequete('Corrections invalides.');

    await valider(idFiche(req), req.utilisateur!.id_utilisateur, analyse.data.corrections);
    res.status(204).send();
  }),
);

/**
 * POST /api/v1/validation/:id/rejeter
 * Le motif est exigé par le schéma : un rejet sans explication décourage la
 * contribution suivante. Il n'est pas encore persisté — la table `entree_sdcr`
 * n'a pas de champ pour cela (voir docs/03-decisions.md, point ouvert O11).
 */
routesValidation.post(
  '/:id/rejeter',
  asynchrone(async (req, res) => {
    const analyse = schemaRejeter.safeParse(req.body ?? {});
    if (!analyse.success) throw erreurRequete('Indiquez un motif de rejet.');

    await rejeter(idFiche(req), req.utilisateur!.id_utilisateur);
    res.status(204).send();
  }),
);

/** POST /api/v1/validation/:id/renvoyer-en-correction */
routesValidation.post(
  '/:id/renvoyer-en-correction',
  asynchrone(async (req, res) => {
    const analyse = schemaRenvoyerEnCorrection.safeParse(req.body ?? {});
    if (!analyse.success) throw erreurRequete('Indiquez ce qui doit être corrigé.');

    await renvoyerEnCorrection(idFiche(req), req.utilisateur!.id_utilisateur);
    res.status(204).send();
  }),
);

/** POST /api/v1/validation/:id/archiver */
routesValidation.post(
  '/:id/archiver',
  asynchrone(async (req, res) => {
    await archiver(idFiche(req), req.utilisateur!.id_utilisateur);
    res.status(204).send();
  }),
);

/** POST /api/v1/validation/:id/fusionner */
routesValidation.post(
  '/:id/fusionner',
  asynchrone(async (req, res) => {
    const analyse = schemaFusionnerFiches.safeParse(req.body ?? {});
    if (!analyse.success) throw erreurRequete('Fiche cible invalide.');

    await fusionner(idFiche(req), analyse.data.id_sdcr_cible, req.utilisateur!.id_utilisateur);
    res.status(204).send();
  }),
);
