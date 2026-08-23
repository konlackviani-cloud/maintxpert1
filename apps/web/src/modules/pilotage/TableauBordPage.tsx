/**
 * B5 / UC4 — tableau de bord du responsable.
 *
 * Lu depuis le cache IndexedDB, jamais du réseau : c'est de la CONSULTATION, et
 * la règle « hors ligne d'abord » s'y applique pleinement — contrairement aux
 * écrans de validation et de nomenclature, qui sont des écritures (D17).
 *
 * Ordre imposé par UC4 : filtres combinés → Pareto + IPR → indicateurs de suivi
 * → suggestions de défaillogramme. Tout cas vide affiche un état vide, jamais
 * une erreur.
 */

import {
  SEUIL_IPR_CRITIQUE,
  SEUIL_PARETO,
  calculerIndicateurs,
  collecterSuggestions,
  construirePareto,
  estIPRCritique,
  filtrerEntrees,
  lireSeuilRecurrence,
  type CriteresRecherche,
  type Pareto,
} from '@maintxpert/shared';
import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Badge, Chargement, EtatVide, Etiquette, styleMono } from '../../composants/ui/index.js';
import { formaterDuree } from '../../horsligne/actions.js';
import { baseLocale } from '../../horsligne/db.js';
import { CadreResponsable } from './CadreResponsable.js';

/* -------------------------------------------------------------------------- */
/* Diagramme de Pareto — SVG, sans librairie de graphiques                     */
/* -------------------------------------------------------------------------- */

function DiagrammePareto({ pareto }: { pareto: Pareto }): JSX.Element {
  const L = 840;
  const H = 300;
  const [gauche, droite, haut, bas] = [55, 800, 20, 220];
  const largeurUtile = droite - gauche;
  const hauteurUtile = bas - haut;

  const nb = pareto.lignes.length;
  const pasX = largeurUtile / nb;
  const largeurBarre = Math.min(60, pasX * 0.6);
  const maxOccurrences = Math.max(...pareto.lignes.map((l) => l.occurrences));
  // Échelle arrondie au multiple de 5 supérieur : un axe qui s'arrête sur une
  // valeur ronde se lit sans effort.
  const plafond = Math.max(5, Math.ceil(maxOccurrences / 5) * 5);

  const centre = (i: number): number => gauche + pasX * i + pasX / 2;
  const yOccurrences = (v: number): number => bas - (v / plafond) * hauteurUtile;
  const yPourcent = (p: number): number => bas - (p / 100) * hauteurUtile;

  const graduations = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(plafond * f));

  return (
    <svg viewBox={`0 0 ${L} ${H}`} style={{ width: '100%', height: 'auto' }} role="img"
      aria-label={`Diagramme de Pareto : ${pareto.nb_causes_seuil} causes sur ${nb} expliquent ${SEUIL_PARETO} % des arrêts`}>
      {graduations.map((v) => (
        <line key={v} x1={gauche} y1={yOccurrences(v)} x2={droite} y2={yOccurrences(v)}
          stroke="var(--c-bordure)" strokeWidth={v === 0 ? 1.5 : 1} opacity={v === 0 ? 1 : 0.5} />
      ))}
      <line x1={gauche} y1={haut} x2={gauche} y2={bas} stroke="var(--c-bordure-forte)" strokeWidth={1.5} />

      {graduations.map((v) => (
        <text key={v} x={gauche - 8} y={yOccurrences(v) + 4} textAnchor="end"
          fontFamily="var(--police-mono)" fontSize={12} fill="var(--c-texte-secondaire)">
          {v}
        </text>
      ))}
      {[0, 50, 100].map((p) => (
        <text key={p} x={droite + 10} y={yPourcent(p) + 4}
          fontFamily="var(--police-mono)" fontSize={12} fill="var(--c-alerte)">
          {p} %
        </text>
      ))}

      {/* Seuil de Pareto */}
      <line x1={gauche} y1={yPourcent(SEUIL_PARETO)} x2={droite} y2={yPourcent(SEUIL_PARETO)}
        stroke="var(--c-alerte)" strokeWidth={1.5} strokeDasharray="7 5" opacity={0.65} />
      <text x={gauche + 7} y={yPourcent(SEUIL_PARETO) - 6} fontSize={12} fontWeight={600} fill="var(--c-alerte)">
        seuil {SEUIL_PARETO} %
      </text>

      {pareto.lignes.map((ligne, i) => (
        <g key={ligne.cause}>
          <rect
            x={centre(i) - largeurBarre / 2}
            y={yOccurrences(ligne.occurrences)}
            width={largeurBarre}
            height={bas - yOccurrences(ligne.occurrences)}
            rx={2}
            fill={ligne.dans_le_seuil ? 'var(--c-primaire)' : 'var(--c-marque-bleu)'}
            opacity={ligne.dans_le_seuil ? 1 : 0.55}
          />
          <text x={centre(i)} y={yOccurrences(ligne.occurrences) - 7} textAnchor="middle"
            fontFamily="var(--police-mono)" fontSize={13} fontWeight={600} fill="var(--c-texte)">
            {ligne.occurrences}
          </text>
          <text x={centre(i)} y={bas + 20} textAnchor="middle" fontSize={12} fill="var(--c-texte)">
            {ligne.cause.length > 16 ? `${ligne.cause.slice(0, 15)}…` : ligne.cause}
          </text>
        </g>
      ))}

      <polyline
        points={pareto.lignes.map((l, i) => `${centre(i)},${yPourcent(l.cumul)}`).join(' ')}
        fill="none" stroke="var(--c-alerte)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
      />
      {pareto.lignes.map((ligne, i) => (
        <circle key={ligne.cause} cx={centre(i)} cy={yPourcent(ligne.cumul)} r={4.5}
          fill="var(--c-fond)" stroke="var(--c-alerte)" strokeWidth={2.5} />
      ))}

      <rect x={gauche + 10} y={bas + 42} width={430} height={26} rx={4} fill="var(--c-primaire-clair)" />
      <text x={gauche + 22} y={bas + 59} fontSize={13} fontWeight={600} fill="var(--c-primaire)">
        {pareto.nb_causes_seuil} cause{pareto.nb_causes_seuil > 1 ? 's' : ''} sur {nb} expliquent{' '}
        {Math.round(pareto.lignes[pareto.nb_causes_seuil - 1]?.cumul ?? 0)} % des arrêts
      </text>
    </svg>
  );
}

/* -------------------------------------------------------------------------- */

function Tuile({
  intitule,
  valeur,
  detail,
  ton = 'neutre',
}: {
  intitule: string;
  valeur: string;
  detail?: string;
  ton?: 'neutre' | 'succes' | 'alerte';
}): JSX.Element {
  const fonds = {
    neutre: ['var(--c-fond)', 'var(--c-bordure)', 'var(--c-texte)'],
    succes: ['var(--c-succes-clair)', 'var(--c-succes)', 'var(--c-succes)'],
    alerte: ['var(--c-alerte-clair)', 'var(--c-alerte)', 'var(--c-alerte)'],
  } as const;
  const [fond, bordure, couleur] = fonds[ton];

  return (
    <div style={{ border: `1.5px solid ${bordure}`, borderRadius: 10, background: fond, padding: '15px 17px' }}>
      <Etiquette couleur={ton === 'neutre' ? undefined : couleur}>{intitule}</Etiquette>
      <div style={{ ...styleMono, fontSize: 32, fontWeight: 600, lineHeight: 1.2, marginTop: 4, color: couleur }}>
        {valeur}
      </div>
      {detail && <div style={{ fontSize: 13, color: ton === 'neutre' ? 'var(--c-texte-secondaire)' : couleur }}>{detail}</div>}
    </div>
  );
}

/** Période glissante, exprimée en jours. */
const PERIODES = [
  { jours: 30, libelle: '30 derniers jours' },
  { jours: 90, libelle: '3 derniers mois' },
  { jours: 365, libelle: '12 derniers mois' },
  { jours: 0, libelle: 'Depuis le début' },
] as const;

const champ: React.CSSProperties = {
  minHeight: 40,
  padding: '0 12px',
  border: '1.5px solid var(--c-bordure)',
  borderRadius: 8,
  background: 'var(--c-fond)',
  fontSize: 15,
};

export function TableauBordPage(): JSX.Element {
  const naviguer = useNavigate();

  const [jours, setJours] = useState<number>(90);
  const [chaine, setChaine] = useState<string>('');

  const donnees = useLiveQuery(async () => {
    const [entrees, equipements, interventions, modes, configuration] = await Promise.all([
      baseLocale.entreesSdcr.toArray(),
      baseLocale.equipements.toArray(),
      baseLocale.interventions.toArray(),
      baseLocale.modesAmdec.toArray(),
      baseLocale.configuration.get('seuil_recurrence'),
    ]);
    return { entrees, equipements, interventions, modes, seuil: lireSeuilRecurrence(configuration?.valeur) };
  }, [], undefined);

  const chaines = useMemo(
    () => [...new Set((donnees?.equipements ?? []).map((e) => e.chaine))].sort(),
    [donnees?.equipements],
  );

  const analyse = useMemo(() => {
    if (!donnees) return null;

    const criteres: CriteresRecherche = {};
    if (chaine) criteres.chaine = chaine;
    if (jours > 0) {
      criteres.depuis = new Date(Date.now() - jours * 86_400_000).toISOString();
    }

    const filtrees = filtrerEntrees(donnees.entrees, donnees.equipements, criteres);
    const validees = filtrees.filter((e) => e.statut === 'validee');

    // Les interventions suivent le même filtre de chaîne, via leur équipement.
    const equipementsRetenus = new Set(
      donnees.equipements.filter((e) => !chaine || e.chaine === chaine).map((e) => e.id_equipement),
    );
    const interventions = donnees.interventions.filter(
      (i) =>
        equipementsRetenus.has(i.id_equipement) &&
        (jours === 0 || i.datetime_ouverture >= new Date(Date.now() - jours * 86_400_000).toISOString()),
    );

    const modes = donnees.modes.filter((m) => equipementsRetenus.has(m.id_equipement));

    return {
      pareto: construirePareto(validees),
      indicateurs: calculerIndicateurs(filtrees, interventions),
      suggestions: collecterSuggestions(validees, donnees.seuil),
      modesCritiques: modes.filter((m) => estIPRCritique(m.ipr)).slice(0, 6),
      seuil: donnees.seuil,
      nomParEquipement: new Map(donnees.equipements.map((e) => [e.id_equipement, e])),
    };
  }, [donnees, chaine, jours]);

  /**
   * Pourcentage à la française : virgule décimale, espace insécable avant le
   * signe. Une décimale sous 10 % — un taux de 8,5 % ne doit pas s'afficher
   * « 8 % » — mais jamais « 0,0 % », qui donne à croire à un arrondi.
   */
  const pourcent = (v: number): string => {
    const decimales = v > 0 && v < 10 ? 1 : 0;
    return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: decimales }).format(v)} %`;
  };

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
        <Etiquette>Filtres</Etiquette>
        <select value={jours} onChange={(e) => setJours(Number.parseInt(e.target.value, 10))} style={champ} aria-label="Période">
          {PERIODES.map((p) => (
            <option key={p.jours} value={p.jours}>{p.libelle}</option>
          ))}
        </select>
        <select value={chaine} onChange={(e) => setChaine(e.target.value)} style={champ} aria-label="Chaîne">
          <option value="">Toutes les chaînes</option>
          {chaines.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--c-texte-secondaire)' }}>
          Calculé depuis le cache local — fonctionne sans réseau.
        </span>
      </div>

      <main style={{ flexGrow: 1, padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
        {analyse === null && <Chargement quoi="Lecture du cache local…" />}

        {analyse && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 16 }}>
              <Tuile
                intitule="Interventions"
                valeur={String(analyse.indicateurs.nb_interventions)}
                detail={
                  analyse.indicateurs.nb_interventions_ouvertes > 0
                    ? `${analyse.indicateurs.nb_interventions_ouvertes} encore ouverte(s)`
                    : 'toutes clôturées'
                }
              />
              <Tuile
                intitule="TTDi médian"
                valeur={formaterDuree(analyse.indicateurs.ttdi_median_secondes)}
                detail="T1 → T1.5, temps de diagnostic"
                ton={analyse.indicateurs.ttdi_median_secondes === null ? 'neutre' : 'succes'}
              />
              <Tuile
                intitule="Nomenclature libre"
                valeur={pourcent(analyse.indicateurs.taux_nomenclature_libre)}
                detail="des fiches validées, hors nomenclature"
                ton={analyse.indicateurs.taux_nomenclature_libre > 15 ? 'alerte' : 'succes'}
              />
              <Tuile
                intitule="Fiches à valider"
                valeur={String(analyse.indicateurs.nb_en_attente)}
                ton={analyse.indicateurs.nb_en_attente > 0 ? 'alerte' : 'neutre'}
                detail={analyse.indicateurs.nb_en_attente > 0 ? 'en attente de relecture' : 'file vide'}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.85fr) minmax(0, 1fr)', gap: 16, alignItems: 'start' }}>
              {/* Pareto des causes */}
              <section style={{ border: '1.5px solid var(--c-bordure)', borderRadius: 10, background: 'var(--c-fond)', padding: '16px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                  <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>Pareto des causes d’arrêt</h2>
                  <span style={{ fontSize: 13, color: 'var(--c-texte-secondaire)' }}>
                    {analyse.pareto.total} arrêt{analyse.pareto.total > 1 ? 's' : ''}
                    {chaine ? ` · ${chaine}` : ''}
                  </span>
                  <span style={{ marginLeft: 'auto', display: 'flex', gap: 14, fontSize: 12, color: 'var(--c-texte-secondaire)' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 11, height: 11, background: 'var(--c-primaire)', borderRadius: 2 }} />arrêts
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 14, height: 3, background: 'var(--c-alerte)' }} />cumul
                    </span>
                  </span>
                </div>

                {analyse.pareto.lignes.length === 0 ? (
                  <EtatVide
                    titre="Aucun arrêt sur la période"
                    explication="Aucune fiche validée ne correspond aux filtres. Élargissez la période, ou attendez que des contributions soient validées."
                  />
                ) : (
                  <div style={{ paddingTop: 8 }}>
                    <DiagrammePareto pareto={analyse.pareto} />
                  </div>
                )}
              </section>

              {/* Récurrences — FP5 */}
              <section style={{ border: '1.5px solid var(--c-bordure)', borderRadius: 10, background: 'var(--c-fond)', overflow: 'hidden' }}>
                <div style={{ padding: '15px 17px 12px', borderBottom: '1.5px solid var(--c-bordure)' }}>
                  <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>Récurrences signalées</h2>
                  <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--c-texte-secondaire)', textWrap: 'pretty' }}>
                    Seuil : {analyse.seuil} occurrences. L’ouverture d’un défaillogramme reste votre décision.
                  </p>
                </div>

                {analyse.suggestions.length === 0 ? (
                  <p style={{ padding: '20px 17px', margin: 0, fontSize: 14, color: 'var(--c-texte-secondaire)', textWrap: 'pretty' }}>
                    Aucune fiche n’atteint le seuil de récurrence sur ce périmètre.
                  </p>
                ) : (
                  analyse.suggestions.slice(0, 5).map((s) => {
                    const equipement = analyse.nomParEquipement.get(s.id_equipement);
                    return (
                      <div key={s.id_sdcr} style={{ padding: '13px 17px', borderBottom: '1px solid var(--c-bordure)' }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 9 }}>
                          <span style={{ ...styleMono, fontSize: 19, fontWeight: 600, color: 'var(--c-alerte)' }}>
                            {s.frequence_observee}×
                          </span>
                          <span style={{ flexGrow: 1, fontSize: 14, fontWeight: 600, textWrap: 'pretty' }}>{s.cause}</span>
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--c-texte-secondaire)', marginTop: 3 }}>
                          {equipement?.nom} · {equipement?.chaine}
                        </div>
                        <button
                          type="button"
                          onClick={() => naviguer(`/pilotage/defaillogramme?sdcr=${s.id_sdcr}`)}
                          style={{
                            width: '100%', minHeight: 40, marginTop: 10,
                            border: '1.5px solid var(--c-primaire)', borderRadius: 8,
                            background: 'var(--c-fond)', fontSize: 14, fontWeight: 600, color: 'var(--c-primaire)',
                          }}
                        >
                          Ouvrir un défaillogramme
                        </button>
                      </div>
                    );
                  })
                )}
              </section>
            </div>

            {/* Modes AMDEC critiques */}
            <section style={{ border: '1.5px solid var(--c-bordure)', borderRadius: 10, background: 'var(--c-fond)', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 17px', borderBottom: '1.5px solid var(--c-bordure)' }}>
                <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>Modes AMDEC critiques</h2>
                <Badge ton="danger">IPR ≥ {SEUIL_IPR_CRITIQUE}</Badge>
                <button
                  type="button"
                  onClick={() => naviguer('/pilotage/amdec')}
                  style={{ marginLeft: 'auto', minHeight: 36, padding: '0 14px', border: '1.5px solid var(--c-bordure)',
                    borderRadius: 8, background: 'var(--c-fond)', fontSize: 14, fontWeight: 600, color: 'var(--c-primaire)' }}
                >
                  Voir l’analyse
                </button>
              </div>

              {analyse.modesCritiques.length === 0 ? (
                <p style={{ padding: '20px 17px', margin: 0, fontSize: 14, color: 'var(--c-texte-secondaire)', textWrap: 'pretty' }}>
                  Aucun mode critique sur ce périmètre — soit l’analyse AMDEC n’a pas encore été menée, soit aucun IPR n’atteint {SEUIL_IPR_CRITIQUE}.
                </p>
              ) : (
                analyse.modesCritiques.map((mode) => (
                  <div key={mode.id_mode} style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
                    padding: '12px 17px', borderBottom: '1px solid var(--c-bordure)' }}>
                    <span style={{ ...styleMono, fontSize: 21, fontWeight: 600, color: 'var(--c-danger)', width: 48 }}>
                      {mode.ipr}
                    </span>
                    <span style={{ minWidth: 200, fontSize: 15, fontWeight: 600 }}>{mode.composant}</span>
                    <span style={{ flexGrow: 1, minWidth: 180, fontSize: 15 }}>{mode.mode_defaillance}</span>
                    <span style={{ ...styleMono, fontSize: 13, color: 'var(--c-texte-secondaire)' }}>
                      G{mode.gravite} · F{mode.frequence} · D{mode.detection}
                    </span>
                  </div>
                ))
              )}
            </section>
          </>
        )}
      </main>
    </CadreResponsable>
  );
}
