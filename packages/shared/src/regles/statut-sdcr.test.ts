import { describe, expect, it } from 'vitest';
import { STATUTS_SDCR } from '../types/enums.js';
import {
  estConsultable,
  estStatutTerminal,
  transitionAutorisee,
  transitionsPossibles,
  verifierTransition,
} from './statut-sdcr.js';

describe('machine à états EntreeSDCR', () => {
  it('autorise les trois issues depuis en_attente', () => {
    expect(transitionsPossibles('en_attente')).toEqual(['validee', 'rejetee', 'en_correction']);
  });

  it('ne permet pas de revenir en arrière vers en_attente', () => {
    for (const depuis of STATUTS_SDCR) {
      expect(transitionAutorisee(depuis, 'en_attente')).toBe(false);
    }
  });

  it('rend archivee terminal', () => {
    expect(estStatutTerminal('archivee')).toBe(true);
    expect(transitionsPossibles('archivee')).toEqual([]);
  });

  it('n’autorise l’archivage que depuis validee ou rejetee', () => {
    expect(transitionAutorisee('validee', 'archivee')).toBe(true);
    expect(transitionAutorisee('rejetee', 'archivee')).toBe(true);
    expect(transitionAutorisee('en_attente', 'archivee')).toBe(false);
    expect(transitionAutorisee('en_correction', 'archivee')).toBe(false);
  });

  it('ne rend consultable en FP1 que le statut validee', () => {
    for (const statut of STATUTS_SDCR) {
      expect(estConsultable(statut)).toBe(statut === 'validee');
    }
  });
});

describe('verifierTransition', () => {
  it('refuse toute transition à un technicien', () => {
    const r = verifierTransition('en_attente', 'validee', 'technicien');
    expect(r.autorisee).toBe(false);
    expect(r.motif).toMatch(/responsable/);
  });

  it('accepte une transition licite pour un responsable', () => {
    expect(verifierTransition('en_attente', 'validee', 'responsable')).toEqual({
      autorisee: true,
      motif: null,
    });
  });

  it('refuse une transition vers le même statut', () => {
    const r = verifierTransition('validee', 'validee', 'responsable');
    expect(r.autorisee).toBe(false);
    expect(r.motif).toMatch(/déjà/);
  });

  it('refuse toute sortie d’un statut archivé et le dit en français', () => {
    const r = verifierTransition('archivee', 'validee', 'responsable');
    expect(r.autorisee).toBe(false);
    expect(r.motif).toMatch(/archivée/);
  });

  it('liste les transitions possibles quand la cible est interdite', () => {
    const r = verifierTransition('validee', 'rejetee', 'responsable');
    expect(r.autorisee).toBe(false);
    expect(r.motif).toContain('archivee');
  });
});
