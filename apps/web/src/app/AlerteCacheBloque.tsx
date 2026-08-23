/**
 * Bandeau affiché quand la mise à niveau du cache local est bloquée par un
 * autre onglet.
 *
 * Sans lui, l'application reste sur « Chargement… » indéfiniment : IndexedDB
 * n'ouvre pas la base tant qu'une connexion à l'ancien schéma subsiste, et rien
 * à l'écran n'indique pourquoi. Le cas se produit dès qu'une mise à jour de
 * l'application change le schéma et qu'un onglet est resté ouvert.
 */

import { useEffect, useState } from 'react';

import { surBlocageCache } from '../horsligne/db.js';

export function AlerteCacheBloque(): JSX.Element | null {
  const [bloque, setBloque] = useState(false);

  useEffect(() => {
    surBlocageCache(() => setBloque(true));
  }, []);

  if (!bloque) return null;

  return (
    <div
      role="alert"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 20,
        padding: '48px 28px',
        textAlign: 'center',
        background: 'var(--c-fond)',
        color: 'var(--c-texte)',
      }}
    >
      <div style={{ maxWidth: 460, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h1 style={{ fontSize: 21, fontWeight: 700, margin: 0, textWrap: 'pretty' }}>
          Un autre onglet MaintXpert est ouvert
        </h1>
        <p style={{ margin: 0, fontSize: 16, color: 'var(--c-texte-secondaire)', lineHeight: 1.5, textWrap: 'pretty' }}>
          Le stockage local doit être mis à jour, ce qui n’est possible que si cet onglet est le
          seul ouvert sur l’application. Fermez les autres, puis rechargez.
        </p>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--c-texte-secondaire)', textWrap: 'pretty' }}>
          Vos saisies en attente d’envoi sont conservées.
        </p>
      </div>

      <button
        type="button"
        onClick={() => window.location.reload()}
        style={{
          minHeight: 'var(--cible-tactile)',
          padding: '0 24px',
          border: 'none',
          borderRadius: 'var(--rayon)',
          background: 'var(--c-primaire)',
          color: '#FFFFFF',
          fontSize: 17,
          fontWeight: 600,
        }}
      >
        Recharger
      </button>
    </div>
  );
}
