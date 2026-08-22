import { describe, expect, it } from 'vitest';
import { normaliserMatricule, validerMatricule, validerMotDePasse } from './matricule.js';

describe('normaliserMatricule', () => {
  it('met en majuscules', () => {
    expect(normaliserMatricule('tc-2841')).toBe('TC-2841');
  });

  it('supprime les espaces, y compris internes', () => {
    expect(normaliserMatricule('  TC - 2841 ')).toBe('TC-2841');
  });

  it('est idempotente', () => {
    const une = normaliserMatricule(' tc 2841 ');
    expect(normaliserMatricule(une)).toBe(une);
  });
});

describe('validerMatricule', () => {
  it('accepte un matricule usuel', () => {
    expect(validerMatricule('TC-2841').valide).toBe(true);
    expect(validerMatricule('tc2841').valide).toBe(true);
    expect(validerMatricule('TC_0412').valide).toBe(true);
  });

  it('refuse le vide et le trop court', () => {
    expect(validerMatricule('').motif).toMatch(/obligatoire/);
    expect(validerMatricule('T1').motif).toMatch(/au moins/);
  });

  it('refuse au-delà de 20 caractères — contrainte VARCHAR(20)', () => {
    expect(validerMatricule('T'.repeat(21)).valide).toBe(false);
    expect(validerMatricule('T'.repeat(20)).valide).toBe(true);
  });

  it('refuse les caractères hors jeu admis', () => {
    expect(validerMatricule('TC@2841').motif).toMatch(/lettres/);
    expect(validerMatricule('TC.2841').valide).toBe(false);
  });

  it('valide après normalisation, pas avant', () => {
    expect(validerMatricule(' tc-2841 ').valide).toBe(true);
  });
});

describe('validerMotDePasse', () => {
  it('exige 8 caractères minimum', () => {
    expect(validerMotDePasse('1234567').valide).toBe(false);
    expect(validerMotDePasse('12345678').valide).toBe(true);
  });

  it('refuse au-delà de 128 caractères', () => {
    expect(validerMotDePasse('a'.repeat(129)).valide).toBe(false);
  });
});
