/** Coquille applicative : routage, session, synchronisation de fond. */

import { Navigate, Route, BrowserRouter as Routeur, Routes } from 'react-router-dom';

import { ExigeRole, RedirigeSiConnecte, accueilDuRole } from './app/gardes.js';
import { ConnexionPage } from './modules/auth/ConnexionPage.js';
import { FournisseurSession, useSession } from './modules/auth/contexte-session.js';
import { ChainePage } from './modules/diagnostic/ChainePage.js';
import { EquipementPage } from './modules/diagnostic/EquipementPage.js';
import { ResultatsPage } from './modules/diagnostic/ResultatsPage.js';
import { SymptomePage } from './modules/diagnostic/SymptomePage.js';
import { FichePage } from './modules/sdcr/FichePage.js';
import { FicheCSDPage } from './modules/csd/FicheCSDPage.js';
import { AmdecPage } from './modules/pilotage/AmdecPage.js';
import { ImportPage } from './modules/pilotage/ImportPage.js';
import { CsdPage } from './modules/pilotage/CsdPage.js';
import { FileValidationPage } from './modules/pilotage/FileValidationPage.js';
import { NomenclaturePage } from './modules/pilotage/NomenclaturePage.js';
import { MesContributionsPage } from './modules/sdcr/MesContributionsPage.js';
import { NouvelleFichePage } from './modules/sdcr/NouvelleFichePage.js';
import { Synchronisation } from './modules/sync/Synchronisation.js';

/** Aiguillage de la racine selon le rôle. */
function Racine(): JSX.Element {
  const { connecte, utilisateur } = useSession();
  return <Navigate to={connecte ? accueilDuRole(utilisateur?.role) : '/connexion'} replace />;
}

/** Route du parcours technicien (UC1). */
function Technicien({ children }: { children: JSX.Element }): JSX.Element {
  return <ExigeRole role="technicien">{children}</ExigeRole>;
}

/** Route réservée au responsable maintenance. */
function Responsable({ children }: { children: JSX.Element }): JSX.Element {
  return <ExigeRole role="responsable">{children}</ExigeRole>;
}

export function App(): JSX.Element {
  return (
    <Routeur>
      <FournisseurSession>
        <Synchronisation />

        <Routes>
          <Route
            path="/connexion"
            element={
              <RedirigeSiConnecte>
                <ConnexionPage />
              </RedirigeSiConnecte>
            }
          />

          {/* UC1 — diagnostiquer une défaillance via la base SDCR */}
          <Route path="/diagnostic" element={<Technicien><ChainePage /></Technicien>} />
          <Route path="/diagnostic/:chaine" element={<Technicien><EquipementPage /></Technicien>} />
          <Route
            path="/diagnostic/:chaine/:idEquipement"
            element={<Technicien><SymptomePage /></Technicien>}
          />
          <Route
            path="/diagnostic/:chaine/:idEquipement/resultats/:symptome"
            element={<Technicien><ResultatsPage /></Technicien>}
          />
          <Route
            path="/diagnostic/:chaine/:idEquipement/nouvelle-fiche"
            element={<Technicien><NouvelleFichePage /></Technicien>}
          />
          <Route
            path="/diagnostic/:chaine/:idEquipement/csd"
            element={<Technicien><FicheCSDPage /></Technicien>}
          />
          <Route path="/diagnostic/fiche/:idSdcr" element={<Technicien><FichePage /></Technicien>} />
          <Route path="/mes-contributions" element={<Technicien><MesContributionsPage /></Technicien>} />

          {/* Responsable — UC2 et gestion de la nomenclature */}
          <Route
            path="/pilotage/validation"
            element={<Responsable><FileValidationPage /></Responsable>}
          />
          <Route
            path="/pilotage/nomenclature"
            element={<Responsable><NomenclaturePage /></Responsable>}
          />
          {/* Le tableau de bord (B5) arrive en phase 7 ; d'ici là, la file fait l'accueil. */}
          <Route path="/pilotage/csd" element={<Responsable><CsdPage /></Responsable>} />
          <Route path="/pilotage/amdec" element={<Responsable><AmdecPage /></Responsable>} />
          <Route path="/pilotage/import" element={<Responsable><ImportPage /></Responsable>} />
          <Route path="/pilotage" element={<Navigate to="/pilotage/validation" replace />} />

          <Route path="/" element={<Racine />} />
          <Route path="*" element={<Racine />} />
        </Routes>
      </FournisseurSession>
    </Routeur>
  );
}


