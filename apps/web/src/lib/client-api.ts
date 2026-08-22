/**
 * Client HTTP de l'API.
 *
 * Rappel d'architecture : ce client n'est sollicité QUE par la synchronisation
 * et l'authentification. Aucun écran de consultation ne doit en dépendre — la
 * consultation lit le cache IndexedDB. Si un futur écran appelle ce module
 * pour afficher des données, c'est que la règle « hors ligne d'abord » vient
 * d'être enfreinte.
 */

import {
  effacerSession,
  jetonExpire,
  lireJetonAcces,
  lireJetonRafraichissement,
  majJetonAcces,
} from '../modules/auth/stockage-session.js';

const BASE = '/api/v1';

export class ErreurApi extends Error {
  constructor(
    public readonly statut: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ErreurApi';
  }
}

/** Levée quand la requête n'a jamais atteint le serveur — hors ligne, DNS, timeout. */
export class ErreurReseau extends Error {
  constructor(message = 'Aucune connexion au serveur. Vos saisies seront envoyées plus tard.') {
    super(message);
    this.name = 'ErreurReseau';
  }
}

interface CorpsErreurApi {
  erreur?: { message?: string; details?: unknown };
}

/**
 * Message de repli quand la réponse ne porte pas de message exploitable.
 *
 * Le cas arrive pour de bon : quand l'API est arrêtée, le proxy de
 * développement renvoie une 500 en HTML, et un technicien n'a rien à faire
 * d'un « Erreur 500 ». Chaque classe de statut reçoit une phrase qui dit quoi
 * faire.
 */
function messageParDefaut(statut: number): string {
  if (statut >= 500) return 'Le serveur ne répond pas correctement. Réessayez dans un instant.';
  if (statut === 404) return 'Ressource introuvable.';
  if (statut === 403) return 'Action non autorisée pour votre rôle.';
  if (statut === 401) return 'Session expirée. Reconnectez-vous.';
  return 'La demande n’a pas pu être traitée.';
}

async function lireErreur(reponse: Response): Promise<ErreurApi> {
  let message = messageParDefaut(reponse.status);
  let details: unknown;

  try {
    const corps = (await reponse.json()) as CorpsErreurApi;
    if (corps.erreur?.message) message = corps.erreur.message;
    details = corps.erreur?.details;
  } catch {
    /* réponse sans corps JSON (proxy, passerelle, HTML d'erreur) : repli ci-dessus */
  }

  return new ErreurApi(reponse.status, message, details);
}

interface Options {
  methode?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  corps?: unknown;
  /** `false` pour les routes publiques (connexion, santé). */
  authentifie?: boolean;
  delaiMs?: number;
}

/** Renouvelle le jeton d'accès. `false` si le rafraîchissement a échoué. */
async function tenterRafraichissement(): Promise<boolean> {
  const jetonRafraichissement = lireJetonRafraichissement();
  if (!jetonRafraichissement) return false;

  try {
    const reponse = await fetch(`${BASE}/auth/rafraichir`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jeton_rafraichissement: jetonRafraichissement }),
    });

    if (!reponse.ok) return false;

    const { jeton_acces, expire_le } = (await reponse.json()) as {
      jeton_acces: string;
      expire_le: string;
    };
    majJetonAcces(jeton_acces, expire_le);
    return true;
  } catch {
    return false;
  }
}

export async function appelerApi<T>(chemin: string, options: Options = {}): Promise<T> {
  const { methode = 'GET', corps, authentifie = true, delaiMs = 15_000 } = options;

  // Rafraîchissement préventif : évite un aller-retour 401 systématique en
  // début de quart, quand le jeton de la veille vient d'expirer.
  if (authentifie && jetonExpire()) {
    await tenterRafraichissement();
  }

  const envoyer = async (): Promise<Response> => {
    const abandon = new AbortController();
    const minuterie = setTimeout(() => abandon.abort(), delaiMs);

    const entetes: Record<string, string> = {};
    if (corps !== undefined) entetes['content-type'] = 'application/json';

    if (authentifie) {
      const jeton = lireJetonAcces();
      if (jeton) entetes['authorization'] = `Bearer ${jeton}`;
    }

    try {
      return await fetch(`${BASE}${chemin}`, {
        method: methode,
        headers: entetes,
        body: corps === undefined ? undefined : JSON.stringify(corps),
        signal: abandon.signal,
      });
    } finally {
      clearTimeout(minuterie);
    }
  };

  let reponse: Response;
  try {
    reponse = await envoyer();
  } catch {
    throw new ErreurReseau();
  }

  // Une seule nouvelle tentative après rafraîchissement, jamais de boucle.
  if (reponse.status === 401 && authentifie) {
    if (await tenterRafraichissement()) {
      try {
        reponse = await envoyer();
      } catch {
        throw new ErreurReseau();
      }
    }

    if (reponse.status === 401) {
      effacerSession();
      throw new ErreurApi(401, 'Session expirée. Reconnectez-vous.');
    }
  }

  if (!reponse.ok) throw await lireErreur(reponse);

  if (reponse.status === 204) return undefined as T;
  return (await reponse.json()) as T;
}
