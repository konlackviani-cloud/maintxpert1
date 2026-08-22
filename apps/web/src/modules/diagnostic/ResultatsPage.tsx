/**
 * A4 — fiches candidates, triées par fréquence observée décroissante.
 *
 * Le tri et le filtrage viennent de `rechercher()` dans @maintxpert/shared :
 * égalité stricte symptôme + équipement, aucune similarité approchée.
 *
 * C'est en arrivant ici que l'intervention s'ouvre (T1) : le diagnostic
 * commence réellement. Elle est horodatée à l'arrivée devant la machine, pas à
 * l'affichage de cet écran.
 */

import type { EntreeSDCR } from '@maintxpert/shared';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { BandeauSync } from '../../composants/ui/BandeauSync.js';
import {
  BarreAction,
  Bouton,
  Chargement,
  EnTete,
  EtatVide,
  Etiquette,
  IconePlus,
  IconeTri,
  styleMono,
} from '../../composants/ui/index.js';
import { lireEquipement, rechercherFiches } from '../../horsligne/depots.js';
import { useSession } from '../auth/contexte-session.js';
import { obtenirInterventionCourante } from '../interventions/intervention-courante.js';

function CarteSDCR({
  fiche,
  rang,
  onClick,
}: {
  fiche: EntreeSDCR;
  rang: number;
  onClick: () => void;
}): JSX.Element {
  const premiere = rang === 0;

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%',
        textAlign: 'left',
        border: `1.5px solid ${premiere ? 'var(--c-primaire)' : 'var(--c-bordure)'}`,
        borderRadius: 'var(--rayon-lg)',
        background: 'var(--c-fond)',
        overflow: 'hidden',
        padding: 0,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '9px 14px',
          background: premiere ? 'var(--c-primaire)' : 'var(--c-fond-secondaire)',
          borderBottom: premiere ? 'none' : '1px solid var(--c-bordure)',
        }}
      >
        <span
          style={{
            ...styleMono,
            fontSize: 19,
            fontWeight: 600,
            color: premiere ? '#FFFFFF' : 'var(--c-texte)',
          }}
        >
          {fiche.frequence_observee}×
        </span>
        <span
          style={{
            fontSize: 13,
            color: premiere ? 'rgba(255,255,255,0.85)' : 'var(--c-texte-secondaire)',
          }}
        >
          déjà observé
        </span>
      </div>

      <div style={{ padding: '13px 14px 14px', display: 'flex', flexDirection: 'column', gap: 11 }}>
        <div>
          <Etiquette couleur="var(--c-primaire)">Défaut à vérifier</Etiquette>
          <div style={{ fontSize: 19, fontWeight: 600, lineHeight: 1.3, marginTop: 2, textWrap: 'pretty' }}>
            {fiche.defaut}
          </div>
        </div>

        <div style={{ height: 1, background: 'var(--c-bordure)' }} />

        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ width: 62, flexShrink: 0, paddingTop: 2 }}>
            <Etiquette>Cause</Etiquette>
          </div>
          <div style={{ flexGrow: 1, fontSize: 16, textWrap: 'pretty' }}>{fiche.cause}</div>
        </div>
      </div>
    </button>
  );
}

export function ResultatsPage(): JSX.Element {
  const { chaine = '', idEquipement = '', symptome = '' } = useParams();
  const naviguer = useNavigate();
  const { utilisateur } = useSession();

  const id = Number.parseInt(idEquipement, 10);
  const libelleSymptome = decodeURIComponent(symptome);

  const equipement = useLiveQuery(() => lireEquipement(id), [id], undefined);
  const fiches = useLiveQuery(() => rechercherFiches(id, libelleSymptome), [id, libelleSymptome], undefined);

  const [idLocalIntervention, setIdLocalIntervention] = useState<string | null>(null);

  // T1 — le diagnostic commence. Idempotent : revenir sur cet écran ne rouvre
  // pas de chantier.
  useEffect(() => {
    if (!utilisateur || Number.isNaN(id)) return;
    let actif = true;

    void obtenirInterventionCourante(utilisateur.id_utilisateur, id).then((intervention) => {
      if (actif) setIdLocalIntervention(intervention.id_local);
    });

    return () => {
      actif = false;
    };
  }, [utilisateur, id]);

  const versNouvelleFiche = (): void =>
    naviguer(
      `/diagnostic/${chaine}/${id}/nouvelle-fiche?symptome=${encodeURIComponent(libelleSymptome)}`,
    );

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <BandeauSync />
      <EnTete
        titre={libelleSymptome}
        sousTitre={`${chaine} · ${equipement?.nom ?? '…'}`}
        retour={`/diagnostic/${chaine}/${id}`}
      />

      <main style={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        {fiches === undefined && <Chargement quoi="Recherche dans la base locale…" />}

        {fiches && fiches.length === 0 && (
          <EtatVide
            titre="Aucune fiche pour ce symptôme"
            explication="C’est la première fois que ce symptôme est signalé sur cet équipement. Votre diagnostic servira aux prochains."
            action={
              <div style={{ width: '100%', maxWidth: 320 }}>
                <Bouton onClick={versNouvelleFiche} icone={<IconePlus taille={23} />}>
                  Documenter ce cas
                </Bouton>
              </div>
            }
          />
        )}

        {fiches && fiches.length > 0 && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '12px 16px 4px' }}>
              <IconeTri taille={16} couleur="var(--c-texte-secondaire)" />
              <Etiquette>Triées par fréquence observée</Etiquette>
              <span
                style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 600, color: 'var(--c-succes)' }}
              >
                {fiches.length} fiche{fiches.length > 1 ? 's' : ''} validée{fiches.length > 1 ? 's' : ''}
              </span>
            </div>

            <div style={{ padding: '6px 16px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {fiches.map((fiche, rang) => (
                <CarteSDCR
                  key={fiche.id_sdcr}
                  fiche={fiche}
                  rang={rang}
                  onClick={() =>
                    naviguer(`/diagnostic/fiche/${fiche.id_sdcr}`, {
                      state: { idLocalIntervention, retour: window.location.pathname },
                    })
                  }
                />
              ))}
            </div>
          </>
        )}
      </main>

      {fiches && fiches.length > 0 && (
        <BarreAction>
          <Bouton variante="secondaire" onClick={versNouvelleFiche} icone={<IconePlus taille={21} />}>
            Aucune ne correspond
          </Bouton>
        </BarreAction>
      )}
    </div>
  );
}
