/**
 * Libellés du diagramme de Pareto — la figure centrale du mémoire.
 *
 * L'ancienne version coupait à quinze caractères sans égard aux mots :
 * « déformations thermique du châssis » devenait « déformations th… », une
 * barre sans légende exploitable.
 */

import { describe, expect, it } from 'vitest';

import { couperEnLignes } from './TableauBordPage.js';

describe('couperEnLignes', () => {
  it('laisse intact un libellé qui tient sur une ligne', () => {
    expect(couperEnLignes('Palier grippé', 20, 3)).toEqual(['Palier grippé']);
  });

  it('coupe entre les mots, jamais au milieu', () => {
    const lignes = couperEnLignes('déformations thermique du châssis', 16, 3);

    expect(lignes).toEqual(['déformations', 'thermique du', 'châssis']);
    for (const ligne of lignes) expect(ligne.length).toBeLessThanOrEqual(16);
  });

  it('marque d’une ellipse ce qui ne tient pas dans le nombre de lignes', () => {
    const lignes = couperEnLignes(
      'défaut de lubrification du réducteur principal de la soutireuse',
      14,
      2,
    );

    expect(lignes).toHaveLength(2);
    expect(lignes[1]!.endsWith('…')).toBe(true);
  });

  it('n’ajoute pas d’ellipse quand tout le texte est passé', () => {
    const lignes = couperEnLignes('Courroie détendue', 10, 3);
    expect(lignes.join(' ')).toBe('Courroie détendue');
    expect(lignes.some((l) => l.includes('…'))).toBe(false);
  });

  /**
   * Un mot indivisible plus long que la ligne déborde visiblement plutôt que
   * d'être tranché : une coupe silencieuse inventerait un terme technique qui
   * n'existe pas — « électrovan » pour « électrovanne ».
   */
  it('ne tranche pas un mot plus long que la ligne', () => {
    expect(couperEnLignes('électrovanne', 6, 3)).toEqual(['électrovanne']);
  });

  it('rend un tableau vide sur un libellé vide, sans planter', () => {
    expect(couperEnLignes('', 16, 3)).toEqual([]);
  });

  it('respecte le plafond de lignes demandé', () => {
    const lignes = couperEnLignes('un deux trois quatre cinq six sept huit neuf dix', 8, 3);
    expect(lignes.length).toBeLessThanOrEqual(3);
  });
});
