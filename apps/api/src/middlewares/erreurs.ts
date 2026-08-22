/**
 * Traitement centralisé des erreurs.
 * Toute réponse d'erreur suit la même forme et reste en français : elle est
 * susceptible d'être affichée telle quelle au technicien sur le terrain.
 */

import type { NextFunction, Request, Response } from 'express';
import { enProduction } from '../config/env.js';

export class ErreurHttp extends Error {
  constructor(
    public readonly statut: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ErreurHttp';
  }
}

export const erreurRequete = (message: string, details?: unknown) =>
  new ErreurHttp(400, message, details);
export const erreurAuthentification = (message = 'Authentification requise.') =>
  new ErreurHttp(401, message);
export const erreurInterdit = (message = 'Action non autorisée pour votre rôle.') =>
  new ErreurHttp(403, message);
export const erreurIntrouvable = (message = 'Ressource introuvable.') =>
  new ErreurHttp(404, message);
export const erreurConflit = (message: string, details?: unknown) =>
  new ErreurHttp(409, message, details);

/** Route inconnue. Déclaré après toutes les routes. */
export function routeIntrouvable(req: Request, _res: Response, next: NextFunction): void {
  next(erreurIntrouvable(`Route inconnue : ${req.method} ${req.originalUrl}`));
}

export interface CorpsErreur {
  erreur: { message: string; statut: number; details?: unknown };
}

export function gestionnaireErreurs(
  erreur: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const estConnue = erreur instanceof ErreurHttp;
  const statut = estConnue ? erreur.statut : 500;

  // Les erreurs 5xx sont journalisées : ce sont des défauts de l'application.
  if (statut >= 500) {
    console.error('[api] erreur non gérée :', erreur);
  }

  const message = estConnue
    ? erreur.message
    : enProduction
      ? 'Une erreur interne est survenue.'
      : erreur instanceof Error
        ? erreur.message
        : 'Erreur inconnue.';

  const corps: CorpsErreur = { erreur: { message, statut } };
  if (estConnue && erreur.details !== undefined) {
    corps.erreur.details = erreur.details;
  }

  res.status(statut).json(corps);
}
