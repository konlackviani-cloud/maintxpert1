/** A2 — accueil technicien : reprise du chantier en cours, puis choix de la chaîne. */

import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';

import { BandeauSync } from '../../composants/ui/BandeauSync.js';
import { Bouton, Chargement, EtatVide, Etiquette, styleMono } from '../../composants/ui/index.js';
import { formaterDuree } from '../../horsligne/actions.js';
import { lireEquipement, listerChaines } from '../../horsligne/depots.js';
import { useSession } from '../auth/contexte-session.js';
import { useInterventionsOuvertes } from '../interventions/intervention-courante.js';

function DureeEcoulee({ depuis }: { depuis: string }) {
  const secondes = Math.max(0, Math.round((Date.now() - new Date(depuis).getTime()) / 1000));
  return <>{formaterDuree(secondes)}</>;
}

export function ChainePage(): JSX.Element {
  const naviguer = useNavigate();
  const { utilisateur, seDeconnecter } = useSession();

  const chaines = useLiveQuery(() => listerChaines(), [], undefined);
  const ouvertes = useInterventionsOuvertes(utilisateur?.id_utilisateur);

  const equipementsOuverts = useLiveQuery(
    async () =>
      Promise.all(
        ouvertes.map(async (i) => ({ intervention: i, equipement: await lireEquipement(i.id_equipement) })),
      ),
    [ouvertes.map((i) => i.id_local).join(',')],
    [],
  );

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <BandeauSync />

      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 16px',
          borderBottom: '1.5px solid var(--c-bordure)',
        }}
      >
        <div style={{ flexGrow: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>
            Bonjour, {utilisateur?.prenom} {utilisateur?.nom}
          </h1>
          <p style={{ ...styleMono, fontSize: 13, color: 'var(--c-texte-secondaire)', margin: 0 }}>
            {utilisateur?.matricule} · Technicien
          </p>
        </div>
        <button
          type="button"
          onClick={() => void seDeconnecter()}
          style={{
            minHeight: 'var(--cible-tactile)',
            padding: '0 14px',
            border: '1.5px solid var(--c-bordure)',
            borderRadius: 'var(--rayon)',
            background: 'var(--c-fond)',
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          Quitter
        </button>
      </header>

      <main style={{ flexGrow: 1, padding: 16, display: 'flex', flexDirection: 'column', gap: 22 }}>
        {(equipementsOuverts ?? []).length > 0 && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Etiquette>Intervention en cours</Etiquette>
            {(equipementsOuverts ?? []).map(({ intervention, equipement }) => (
              <button
                key={intervention.id_local}
                type="button"
                onClick={() =>
                  naviguer(
                    `/diagnostic/${equipement?.chaine ?? ''}/${intervention.id_equipement}`,
                  )
                }
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  textAlign: 'left',
                  padding: 14,
                  border: '1.5px solid var(--c-primaire)',
                  borderRadius: 'var(--rayon-lg)',
                  background: 'var(--c-primaire-clair)',
                }}
              >
                <span style={{ flexGrow: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 17, fontWeight: 600 }}>
                    {equipement?.nom ?? 'Équipement inconnu'}
                  </span>
                  <span
                    style={{ ...styleMono, display: 'block', fontSize: 14, color: 'var(--c-texte-secondaire)' }}
                  >
                    {equipement?.chaine} · ouverte depuis <DureeEcoulee depuis={intervention.datetime_ouverture} />
                  </span>
                </span>
                <span style={{ ...styleMono, fontSize: 15, fontWeight: 600, color: 'var(--c-primaire)' }}>
                  reprendre
                </span>
              </button>
            ))}
          </section>
        )}

        <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Etiquette>Nouveau diagnostic — choisir la chaîne</Etiquette>

          {chaines === undefined && <Chargement quoi="Lecture du cache local…" />}

          {chaines?.length === 0 && (
            <EtatVide
              titre="Aucun équipement en cache"
              explication="La liste des équipements n’a pas encore été téléchargée. Connectez-vous au réseau de l’usine, la synchronisation se fera automatiquement."
            />
          )}

          {chaines && chaines.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
              {chaines.map(({ chaine, nb_equipements }) => (
                <button
                  key={chaine}
                  type="button"
                  onClick={() => naviguer(`/diagnostic/${chaine}`)}
                  style={{
                    minHeight: 132,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: 8,
                    padding: 16,
                    border: '1.5px solid var(--c-bordure)',
                    borderRadius: 'var(--rayon-lg)',
                    background: 'var(--c-fond)',
                    textAlign: 'left',
                  }}
                >
                  <span
                    style={{
                      ...styleMono,
                      fontSize: 32,
                      fontWeight: 600,
                      color: 'var(--c-primaire)',
                      letterSpacing: '-0.5px',
                    }}
                  >
                    {chaine}
                  </span>
                  <span style={{ fontSize: 15, fontWeight: 600 }}>
                    {nb_equipements} équipement{nb_equipements > 1 ? 's' : ''}
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>

        <Bouton variante="secondaire" onClick={() => naviguer('/mes-contributions')}>
          Mes contributions
        </Bouton>
      </main>
    </div>
  );
}
