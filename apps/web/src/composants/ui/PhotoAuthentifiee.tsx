/**
 * Affichage d'une photo servie par l'API.
 *
 * Les photos sont authentifiées : une balise `<img src>` ne porte pas le jeton
 * porteur et recevrait un 401. On les récupère donc par `fetch` avec l'en-tête
 * d'autorisation, puis on affiche l'objet obtenu.
 *
 * Le service worker met ces requêtes en cache (CacheFirst sur les images) :
 * une photo déjà consultée reste visible hors ligne.
 */

import { useEffect, useState } from 'react';

import { lireJetonAcces } from '../../modules/auth/stockage-session.js';

type Etat = 'chargement' | 'affichee' | 'indisponible';

export function PhotoAuthentifiee({
  nom,
  alt,
  hauteur = 208,
}: {
  /** Nom de fichier stocké dans `photo_url`. `null` : aucune photo. */
  nom: string | null;
  alt: string;
  hauteur?: number;
}): JSX.Element {
  const [url, setUrl] = useState<string | null>(null);
  const [etat, setEtat] = useState<Etat>(nom ? 'chargement' : 'indisponible');

  useEffect(() => {
    if (!nom) {
      setEtat('indisponible');
      return undefined;
    }

    let actif = true;
    let objet: string | null = null;

    void (async () => {
      try {
        const jeton = lireJetonAcces();
        const reponse = await fetch(`/api/v1/photos/${encodeURIComponent(nom)}`, {
          headers: jeton ? { authorization: `Bearer ${jeton}` } : {},
        });
        if (!reponse.ok) throw new Error('indisponible');

        objet = URL.createObjectURL(await reponse.blob());
        if (actif) {
          setUrl(objet);
          setEtat('affichee');
        }
      } catch {
        if (actif) setEtat('indisponible');
      }
    })();

    return () => {
      actif = false;
      if (objet) URL.revokeObjectURL(objet);
    };
  }, [nom]);

  const cadre: React.CSSProperties = {
    height: hauteur,
    background: 'var(--c-fond-secondaire)',
    border: '1.5px solid var(--c-bordure)',
    borderRadius: 'var(--rayon)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    overflow: 'hidden',
  };

  if (etat === 'affichee' && url) {
    return (
      <div style={cadre}>
        <img
          src={url}
          alt={alt}
          style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
        />
      </div>
    );
  }

  return (
    <div style={cadre} role="img" aria-label={alt}>
      <svg
        width="44"
        height="44"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--c-bordure-forte)"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M4 8h3l1.5-2h7L17 8h3v11H4z" />
        <circle cx="12" cy="13" r="3.4" />
      </svg>
      <span style={{ fontSize: 14, color: 'var(--c-texte-secondaire)', textAlign: 'center', padding: '0 16px' }}>
        {etat === 'chargement'
          ? 'Chargement de la photo…'
          : nom
            ? 'Photo indisponible hors ligne'
            : 'Aucune photo de référence'}
      </span>
    </div>
  );
}
