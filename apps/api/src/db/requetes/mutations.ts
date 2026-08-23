/** Écritures issues de la file de synchronisation, et journal d'idempotence. */

import type { ChargeCreerEntreeSDCR } from '@maintxpert/shared';
import { requete } from '../client.js';

/* -------------------------------------------------------------------------- */
/* Journal d'idempotence                                                       */
/* -------------------------------------------------------------------------- */

export interface MutationJournalisee {
  id_local: string;
  resultat: { id_sdcr?: number; id_intervention?: number } | null;
}

export async function lireMutationAppliquee(idLocal: string): Promise<MutationJournalisee | null> {
  const lignes = await requete<MutationJournalisee>(
    'select id_local, resultat from mutation_appliquee where id_local = $1',
    [idLocal],
  );
  return lignes[0] ?? null;
}

export async function journaliser(
  idLocal: string,
  type: string,
  idUtilisateur: number,
  resultat: unknown,
): Promise<void> {
  await requete(
    `insert into mutation_appliquee (id_local, type, id_utilisateur, resultat)
     values ($1, $2, $3, $4)
     on conflict (id_local) do nothing`,
    [idLocal, type, idUtilisateur, JSON.stringify(resultat ?? null)],
  );
}

/* -------------------------------------------------------------------------- */
/* Entrées SDCR                                                                */
/* -------------------------------------------------------------------------- */

/**
 * A6 / A10 — création d'une fiche.
 * Toujours créée en `en_attente` : rien n'entre dans la base consultable sans
 * passer par le responsable (circuit contributeur → valideur).
 */
export async function creerEntreeSDCR(
  charge: ChargeCreerEntreeSDCR,
  idContributeur: number,
  horodatageTerrain: string,
): Promise<number> {
  const viaNomenclature =
    charge.id_terme_symptome !== null &&
    charge.id_terme_defaut !== null &&
    charge.id_terme_cause !== null &&
    charge.id_terme_remede !== null;

  const lignes = await requete<{ id_sdcr: number }>(
    `insert into entree_sdcr (
       id_equipement,
       id_terme_symptome, symptome, id_terme_defaut, defaut,
       id_terme_cause, cause, id_terme_remede, remede,
       frequence_observee, via_nomenclature, statut, id_contributeur,
       date_creation, date_modification)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, 1, $10, 'en_attente', $11, $12, $12)
     returning id_sdcr`,
    [
      charge.id_equipement,
      charge.id_terme_symptome,
      charge.symptome,
      charge.id_terme_defaut,
      charge.defaut,
      charge.id_terme_cause,
      charge.cause,
      charge.id_terme_remede,
      charge.remede,
      viaNomenclature,
      idContributeur,
      horodatageTerrain,
    ],
  );

  // Le compteur d'usage oriente le tri des listes déroulantes (A3, A10).
  const termes = [
    charge.id_terme_symptome,
    charge.id_terme_defaut,
    charge.id_terme_cause,
    charge.id_terme_remede,
  ].filter((id): id is number => id !== null);

  if (termes.length > 0) {
    // `in (...)` avec des marqueurs explicites plutôt que `= any($1)` : le
    // passage d'un tableau laisse le type de ses éléments à la déduction du
    // pilote, et un tableau arrivé en texte ne s'apparie à aucun entier — la
    // requête réussit alors sans rien mettre à jour, en silence.
    const marqueurs = termes.map((_, i) => `$${i + 1}`).join(', ');
    await requete(
      `update terme_nomenclature set compteur_usage = compteur_usage + 1 where id_terme in (${marqueurs})`,
      termes,
    );
  }

  return lignes[0]!.id_sdcr;
}

/**
 * A5 — confirmation d'une cause sur une fiche existante.
 *
 * N'incrémente que les fiches VALIDÉES : confirmer une contribution encore en
 * attente gonflerait une fréquence qui n'a pas encore été relue.
 * Retourne `false` si la fiche n'existe pas ou n'est pas validée.
 */
export async function confirmerCause(idSdcr: number): Promise<boolean> {
  const lignes = await requete<{ id_sdcr: number }>(
    `update entree_sdcr
        set frequence_observee = frequence_observee + 1
      where id_sdcr = $1 and statut = 'validee'
      returning id_sdcr`,
    [idSdcr],
  );
  return lignes.length > 0;
}

/* -------------------------------------------------------------------------- */
/* Interventions — jalons T1, T1.5, T2                                         */
/* -------------------------------------------------------------------------- */

/** A8 — T1. `horodatageTerrain` est l'instant réel d'arrivée, pas celui de l'envoi. */
export async function ouvrirIntervention(
  idTechnicien: number,
  idEquipement: number,
  idSdcr: number | null,
  horodatageTerrain: string,
): Promise<number> {
  const lignes = await requete<{ id_intervention: number }>(
    `insert into intervention (id_technicien, id_equipement, id_sdcr, datetime_ouverture)
     values ($1, $2, $3, $4)
     returning id_intervention`,
    [idTechnicien, idEquipement, idSdcr, horodatageTerrain],
  );
  return lignes[0]!.id_intervention;
}

/**
 * A9 — T1.5. Le jalon ne se pose qu'une fois : `is null` dans le WHERE évite
 * qu'un rejeu tardif écrase l'horodatage d'origine et fausse le TTDi.
 */
export async function marquerCauseConfirmee(
  idIntervention: number,
  idTechnicien: number,
  idSdcr: number | null,
  horodatageTerrain: string,
): Promise<boolean> {
  const lignes = await requete<{ id_intervention: number }>(
    `update intervention
        set datetime_cause_confirmee = $1,
            id_sdcr = coalesce($2, id_sdcr)
      where id_intervention = $3
        and id_technicien = $4
        and datetime_cause_confirmee is null
      returning id_intervention`,
    [horodatageTerrain, idSdcr, idIntervention, idTechnicien],
  );
  return lignes.length > 0;
}

/**
 * A6 — l'intervention a produit une fiche : on l'y rattache.
 *
 * Sans ce lien, une intervention où le technicien a documenté une nouvelle
 * fiche est indiscernable, à l'export, d'une intervention abandonnée : toutes
 * deux sortent avec T1.5 vide. Le protocole de mesure classerait la première
 * en « n'a pas trouvé », alors qu'il vient d'écrire la cause.
 *
 * `is null` : on ne réécrit pas un rattachement déjà posé — le chemin A5, où le
 * technicien retrouve une fiche existante, fait autorité sur celui-ci.
 */
export async function rattacherFicheAIntervention(
  idIntervention: number,
  idTechnicien: number,
  idSdcr: number,
): Promise<boolean> {
  const lignes = await requete<{ id_intervention: number }>(
    `update intervention
        set id_sdcr = $1
      where id_intervention = $2
        and id_technicien = $3
        and id_sdcr is null
      returning id_intervention`,
    [idSdcr, idIntervention, idTechnicien],
  );
  return lignes.length > 0;
}

/** A11 — T2, même protection contre le rejeu. */
export async function cloturerIntervention(
  idIntervention: number,
  idTechnicien: number,
  horodatageTerrain: string,
): Promise<boolean> {
  const lignes = await requete<{ id_intervention: number }>(
    `update intervention
        set datetime_cloture = $1
      where id_intervention = $2
        and id_technicien = $3
        and datetime_cloture is null
      returning id_intervention`,
    [horodatageTerrain, idIntervention, idTechnicien],
  );
  return lignes.length > 0;
}
