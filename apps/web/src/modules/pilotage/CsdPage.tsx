/**
 * B6 — création et mise à jour des fiches CSD.
 *
 * La description s'enregistre d'abord, la photo ensuite : une photo de
 * référence sans texte pour l'expliquer n'aide personne, et l'API refuse de
 * créer une fiche depuis un simple envoi d'image.
 */

import type { FicheCSD } from '@maintxpert/shared';
import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useEffect, useState } from 'react';

import { PhotoAuthentifiee } from '../../composants/ui/PhotoAuthentifiee.js';
import { Badge, Chargement, Etiquette, IconeValider } from '../../composants/ui/index.js';
import { listerChaines, listerEquipements } from '../../horsligne/depots.js';
import { ErreurApi } from '../../lib/client-api.js';
import { ChampPhoto, type PhotoChoisie } from '../../medias/ChampPhoto.js';
import { CadreResponsable } from './CadreResponsable.js';
import { chargerFicheCSD, enregistrerFicheCSD, envoyerPhotoCSD, messageErreurPilotage } from './api.js';

const selecteur: React.CSSProperties = {
  minHeight: 40,
  padding: '0 12px',
  border: '1.5px solid var(--c-bordure)',
  borderRadius: 8,
  background: 'var(--c-fond)',
  fontSize: 15,
};

export function CsdPage(): JSX.Element {
  const chaines = useLiveQuery(() => listerChaines(), [], []);
  const [chaine, setChaine] = useState('');
  const equipements = useLiveQuery(
    () => (chaine ? listerEquipements(chaine) : Promise.resolve([])),
    [chaine],
    [],
  );
  const [idEquipement, setIdEquipement] = useState<number | null>(null);

  const [fiche, setFiche] = useState<FicheCSD | null | undefined>(undefined);
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState<PhotoChoisie | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  useEffect(() => {
    if (!chaine && (chaines ?? []).length > 0) setChaine(chaines![0]!.chaine);
  }, [chaines, chaine]);

  useEffect(() => {
    setIdEquipement((equipements ?? [])[0]?.id_equipement ?? null);
  }, [equipements]);

  const recharger = useCallback(async (): Promise<void> => {
    if (idEquipement === null) return;
    setFiche(undefined);
    setPhoto(null);
    setConfirmation(null);

    try {
      const chargee = await chargerFicheCSD(idEquipement);
      setFiche(chargee);
      setDescription(chargee?.description ?? '');
    } catch (e) {
      // 404 = pas encore de fiche : c'est un état normal, pas une erreur.
      if (e instanceof ErreurApi && e.statut === 404) {
        setFiche(null);
        setDescription('');
      } else {
        setFiche(null);
        setErreur(messageErreurPilotage(e));
      }
    }
  }, [idEquipement]);

  useEffect(() => {
    void recharger();
  }, [recharger]);

  async function enregistrer(): Promise<void> {
    if (idEquipement === null) return;
    setEnCours(true);
    setErreur(null);
    setConfirmation(null);

    try {
      const enregistree = await enregistrerFicheCSD(idEquipement, description.trim());
      setFiche(enregistree);

      if (photo) {
        await envoyerPhotoCSD(idEquipement, photo.blob, photo.resume.type_mime);
        setPhoto(null);
        await recharger();
      }

      setConfirmation('Fiche CSD enregistrée. Elle descendra sur les terminaux à la prochaine synchronisation.');
    } catch (e) {
      setErreur(messageErreurPilotage(e));
    } finally {
      setEnCours(false);
    }
  }

  const texteValide = description.trim().length >= 10;

  return (
    <CadreResponsable>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
          padding: '12px 24px',
          background: 'var(--c-fond)',
          borderBottom: '1.5px solid var(--c-bordure)',
        }}
      >
        <Etiquette>Équipement</Etiquette>
        <select value={chaine} onChange={(e) => setChaine(e.target.value)} style={selecteur} aria-label="Chaîne">
          {(chaines ?? []).map((c) => (
            <option key={c.chaine} value={c.chaine}>
              {c.chaine}
            </option>
          ))}
        </select>
        <select
          value={idEquipement ?? ''}
          onChange={(e) => setIdEquipement(Number.parseInt(e.target.value, 10))}
          style={{ ...selecteur, minWidth: 260 }}
          aria-label="Équipement"
        >
          {(equipements ?? []).map((e) => (
            <option key={e.id_equipement} value={e.id_equipement}>
              {e.nom}
            </option>
          ))}
        </select>
        {fiche === null && <Badge ton="alerte">aucune fiche</Badge>}
        {fiche && <Badge ton="succes">fiche existante</Badge>}
      </div>

      <main
        style={{
          flexGrow: 1,
          padding: 24,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: 20,
          alignItems: 'start',
        }}
      >
        <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 19, fontWeight: 700, margin: 0 }}>Configuration Sans Défaut</h1>
            <p style={{ margin: '3px 0 0', fontSize: 14, color: 'var(--c-texte-secondaire)', textWrap: 'pretty' }}>
              L’état de référence auquel le technicien compare ce qu’il constate. Valeurs de réglage,
              points de contrôle, ce qui doit être absent.
            </p>
          </div>

          {fiche === undefined && <Chargement />}

          {fiche !== undefined && (
            <>
              <label htmlFor="description-csd">
                <Etiquette>Description de l’état nominal</Etiquette>
              </label>
              <textarea
                id="description-csd"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={12}
                placeholder={
                  'Pression de soutirage : 2,4 bar\nSeuil capteur de niveau : 65 %\n' +
                  'Étoiles d’entrée et de sortie alignées sans jeu latéral\n' +
                  'Aucune trace de produit sous le carter de came'
                }
                style={{
                  width: '100%',
                  padding: 12,
                  border: '1.5px solid var(--c-bordure)',
                  borderRadius: 8,
                  background: 'var(--c-fond)',
                  fontSize: 15,
                  lineHeight: 1.55,
                  resize: 'vertical',
                  fontFamily: 'inherit',
                }}
              />
              <div style={{ fontSize: 13, color: texteValide ? 'var(--c-texte-secondaire)' : 'var(--c-alerte)' }}>
                {texteValide ? `${description.trim().length} caractères` : '10 caractères minimum.'}
              </div>
            </>
          )}
        </section>

        <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Etiquette>Photo de référence</Etiquette>

          {fiche?.photo_url && photo === null && (
            <PhotoAuthentifiee
              nom={fiche.photo_url}
              alt="Photo de référence actuelle"
              hauteur={240}
            />
          )}

          <ChampPhoto
            photo={photo}
            onChange={setPhoto}
            libelle={fiche?.photo_url ? 'Remplacer la photo' : 'Ajouter une photo de référence'}
            aide="Machine à l’état nominal · une seule par fiche"
          />

          {fiche === null && (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--c-texte-secondaire)', textWrap: 'pretty' }}>
              La description sera enregistrée en premier ; la photo suivra dans la foulée.
            </p>
          )}
        </section>
      </main>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          flexWrap: 'wrap',
          padding: '15px 24px',
          background: 'var(--c-fond)',
          borderTop: '1.5px solid var(--c-bordure)',
        }}
      >
        <button
          type="button"
          disabled={enCours || !texteValide || idEquipement === null}
          onClick={() => void enregistrer()}
          style={{
            minHeight: 48,
            padding: '0 22px',
            border: 'none',
            borderRadius: 8,
            background: enCours || !texteValide ? 'var(--c-fond-secondaire)' : 'var(--c-primaire)',
            color: enCours || !texteValide ? 'var(--c-texte-secondaire)' : '#FFFFFF',
            fontSize: 16,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <IconeValider taille={20} />
          {enCours ? 'Enregistrement…' : 'Enregistrer la fiche CSD'}
        </button>

        {confirmation && (
          <span role="status" style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-succes)' }}>
            {confirmation}
          </span>
        )}
        {erreur && (
          <span role="alert" style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-danger)' }}>
            {erreur}
          </span>
        )}
      </div>
    </CadreResponsable>
  );
}
