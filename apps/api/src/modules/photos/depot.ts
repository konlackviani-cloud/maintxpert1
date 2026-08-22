/**
 * Dépôt des photos.
 *
 * Le cahier des charges prévoit le **stockage objet Supabase**. Tant que
 * l'instance n'est pas provisionnée, l'implémentation par défaut écrit sur
 * disque : le reste de l'application ne voit qu'une interface, et basculer
 * consistera à écrire un second adaptateur — aucun appelant ne change.
 *
 * Le nom de fichier est un UUID : jamais celui fourni par le client. Un nom
 * venu du terminal pourrait contenir « ../ » et faire écrire l'API hors de son
 * dossier.
 */

import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';

import { env } from '../../config/env.js';

/** Types acceptés — miroir de la spécification de compression côté client. */
export const TYPES_ACCEPTES = ['image/webp', 'image/jpeg'] as const;

/**
 * Plafond de 1 Mo. La cible de compression est 400 Ko ; la marge absorbe les
 * cas où la recompression à 70 % ne suffit pas, sans laisser passer une photo
 * non compressée de plusieurs mégaoctets.
 */
export const TAILLE_MAX_OCTETS = 1024 * 1024;

const EXTENSIONS: Record<string, string> = {
  'image/webp': '.webp',
  'image/jpeg': '.jpg',
};

export interface PhotoDeposee {
  /** Chemin relatif, stocké dans `entree_sdcr.photo_url` ou `fiche_csd.photo_url`. */
  chemin: string;
  taille_octets: number;
}

function dossier(): string {
  return resolve(env.STOCKAGE_PHOTOS);
}

/** Empêche toute sortie du dossier de stockage, quelle que soit l'entrée. */
function cheminAbsoluSur(nomFichier: string): string | null {
  const base = dossier();
  const chemin = resolve(join(base, nomFichier));
  return chemin.startsWith(base) ? chemin : null;
}

export async function deposer(contenu: Buffer, typeMime: string): Promise<PhotoDeposee> {
  const extension = EXTENSIONS[typeMime];
  if (!extension) throw new Error(`Type de fichier non accepté : ${typeMime}`);

  const base = dossier();
  if (!existsSync(base)) await mkdir(base, { recursive: true });

  const nomFichier = `${randomUUID()}${extension}`;
  await writeFile(join(base, nomFichier), contenu);

  return { chemin: nomFichier, taille_octets: contenu.byteLength };
}

export async function lire(nomFichier: string): Promise<{ contenu: Buffer; typeMime: string } | null> {
  const chemin = cheminAbsoluSur(nomFichier);
  if (!chemin || !existsSync(chemin)) return null;

  const extension = extname(chemin).toLowerCase();
  const typeMime = extension === '.webp' ? 'image/webp' : 'image/jpeg';

  return { contenu: await readFile(chemin), typeMime };
}

/**
 * Suppression physique — la seule de l'application.
 *
 * L'interdiction de supprimer porte sur les **données métier** (fiches,
 * termes), pour l'auditabilité. Une photo remplacée sur une fiche CSD n'est
 * plus référencée par rien : la garder n'apporterait aucune traçabilité,
 * seulement du stockage occupé.
 */
export async function supprimer(nomFichier: string): Promise<void> {
  const chemin = cheminAbsoluSur(nomFichier);
  if (chemin && existsSync(chemin)) await unlink(chemin);
}
