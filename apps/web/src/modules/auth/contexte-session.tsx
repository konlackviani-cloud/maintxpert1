/** A1 — contexte de session pour toute l'application. */

import type { Identifiants, Session, Utilisateur } from '@maintxpert/shared';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { purgerCache } from '../../horsligne/db.js';
import { appelerApi } from '../../lib/client-api.js';
import {
  effacerSession,
  enregistrerSession,
  lireJetonAcces,
  lireUtilisateur,
} from './stockage-session.js';

interface ValeurSession {
  utilisateur: Utilisateur | null;
  connecte: boolean;
  seConnecter: (identifiants: Identifiants) => Promise<void>;
  seDeconnecter: () => Promise<void>;
}

const ContexteSession = createContext<ValeurSession | null>(null);

export function FournisseurSession({ children }: { children: ReactNode }): JSX.Element {
  // Amorçage synchrone depuis le stockage local : au lancement hors ligne, le
  // technicien doit retrouver sa session sans que l'API soit joignable.
  const [utilisateur, setUtilisateur] = useState<Utilisateur | null>(() =>
    lireJetonAcces() ? lireUtilisateur() : null,
  );

  const seConnecter = useCallback(async (identifiants: Identifiants) => {
    const session = await appelerApi<Session>('/auth/connexion', {
      methode: 'POST',
      corps: identifiants,
      authentifie: false,
    });

    enregistrerSession(session);
    setUtilisateur(session.utilisateur);
  }, []);

  const seDeconnecter = useCallback(async () => {
    // Prévenir le serveur est facultatif ; effacer le terminal ne l'est pas.
    try {
      await appelerApi<void>('/auth/deconnexion', { methode: 'POST' });
    } catch {
      /* hors ligne ou session déjà expirée : on purge quand même */
    }

    effacerSession();
    // Exigence BYOD : aucune donnée industrielle ne subsiste après déconnexion.
    await purgerCache();
    setUtilisateur(null);
  }, []);

  const valeur = useMemo<ValeurSession>(
    () => ({ utilisateur, connecte: utilisateur !== null, seConnecter, seDeconnecter }),
    [utilisateur, seConnecter, seDeconnecter],
  );

  return <ContexteSession.Provider value={valeur}>{children}</ContexteSession.Provider>;
}

export function useSession(): ValeurSession {
  const valeur = useContext(ContexteSession);
  if (!valeur) {
    throw new Error('useSession doit être utilisé à l’intérieur de <FournisseurSession>.');
  }
  return valeur;
}
