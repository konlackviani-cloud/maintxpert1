/**
 * Génère les icônes PNG du manifeste PWA sans dépendance externe.
 *
 * Icônes PROVISOIRES : aplat bleu industriel + glyphe « M » et bandeau, suffisant
 * pour rendre la PWA installable sur Android. À remplacer par l'identité visuelle
 * définitive avant la mise en service.
 *
 * Usage : npm run icones
 */

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const DOSSIER = join(RACINE, 'apps', 'web', 'public', 'icones');

const BLEU = [0x14, 0x53, 0x9a];
const BLANC = [0xff, 0xff, 0xff];

/* --- Encodage PNG minimal (RGB 8 bits, non entrelacé) --------------------- */

const TABLE_CRC = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const octet of buffer) c = TABLE_CRC[(c ^ octet) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, donnees) {
  const nom = Buffer.from(type, 'ascii');
  const longueur = Buffer.alloc(4);
  longueur.writeUInt32BE(donnees.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([nom, donnees])));
  return Buffer.concat([longueur, nom, donnees, crc]);
}

function encoderPng(largeur, hauteur, pixels) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(largeur, 0);
  ihdr.writeUInt32BE(hauteur, 4);
  ihdr[8] = 8; // profondeur
  ihdr[9] = 2; // type couleur : RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filtre
  ihdr[12] = 0; // entrelacement

  // Une ligne = 1 octet de filtre (0 = aucun) + largeur * 3 octets.
  const brut = Buffer.alloc(hauteur * (1 + largeur * 3));
  for (let y = 0; y < hauteur; y += 1) {
    const debut = y * (1 + largeur * 3);
    brut[debut] = 0;
    pixels.copy(brut, debut + 1, y * largeur * 3, (y + 1) * largeur * 3);
  }

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(brut, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* --- Dessin ---------------------------------------------------------------- */

/**
 * @param taille  Côté de l'icône en pixels.
 * @param marge   Fraction du côté laissée vide en périphérie.
 *                0 pour une icône pleine, ~0.18 pour une maskable (zone sûre Android).
 */
function dessinerIcone(taille, marge) {
  const pixels = Buffer.alloc(taille * taille * 3);
  const poser = (x, y, [r, v, b]) => {
    const i = (y * taille + x) * 3;
    pixels[i] = r;
    pixels[i + 1] = v;
    pixels[i + 2] = b;
  };

  const bord = Math.round(taille * marge);
  const interieur = taille - 2 * bord;
  const rayon = Math.round(interieur * 0.18);

  for (let y = 0; y < taille; y += 1) {
    for (let x = 0; x < taille; x += 1) {
      const dx = x - bord;
      const dy = y - bord;
      const dansCarre = dx >= 0 && dy >= 0 && dx < interieur && dy < interieur;

      // Coins arrondis.
      let dansForme = dansCarre;
      if (dansCarre) {
        const cx = dx < rayon ? rayon : dx > interieur - rayon ? interieur - rayon : dx;
        const cy = dy < rayon ? rayon : dy > interieur - rayon ? interieur - rayon : dy;
        dansForme = (dx - cx) ** 2 + (dy - cy) ** 2 <= rayon ** 2;
      }

      poser(x, y, dansForme ? BLEU : BLANC);
    }
  }

  // Glyphe « M » : trois traits (deux montants + un chevron), en blanc.
  const trait = Math.max(2, Math.round(interieur * 0.1));
  const hautM = bord + Math.round(interieur * 0.3);
  const basM = bord + Math.round(interieur * 0.7);
  const gaucheM = bord + Math.round(interieur * 0.28);
  const droiteM = bord + Math.round(interieur * 0.72);
  const milieuM = Math.round((gaucheM + droiteM) / 2);

  const traitVertical = (x) => {
    for (let y = hautM; y <= basM; y += 1) {
      for (let e = 0; e < trait; e += 1) poser(x + e, y, BLANC);
    }
  };
  const traitDiagonal = (xDepart, xArrivee) => {
    const pas = xArrivee > xDepart ? 1 : -1;
    const longueur = Math.abs(xArrivee - xDepart);
    for (let i = 0; i <= longueur; i += 1) {
      const x = xDepart + i * pas;
      const y = hautM + Math.round((i / longueur) * (basM - hautM) * 0.55);
      for (let e = 0; e < trait; e += 1) poser(x, Math.min(y + e, taille - 1), BLANC);
    }
  };

  traitVertical(gaucheM);
  traitVertical(droiteM - trait);
  traitDiagonal(gaucheM, milieuM);
  traitDiagonal(droiteM - trait, milieuM);

  return encoderPng(taille, taille, pixels);
}

/* --- Écriture -------------------------------------------------------------- */

mkdirSync(DOSSIER, { recursive: true });

const fichiers = [
  ['icone-192.png', dessinerIcone(192, 0.04)],
  ['icone-512.png', dessinerIcone(512, 0.04)],
  ['icone-maskable-512.png', dessinerIcone(512, 0.18)],
];

for (const [nom, contenu] of fichiers) {
  writeFileSync(join(DOSSIER, nom), contenu);
  console.log(`écrit  ${join('apps', 'web', 'public', 'icones', nom)}  (${contenu.length} octets)`);
}
