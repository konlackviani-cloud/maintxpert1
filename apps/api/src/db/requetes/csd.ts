/** A7 / B6 — fiches CSD (Configuration Sans Défaut). Une par équipement. */

import type { FicheCSD } from '@maintxpert/shared';
import { requete } from '../client.js';

const COLONNES = 'id_csd, id_equipement, description, photo_url';

export const listerFichesCSD = (): Promise<FicheCSD[]> =>
  requete<FicheCSD>(`select ${COLONNES} from fiche_csd order by id_equipement`);

export async function lireFicheCSD(idEquipement: number): Promise<FicheCSD | null> {
  const lignes = await requete<FicheCSD>(
    `select ${COLONNES} from fiche_csd where id_equipement = $1`,
    [idEquipement],
  );
  return lignes[0] ?? null;
}

/**
 * Crée ou met à jour la fiche d'un équipement.
 *
 * `on conflict (id_equipement)` : la contrainte d'unicité du dictionnaire — une
 * seule fiche par équipement — est ainsi respectée par construction, sans
 * lecture préalable ni fenêtre de concurrence entre deux responsables.
 *
 * `photo_url` n'est écrasée que si une nouvelle photo est fournie : enregistrer
 * une simple correction de texte ne doit pas effacer la photo de référence.
 */
export async function enregistrerFicheCSD(
  idEquipement: number,
  description: string,
  photoUrl: string | null,
): Promise<FicheCSD> {
  const lignes = await requete<FicheCSD>(
    `insert into fiche_csd (id_equipement, description, photo_url)
     values ($1, $2, $3)
     on conflict (id_equipement) do update
       set description = excluded.description,
           photo_url = coalesce(excluded.photo_url, fiche_csd.photo_url)
     returning ${COLONNES}`,
    [idEquipement, description, photoUrl],
  );
  return lignes[0]!;
}

export async function attacherPhotoCSD(idEquipement: number, photoUrl: string): Promise<void> {
  await requete('update fiche_csd set photo_url = $1 where id_equipement = $2', [
    photoUrl,
    idEquipement,
  ]);
}

/** Attache une photo à une fiche SDCR (A6 / A10 — photo facultative). */
export async function attacherPhotoSDCR(idSdcr: number, photoUrl: string): Promise<boolean> {
  const lignes = await requete<{ id_sdcr: number }>(
    'update entree_sdcr set photo_url = $1 where id_sdcr = $2 returning id_sdcr',
    [photoUrl, idSdcr],
  );
  return lignes.length > 0;
}
