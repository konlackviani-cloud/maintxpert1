/**
 * Lectures sur le cache local.
 *
 * TOUTE la consultation passe par ici — jamais par le réseau. Si un écran
 * appelle `client-api` pour afficher quelque chose, la règle « hors ligne
 * d'abord » est enfreinte.
 *
 * Les règles métier viennent de @maintxpert/shared : le tri FP1 appliqué ici
 * est exactement celui qu'appliquerait le serveur.
 */

import {
  SEUIL_RECURRENCE_DEFAUT,
  lireSeuilRecurrence,
  normaliserLibelle,
  rechercher,
  type EntreeSDCR,
  type Equipement,
  type TermeNomenclature,
  type TypeTerme,
} from '@maintxpert/shared';

import { baseLocale, type InterventionLocale } from './db.js';

/* -------------------------------------------------------------------------- */
/* Équipements — A2                                                            */
/* -------------------------------------------------------------------------- */

export interface ChaineResumee {
  chaine: string;
  nb_equipements: number;
}

export async function listerChaines(): Promise<ChaineResumee[]> {
  const equipements = await baseLocale.equipements.toArray();
  const parChaine = new Map<string, number>();

  for (const e of equipements) {
    parChaine.set(e.chaine, (parChaine.get(e.chaine) ?? 0) + 1);
  }

  return [...parChaine.entries()]
    .map(([chaine, nb_equipements]) => ({ chaine, nb_equipements }))
    .sort((a, b) => a.chaine.localeCompare(b.chaine, 'fr'));
}

export function listerEquipements(chaine: string): Promise<Equipement[]> {
  return baseLocale.equipements
    .where('chaine')
    .equals(chaine)
    .sortBy('nom');
}

export function lireEquipement(idEquipement: number): Promise<Equipement | undefined> {
  return baseLocale.equipements.get(idEquipement);
}

/* -------------------------------------------------------------------------- */
/* Nomenclature — A3, A10                                                      */
/* -------------------------------------------------------------------------- */

/** Termes actifs d'un équipement, les plus utilisés en tête (compteur_usage). */
export async function listerTermes(
  idEquipement: number,
  type: TypeTerme,
): Promise<TermeNomenclature[]> {
  const termes = await baseLocale.termes
    .where('[id_equipement+type]')
    .equals([idEquipement, type])
    .toArray();

  return termes
    .filter((t) => t.statut === 'actif')
    .sort(
      (a, b) =>
        b.compteur_usage - a.compteur_usage || a.libelle.localeCompare(b.libelle, 'fr'),
    );
}

/**
 * Symptômes proposés à l'écran A3, enrichis du nombre de fiches validées
 * rattachées : le technicien voit tout de suite si un symptôme mènera quelque
 * part. Un symptôme sans fiche reste proposé — c'est ainsi qu'on documente les
 * cas nouveaux.
 */
export interface SymptomePropose {
  id_terme: number | null;
  libelle: string;
  compteur_usage: number;
  nb_fiches: number;
}

export async function listerSymptomes(idEquipement: number): Promise<SymptomePropose[]> {
  const [termes, entrees] = await Promise.all([
    listerTermes(idEquipement, 'symptome'),
    baseLocale.entreesSdcr.where('id_equipement').equals(idEquipement).toArray(),
  ]);

  const validees = entrees.filter((e) => e.statut === 'validee');
  const compter = (libelle: string) =>
    validees.filter((e) => normaliserLibelle(e.symptome) === normaliserLibelle(libelle)).length;

  const proposes: SymptomePropose[] = termes.map((t) => ({
    id_terme: t.id_terme,
    libelle: t.libelle,
    compteur_usage: t.compteur_usage,
    nb_fiches: compter(t.libelle),
  }));

  // Symptômes présents dans des fiches validées mais absents de la nomenclature
  // (saisies libres validées par le responsable sans avoir été rattachées).
  const connus = new Set(proposes.map((p) => normaliserLibelle(p.libelle)));
  for (const entree of validees) {
    const cle = normaliserLibelle(entree.symptome);
    if (connus.has(cle)) continue;
    connus.add(cle);
    proposes.push({
      id_terme: entree.id_terme_symptome,
      libelle: entree.symptome,
      compteur_usage: 0,
      nb_fiches: compter(entree.symptome),
    });
  }

  return proposes.sort(
    (a, b) =>
      b.nb_fiches - a.nb_fiches ||
      b.compteur_usage - a.compteur_usage ||
      a.libelle.localeCompare(b.libelle, 'fr'),
  );
}

/* -------------------------------------------------------------------------- */
/* Fiches SDCR — A4, A12                                                       */
/* -------------------------------------------------------------------------- */

/** FP1. Le filtrage et le tri viennent de @maintxpert/shared, pas d'ici. */
export async function rechercherFiches(
  idEquipement: number,
  symptome: string,
): Promise<EntreeSDCR[]> {
  const candidates = await baseLocale.entreesSdcr
    .where('id_equipement')
    .equals(idEquipement)
    .toArray();

  return rechercher(candidates, { id_equipement: idEquipement, symptome });
}

export function lireFiche(idSdcr: number): Promise<EntreeSDCR | undefined> {
  return baseLocale.entreesSdcr.get(idSdcr);
}

/** A12 — contributions de l'utilisateur, plus récentes en tête. */
export async function listerMesContributions(idContributeur: number): Promise<EntreeSDCR[]> {
  const fiches = await baseLocale.entreesSdcr
    .where('id_contributeur')
    .equals(idContributeur)
    .toArray();

  return fiches.sort((a, b) => (a.date_creation < b.date_creation ? 1 : -1));
}

/* -------------------------------------------------------------------------- */
/* Interventions                                                               */
/* -------------------------------------------------------------------------- */

/** Chantiers non clôturés du technicien, le plus récent en tête. */
export async function listerInterventionsOuvertes(
  idTechnicien: number,
): Promise<InterventionLocale[]> {
  const interventions = await baseLocale.interventionsLocales
    .where('id_technicien')
    .equals(idTechnicien)
    .toArray();

  return interventions
    .filter((i) => i.datetime_cloture === null)
    .sort((a, b) => (a.datetime_ouverture < b.datetime_ouverture ? 1 : -1));
}

export function lireInterventionLocale(idLocal: string): Promise<InterventionLocale | undefined> {
  return baseLocale.interventionsLocales.get(idLocal);
}

/* -------------------------------------------------------------------------- */
/* Configuration                                                               */
/* -------------------------------------------------------------------------- */

export async function lireSeuilRecurrenceLocal(): Promise<number> {
  const ligne = await baseLocale.configuration.get('seuil_recurrence');
  return ligne ? lireSeuilRecurrence(ligne.valeur) : SEUIL_RECURRENCE_DEFAUT;
}
