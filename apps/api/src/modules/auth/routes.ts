/** A1 — routes d'authentification. */

import { schemaIdentifiants, schemaRafraichissement } from '@maintxpert/shared';
import { Router, type NextFunction, type Request, type Response } from 'express';

import { exigeAuthentification } from '../../middlewares/auth-jwt.js';
import { erreurAuthentification, erreurRequete } from '../../middlewares/erreurs.js';
import { ErreurJeton, verifierJeton } from './jetons.js';
import { connecter, lireProfil, rafraichir } from './service.js';

/** Enveloppe un gestionnaire asynchrone pour que ses rejets atteignent le middleware d'erreurs. */
function asynchrone(
  gestionnaire: (req: Request, res: Response) => Promise<void>,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    gestionnaire(req, res).catch(next);
  };
}

export const routesAuth = Router();

/** POST /api/v1/auth/connexion */
routesAuth.post(
  '/connexion',
  asynchrone(async (req, res) => {
    const analyse = schemaIdentifiants.safeParse(req.body);

    if (!analyse.success) {
      throw erreurRequete(
        'Identifiants incomplets ou invalides.',
        analyse.error.issues.map((i) => ({ champ: i.path.join('.'), message: i.message })),
      );
    }

    const session = await connecter(analyse.data);
    res.status(200).json(session);
  }),
);

/** POST /api/v1/auth/rafraichir */
routesAuth.post(
  '/rafraichir',
  asynchrone(async (req, res) => {
    const analyse = schemaRafraichissement.safeParse(req.body);

    if (!analyse.success) {
      throw erreurAuthentification('Jeton de rafraîchissement manquant.');
    }

    let idUtilisateur: number;
    try {
      const charge = await verifierJeton(analyse.data.jeton_rafraichissement, 'rafraichissement');
      idUtilisateur = charge.sub;
    } catch (erreur) {
      throw erreur instanceof ErreurJeton
        ? erreurAuthentification(erreur.message)
        : erreurAuthentification('Session invalide. Reconnectez-vous.');
    }

    res.status(200).json(await rafraichir(idUtilisateur));
  }),
);

/** GET /api/v1/auth/moi */
routesAuth.get(
  '/moi',
  exigeAuthentification,
  asynchrone(async (req, res) => {
    res.status(200).json(await lireProfil(req.utilisateur!.id_utilisateur));
  }),
);

/**
 * POST /api/v1/auth/deconnexion
 *
 * Les jetons sont sans état : il n'y a rien à révoquer côté serveur. La
 * déconnexion réelle a lieu sur le terminal — purge du cache IndexedDB et
 * effacement des jetons — ce qui répond à l'exigence BYOD. Cette route existe
 * pour que le front dispose d'un point d'appel unique, et pour tracer l'usage.
 */
routesAuth.post('/deconnexion', exigeAuthentification, (_req, res) => {
  res.status(204).send();
});
