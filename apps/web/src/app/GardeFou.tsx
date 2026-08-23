/**
 * Garde-fou contre les plantages de rendu.
 *
 * Sans lui, une exception dans un composant démonte tout l'arbre React et
 * laisse un écran blanc : sur le terrain, de nuit, le technicien n'a alors
 * aucun moyen de comprendre ni de repartir. Ici, il voit ce qui s'est passé et
 * garde deux issues — recharger, ou revenir à l'accueil.
 *
 * Ce que ce garde-fou NE fait PAS : purger le cache. Les saisies en attente
 * d'envoi y sont stockées ; les effacer sur un plantage d'affichage perdrait le
 * travail d'un quart entier.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface Etat {
  erreur: Error | null;
}

export class GardeFou extends Component<Props, Etat> {
  override state: Etat = { erreur: null };

  static getDerivedStateFromError(erreur: Error): Etat {
    return { erreur };
  }

  override componentDidCatch(erreur: Error, infos: ErrorInfo): void {
    console.error('[garde-fou] rendu interrompu :', erreur, infos.componentStack);
  }

  override render(): ReactNode {
    const { erreur } = this.state;
    if (!erreur) return this.props.children;

    return (
      <div
        role="alert"
        style={{
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 20,
          padding: '48px 28px',
          textAlign: 'center',
          background: 'var(--c-fond)',
          color: 'var(--c-texte)',
          fontFamily: 'var(--police)',
        }}
      >
        <div
          style={{
            width: 96,
            height: 96,
            borderRadius: '50%',
            background: 'var(--c-danger-clair)',
            border: '1.5px solid var(--c-danger)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="var(--c-danger)"
            strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 4l9 16H3z" />
            <path d="M12 10v4M12 17h.01" />
          </svg>
        </div>

        <div style={{ maxWidth: 460, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h1 style={{ fontSize: 21, fontWeight: 700, margin: 0, textWrap: 'pretty' }}>
            L’écran n’a pas pu s’afficher
          </h1>
          <p style={{ margin: 0, fontSize: 16, color: 'var(--c-texte-secondaire)', lineHeight: 1.5, textWrap: 'pretty' }}>
            Vos saisies en attente d’envoi sont conservées sur ce terminal — rien n’est perdu.
            Rechargez la page pour repartir.
          </p>
          <p style={{
            margin: 0,
            fontFamily: 'var(--police-mono)',
            fontSize: 13,
            color: 'var(--c-texte-secondaire)',
            wordBreak: 'break-word',
          }}>
            {erreur.message}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
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
          <button
            type="button"
            onClick={() => {
              window.location.href = '/';
            }}
            style={{
              minHeight: 'var(--cible-tactile)',
              padding: '0 20px',
              border: '1.5px solid var(--c-bordure)',
              borderRadius: 'var(--rayon)',
              background: 'var(--c-fond)',
              color: 'var(--c-texte)',
              fontSize: 17,
              fontWeight: 600,
            }}
          >
            Revenir à l’accueil
          </button>
        </div>
      </div>
    );
  }
}
