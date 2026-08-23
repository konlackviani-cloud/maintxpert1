import { describe, expect, it } from 'vitest';

import type { EntreeSDCR, Equipement, Intervention } from '../types/entites.js';
import {
  calculerIndicateurs,
  construirePareto,
  filtrerEntrees,
  mediane,
} from './pareto.js';

let compteur = 0;

function fiche(partiel: Partial<EntreeSDCR> = {}): EntreeSDCR {
  compteur += 1;
  return {
    id_sdcr: compteur,
    id_equipement: 10,
    id_terme_symptome: 1,
    symptome: 'Arrêt intempestif',
    id_terme_defaut: 2,
    defaut: 'Capteur encrassé',
    id_terme_cause: 3,
    cause: 'Absence de nettoyage',
    id_terme_remede: 4,
    remede: 'Nettoyer le capteur',
    frequence_observee: 1,
    via_nomenclature: true,
    statut: 'validee',
    photo_url: null,
    id_contributeur: 1,
    id_valideur: 2,
    date_creation: '2026-08-10T08:00:00.000Z',
    date_modification: '2026-08-10T08:00:00.000Z',
    ...partiel,
  };
}

const EQUIPEMENTS: Equipement[] = [
  { id_equipement: 10, nom: 'Soutireuse', famille: 'Remplissage', chaine: 'CH02' },
  { id_equipement: 20, nom: 'Pasteurisateur', famille: 'Thermique', chaine: 'CH05' },
];

function intervention(partiel: Partial<Intervention> = {}): Intervention {
  return {
    id_intervention: 1,
    id_technicien: 1,
    id_equipement: 10,
    id_sdcr: 1,
    datetime_ouverture: '2026-08-10T08:00:00.000Z',
    datetime_cause_confirmee: null,
    datetime_cloture: null,
    ...partiel,
  };
}

/* -------------------------------------------------------------------------- */

describe('filtrerEntrees (B3)', () => {
  const entrees = [
    fiche({ id_equipement: 10, cause: 'Nettoyage', date_creation: '2026-08-01T00:00:00.000Z' }),
    fiche({ id_equipement: 20, cause: 'Graissage', date_creation: '2026-08-15T00:00:00.000Z' }),
    fiche({
      id_equipement: 10,
      cause: 'Usure',
      statut: 'en_attente',
      via_nomenclature: false,
      date_creation: '2026-09-01T00:00:00.000Z',
    }),
  ];

  it('sans critère, ne filtre rien', () => {
    expect(filtrerEntrees(entrees, EQUIPEMENTS, {})).toHaveLength(3);
  });

  it('filtre par équipement', () => {
    expect(filtrerEntrees(entrees, EQUIPEMENTS, { id_equipement: 20 })).toHaveLength(1);
  });

  it('filtre par chaîne, en résolvant l’équipement', () => {
    expect(filtrerEntrees(entrees, EQUIPEMENTS, { chaine: 'CH02' })).toHaveLength(2);
    expect(filtrerEntrees(entrees, EQUIPEMENTS, { chaine: 'CH09' })).toHaveLength(0);
  });

  it('filtre par période', () => {
    const resultat = filtrerEntrees(entrees, EQUIPEMENTS, {
      depuis: '2026-08-10T00:00:00.000Z',
      jusqua: '2026-08-20T00:00:00.000Z',
    });
    expect(resultat).toHaveLength(1);
    expect(resultat[0]!.cause).toBe('Graissage');
  });

  it('filtre par statut', () => {
    expect(filtrerEntrees(entrees, EQUIPEMENTS, { statuts: ['en_attente'] })).toHaveLength(1);
  });

  it('cherche le texte dans les quatre niveaux, sans tenir compte de la casse', () => {
    expect(filtrerEntrees(entrees, EQUIPEMENTS, { texte: 'GRAISSAGE' })).toHaveLength(1);
    expect(filtrerEntrees(entrees, EQUIPEMENTS, { texte: 'capteur' })).toHaveLength(3);
    expect(filtrerEntrees(entrees, EQUIPEMENTS, { texte: 'inexistant' })).toHaveLength(0);
  });

  it('isole les saisies hors nomenclature — indicateur B5', () => {
    const resultat = filtrerEntrees(entrees, EQUIPEMENTS, { seulement_libres: true });
    expect(resultat).toHaveLength(1);
    expect(resultat[0]!.cause).toBe('Usure');
  });

  it('intersecte les critères combinés (UC4)', () => {
    expect(
      filtrerEntrees(entrees, EQUIPEMENTS, { chaine: 'CH02', statuts: ['validee'] }),
    ).toHaveLength(1);
  });
});

/* -------------------------------------------------------------------------- */

describe('construirePareto (B5)', () => {
  it('pondère par la fréquence observée, pas par le nombre de fiches', () => {
    // Deux fiches « Graissage » à 1 pèsent moins qu'une fiche « Nettoyage » à 10.
    const pareto = construirePareto([
      fiche({ cause: 'Nettoyage', frequence_observee: 10 }),
      fiche({ cause: 'Graissage', frequence_observee: 1 }),
      fiche({ cause: 'Graissage', frequence_observee: 1 }),
    ]);

    expect(pareto.lignes[0]!.cause).toBe('Nettoyage');
    expect(pareto.lignes[0]!.occurrences).toBe(10);
    expect(pareto.lignes[1]!.occurrences).toBe(2);
    expect(pareto.total).toBe(12);
  });

  it('regroupe les causes identiques à la casse et aux espaces près', () => {
    const pareto = construirePareto([
      fiche({ cause: 'Absence de nettoyage', frequence_observee: 3 }),
      fiche({ cause: '  ABSENCE de   nettoyage ', frequence_observee: 2 }),
    ]);

    expect(pareto.lignes).toHaveLength(1);
    expect(pareto.lignes[0]!.occurrences).toBe(5);
  });

  it('calcule des parts cumulées croissantes jusqu’à 100 %', () => {
    const pareto = construirePareto([
      fiche({ cause: 'A', frequence_observee: 50 }),
      fiche({ cause: 'B', frequence_observee: 30 }),
      fiche({ cause: 'C', frequence_observee: 20 }),
    ]);

    expect(pareto.lignes.map((l) => Math.round(l.part))).toEqual([50, 30, 20]);
    expect(pareto.lignes.map((l) => Math.round(l.cumul))).toEqual([50, 80, 100]);
  });

  it('inclut dans le seuil la cause qui le fait franchir', () => {
    // 50 + 30 = 80 % : la seconde cause fait partie du vital few.
    const pareto = construirePareto([
      fiche({ cause: 'A', frequence_observee: 50 }),
      fiche({ cause: 'B', frequence_observee: 30 }),
      fiche({ cause: 'C', frequence_observee: 20 }),
    ]);

    expect(pareto.nb_causes_seuil).toBe(2);
    expect(pareto.lignes.map((l) => l.dans_le_seuil)).toEqual([true, true, false]);
  });

  it('regroupe la traîne sous « Autres » au-delà de la limite', () => {
    const entrees = Array.from({ length: 12 }, (_, i) =>
      fiche({ cause: `Cause ${String.fromCharCode(65 + i)}`, frequence_observee: 12 - i }),
    );
    const pareto = construirePareto(entrees, 5);

    expect(pareto.lignes).toHaveLength(6);
    expect(pareto.lignes[5]!.cause).toBe('Autres (7)');
    // Rien n'est perdu : le regroupement ne change pas le total.
    expect(pareto.lignes.reduce((s, l) => s + l.occurrences, 0)).toBe(pareto.total);
    expect(Math.round(pareto.lignes[5]!.cumul)).toBe(100);
  });

  it('renvoie un Pareto vide plutôt que d’échouer — état vide de UC4', () => {
    expect(construirePareto([])).toEqual({ lignes: [], total: 0, nb_causes_seuil: 0 });
  });

  it('ne divise pas par zéro quand toutes les fréquences sont nulles', () => {
    expect(construirePareto([fiche({ frequence_observee: 0 })]).total).toBe(0);
  });
});

/* -------------------------------------------------------------------------- */

describe('mediane', () => {
  it('prend la valeur centrale sur un nombre impair', () => {
    expect(mediane([5, 1, 3])).toBe(3);
  });

  it('moyenne les deux centrales sur un nombre pair', () => {
    expect(mediane([1, 2, 3, 4])).toBe(3); // (2+3)/2 = 2,5 arrondi
  });

  it('résiste à une valeur aberrante, contrairement à la moyenne', () => {
    // Moyenne = 2020 s, médiane = 20 s : c'est la médiane qui décrit le cas courant.
    expect(mediane([10, 20, 30, 10000])).toBe(25);
  });

  it('renvoie null sur un ensemble vide', () => {
    expect(mediane([])).toBeNull();
  });
});

/* -------------------------------------------------------------------------- */

describe('calculerIndicateurs (B5)', () => {
  it('calcule le taux de recours à la nomenclature non contrôlée', () => {
    const indicateurs = calculerIndicateurs(
      [
        fiche({ via_nomenclature: true }),
        fiche({ via_nomenclature: true }),
        fiche({ via_nomenclature: true }),
        fiche({ via_nomenclature: false }),
      ],
      [],
    );

    expect(indicateurs.taux_nomenclature_libre).toBe(25);
    expect(indicateurs.nb_fiches_validees).toBe(4);
  });

  it('ne compte que les fiches validées dans le taux — c’est ce que voit le technicien', () => {
    const indicateurs = calculerIndicateurs(
      [fiche({ via_nomenclature: true }), fiche({ statut: 'en_attente', via_nomenclature: false })],
      [],
    );

    expect(indicateurs.taux_nomenclature_libre).toBe(0);
    expect(indicateurs.nb_en_attente).toBe(1);
  });

  it('compte en_correction parmi les fiches en attente', () => {
    const indicateurs = calculerIndicateurs([fiche({ statut: 'en_correction' })], []);
    expect(indicateurs.nb_en_attente).toBe(1);
  });

  it('calcule le TTDi médian sur les seules interventions ayant atteint T1.5', () => {
    const indicateurs = calculerIndicateurs(
      [],
      [
        intervention({ datetime_cause_confirmee: '2026-08-10T08:05:00.000Z' }), // 300 s
        intervention({ datetime_cause_confirmee: '2026-08-10T08:10:00.000Z' }), // 600 s
        intervention({ datetime_cause_confirmee: '2026-08-10T08:15:00.000Z' }), // 900 s
        intervention(), // T1.5 non atteint : exclue
      ],
    );

    expect(indicateurs.ttdi_median_secondes).toBe(600);
    expect(indicateurs.nb_interventions).toBe(4);
    expect(indicateurs.nb_interventions_ouvertes).toBe(4);
  });

  it('calcule la durée totale médiane sur les seules interventions clôturées', () => {
    const indicateurs = calculerIndicateurs(
      [],
      [
        intervention({ datetime_cloture: '2026-08-10T08:30:00.000Z' }), // 1800 s
        intervention({ datetime_cloture: '2026-08-10T09:00:00.000Z' }), // 3600 s
        intervention(),
      ],
    );

    expect(indicateurs.duree_mediane_secondes).toBe(2700);
    expect(indicateurs.nb_interventions_ouvertes).toBe(1);
  });

  it('renvoie des indicateurs neutres sur un ensemble vide, sans lever', () => {
    const indicateurs = calculerIndicateurs([], []);

    expect(indicateurs.taux_nomenclature_libre).toBe(0);
    expect(indicateurs.ttdi_median_secondes).toBeNull();
    expect(indicateurs.duree_mediane_secondes).toBeNull();
  });
});
