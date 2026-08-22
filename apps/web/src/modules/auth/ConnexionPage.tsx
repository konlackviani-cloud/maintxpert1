/**
 * A1 — écran de connexion.
 * Suit la maquette « 1 · Connexion » : identité centrée, deux champs, action
 * principale de 72 px ancrée en bas.
 *
 * Les couleurs viennent des jetons de design (design/jetons.css) : elles
 * changeront d'un bloc quand la charte SABC sera fournie, sans toucher à ce
 * fichier.
 */

import { normaliserMatricule, validerMatricule } from '@maintxpert/shared';
import { useState, type FormEvent } from 'react';

import { ErreurApi, ErreurReseau } from '../../lib/client-api.js';
import { useSession } from './contexte-session.js';

export function ConnexionPage(): JSX.Element {
  const { seConnecter } = useSession();

  const [matricule, setMatricule] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [motDePasseVisible, setMotDePasseVisible] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  async function soumettre(evenement: FormEvent): Promise<void> {
    evenement.preventDefault();
    setErreur(null);

    const validation = validerMatricule(matricule);
    if (!validation.valide) {
      setErreur(validation.motif);
      return;
    }
    if (motDePasse.length === 0) {
      setErreur('Saisissez votre mot de passe.');
      return;
    }

    setEnCours(true);
    try {
      await seConnecter({ matricule: normaliserMatricule(matricule), mot_de_passe: motDePasse });
    } catch (e) {
      if (e instanceof ErreurReseau) {
        setErreur(
          'Serveur injoignable. La première connexion sur ce terminal nécessite une connexion réseau.',
        );
      } else if (e instanceof ErreurApi) {
        // Une 5xx n'est pas la faute du technicien : on le dit, plutôt que de
        // lui laisser croire que son matricule est en cause.
        setErreur(
          e.statut >= 500
            ? `${e.message} Si le problème persiste, prévenez le responsable maintenance.`
            : e.message,
        );
      } else {
        setErreur('Connexion impossible. Réessayez.');
      }
      setMotDePasse('');
    } finally {
      setEnCours(false);
    }
  }

  return (
    <form
      onSubmit={soumettre}
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--c-fond)',
      }}
    >
      <div
        style={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 'var(--e-8)',
          padding: 'var(--e-8) var(--e-6)',
          maxWidth: 'var(--largeur-contenu)',
          width: '100%',
          margin: '0 auto',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--e-4)' }}>
          <div
            style={{
              width: 76,
              height: 76,
              borderRadius: 18,
              background: 'var(--c-primaire)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 19V6l7 7 7-7v13" />
            </svg>
          </div>
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ fontSize: 'var(--taille-2xl)', margin: 0, letterSpacing: '-0.5px' }}>MaintXpert</h1>
            <p style={{ margin: '2px 0 0', color: 'var(--c-texte-secondaire)', fontSize: 'var(--taille-sm)' }}>
              Diagnostic des défaillances
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--e-4)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--e-2)' }}>
            <label htmlFor="matricule" style={etiquette}>Matricule</label>
            <input
              id="matricule"
              name="matricule"
              value={matricule}
              onChange={(e) => setMatricule(e.target.value)}
              autoComplete="username"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              inputMode="text"
              enterKeyHint="next"
              placeholder="TC-0000"
              disabled={enCours}
              style={{ ...champ, fontFamily: 'var(--police-mono)', fontSize: 'var(--taille-lg)', letterSpacing: '1px' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--e-2)' }}>
            <label htmlFor="mot-de-passe" style={etiquette}>Mot de passe</label>
            <div style={{ position: 'relative', display: 'flex' }}>
              <input
                id="mot-de-passe"
                name="mot-de-passe"
                type={motDePasseVisible ? 'text' : 'password'}
                value={motDePasse}
                onChange={(e) => setMotDePasse(e.target.value)}
                autoComplete="current-password"
                enterKeyHint="go"
                disabled={enCours}
                style={{ ...champ, flexGrow: 1, paddingRight: 64 }}
              />
              <button
                type="button"
                onClick={() => setMotDePasseVisible((v) => !v)}
                aria-label={motDePasseVisible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 0,
                  bottom: 0,
                  width: 56,
                  border: 'none',
                  background: 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--c-texte-secondaire)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z" />
                  <circle cx="12" cy="12" r="2.6" />
                  {motDePasseVisible && <path d="M4 20L20 4" />}
                </svg>
              </button>
            </div>
          </div>

          {erreur && (
            <div
              role="alert"
              style={{
                border: '1.5px solid var(--c-danger)',
                background: 'var(--c-danger-clair)',
                color: 'var(--c-danger)',
                borderRadius: 'var(--rayon)',
                padding: 'var(--e-3) var(--e-4)',
                fontSize: 'var(--taille-sm)',
                textWrap: 'pretty',
              }}
            >
              {erreur}
            </div>
          )}
        </div>
      </div>

      <div
        style={{
          padding: '0 var(--e-6) var(--e-6)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--e-4)',
          maxWidth: 'var(--largeur-contenu)',
          width: '100%',
          margin: '0 auto',
        }}
      >
        <button
          type="submit"
          disabled={enCours}
          style={{
            height: 'var(--cible-tactile-lg)',
            borderRadius: 'var(--rayon)',
            border: 'none',
            background: enCours ? 'var(--c-bordure-forte)' : 'var(--c-primaire)',
            color: '#FFFFFF',
            fontSize: 'var(--taille-lg)',
            fontWeight: 'var(--graisse-moyenne)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'var(--e-2)',
          }}
        >
          {enCours ? 'Connexion…' : 'Se connecter'}
        </button>

        <p
          style={{
            margin: 0,
            textAlign: 'center',
            color: 'var(--c-texte-secondaire)',
            fontSize: 'var(--taille-xs)',
          }}
        >
          Session valable 8 h — couvre un quart complet
        </p>
      </div>
    </form>
  );
}

const etiquette: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.9px',
  textTransform: 'uppercase',
  color: 'var(--c-texte-secondaire)',
};

const champ: React.CSSProperties = {
  height: 64,
  borderRadius: 'var(--rayon)',
  border: '1.5px solid var(--c-bordure)',
  background: 'var(--c-fond)',
  color: 'var(--c-texte)',
  padding: '0 var(--e-4)',
  fontSize: 'var(--taille-base)',
  width: '100%',
};
