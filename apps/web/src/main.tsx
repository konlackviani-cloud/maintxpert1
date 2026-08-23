import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App.js';
import { GardeFou } from './app/GardeFou.js';
import { baseLocale } from './horsligne/db.js';
import './design/jetons.css';

// Ouverture anticipée du cache : si IndexedDB est indisponible (mode privé,
// stockage saturé), on veut le savoir tout de suite, pas au premier diagnostic.
void baseLocale.open().catch((erreur: unknown) => {
  console.error('[horsligne] impossible d’ouvrir le cache local :', erreur);
});

const racine = document.getElementById('racine');
if (!racine) {
  throw new Error('Élément #racine introuvable dans index.html');
}

createRoot(racine).render(
  <StrictMode>
    <GardeFou>
      <App />
    </GardeFou>
  </StrictMode>,
);

