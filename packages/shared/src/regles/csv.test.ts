import { describe, expect, it } from 'vitest';

import {
  analyserCsv,
  decouperLigne,
  detecterSeparateur,
  extraireEquipements,
  proposerRattachement,
} from './csv.js';

describe('detecterSeparateur', () => {
  it('reconnaît le point-virgule — export Excel francophone', () => {
    expect(detecterSeparateur('Nom;Famille;Chaine\nSoutireuse;Remplissage;CH02')).toBe(';');
  });

  it('reconnaît la virgule', () => {
    expect(detecterSeparateur('Nom,Famille,Chaine\nSoutireuse,Remplissage,CH02')).toBe(',');
  });

  it('reconnaît la tabulation', () => {
    expect(detecterSeparateur('Nom\tFamille\tChaine\nSoutireuse\tRemplissage\tCH02')).toBe('\t');
  });

  it('préfère le séparateur dont le nombre de colonnes est CONSTANT', () => {
    // Des virgules dans les libellés donneraient un compte irrégulier.
    const csv = 'Nom;Famille;Chaine\nVis, écrous et boulons;Visserie;CH02\nSoutireuse;Remplissage;CH05';
    expect(detecterSeparateur(csv)).toBe(';');
  });

  it('ne plante pas sur un contenu vide', () => {
    expect(detecterSeparateur('')).toBe(';');
  });
});

describe('decouperLigne', () => {
  it('respecte les guillemets encadrant un séparateur', () => {
    expect(decouperLigne('"Soutireuse; boucheuse";Remplissage;CH02', ';')).toEqual([
      'Soutireuse; boucheuse',
      'Remplissage',
      'CH02',
    ]);
  });

  it('interprète le guillemet doublé comme un guillemet littéral', () => {
    expect(decouperLigne('"Vanne ""DN50""";Robinetterie', ';')).toEqual(['Vanne "DN50"', 'Robinetterie']);
  });

  it('conserve les champs vides', () => {
    expect(decouperLigne('Soutireuse;;CH02', ';')).toEqual(['Soutireuse', '', 'CH02']);
  });
});

describe('analyserCsv', () => {
  it('retire le BOM UTF-8 ajouté par Excel', () => {
    const analyse = analyserCsv('﻿Nom;Chaine\nSoutireuse;CH02');
    expect(analyse.colonnes[0]).toBe('Nom');
  });

  it('complète les lignes trop courtes et écarte les trop longues', () => {
    const analyse = analyserCsv('Nom;Famille;Chaine\nSoutireuse;Remplissage\nA;B;C;D\nÉtiqueteuse;Étiquetage;CH02');
    expect(analyse.lignes).toHaveLength(2);
    expect(analyse.lignes[0]).toEqual(['Soutireuse', 'Remplissage', '']);
    expect(analyse.lignes_ignorees).toBe(1);
  });

  it('ignore les lignes vides', () => {
    const analyse = analyserCsv('Nom;Chaine\n\nSoutireuse;CH02\n\n');
    expect(analyse.lignes).toHaveLength(1);
  });

  it('renvoie une analyse vide sur un fichier vide, sans lever', () => {
    expect(analyserCsv('').colonnes).toEqual([]);
  });
});

describe('proposerRattachement', () => {
  it('reconnaît les intitulés usuels', () => {
    expect(proposerRattachement(['Nom', 'Famille', 'Chaine'])).toEqual({
      nom: 0,
      famille: 1,
      chaine: 2,
    });
  });

  it('ignore les accents et la casse', () => {
    expect(proposerRattachement(['DÉSIGNATION', 'Catégorie', 'Chaîne'])).toEqual({
      nom: 0,
      famille: 1,
      chaine: 2,
    });
  });

  it('accepte des synonymes DimoMaint plausibles', () => {
    expect(proposerRattachement(['Libellé équipement', 'Type', 'Ligne'])).toEqual({
      nom: 0,
      famille: 1,
      chaine: 2,
    });
  });

  it('laisse à null ce qu’il ne reconnaît pas', () => {
    const r = proposerRattachement(['Code interne', 'Zzz']);
    expect(r.nom).toBeNull();
    expect(r.chaine).toBeNull();
  });

  it('n’attribue jamais deux fois la même colonne', () => {
    const r = proposerRattachement(['Machine', 'Machine']);
    const attribues = Object.values(r).filter((v) => v !== null);
    expect(new Set(attribues).size).toBe(attribues.length);
  });
});

describe('extraireEquipements', () => {
  const rattachement = { nom: 0, famille: 1, chaine: 2 };

  it('extrait les lignes valides', () => {
    const analyse = analyserCsv('Nom;Famille;Chaine\nSoutireuse;Remplissage;CH02\nÉtiqueteuse;Étiquetage;CH05');
    const { equipements, rejets } = extraireEquipements(analyse, rattachement);

    expect(rejets).toHaveLength(0);
    expect(equipements).toEqual([
      { nom: 'Soutireuse', famille: 'Remplissage', chaine: 'CH02' },
      { nom: 'Étiqueteuse', famille: 'Étiquetage', chaine: 'CH05' },
    ]);
  });

  it('met la chaîne en majuscules', () => {
    const analyse = analyserCsv('Nom;Famille;Chaine\nSoutireuse;Remplissage;ch02');
    expect(extraireEquipements(analyse, rattachement).equipements[0]!.chaine).toBe('CH02');
  });

  it('écarte les doublons internes au fichier', () => {
    // Un export DimoMaint liste souvent une ligne par composant.
    const analyse = analyserCsv(
      'Nom;Famille;Chaine\nSoutireuse;Remplissage;CH02\nSoutireuse;Remplissage;CH02\nsoutireuse;Remplissage;CH02',
    );
    expect(extraireEquipements(analyse, rattachement).equipements).toHaveLength(1);
  });

  it('distingue le même nom sur deux chaînes', () => {
    const analyse = analyserCsv('Nom;Famille;Chaine\nSoutireuse;Remplissage;CH02\nSoutireuse;Remplissage;CH05');
    expect(extraireEquipements(analyse, rattachement).equipements).toHaveLength(2);
  });

  it('rejette les lignes sans nom ou sans chaîne, en donnant le numéro', () => {
    const analyse = analyserCsv('Nom;Famille;Chaine\n;Remplissage;CH02\nÉtiqueteuse;Étiquetage;');
    const { equipements, rejets } = extraireEquipements(analyse, rattachement);

    expect(equipements).toHaveLength(0);
    expect(rejets).toEqual([
      { ligne: 1, motif: 'Nom d’équipement vide.' },
      { ligne: 2, motif: 'Chaîne vide.' },
    ]);
  });

  it('remplace une famille absente par une valeur explicite', () => {
    const analyse = analyserCsv('Nom;Chaine\nSoutireuse;CH02');
    const { equipements } = extraireEquipements(analyse, { nom: 0, famille: null, chaine: 1 });
    expect(equipements[0]!.famille).toBe('Non renseignée');
  });

  it('refuse de travailler sans colonne nom ou chaîne', () => {
    const analyse = analyserCsv('Nom;Famille\nSoutireuse;Remplissage');
    const { rejets } = extraireEquipements(analyse, { nom: 0, famille: 1, chaine: null });
    expect(rejets[0]!.motif).toMatch(/requises/);
  });
});
