/**
 * Compression des photos, côté client — spécification du cahier des charges.
 *
 *   1. redimensionnement à 1600 px de côté maximum ;
 *   2. encodage WebP qualité 78 %, repli JPEG si WebP indisponible ;
 *   3. si le résultat dépasse 400 Ko, recompression à 70 % ;
 *   4. une seule photo par fiche SDCR ou CSD.
 *
 * Pourquoi côté client : le technicien photographie hors réseau, souvent en 4G
 * dégradée. Une photo de 4 Mo mise en file d'attente resterait bloquée des
 * heures et retarderait tout ce qui la suit.
 *
 * Les fonctions de décision sont pures et exportées séparément : elles sont
 * testables sans navigateur, contrairement à l'encodage lui-même.
 */

import { PHOTO } from '@maintxpert/shared';

/* -------------------------------------------------------------------------- */
/* Décisions — pures, testables hors navigateur                                */
/* -------------------------------------------------------------------------- */

export interface Dimensions {
  largeur: number;
  hauteur: number;
}

/**
 * Dimensions après redimensionnement, proportions conservées.
 *
 * Une image déjà plus petite que le plafond n'est **jamais agrandie** :
 * agrandir n'ajoute aucune information et gonfle le fichier, à rebours de
 * l'objectif.
 */
export function calculerDimensions(
  source: Dimensions,
  coteMax: number = PHOTO.COTE_MAX_PX,
): Dimensions {
  const { largeur, hauteur } = source;
  if (largeur <= 0 || hauteur <= 0) return { largeur: 0, hauteur: 0 };

  const cotePlusGrand = Math.max(largeur, hauteur);
  if (cotePlusGrand <= coteMax) return { largeur, hauteur };

  const facteur = coteMax / cotePlusGrand;
  return {
    largeur: Math.max(1, Math.round(largeur * facteur)),
    hauteur: Math.max(1, Math.round(hauteur * facteur)),
  };
}

/** Le résultat justifie-t-il une seconde passe à qualité réduite ? */
export function doitRecompresser(
  tailleOctets: number,
  seuil: number = PHOTO.TAILLE_CIBLE_OCTETS,
): boolean {
  return tailleOctets > seuil;
}

/**
 * Format d'encodage retenu.
 * WebP est nettement plus efficace à qualité perçue égale ; le repli JPEG
 * couvre les terminaux anciens, encore courants sur un parc BYOD.
 */
export function choisirFormat(webpDisponible: boolean): string {
  return webpDisponible ? PHOTO.FORMAT_CIBLE : PHOTO.FORMAT_REPLI;
}

/** Formatage court d'une taille de fichier, pour l'affichage terrain. */
export function formaterTaille(octets: number): string {
  if (octets < 1024) return `${octets} o`;
  if (octets < 1024 * 1024) return `${Math.round(octets / 1024)} Ko`;
  return `${(octets / (1024 * 1024)).toFixed(1)} Mo`;
}

/* -------------------------------------------------------------------------- */
/* Encodage — nécessite le navigateur                                          */
/* -------------------------------------------------------------------------- */

export interface PhotoCompressee {
  blob: Blob;
  type_mime: string;
  largeur: number;
  hauteur: number;
  taille_octets: number;
  /** Qualité effectivement appliquée : 0,78 ou 0,70 après recompression. */
  qualite: number;
  /** `true` si la seconde passe a été nécessaire. */
  recompressee: boolean;
  /** Taille du fichier d'origine, pour informer le technicien. */
  taille_origine_octets: number;
}

/** Le navigateur sait-il encoder en WebP ? Testé une fois, mémorisé. */
let webpDisponible: boolean | null = null;

export function supporteWebp(): boolean {
  if (webpDisponible !== null) return webpDisponible;
  try {
    const canevas = document.createElement('canvas');
    canevas.width = 1;
    canevas.height = 1;
    webpDisponible = canevas.toDataURL('image/webp').startsWith('data:image/webp');
  } catch {
    webpDisponible = false;
  }
  return webpDisponible;
}

/** Encode un canevas vers un Blob. `toBlob` n'a pas d'équivalent promis. */
function versBlob(canevas: HTMLCanvasElement, type: string, qualite: number): Promise<Blob> {
  return new Promise((resoudre, rejeter) => {
    canevas.toBlob(
      (blob) => (blob ? resoudre(blob) : rejeter(new Error('Encodage de la photo impossible.'))),
      type,
      qualite,
    );
  });
}

/** Décode le fichier en bitmap, avec repli sur <img> pour les navigateurs anciens. */
async function decoder(fichier: Blob): Promise<{ source: CanvasImageSource } & Dimensions> {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(fichier);
    return { source: bitmap, largeur: bitmap.width, hauteur: bitmap.height };
  }

  const url = URL.createObjectURL(fichier);
  try {
    const image = await new Promise<HTMLImageElement>((resoudre, rejeter) => {
      const img = new Image();
      img.onload = () => resoudre(img);
      img.onerror = () => rejeter(new Error('Fichier image illisible.'));
      img.src = url;
    });
    return { source: image, largeur: image.naturalWidth, hauteur: image.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Applique la chaîne complète à une photo prise par le technicien.
 *
 * @throws si le fichier n'est pas une image lisible.
 */
export async function compresserPhoto(fichier: Blob): Promise<PhotoCompressee> {
  const tailleOrigine = fichier.size;
  const { source, largeur, hauteur } = await decoder(fichier);
  const cible = calculerDimensions({ largeur, hauteur });

  const canevas = document.createElement('canvas');
  canevas.width = cible.largeur;
  canevas.height = cible.hauteur;

  const contexte = canevas.getContext('2d');
  if (!contexte) throw new Error('Traitement de la photo impossible sur ce terminal.');

  // Lissage de qualité : sans lui, une réduction d'un facteur 3 produit un
  // crénelage qui rend illisibles les détails d'un capteur ou d'une plaque.
  contexte.imageSmoothingEnabled = true;
  contexte.imageSmoothingQuality = 'high';
  contexte.drawImage(source, 0, 0, cible.largeur, cible.hauteur);

  if ('close' in source && typeof source.close === 'function') source.close();

  const type = choisirFormat(supporteWebp());

  // Annotation explicite : `PHOTO` est `as const`, sans elle le type serait
  // figé au littéral 0.78 et la seconde passe ne compilerait pas.
  let qualite: number = PHOTO.QUALITE_INITIALE;
  let blob = await versBlob(canevas, type, qualite);
  let recompressee = false;

  if (doitRecompresser(blob.size)) {
    qualite = PHOTO.QUALITE_RECOMPRESSION;
    blob = await versBlob(canevas, type, qualite);
    recompressee = true;
  }

  return {
    blob,
    type_mime: type,
    largeur: cible.largeur,
    hauteur: cible.hauteur,
    taille_octets: blob.size,
    qualite,
    recompressee,
    taille_origine_octets: tailleOrigine,
  };
}
