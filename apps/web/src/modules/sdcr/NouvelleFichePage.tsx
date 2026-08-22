/**
 * A6 / A10 — documenter une nouvelle fiche SDCR.
 *
 * Quatre niveaux dans l'ordre du modèle : symptôme → défaut → cause → remède.
 * Chacun se choisit dans la nomenclature de l'équipement ; « Autre » ouvre une
 * saisie libre, comptabilisée par l'indicateur B5.
 */

import type { TypeTerme } from '@maintxpert/shared';
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { BandeauSync } from '../../composants/ui/BandeauSync.js';
import {
  Badge,
  BarreAction,
  Bouton,
  ChampRecherche,
  EnTete,
  Etiquette,
  IconeSuivant,
  IconeValider,
} from '../../composants/ui/index.js';
import { creerFiche, type SaisieFiche } from '../../horsligne/actions.js';
import { enfilerPhotoSDCR } from '../../horsligne/file-photos.js';
import { ChampPhoto, type PhotoChoisie } from '../../medias/ChampPhoto.js';
import { lireEquipement, listerTermes } from '../../horsligne/depots.js';
import { useSession } from '../auth/contexte-session.js';
import { obtenirInterventionCourante } from '../interventions/intervention-courante.js';

interface Choix {
  id_terme: number | null;
  libelle: string;
}

const VIDE: Choix = { id_terme: null, libelle: '' };

const INTITULES: Record<TypeTerme, string> = {
  symptome: 'Symptôme',
  defaut: 'Défaut constaté',
  cause: 'Cause',
  remede: 'Remède appliqué',
};

/** Sélecteur plein écran : liste filtrable + échappatoire « Autre ». */
function Selecteur({
  type,
  idEquipement,
  onChoisir,
  onAnnuler,
}: {
  type: TypeTerme;
  idEquipement: number;
  onChoisir: (choix: Choix) => void;
  onAnnuler: () => void;
}): JSX.Element {
  const [filtre, setFiltre] = useState('');
  const termes = useLiveQuery(() => listerTermes(idEquipement, type), [idEquipement, type], []);

  const requete = filtre.trim().toLocaleLowerCase('fr-FR');
  const resultats = (termes ?? []).filter((t) =>
    requete.length === 0 ? true : t.libelle.toLocaleLowerCase('fr-FR').includes(requete),
  );

  const saisieLibrePossible = filtre.trim().length >= 2;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 20,
        background: 'var(--c-fond)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '0 16px',
          minHeight: 60,
          borderBottom: '1.5px solid var(--c-bordure)',
        }}
      >
        <h2 style={{ flexGrow: 1, fontSize: 19, fontWeight: 700, margin: 0 }}>{INTITULES[type]}</h2>
        <button
          type="button"
          onClick={onAnnuler}
          style={{
            minHeight: 'var(--cible-tactile)',
            padding: '0 14px',
            border: 'none',
            background: 'transparent',
            fontSize: 16,
            fontWeight: 600,
            color: 'var(--c-primaire)',
          }}
        >
          Annuler
        </button>
      </header>

      <div style={{ padding: '14px 16px', borderBottom: '1.5px solid var(--c-bordure)' }}>
        <ChampRecherche valeur={filtre} onChange={setFiltre} placeholder="Filtrer ou décrire…" />
      </div>

      <div style={{ flexGrow: 1, overflowY: 'auto' }}>
        {resultats.map((terme) => (
          <button
            key={terme.id_terme}
            type="button"
            onClick={() => onChoisir({ id_terme: terme.id_terme, libelle: terme.libelle })}
            style={{
              width: '100%',
              minHeight: 72,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '10px 16px',
              border: 'none',
              borderBottom: '1px solid var(--c-bordure)',
              background: 'var(--c-fond)',
              textAlign: 'left',
              fontSize: 'var(--taille-base)',
              fontWeight: 600,
            }}
          >
            <span style={{ flexGrow: 1, textWrap: 'pretty' }}>{terme.libelle}</span>
            <IconeSuivant taille={22} couleur="var(--c-bordure-forte)" />
          </button>
        ))}

        {resultats.length === 0 && (
          <p
            style={{
              padding: '24px 16px',
              margin: 0,
              textAlign: 'center',
              color: 'var(--c-texte-secondaire)',
              textWrap: 'pretty',
            }}
          >
            {(termes ?? []).length === 0
              ? 'Aucun terme dans la nomenclature de cet équipement pour ce niveau.'
              : `Aucun terme ne correspond à « ${filtre} ».`}
          </p>
        )}

        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            type="button"
            disabled={!saisieLibrePossible}
            onClick={() => onChoisir({ id_terme: null, libelle: filtre.trim() })}
            style={{
              width: '100%',
              minHeight: 60,
              border: '1.5px dashed var(--c-bordure-forte)',
              borderRadius: 'var(--rayon)',
              background: 'var(--c-fond-secondaire)',
              color: saisieLibrePossible ? 'var(--c-texte)' : 'var(--c-texte-secondaire)',
              fontSize: 16,
              fontWeight: 500,
              padding: '0 16px',
              textWrap: 'pretty',
            }}
          >
            {saisieLibrePossible ? `Utiliser « ${filtre.trim()} »` : 'Autre — saisissez votre libellé ci-dessus'}
          </button>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <Badge ton="alerte">hors nomenclature — à reformuler par le responsable</Badge>
          </div>
        </div>
      </div>
    </div>
  );
}

function Champ({
  type,
  choix,
  actif,
  onOuvrir,
}: {
  type: TypeTerme;
  choix: Choix;
  actif: boolean;
  onOuvrir: () => void;
}): JSX.Element {
  const rempli = choix.libelle.length > 0;

  return (
    <button
      type="button"
      onClick={onOuvrir}
      style={{
        width: '100%',
        minHeight: 72,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 14px',
        border: `1.5px solid ${actif ? 'var(--c-primaire)' : 'var(--c-bordure)'}`,
        borderRadius: 'var(--rayon)',
        background: 'var(--c-fond)',
        textAlign: 'left',
      }}
    >
      <span style={{ flexGrow: 1, minWidth: 0 }}>
        <Etiquette couleur={actif ? 'var(--c-primaire)' : undefined}>{INTITULES[type]}</Etiquette>
        <span
          style={{
            display: 'block',
            fontSize: 16,
            fontWeight: rempli ? 600 : 400,
            color: rempli ? 'var(--c-texte)' : 'var(--c-texte-secondaire)',
            marginTop: 2,
            textWrap: 'pretty',
          }}
        >
          {rempli ? choix.libelle : 'Choisir dans la liste…'}
        </span>
      </span>
      {rempli && choix.id_terme === null && <Badge ton="alerte">libre</Badge>}
      {rempli && choix.id_terme !== null && <IconeValider taille={19} couleur="var(--c-succes)" />}
    </button>
  );
}

const NIVEAUX: TypeTerme[] = ['symptome', 'defaut', 'cause', 'remede'];

export function NouvelleFichePage(): JSX.Element {
  const { chaine = '', idEquipement = '' } = useParams();
  const [parametres] = useSearchParams();
  const naviguer = useNavigate();
  const { utilisateur } = useSession();

  const id = Number.parseInt(idEquipement, 10);
  const equipement = useLiveQuery(() => lireEquipement(id), [id], undefined);

  const symptomePrerempli = parametres.get('symptome');
  const [choix, setChoix] = useState<Record<TypeTerme, Choix>>({
    symptome: symptomePrerempli ? { id_terme: null, libelle: symptomePrerempli } : VIDE,
    defaut: VIDE,
    cause: VIDE,
    remede: VIDE,
  });

  const [selecteurOuvert, setSelecteurOuvert] = useState<TypeTerme | null>(null);
  const [photo, setPhoto] = useState<PhotoChoisie | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const complet = NIVEAUX.every((n) => choix[n].libelle.trim().length >= 2);

  async function enregistrer(): Promise<void> {
    if (!utilisateur || !complet) return;
    setEnCours(true);
    setErreur(null);

    try {
      const intervention = await obtenirInterventionCourante(utilisateur.id_utilisateur, id);

      const saisie: SaisieFiche = {
        id_equipement: id,
        id_terme_symptome: choix.symptome.id_terme,
        symptome: choix.symptome.libelle.trim(),
        id_terme_defaut: choix.defaut.id_terme,
        defaut: choix.defaut.libelle.trim(),
        id_terme_cause: choix.cause.id_terme,
        cause: choix.cause.libelle.trim(),
        id_terme_remede: choix.remede.id_terme,
        remede: choix.remede.libelle.trim(),
      };

      const idProvisoire = await creerFiche(saisie, utilisateur.id_utilisateur, intervention.id_local);

      // La photo part dans SA file : elle attendra que la fiche ait reçu son
      // identifiant serveur, sans retarder la remontée du texte.
      if (photo) await enfilerPhotoSDCR(photo.blob, idProvisoire);

      naviguer(`/diagnostic/fiche/${idProvisoire}`, {
        replace: true,
        state: { idLocalIntervention: intervention.id_local, retour: '/diagnostic' },
      });
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Enregistrement impossible.');
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <BandeauSync />
      <EnTete
        titre="Nouvelle fiche"
        sousTitre={`${chaine} · ${equipement?.nom ?? '…'}`}
        retour={`/diagnostic/${chaine}/${id}`}
      />

      <main style={{ flexGrow: 1, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {NIVEAUX.map((niveau, index) => (
          <Champ
            key={niveau}
            type={niveau}
            choix={choix[niveau]}
            actif={index === NIVEAUX.findIndex((n) => choix[n].libelle.length === 0)}
            onOuvrir={() => setSelecteurOuvert(niveau)}
          />
        ))}

        <ChampPhoto photo={photo} onChange={setPhoto} />

        <div
          style={{
            marginTop: 6,
            border: '1.5px solid var(--c-alerte)',
            background: 'var(--c-alerte-clair)',
            borderRadius: 'var(--rayon)',
            padding: '13px 14px',
            fontSize: 14,
            color: 'var(--c-alerte)',
            lineHeight: 1.45,
            textWrap: 'pretty',
          }}
        >
          Cette fiche sera relue par le responsable maintenance avant d’apparaître dans les
          recherches des autres techniciens.
        </div>

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

      <BarreAction>
        <Bouton desactive={!complet || enCours} onClick={() => void enregistrer()}>
          {enCours ? 'Enregistrement…' : 'Enregistrer la fiche'}
        </Bouton>
      </BarreAction>

      {selecteurOuvert && (
        <Selecteur
          type={selecteurOuvert}
          idEquipement={id}
          onAnnuler={() => setSelecteurOuvert(null)}
          onChoisir={(nouveau) => {
            setChoix((precedent) => ({ ...precedent, [selecteurOuvert]: nouveau }));
            setSelecteurOuvert(null);
          }}
        />
      )}
    </div>
  );
}

