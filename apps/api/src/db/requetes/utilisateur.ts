/** Accès à la table `utilisateur`. */

import type { Utilisateur, UtilisateurAvecSecret } from '@maintxpert/shared';
import { requete } from '../client.js';

/** Colonnes exposables — `mot_de_passe_hash` en est volontairement absent. */
const COLONNES_PUBLIQUES = 'id_utilisateur, nom, prenom, matricule, role, actif';

export async function trouverParMatricule(matricule: string): Promise<UtilisateurAvecSecret | null> {
  const lignes = await requete<UtilisateurAvecSecret>(
    `select ${COLONNES_PUBLIQUES}, mot_de_passe_hash
       from utilisateur
      where matricule = $1`,
    [matricule],
  );
  return lignes[0] ?? null;
}

export async function trouverParId(idUtilisateur: number): Promise<Utilisateur | null> {
  const lignes = await requete<Utilisateur>(
    `select ${COLONNES_PUBLIQUES}
       from utilisateur
      where id_utilisateur = $1`,
    [idUtilisateur],
  );
  return lignes[0] ?? null;
}

/** Retire le secret avant que l'objet ne franchisse la frontière de l'API. */
export function sansSecret(utilisateur: UtilisateurAvecSecret): Utilisateur {
  const { mot_de_passe_hash: _hash, ...publique } = utilisateur;
  return publique;
}
