/**
 * Relève les couleurs de marque dans un logo bitmap.
 *
 * Le PNG fourni porte des artefacts de compression : aucune zone n'est d'une
 * couleur strictement uniforme, si bien qu'un simple comptage de pixels
 * identiques ne remonte que du bruit. On classe donc les pixels par teinte,
 * puis on prend la moyenne des plus saturés de chaque famille — le cœur des
 * aplats, là où la compression a le moins dérivé.
 *
 *   node scripts/analyser-logo.mjs design/logo/maintxpert.png
 */

import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';

const chemin = process.argv[2];
if (!chemin) {
  console.error('Usage : node scripts/analyser-logo.mjs <fichier.png>');
  process.exit(1);
}

const png = PNG.sync.read(readFileSync(chemin));
const { width: W, height: H, data } = png;

const hex = (r, g, b) =>
  '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0').toUpperCase()).join('');

const luminance = (r, g, b) => {
  const c = [r, g, b].map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contrasteSurBlanc = (r, g, b) => 1.05 / (luminance(r, g, b) + 0.05);

/** Saturation au sens HSL, en pourcentage. */
const saturation = (r, g, b) => {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  if (max === min) return 0;
  const l = (max + min) / 2;
  return ((max - min) / (l > 0.5 ? 2 - max - min : max + min)) * 100;
};

const familles = { bleu: [], orange: [], sombre: [] };

for (let y = 0; y < H; y += 1) {
  for (let x = 0; x < W; x += 1) {
    const i = (y * W + x) * 4;
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
    if (a < 250) continue;

    const sat = saturation(r, g, b);
    const lum = luminance(r, g, b);
    const pixel = { r, g, b, x, sat, lum };

    if (b > r + 35 && sat > 25) familles.bleu.push(pixel);
    else if (r > b + 50 && r > g + 20 && sat > 35) familles.orange.push(pixel);
    else if (sat < 22 && lum < 0.08) familles.sombre.push(pixel);
  }
}

/** Moyenne des `part` pixels les plus saturés d'une famille. */
function noyau(pixels, part = 0.25) {
  if (pixels.length === 0) return null;
  const tries = [...pixels].sort((p, q) => q.sat - p.sat);
  const retenus = tries.slice(0, Math.max(1, Math.round(tries.length * part)));
  const moy = (cle) => retenus.reduce((s, p) => s + p[cle], 0) / retenus.length;
  return { r: moy('r'), g: moy('g'), b: moy('b'), n: pixels.length, xMoyen: moy('x') };
}

/** Le bleu se décline en deux tons : on sépare par luminance. */
function separerParLuminance(pixels) {
  if (pixels.length === 0) return { clair: null, fonce: null };
  const lums = pixels.map((p) => p.lum).sort((a, b) => a - b);
  const mediane = lums[Math.floor(lums.length / 2)];
  return {
    fonce: noyau(pixels.filter((p) => p.lum <= mediane), 0.4),
    clair: noyau(pixels.filter((p) => p.lum > mediane), 0.4),
  };
}

console.log(`\nFichier    : ${chemin}`);
console.log(`Dimensions : ${W} × ${H} px\n`);

const bleus = separerParLuminance(familles.bleu);
const lignes = [
  ['Bleu clair (pictogramme)', bleus.clair],
  ['Bleu foncé (pictogramme, mot-symbole)', bleus.fonce],
  ['Orange (le « X »)', noyau(familles.orange, 0.3)],
  ['Sombre (texte)', noyau(familles.sombre, 0.5)],
];

console.log('couleur                                 hex        px     contraste/blanc');
for (const [nom, c] of lignes) {
  if (!c) {
    console.log(`${nom.padEnd(38)}  — absente`);
    continue;
  }
  console.log(
    `${nom.padEnd(38)}  ${hex(c.r, c.g, c.b)}  ${String(c.n).padStart(5)}  ${contrasteSurBlanc(c.r, c.g, c.b).toFixed(2).padStart(14)}`,
  );
}

// Frontière pictogramme / mot-symbole : la colonne la plus vide entre les deux.
const densite = new Array(W).fill(0);
for (let x = 0; x < W; x += 1) {
  for (let y = 0; y < H; y += 1) {
    const i = (y * W + x) * 4;
    if (data[i + 3] >= 250 && !(data[i] > 240 && data[i + 1] > 240 && data[i + 2] > 240)) densite[x] += 1;
  }
}
let coupure = 0;
let minDensite = Infinity;
for (let x = Math.round(W * 0.15); x < Math.round(W * 0.45); x += 1) {
  if (densite[x] < minDensite) { minDensite = densite[x]; coupure = x; }
}
console.log(`\nSéparation pictogramme / mot-symbole : x ≈ ${coupure} (densité ${minDensite})`);
console.log('Seuils WCAG : 4,5 texte courant · 3,0 gros texte et composants · 7,0 AAA\n');
