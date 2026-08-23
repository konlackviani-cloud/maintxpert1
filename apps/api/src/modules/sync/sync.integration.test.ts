/**
 * Test d'intégration du moteur de synchronisation, de la mutation au SQL.
 *
 * PostgreSQL simulé en mémoire (pg-mem). Ce qui est vérifié ici est ce qui
 * casse la base si c'est faux : l'idempotence du rejeu, l'horodatage terrain
 * des jalons, et l'ordre à l'intérieur d'un lot.
 */

import { newDb, type IMemoryDb } from 'pg-mem';
import { beforeEach, describe, expect, it, vi } from 'vitest';

process.env['DATABASE_URL'] ??= 'postgresql://test:test@127.0.0.1:5432/test';
process.env['JWT_SECRET'] ??= 'secret-de-test-suffisamment-long-pour-passer-la-validation';

let base: IMemoryDb;
let poolMemoire: { query: (texte: string, valeurs?: unknown[]) => Promise<{ rows: unknown[] }> };

vi.mock('../../db/client.js', () => ({
  requete: async (texte: string, parametres: readonly unknown[] = []) => {
    const resultat = await poolMemoire.query(texte, [...parametres]);
    return resultat.rows;
  },
  verifierConnexion: async () => true,
  fermerPool: async () => undefined,
  pool: {},
}));

const { appliquerLot, construireInstantane } = await import('./service.js');

const TECHNICIEN = 1;
const T1 = '2026-08-20T22:14:00.000Z';
const T1_5 = '2026-08-20T22:20:00.000Z';
const T2 = '2026-08-20T22:41:00.000Z';

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

beforeEach(() => {
  base = newDb();
  const { Pool } = base.adapters.createPg() as { Pool: new () => typeof poolMemoire };
  poolMemoire = new Pool();

  base.public.none(`
    create type role_utilisateur as enum ('technicien', 'responsable');
    create type statut_sdcr as enum ('en_attente','validee','rejetee','en_correction','archivee');
    create type type_terme as enum ('symptome','defaut','cause','remede');
    create type statut_terme as enum ('actif','archive');

    create table utilisateur (
      id_utilisateur integer primary key, nom varchar(50) not null, prenom varchar(50) not null,
      matricule varchar(20) not null unique, role role_utilisateur not null,
      mot_de_passe_hash varchar(255) not null, actif boolean not null default true);

    create table equipement (
      id_equipement integer primary key, nom varchar(100) not null,
      famille varchar(100) not null, chaine varchar(20) not null);

    create table terme_nomenclature (
      id_terme integer primary key, libelle varchar(150) not null, type type_terme not null,
      id_equipement integer not null, statut statut_terme not null default 'actif',
      compteur_usage integer not null default 0, categorie_afnor varchar(100));

    create table entree_sdcr (
      id_sdcr serial primary key, id_equipement integer not null,
      id_terme_symptome integer, symptome varchar(150) not null,
      id_terme_defaut integer, defaut varchar(150) not null,
      id_terme_cause integer, cause varchar(150) not null,
      id_terme_remede integer, remede varchar(150) not null,
      frequence_observee integer not null default 1, via_nomenclature boolean not null default true,
      statut statut_sdcr not null default 'en_attente', photo_url varchar(255),
      id_contributeur integer not null, id_valideur integer,
      date_creation timestamptz not null default now(),
      date_modification timestamptz not null default now());

    create table intervention (
      id_intervention serial primary key, id_technicien integer not null,
      id_equipement integer not null, id_sdcr integer,
      datetime_ouverture timestamptz not null default now(),
      datetime_cause_confirmee timestamptz, datetime_cloture timestamptz);

    create table configuration (cle varchar(50) primary key, valeur varchar(255) not null, description text not null);

    create table mode_amdec (
      id_mode serial primary key, id_equipement integer not null,
      composant varchar(150) not null, mode_defaillance varchar(150) not null,
      cause varchar(150) not null, effet varchar(150) not null,
      gravite integer not null, frequence integer not null, detection integer not null,
      ipr integer not null default 0);

    create table fiche_csd (
      id_csd serial primary key, id_equipement integer not null unique,
      description text not null, photo_url varchar(255));

    create table mutation_appliquee (
      id_local uuid primary key, type varchar(60) not null, id_utilisateur integer not null,
      resultat jsonb, applique_le timestamptz not null default now());
  `);

  base.public.none(`
    insert into utilisateur values (1,'Mballa','Alain','TC-2841','technicien','x',true);
    insert into equipement values (10,'Soutireuse-boucheuse','Remplissage','CH02');
    insert into terme_nomenclature values (100,'Arrêt intempestif','symptome',10,'actif',5,null);
    insert into terme_nomenclature values (101,'Capteur encrassé','defaut',10,'actif',3,null);
    insert into terme_nomenclature values (102,'Nettoyage non fait','cause',10,'actif',3,null);
    insert into terme_nomenclature values (103,'Nettoyer le capteur','remede',10,'actif',3,null);
    insert into configuration values ('seuil_recurrence','3','seuil');
    insert into fiche_csd (id_equipement, description, photo_url)
      values (10, 'Pression de soutirage 2,4 bar. Seuil capteur 65 %.', 'photo-ref.webp');
    insert into entree_sdcr (id_equipement, symptome, defaut, cause, remede,
                             frequence_observee, via_nomenclature, statut, id_contributeur, id_valideur)
      values (10,'Arrêt intempestif','Capteur encrassé','Nettoyage non fait','Nettoyer le capteur',
              4,true,'validee',1,2);
    insert into entree_sdcr (id_equipement, symptome, defaut, cause, remede,
                             frequence_observee, via_nomenclature, statut, id_contributeur)
      values (10,'Arrêt intempestif','Vérin grippé','Graissage','Graisser',
              1,true,'en_attente',1);
  `);
});

const lire = (sql: string): Record<string, unknown>[] =>
  base.public.many(sql) as Record<string, unknown>[];

describe('jalons d’intervention', () => {
  it('enregistre T1, T1.5 et T2 à l’horodatage TERRAIN, pas à celui de l’envoi', async () => {
    const resultats = await appliquerLot(
      [
        {
          id_local: uuid(1),
          type: 'ouvrir_intervention',
          charge: { id_equipement: 10, id_sdcr: null },
          horodatage_terrain: T1,
        },
        {
          id_local: uuid(2),
          type: 'confirmer_cause_intervention',
          charge: { id_local_intervention: uuid(1), id_sdcr: 1 },
          horodatage_terrain: T1_5,
        },
        {
          id_local: uuid(3),
          type: 'cloturer_intervention',
          charge: { id_local_intervention: uuid(1) },
          horodatage_terrain: T2,
        },
      ],
      TECHNICIEN,
    );

    expect(resultats.map((r) => r.statut)).toEqual(['applique', 'applique', 'applique']);

    const [intervention] = lire('select * from intervention');
    expect(new Date(intervention!['datetime_ouverture'] as string).toISOString()).toBe(T1);
    expect(new Date(intervention!['datetime_cause_confirmee'] as string).toISOString()).toBe(T1_5);
    expect(new Date(intervention!['datetime_cloture'] as string).toISOString()).toBe(T2);
    // TTDi = 6 min, exactement l'écart des gestes du technicien.
    const ttdi =
      (new Date(intervention!['datetime_cause_confirmee'] as string).getTime() -
        new Date(intervention!['datetime_ouverture'] as string).getTime()) /
      60000;
    expect(ttdi).toBe(6);
  });

  it('résout une intervention ouverte lors d’un lot PRÉCÉDENT', async () => {
    await appliquerLot(
      [
        {
          id_local: uuid(1),
          type: 'ouvrir_intervention',
          charge: { id_equipement: 10, id_sdcr: null },
          horodatage_terrain: T1,
        },
      ],
      TECHNICIEN,
    );

    const [resultat] = await appliquerLot(
      [
        {
          id_local: uuid(2),
          type: 'cloturer_intervention',
          charge: { id_local_intervention: uuid(1) },
          horodatage_terrain: T2,
        },
      ],
      TECHNICIEN,
    );

    expect(resultat!.statut).toBe('applique');
    expect(lire('select * from intervention')[0]!['datetime_cloture']).not.toBeNull();
  });

  it('refuse un jalon dont l’intervention est inconnue, sans planter le lot', async () => {
    const [resultat] = await appliquerLot(
      [
        {
          id_local: uuid(9),
          type: 'cloturer_intervention',
          charge: { id_local_intervention: uuid(8) },
          horodatage_terrain: T2,
        },
      ],
      TECHNICIEN,
    );

    expect(resultat!.statut).toBe('refuse');
    expect(resultat!.motif).toMatch(/introuvable/);
  });
});

describe('idempotence', () => {
  it('ne rejoue pas une confirmation de cause — la fréquence n’est incrémentée qu’une fois', async () => {
    const mutation = {
      id_local: uuid(20),
      type: 'confirmer_cause' as const,
      charge: { id_sdcr: 1 },
      horodatage_terrain: T1_5,
    };

    const premier = await appliquerLot([mutation], TECHNICIEN);
    expect(premier[0]!.statut).toBe('applique');
    expect(lire('select frequence_observee from entree_sdcr where id_sdcr = 1')[0]!['frequence_observee']).toBe(5);

    // Rejeu : réseau coupé après traitement, le terminal renvoie le même lot.
    const second = await appliquerLot([mutation], TECHNICIEN);
    expect(second[0]!.statut).toBe('deja_applique');
    expect(lire('select frequence_observee from entree_sdcr where id_sdcr = 1')[0]!['frequence_observee']).toBe(5);
  });

  it('ne crée pas deux fiches pour un même id_local rejoué', async () => {
    const mutation = {
      id_local: uuid(21),
      type: 'creer_entree_sdcr' as const,
      charge: {
        id_equipement: 10,
        id_terme_symptome: 100,
        symptome: 'Arrêt intempestif',
        id_terme_defaut: 101,
        defaut: 'Capteur encrassé',
        id_terme_cause: 102,
        cause: 'Nettoyage non fait',
        id_terme_remede: 103,
        remede: 'Nettoyer le capteur',
        id_local_intervention: null,
      },
      horodatage_terrain: T1_5,
    };

    const avant = lire('select count(*)::int as n from entree_sdcr')[0]!['n'] as number;
    const premier = await appliquerLot([mutation], TECHNICIEN);
    const second = await appliquerLot([mutation], TECHNICIEN);

    expect(premier[0]!.statut).toBe('applique');
    expect(second[0]!.statut).toBe('deja_applique');
    expect(second[0]!.resultat?.id_sdcr).toBe(premier[0]!.resultat?.id_sdcr);
    expect(lire('select count(*)::int as n from entree_sdcr')[0]!['n']).toBe(avant + 1);
  });

  it('ne repose pas un jalon T1.5 déjà posé — le TTDi ne peut pas être réécrit', async () => {
    await appliquerLot(
      [
        {
          id_local: uuid(1),
          type: 'ouvrir_intervention',
          charge: { id_equipement: 10, id_sdcr: null },
          horodatage_terrain: T1,
        },
        {
          id_local: uuid(2),
          type: 'confirmer_cause_intervention',
          charge: { id_local_intervention: uuid(1), id_sdcr: 1 },
          horodatage_terrain: T1_5,
        },
      ],
      TECHNICIEN,
    );

    // Même geste, id_local différent : le journal ne protège pas, c'est la
    // clause « is null » du UPDATE qui doit tenir.
    const [resultat] = await appliquerLot(
      [
        {
          id_local: uuid(3),
          type: 'confirmer_cause_intervention',
          charge: { id_local_intervention: uuid(1), id_sdcr: 1 },
          horodatage_terrain: T2,
        },
      ],
      TECHNICIEN,
    );

    expect(resultat!.statut).toBe('deja_applique');
    const [intervention] = lire('select * from intervention');
    expect(new Date(intervention!['datetime_cause_confirmee'] as string).toISOString()).toBe(T1_5);
  });
});

describe('création de fiche', () => {
  it('crée en_attente et jamais directement validée', async () => {
    const [resultat] = await appliquerLot(
      [
        {
          id_local: uuid(30),
          type: 'creer_entree_sdcr',
          charge: {
            id_equipement: 10,
            id_terme_symptome: null,
            symptome: 'Vibration anormale',
            id_terme_defaut: null,
            defaut: 'Palier desserré',
            id_terme_cause: null,
            cause: 'Serrage insuffisant',
            id_terme_remede: null,
            remede: 'Reprendre au couple',
            id_local_intervention: null,
          },
          horodatage_terrain: T1_5,
        },
      ],
      TECHNICIEN,
    );

    const idSdcr = resultat!.resultat!.id_sdcr;
    const [fiche] = lire(`select * from entree_sdcr where id_sdcr = ${idSdcr}`);
    expect(fiche!['statut']).toBe('en_attente');
    expect(fiche!['via_nomenclature']).toBe(false);
    expect(fiche!['id_contributeur']).toBe(TECHNICIEN);
  });

  it('incrémente le compteur d’usage des termes retenus', async () => {
    await appliquerLot(
      [
        {
          id_local: uuid(31),
          type: 'creer_entree_sdcr',
          charge: {
            id_equipement: 10,
            id_terme_symptome: 100,
            symptome: 'Arrêt intempestif',
            id_terme_defaut: 101,
            defaut: 'Capteur encrassé',
            id_terme_cause: 102,
            cause: 'Nettoyage non fait',
            id_terme_remede: 103,
            remede: 'Nettoyer le capteur',
            id_local_intervention: null,
          },
          horodatage_terrain: T1_5,
        },
      ],
      TECHNICIEN,
    );

    expect(lire('select compteur_usage from terme_nomenclature where id_terme = 100')[0]!['compteur_usage']).toBe(6);
    expect(lire('select compteur_usage from terme_nomenclature where id_terme = 101')[0]!['compteur_usage']).toBe(4);
  });
});

describe('confirmation de cause', () => {
  it('refuse d’incrémenter une fiche non validée', async () => {
    const [resultat] = await appliquerLot(
      [
        {
          id_local: uuid(40),
          type: 'confirmer_cause',
          charge: { id_sdcr: 2 },
          horodatage_terrain: T1_5,
        },
      ],
      TECHNICIEN,
    );

    expect(resultat!.statut).toBe('refuse');
    expect(lire('select frequence_observee from entree_sdcr where id_sdcr = 2')[0]!['frequence_observee']).toBe(1);
  });
});

describe('instantané descendant', () => {
  it('renvoie les fiches validées ET les contributions de l’utilisateur', async () => {
    const instantane = await construireInstantane(TECHNICIEN, 'technicien');

    const statuts = instantane.entrees_sdcr.map((e) => e.statut).sort();
    expect(statuts).toEqual(['en_attente', 'validee']);
    expect(instantane.equipements).toHaveLength(1);
    expect(instantane.termes).toHaveLength(4);
    expect(instantane.partiel).toBe(false);
  });

  it('embarque toujours les fiches CSD — A7 doit fonctionner hors ligne', async () => {
    const complet = await construireInstantane(TECHNICIEN, 'technicien');
    expect(complet.fiches_csd).toHaveLength(1);
    expect(complet.fiches_csd[0]!.photo_url).toBe('photo-ref.webp');

    // Même sur un instantané partiel : une fiche CSD absente du cache rendrait
    // l'écran A7 vide sans réseau, alors que rien n'a changé côté serveur.
    const partiel = await construireInstantane(TECHNICIEN, 'technicien', '2030-01-01T00:00:00.000Z');
    expect(partiel.fiches_csd).toHaveLength(1);
  });

  it('se déclare partiel quand un curseur est fourni', async () => {
    const instantane = await construireInstantane(TECHNICIEN, 'technicien', '2030-01-01T00:00:00.000Z');
    expect(instantane.partiel).toBe(true);
    expect(instantane.entrees_sdcr).toHaveLength(0);
  });
});

