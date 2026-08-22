/** B1 — file de validation et transitions d'état des fiches SDCR. */

import type {
  ContributionAValider,
  CorrectionsFiche,
  EntreeSDCR,
  StatutSDCR,
} from '@maintxpert/shared';
import { requete } from '../client.js';

const COLONNES_SDCR = `
  id_sdcr, id_equipement,
  id_terme_symptome, symptome, id_terme_defaut, defaut,
  id_terme_cause, cause, id_terme_remede, remede,
  frequence_observee, via_nomenclature, statut, photo_url,
  id_contributeur, id_valideur, date_creation, date_modification`;

/**
 * Ligne à plat : les colonnes de `entree_sdcr` telles quelles, celles des
 * tables jointes préfixées pour éviter la collision sur `id_equipement`.
 * Reconstituée en objet par `recomposer()`.
 */
type LigneFile = EntreeSDCR & {
  eq_nom: string;
  eq_chaine: string;
  eq_famille: string;
  ut_id: number;
  ut_nom: string;
  ut_prenom: string;
  ut_matricule: string;
};

const SELECT_FILE = `
  select e.*,
    q.nom as eq_nom, q.chaine as eq_chaine, q.famille as eq_famille,
    u.id_utilisateur as ut_id, u.nom as ut_nom, u.prenom as ut_prenom, u.matricule as ut_matricule
  from entree_sdcr e
  join equipement q on q.id_equipement = e.id_equipement
  join utilisateur u on u.id_utilisateur = e.id_contributeur`;

const MS_PAR_JOUR = 86_400_000;

function recomposer(ligne: LigneFile): ContributionAValider {
  const { eq_nom, eq_chaine, eq_famille, ut_id, ut_nom, ut_prenom, ut_matricule, ...fiche } = ligne;

  const niveauxLibres = [
    fiche.id_terme_symptome,
    fiche.id_terme_defaut,
    fiche.id_terme_cause,
    fiche.id_terme_remede,
  ].filter((id) => id === null).length;

  return {
    fiche,
    equipement: {
      id_equipement: fiche.id_equipement,
      nom: eq_nom,
      chaine: eq_chaine,
      famille: eq_famille,
    },
    contributeur: {
      id_utilisateur: ut_id,
      nom: ut_nom,
      prenom: ut_prenom,
      matricule: ut_matricule,
    },
    // Calculé côté applicatif : `extract(epoch …)` n'est pas également supporté
    // partout, et la valeur n'a pas besoin d'être calculée par la base.
    age_jours: Math.floor((Date.now() - new Date(fiche.date_creation).getTime()) / MS_PAR_JOUR),
    niveaux_libres: niveauxLibres,
  };
}

/** File d'attente : plus anciennes en tête — une contribution oubliée décourage son auteur. */
export async function listerFile(): Promise<ContributionAValider[]> {
  const lignes = await requete<LigneFile>(
    `${SELECT_FILE}
      where e.statut in ('en_attente', 'en_correction')
      order by e.date_creation`,
  );
  return lignes.map(recomposer);
}

export async function lireContribution(idSdcr: number): Promise<ContributionAValider | null> {
  const lignes = await requete<LigneFile>(`${SELECT_FILE} where e.id_sdcr = $1`, [idSdcr]);
  return lignes[0] ? recomposer(lignes[0]) : null;
}

/**
 * Fiches validées du même équipement partageant le triplet défaut / cause / remède.
 * C'est la signature d'un doublon : même panne, symptôme formulé autrement.
 */
export function chercherDoublons(
  idSdcr: number,
  idEquipement: number,
  defaut: string,
  cause: string,
): Promise<EntreeSDCR[]> {
  return requete<EntreeSDCR>(
    `select ${COLONNES_SDCR}
       from entree_sdcr
      where id_equipement = $1
        and statut = 'validee'
        and id_sdcr <> $2
        and normaliser_libelle(defaut) = normaliser_libelle($3)
        and normaliser_libelle(cause) = normaliser_libelle($4)
      order by frequence_observee desc`,
    [idEquipement, idSdcr, defaut, cause],
  );
}

export async function lireStatut(idSdcr: number): Promise<StatutSDCR | null> {
  const lignes = await requete<{ statut: StatutSDCR }>(
    'select statut from entree_sdcr where id_sdcr = $1',
    [idSdcr],
  );
  return lignes[0]?.statut ?? null;
}

/**
 * Applique une transition d'état. La légalité de la transition est vérifiée en
 * amont par `verifierTransition()` (@maintxpert/shared) : cette fonction ne
 * fait qu'écrire.
 *
 * La clause `statut = $3` protège de la concurrence : deux responsables
 * traitant la même fiche, le second n'écrase pas la décision du premier.
 */
export async function changerStatut(
  idSdcr: number,
  vers: StatutSDCR,
  depuis: StatutSDCR,
  idValideur: number,
): Promise<boolean> {
  const lignes = await requete<{ id_sdcr: number }>(
    `update entree_sdcr
        set statut = $1, id_valideur = $2
      where id_sdcr = $3 and statut = $4
      returning id_sdcr`,
    [vers, idValideur, idSdcr, depuis],
  );
  return lignes.length > 0;
}

/**
 * Corrige les libellés et rattache les niveaux à la nomenclature (UC2).
 * Recalcule `via_nomenclature` : c'est lui qui alimente l'indicateur B5, il ne
 * doit jamais rester à faux sur une fiche entièrement rattachée.
 */
export async function appliquerCorrections(
  idSdcr: number,
  corrections: CorrectionsFiche,
): Promise<void> {
  const champs: string[] = [];
  const valeurs: unknown[] = [];
  let n = 1;

  for (const niveau of ['symptome', 'defaut', 'cause', 'remede'] as const) {
    const correction = corrections[niveau];
    if (!correction) continue;
    champs.push(`${niveau} = $${n++}`, `id_terme_${niveau} = $${n++}`);
    valeurs.push(correction.libelle, correction.id_terme);
  }

  if (champs.length === 0) return;

  valeurs.push(idSdcr);
  await requete(
    `update entree_sdcr set ${champs.join(', ')} where id_sdcr = $${n}`,
    valeurs,
  );

  await requete(
    `update entree_sdcr
        set via_nomenclature = (id_terme_symptome is not null
                                and id_terme_defaut is not null
                                and id_terme_cause is not null
                                and id_terme_remede is not null)
      where id_sdcr = $1`,
    [idSdcr],
  );
}

/**
 * Fusion de deux fiches : la fréquence de la source est reportée sur la cible,
 * la source est rejetée puis archivée.
 *
 * Reporter la fréquence plutôt que l'écraser : les occurrences observées sous
 * l'autre libellé ont bien eu lieu, elles comptent pour la criticité.
 */
export async function fusionnerFiches(
  idSource: number,
  idCible: number,
  idValideur: number,
): Promise<boolean> {
  const lignes = await requete<{ frequence_observee: number }>(
    'select frequence_observee from entree_sdcr where id_sdcr = $1',
    [idSource],
  );
  const frequence = lignes[0]?.frequence_observee;
  if (frequence === undefined) return false;

  const cibles = await requete<{ id_sdcr: number }>(
    `update entree_sdcr
        set frequence_observee = frequence_observee + $1
      where id_sdcr = $2 and statut = 'validee'
      returning id_sdcr`,
    [frequence, idCible],
  );
  if (cibles.length === 0) return false;

  await requete(
    `update entree_sdcr set statut = 'archivee', id_valideur = $1 where id_sdcr = $2`,
    [idValideur, idSource],
  );
  return true;
}
