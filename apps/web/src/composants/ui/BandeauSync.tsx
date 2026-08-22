/**
 * Indicateur permanent d'état de connexion et de synchronisation.
 * Exigence UX : le technicien doit savoir en permanence si ce qu'il consulte
 * vient du cache et si ce qu'il a saisi est bien remonté.
 */

import { formaterDerniereSynchro, useEtatSynchronisation } from '../../horsligne/etat-connexion.js';

const LIBELLES_RESEAU = {
  en_ligne: 'En ligne',
  hors_ligne: 'Hors ligne',
  verification: 'Vérification…',
} as const;

const COULEURS_RESEAU = {
  en_ligne: 'var(--c-succes)',
  hors_ligne: 'var(--c-alerte)',
  verification: 'var(--c-neutre-info)',
} as const;

export function BandeauSync(): JSX.Element {
  const { reseau, mutationsEnAttente, photosEnAttente, derniereSynchro } = useEtatSynchronisation();
  const totalEnAttente = mutationsEnAttente + photosEnAttente;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--e-3)',
        flexWrap: 'wrap',
        padding: 'var(--e-2) var(--e-4)',
        background: 'var(--c-fond-secondaire)',
        borderBottom: '1px solid var(--c-bordure)',
        fontSize: 'var(--taille-sm)',
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--e-2)' }}>
        <span
          aria-hidden="true"
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: COULEURS_RESEAU[reseau],
          }}
        />
        <strong>{LIBELLES_RESEAU[reseau]}</strong>
      </span>

      {totalEnAttente > 0 && (
        <span style={{ color: 'var(--c-alerte)' }}>
          {totalEnAttente} élément{totalEnAttente > 1 ? 's' : ''} en attente d’envoi
          {photosEnAttente > 0 && ` (dont ${photosEnAttente} photo${photosEnAttente > 1 ? 's' : ''})`}
        </span>
      )}

      <span style={{ color: 'var(--c-texte-secondaire)', marginLeft: 'auto' }}>
        Synchro : {formaterDerniereSynchro(derniereSynchro)}
      </span>
    </div>
  );
}
