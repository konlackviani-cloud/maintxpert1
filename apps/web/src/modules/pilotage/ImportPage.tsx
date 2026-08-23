/**
 * B7 — import manuel initial des données DimoMaint (CSV).
 *
 * Trois temps délibérés : choisir le fichier, VÉRIFIER le rattachement des
 * colonnes sur un aperçu réel, puis seulement importer. Le fichier est analysé
 * dans le navigateur : rien n'atteint la base avant que le responsable n'ait vu
 * ce qui sera créé.
 *
 * Le format réel de l'export n'a pas été fourni (point ouvert O7) : séparateur
 * et colonnes sont détectés, jamais présumés.
 */

import {
  analyserCsv,
  extraireEquipements,
  proposerRattachement,
  type AnalyseCsv,
  type ChampEquipement,
} from '@maintxpert/shared';
import { useMemo, useRef, useState } from 'react';

import {
  Badge,
  EtatVide,
  Etiquette,
  IconeValider,
  styleEtiquette,
  styleMono,
} from '../../composants/ui/index.js';
import { CadreResponsable } from './CadreResponsable.js';
import { importerEquipements, messageErreurPilotage } from './api.js';

const CHAMPS: { cle: ChampEquipement; intitule: string; requis: boolean }[] = [
  { cle: 'nom', intitule: 'Nom de l’équipement', requis: true },
  { cle: 'chaine', intitule: 'Chaîne', requis: true },
  { cle: 'famille', intitule: 'Famille', requis: false },
];

const champ: React.CSSProperties = {
  minHeight: 40,
  padding: '0 12px',
  border: '1.5px solid var(--c-bordure)',
  borderRadius: 8,
  background: 'var(--c-fond)',
  fontSize: 15,
};

const cellule: React.CSSProperties = {
  padding: '9px 12px',
  borderBottom: '1px solid var(--c-bordure)',
  textAlign: 'left',
  fontSize: 14,
};

export function ImportPage(): JSX.Element {
  const entree = useRef<HTMLInputElement>(null);
  const [nomFichier, setNomFichier] = useState<string | null>(null);
  const [analyse, setAnalyse] = useState<AnalyseCsv | null>(null);
  const [rattachement, setRattachement] = useState<Record<ChampEquipement, number | null>>({
    nom: null,
    famille: null,
    chaine: null,
  });
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [bilan, setBilan] = useState<{ crees: number; existants: number; total: number } | null>(null);

  const extraction = useMemo(
    () => (analyse ? extraireEquipements(analyse, rattachement) : null),
    [analyse, rattachement],
  );

  async function choisirFichier(fichier: File | undefined): Promise<void> {
    if (!fichier) return;
    setErreur(null);
    setBilan(null);

    try {
      const contenu = await fichier.text();
      const resultat = analyserCsv(contenu);

      if (resultat.colonnes.length === 0) {
        setErreur('Ce fichier ne contient aucune colonne exploitable.');
        return;
      }

      setNomFichier(fichier.name);
      setAnalyse(resultat);
      setRattachement(proposerRattachement(resultat.colonnes));
    } catch {
      setErreur('Fichier illisible. Vérifiez qu’il s’agit bien d’un export CSV.');
    }
  }

  async function importer(): Promise<void> {
    if (!extraction || extraction.equipements.length === 0) return;
    setEnCours(true);
    setErreur(null);

    try {
      setBilan(await importerEquipements(extraction.equipements));
    } catch (e) {
      setErreur(messageErreurPilotage(e));
    } finally {
      setEnCours(false);
    }
  }

  const pretAImporter = (extraction?.equipements.length ?? 0) > 0;

  return (
    <CadreResponsable>
      <main style={{ flexGrow: 1, padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div>
          <h1 style={{ fontSize: 19, fontWeight: 700, margin: 0 }}>Import DimoMaint</h1>
          <p style={{ margin: '3px 0 0', fontSize: 14, color: 'var(--c-texte-secondaire)', textWrap: 'pretty' }}>
            Reprise initiale du parc d’équipements depuis un export CSV. Le fichier est analysé sur ce
            poste : rien n’est écrit avant que vous ayez validé l’aperçu.
          </p>
        </div>

        <input
          ref={entree}
          type="file"
          accept=".csv,text/csv,text/plain"
          onChange={(e) => void choisirFichier(e.target.files?.[0])}
          style={{ display: 'none' }}
          aria-hidden="true"
          tabIndex={-1}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => entree.current?.click()}
            style={{
              minHeight: 44,
              padding: '0 20px',
              border: '1.5px solid var(--c-primaire)',
              borderRadius: 8,
              background: 'var(--c-fond)',
              fontSize: 15,
              fontWeight: 600,
              color: 'var(--c-primaire)',
            }}
          >
            {nomFichier ? 'Choisir un autre fichier' : 'Choisir un fichier CSV'}
          </button>

          {nomFichier && (
            <span style={{ ...styleMono, fontSize: 14, color: 'var(--c-texte-secondaire)' }}>
              {nomFichier}
            </span>
          )}
          {analyse && (
            <>
              <Badge ton="neutre">
                séparateur «&nbsp;{analyse.separateur === '\t' ? 'tabulation' : analyse.separateur}&nbsp;»
              </Badge>
              <Badge ton="neutre">{analyse.lignes.length} lignes</Badge>
              {analyse.lignes_ignorees > 0 && (
                <Badge ton="alerte">{analyse.lignes_ignorees} ligne(s) mal formée(s) ignorée(s)</Badge>
              )}
            </>
          )}
        </div>

        {erreur && (
          <div
            role="alert"
            style={{
              border: '1.5px solid var(--c-danger)',
              background: 'var(--c-danger-clair)',
              color: 'var(--c-danger)',
              borderRadius: 10,
              padding: '12px 16px',
            }}
          >
            {erreur}
          </div>
        )}

        {bilan && (
          <div
            role="status"
            style={{
              border: '1.5px solid var(--c-succes)',
              background: 'var(--c-succes-clair)',
              color: 'var(--c-succes)',
              borderRadius: 10,
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <IconeValider taille={22} />
            <strong>
              {bilan.crees} équipement{bilan.crees > 1 ? 's' : ''} créé{bilan.crees > 1 ? 's' : ''}
            </strong>
            {bilan.existants > 0 && (
              <span>
                · {bilan.existants} déjà présent{bilan.existants > 1 ? 's' : ''}, laissé
                {bilan.existants > 1 ? 's' : ''} intact{bilan.existants > 1 ? 's' : ''}
              </span>
            )}
          </div>
        )}

        {analyse === null && (
          <EtatVide
            titre="Aucun fichier chargé"
            explication="Exportez la liste des équipements depuis DimoMaint au format CSV, puis chargez-la ici. Les colonnes seront rattachées automatiquement, à vous de vérifier."
          />
        )}

        {analyse && (
          <>
            <section
              style={{
                border: '1.5px solid var(--c-bordure)',
                borderRadius: 10,
                background: 'var(--c-fond)',
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              <Etiquette couleur="var(--c-primaire)">Rattachement des colonnes</Etiquette>
              <p style={{ margin: 0, fontSize: 14, color: 'var(--c-texte-secondaire)', textWrap: 'pretty' }}>
                Proposé d’après les intitulés du fichier. Vérifiez-le sur l’aperçu ci-dessous : un
                rattachement erroné créerait des centaines d’équipements faux.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
                {CHAMPS.map(({ cle, intitule, requis }) => (
                  <label key={cle} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Etiquette>{intitule}</Etiquette>
                      {requis && <Badge ton={rattachement[cle] === null ? 'danger' : 'succes'}>requis</Badge>}
                    </span>
                    <select
                      value={rattachement[cle] ?? ''}
                      onChange={(e) =>
                        setRattachement((p) => ({
                          ...p,
                          [cle]: e.target.value === '' ? null : Number.parseInt(e.target.value, 10),
                        }))
                      }
                      style={champ}
                      aria-label={`Colonne pour ${intitule}`}
                    >
                      <option value="">— non rattachée —</option>
                      {analyse.colonnes.map((colonne, index) => (
                        <option key={`${colonne}-${index}`} value={index}>
                          {colonne || `(colonne ${index + 1})`}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </section>

            {extraction && (
              <section
                style={{
                  border: '1.5px solid var(--c-bordure)',
                  borderRadius: 10,
                  background: 'var(--c-fond)',
                  overflow: 'hidden',
                }}
              >
                <header
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    flexWrap: 'wrap',
                    padding: '12px 16px',
                    borderBottom: '1.5px solid var(--c-bordure)',
                    background: 'var(--c-fond-secondaire)',
                  }}
                >
                  <Etiquette>Aperçu — 10 premières lignes</Etiquette>
                  <Badge ton={pretAImporter ? 'succes' : 'danger'}>
                    {extraction.equipements.length} équipement(s) à créer
                  </Badge>
                  {extraction.rejets.length > 0 && (
                    <Badge ton="alerte">{extraction.rejets.length} ligne(s) rejetée(s)</Badge>
                  )}
                </header>

                {extraction.equipements.length > 0 && (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: 'var(--c-fond-secondaire)' }}>
                          {['Chaîne', 'Nom', 'Famille'].map((t) => (
                            <th key={t} style={{ ...cellule, ...styleEntete }}>
                              {t}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {extraction.equipements.slice(0, 10).map((e, i) => (
                          <tr key={`${e.chaine}-${e.nom}-${i}`}>
                            <td style={{ ...cellule, ...styleMono, fontWeight: 600 }}>{e.chaine}</td>
                            <td style={{ ...cellule, fontWeight: 600 }}>{e.nom}</td>
                            <td style={{ ...cellule, color: 'var(--c-texte-secondaire)' }}>{e.famille}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {extraction.rejets.length > 0 && (
                  <div style={{ padding: '12px 16px', borderTop: '1px solid var(--c-bordure)' }}>
                    <Etiquette couleur="var(--c-alerte)">Lignes rejetées</Etiquette>
                    <ul style={{ margin: '8px 0 0', paddingLeft: 20, fontSize: 14, color: 'var(--c-alerte)' }}>
                      {extraction.rejets.slice(0, 8).map((r) => (
                        <li key={`${r.ligne}-${r.motif}`}>
                          {r.ligne > 0 ? `Ligne ${r.ligne} : ` : ''}
                          {r.motif}
                        </li>
                      ))}
                      {extraction.rejets.length > 8 && (
                        <li>… et {extraction.rejets.length - 8} autre(s).</li>
                      )}
                    </ul>
                  </div>
                )}
              </section>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <button
                type="button"
                disabled={!pretAImporter || enCours}
                onClick={() => void importer()}
                style={{
                  minHeight: 48,
                  padding: '0 22px',
                  border: 'none',
                  borderRadius: 8,
                  background: pretAImporter && !enCours ? 'var(--c-primaire)' : 'var(--c-fond-secondaire)',
                  color: pretAImporter && !enCours ? '#FFFFFF' : 'var(--c-texte-secondaire)',
                  fontSize: 16,
                  fontWeight: 600,
                }}
              >
                {enCours
                  ? 'Import en cours…'
                  : `Importer ${extraction?.equipements.length ?? 0} équipement(s)`}
              </button>
              <span style={{ fontSize: 13, color: 'var(--c-texte-secondaire)', textWrap: 'pretty' }}>
                Les équipements déjà présents ne sont pas dupliqués : rejouer le même fichier est sans
                effet.
              </span>
            </div>
          </>
        )}
      </main>
    </CadreResponsable>
  );
}

/** En-tête de colonne : même style que les étiquettes de section. */
const styleEntete: React.CSSProperties = styleEtiquette;
