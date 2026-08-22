/**
 * Test d'intégration du parcours de connexion (A1), de la requête HTTP
 * jusqu'au SQL.
 *
 * PostgreSQL est simulé en mémoire (pg-mem) : la table `utilisateur` y est
 * créée avec les colonnes et l'ENUM du dictionnaire de données, et le SQL réel
 * de db/requetes/utilisateur.ts s'y exécute. Ce test ne remplace donc pas une
 * vérification contre une vraie instance PostgreSQL — il valide la chaîne
 * route → schéma → service → SQL, pas les migrations.
 */

import express, { type Express } from 'express';
import { newDb, type IMemoryDb } from 'pg-mem';
import request from 'supertest';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

process.env['DATABASE_URL'] ??= 'postgresql://test:test@127.0.0.1:5432/test';
process.env['JWT_SECRET'] ??= 'secret-de-test-suffisamment-long-pour-passer-la-validation';

let base: IMemoryDb;
/** Pool pg fourni par l'adaptateur pg-mem — gère les paramètres $1, $2… */
let poolMemoire: { query: (texte: string, valeurs?: unknown[]) => Promise<{ rows: unknown[] }> };

// db/client.ts ouvre un vrai pool à l'import : on le remplace par pg-mem.
vi.mock('../../db/client.js', () => ({
  requete: async (texte: string, parametres: readonly unknown[] = []) => {
    const resultat = await poolMemoire.query(texte, [...parametres]);
    return resultat.rows;
  },
  verifierConnexion: async () => true,
  fermerPool: async () => undefined,
  pool: {},
}));

const { routesAuth } = await import('./routes.js');
const { gestionnaireErreurs } = await import('../../middlewares/erreurs.js');
const { hacherMotDePasse } = await import('./mots-de-passe.js');

const MOT_DE_PASSE = 'MotDePasseTerrain2026';
let empreinte: string;
let app: Express;

function creerApp(): Express {
  const application = express();
  application.use(express.json());
  application.use('/api/v1/auth', routesAuth);
  application.use(gestionnaireErreurs);
  return application;
}

beforeAll(async () => {
  empreinte = await hacherMotDePasse(MOT_DE_PASSE);
  app = creerApp();
});

beforeEach(() => {
  base = newDb();
  const { Pool } = base.adapters.createPg() as { Pool: new () => typeof poolMemoire };
  poolMemoire = new Pool();
  base.public.none(`
    create type role_utilisateur as enum ('technicien', 'responsable');
    create table utilisateur (
      id_utilisateur    integer primary key,
      nom               varchar(50)  not null,
      prenom            varchar(50)  not null,
      matricule         varchar(20)  not null unique,
      role              role_utilisateur not null,
      mot_de_passe_hash varchar(255) not null,
      actif             boolean      not null default true
    );
  `);
  base.public.none(`
    insert into utilisateur (id_utilisateur, nom, prenom, matricule, role, mot_de_passe_hash, actif)
    values
      (1, 'Mballa',   'Alain',  'TC-2841', 'technicien',  '${empreinte}', true),
      (2, 'Ngo Bell', 'Julie',  'TC-0412', 'responsable', '${empreinte}', true),
      (3, 'Ancien',   'Parti',  'TC-9999', 'technicien',  '${empreinte}', false);
  `);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('POST /api/v1/auth/connexion', () => {
  it('connecte un technicien et renvoie une session complète', async () => {
    const reponse = await request(app)
      .post('/api/v1/auth/connexion')
      .send({ matricule: 'TC-2841', mot_de_passe: MOT_DE_PASSE });

    expect(reponse.status).toBe(200);
    expect(reponse.body.utilisateur).toMatchObject({
      id_utilisateur: 1,
      matricule: 'TC-2841',
      role: 'technicien',
      prenom: 'Alain',
    });
    expect(typeof reponse.body.jeton_acces).toBe('string');
    expect(typeof reponse.body.jeton_rafraichissement).toBe('string');
    expect(new Date(reponse.body.expire_le).getTime()).toBeGreaterThan(Date.now());
  });

  it('ne renvoie JAMAIS l’empreinte du mot de passe', async () => {
    const reponse = await request(app)
      .post('/api/v1/auth/connexion')
      .send({ matricule: 'TC-2841', mot_de_passe: MOT_DE_PASSE });

    expect(JSON.stringify(reponse.body)).not.toContain('argon2');
    expect(reponse.body.utilisateur.mot_de_passe_hash).toBeUndefined();
  });

  it('accepte un matricule saisi en minuscules ou avec des espaces', async () => {
    for (const saisie of ['tc-2841', '  TC-2841 ', 'tc - 2841']) {
      const reponse = await request(app)
        .post('/api/v1/auth/connexion')
        .send({ matricule: saisie, mot_de_passe: MOT_DE_PASSE });
      expect(reponse.status, `saisie « ${saisie} »`).toBe(200);
    }
  });

  it('refuse un mot de passe faux', async () => {
    const reponse = await request(app)
      .post('/api/v1/auth/connexion')
      .send({ matricule: 'TC-2841', mot_de_passe: 'mauvais-mot-de-passe' });

    expect(reponse.status).toBe(401);
    expect(reponse.body.erreur.message).toBe('Matricule ou mot de passe incorrect.');
  });

  it('donne le MÊME message pour un matricule inconnu — pas d’oracle d’énumération', async () => {
    const inconnu = await request(app)
      .post('/api/v1/auth/connexion')
      .send({ matricule: 'TC-0000', mot_de_passe: MOT_DE_PASSE });
    const mauvaisMotDePasse = await request(app)
      .post('/api/v1/auth/connexion')
      .send({ matricule: 'TC-2841', mot_de_passe: 'mauvais-mot-de-passe' });

    expect(inconnu.status).toBe(401);
    expect(inconnu.body.erreur.message).toBe(mauvaisMotDePasse.body.erreur.message);
  });

  it('refuse un compte désactivé avec un message distinct', async () => {
    const reponse = await request(app)
      .post('/api/v1/auth/connexion')
      .send({ matricule: 'TC-9999', mot_de_passe: MOT_DE_PASSE });

    expect(reponse.status).toBe(401);
    expect(reponse.body.erreur.message).toMatch(/désactivé/);
  });

  it('refuse une requête sans corps valide, en français', async () => {
    const reponse = await request(app).post('/api/v1/auth/connexion').send({});

    expect(reponse.status).toBe(400);
    expect(reponse.body.erreur.message).toMatch(/Identifiants/);
    expect(Array.isArray(reponse.body.erreur.details)).toBe(true);
  });
});

describe('GET /api/v1/auth/moi', () => {
  async function jetonDe(matricule: string): Promise<string> {
    const reponse = await request(app)
      .post('/api/v1/auth/connexion')
      .send({ matricule, mot_de_passe: MOT_DE_PASSE });
    return reponse.body.jeton_acces as string;
  }

  it('renvoie le profil du porteur du jeton', async () => {
    const reponse = await request(app)
      .get('/api/v1/auth/moi')
      .set('authorization', `Bearer ${await jetonDe('TC-0412')}`);

    expect(reponse.status).toBe(200);
    expect(reponse.body).toMatchObject({ matricule: 'TC-0412', role: 'responsable' });
  });

  it('refuse sans en-tête d’autorisation', async () => {
    const reponse = await request(app).get('/api/v1/auth/moi');
    expect(reponse.status).toBe(401);
  });

  it('refuse un schéma d’autorisation qui n’est pas Bearer', async () => {
    const reponse = await request(app)
      .get('/api/v1/auth/moi')
      .set('authorization', `Basic ${await jetonDe('TC-2841')}`);
    expect(reponse.status).toBe(401);
  });

  it('refuse un jeton de rafraîchissement utilisé comme jeton d’accès', async () => {
    const connexion = await request(app)
      .post('/api/v1/auth/connexion')
      .send({ matricule: 'TC-2841', mot_de_passe: MOT_DE_PASSE });

    const reponse = await request(app)
      .get('/api/v1/auth/moi')
      .set('authorization', `Bearer ${connexion.body.jeton_rafraichissement}`);

    expect(reponse.status).toBe(401);
  });

  it('refuse un porteur dont le compte a été désactivé depuis l’émission du jeton', async () => {
    const jeton = await jetonDe('TC-2841');
    base.public.none('update utilisateur set actif = false where matricule = \'TC-2841\'');

    const reponse = await request(app).get('/api/v1/auth/moi').set('authorization', `Bearer ${jeton}`);
    expect(reponse.status).toBe(401);
  });
});

describe('POST /api/v1/auth/rafraichir', () => {
  it('renouvelle le jeton d’accès', async () => {
    const connexion = await request(app)
      .post('/api/v1/auth/connexion')
      .send({ matricule: 'TC-2841', mot_de_passe: MOT_DE_PASSE });

    const reponse = await request(app)
      .post('/api/v1/auth/rafraichir')
      .send({ jeton_rafraichissement: connexion.body.jeton_rafraichissement });

    expect(reponse.status).toBe(200);
    expect(typeof reponse.body.jeton_acces).toBe('string');

    const profil = await request(app)
      .get('/api/v1/auth/moi')
      .set('authorization', `Bearer ${reponse.body.jeton_acces}`);
    expect(profil.status).toBe(200);
  });

  it('refuse un jeton d’accès présenté comme jeton de rafraîchissement', async () => {
    const connexion = await request(app)
      .post('/api/v1/auth/connexion')
      .send({ matricule: 'TC-2841', mot_de_passe: MOT_DE_PASSE });

    const reponse = await request(app)
      .post('/api/v1/auth/rafraichir')
      .send({ jeton_rafraichissement: connexion.body.jeton_acces });

    expect(reponse.status).toBe(401);
  });

  it('coupe le rafraîchissement d’un compte désactivé — seul point de révocation', async () => {
    const connexion = await request(app)
      .post('/api/v1/auth/connexion')
      .send({ matricule: 'TC-2841', mot_de_passe: MOT_DE_PASSE });

    base.public.none('update utilisateur set actif = false where matricule = \'TC-2841\'');

    const reponse = await request(app)
      .post('/api/v1/auth/rafraichir')
      .send({ jeton_rafraichissement: connexion.body.jeton_rafraichissement });

    expect(reponse.status).toBe(401);
  });

  it('refuse un jeton fantaisiste', async () => {
    const reponse = await request(app)
      .post('/api/v1/auth/rafraichir')
      .send({ jeton_rafraichissement: 'pas.un.jeton' });
    expect(reponse.status).toBe(401);
  });
});
