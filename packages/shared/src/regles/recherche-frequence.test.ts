import { describe, expect, it } from 'vitest';
import type { EntreeSDCR } from '../types/entites.js';
import { normaliserLibelle, rechercher } from './recherche-frequence.js';

let compteur = 0;

function entree(partiel: Partial<EntreeSDCR> = {}): EntreeSDCR {
  compteur += 1;
  return {
    id_sdcr: compteur,
    id_equipement: 1,
    id_terme_symptome: 10,
    symptome: 'Arrêt intempestif',
    id_terme_defaut: 20,
    defaut: 'Capteur encrassé',
    id_terme_cause: 30,
    cause: 'Absence de nettoyage périodique',
    id_terme_remede: 40,
    remede: 'Nettoyer et régler le capteur',
    frequence_observee: 1,
    via_nomenclature: true,
    statut: 'validee',
    photo_url: null,
    id_contributeur: 1,
    id_valideur: 2,
    date_creation: '2026-01-01T08:00:00.000Z',
    date_modification: '2026-01-01T08:00:00.000Z',
    ...partiel,
  };
}

describe('normaliserLibelle', () => {
  it('absorbe casse et espaces surnuméraires', () => {
    expect(normaliserLibelle('  Arrêt   Intempestif ')).toBe('arrêt intempestif');
  });

  it('ne rapproche pas deux libellés réellement différents', () => {
    expect(normaliserLibelle('Arrêt intempestif')).not.toBe(normaliserLibelle('Arrêt intempestifs'));
  });
});

describe('rechercher (FP1)', () => {
  it('trie par fréquence observée décroissante', () => {
    const resultats = rechercher(
      [
        entree({ frequence_observee: 2 }),
        entree({ frequence_observee: 9 }),
        entree({ frequence_observee: 5 }),
      ],
      { symptome: 'Arrêt intempestif', id_equipement: 1 },
    );

    expect(resultats.map((r) => r.frequence_observee)).toEqual([9, 5, 2]);
  });

  it('exclut les entrées non validées', () => {
    const resultats = rechercher(
      [
        entree({ statut: 'en_attente' }),
        entree({ statut: 'rejetee' }),
        entree({ statut: 'archivee' }),
        entree({ statut: 'en_correction' }),
        entree({ statut: 'validee' }),
      ],
      { symptome: 'Arrêt intempestif', id_equipement: 1 },
    );

    expect(resultats).toHaveLength(1);
    expect(resultats[0]?.statut).toBe('validee');
  });

  it('exclut les autres équipements', () => {
    const resultats = rechercher([entree({ id_equipement: 2 })], {
      symptome: 'Arrêt intempestif',
      id_equipement: 1,
    });

    expect(resultats).toEqual([]);
  });

  it('applique une égalité stricte, jamais une similarité approchée', () => {
    const resultats = rechercher([entree({ symptome: 'Arrêt' })], {
      symptome: 'Arrêt intempestif',
      id_equipement: 1,
    });

    expect(resultats).toEqual([]);
  });

  it('départage à fréquence égale : nomenclature contrôlée d’abord', () => {
    const libre = entree({ frequence_observee: 4, via_nomenclature: false });
    const controlee = entree({ frequence_observee: 4, via_nomenclature: true });

    const resultats = rechercher([libre, controlee], {
      symptome: 'Arrêt intempestif',
      id_equipement: 1,
    });

    expect(resultats[0]?.id_sdcr).toBe(controlee.id_sdcr);
  });

  it('retourne un tableau vide plutôt que d’échouer quand rien ne correspond', () => {
    expect(rechercher([], { symptome: 'Inconnu', id_equipement: 42 })).toEqual([]);
  });

  it('ne modifie pas le tableau source', () => {
    const source = [entree({ frequence_observee: 1 }), entree({ frequence_observee: 7 })];
    const copie = [...source];
    rechercher(source, { symptome: 'Arrêt intempestif', id_equipement: 1 });
    expect(source).toEqual(copie);
  });
});
