/**
 * Non-régression : après une purge, le cache doit rester UTILISABLE.
 *
 * `Dexie.delete()` ferme la base avec `disableAutoOpen: true` par défaut.
 * Une purge naïve condamnait donc l'instance jusqu'au rechargement de la page :
 * la reconnexion suivante — qui ne recharge rien, c'est un simple changement de
 * route — trouvait une base close, la synchronisation ne pouvait plus rien
 * écrire, et le tableau de bord restait sur « Lecture du cache local… »
 * indéfiniment. Défaut constaté en conditions réelles.
 *
 * Le test suivant échoue si quelqu'un revient à `baseLocale.delete()` seul.
 */

import 'fake-indexeddb/auto';

import type { Equipement } from '@maintxpert/shared';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { CLE_CURSEUR_PULL, baseLocale, ecrireMeta, lireMeta, purgerCache } from './db.js';

const POMPE: Equipement = {
  id_equipement: 1,
  nom: 'Pompe doseuse CO2',
  famille: 'Dosage',
  chaine: 'CH02',
};

/** Ce qu'une synchronisation descendante ferait juste après la reconnexion. */
async function remplirCommeUnPull(): Promise<void> {
  await baseLocale.equipements.put(POMPE);
  await ecrireMeta(CLE_CURSEUR_PULL, '2026-08-23T09:00:00.000Z');
}

describe('purgerCache', () => {
  beforeEach(async () => {
    if (!baseLocale.isOpen()) await baseLocale.open();
    await remplirCommeUnPull();
  });

  afterAll(() => {
    baseLocale.close();
  });

  it('efface toute donnée industrielle du terminal (exigence BYOD)', async () => {
    await purgerCache();

    expect(await baseLocale.equipements.count()).toBe(0);
    expect(await lireMeta(CLE_CURSEUR_PULL)).toBeNull();
  });

  it('laisse la base ouverte et réinscriptible — la reconnexion ne recharge pas la page', async () => {
    await purgerCache();

    expect(baseLocale.isOpen()).toBe(true);

    // C'est ici que la version fautive rejetait avec DatabaseClosed.
    await expect(remplirCommeUnPull()).resolves.toBeUndefined();
    expect(await baseLocale.equipements.count()).toBe(1);
    expect(await lireMeta(CLE_CURSEUR_PULL)).toBe('2026-08-23T09:00:00.000Z');
  });

  it('supporte plusieurs cycles déconnexion → reconnexion d’affilée', async () => {
    for (let cycle = 0; cycle < 3; cycle += 1) {
      await purgerCache();
      await remplirCommeUnPull();
      expect(await baseLocale.equipements.count()).toBe(1);
    }
  });

  it('purge une base déjà purgée sans se condamner', async () => {
    await purgerCache();
    await purgerCache();

    expect(baseLocale.isOpen()).toBe(true);
    await expect(baseLocale.equipements.count()).resolves.toBe(0);
  });
});
