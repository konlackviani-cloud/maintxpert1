/** A2 — sélection de l'équipement dans une liste filtrable. */

import { normaliserLibelle } from '@maintxpert/shared';
import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { BandeauSync } from '../../composants/ui/BandeauSync.js';
import {
  ChampRecherche,
  Chargement,
  EnTete,
  EtatVide,
  Etiquette,
  LigneListe,
} from '../../composants/ui/index.js';
import { listerEquipements } from '../../horsligne/depots.js';
import { marquerArrivee } from '../interventions/intervention-courante.js';

export function EquipementPage(): JSX.Element {
  const { chaine = '' } = useParams();
  const naviguer = useNavigate();
  const [filtre, setFiltre] = useState('');

  const equipements = useLiveQuery(() => listerEquipements(chaine), [chaine], undefined);

  const resultats = useMemo(() => {
    if (!equipements) return [];
    const requete = normaliserLibelle(filtre);
    if (requete.length === 0) return equipements;
    return equipements.filter(
      (e) =>
        normaliserLibelle(e.nom).includes(requete) || normaliserLibelle(e.famille).includes(requete),
    );
  }, [equipements, filtre]);

  function choisir(idEquipement: number): void {
    // T1 est daté d'ici : c'est l'instant où le technicien se présente devant
    // la machine. L'intervention ne sera créée qu'au premier diagnostic.
    marquerArrivee(idEquipement);
    naviguer(`/diagnostic/${chaine}/${idEquipement}`);
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <BandeauSync />
      <EnTete titre="Équipement" sousTitre={chaine} retour="/diagnostic" />

      <div style={{ padding: '14px 16px', borderBottom: '1.5px solid var(--c-bordure)' }}>
        <ChampRecherche valeur={filtre} onChange={setFiltre} placeholder="Filtrer la liste…" />
      </div>

      <main style={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        {equipements === undefined && <Chargement />}

        {equipements && equipements.length === 0 && (
          <EtatVide
            titre={`Aucun équipement sur ${chaine}`}
            explication="Cette chaîne ne contient aucun équipement dans le cache local. La liste sera complétée à la prochaine synchronisation."
          />
        )}

        {equipements && equipements.length > 0 && resultats.length === 0 && (
          <EtatVide
            titre="Aucun résultat"
            explication={`Aucun équipement de ${chaine} ne correspond à « ${filtre} ». Effacez le filtre pour revoir la liste complète.`}
          />
        )}

        {resultats.length > 0 && (
          <>
            <div
              style={{
                padding: '12px 16px 6px',
                background: 'var(--c-fond-secondaire)',
                borderBottom: '1px solid var(--c-bordure)',
              }}
            >
              <Etiquette>
                {resultats.length} équipement{resultats.length > 1 ? 's' : ''}
              </Etiquette>
            </div>
            {resultats.map((equipement) => (
              <LigneListe
                key={equipement.id_equipement}
                titre={equipement.nom}
                sousTitre={equipement.famille}
                onClick={() => choisir(equipement.id_equipement)}
              />
            ))}
          </>
        )}
      </main>
    </div>
  );
}
