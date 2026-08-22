/**
 * Tests des décisions de compression.
 *
 * Seules les fonctions pures sont testées ici : l'encodage lui-même dépend du
 * canevas du navigateur et est vérifié directement dans le navigateur.
 * Ce qui est vérifié : les seuils chiffrés du cahier des charges.
 */

import { PHOTO } from '@maintxpert/shared';
import { describe, expect, it } from 'vitest';

import {
  calculerDimensions,
  choisirFormat,
  doitRecompresser,
  formaterTaille,
} from './compression-photo.js';

describe('calculerDimensions', () => {
  it('ramène le plus grand côté à 1600 px', () => {
    expect(calculerDimensions({ largeur: 4000, hauteur: 3000 })).toEqual({
      largeur: 1600,
      hauteur: 1200,
    });
  });

  it('traite le portrait comme le paysage — c’est le plus grand côté qui compte', () => {
    expect(calculerDimensions({ largeur: 3000, hauteur: 4000 })).toEqual({
      largeur: 1200,
      hauteur: 1600,
    });
  });

  it('n’agrandit jamais une image déjà petite', () => {
    expect(calculerDimensions({ largeur: 800, hauteur: 600 })).toEqual({
      largeur: 800,
      hauteur: 600,
    });
  });

  it('laisse intacte une image pile au plafond', () => {
    expect(calculerDimensions({ largeur: 1600, hauteur: 900 })).toEqual({
      largeur: 1600,
      hauteur: 900,
    });
  });

  it('conserve les proportions à un pixel près', () => {
    const { largeur, hauteur } = calculerDimensions({ largeur: 4032, hauteur: 3024 });
    expect(largeur).toBe(1600);
    expect(Math.abs(largeur / hauteur - 4032 / 3024)).toBeLessThan(0.01);
  });

  it('ne descend jamais sous 1 px sur une image très allongée', () => {
    const { hauteur } = calculerDimensions({ largeur: 8000, hauteur: 3 });
    expect(hauteur).toBeGreaterThanOrEqual(1);
  });

  it('renvoie zéro sur des dimensions absurdes plutôt que de lever', () => {
    expect(calculerDimensions({ largeur: 0, hauteur: 0 })).toEqual({ largeur: 0, hauteur: 0 });
  });
});

describe('doitRecompresser', () => {
  it('déclenche au-delà de 400 Ko, pas à 400 Ko pile', () => {
    expect(doitRecompresser(PHOTO.TAILLE_CIBLE_OCTETS)).toBe(false);
    expect(doitRecompresser(PHOTO.TAILLE_CIBLE_OCTETS + 1)).toBe(true);
  });

  it('ne déclenche pas sur une photo légère', () => {
    expect(doitRecompresser(120 * 1024)).toBe(false);
  });
});

describe('choisirFormat', () => {
  it('préfère WebP quand il est disponible', () => {
    expect(choisirFormat(true)).toBe('image/webp');
  });

  it('replie sur JPEG sinon', () => {
    expect(choisirFormat(false)).toBe('image/jpeg');
  });
});

describe('constantes du cahier des charges', () => {
  it('respecte les valeurs chiffrées', () => {
    expect(PHOTO.COTE_MAX_PX).toBe(1600);
    expect(PHOTO.QUALITE_INITIALE).toBe(0.78);
    expect(PHOTO.QUALITE_RECOMPRESSION).toBe(0.7);
    expect(PHOTO.TAILLE_CIBLE_OCTETS).toBe(400 * 1024);
    expect(PHOTO.NB_MAX_PAR_FICHE).toBe(1);
  });
});

describe('formaterTaille', () => {
  it('choisit l’unité lisible', () => {
    expect(formaterTaille(512)).toBe('512 o');
    expect(formaterTaille(300 * 1024)).toBe('300 Ko');
    expect(formaterTaille(2.5 * 1024 * 1024)).toBe('2.5 Mo');
  });
});
