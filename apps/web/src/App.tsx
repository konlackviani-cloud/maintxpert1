/** Coquille applicative : routage et session. */

import { Navigate, Route, BrowserRouter as Routeur, Routes } from 'react-router-dom';

import { AccueilProvisoire } from './app/AccueilProvisoire.js';
import { ExigeRole, RedirigeSiConnecte, accueilDuRole } from './app/gardes.js';
import { ConnexionPage } from './modules/auth/ConnexionPage.js';
import { FournisseurSession, useSession } from './modules/auth/contexte-session.js';

/** Aiguillage de la racine selon le rôle. */
function Racine(): JSX.Element {
  const { connecte, utilisateur } = useSession();
  return <Navigate to={connecte ? accueilDuRole(utilisateur?.role) : '/connexion'} replace />;
}

export function App(): JSX.Element {
  return (
    <Routeur>
      <FournisseurSession>
        <Routes>
          <Route
            path="/connexion"
            element={
              <RedirigeSiConnecte>
                <ConnexionPage />
              </RedirigeSiConnecte>
            }
          />

          <Route
            path="/diagnostic"
            element={
              <ExigeRole role="technicien">
                <AccueilProvisoire />
              </ExigeRole>
            }
          />

          <Route
            path="/pilotage"
            element={
              <ExigeRole role="responsable">
                <AccueilProvisoire />
              </ExigeRole>
            }
          />

          <Route path="/" element={<Racine />} />
          <Route path="*" element={<Racine />} />
        </Routes>
      </FournisseurSession>
    </Routeur>
  );
}
