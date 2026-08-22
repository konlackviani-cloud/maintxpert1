/**
 * Émission et vérification des JWT.
 *
 * Deux natures de jeton signées avec le même secret, distinguées par le champ
 * `type` : un jeton de rafraîchissement présenté comme jeton d'accès est
 * rejeté, et réciproquement. Sans cette vérification, le jeton de
 * rafraîchissement (7 jours) vaudrait jeton d'accès pendant 7 jours.
 */

import {
  DUREE_JETON_ACCES_SECONDES,
  DUREE_JETON_RAFRAICHISSEMENT_SECONDES,
  type ChargeJeton,
  type RoleUtilisateur,
  type TypeJeton,
} from '@maintxpert/shared';
import { SignJWT, jwtVerify } from 'jose';
import { env } from '../../config/env.js';

const ALGORITHME = 'HS256';
const EMETTEUR = 'maintxpert-api';
const AUDIENCE = 'maintxpert-pwa';

const secret = new TextEncoder().encode(env.JWT_SECRET);

export interface SujetJeton {
  id_utilisateur: number;
  matricule: string;
  role: RoleUtilisateur;
}

export interface JetonEmis {
  jeton: string;
  /** Instant d'expiration, en ISO 8601. */
  expire_le: string;
}

async function emettre(sujet: SujetJeton, type: TypeJeton, dureeSecondes: number): Promise<JetonEmis> {
  const maintenant = Math.floor(Date.now() / 1000);
  const expiration = maintenant + dureeSecondes;

  const jeton = await new SignJWT({ matricule: sujet.matricule, role: sujet.role, type })
    .setProtectedHeader({ alg: ALGORITHME })
    .setSubject(String(sujet.id_utilisateur))
    .setIssuer(EMETTEUR)
    .setAudience(AUDIENCE)
    .setIssuedAt(maintenant)
    .setExpirationTime(expiration)
    .sign(secret);

  return { jeton, expire_le: new Date(expiration * 1000).toISOString() };
}

export function emettreJetonAcces(sujet: SujetJeton): Promise<JetonEmis> {
  return emettre(sujet, 'acces', DUREE_JETON_ACCES_SECONDES);
}

export function emettreJetonRafraichissement(sujet: SujetJeton): Promise<JetonEmis> {
  return emettre(sujet, 'rafraichissement', DUREE_JETON_RAFRAICHISSEMENT_SECONDES);
}

/** Levée lorsqu'un jeton est absent, expiré, mal signé ou du mauvais type. */
export class ErreurJeton extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ErreurJeton';
  }
}

/**
 * Vérifie signature, émetteur, audience, expiration ET type attendu.
 * @throws {ErreurJeton} avec un message affichable, jamais le détail cryptographique.
 */
export async function verifierJeton(jeton: string, typeAttendu: TypeJeton): Promise<ChargeJeton> {
  let charge: Record<string, unknown>;
  try {
    const resultat = await jwtVerify(jeton, secret, {
      algorithms: [ALGORITHME],
      issuer: EMETTEUR,
      audience: AUDIENCE,
    });
    charge = resultat.payload as Record<string, unknown>;
  } catch {
    throw new ErreurJeton('Session expirée ou invalide. Reconnectez-vous.');
  }

  if (charge['type'] !== typeAttendu) {
    throw new ErreurJeton('Session invalide. Reconnectez-vous.');
  }

  const sub = Number.parseInt(String(charge['sub']), 10);
  if (!Number.isInteger(sub)) {
    throw new ErreurJeton('Session invalide. Reconnectez-vous.');
  }

  return {
    sub,
    matricule: String(charge['matricule']),
    role: charge['role'] as RoleUtilisateur,
    type: typeAttendu,
    iat: Number(charge['iat']),
    exp: Number(charge['exp']),
  };
}
