/**
 * Persistance de la session sur le terminal.
 *
 * Choix BYOD : les jetons vivent dans `localStorage`, pas dans un cookie.
 * Le terminal du technicien est un appareil personnel partagé entre quarts ;
 * il faut pouvoir tout effacer d'un geste à la déconnexion — ce que
 * `purgerSession()` fait, en même temps que le cache IndexedDB.
 *
 * Conséquence assumée : une faille XSS dans la PWA donnerait accès aux jetons.
 * Le risque est contenu par l'expiration (8 h) et par l'absence de contenu
 * tiers dans l'application.
 */

import type { Session, Utilisateur } from '@maintxpert/shared';

const CLE_ACCES = 'maintxpert.jeton_acces';
const CLE_RAFRAICHISSEMENT = 'maintxpert.jeton_rafraichissement';
const CLE_EXPIRATION = 'maintxpert.expire_le';
const CLE_UTILISATEUR = 'maintxpert.utilisateur';

function lire(cle: string): string | null {
  try {
    return localStorage.getItem(cle);
  } catch {
    // Mode navigation privée ou stockage saturé.
    return null;
  }
}

function ecrire(cle: string, valeur: string): void {
  try {
    localStorage.setItem(cle, valeur);
  } catch {
    console.warn('[session] stockage local indisponible — la session ne survivra pas au rechargement.');
  }
}

export function enregistrerSession(session: Session): void {
  ecrire(CLE_ACCES, session.jeton_acces);
  ecrire(CLE_RAFRAICHISSEMENT, session.jeton_rafraichissement);
  ecrire(CLE_EXPIRATION, session.expire_le);
  ecrire(CLE_UTILISATEUR, JSON.stringify(session.utilisateur));
}

export function majJetonAcces(jeton: string, expireLe: string): void {
  ecrire(CLE_ACCES, jeton);
  ecrire(CLE_EXPIRATION, expireLe);
}

export const lireJetonAcces = (): string | null => lire(CLE_ACCES);
export const lireJetonRafraichissement = (): string | null => lire(CLE_RAFRAICHISSEMENT);

export function lireUtilisateur(): Utilisateur | null {
  const brut = lire(CLE_UTILISATEUR);
  if (!brut) return null;
  try {
    return JSON.parse(brut) as Utilisateur;
  } catch {
    return null;
  }
}

/**
 * Le jeton d'accès est-il expiré ?
 * Marge de 60 s pour éviter d'envoyer une requête avec un jeton qui expirera
 * pendant son trajet.
 */
export function jetonExpire(): boolean {
  const expireLe = lire(CLE_EXPIRATION);
  if (!expireLe) return true;
  return new Date(expireLe).getTime() - 60_000 <= Date.now();
}

export function effacerSession(): void {
  for (const cle of [CLE_ACCES, CLE_RAFRAICHISSEMENT, CLE_EXPIRATION, CLE_UTILISATEUR]) {
    try {
      localStorage.removeItem(cle);
    } catch {
      /* rien à faire : le stockage est déjà inaccessible */
    }
  }
}
