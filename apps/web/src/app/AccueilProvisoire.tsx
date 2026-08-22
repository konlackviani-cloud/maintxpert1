/**
 * Accueil provisoire post-connexion — phase 2.
 * Prouve que la session tient et donne accès à la déconnexion.
 * Sera remplacé en phase 3 par le parcours de diagnostic (technicien) et en
 * phase 7 par le tableau de bord (responsable).
 */

import { useState } from 'react';

import { BandeauSync } from '../composants/ui/BandeauSync.js';
import { useSession } from '../modules/auth/contexte-session.js';

export function AccueilProvisoire(): JSX.Element {
  const { utilisateur, seDeconnecter } = useSession();
  const [enCours, setEnCours] = useState(false);

  const estResponsable = utilisateur?.role === 'responsable';

  async function deconnecter(): Promise<void> {
    setEnCours(true);
    try {
      await seDeconnecter();
    } finally {
      setEnCours(false);
    }
  }

  return (
    <>
      <BandeauSync />

      <main
        style={{
          maxWidth: 'var(--largeur-contenu)',
          margin: '0 auto',
          padding: 'var(--e-6) var(--e-4)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--e-6)',
        }}
      >
        <div>
          <h1 style={{ fontSize: 'var(--taille-xl)', margin: 0 }}>
            Bonjour, {utilisateur?.prenom} {utilisateur?.nom}
          </h1>
          <p
            style={{
              margin: '4px 0 0',
              fontFamily: 'var(--police-mono)',
              fontSize: 'var(--taille-sm)',
              color: 'var(--c-texte-secondaire)',
            }}
          >
            {utilisateur?.matricule} · {estResponsable ? 'Responsable maintenance' : 'Technicien'}
          </p>
        </div>

        <div
          style={{
            border: '1.5px solid var(--c-bordure)',
            borderRadius: 'var(--rayon-lg)',
            background: 'var(--c-primaire-clair)',
            padding: 'var(--e-4)',
          }}
        >
          <h2 style={{ fontSize: 'var(--taille-lg)', margin: '0 0 var(--e-2)' }}>
            Session ouverte
          </h2>
          <p style={{ margin: 0, textWrap: 'pretty' }}>
            {estResponsable
              ? 'Le tableau de bord, la file de validation et le défaillogramme arrivent aux phases 4 à 8.'
              : 'Le parcours de diagnostic arrive à la phase 3 : chaîne, équipement, symptôme, puis les fiches triées par fréquence.'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => void deconnecter()}
          disabled={enCours}
          style={{
            height: 'var(--cible-tactile)',
            borderRadius: 'var(--rayon)',
            border: '1.5px solid var(--c-bordure)',
            background: 'var(--c-fond)',
            color: 'var(--c-texte)',
            fontSize: 'var(--taille-base)',
            fontWeight: 'var(--graisse-moyenne)',
            alignSelf: 'flex-start',
            padding: '0 var(--e-6)',
          }}
        >
          {enCours ? 'Déconnexion…' : 'Se déconnecter'}
        </button>

        <p
          style={{
            margin: 0,
            fontSize: 'var(--taille-xs)',
            color: 'var(--c-texte-secondaire)',
            textWrap: 'pretty',
          }}
        >
          La déconnexion efface les jetons et purge le cache local — aucune donnée de l’usine ne
          subsiste sur ce terminal.
        </p>
      </main>
    </>
  );
}
