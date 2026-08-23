/**
 * Cadre des écrans responsable : navigation horizontale persistante.
 * Densité bureau — texte à 15 px, l'utilisateur est assis et à la souris.
 */

import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';

import { styleMono } from '../../composants/ui/index.js';
import { useSession } from '../auth/contexte-session.js';

const ONGLETS: { chemin: string; libelle: string }[] = [
  { chemin: '/pilotage', libelle: 'Tableau de bord' },
  { chemin: '/pilotage/validation', libelle: 'Validation' },
  { chemin: '/pilotage/nomenclature', libelle: 'Nomenclature' },
  { chemin: '/pilotage/csd', libelle: 'Fiches CSD' },
  { chemin: '/pilotage/amdec', libelle: 'AMDEC' },
  { chemin: '/pilotage/recherche', libelle: 'Recherche' },
  { chemin: '/pilotage/import', libelle: 'Import' },
];

function initiales(prenom = '', nom = ''): string {
  return `${prenom.charAt(0)}${nom.charAt(0)}`.toUpperCase();
}

export function CadreResponsable({
  children,
  compteurValidation,
}: {
  children: ReactNode;
  compteurValidation?: number;
}): JSX.Element {
  const { utilisateur, seDeconnecter } = useSession();

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--c-fond-secondaire)',
        fontSize: 15,
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 24,
          padding: '0 24px',
          minHeight: 60,
          flexWrap: 'wrap',
          background: 'var(--c-fond)',
          borderBottom: '1.5px solid var(--c-bordure)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <img
            src="/icones/icone-192.png"
            alt=""
            width={34}
            height={34}
            style={{ borderRadius: 8, objectFit: 'contain' }}
          />
          <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.2px' }}>MaintXpert</span>
        </div>

        <nav style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {ONGLETS.map((onglet) => (
            <NavLink
              key={onglet.chemin}
              to={onglet.chemin}
              end={onglet.chemin === '/pilotage'}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                minHeight: 38,
                padding: '0 15px',
                borderRadius: 8,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? 'var(--c-primaire)' : 'var(--c-texte)',
                background: isActive ? 'var(--c-primaire-clair)' : 'transparent',
              })}
            >
              {onglet.libelle}
              {onglet.libelle === 'Validation' && (compteurValidation ?? 0) > 0 && (
                <span
                  style={{
                    ...styleMono,
                    minWidth: 22,
                    height: 22,
                    borderRadius: 11,
                    padding: '0 6px',
                    background: 'var(--c-alerte)',
                    color: '#FFFFFF',
                    fontSize: 12,
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {compteurValidation}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>
              {utilisateur?.prenom} {utilisateur?.nom}
            </div>
            <div style={{ ...styleMono, fontSize: 'var(--taille-xs)', color: 'var(--c-texte-secondaire)' }}>
              {utilisateur?.matricule} · Responsable
            </div>
          </div>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: 'var(--c-primaire-clair)',
              border: '1.5px solid var(--c-primaire)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: 14,
              color: 'var(--c-primaire)',
            }}
          >
            {initiales(utilisateur?.prenom, utilisateur?.nom)}
          </div>
          <button
            type="button"
            onClick={() => void seDeconnecter()}
            style={{
              minHeight: 38,
              padding: '0 14px',
              border: '1.5px solid var(--c-bordure)',
              borderRadius: 8,
              background: 'var(--c-fond)',
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            Quitter
          </button>
        </div>
      </header>

      {children}
    </div>
  );
}



