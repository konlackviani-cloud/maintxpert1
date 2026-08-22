/** A1 — logique d'authentification. */

import {
  normaliserMatricule,
  type Identifiants,
  type Session,
  type SessionRafraichie,
  type Utilisateur,
} from '@maintxpert/shared';

import { sansSecret, trouverParId, trouverParMatricule } from '../../db/requetes/utilisateur.js';
import { erreurAuthentification } from '../../middlewares/erreurs.js';
import { emettreJetonAcces, emettreJetonRafraichissement } from './jetons.js';
import { hacherMotDePasse, verifierMotDePasse } from './mots-de-passe.js';

/**
 * Empreinte factice, hachée une fois au démarrage.
 *
 * Lorsqu'un matricule n'existe pas, on vérifie quand même le mot de passe
 * contre cette empreinte. Sans cela, une réponse instantanée signalerait
 * « ce matricule n'existe pas » et une réponse lente « il existe » : c'est un
 * oracle d'énumération des matricules. Ici les deux chemins coûtent pareil.
 */
const empreinteFactice = hacherMotDePasse('empreinte-factice-anti-enumeration');

/** Message unique : ne jamais dire lequel des deux champs est faux. */
const ECHEC = 'Matricule ou mot de passe incorrect.';

export async function connecter(identifiants: Identifiants): Promise<Session> {
  const matricule = normaliserMatricule(identifiants.matricule);
  const utilisateur = await trouverParMatricule(matricule);

  const empreinte = utilisateur?.mot_de_passe_hash ?? (await empreinteFactice);
  const motDePasseValide = await verifierMotDePasse(empreinte, identifiants.mot_de_passe);

  if (!utilisateur || !motDePasseValide) {
    throw erreurAuthentification(ECHEC);
  }

  // Compte désactivé : message distinct, car l'utilisateur existe bel et bien
  // et doit savoir qu'il faut s'adresser au responsable, pas retaper son mot
  // de passe. Contrôlé APRÈS le mot de passe pour ne rien révéler à un tiers.
  if (!utilisateur.actif) {
    throw erreurAuthentification(
      'Ce compte est désactivé. Adressez-vous au responsable maintenance.',
    );
  }

  const sujet = {
    id_utilisateur: utilisateur.id_utilisateur,
    matricule: utilisateur.matricule,
    role: utilisateur.role,
  };

  const [acces, rafraichissement] = await Promise.all([
    emettreJetonAcces(sujet),
    emettreJetonRafraichissement(sujet),
  ]);

  return {
    utilisateur: sansSecret(utilisateur),
    jeton_acces: acces.jeton,
    jeton_rafraichissement: rafraichissement.jeton,
    expire_le: acces.expire_le,
  };
}

/**
 * Renouvelle le jeton d'accès à partir d'un jeton de rafraîchissement déjà
 * vérifié par le contrôleur.
 *
 * C'est le seul point de révocation du système : `actif` est relu en base à
 * chaque rafraîchissement. Désactiver un compte coupe donc l'accès au plus
 * tard à l'expiration du jeton d'accès en cours (8 h).
 */
export async function rafraichir(idUtilisateur: number): Promise<SessionRafraichie> {
  const utilisateur = await trouverParId(idUtilisateur);

  if (!utilisateur || !utilisateur.actif) {
    throw erreurAuthentification('Session invalide. Reconnectez-vous.');
  }

  const acces = await emettreJetonAcces({
    id_utilisateur: utilisateur.id_utilisateur,
    matricule: utilisateur.matricule,
    role: utilisateur.role,
  });

  return { jeton_acces: acces.jeton, expire_le: acces.expire_le };
}

/** Profil de l'utilisateur porteur du jeton (A1 — « qui suis-je »). */
export async function lireProfil(idUtilisateur: number): Promise<Utilisateur> {
  const utilisateur = await trouverParId(idUtilisateur);

  if (!utilisateur || !utilisateur.actif) {
    throw erreurAuthentification('Session invalide. Reconnectez-vous.');
  }

  return utilisateur;
}
