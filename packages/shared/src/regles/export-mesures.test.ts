import { describe, expect, it } from 'vitest';

import type { Equipement, Intervention } from '../types/entites.js';
import { calculerMesures, exporterMesuresCsv, nomFichierExport } from './export-mesures.js';

const EQUIPEMENTS: Equipement[] = [
  { id_equipement: 10, nom: 'Soutireuse-boucheuse', famille: 'Remplissage', chaine: 'CH02' },
  { id_equipement: 20, nom: 'Étiqueteuse « Krones »', famille: 'Étiquetage', chaine: 'CH05' },
];

function intervention(partiel: Partial<Intervention> = {}): Intervention {
  return {
    id_intervention: 1,
    id_technicien: 7,
    id_equipement: 10,
    id_sdcr: 1,
    datetime_ouverture: '2026-08-20T22:14:00.000Z',
    datetime_cause_confirmee: '2026-08-20T22:20:00.000Z',
    datetime_cloture: '2026-08-20T22:41:00.000Z',
    ...partiel,
  };
}

describe('calculerMesures', () => {
  it('calcule TTDi et durée totale à partir des trois jalons', () => {
    const [mesure] = calculerMesures([intervention()], EQUIPEMENTS);

    expect(mesure!.ttdi_secondes).toBe(360); // 6 min
    expect(mesure!.duree_totale_secondes).toBe(1620); // 27 min
    expect(mesure!.complete).toBe(true);
  });

  it('laisse les mesures à null quand un jalon manque, sans exclure la ligne', () => {
    const [mesure] = calculerMesures(
      [intervention({ datetime_cause_confirmee: null, datetime_cloture: null })],
      EQUIPEMENTS,
    );

    expect(mesure!.ttdi_secondes).toBeNull();
    expect(mesure!.duree_totale_secondes).toBeNull();
    // La ligne reste dans l'export : une intervention sans T1.5 est une donnée
    // du protocole, pas un déchet à masquer.
    expect(mesure!.complete).toBe(false);
  });

  it('marque incomplète une intervention clôturée sans cause confirmée', () => {
    const [mesure] = calculerMesures([intervention({ datetime_cause_confirmee: null })], EQUIPEMENTS);
    expect(mesure!.complete).toBe(false);
    expect(mesure!.duree_totale_secondes).toBe(1620);
  });

  /**
   * Sans cette distinction, le taux d'incomplétude rapporté dans le mémoire
   * mélangerait deux situations opposées : le technicien qui a documenté une
   * fiche parce qu'aucune n'existait, et celui qui n'a rien conclu.
   */
  describe('issue de l’intervention', () => {
    it('cause_confirmee quand T1.5 est posé', () => {
      const [mesure] = calculerMesures([intervention()], EQUIPEMENTS);
      expect(mesure!.issue).toBe('cause_confirmee');
    });

    it('fiche_documentee quand T1.5 manque mais qu’une fiche a été produite (A6)', () => {
      const [mesure] = calculerMesures(
        [intervention({ datetime_cause_confirmee: null, id_sdcr: 42 })],
        EQUIPEMENTS,
      );

      expect(mesure!.issue).toBe('fiche_documentee');
      expect(mesure!.id_sdcr).toBe(42);
      // Le diagnostic a abouti, mais le TTDi reste non mesuré : c'est assumé.
      expect(mesure!.ttdi_secondes).toBeNull();
      expect(mesure!.complete).toBe(false);
    });

    it('sans_conclusion quand il n’y a ni jalon ni fiche', () => {
      const [mesure] = calculerMesures(
        [intervention({ datetime_cause_confirmee: null, id_sdcr: null })],
        EQUIPEMENTS,
      );
      expect(mesure!.issue).toBe('sans_conclusion');
    });
  });

  it('résout chaîne et équipement', () => {
    const [mesure] = calculerMesures([intervention({ id_equipement: 20 })], EQUIPEMENTS);
    expect(mesure!.chaine).toBe('CH05');
    expect(mesure!.equipement).toBe('Étiqueteuse « Krones »');
  });

  it('ne plante pas sur un équipement absent du référentiel', () => {
    const [mesure] = calculerMesures([intervention({ id_equipement: 999 })], EQUIPEMENTS);
    expect(mesure!.chaine).toBe('');
  });

  it('trie chronologiquement — l’ordre du protocole', () => {
    const mesures = calculerMesures(
      [
        intervention({ id_intervention: 2, datetime_ouverture: '2026-08-21T08:00:00.000Z' }),
        intervention({ id_intervention: 1, datetime_ouverture: '2026-08-20T08:00:00.000Z' }),
      ],
      EQUIPEMENTS,
    );
    expect(mesures.map((m) => m.id_intervention)).toEqual([1, 2]);
  });
});

describe('exporterMesuresCsv', () => {
  it('commence par un BOM UTF-8 — sans lui Excel massacre les accents', () => {
    expect(exporterMesuresCsv([], EQUIPEMENTS).startsWith('﻿')).toBe(true);
  });

  it('produit un en-tête même sans donnée', () => {
    const csv = exporterMesuresCsv([], EQUIPEMENTS);
    expect(csv).toContain('id_intervention;chaine;equipement');
    expect(csv.trim().split('\r\n')).toHaveLength(1);
  });

  it('sépare par point-virgule et utilise la virgule décimale', () => {
    const csv = exporterMesuresCsv([intervention()], EQUIPEMENTS);
    const ligne = csv.trim().split('\r\n')[1]!;

    expect(ligne.split(';')[0]).toBe('1');
    // 360 s = 6,0 min — virgule, pas point : Excel francophone lirait « 6.0 » comme du texte.
    expect(ligne).toContain(';360;6,0;');
    expect(ligne).toContain(';1620;27,0;');
    expect(ligne.endsWith(';oui;1;cause_confirmee')).toBe(true);
  });

  it('échappe un libellé contenant le séparateur ou des guillemets', () => {
    const equipements: Equipement[] = [
      { id_equipement: 10, nom: 'Laveuse; type "2000"', famille: 'Lavage', chaine: 'CH02' },
    ];
    const ligne = exporterMesuresCsv([intervention()], equipements).trim().split('\r\n')[1]!;

    expect(ligne).toContain('"Laveuse; type ""2000"""');
    // Le champ échappé ne doit pas créer de colonnes supplémentaires.
    expect(ligne.split('"')[0]!.split(';').filter(Boolean)).toHaveLength(2);
  });

  it('laisse les cellules vides pour les jalons non atteints', () => {
    const ligne = exporterMesuresCsv(
      [intervention({ datetime_cause_confirmee: null, datetime_cloture: null })],
      EQUIPEMENTS,
    )
      .trim()
      .split('\r\n')[1]!;

    expect(ligne).toContain(';;;;;;non');
  });

  it('termine chaque ligne par CRLF', () => {
    expect(exporterMesuresCsv([intervention()], EQUIPEMENTS).endsWith('\r\n')).toBe(true);
  });
});

describe('nomFichierExport', () => {
  it('horodate le nom pour que deux exports ne s’écrasent pas', () => {
    const nom = nomFichierExport(new Date(2026, 7, 23, 9, 5));
    expect(nom).toBe('maintxpert-mesures-20260823-0905.csv');
  });
});
