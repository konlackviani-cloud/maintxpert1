/** A1 — authentification et gestion de session. */

import type { RoleUtilisateur } from './enums.js';
import type { Utilisateur } from './entites.js';

/** Deux natures de jeton, signées avec le même secret mais jamais interchangeables. */
export type TypeJeton = 'acces' | 'rafraichissement';

/**
 * Charge utile d'un JWT MaintXpert.
 * `sub` porte l'identifiant utilisateur, conformément à l'usage JWT.
 */
export interface ChargeJeton {
  sub: number;
  matricule: string;
  role: RoleUtilisateur;
  type: TypeJeton;
  /** Émis le / expire le — secondes depuis l'époque Unix. */
  iat: number;
  exp: number;
}

/** Ce que le technicien saisit à l'écran de connexion. */
export interface Identifiants {
  matricule: string;
  mot_de_passe: string;
}

/** Réponse de l'API à une connexion réussie. */
export interface Session {
  utilisateur: Utilisateur;
  jeton_acces: string;
  jeton_rafraichissement: string;
  /** Expiration du jeton d'accès, en ISO 8601 — permet au front d'anticiper. */
  expire_le: string;
}

/** Réponse à un rafraîchissement : seul le jeton d'accès est renouvelé. */
export interface SessionRafraichie {
  jeton_acces: string;
  expire_le: string;
}
