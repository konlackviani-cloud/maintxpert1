/**
 * Prise de photo — une seule par fiche (contrainte du cahier des charges).
 *
 * `capture="environment"` ouvre directement l'appareil arrière sur mobile,
 * sans passer par le sélecteur de fichiers : un geste de moins avec des gants.
 *
 * La compression a lieu ici, à la sélection, et non à l'envoi : le technicien
 * voit tout de suite le poids réel de ce qui partira, et une photo de 4 Mo ne
 * séjourne jamais dans IndexedDB.
 */

import { useRef, useState } from 'react';

import { Badge, Etiquette, styleMono } from '../composants/ui/index.js';
import { compresserPhoto, formaterTaille, type PhotoCompressee } from './compression-photo.js';

export interface PhotoChoisie {
  blob: Blob;
  apercu: string;
  resume: PhotoCompressee;
}

export function ChampPhoto({
  photo,
  onChange,
  libelle = 'Ajouter une photo',
  aide = 'Facultatif · une seule par fiche',
}: {
  photo: PhotoChoisie | null;
  onChange: (photo: PhotoChoisie | null) => void;
  libelle?: string;
  aide?: string;
}): JSX.Element {
  const entree = useRef<HTMLInputElement>(null);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function choisir(fichier: File | undefined): Promise<void> {
    if (!fichier) return;
    setEnCours(true);
    setErreur(null);

    try {
      const resume = await compresserPhoto(fichier);
      if (photo) URL.revokeObjectURL(photo.apercu);
      onChange({ blob: resume.blob, apercu: URL.createObjectURL(resume.blob), resume });
    } catch {
      setErreur('Photo illisible. Réessayez, ou continuez sans photo.');
    } finally {
      setEnCours(false);
      if (entree.current) entree.current.value = '';
    }
  }

  function retirer(): void {
    if (photo) URL.revokeObjectURL(photo.apercu);
    onChange(null);
    setErreur(null);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <input
        ref={entree}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => void choisir(e.target.files?.[0])}
        style={{ display: 'none' }}
        aria-hidden="true"
        tabIndex={-1}
      />

      {photo === null ? (
        <button
          type="button"
          disabled={enCours}
          onClick={() => entree.current?.click()}
          style={{
            width: '100%',
            minHeight: 84,
            display: 'flex',
            alignItems: 'center',
            gap: 13,
            padding: 14,
            border: '1.5px dashed var(--c-bordure-forte)',
            borderRadius: 'var(--rayon)',
            background: 'var(--c-fond)',
            textAlign: 'left',
          }}
        >
          <span
            style={{
              width: 54,
              height: 54,
              borderRadius: 8,
              background: 'var(--c-fond-secondaire)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="var(--c-texte-secondaire)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 8h3l1.5-2h7L17 8h3v11H4z" />
              <circle cx="12" cy="13" r="3.2" />
            </svg>
          </span>
          <span style={{ flexGrow: 1 }}>
            <span style={{ display: 'block', fontSize: 16, fontWeight: 600 }}>
              {enCours ? 'Compression…' : libelle}
            </span>
            <span style={{ display: 'block', fontSize: 13, color: 'var(--c-texte-secondaire)' }}>
              {aide}
            </span>
          </span>
        </button>
      ) : (
        <div
          style={{
            border: '1.5px solid var(--c-bordure)',
            borderRadius: 'var(--rayon)',
            overflow: 'hidden',
            background: 'var(--c-fond)',
          }}
        >
          <img
            src={photo.apercu}
            alt="Aperçu de la photo prise"
            style={{ width: '100%', maxHeight: 240, objectFit: 'contain', display: 'block', background: 'var(--c-fond-secondaire)' }}
          />
          <div style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ flexGrow: 1, minWidth: 160 }}>
              <Etiquette>Photo prête</Etiquette>
              <div style={{ ...styleMono, fontSize: 13, color: 'var(--c-texte-secondaire)', marginTop: 2 }}>
                {formaterTaille(photo.resume.taille_octets)} · {photo.resume.largeur}×
                {photo.resume.hauteur} ·{' '}
                {photo.resume.type_mime === 'image/webp' ? 'WebP' : 'JPEG'}{' '}
                {Math.round(photo.resume.qualite * 100)} %
              </div>
            </div>
            {photo.resume.recompressee && <Badge ton="alerte">recompressée</Badge>}
            <button
              type="button"
              onClick={retirer}
              style={{
                minHeight: 'var(--cible-tactile)',
                padding: '0 16px',
                border: '1.5px solid var(--c-bordure)',
                borderRadius: 'var(--rayon)',
                background: 'var(--c-fond)',
                fontSize: 15,
                fontWeight: 600,
              }}
            >
              Retirer
            </button>
          </div>
          {photo.resume.taille_origine_octets > photo.resume.taille_octets * 1.2 && (
            <div
              style={{
                padding: '0 12px 12px',
                fontSize: 13,
                color: 'var(--c-texte-secondaire)',
                textWrap: 'pretty',
              }}
            >
              Réduite depuis {formaterTaille(photo.resume.taille_origine_octets)} — elle partira plus
              vite sur le réseau de l’usine.
            </div>
          )}
        </div>
      )}

      {erreur && (
        <div
          role="alert"
          style={{
            border: '1.5px solid var(--c-danger)',
            background: 'var(--c-danger-clair)',
            color: 'var(--c-danger)',
            borderRadius: 'var(--rayon)',
            padding: '11px 14px',
            fontSize: 14,
          }}
        >
          {erreur}
        </div>
      )}
    </div>
  );
}
