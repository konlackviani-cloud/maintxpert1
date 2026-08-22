/**
 * Génère les icônes PWA à partir du logo MaintXpert.
 *
 * Le logo est empilé : pictogramme (engrenage + silhouette) au-dessus,
 * mot-symbole « maintXpert » en dessous. Une icône d'application est carrée —
 * le mot-symbole y serait illisible. On ne garde donc que le pictogramme,
 * détouré, centré, sur fond blanc comme dans le logo d'origine.
 *
 * Rééchantillonnage par moyenne de boîte : la réduction depuis un bitmap de
 * 215 px de large vers 512 px n'a rien à gagner d'un filtre plus savant, et
 * l'agrandissement reste flou de toute façon — c'est la limite de la source.
 * Un SVG donnerait des icônes nettes ; voir docs/03-decisions.md (O10).
 *
 *   npm run icones
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = join(RACINE, 'design', 'logo', 'maintxpert.png');
const DESTINATION = join(RACINE, 'apps', 'web', 'public', 'icones');

/**
 * Cadre du pictogramme dans le logo, relevé par analyse de densité puis vérifié
 * visuellement à la loupe.
 *
 * Le bas est à y=40, pas plus : le « X » de maintXpert est un grand X bleu qui
 * remonte jusque sous l'engrenage. Descendre le cadre plus bas capture le haut
 * de cette lettre et produit des traits parasites dans l'icône.
 */
const PICTOGRAMME = { x: 53, y: 2, largeur: 109, hauteur: 38 };

const FOND = [255, 255, 255];

const logo = PNG.sync.read(readFileSync(SOURCE));

/**
 * @param taille  Côté de l'icône produite, en pixels.
 * @param marge   Fraction du côté laissée vide autour du pictogramme.
 *                ~0.10 pour une icône pleine, ~0.26 pour une maskable
 *                (zone sûre d'Android : le système peut rogner les bords).
 */
function composer(taille, marge) {
  const sortie = new PNG({ width: taille, height: taille });

  for (let i = 0; i < sortie.data.length; i += 4) {
    sortie.data[i] = FOND[0];
    sortie.data[i + 1] = FOND[1];
    sortie.data[i + 2] = FOND[2];
    sortie.data[i + 3] = 255;
  }

  // Le pictogramme est large et bas : c'est la largeur qui contraint.
  const disponible = taille * (1 - 2 * marge);
  const echelle = Math.min(disponible / PICTOGRAMME.largeur, disponible / PICTOGRAMME.hauteur);
  const largeurCible = Math.round(PICTOGRAMME.largeur * echelle);
  const hauteurCible = Math.round(PICTOGRAMME.hauteur * echelle);
  const decalageX = Math.round((taille - largeurCible) / 2);
  const decalageY = Math.round((taille - hauteurCible) / 2);

  for (let y = 0; y < hauteurCible; y += 1) {
    for (let x = 0; x < largeurCible; x += 1) {
      // Boîte source correspondant à ce pixel de destination.
      const x0 = PICTOGRAMME.x + (x / largeurCible) * PICTOGRAMME.largeur;
      const x1 = PICTOGRAMME.x + ((x + 1) / largeurCible) * PICTOGRAMME.largeur;
      const y0 = PICTOGRAMME.y + (y / hauteurCible) * PICTOGRAMME.hauteur;
      const y1 = PICTOGRAMME.y + ((y + 1) / hauteurCible) * PICTOGRAMME.hauteur;

      let r = 0, v = 0, b = 0, n = 0;
      for (let sy = Math.floor(y0); sy < Math.max(Math.ceil(y1), Math.floor(y0) + 1); sy += 1) {
        for (let sx = Math.floor(x0); sx < Math.max(Math.ceil(x1), Math.floor(x0) + 1); sx += 1) {
          if (sx < 0 || sy < 0 || sx >= logo.width || sy >= logo.height) continue;
          const i = (sy * logo.width + sx) * 4;
          const alpha = logo.data[i + 3] / 255;
          // Aplatir sur blanc : le logo peut porter de la transparence.
          r += logo.data[i] * alpha + FOND[0] * (1 - alpha);
          v += logo.data[i + 1] * alpha + FOND[1] * (1 - alpha);
          b += logo.data[i + 2] * alpha + FOND[2] * (1 - alpha);
          n += 1;
        }
      }
      if (n === 0) continue;

      const j = ((decalageY + y) * taille + (decalageX + x)) * 4;
      sortie.data[j] = Math.round(r / n);
      sortie.data[j + 1] = Math.round(v / n);
      sortie.data[j + 2] = Math.round(b / n);
      sortie.data[j + 3] = 255;
    }
  }

  return PNG.sync.write(sortie);
}

mkdirSync(DESTINATION, { recursive: true });

/*
 * Marges volontairement faibles : le pictogramme est un demi-engrenage large et
 * bas (rapport ~2,9:1), coupé par le mot-symbole dans le logo d'origine. Dans un
 * cadre carré il occupe forcément une bande centrale ; réduire la marge est le
 * seul levier disponible tant qu'il n'existe pas de version carrée du symbole.
 */
const fichiers = [
  ['favicon-32.png', composer(32, 0.02)],
  ['icone-180.png', composer(180, 0.05)],
  ['icone-192.png', composer(192, 0.05)],
  ['icone-512.png', composer(512, 0.05)],
  ['icone-maskable-512.png', composer(512, 0.18)],
];

for (const [nom, contenu] of fichiers) {
  writeFileSync(join(DESTINATION, nom), contenu);
  console.log(`écrit  apps/web/public/icones/${nom}  (${contenu.length} octets)`);
}
