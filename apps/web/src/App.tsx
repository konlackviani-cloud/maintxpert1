/**
 * Écran d'accueil provisoire — phase 1.
 * Sert à vérifier que la chaîne complète tient debout : PWA installable, cache
 * IndexedDB ouvert, règles métier partagées exécutées côté client, sonde API.
 * Sera remplacé par le routage réel en phase 2 (authentification).
 */

import { SEUIL_IPR_CRITIQUE, SEUIL_RECURRENCE_DEFAUT, calculerIPR } from '@maintxpert/shared';
import { BandeauSync } from './composants/ui/BandeauSync.js';

const PHASES = [
  { numero: 1, libelle: 'Setup — monorepo, migrations, PWA', etat: 'en cours' },
  { numero: 2, libelle: 'Authentification (A1)', etat: 'à faire' },
  { numero: 3, libelle: 'Cœur technicien (A2–A11) + hors ligne', etat: 'à faire' },
  { numero: 4, libelle: 'Nomenclature & validation (B1, B2)', etat: 'à faire' },
  { numero: 5, libelle: 'CSD & photos (A7, B6)', etat: 'à faire' },
  { numero: 6, libelle: 'AMDEC & import CSV (B4, B7)', etat: 'à faire' },
  { numero: 7, libelle: 'Tableau de bord (B5, B3)', etat: 'à faire' },
  { numero: 8, libelle: 'Défaillogramme (B8)', etat: 'à faire' },
  { numero: 9, libelle: 'Durcissement, tests, mesure TTDi', etat: 'à faire' },
] as const;

export function App(): JSX.Element {
  // Exécution d'une règle partagée : preuve que packages/shared tourne bien
  // dans le navigateur, donc que la consultation hors ligne est possible.
  const exemple = calculerIPR(3, 2, 2);

  return (
    <>
      <BandeauSync />

      <main
        style={{
          maxWidth: 'var(--largeur-contenu)',
          margin: '0 auto',
          padding: 'var(--e-6) var(--e-4)',
        }}
      >
        <h1 style={{ fontSize: 'var(--taille-2xl)', margin: '0 0 var(--e-2)' }}>MaintXpert</h1>
        <p style={{ color: 'var(--c-texte-secondaire)', marginTop: 0 }}>
          Diagnostic guidé des défaillances industrielles — modèle SDCR.
          <br />
          Usine Terrain Court · chaînes CH02, CH05, CH06, CH09.
        </p>

        <section
          style={{
            background: 'var(--c-primaire-clair)',
            border: '1px solid var(--c-bordure)',
            borderRadius: 'var(--rayon-lg)',
            padding: 'var(--e-4)',
            margin: 'var(--e-6) 0',
          }}
        >
          <h2 style={{ fontSize: 'var(--taille-lg)', marginTop: 0 }}>Socle vérifié</h2>
          <ul style={{ margin: 0, paddingLeft: 'var(--e-6)' }}>
            <li>Règles métier partagées exécutées côté client</li>
            <li>
              Exemple : IPR(3 × 2 × 2) = <strong>{exemple.ipr}</strong>, critique ={' '}
              <strong>{exemple.critique ? 'oui' : 'non'}</strong> (seuil {SEUIL_IPR_CRITIQUE})
            </li>
            <li>Seuil de récurrence par défaut : {SEUIL_RECURRENCE_DEFAUT} occurrences</li>
            <li>Cache IndexedDB « maintxpert » initialisé</li>
          </ul>
        </section>

        <h2 style={{ fontSize: 'var(--taille-lg)' }}>Avancement</h2>
        <ol style={{ paddingLeft: 'var(--e-6)', lineHeight: 1.9 }}>
          {PHASES.map((phase) => (
            <li key={phase.numero}>
              {phase.libelle}{' '}
              <span
                style={{
                  fontSize: 'var(--taille-xs)',
                  padding: '2px 8px',
                  borderRadius: 999,
                  background: phase.etat === 'en cours' ? 'var(--c-alerte-clair)' : 'var(--c-fond-secondaire)',
                  color: phase.etat === 'en cours' ? 'var(--c-alerte)' : 'var(--c-texte-secondaire)',
                  border: '1px solid var(--c-bordure)',
                }}
              >
                {phase.etat}
              </span>
            </li>
          ))}
        </ol>
      </main>
    </>
  );
}
