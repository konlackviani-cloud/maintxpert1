/**
 * Test d'intégration du circuit contributeur → valideur (UC2) et de la
 * nomenclature (B2), de l'appel de service jusqu'au SQL.
 *
 * Ce qui est vérifié ici est ce qui abîme la base si c'est faux : les
 * transitions interdites, la concurrence entre deux responsables, et le fait
 * qu'une fusion ne perde ni fréquence ni traçabilité.
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

const validation = await import('./service.js');
const nomenclature = await import('../../db/requetes/nomenclature.js');

const RESPONSABLE = 2;

beforeEach(() => {
  base = newDb();
  const { Pool } = base.adapters.createPg() as { Pool: new () => typeof poolMemoire };
  poolMemoire = new Pool();

  base.public.registerFunction({
    name: 'normaliser_libelle',
    args: [{ type: base.public.getType({ name: 'text' } as never) } as never] as never,
    returns: base.public.getType({ name: 'text' } as never) as never,
    implementation: (v: string) => (v ?? '').trim().replace(/\s+/g, ' ').toLowerCase(),
  } as never);

  base.public.none(`
    create type role_utilisateur as enum ('technicien','responsable');
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
      id_terme serial primary key, libelle varchar(150) not null, type type_terme not null,
      id_equipement integer not null, statut statut_terme not null default 'actif',
      compteur_usage integer not null default 0, categorie_afnor varchar(100),
      id_terme_remplacant integer);

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

    insert into utilisateur values (1,'Mballa','Alain','TC-2841','technicien','x',true);
    insert into utilisateur values (2,'Ngo Bell','Julie','TC-0412','responsable','x',true);
    insert into equipement values (10,'Soutireuse','Remplissage','CH02');

    insert into terme_nomenclature (id_terme,libelle,type,id_equipement,statut,compteur_usage)
      values (100,'Arrêt intempestif','symptome',10,'actif',5),
             (101,'Arret intempestif machine','symptome',10,'actif',2),
             (102,'Capteur encrassé','defaut',10,'actif',3);

    -- 1 : contribution en texte libre, en attente
    insert into entree_sdcr (id_equipement, symptome, defaut, cause, remede,
                             frequence_observee, via_nomenclature, statut, id_contributeur)
      values (10,'Vibration anormale','Palier desserré','Serrage insuffisant','Reprendre au couple',
              1,false,'en_attente',1);
    -- 2 : fiche validée, même défaut/cause que la 3
    insert into entree_sdcr (id_equipement, symptome, defaut, cause, remede,
                             frequence_observee, via_nomenclature, statut, id_contributeur, id_valideur)
      values (10,'Bruit en rotation','Palier desserré','Serrage insuffisant','Reprendre au couple',
              3,true,'validee',1,2);
    -- 3 : contribution doublon de la 2, symptôme différent
    insert into entree_sdcr (id_equipement, symptome, defaut, cause, remede,
                             frequence_observee, via_nomenclature, statut, id_contributeur)
      values (10,'Vibration au démarrage','Palier desserré','Serrage insuffisant','Reprendre au couple',
              2,true,'en_attente',1);
  `);
});

const lire = (sql: string): Record<string, unknown>[] =>
  base.public.many(sql) as Record<string, unknown>[];

describe('machine à états (UC2)', () => {
  it('valide une contribution en attente', async () => {
    await validation.valider(1, RESPONSABLE);
    const [fiche] = lire('select statut, id_valideur from entree_sdcr where id_sdcr = 1');
    expect(fiche!['statut']).toBe('validee');
    expect(fiche!['id_valideur']).toBe(RESPONSABLE);
  });

  it('refuse de valider une fiche déjà validée', async () => {
    await expect(validation.valider(2, RESPONSABLE)).rejects.toThrow(/déjà/);
  });

  it('refuse d’archiver une fiche encore en attente — transition interdite', async () => {
    await expect(validation.archiver(1, RESPONSABLE)).rejects.toThrow(/interdite|Transition/i);
    expect(lire('select statut from entree_sdcr where id_sdcr = 1')[0]!['statut']).toBe('en_attente');
  });

  it('autorise en_attente → en_correction → validee', async () => {
    await validation.renvoyerEnCorrection(1, RESPONSABLE);
    expect(lire('select statut from entree_sdcr where id_sdcr = 1')[0]!['statut']).toBe('en_correction');

    await validation.valider(1, RESPONSABLE);
    expect(lire('select statut from entree_sdcr where id_sdcr = 1')[0]!['statut']).toBe('validee');
  });

  it('autorise validee → archivee, et rien après', async () => {
    await validation.valider(1, RESPONSABLE);
    await validation.archiver(1, RESPONSABLE);
    expect(lire('select statut from entree_sdcr where id_sdcr = 1')[0]!['statut']).toBe('archivee');

    await expect(validation.valider(1, RESPONSABLE)).rejects.toThrow(/archivée/);
  });

  it('détecte le traitement concurrent par un autre responsable', async () => {
    // Le second responsable a chargé la file avant, la fiche bascule entre-temps.
    base.public.none(`update entree_sdcr set statut = 'validee' where id_sdcr = 1`);
    await expect(validation.rejeter(1, 3)).rejects.toThrow(/vient d’être traitée|Transition/);
  });
});

describe('corrections à la validation', () => {
  it('rattache les niveaux libres et recalcule via_nomenclature', async () => {
    await validation.valider(1, RESPONSABLE, {
      symptome: { id_terme: 100, libelle: 'Arrêt intempestif' },
      defaut: { id_terme: 102, libelle: 'Capteur encrassé' },
      cause: { id_terme: 200, libelle: 'Serrage insuffisant' },
      remede: { id_terme: 201, libelle: 'Reprendre au couple' },
    });

    const [fiche] = lire('select * from entree_sdcr where id_sdcr = 1');
    expect(fiche!['symptome']).toBe('Arrêt intempestif');
    expect(fiche!['id_terme_symptome']).toBe(100);
    expect(fiche!['via_nomenclature']).toBe(true);
    expect(fiche!['statut']).toBe('validee');
  });

  it('laisse via_nomenclature à faux si un niveau reste libre', async () => {
    await validation.valider(1, RESPONSABLE, {
      symptome: { id_terme: 100, libelle: 'Arrêt intempestif' },
    });

    expect(lire('select via_nomenclature from entree_sdcr where id_sdcr = 1')[0]!['via_nomenclature']).toBe(false);
  });
});

describe('doublons et fusion de fiches', () => {
  it('repère la fiche validée partageant défaut et cause', async () => {
    const detail = await validation.detail(3);
    expect(detail.doublons).toHaveLength(1);
    expect(detail.doublons[0]!.fiche.id_sdcr).toBe(2);
    expect(detail.doublons[0]!.symptome_different).toBe(true);
  });

  it('reporte la fréquence sur la cible et archive la source', async () => {
    await validation.fusionner(3, 2, RESPONSABLE);

    // 3 (cible) + 2 (source) = 5 : les occurrences observées sous l'autre
    // libellé ont bien eu lieu, elles comptent.
    expect(lire('select frequence_observee from entree_sdcr where id_sdcr = 2')[0]!['frequence_observee']).toBe(5);
    expect(lire('select statut from entree_sdcr where id_sdcr = 3')[0]!['statut']).toBe('archivee');
  });

  it('refuse de fusionner dans une fiche non validée', async () => {
    await expect(validation.fusionner(3, 1, RESPONSABLE)).rejects.toThrow(/pas validée/);
  });

  it('refuse de fusionner une fiche avec elle-même', async () => {
    await expect(validation.fusionner(3, 3, RESPONSABLE)).rejects.toThrow(/elle-même/);
  });
});

describe('nomenclature (B2)', () => {
  it('fusionne deux termes : réécrit les fiches, archive et redirige la source', async () => {
    base.public.none('update entree_sdcr set id_terme_symptome = 101 where id_sdcr = 3');

    const applique = await nomenclature.fusionnerTermes(101, 100);
    expect(applique).toBe(true);

    const [fiche] = lire('select id_terme_symptome, symptome from entree_sdcr where id_sdcr = 3');
    expect(fiche!['id_terme_symptome']).toBe(100);
    // Le libellé suit l'identifiant, sinon FP1 — qui compare des chaînes —
    // cesserait d'apparier la fiche.
    expect(fiche!['symptome']).toBe('Arrêt intempestif');

    const [source] = lire('select statut, id_terme_remplacant from terme_nomenclature where id_terme = 101');
    expect(source!['statut']).toBe('archive');
    expect(source!['id_terme_remplacant']).toBe(100);

    // Le compteur d'usage de la source est absorbé : 5 + 2.
    expect(lire('select compteur_usage from terme_nomenclature where id_terme = 100')[0]!['compteur_usage']).toBe(7);
  });

  it('refuse de fusionner deux termes de niveaux SDCR différents', async () => {
    expect(await nomenclature.fusionnerTermes(100, 102)).toBe(false);
    expect(lire('select statut from terme_nomenclature where id_terme = 100')[0]!['statut']).toBe('actif');
  });

  it('répercute un renommage sur les fiches référençant le terme', async () => {
    base.public.none('update entree_sdcr set id_terme_symptome = 100 where id_sdcr = 2');
    await nomenclature.renommerTerme(100, 'Arrêt intempestif en production');

    expect(lire('select symptome from entree_sdcr where id_sdcr = 2')[0]!['symptome']).toBe(
      'Arrêt intempestif en production',
    );
  });

  it('détecte un libellé déjà pris, à la casse et aux espaces près', async () => {
    expect(await nomenclature.termeExiste(10, 'symptome', '  arrêt   INTEMPESTIF ')).toBe(true);
    expect(await nomenclature.termeExiste(10, 'symptome', 'Fuite de produit')).toBe(false);
  });

  it('archive sans jamais supprimer', async () => {
    await nomenclature.archiverTerme(100);
    const restant = lire('select statut from terme_nomenclature where id_terme = 100');
    expect(restant).toHaveLength(1);
    expect(restant[0]!['statut']).toBe('archive');
  });
});
