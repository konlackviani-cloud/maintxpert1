/**
 * A3 — sélection du symptôme.
 *
 * Nomenclature contrôlée en priorité ; l'option « Autre » existe mais reste
 * délibérément discrète — c'est elle que mesure l'indicateur B5 (taux de
 * recours à la nomenclature non contrôlée).
 */

import { normaliserLibelle } from '@maintxpert/shared';
import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { BandeauSync } from '../../composants/ui/BandeauSync.js';
import {
  Badge,
  ChampRecherche,
  Chargement,
  EnTete,
  EtatVide,
  Etiquette,
  IconePlus,
  LigneListe,
  styleMono,
} from '../../composants/ui/index.js';
import { lireEquipement, listerSymptomes } from '../../horsligne/depots.js';

export function SymptomePage(): JSX.Element {
  const { chaine = '', idEquipement = '' } = useParams();
  const naviguer = useNavigate();
  const [filtre, setFiltre] = useState('');

  const id = Number.parseInt(idEquipement, 10);
  const equipement = useLiveQuery(() => lireEquipement(id), [id], undefined);
  const symptomes = useLiveQuery(() => listerSymptomes(id), [id], undefined);

  const resultats = useMemo(() => {
    if (!symptomes) return [];
    const requete = normaliserLibelle(filtre);
    if (requete.length === 0) return symptomes;
    return symptomes.filter((s) => normaliserLibelle(s.libelle).includes(requete));
  }, [symptomes, filtre]);

  const versResultats = (libelle: string): void =>
    naviguer(`/diagnostic/${chaine}/${id}/resultats/${encodeURIComponent(libelle)}`);

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <BandeauSync />
      <EnTete
        titre="Que constatez-vous ?"
        sousTitre={`${chaine} · ${equipement?.nom ?? '…'}`}
        retour={`/diagnostic/${chaine}`}
      />

      <div style={{ padding: '14px 16px', borderBottom: '1.5px solid var(--c-bordure)' }}>
        <ChampRecherche valeur={filtre} onChange={setFiltre} placeholder="Filtrer les symptômes…" />
      </div>

      <main style={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        {symptomes === undefined && <Chargement />}

        {symptomes && resultats.length === 0 && (
          <EtatVide
            titre={symptomes.length === 0 ? 'Aucun symptôme répertorié' : 'Aucun résultat'}
            explication={
              symptomes.length === 0
                ? 'Cet équipement n’a encore aucun symptôme dans la nomenclature. Décrivez le vôtre : il servira aux prochains.'
                : `Aucun symptôme ne correspond à « ${filtre} ».`
            }
          />
        )}

        {resultats.length > 0 && (
          <>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '12px 16px 6px',
                background: 'var(--c-fond-secondaire)',
                borderBottom: '1px solid var(--c-bordure)',
              }}
            >
              <Etiquette>Symptômes connus</Etiquette>
              <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--c-texte-secondaire)' }}>
                les plus fréquents d’abord
              </span>
            </div>

            {resultats.map((symptome) => (
              <LigneListe
                key={`${symptome.id_terme ?? 'libre'}-${symptome.libelle}`}
                titre={symptome.libelle}
                sousTitre={
                  symptome.nb_fiches > 0
                    ? `${symptome.nb_fiches} fiche${symptome.nb_fiches > 1 ? 's' : ''} rattachée${symptome.nb_fiches > 1 ? 's' : ''}`
                    : 'aucune fiche pour l’instant'
                }
                suffixe={
                  symptome.nb_fiches > 0 ? (
                    <span style={{ ...styleMono, fontSize: 15, fontWeight: 600, color: 'var(--c-primaire)' }}>
                      {symptome.nb_fiches}
                    </span>
                  ) : undefined
                }
                onClick={() => versResultats(symptome.libelle)}
              />
            ))}
          </>
        )}

        <div style={{ padding: 18 }}>
          <button
            type="button"
            onClick={() => naviguer(`/diagnostic/${chaine}/${id}/nouvelle-fiche`)}
            style={{
              width: '100%',
              minHeight: 60,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              border: '1.5px dashed var(--c-bordure-forte)',
              borderRadius: 'var(--rayon)',
              background: 'var(--c-fond-secondaire)',
              color: 'var(--c-texte-secondaire)',
              fontSize: 16,
              fontWeight: 500,
            }}
          >
            <IconePlus taille={21} />
            Autre — le décrire moi-même
          </button>
          <p
            style={{
              margin: '10px 0 0',
              fontSize: 13,
              color: 'var(--c-texte-secondaire)',
              textAlign: 'center',
              textWrap: 'pretty',
            }}
          >
            À n’utiliser que si aucun symptôme ci-dessus ne convient. Le responsable devra le
            reformuler.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 10 }}>
            <Badge ton="alerte">saisie libre suivie par l’indicateur B5</Badge>
          </div>
        </div>
      </main>
    </div>
  );
}
