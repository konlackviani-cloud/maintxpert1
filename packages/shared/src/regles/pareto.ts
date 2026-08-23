/**
 * B3 / B5 / UC4 — filtres combinés, Pareto des causes et indicateurs de suivi.
 *
 * Fonctions pures, exécutées côté PWA sur le cache IndexedDB : le tableau de
 * bord est de la CONSULTATION, il doit donc fonctionner sans réseau comme le
 * reste (voir CLAUDE.md, « hors ligne d'abord »).
 *
 * Aucune de ces fonctions ne lève ni ne renvoie de valeur indéfinie sur un
 * ensemble vide : le cahier des charges exige un état vide affiché, jamais une
 * erreur (UC4).
 */

import { normaliserLibelle } from './recherche-frequence.js';
import type { EntreeSDCR, Equipement, Intervention } from '../types/entites.js';
import type { StatutSDCR } from '../types/enums.js';

/* -------------------------------------------------------------------------- */
/* B3 — filtres combinés                                                       */
/* -------------------------------------------------------------------------- */

export interface CriteresRecherche {
  chaine?: string;
  id_equipement?: number;
  /** Bornes de période, en ISO 8601. Comparées à `date_creation`. */
  depuis?: string;
  jusqua?: string;
  statuts?: StatutSDCR[];
  /** Texte cherché dans les quatre niveaux S/D/C/R. Sous-chaîne, insensible à la casse. */
  texte?: string;
  /** `true` : uniquement les fiches saisies hors nomenclature (indicateur B5). */
  seulement_libres?: boolean;
}

/**
 * Applique les critères. Chaque critère absent ne filtre rien — combiner deux
 * critères les intersecte.
 *
 * @param equipements Nécessaire au seul filtre par chaîne : une fiche porte son
 *   équipement, pas sa chaîne.
 */
export function filtrerEntrees(
  entrees: readonly EntreeSDCR[],
  equipements: readonly Equipement[],
  criteres: CriteresRecherche,
): EntreeSDCR[] {
  const chaineParEquipement = new Map(equipements.map((e) => [e.id_equipement, e.chaine]));
  const texte = criteres.texte ? normaliserLibelle(criteres.texte) : null;

  return entrees.filter((entree) => {
    if (criteres.id_equipement !== undefined && entree.id_equipement !== criteres.id_equipement) {
      return false;
    }
    if (criteres.chaine !== undefined && chaineParEquipement.get(entree.id_equipement) !== criteres.chaine) {
      return false;
    }
    if (criteres.depuis !== undefined && entree.date_creation < criteres.depuis) return false;
    if (criteres.jusqua !== undefined && entree.date_creation > criteres.jusqua) return false;
    if (criteres.statuts !== undefined && !criteres.statuts.includes(entree.statut)) return false;
    if (criteres.seulement_libres === true && entree.via_nomenclature) return false;

    if (texte !== null) {
      const contenu = normaliserLibelle(
        `${entree.symptome} ${entree.defaut} ${entree.cause} ${entree.remede}`,
      );
      if (!contenu.includes(texte)) return false;
    }

    return true;
  });
}

/* -------------------------------------------------------------------------- */
/* B4 / B5 — Pareto des causes d'arrêt                                         */
/* -------------------------------------------------------------------------- */

/** Seuil de Pareto : la part cumulée à partir de laquelle on considère le gros traité. */
export const SEUIL_PARETO = 80;

export interface LignePareto {
  cause: string;
  /** Somme des fréquences observées, pas le nombre de fiches. */
  occurrences: number;
  /** Part de cette cause dans le total, en pourcentage. */
  part: number;
  /** Part cumulée en incluant cette cause. */
  cumul: number;
  /** `true` tant que le cumul n'a pas dépassé le seuil — le « vital few ». */
  dans_le_seuil: boolean;
}

export interface Pareto {
  lignes: LignePareto[];
  /** Somme de toutes les occurrences. */
  total: number;
  /** Nombre de causes suffisant à couvrir le seuil. */
  nb_causes_seuil: number;
}

/**
 * Construit le Pareto des causes.
 *
 * On somme `frequence_observee`, pas le nombre de fiches : une cause constatée
 * douze fois pèse douze arrêts, pas un. C'est cette pondération qui fait du
 * Pareto un outil de décision et non un simple inventaire.
 *
 * @param limite Nombre maximal de causes détaillées. Au-delà, le reste est
 *   regroupé sous « Autres » — un Pareto de quarante barres n'aide personne.
 */
export function construirePareto(entrees: readonly EntreeSDCR[], limite = 7): Pareto {
  const parCause = new Map<string, { cause: string; occurrences: number }>();

  for (const entree of entrees) {
    const cle = normaliserLibelle(entree.cause);
    const existante = parCause.get(cle);
    if (existante) existante.occurrences += entree.frequence_observee;
    else parCause.set(cle, { cause: entree.cause, occurrences: entree.frequence_observee });
  }

  const total = [...parCause.values()].reduce((somme, c) => somme + c.occurrences, 0);
  if (total === 0) return { lignes: [], total: 0, nb_causes_seuil: 0 };

  const triees = [...parCause.values()].sort(
    (a, b) => b.occurrences - a.occurrences || a.cause.localeCompare(b.cause, 'fr'),
  );

  const detaillees = triees.slice(0, limite);
  const reste = triees.slice(limite);
  if (reste.length > 0) {
    detaillees.push({
      cause: `Autres (${reste.length})`,
      occurrences: reste.reduce((somme, c) => somme + c.occurrences, 0),
    });
  }

  let cumulOccurrences = 0;
  let nbCausesSeuil = 0;
  let seuilAtteint = false;

  const lignes: LignePareto[] = detaillees.map((c) => {
    cumulOccurrences += c.occurrences;
    const cumul = (cumulOccurrences / total) * 100;

    // La cause qui FAIT franchir le seuil en fait partie : c'est elle qu'il
    // faut traiter pour atteindre les 80 %.
    const dansLeSeuil = !seuilAtteint;
    if (!seuilAtteint) {
      nbCausesSeuil += 1;
      if (cumul >= SEUIL_PARETO) seuilAtteint = true;
    }

    return {
      cause: c.cause,
      occurrences: c.occurrences,
      part: (c.occurrences / total) * 100,
      cumul,
      dans_le_seuil: dansLeSeuil,
    };
  });

  return { lignes, total, nb_causes_seuil: nbCausesSeuil };
}

/* -------------------------------------------------------------------------- */
/* B5 — indicateurs de suivi                                                   */
/* -------------------------------------------------------------------------- */

export interface Indicateurs {
  nb_fiches_validees: number;
  nb_en_attente: number;
  /**
   * Taux de recours à la nomenclature NON CONTRÔLÉE, en pourcentage.
   * Indicateur explicitement demandé par B5.
   */
  taux_nomenclature_libre: number;
  /** TTDi médian en secondes. `null` si aucune intervention n'a atteint T1.5. */
  ttdi_median_secondes: number | null;
  /** Durée totale médiane en secondes. `null` si aucune intervention clôturée. */
  duree_mediane_secondes: number | null;
  nb_interventions: number;
  nb_interventions_ouvertes: number;
}

/**
 * Médiane plutôt que moyenne : une seule intervention laissée ouverte toute une
 * nuit décalerait la moyenne au point de la rendre inutilisable, alors que la
 * médiane décrit le cas courant.
 */
export function mediane(valeurs: readonly number[]): number | null {
  if (valeurs.length === 0) return null;

  const triees = [...valeurs].sort((a, b) => a - b);
  const milieu = Math.floor(triees.length / 2);

  return triees.length % 2 === 1
    ? triees[milieu]!
    : Math.round((triees[milieu - 1]! + triees[milieu]!) / 2);
}

export function calculerIndicateurs(
  entrees: readonly EntreeSDCR[],
  interventions: readonly Intervention[],
): Indicateurs {
  const validees = entrees.filter((e) => e.statut === 'validee');
  const enAttente = entrees.filter((e) => e.statut === 'en_attente' || e.statut === 'en_correction');

  // Le taux se calcule sur les fiches consultables : c'est ce que voit le
  // technicien qui cherche, donc ce que mesure l'indicateur.
  const libres = validees.filter((e) => !e.via_nomenclature).length;
  const taux = validees.length === 0 ? 0 : (libres / validees.length) * 100;

  const secondesEntre = (debut: string, fin: string): number =>
    Math.round((new Date(fin).getTime() - new Date(debut).getTime()) / 1000);

  const ttdis = interventions
    .filter((i) => i.datetime_cause_confirmee !== null)
    .map((i) => secondesEntre(i.datetime_ouverture, i.datetime_cause_confirmee!));

  const durees = interventions
    .filter((i) => i.datetime_cloture !== null)
    .map((i) => secondesEntre(i.datetime_ouverture, i.datetime_cloture!));

  return {
    nb_fiches_validees: validees.length,
    nb_en_attente: enAttente.length,
    taux_nomenclature_libre: taux,
    ttdi_median_secondes: mediane(ttdis),
    duree_mediane_secondes: mediane(durees),
    nb_interventions: interventions.length,
    nb_interventions_ouvertes: interventions.filter((i) => i.datetime_cloture === null).length,
  };
}

