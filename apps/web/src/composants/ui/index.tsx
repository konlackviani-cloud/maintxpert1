/**
 * Composants d'interface communs.
 *
 * Toutes les dimensions tactiles viennent des jetons (--cible-tactile = 56 px,
 * --cible-tactile-lg = 72 px) : usage avec gants, de nuit. Aucune valeur en dur.
 */

import type { CSSProperties, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

/* -------------------------------------------------------------------------- */
/* Icônes — tracées, jamais d'emoji                                            */
/* -------------------------------------------------------------------------- */

type PropsIcone = { taille?: number; couleur?: string };

const svg = (contenu: ReactNode, { taille = 24, couleur = 'currentColor' }: PropsIcone) => (
  <svg
    width={taille}
    height={taille}
    viewBox="0 0 24 24"
    fill="none"
    stroke={couleur}
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {contenu}
  </svg>
);

export const IconeRetour = (p: PropsIcone = {}) => svg(<path d="M15 5l-7 7 7 7" />, p);
export const IconeSuivant = (p: PropsIcone = {}) => svg(<path d="M9 5l7 7-7 7" />, p);
export const IconeRecherche = (p: PropsIcone = {}) =>
  svg(
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-4.2-4.2" />
    </>,
    p,
  );
export const IconeValider = (p: PropsIcone = {}) => svg(<path d="M4.5 12.5l5 5 10-11" />, p);
export const IconePlus = (p: PropsIcone = {}) => svg(<path d="M12 5v14M5 12h14" />, p);
export const IconeTri = (p: PropsIcone = {}) => svg(<path d="M4 6h16M7 12h10M10 18h4" />, p);
export const IconeHorloge = (p: PropsIcone = {}) =>
  svg(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>,
    p,
  );

/* -------------------------------------------------------------------------- */
/* Typographie                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Étiquette de section — « FILTRES », « NOUVEAU DIAGNOSTIC ».
 *
 * 13 px et pas 11 : `--taille-xs` est le plancher que le projet s'est donné, et
 * ces libellés ne sont pas des mentions légales — ce sont les repères de
 * structure que le technicien lit sous l'éclairage de l'atelier. La casse haute
 * et l'interlettrage suffisent à les distinguer du texte courant.
 */
export const styleEtiquette: CSSProperties = {
  fontSize: 'var(--taille-xs)',
  fontWeight: 700,
  letterSpacing: '0.9px',
  textTransform: 'uppercase',
  color: 'var(--c-texte-secondaire)',
};

export const styleMono: CSSProperties = { fontFamily: 'var(--police-mono)' };

export function Etiquette({ children, couleur }: { children: ReactNode; couleur?: string }) {
  return <div style={{ ...styleEtiquette, ...(couleur ? { color: couleur } : {}) }}>{children}</div>;
}

/* -------------------------------------------------------------------------- */
/* En-tête d'écran                                                             */
/* -------------------------------------------------------------------------- */

export function EnTete({
  titre,
  sousTitre,
  retour,
  action,
}: {
  titre: string;
  sousTitre?: string;
  /** Chemin de retour. Omis : pas de flèche. */
  retour?: string;
  action?: ReactNode;
}) {
  const naviguer = useNavigate();

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '0 8px 0 4px',
        minHeight: 60,
        background: 'var(--c-fond)',
        borderBottom: '1.5px solid var(--c-bordure)',
      }}
    >
      {retour && (
        <button
          type="button"
          onClick={() => naviguer(retour)}
          aria-label="Revenir à l’écran précédent"
          style={{
            width: 'var(--cible-tactile)',
            height: 'var(--cible-tactile)',
            border: 'none',
            background: 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <IconeRetour taille={26} />
        </button>
      )}

      <div style={{ flexGrow: 1, minWidth: 0, padding: retour ? 0 : '0 12px' }}>
        <h1
          style={{
            fontSize: 19,
            fontWeight: 700,
            margin: 0,
            lineHeight: 1.25,
            textWrap: 'pretty',
            overflowWrap: 'anywhere',
          }}
        >
          {titre}
        </h1>
        {sousTitre && (
          /*
           * Les repères d'équipement importés de DimoMaint sont longs et pleins
           * de blocs insécables — « VKPV-12/2/1 ». Sans `anywhere`, ils
           * poussaient l'en-tête au-delà de l'écran et la page défilait
           * latéralement. Deux lignes suffisent à reconnaître la machine devant
           * laquelle on se trouve ; le nom entier reste dans l'infobulle.
           */
          <p
            title={sousTitre}
            style={{
              ...styleMono,
              fontSize: 13,
              color: 'var(--c-texte-secondaire)',
              margin: 0,
              overflowWrap: 'anywhere',
              display: '-webkit-box',
              WebkitBoxOrient: 'vertical',
              WebkitLineClamp: 2,
              overflow: 'hidden',
            }}
          >
            {sousTitre}
          </p>
        )}
      </div>

      {/* L'action garde sa largeur : sans cela, un nom d'équipement long la
          comprimait jusqu'à rogner son libellé. */}
      {action && <div style={{ flexShrink: 0 }}>{action}</div>}
    </header>
  );
}

/* -------------------------------------------------------------------------- */
/* Boutons                                                                     */
/* -------------------------------------------------------------------------- */

export function Bouton({
  children,
  onClick,
  variante = 'principal',
  desactive = false,
  type = 'button',
  icone,
}: {
  children: ReactNode;
  onClick?: () => void;
  /** `principal` 72 px, `secondaire` et `danger` 60 px. */
  variante?: 'principal' | 'secondaire' | 'succes' | 'danger';
  desactive?: boolean;
  type?: 'button' | 'submit';
  icone?: ReactNode;
}) {
  const principal = variante === 'principal' || variante === 'succes';

  const fonds: Record<string, string> = {
    principal: 'var(--c-primaire)',
    succes: 'var(--c-succes)',
    secondaire: 'var(--c-fond)',
    danger: 'var(--c-fond)',
  };
  const textes: Record<string, string> = {
    principal: '#FFFFFF',
    succes: '#FFFFFF',
    secondaire: 'var(--c-primaire)',
    danger: 'var(--c-danger)',
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={desactive}
      style={{
        width: '100%',
        minHeight: principal ? 'var(--cible-tactile-lg)' : 'var(--cible-tactile)',
        borderRadius: 'var(--rayon)',
        border: principal ? 'none' : `1.5px solid var(--c-bordure)`,
        background: desactive ? 'var(--c-fond-secondaire)' : fonds[variante],
        color: desactive ? 'var(--c-texte-secondaire)' : textes[variante],
        fontSize: principal ? 19 : 17,
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        padding: '0 20px',
      }}
    >
      {icone}
      {children}
    </button>
  );
}

/** Barre d'action ancrée en bas — zone du pouce, tenue à une main. */
export function BarreAction({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        position: 'sticky',
        bottom: 0,
        padding: '12px 16px calc(16px + env(safe-area-inset-bottom))',
        background: 'var(--c-fond)',
        borderTop: '1.5px solid var(--c-bordure)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Listes filtrables — A2, A3                                                  */
/* -------------------------------------------------------------------------- */

export function ChampRecherche({
  valeur,
  onChange,
  placeholder,
}: {
  valeur: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        height: 58,
        padding: '0 16px',
        border: '1.5px solid var(--c-bordure)',
        borderRadius: 'var(--rayon)',
        background: 'var(--c-fond-secondaire)',
      }}
    >
      <IconeRecherche couleur="var(--c-texte-secondaire)" />
      <input
        type="search"
        value={valeur}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        autoComplete="off"
        style={{
          flexGrow: 1,
          border: 'none',
          background: 'transparent',
          outline: 'none',
          fontSize: 'var(--taille-base)',
          minWidth: 0,
        }}
      />
    </div>
  );
}

/** Rangée de liste : 72 px, cible tactile confortable avec des gants. */
export function LigneListe({
  titre,
  sousTitre,
  suffixe,
  actif = false,
  onClick,
}: {
  titre: string;
  sousTitre?: string;
  suffixe?: ReactNode;
  actif?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%',
        minHeight: 72,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '10px 16px',
        border: 'none',
        borderBottom: '1px solid var(--c-bordure)',
        background: actif ? 'var(--c-primaire-clair)' : 'var(--c-fond)',
        textAlign: 'left',
      }}
    >
      <span style={{ flexGrow: 1, minWidth: 0 }}>
        <span
          style={{
            display: 'block',
            fontWeight: 600,
            fontSize: 'var(--taille-base)',
            color: actif ? 'var(--c-primaire)' : 'var(--c-texte)',
            textWrap: 'pretty',
          }}
        >
          {titre}
        </span>
        {sousTitre && (
          <span style={{ display: 'block', fontSize: 14, color: 'var(--c-texte-secondaire)' }}>
            {sousTitre}
          </span>
        )}
      </span>
      {suffixe}
      <IconeSuivant taille={22} couleur={actif ? 'var(--c-primaire)' : 'var(--c-bordure-forte)'} />
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* États vides — exigés partout par le cahier des charges                      */
/* -------------------------------------------------------------------------- */

export function EtatVide({
  titre,
  explication,
  action,
}: {
  titre: string;
  explication: string;
  action?: ReactNode;
}) {
  return (
    <div
      style={{
        flexGrow: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 20,
        padding: '48px 28px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: 96,
          height: 96,
          borderRadius: '50%',
          background: 'var(--c-fond-secondaire)',
          border: '1.5px solid var(--c-bordure)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <IconeRecherche taille={44} couleur="var(--c-bordure-forte)" />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        <h2 style={{ fontSize: 21, fontWeight: 700, margin: 0, textWrap: 'pretty' }}>{titre}</h2>
        <p
          style={{
            margin: 0,
            fontSize: 16,
            color: 'var(--c-texte-secondaire)',
            lineHeight: 1.5,
            textWrap: 'pretty',
          }}
        >
          {explication}
        </p>
      </div>
      {action}
    </div>
  );
}

/** Écran en cours de lecture du cache — bref, mais jamais un écran blanc. */
export function Chargement({ quoi = 'Chargement…' }: { quoi?: string }) {
  return (
    <div
      role="status"
      style={{
        padding: 40,
        textAlign: 'center',
        color: 'var(--c-texte-secondaire)',
        fontSize: 'var(--taille-sm)',
      }}
    >
      {quoi}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

export function Badge({
  children,
  ton = 'neutre',
}: {
  children: ReactNode;
  ton?: 'neutre' | 'succes' | 'alerte' | 'danger' | 'primaire';
}) {
  const tons: Record<string, [string, string, string]> = {
    neutre: ['var(--c-fond-secondaire)', 'var(--c-bordure)', 'var(--c-texte-secondaire)'],
    succes: ['var(--c-succes-clair)', 'var(--c-succes)', 'var(--c-succes)'],
    alerte: ['var(--c-alerte-clair)', 'var(--c-alerte)', 'var(--c-alerte)'],
    danger: ['var(--c-danger-clair)', 'var(--c-danger)', 'var(--c-danger)'],
    primaire: ['var(--c-primaire-clair)', 'var(--c-primaire)', 'var(--c-primaire)'],
  };
  const [fond, bordure, texte] = tons[ton]!;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        // 13 px comme les étiquettes : un badge porte un statut de fiche, pas
        // une décoration. « en attente de validation » doit se lire d'un coup.
        height: 26,
        padding: '0 9px',
        borderRadius: 4,
        background: fond,
        border: `1px solid ${bordure}`,
        color: texte,
        fontSize: 'var(--taille-xs)',
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}
