import { describe, expect, it } from 'vitest';

import { branchesDistinctes, schemaDefaillogramme } from './defaillogramme.js';

const VALIDE = {
  id_sdcr: 118,
  branche1_objet: 'Graissage centralisé',
  branche1_defaut: 'Débit insuffisant',
  branche2_objet: 'Plan de maintenance',
  branche2_defaut: 'Périodicité non tenue',
  cause_intermediaire: 'Encrassement accéléré du capteur de niveau',
  cause_premiere: 'Gamme préventive jamais révisée depuis la mise en service',
};

describe('schemaDefaillogramme', () => {
  it('accepte une analyse complète', () => {
    expect(schemaDefaillogramme.safeParse(VALIDE).success).toBe(true);
  });

  it('fige la topologie : exactement deux branches, aucun tableau', () => {
    const champs = Object.keys(schemaDefaillogramme.shape);
    expect(champs.filter((c) => c.startsWith('branche'))).toEqual([
      'branche1_objet',
      'branche1_defaut',
      'branche2_objet',
      'branche2_defaut',
    ]);
    // Une troisième branche est simplement ignorée : le schéma n'a pas de place pour elle.
    const avecTroisieme = schemaDefaillogramme.parse({ ...VALIDE, branche3_objet: 'Autre' });
    expect('branche3_objet' in avecTroisieme).toBe(false);
  });

  it('exige les deux niveaux d’analyse, avec un minimum de substance', () => {
    // Le plancher est à 10 caractères : « Usure » n'est pas une cause première.
    expect(schemaDefaillogramme.safeParse({ ...VALIDE, cause_premiere: 'Usure' }).success).toBe(false);
    expect(schemaDefaillogramme.safeParse({ ...VALIDE, cause_intermediaire: '' }).success).toBe(false);
    expect(schemaDefaillogramme.safeParse({ ...VALIDE, cause_premiere: 'Dix caract' }).success).toBe(true);
  });

  it('refuse un bloc de branche vide', () => {
    expect(schemaDefaillogramme.safeParse({ ...VALIDE, branche2_defaut: '' }).success).toBe(false);
  });

  it('rogne les espaces autour des libellés', () => {
    const analyse = schemaDefaillogramme.parse({ ...VALIDE, branche1_objet: '  Graissage  ' });
    expect(analyse.branche1_objet).toBe('Graissage');
  });
});

describe('branchesDistinctes', () => {
  it('accepte deux branches différentes', () => {
    expect(branchesDistinctes(VALIDE)).toBe(true);
  });

  it('refuse deux branches identiques — rien à faire converger', () => {
    expect(
      branchesDistinctes({
        branche1_objet: 'Graissage',
        branche1_defaut: 'Débit insuffisant',
        branche2_objet: 'Graissage',
        branche2_defaut: 'Débit insuffisant',
      }),
    ).toBe(false);
  });

  it('détecte l’identité à la casse et aux espaces près', () => {
    expect(
      branchesDistinctes({
        branche1_objet: 'Graissage centralisé',
        branche1_defaut: 'Débit insuffisant',
        branche2_objet: '  GRAISSAGE   centralisé ',
        branche2_defaut: 'débit  insuffisant',
      }),
    ).toBe(false);
  });

  it('accepte un même objet avec deux défauts différents', () => {
    // Deux défauts distincts sur le même objet restent deux contributions.
    expect(
      branchesDistinctes({
        branche1_objet: 'Graissage centralisé',
        branche1_defaut: 'Débit insuffisant',
        branche2_objet: 'Graissage centralisé',
        branche2_defaut: 'Filtre colmaté',
      }),
    ).toBe(true);
  });
});
