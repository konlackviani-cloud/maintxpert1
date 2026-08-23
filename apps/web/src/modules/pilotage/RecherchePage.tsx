/**
 * B3 — recherche avancée dans la base SDCR, filtres combinés.
 *
 * Comme le tableau de bord, elle travaille sur le cache : c'est de la
 * consultation. Les filtres sont intersectés par `filtrerEntrees()` du paquet
 * partagé — la même fonction qu'utilise UC4.
 */

import {
  STATUTS_SDCR,
  filtrerEntrees,
  type CriteresRecherche,
  type StatutSDCR,
} from '@maintxpert/shared';
import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';

import { Badge, Chargement, EtatVide, styleMono } from '../../composants/ui/index.js';
import { baseLocale } from '../../horsligne/db.js';
import { CadreResponsable } from './CadreResponsable.js';

const LIBELLES_STATUT: Record<StatutSDCR, string> = {
  en_attente: 'en attente',
  validee: 'validée',
  rejetee: 'rejetée',
  en_correction: 'en correction',
  archivee: 'archivée',
};

const TONS_STATUT: Record<StatutSDCR, 'neutre' | 'succes' | 'alerte' | 'danger'> = {
  en_attente: 'alerte',
  validee: 'succes',
  rejetee: 'danger',
  en_correction: 'alerte',
  archivee: 'neutre',
};

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
  fontSize: 14,
  verticalAlign: 'top',
};

const LIMITE_AFFICHEE = 100;

export function RecherchePage(): JSX.Element {
  const [texte, setTexte] = useState('');
  const [chaine, setChaine] = useState('');
  const [idEquipement, setIdEquipement] = useState('');
  const [statut, setStatut] = useState('');
  const [seulementLibres, setSeulementLibres] = useState(false);

  const donnees = useLiveQuery(async () => {
    const [entrees, equipements] = await Promise.all([
      baseLocale.entreesSdcr.toArray(),
      baseLocale.equipements.toArray(),
    ]);
    return { entrees, equipements };
  }, [], undefined);

  const chaines = useMemo(
    () => [...new Set((donnees?.equipements ?? []).map((e) => e.chaine))].sort(),
    [donnees?.equipements],
  );

  const equipementsDeLaChaine = useMemo(
    () => (donnees?.equipements ?? []).filter((e) => !chaine || e.chaine === chaine),
    [donnees?.equipements, chaine],
  );

  const resultats = useMemo(() => {
    if (!donnees) return null;

    const criteres: CriteresRecherche = {};
    if (texte.trim().length > 0) criteres.texte = texte.trim();
    if (chaine) criteres.chaine = chaine;
    if (idEquipement) criteres.id_equipement = Number.parseInt(idEquipement, 10);
    if (statut) criteres.statuts = [statut as StatutSDCR];
    if (seulementLibres) criteres.seulement_libres = true;

    return filtrerEntrees(donnees.entrees, donnees.equipements, criteres).sort(
      (a, b) => b.frequence_observee - a.frequence_observee,
    );
  }, [donnees, texte, chaine, idEquipement, statut, seulementLibres]);

  const nomParEquipement = useMemo(
    () => new Map((donnees?.equipements ?? []).map((e) => [e.id_equipement, e])),
    [donnees?.equipements],
  );

  const aucunFiltre =
    texte.trim().length === 0 && !chaine && !idEquipement && !statut && !seulementLibres;

  function reinitialiser(): void {
    setTexte('');
    setChaine('');
    setIdEquipement('');
    setStatut('');
    setSeulementLibres(false);
  }

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
        <input
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          placeholder="Chercher dans symptôme, défaut, cause, remède…"
          aria-label="Texte recherché"
          style={{ ...champ, flexGrow: 1, minWidth: 280 }}
        />
        <select
          value={chaine}
          onChange={(e) => {
            setChaine(e.target.value);
            setIdEquipement('');
          }}
          style={champ}
          aria-label="Chaîne"
        >
          <option value="">Toutes les chaînes</option>
          {chaines.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select value={idEquipement} onChange={(e) => setIdEquipement(e.target.value)} style={{ ...champ, minWidth: 200 }} aria-label="Équipement">
          <option value="">Tous les équipements</option>
          {equipementsDeLaChaine.map((e) => (
            <option key={e.id_equipement} value={e.id_equipement}>{e.nom}</option>
          ))}
        </select>
        <select value={statut} onChange={(e) => setStatut(e.target.value)} style={champ} aria-label="Statut">
          <option value="">Tous les statuts</option>
          {STATUTS_SDCR.map((s) => (
            <option key={s} value={s}>{LIBELLES_STATUT[s]}</option>
          ))}
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 14 }}>
          <input
            type="checkbox"
            checked={seulementLibres}
            onChange={(e) => setSeulementLibres(e.target.checked)}
            style={{ width: 18, height: 18 }}
          />
          Hors nomenclature
        </label>
        {!aucunFiltre && (
          <button
            type="button"
            onClick={reinitialiser}
            style={{ ...champ, fontWeight: 600, color: 'var(--c-primaire)', cursor: 'pointer' }}
          >
            Effacer
          </button>
        )}
      </div>

      <main style={{ flexGrow: 1, padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {resultats === null && <Chargement quoi="Lecture du cache local…" />}

        {resultats && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>Recherche avancée</h1>
            <Badge ton={resultats.length > 0 ? 'primaire' : 'neutre'}>
              {resultats.length} fiche{resultats.length > 1 ? 's' : ''}
            </Badge>
            {resultats.length > LIMITE_AFFICHEE && (
              <span style={{ fontSize: 13, color: 'var(--c-texte-secondaire)' }}>
                {LIMITE_AFFICHEE} premières affichées — affinez les filtres
              </span>
            )}
            <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--c-texte-secondaire)' }}>
              Depuis le cache local — fonctionne sans réseau.
            </span>
          </div>
        )}

        {resultats?.length === 0 && (
          <EtatVide
            titre="Aucune fiche ne correspond"
            explication={
              aucunFiltre
                ? 'Le cache local ne contient encore aucune fiche. La synchronisation les téléchargera à la prochaine connexion.'
                : 'Aucune fiche ne satisfait ces filtres combinés. Retirez-en un pour élargir la recherche.'
            }
          />
        )}

        {resultats && resultats.length > 0 && (
          <div style={{ border: '1.5px solid var(--c-bordure)', borderRadius: 10, background: 'var(--c-fond)', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
              <thead>
                <tr style={{ background: 'var(--c-fond-secondaire)' }}>
                  {['Équipement', 'Symptôme', 'Défaut', 'Cause', 'Fréq.', 'Statut'].map((t) => (
                    <th key={t} style={{ ...cellule, fontSize: 11, fontWeight: 700, letterSpacing: '0.9px',
                      textTransform: 'uppercase', color: 'var(--c-texte-secondaire)' }}>
                      {t}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {resultats.slice(0, LIMITE_AFFICHEE).map((fiche) => {
                  const equipement = nomParEquipement.get(fiche.id_equipement);
                  return (
                    <tr key={fiche.id_sdcr}>
                      <td style={cellule}>
                        <div style={{ fontWeight: 600 }}>{equipement?.nom ?? '—'}</div>
                        <div style={{ ...styleMono, fontSize: 12, color: 'var(--c-texte-secondaire)' }}>
                          {equipement?.chaine}
                        </div>
                      </td>
                      <td style={cellule}>{fiche.symptome}</td>
                      <td style={{ ...cellule, fontWeight: 600 }}>{fiche.defaut}</td>
                      <td style={{ ...cellule, color: 'var(--c-texte-secondaire)' }}>{fiche.cause}</td>
                      <td style={{ ...cellule, ...styleMono, fontSize: 16, fontWeight: 600 }}>
                        {fiche.frequence_observee}×
                      </td>
                      <td style={cellule}>
                        <Badge ton={TONS_STATUT[fiche.statut]}>{LIBELLES_STATUT[fiche.statut]}</Badge>
                        {!fiche.via_nomenclature && (
                          <div style={{ marginTop: 4 }}>
                            <Badge ton="alerte">libre</Badge>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </CadreResponsable>
  );
}

