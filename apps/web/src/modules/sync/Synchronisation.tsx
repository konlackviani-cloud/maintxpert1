/**
 * Déclencheur de synchronisation.
 *
 * Ne rend rien : il se contente de lancer un cycle à l'ouverture de session, au
 * retour du réseau, et périodiquement. Aucun écran ne l'attend — la consultation
 * lit le cache, la synchronisation ne fait que l'enrichir en arrière-plan.
 */

import { useEffect } from 'react';

import { synchroniser } from '../../horsligne/moteur-sync.js';
import { useSession } from '../auth/contexte-session.js';

/** Cadence de fond. Assez espacée pour ne pas peser sur la batterie en poste. */
const INTERVALLE_MS = 5 * 60 * 1000;

export function Synchronisation(): null {
  const { connecte } = useSession();

  useEffect(() => {
    if (!connecte) return undefined;

    let actif = true;
    const lancer = (): void => {
      if (actif) void synchroniser();
    };

    // Reprise en main de l'application après une mise en veille du terminal.
    const surRetourAuPremierPlan = (): void => {
      if (document.visibilityState === 'visible') lancer();
    };

    lancer();
    const minuterie = setInterval(lancer, INTERVALLE_MS);
    window.addEventListener('online', lancer);
    document.addEventListener('visibilitychange', surRetourAuPremierPlan);

    return () => {
      actif = false;
      clearInterval(minuterie);
      window.removeEventListener('online', lancer);
      document.removeEventListener('visibilitychange', surRetourAuPremierPlan);
    };
  }, [connecte]);

  return null;
}
