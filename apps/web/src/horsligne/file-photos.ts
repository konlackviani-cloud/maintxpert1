/**
 * File d'envoi des photos — délibérément SÉPARÉE de celle du texte.
 *
 * Une photo pèse cent fois une fiche SDCR. Si les deux partageaient la même
 * file, une photo en échec au fond d'un tunnel bloquerait la remontée de tout
 * ce qui la suit, y compris des jalons d'intervention. Ici, le texte part seul
 * si la photo ne passe pas — et la photo rejoindra sa fiche plus tard.
 */

import { compresserPhoto, formaterTaille } from '../medias/compression-photo.js';
import { appelerApi } from '../lib/client-api.js';
import { baseLocale, type PhotoEnAttente } from './db.js';

const TENTATIVES_MAX = 5;

/**
 * Met une photo en file pour une fiche SDCR.
 *
 * @param idSdcr  Identifiant de la fiche. Négatif tant que la fiche n'est pas
 *   remontée : l'envoi attendra que la synchronisation du texte lui attribue
 *   son identifiant serveur.
 */
export async function enfilerPhotoSDCR(fichier: Blob, idSdcr: number): Promise<PhotoEnAttente> {
  const compressee = await compresserPhoto(fichier);

  const photo: PhotoEnAttente = {
    id_local: crypto.randomUUID(),
    id_mutation_liee: null,
    cible: 'sdcr',
    id_cible: idSdcr,
    blob: compressee.blob,
    type_mime: compressee.type_mime,
    taille_octets: compressee.taille_octets,
    nb_tentatives: 0,
    derniere_erreur: null,
  };

  // Une seule photo par fiche : la nouvelle remplace l'ancienne en attente.
  const existantes = await baseLocale.filePhotos
    .filter((p) => p.cible === 'sdcr' && p.id_cible === idSdcr)
    .toArray();
  await baseLocale.filePhotos.bulkDelete(existantes.map((p) => p.id_local));

  await baseLocale.filePhotos.put(photo);
  return photo;
}

export async function enfilerPhotoCSD(fichier: Blob, idEquipement: number): Promise<PhotoEnAttente> {
  const compressee = await compresserPhoto(fichier);

  const existantes = await baseLocale.filePhotos
    .filter((p) => p.cible === 'csd' && p.id_cible === idEquipement)
    .toArray();
  await baseLocale.filePhotos.bulkDelete(existantes.map((p) => p.id_local));

  const photo: PhotoEnAttente = {
    id_local: crypto.randomUUID(),
    id_mutation_liee: null,
    cible: 'csd',
    id_cible: idEquipement,
    blob: compressee.blob,
    type_mime: compressee.type_mime,
    taille_octets: compressee.taille_octets,
    nb_tentatives: 0,
    derniere_erreur: null,
  };

  await baseLocale.filePhotos.put(photo);
  return photo;
}

export interface BilanPhotos {
  envoyees: number;
  differees: number;
  echouees: number;
}

/**
 * Vide la file. Ne lève jamais : un échec d'envoi de photo ne doit pas
 * interrompre le cycle de synchronisation du texte.
 */
export async function envoyerPhotos(): Promise<BilanPhotos> {
  const bilan: BilanPhotos = { envoyees: 0, differees: 0, echouees: 0 };
  const enAttente = await baseLocale.filePhotos.toArray();

  for (const photo of enAttente) {
    // Fiche pas encore remontée : son identifiant serveur n'existe pas.
    // On diffère sans compter d'échec — ce n'est pas une erreur.
    if (photo.cible === 'sdcr' && photo.id_cible < 0) {
      bilan.differees += 1;
      continue;
    }

    if (photo.nb_tentatives >= TENTATIVES_MAX) {
      bilan.echouees += 1;
      continue;
    }

    const chemin =
      photo.cible === 'sdcr' ? `/photos/sdcr/${photo.id_cible}` : `/photos/csd/${photo.id_cible}`;

    try {
      await appelerApi<{ photo_url: string }>(chemin, {
        methode: 'POST',
        corpsBinaire: { donnees: photo.blob, typeMime: photo.type_mime },
        delaiMs: 60_000,
      });
      await baseLocale.filePhotos.delete(photo.id_local);
      bilan.envoyees += 1;
    } catch (erreur) {
      await baseLocale.filePhotos.put({
        ...photo,
        nb_tentatives: photo.nb_tentatives + 1,
        derniere_erreur: erreur instanceof Error ? erreur.message : 'Envoi impossible.',
      });
      bilan.echouees += 1;
    }
  }

  return bilan;
}

/**
 * Réattribue à sa fiche une photo prise avant que celle-ci ne soit remontée.
 * Appelée par le moteur de synchronisation lors de la réconciliation.
 */
export async function reattribuerPhotoSDCR(
  idProvisoire: number,
  idServeur: number,
): Promise<void> {
  const photos = await baseLocale.filePhotos
    .filter((p) => p.cible === 'sdcr' && p.id_cible === idProvisoire)
    .toArray();

  await Promise.all(
    photos.map((p) => baseLocale.filePhotos.put({ ...p, id_cible: idServeur })),
  );
}

/** Résumé pour l'indicateur de synchronisation. */
export async function resumerFilePhotos(): Promise<{ nombre: number; poids: string }> {
  const photos = await baseLocale.filePhotos.toArray();
  const poids = photos.reduce((somme, p) => somme + p.taille_octets, 0);
  return { nombre: photos.length, poids: formaterTaille(poids) };
}
