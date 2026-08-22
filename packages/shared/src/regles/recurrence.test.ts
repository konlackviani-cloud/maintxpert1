import { describe, expect, it } from 'vitest';
import type { EntreeSDCR } from '../types/entites.js';
import { collecterSuggestions, estRecurrente, lireSeuilRecurrence } from './recurrence.js';

function entree(frequence: number, partiel: Partial<EntreeSDCR> = {}): EntreeSDCR {
  return {
    id_sdcr: frequence,
    id_equipement: 1,
    id_terme_symptome: null,
    symptome: 'Fuite au niveau du vérin',
    id_terme_defaut: null,
    defaut: 'Joint détérioré',
    id_terme_cause: null,
    cause: 'Vieillissement du joint',
    id_terme_remede: null,
    remede: 'Remplacer le joint',
    frequence_observee: frequence,
    via_nomenclature: false,
    statut: 'validee',
    photo_url: null,
    id_contributeur: 1,
    id_valideur: 2,
    date_creation: '2026-01-01T08:00:00.000Z',
    date_modification: '2026-01-01T08:00:00.000Z',
    ...partiel,
  };
}

describe('estRecurrente', () => {
  it('déclenche à partir de 3 occurrences par défaut', () => {
    expect(estRecurrente(entree(2))).toBe(false);
    expect(estRecurrente(entree(3))).toBe(true);
    expect(estRecurrente(entree(4))).toBe(true);
  });

  it('respecte un seuil personnalisé', () => {
    expect(estRecurrente(entree(3), 5)).toBe(false);
    expect(estRecurrente(entree(5), 5)).toBe(true);
  });

  it('ignore les entrées non validées', () => {
    expect(estRecurrente(entree(10, { statut: 'en_attente' }))).toBe(false);
    expect(estRecurrente(entree(10, { statut: 'archivee' }))).toBe(false);
  });
});

describe('collecterSuggestions', () => {
  it('classe les plus récurrentes en tête', () => {
    const suggestions = collecterSuggestions([entree(3), entree(8), entree(5), entree(1)]);
    expect(suggestions.map((s) => s.frequence_observee)).toEqual([8, 5, 3]);
  });

  it('retourne un tableau vide plutôt qu’une erreur — état vide du tableau de bord', () => {
    expect(collecterSuggestions([])).toEqual([]);
    expect(collecterSuggestions([entree(1), entree(2)])).toEqual([]);
  });

  it('reporte le seuil appliqué dans la suggestion', () => {
    const [suggestion] = collecterSuggestions([entree(6)], 6);
    expect(suggestion?.seuil_applique).toBe(6);
  });
});

describe('lireSeuilRecurrence', () => {
  it('lit la valeur configurée', () => {
    expect(lireSeuilRecurrence('5')).toBe(5);
  });

  it('replie sur 3 si la configuration est absente ou aberrante', () => {
    expect(lireSeuilRecurrence(null)).toBe(3);
    expect(lireSeuilRecurrence(undefined)).toBe(3);
    expect(lireSeuilRecurrence('zéro')).toBe(3);
    expect(lireSeuilRecurrence('0')).toBe(3);
    expect(lireSeuilRecurrence('-2')).toBe(3);
  });
});
