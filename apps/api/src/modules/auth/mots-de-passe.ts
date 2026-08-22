/**
 * Hachage des mots de passe — argon2id.
 *
 * argon2id est le choix recommandé par l'OWASP : il résiste à la fois aux
 * attaques par canal auxiliaire (argon2i) et aux attaques GPU (argon2d).
 * Aucun mot de passe en clair ne quitte jamais ce fichier.
 */

import { hash, verify } from '@node-rs/argon2';

/**
 * Paramètres OWASP (« second recommended option ») : 19 MiB de mémoire,
 * 2 itérations, parallélisme 1. Tenables sur un serveur modeste tout en
 * rendant une attaque par dictionnaire coûteuse.
 *
 * L'algorithme n'est pas passé explicitement : `Algorithm` est un const enum
 * ambiant, inutilisable sous `verbatimModuleSyntax`. argon2id est le défaut de
 * @node-rs/argon2, et le test « ne stocke jamais le mot de passe en clair »
 * vérifie que l'empreinte produite commence bien par `$argon2id$` — c'est ce
 * contrôle qui fait foi, pas une constante recopiée.
 */
const PARAMETRES = {
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

export async function hacherMotDePasse(motDePasse: string): Promise<string> {
  return hash(motDePasse, PARAMETRES);
}

/**
 * Vérifie un mot de passe contre son empreinte.
 *
 * Ne lève jamais : une empreinte corrompue en base doit se traduire par un
 * refus d'authentification, pas par une erreur 500 qui révélerait au client
 * que ce compte existe et que ses données sont abîmées.
 */
export async function verifierMotDePasse(empreinte: string, motDePasse: string): Promise<boolean> {
  try {
    return await verify(empreinte, motDePasse, PARAMETRES);
  } catch {
    return false;
  }
}
