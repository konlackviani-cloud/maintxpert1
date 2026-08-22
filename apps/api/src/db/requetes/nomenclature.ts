/** B2 — gestion de la nomenclature : ajout, renommage, archivage, fusion. */

import type { TermeGere, TermeNomenclature, TypeTerme } from '@maintxpert/shared';
import { requete } from '../client.js';

const COLONNES = `id_terme, libelle, type, id_equipement, statut, compteur_usage,
                  categorie_afnor, id_terme_remplacant`;

/**
 * Termes d'un équipement, tous statuts confondus, avec le nombre de fiches qui
 * les référencent. On ne fusionne pas un terme sans savoir ce qu'il entraîne.
 */
export function listerTermesGeres(idEquipement: number): Promise<TermeGere[]> {
  return requete<TermeGere>(
    `select t.id_terme, t.libelle, t.type, t.id_equipement, t.statut, t.compteur_usage,
            t.categorie_afnor, t.id_terme_remplacant,
            r.libelle as libelle_remplacant,
            (select count(*)
               from entree_sdcr e
              where e.id_terme_symptome = t.id_terme
                 or e.id_terme_defaut  = t.id_terme
                 or e.id_terme_cause   = t.id_terme
                 or e.id_terme_remede  = t.id_terme)::int as nb_fiches
       from terme_nomenclature t
       left join terme_nomenclature r on r.id_terme = t.id_terme_remplacant
      where t.id_equipement = $1
      order by t.type, t.statut, t.compteur_usage desc, t.libelle`,
    [idEquipement],
  );
}

export async function lireTerme(idTerme: number): Promise<TermeNomenclature | null> {
  const lignes = await requete<TermeNomenclature>(
    `select ${COLONNES} from terme_nomenclature where id_terme = $1`,
    [idTerme],
  );
  return lignes[0] ?? null;
}

/** Un même libellé ne peut exister deux fois pour un couple (équipement, type). */
export async function termeExiste(
  idEquipement: number,
  type: TypeTerme,
  libelle: string,
): Promise<boolean> {
  const lignes = await requete<{ id_terme: number }>(
    `select id_terme from terme_nomenclature
      where id_equipement = $1 and type = $2 and normaliser_libelle(libelle) = normaliser_libelle($3)`,
    [idEquipement, type, libelle],
  );
  return lignes.length > 0;
}

export async function creerTerme(
  libelle: string,
  type: TypeTerme,
  idEquipement: number,
  categorieAfnor: string | null,
): Promise<TermeNomenclature> {
  const lignes = await requete<TermeNomenclature>(
    `insert into terme_nomenclature (libelle, type, id_equipement, statut, compteur_usage, categorie_afnor)
     values ($1, $2, $3, 'actif', 0, $4)
     returning ${COLONNES}`,
    [libelle, type, idEquipement, categorieAfnor],
  );
  return lignes[0]!;
}

/**
 * Renommer répercute le nouveau libellé sur toutes les fiches qui référencent
 * le terme : sans cela, la fiche afficherait l'ancien libellé et FP1, qui
 * compare des chaînes, cesserait de l'apparier.
 */
export async function renommerTerme(idTerme: number, libelle: string): Promise<void> {
  await requete('update terme_nomenclature set libelle = $1 where id_terme = $2', [libelle, idTerme]);

  for (const niveau of ['symptome', 'defaut', 'cause', 'remede'] as const) {
    await requete(
      `update entree_sdcr set ${niveau} = $1 where id_terme_${niveau} = $2`,
      [libelle, idTerme],
    );
  }
}

/** Archivage — jamais de suppression physique (auditabilité). */
export async function archiverTerme(idTerme: number): Promise<void> {
  await requete(`update terme_nomenclature set statut = 'archive' where id_terme = $1`, [idTerme]);
}

/**
 * Fusion : la source est archivée et redirigée vers la cible, dont le compteur
 * d'usage absorbe le sien. Toutes les fiches pointant vers la source sont
 * réécrites — identifiant ET libellé, pour que FP1 continue d'apparier.
 *
 * @returns `false` si les deux termes ne sont pas comparables (équipement ou
 *   type différent) — fusionner un symptôme dans une cause n'aurait aucun sens.
 */
export async function fusionnerTermes(idSource: number, idCible: number): Promise<boolean> {
  const [source, cible] = await Promise.all([lireTerme(idSource), lireTerme(idCible)]);

  if (!source || !cible) return false;
  if (source.id_terme === cible.id_terme) return false;
  if (source.id_equipement !== cible.id_equipement) return false;
  if (source.type !== cible.type) return false;

  const niveau = source.type;
  await requete(
    `update entree_sdcr set id_terme_${niveau} = $1, ${niveau} = $2 where id_terme_${niveau} = $3`,
    [cible.id_terme, cible.libelle, source.id_terme],
  );

  await requete(
    'update terme_nomenclature set compteur_usage = compteur_usage + $1 where id_terme = $2',
    [source.compteur_usage, cible.id_terme],
  );

  // Ordre imposé : le statut doit passer à `archive` avant que le pointeur ne
  // soit posé — la contrainte chk_remplacant_implique_archive l'exige.
  await requete(
    `update terme_nomenclature set statut = 'archive', id_terme_remplacant = $1 where id_terme = $2`,
    [cible.id_terme, source.id_terme],
  );

  return true;
}
