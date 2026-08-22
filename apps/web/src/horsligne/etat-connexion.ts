/**
 * État de connexion et de synchronisation — alimente l'indicateur permanent
 * exigé par le cahier des charges (section 7).
 *
 * `navigator.onLine` est un signal non fiable : il indique qu'une interface
 * réseau existe, pas que l'API répond. En zone d'usine (Wi-Fi capté mais
 * passerelle injoignable), il ment régulièrement. On le complète donc par une
 * sonde effective sur /api/v1/sante.
 */

import { useEffect, useState } from 'react';
import { CLE_DERNIERE_SYNCHRO, compterEnAttente, lireMeta } from './db.js';

export type EtatReseau = 'en_ligne' | 'hors_ligne' | 'verification';

export interface EtatSynchronisation {
  reseau: EtatReseau;
  mutationsEnAttente: number;
  photosEnAttente: number;
  derniereSynchro: string | null;
}

/** Sonde effective de l'API. Retourne false sans lever, quelle que soit la panne. */
export async function apiJoignable(delaiMs = 4000): Promise<boolean> {
  if (!navigator.onLine) return false;

  const abandon = new AbortController();
  const minuterie = setTimeout(() => abandon.abort(), delaiMs);
  try {
    const reponse = await fetch('/api/v1/sante', {
      method: 'GET',
      signal: abandon.signal,
      cache: 'no-store',
    });
    return reponse.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(minuterie);
  }
}

const ETAT_INITIAL: EtatSynchronisation = {
  reseau: 'verification',
  mutationsEnAttente: 0,
  photosEnAttente: 0,
  derniereSynchro: null,
};

/** Intervalle de re-sonde. Assez espacé pour ne pas peser sur la batterie. */
const INTERVALLE_SONDE_MS = 30_000;

export function useEtatSynchronisation(): EtatSynchronisation {
  const [etat, setEtat] = useState<EtatSynchronisation>(ETAT_INITIAL);

  useEffect(() => {
    let actif = true;

    async function rafraichir(): Promise<void> {
      const [joignable, enAttente, derniereSynchro] = await Promise.all([
        apiJoignable(),
        compterEnAttente(),
        lireMeta(CLE_DERNIERE_SYNCHRO),
      ]);

      if (!actif) return;
      setEtat({
        reseau: joignable ? 'en_ligne' : 'hors_ligne',
        mutationsEnAttente: enAttente.mutations,
        photosEnAttente: enAttente.photos,
        derniereSynchro,
      });
    }

    const surChangementReseau = (): void => void rafraichir();

    void rafraichir();
    const minuterie = setInterval(surChangementReseau, INTERVALLE_SONDE_MS);
    window.addEventListener('online', surChangementReseau);
    window.addEventListener('offline', surChangementReseau);

    return () => {
      actif = false;
      clearInterval(minuterie);
      window.removeEventListener('online', surChangementReseau);
      window.removeEventListener('offline', surChangementReseau);
    };
  }, []);

  return etat;
}

/** Formatage court de la dernière synchronisation, en français. */
export function formaterDerniereSynchro(iso: string | null): string {
  if (!iso) return 'jamais synchronisé';

  const ecartMinutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (ecartMinutes < 1) return "à l'instant";
  if (ecartMinutes < 60) return `il y a ${ecartMinutes} min`;

  const heures = Math.floor(ecartMinutes / 60);
  if (heures < 24) return `il y a ${heures} h`;

  const jours = Math.floor(heures / 24);
  return `il y a ${jours} j`;
}
