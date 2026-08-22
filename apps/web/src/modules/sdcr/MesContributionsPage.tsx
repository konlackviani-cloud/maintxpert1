/** A12 — statut des fiches proposées par le technicien connecté. */

import type { StatutSDCR } from '@maintxpert/shared';
import { useLiveQuery } from 'dexie-react-hooks';

import { BandeauSync } from '../../composants/ui/BandeauSync.js';
import { Badge, Chargement, EnTete, EtatVide, Etiquette, styleMono } from '../../composants/ui/index.js';
import { listerMesContributions } from '../../horsligne/depots.js';
import { useSession } from '../auth/contexte-session.js';

const PRESENTATION: Record<StatutSDCR, { libelle: string; ton: 'neutre' | 'succes' | 'alerte' | 'danger' }> = {
  en_attente: { libelle: 'en attente de validation', ton: 'alerte' },
  en_correction: { libelle: 'renvoyée pour correction', ton: 'alerte' },
  validee: { libelle: 'validée', ton: 'succes' },
  rejetee: { libelle: 'rejetée', ton: 'danger' },
  archivee: { libelle: 'archivée', ton: 'neutre' },
};

export function MesContributionsPage(): JSX.Element {
  const { utilisateur } = useSession();

  const fiches = useLiveQuery(
    () =>
      utilisateur ? listerMesContributions(utilisateur.id_utilisateur) : Promise.resolve(undefined),
    [utilisateur?.id_utilisateur],
    undefined,
  );

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <BandeauSync />
      <EnTete titre="Mes contributions" retour="/diagnostic" />

      <main style={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        {fiches === undefined && <Chargement />}

        {fiches?.length === 0 && (
          <EtatVide
            titre="Aucune contribution"
            explication="Les fiches que vous documenterez apparaîtront ici, avec leur statut de validation."
          />
        )}

        {fiches && fiches.length > 0 && (
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {fiches.map((fiche) => {
              const presentation = PRESENTATION[fiche.statut];
              const enAttenteDEnvoi = fiche.id_sdcr < 0;

              return (
                <article
                  key={fiche.id_sdcr}
                  style={{
                    border: '1.5px solid var(--c-bordure)',
                    borderRadius: 'var(--rayon-lg)',
                    padding: 14,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <Badge ton={presentation.ton}>{presentation.libelle}</Badge>
                    {enAttenteDEnvoi && <Badge ton="neutre">pas encore envoyée</Badge>}
                    <span
                      style={{
                        ...styleMono,
                        marginLeft: 'auto',
                        fontSize: 13,
                        color: 'var(--c-texte-secondaire)',
                      }}
                    >
                      {new Date(fiche.date_creation).toLocaleDateString('fr-FR')}
                    </span>
                  </div>

                  <div>
                    <Etiquette>Symptôme</Etiquette>
                    <div style={{ fontSize: 16, textWrap: 'pretty' }}>{fiche.symptome}</div>
                  </div>

                  <div>
                    <Etiquette couleur="var(--c-primaire)">Défaut</Etiquette>
                    <div style={{ fontSize: 17, fontWeight: 600, textWrap: 'pretty' }}>{fiche.defaut}</div>
                  </div>

                  {fiche.statut === 'validee' && (
                    <p style={{ margin: 0, fontSize: 14, color: 'var(--c-succes)' }}>
                      Visible par tous les techniciens · observée {fiche.frequence_observee} fois
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
