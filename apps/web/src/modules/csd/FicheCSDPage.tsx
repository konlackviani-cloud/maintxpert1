/**
 * A7 — consultation de la fiche CSD (Configuration Sans Défaut).
 *
 * Lue depuis le cache local : cet écran fonctionne sans réseau, c'est même son
 * intérêt principal — le technicien s'en sert devant la machine pour comparer
 * l'état constaté à l'état de référence.
 */

import { useLiveQuery } from 'dexie-react-hooks';
import { useParams } from 'react-router-dom';

import { BandeauSync } from '../../composants/ui/BandeauSync.js';
import { PhotoAuthentifiee } from '../../composants/ui/PhotoAuthentifiee.js';
import { Chargement, EnTete, EtatVide, Etiquette, IconeValider } from '../../composants/ui/index.js';
import { lireEquipement, lireFicheCSD } from '../../horsligne/depots.js';

export function FicheCSDPage(): JSX.Element {
  const { chaine = '', idEquipement = '' } = useParams();
  const id = Number.parseInt(idEquipement, 10);

  const equipement = useLiveQuery(() => lireEquipement(id), [id], undefined);
  const fiche = useLiveQuery(() => lireFicheCSD(id), [id], undefined);

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <BandeauSync />
      <EnTete
        titre="Configuration Sans Défaut"
        sousTitre={`${chaine} · ${equipement?.nom ?? '…'}`}
        retour={`/diagnostic/${chaine}/${id}`}
      />

      <main style={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        {fiche === undefined && <Chargement />}

        {fiche === null && (
          <EtatVide
            titre="Aucune fiche CSD"
            explication="L’état de référence de cet équipement n’a pas encore été documenté par le responsable maintenance."
          />
        )}

        {fiche && (
          <>
            <PhotoAuthentifiee
              nom={fiche.photo_url}
              alt={`Photo de référence — ${equipement?.nom ?? 'équipement'} à l’état nominal`}
            />

            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <IconeValider taille={21} couleur="var(--c-succes)" />
                <Etiquette couleur="var(--c-succes)">État de référence attendu</Etiquette>
              </div>

              <p
                style={{
                  margin: 0,
                  fontSize: 'var(--taille-base)',
                  lineHeight: 1.55,
                  whiteSpace: 'pre-line',
                  textWrap: 'pretty',
                }}
              >
                {fiche.description}
              </p>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
