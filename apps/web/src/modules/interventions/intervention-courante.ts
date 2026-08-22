/**
 * Intervention en cours — jalons T1 / T1.5 / T2.
 *
 * L'instant d'arrivée devant la machine est capté dès la sélection de
 * l'équipement, mais l'intervention n'est ouverte qu'au moment où un diagnostic
 * commence réellement (consultation des fiches). Parcourir la liste des
 * équipements ne doit pas ouvrir de chantier ; en revanche, dater T1 à l'entrée
 * dans les résultats amputerait le TTDi du temps de navigation.
 * Voir docs/03-decisions.md (D14).
 */

import { useLiveQuery } from 'dexie-react-hooks';

import { ouvrirIntervention } from '../../horsligne/actions.js';
import { baseLocale, type InterventionLocale } from '../../horsligne/db.js';
import { listerInterventionsOuvertes } from '../../horsligne/depots.js';

const CLE_ARRIVEE = 'maintxpert.arrivee';

interface Arrivee {
  id_equipement: number;
  instant: string;
}

/**
 * Mémorise l'instant d'arrivée devant un équipement.
 * Idempotent : revenir en arrière puis ré-entrer ne réinitialise pas le
 * chronomètre tant qu'on reste sur le même équipement.
 */
export function marquerArrivee(idEquipement: number): void {
  const existante = lireArrivee(idEquipement);
  if (existante) return;

  try {
    sessionStorage.setItem(
      CLE_ARRIVEE,
      JSON.stringify({ id_equipement: idEquipement, instant: new Date().toISOString() }),
    );
  } catch {
    /* stockage indisponible : on retombera sur l'instant courant */
  }
}

export function lireArrivee(idEquipement: number): string | null {
  try {
    const brut = sessionStorage.getItem(CLE_ARRIVEE);
    if (!brut) return null;
    const arrivee = JSON.parse(brut) as Arrivee;
    return arrivee.id_equipement === idEquipement ? arrivee.instant : null;
  } catch {
    return null;
  }
}

export function effacerArrivee(): void {
  try {
    sessionStorage.removeItem(CLE_ARRIVEE);
  } catch {
    /* rien à faire */
  }
}

/**
 * Retourne l'intervention ouverte sur cet équipement, en l'ouvrant si besoin.
 * Un technicien n'a qu'un chantier à la fois par équipement.
 *
 * Le tout dans UNE transaction : sans cela, deux appels concurrents — le mode
 * strict de React déclenche l'effet deux fois, et rien n'empêche deux écrans de
 * la demander en même temps — lisent tous deux « aucune intervention ouverte »
 * avant que le premier n'ait écrit, et en créent chacun une. IndexedDB
 * sérialise les transactions en écriture dont les portées se recouvrent, ce qui
 * fait de la lecture-puis-création une opération atomique.
 */
export async function obtenirInterventionCourante(
  idTechnicien: number,
  idEquipement: number,
): Promise<InterventionLocale> {
  return baseLocale.transaction(
    'rw',
    [baseLocale.interventionsLocales, baseLocale.fileMutations],
    async () => {
      const ouvertes = await baseLocale.interventionsLocales
        .where('id_technicien')
        .equals(idTechnicien)
        .toArray();

      const existante = ouvertes.find(
        (i) => i.id_equipement === idEquipement && i.datetime_cloture === null,
      );
      if (existante) return existante;

      const instantArrivee = lireArrivee(idEquipement) ?? new Date().toISOString();
      return ouvrirIntervention(idTechnicien, idEquipement, instantArrivee);
    },
  );
}

/** Interventions non clôturées, réactif au cache. */
export function useInterventionsOuvertes(idTechnicien: number | undefined): InterventionLocale[] {
  return (
    useLiveQuery(
      () => (idTechnicien === undefined ? Promise.resolve([]) : listerInterventionsOuvertes(idTechnicien)),
      [idTechnicien],
      [],
    ) ?? []
  );
}

export function useInterventionLocale(idLocal: string | undefined): InterventionLocale | undefined {
  return useLiveQuery(
    async () => (idLocal ? await baseLocale.interventionsLocales.get(idLocal) : undefined),
    [idLocal],
  );
}
