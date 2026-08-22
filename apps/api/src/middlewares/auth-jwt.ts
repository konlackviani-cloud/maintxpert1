/**
 * Middlewares d'authentification et d'autorisation.
 *
 * `exigeAuthentification` ne touche pas la base : il se contente de vérifier
 * la signature du jeton. Le contrôle de `actif` a lieu au rafraîchissement
 * (voir service.ts) — c'est le compromis assumé entre coût par requête et
 * délai de révocation.
 */

import type { RoleUtilisateur } from '@maintxpert/shared';
import type { NextFunction, Request, Response } from 'express';

import { erreurAuthentification, erreurInterdit } from './erreurs.js';
import { ErreurJeton, verifierJeton } from '../modules/auth/jetons.js';

export interface UtilisateurRequete {
  id_utilisateur: number;
  matricule: string;
  role: RoleUtilisateur;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      utilisateur?: UtilisateurRequete;
    }
  }
}

function lireJetonPorteur(req: Request): string | null {
  const entete = req.header('authorization');
  if (!entete) return null;

  const [schema, jeton] = entete.split(' ');
  if (schema?.toLowerCase() !== 'bearer' || !jeton) return null;

  return jeton;
}

export async function exigeAuthentification(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const jeton = lireJetonPorteur(req);

  if (!jeton) {
    next(erreurAuthentification('Authentification requise.'));
    return;
  }

  try {
    const charge = await verifierJeton(jeton, 'acces');
    req.utilisateur = {
      id_utilisateur: charge.sub,
      matricule: charge.matricule,
      role: charge.role,
    };
    next();
  } catch (erreur) {
    next(
      erreur instanceof ErreurJeton
        ? erreurAuthentification(erreur.message)
        : erreurAuthentification('Session invalide. Reconnectez-vous.'),
    );
  }
}

/**
 * Restreint une route à un rôle. À déclarer APRÈS `exigeAuthentification`.
 * Un seul rôle actif par utilisateur en v1.0 — pas de multi-rôle.
 */
export function exigeRole(role: RoleUtilisateur) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.utilisateur) {
      next(erreurAuthentification('Authentification requise.'));
      return;
    }

    if (req.utilisateur.role !== role) {
      next(
        erreurInterdit(
          role === 'responsable'
            ? 'Cette action est réservée au responsable maintenance.'
            : 'Cette action est réservée aux techniciens.',
        ),
      );
      return;
    }

    next();
  };
}
