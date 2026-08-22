import { describe, expect, it } from 'vitest';
import { calculerIPR, estCotationValide, estIPRCritique } from './ipr.js';

describe('calculerIPR', () => {
  it('multiplie les trois cotations', () => {
    expect(calculerIPR(2, 3, 2).ipr).toBe(12);
    expect(calculerIPR(1, 1, 1).ipr).toBe(1);
    expect(calculerIPR(4, 4, 4).ipr).toBe(64);
  });

  it('marque critique à partir de 12 inclus', () => {
    expect(calculerIPR(2, 3, 2).critique).toBe(true); // 12
    expect(calculerIPR(4, 4, 1).critique).toBe(true); // 16
  });

  it('ne marque pas critique en dessous de 12', () => {
    expect(calculerIPR(2, 2, 2).critique).toBe(false); // 8
    expect(calculerIPR(1, 4, 2).critique).toBe(false); // 8
  });

  it('refuse les cotations hors bornes 1–4', () => {
    expect(() => calculerIPR(0, 2, 2)).toThrow(RangeError);
    expect(() => calculerIPR(5, 2, 2)).toThrow(RangeError);
    expect(() => calculerIPR(2, -1, 2)).toThrow(RangeError);
  });

  it('refuse les cotations non entières', () => {
    expect(() => calculerIPR(2.5, 2, 2)).toThrow(RangeError);
    expect(() => calculerIPR(2, 2, Number.NaN)).toThrow(RangeError);
  });

  it('nomme la cotation fautive dans le message', () => {
    expect(() => calculerIPR(2, 9, 2)).toThrow(/fréquence/);
  });
});

describe('estCotationValide', () => {
  it('accepte 1 à 4, refuse le reste', () => {
    expect([1, 2, 3, 4].every(estCotationValide)).toBe(true);
    expect([0, 5, 1.5, Number.NaN].some(estCotationValide)).toBe(false);
  });
});

describe('estIPRCritique', () => {
  it('applique le seuil par défaut de 12', () => {
    expect(estIPRCritique(11)).toBe(false);
    expect(estIPRCritique(12)).toBe(true);
  });

  it('accepte un seuil personnalisé', () => {
    expect(estIPRCritique(11, 10)).toBe(true);
  });
});
