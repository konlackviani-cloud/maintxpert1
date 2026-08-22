/**
 * B4 — analyse AMDEC : cotations gravité × fréquence × détection, suivi de l'IPR.
 *
 * Le tableau est trié par IPR décroissant : c'est l'ordre dans lequel le
 * responsable doit traiter les modes. Le seuil de criticité (12) vient de
 * `SEUIL_IPR_CRITIQUE`, jamais recopié ici.
 */

import { COTATION_AMDEC_MAX, COTATION_AMDEC_MIN, SEUIL_IPR_CRITIQUE, estIPRCritique } from '@maintxpert/shared';
import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useEffect, useState } from 'react';

import { Badge, Chargement, EtatVide, Etiquette, styleMono } from '../../composants/ui/index.js';
import { listerChaines, listerEquipements } from '../../horsligne/depots.js';
import { CadreResponsable } from './CadreResponsable.js';
import {
  chargerModesAmdec,
  creerModeAmdec,
  messageErreurPilotage,
  recoterModeAmdec,
  supprimerModeAmdec,
  type ModeAmdecDetaille,
} from './api.js';

const COTATIONS = Array.from(
  { length: COTATION_AMDEC_MAX - COTATION_AMDEC_MIN + 1 },
  (_, i) => COTATION_AMDEC_MIN + i,
);

const champ: React.CSSProperties = {
  minHeight: 40,
  padding: '0 12px',
  border: '1.5px solid var(--c-bordure)',
  borderRadius: 8,
  background: 'var(--c-fond)',
  fontSize: 15,
};

const cellule: React.CSSProperties = {
  padding: '11px 12px',
  borderBottom: '1px solid var(--c-bordure)',
  textAlign: 'left',
  verticalAlign: 'middle',
};

/** Sélecteur de cotation 1–4, réutilisé pour G, F et D. */
function Cotation({
  valeur,
  onChange,
  intitule,
}: {
  valeur: number;
  onChange: (v: number) => void;
  intitule: string;
}): JSX.Element {
  return (
    <select
      value={valeur}
      aria-label={intitule}
      onChange={(e) => onChange(Number.parseInt(e.target.value, 10))}
      style={{ ...champ, minHeight: 36, width: 60, padding: '0 6px', ...styleMono }}
    >
      {COTATIONS.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </select>
  );
}

const SAISIE_VIDE = {
  composant: '',
  mode_defaillance: '',
  cause: '',
  effet: '',
  gravite: 2,
  frequence: 2,
  detection: 2,
};

export function AmdecPage(): JSX.Element {
  const chaines = useLiveQuery(() => listerChaines(), [], []);
  const [chaine, setChaine] = useState('');
  const equipements = useLiveQuery(
    () => (chaine ? listerEquipements(chaine) : Promise.resolve([])),
    [chaine],
    [],
  );
  const [idEquipement, setIdEquipement] = useState<number | null>(null);

  const [modes, setModes] = useState<ModeAmdecDetaille[] | null>(null);
  const [nbCritiques, setNbCritiques] = useState(0);
  const [saisie, setSaisie] = useState(SAISIE_VIDE);
  const [ajoutOuvert, setAjoutOuvert] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    if (!chaine && (chaines ?? []).length > 0) setChaine(chaines![0]!.chaine);
  }, [chaines, chaine]);

  useEffect(() => {
    setIdEquipement((equipements ?? [])[0]?.id_equipement ?? null);
  }, [equipements]);

  const recharger = useCallback(async (): Promise<void> => {
    if (idEquipement === null) {
      setModes(null);
      return;
    }
    try {
      const reponse = await chargerModesAmdec(idEquipement);
      setModes(reponse.modes);
      setNbCritiques(reponse.nb_critiques);
    } catch (e) {
      setModes([]);
      setErreur(messageErreurPilotage(e));
    }
  }, [idEquipement]);

  useEffect(() => {
    void recharger();
  }, [recharger]);

  async function agir(action: () => Promise<unknown>): Promise<void> {
    setEnCours(true);
    setErreur(null);
    try {
      await action();
      await recharger();
    } catch (e) {
      setErreur(messageErreurPilotage(e));
    } finally {
      setEnCours(false);
    }
  }

  const iprSaisie = saisie.gravite * saisie.frequence * saisie.detection;
  const saisieComplete =
    saisie.composant.trim().length >= 2 &&
    saisie.mode_defaillance.trim().length >= 2 &&
    saisie.cause.trim().length >= 2 &&
    saisie.effet.trim().length >= 2;

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
        <Etiquette>Équipement analysé</Etiquette>
        <select value={chaine} onChange={(e) => setChaine(e.target.value)} style={champ} aria-label="Chaîne">
          {(chaines ?? []).map((c) => (
            <option key={c.chaine} value={c.chaine}>
              {c.chaine}
            </option>
          ))}
        </select>
        <select
          value={idEquipement ?? ''}
          onChange={(e) => setIdEquipement(Number.parseInt(e.target.value, 10))}
          style={{ ...champ, minWidth: 260 }}
          aria-label="Équipement"
        >
          {(equipements ?? []).map((e) => (
            <option key={e.id_equipement} value={e.id_equipement}>
              {e.nom}
            </option>
          ))}
        </select>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          {modes && modes.length > 0 && (
            <>
              <span style={{ fontSize: 14, color: 'var(--c-texte-secondaire)' }}>
                {modes.length} mode{modes.length > 1 ? 's' : ''}
              </span>
              {nbCritiques > 0 && (
                <Badge ton="danger">
                  {nbCritiques} critique{nbCritiques > 1 ? 's' : ''} — IPR ≥ {SEUIL_IPR_CRITIQUE}
                </Badge>
              )}
            </>
          )}
          <button
            type="button"
            onClick={() => setAjoutOuvert((o) => !o)}
            style={{
              minHeight: 40,
              padding: '0 16px',
              border: 'none',
              borderRadius: 8,
              background: 'var(--c-primaire)',
              color: '#FFFFFF',
              fontSize: 15,
              fontWeight: 600,
            }}
          >
            {ajoutOuvert ? 'Fermer' : 'Ajouter un mode'}
          </button>
        </div>
      </div>

      <main style={{ flexGrow: 1, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
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

        {ajoutOuvert && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (idEquipement === null || !saisieComplete) return;
              void agir(async () => {
                await creerModeAmdec({ ...saisie, id_equipement: idEquipement });
                setSaisie(SAISIE_VIDE);
                setAjoutOuvert(false);
              });
            }}
            style={{
              border: '1.5px solid var(--c-primaire)',
              borderRadius: 10,
              background: 'var(--c-fond)',
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <Etiquette couleur="var(--c-primaire)">Nouveau mode de défaillance</Etiquette>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
              {(
                [
                  ['composant', 'Composant', 'Capteur de niveau cuve'],
                  ['mode_defaillance', 'Mode de défaillance', 'Encrassement'],
                  ['cause', 'Cause', 'Absence de nettoyage'],
                  ['effet', 'Effet', 'Arrêt de la ligne'],
                ] as const
              ).map(([cle, intitule, exemple]) => (
                <label key={cle} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <Etiquette>{intitule}</Etiquette>
                  <input
                    value={saisie[cle]}
                    onChange={(e) => setSaisie((p) => ({ ...p, [cle]: e.target.value }))}
                    placeholder={exemple}
                    style={champ}
                  />
                </label>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
              {(
                [
                  ['gravite', 'Gravité'],
                  ['frequence', 'Fréquence'],
                  ['detection', 'Détection'],
                ] as const
              ).map(([cle, intitule]) => (
                <div key={cle} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <Etiquette>{intitule}</Etiquette>
                  <Cotation
                    valeur={saisie[cle]}
                    intitule={intitule}
                    onChange={(v) => setSaisie((p) => ({ ...p, [cle]: v }))}
                  />
                </div>
              ))}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <Etiquette>IPR</Etiquette>
                <div
                  style={{
                    ...styleMono,
                    minHeight: 36,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 19,
                    fontWeight: 600,
                    color: estIPRCritique(iprSaisie) ? 'var(--c-danger)' : 'var(--c-texte)',
                  }}
                >
                  {iprSaisie}
                  {estIPRCritique(iprSaisie) && <Badge ton="danger">critique</Badge>}
                </div>
              </div>

              <button
                type="submit"
                disabled={enCours || !saisieComplete}
                style={{
                  marginLeft: 'auto',
                  minHeight: 44,
                  padding: '0 20px',
                  border: 'none',
                  borderRadius: 8,
                  background: saisieComplete ? 'var(--c-primaire)' : 'var(--c-fond-secondaire)',
                  color: saisieComplete ? '#FFFFFF' : 'var(--c-texte-secondaire)',
                  fontSize: 15,
                  fontWeight: 600,
                }}
              >
                Enregistrer
              </button>
            </div>
          </form>
        )}

        {modes === null && <Chargement />}

        {modes?.length === 0 && (
          <EtatVide
            titre="Aucun mode analysé"
            explication="Cet équipement n’a pas encore d’analyse AMDEC. Ajoutez les modes de défaillance de ses composants pour en établir la criticité."
          />
        )}

        {modes && modes.length > 0 && (
          <div
            style={{
              border: '1.5px solid var(--c-bordure)',
              borderRadius: 10,
              background: 'var(--c-fond)',
              overflowX: 'auto',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
              <thead>
                <tr style={{ background: 'var(--c-fond-secondaire)' }}>
                  {['Composant', 'Mode de défaillance', 'Cause', 'Effet', 'G', 'F', 'D', 'IPR', ''].map(
                    (titre) => (
                      <th key={titre} style={{ ...cellule, ...styleEntete }}>
                        {titre}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {modes.map((mode) => {
                  const critique = estIPRCritique(mode.ipr);
                  return (
                    <tr key={mode.id_mode} style={{ background: critique ? 'var(--c-danger-clair)' : undefined }}>
                      <td style={{ ...cellule, fontWeight: 600 }}>{mode.composant}</td>
                      <td style={cellule}>{mode.mode_defaillance}</td>
                      <td style={{ ...cellule, color: 'var(--c-texte-secondaire)' }}>{mode.cause}</td>
                      <td style={{ ...cellule, color: 'var(--c-texte-secondaire)' }}>{mode.effet}</td>

                      {(['gravite', 'frequence', 'detection'] as const).map((cle) => (
                        <td key={cle} style={cellule}>
                          <Cotation
                            valeur={mode[cle]}
                            intitule={`${cle} de ${mode.composant}`}
                            onChange={(v) =>
                              void agir(() =>
                                recoterModeAmdec(mode.id_mode, {
                                  gravite: cle === 'gravite' ? v : mode.gravite,
                                  frequence: cle === 'frequence' ? v : mode.frequence,
                                  detection: cle === 'detection' ? v : mode.detection,
                                }),
                              )
                            }
                          />
                        </td>
                      ))}

                      <td style={cellule}>
                        <span
                          style={{
                            ...styleMono,
                            fontSize: 19,
                            fontWeight: 600,
                            color: critique ? 'var(--c-danger)' : 'var(--c-texte)',
                          }}
                        >
                          {mode.ipr}
                        </span>
                        {critique && (
                          <div style={{ marginTop: 3 }}>
                            <Badge ton="danger">critique</Badge>
                          </div>
                        )}
                      </td>

                      <td style={cellule}>
                        <button
                          type="button"
                          disabled={enCours}
                          onClick={() => {
                            if (
                              window.confirm(
                                `Retirer « ${mode.mode_defaillance} » de l’analyse ?\n\nCe mode n’entrera plus dans le classement de criticité.`,
                              )
                            ) {
                              void agir(() => supprimerModeAmdec(mode.id_mode));
                            }
                          }}
                          style={{
                            minHeight: 36,
                            padding: '0 12px',
                            border: '1.5px solid var(--c-bordure)',
                            borderRadius: 8,
                            background: 'var(--c-fond)',
                            fontSize: 14,
                            fontWeight: 600,
                            color: 'var(--c-danger)',
                          }}
                        >
                          Retirer
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {modes && modes.length > 0 && (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--c-texte-secondaire)', textWrap: 'pretty' }}>
            IPR = gravité × fréquence × détection, chaque cotation de {COTATION_AMDEC_MIN} à{' '}
            {COTATION_AMDEC_MAX}. Un mode est critique à partir de {SEUIL_IPR_CRITIQUE}. Modifier une
            cotation recalcule l’IPR et réordonne le tableau immédiatement.
          </p>
        )}
      </main>
    </CadreResponsable>
  );
}

const styleEntete: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.9px',
  textTransform: 'uppercase',
  color: 'var(--c-texte-secondaire)',
};
