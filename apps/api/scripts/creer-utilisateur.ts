/**
 * Création d'un compte utilisateur.
 *
 * La v1.0 n'a pas de rôle Administrateur (hors périmètre). Ce script est donc
 * le seul point de création de comptes — et il existe précisément pour qu'on
 * n'écrive jamais un INSERT avec un mot de passe en clair.
 *
 *   npm run creer-utilisateur -- --matricule TC-2841 --nom Mballa --prenom Alain \
 *                                --role technicien --mot-de-passe "…"
 *
 * Sans --mot-de-passe, un mot de passe aléatoire est généré et affiché une
 * seule fois : à transmettre à l'intéressé, qui n'aura pas d'autre occasion
 * de le lire.
 */

import { randomBytes } from 'node:crypto';
import { parseArgs } from 'node:util';

import { ROLES, normaliserMatricule, validerMatricule, validerMotDePasse } from '@maintxpert/shared';
import type { RoleUtilisateur } from '@maintxpert/shared';

import { fermerPool, requete } from '../src/db/client.js';
import { hacherMotDePasse } from '../src/modules/auth/mots-de-passe.js';

function echouer(message: string): never {
  console.error(`\n  ✖ ${message}\n`);
  process.exit(1);
}

/** Mot de passe généré : 16 caractères base64url, sans ambiguïté de saisie. */
function genererMotDePasse(): string {
  return randomBytes(12).toString('base64url');
}

async function principal(): Promise<void> {
  const { values } = parseArgs({
    options: {
      matricule: { type: 'string' },
      nom: { type: 'string' },
      prenom: { type: 'string' },
      role: { type: 'string' },
      'mot-de-passe': { type: 'string' },
    },
    allowPositionals: false,
  });

  if (!values.matricule || !values.nom || !values.prenom || !values.role) {
    echouer(
      'Arguments manquants.\n' +
        '    Usage : npm run creer-utilisateur -- --matricule TC-2841 --nom Mballa \\\n' +
        '                                          --prenom Alain --role technicien',
    );
  }

  const matricule = normaliserMatricule(values.matricule);
  const validationMatricule = validerMatricule(matricule);
  if (!validationMatricule.valide) echouer(validationMatricule.motif ?? 'Matricule invalide.');

  if (!ROLES.includes(values.role as RoleUtilisateur)) {
    echouer(`Rôle inconnu : « ${values.role} ». Valeurs admises : ${ROLES.join(', ')}.`);
  }
  const role = values.role as RoleUtilisateur;

  const motDePasseFourni = values['mot-de-passe'];
  const motDePasse = motDePasseFourni ?? genererMotDePasse();

  const validationMotDePasse = validerMotDePasse(motDePasse);
  if (!validationMotDePasse.valide) echouer(validationMotDePasse.motif ?? 'Mot de passe invalide.');

  const existant = await requete<{ id_utilisateur: number }>(
    'select id_utilisateur from utilisateur where matricule = $1',
    [matricule],
  );
  if (existant.length > 0) {
    echouer(`Le matricule ${matricule} est déjà attribué (id ${existant[0]?.id_utilisateur}).`);
  }

  const empreinte = await hacherMotDePasse(motDePasse);

  const [cree] = await requete<{ id_utilisateur: number }>(
    `insert into utilisateur (nom, prenom, matricule, role, mot_de_passe_hash, actif)
     values ($1, $2, $3, $4, $5, true)
     returning id_utilisateur`,
    [values.nom, values.prenom, matricule, role, empreinte],
  );

  console.log(`\n  ✔ Compte créé — id ${cree?.id_utilisateur}`);
  console.log(`    Matricule : ${matricule}`);
  console.log(`    Nom       : ${values.prenom} ${values.nom}`);
  console.log(`    Rôle      : ${role}`);

  if (!motDePasseFourni) {
    console.log(`\n    Mot de passe généré : ${motDePasse}`);
    console.log('    Transmettez-le maintenant : il n’est stocké que sous forme hachée');
    console.log('    et ne pourra plus être relu.\n');
  } else {
    console.log('');
  }
}

principal()
  .catch((erreur: unknown) => {
    console.error(`\n  ✖ ${erreur instanceof Error ? erreur.message : String(erreur)}\n`);
    process.exitCode = 1;
  })
  .finally(() => fermerPool());
