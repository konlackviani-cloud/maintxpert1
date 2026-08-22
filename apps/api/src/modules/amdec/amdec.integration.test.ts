/**
 * Tests d'intégration AMDEC (B4) et import (B7).
 *
 * L'IPR est une colonne calculée : le test vérifie qu'il SUIT bien les
 * cotations, y compris après recotation — un IPR figé fausserait durablement le
 * classement de criticité.
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

const amdec = await import('../../db/requetes/amdec.js');

const MODE_BASE = {
  id_equipement: 10,
  composant: 'Capteur de niveau cuve',
  mode_defaillance: 'Encrassement',
  cause: 'Absence de nettoyage',
  effet: 'Arrêt de la ligne',
};

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
    create table equipement (
      id_equipement serial primary key, nom varchar(100) not null,
      famille varchar(100) not null, chaine varchar(20) not null,
      constraint uq_equipement_chaine_nom unique (chaine, nom));

    create table mode_amdec (
      id_mode serial primary key, id_equipement integer not null,
      composant varchar(150) not null, mode_defaillance varchar(150) not null,
      cause varchar(150) not null, effet varchar(150) not null,
      gravite integer not null check (gravite between 1 and 4),
      frequence integer not null check (frequence between 1 and 4),
      detection integer not null check (detection between 1 and 4),
      ipr integer generated always as (gravite * frequence * detection) stored);

    insert into equipement (id_equipement, nom, famille, chaine)
      values (10,'Soutireuse','Remplissage','CH02'), (11,'Étiqueteuse','Étiquetage','CH02');
  `);
});

const lire = (sql: string): Record<string, unknown>[] =>
  base.public.many(sql) as Record<string, unknown>[];

describe('IPR — colonne calculée', () => {
  it('vaut le produit des trois cotations à la création', async () => {
    const mode = await amdec.creerMode({ ...MODE_BASE, gravite: 3, frequence: 4, detection: 3 });
    expect(mode.ipr).toBe(36);
  });

  it('SUIT la recotation — un IPR figé fausserait le classement', async () => {
    const cree = await amdec.creerMode({ ...MODE_BASE, gravite: 3, frequence: 4, detection: 3 });
    expect(cree.ipr).toBe(36);

    const recote = await amdec.recoterMode(cree.id_mode, 1, 2, 1);
    expect(recote!.ipr).toBe(2);
    expect(lire(`select ipr from mode_amdec where id_mode = ${cree.id_mode}`)[0]!['ipr']).toBe(2);
  });

  it('refuse une cotation hors bornes au niveau de la base', async () => {
    await expect(
      amdec.creerMode({ ...MODE_BASE, gravite: 5, frequence: 2, detection: 2 }),
    ).rejects.toThrow();
  });
});

describe('classement par criticité', () => {
  it('trie du plus critique au moins critique', async () => {
    await amdec.creerMode({ ...MODE_BASE, mode_defaillance: 'Faible', gravite: 1, frequence: 2, detection: 1 });
    await amdec.creerMode({ ...MODE_BASE, mode_defaillance: 'Fort', gravite: 4, frequence: 4, detection: 3 });
    await amdec.creerMode({ ...MODE_BASE, mode_defaillance: 'Moyen', gravite: 2, frequence: 3, detection: 2 });

    const modes = await amdec.listerModes(10);
    expect(modes.map((m) => m.ipr)).toEqual([48, 12, 2]);
    expect(modes[0]!.eq_nom).toBe('Soutireuse');
  });

  it('filtre par équipement', async () => {
    await amdec.creerMode({ ...MODE_BASE, gravite: 2, frequence: 2, detection: 2 });
    await amdec.creerMode({
      ...MODE_BASE,
      id_equipement: 11,
      composant: 'Tête de collage',
      gravite: 3,
      frequence: 3,
      detection: 3,
    });

    expect(await amdec.listerModes(10)).toHaveLength(1);
    expect(await amdec.listerModes(11)).toHaveLength(1);
    expect(await amdec.listerModes()).toHaveLength(2);
  });

  it('filtre par chaîne', async () => {
    await amdec.creerMode({ ...MODE_BASE, gravite: 2, frequence: 2, detection: 2 });
    expect(await amdec.listerModes(undefined, 'CH02')).toHaveLength(1);
    expect(await amdec.listerModes(undefined, 'CH09')).toHaveLength(0);
  });
});

describe('unicité des modes', () => {
  it('détecte un doublon à la casse et aux espaces près', async () => {
    await amdec.creerMode({ ...MODE_BASE, gravite: 2, frequence: 2, detection: 2 });

    expect(await amdec.modeExiste(10, '  capteur de   NIVEAU cuve ', 'encrassement')).toBe(true);
    expect(await amdec.modeExiste(10, 'Vérin de came', 'Encrassement')).toBe(false);
    // Même composant, même mode, mais sur un autre équipement : pas un doublon.
    expect(await amdec.modeExiste(11, 'Capteur de niveau cuve', 'Encrassement')).toBe(false);
  });
});

/*
 * NON COUVERT ICI : `supprimerMode`.
 *
 * pg-mem refuse tout DELETE sur une table portant une colonne générée
 * (`generated always as … stored`), alors que PostgreSQL l'accepte sans
 * réserve. Reproduire le cas demanderait de retirer la colonne calculée du
 * schéma de test — c'est-à-dire de supprimer précisément ce que les tests
 * ci-dessus servent à vérifier.
 *
 * Le risque est faible : la requête est un `delete … returning id_mode` sans
 * condition métier, et la route couvre le cas « mode introuvable » par un 404.
 * À vérifier contre une vraie instance PostgreSQL.
 */
