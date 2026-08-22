/** Gardes de route — accès selon la session et le rôle. */

import type { RoleUtilisateur } from '@maintxpert/shared';
import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';

import { useSession } from '../modules/auth/contexte-session.js';

/** Route réservée aux utilisateurs connectés. */
export function ExigeSession({ children }: { children: ReactNode }): JSX.Element {
  const { connecte } = useSession();
  return connecte ? <>{children}</> : <Navigate to="/connexion" replace />;
}

/**
 * Route réservée à un rôle. Un seul rôle actif par utilisateur en v1.0.
 * Un utilisateur du mauvais rôle est renvoyé vers son propre accueil, pas
 * vers une page d'erreur : il n'a rien fait de mal, il s'est juste égaré.
 */
export function ExigeRole({
  role,
  children,
}: {
  role: RoleUtilisateur;
  children: ReactNode;
}): JSX.Element {
  const { connecte, utilisateur } = useSession();

  if (!connecte) return <Navigate to="/connexion" replace />;
  if (utilisateur?.role !== role) return <Navigate to={accueilDuRole(utilisateur?.role)} replace />;

  return <>{children}</>;
}

export function accueilDuRole(role: RoleUtilisateur | undefined): string {
  return role === 'responsable' ? '/pilotage' : '/diagnostic';
}

/** Empêche un utilisateur déjà connecté de revoir l'écran de connexion. */
export function RedirigeSiConnecte({ children }: { children: ReactNode }): JSX.Element {
  const { connecte, utilisateur } = useSession();
  return connecte ? <Navigate to={accueilDuRole(utilisateur?.role)} replace /> : <>{children}</>;
}
