/**
 * A5, A9, A11 — fiche SDCR et conduite de l'intervention.
 *
 * Un seul bouton principal, dont le libellé suit le jalon atteint :
 *   pas de T1.5  →  « Confirmer cette cause »   (A5 + A9)
 *   T1.5 posé    →  « Clôturer l'intervention » (A11)
 *   T2 posé      →  état terminal, plus d'action
 */

import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import { BandeauSync } from '../../composants/ui/BandeauSync.js';
import {
  Badge,
  BarreAction,
  Bouton,
  Chargement,
  EnTete,
  EtatVide,
  Etiquette,
  IconeValider,
  styleMono,
} from '../../composants/ui/index.js';
import { cloturerIntervention, confirmerCause, formaterDuree, mesurer } from '../../horsligne/actions.js';
import type { InterventionLocale } from '../../horsligne/db.js';
import { lireEquipement, lireFiche } from '../../horsligne/depots.js';
import { useInterventionLocale } from '../interventions/intervention-courante.js';

function Jalon({
  libelle,
  code,
  instant,
  atteint,
}: {
  libelle: string;
  code: string;
  instant: string | null;
  atteint: boolean;
}): JSX.Element {
  const heure = instant
    ? new Date(instant).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    : 'en attente';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div
        style={{
          width: 15,
          height: 15,
          borderRadius: '50%',
          flexShrink: 0,
          background: atteint ? 'var(--c-primaire)' : 'var(--c-fond)',
          border: `2.5px solid ${atteint ? 'var(--c-primaire)' : 'var(--c-bordure-forte)'}`,
        }}
      />
      <div style={{ flexGrow: 1 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: atteint ? 'var(--c-texte)' : 'var(--c-texte-secondaire)' }}>
          {libelle}
        </div>
        <div style={{ ...styleMono, fontSize: 13, color: 'var(--c-texte-secondaire)' }}>{code}</div>
      </div>
      <div
        style={{
          ...styleMono,
          fontSize: 15,
          fontWeight: 600,
          color: atteint ? 'var(--c-texte)' : 'var(--c-texte-secondaire)',
        }}
      >
        {heure}
      </div>
    </div>
  );
}

function Niveau({ etiquette, valeur, fort = false }: { etiquette: string; valeur: string; fort?: boolean }) {
  return (
    <div>
      <Etiquette couleur={fort ? 'var(--c-primaire)' : undefined}>{etiquette}</Etiquette>
      <div
        style={{
          fontSize: fort ? 19 : 17,
          fontWeight: fort ? 600 : 400,
          lineHeight: 1.3,
          marginTop: 2,
          textWrap: 'pretty',
        }}
      >
        {valeur}
      </div>
    </div>
  );
}

export function FichePage(): JSX.Element {
  const { idSdcr = '' } = useParams();
  const naviguer = useNavigate();
  const emplacement = useLocation();
  const etat = (emplacement.state ?? {}) as { idLocalIntervention?: string | null; retour?: string };

  const id = Number.parseInt(idSdcr, 10);
  const fiche = useLiveQuery(() => lireFiche(id), [id], undefined);
  const equipement = useLiveQuery(
    () => (fiche ? lireEquipement(fiche.id_equipement) : Promise.resolve(undefined)),
    [fiche?.id_equipement],
    undefined,
  );
  const intervention = useInterventionLocale(etat.idLocalIntervention ?? undefined);

  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function agir(intervention: InterventionLocale): Promise<void> {
    setEnCours(true);
    setErreur(null);
    try {
      if (intervention.datetime_cause_confirmee === null) {
        await confirmerCause(intervention.id_local, id);
      } else {
        await cloturerIntervention(intervention.id_local);
        naviguer('/diagnostic', { replace: true });
      }
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Action impossible.');
    } finally {
      setEnCours(false);
    }
  }

  if (fiche === undefined) {
    return (
      <div style={{ minHeight: '100dvh' }}>
        <BandeauSync />
        <Chargement />
      </div>
    );
  }

  if (fiche === null || !fiche) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
        <BandeauSync />
        <EnTete titre="Fiche introuvable" retour="/diagnostic" />
        <EtatVide
          titre="Cette fiche n’est pas dans le cache"
          explication="Elle a peut-être été archivée, ou n’a pas encore été téléchargée sur ce terminal."
        />
      </div>
    );
  }

  const mesure = intervention ? mesurer(intervention) : null;
  const causeConfirmee = intervention?.datetime_cause_confirmee !== null;
  const cloturee = intervention?.datetime_cloture !== null;

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <BandeauSync />
      <EnTete
        titre="Fiche SDCR"
        sousTitre={`${equipement?.chaine ?? ''} · ${equipement?.nom ?? ''}`}
        retour={etat.retour ?? '/diagnostic'}
        action={
          <span style={{ ...styleMono, fontSize: 17, fontWeight: 600, color: 'var(--c-primaire)', paddingRight: 10 }}>
            {fiche.frequence_observee}×
          </span>
        }
      />

      <main style={{ flexGrow: 1, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <section
          style={{
            border: '1.5px solid var(--c-bordure)',
            borderRadius: 'var(--rayon-lg)',
            background: 'var(--c-fond)',
            padding: 14,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <Niveau etiquette="Symptôme" valeur={fiche.symptome} />
          <div style={{ height: 1, background: 'var(--c-bordure)' }} />
          <Niveau etiquette="Défaut" valeur={fiche.defaut} fort />
          <div style={{ height: 1, background: 'var(--c-bordure)' }} />
          <Niveau etiquette="Cause" valeur={fiche.cause} />
          <div style={{ height: 1, background: 'var(--c-bordure)' }} />
          <Niveau etiquette="Remède" valeur={fiche.remede} />

          {!fiche.via_nomenclature && (
            <div>
              <Badge ton="alerte">saisie libre — libellés non normalisés</Badge>
            </div>
          )}
        </section>

        {intervention && (
          <section
            style={{
              border: '1.5px solid var(--c-bordure)',
              borderRadius: 'var(--rayon-lg)',
              padding: 14,
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <Etiquette>Mon intervention</Etiquette>
              <span
                style={{
                  ...styleMono,
                  marginLeft: 'auto',
                  fontSize: 13,
                  fontWeight: 600,
                  color: causeConfirmee ? 'var(--c-succes)' : 'var(--c-alerte)',
                }}
              >
                {causeConfirmee
                  ? `TTDi ${formaterDuree(mesure?.ttdi_secondes ?? null)}`
                  : 'diagnostic en cours'}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Jalon libelle="Intervention ouverte" code="T1" instant={intervention.datetime_ouverture} atteint />
              <Jalon
                libelle="Cause confirmée"
                code="T1.5"
                instant={intervention.datetime_cause_confirmee}
                atteint={causeConfirmee}
              />
              <Jalon
                libelle="Intervention clôturée"
                code="T2"
                instant={intervention.datetime_cloture}
                atteint={cloturee}
              />
            </div>
          </section>
        )}

        {erreur && (
          <div
            role="alert"
            style={{
              border: '1.5px solid var(--c-danger)',
              background: 'var(--c-danger-clair)',
              color: 'var(--c-danger)',
              borderRadius: 'var(--rayon)',
              padding: '12px 16px',
              fontSize: 15,
            }}
          >
            {erreur}
          </div>
        )}
      </main>

      {intervention && !cloturee && (
        <BarreAction>
          <Bouton
            variante={causeConfirmee ? 'succes' : 'principal'}
            desactive={enCours}
            onClick={() => void agir(intervention)}
            icone={<IconeValider taille={24} />}
          >
            {causeConfirmee ? 'Clôturer l’intervention' : 'Confirmer cette cause'}
          </Bouton>
        </BarreAction>
      )}
    </div>
  );
}
