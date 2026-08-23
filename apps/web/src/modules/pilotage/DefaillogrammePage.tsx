/**
 * B8 / UC3 — construction et consultation du défaillogramme.
 *
 * Topologie FIXE : deux branches contributives, une convergence, une cause
 * intermédiaire, une cause première. Aucun bouton n'ajoute de branche —
 * l'éditeur graphique à topologie libre est hors périmètre v1.0.
 *
 * On arrive ici depuis la suggestion du tableau de bord, par un clic : la
 * décision d'ouvrir reste celle du responsable (initiative a posteriori).
 */

import type { Defaillogramme, SaisieDefaillogramme } from '@maintxpert/shared';
import { branchesDistinctes } from '@maintxpert/shared';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { Badge, Chargement, EtatVide, Etiquette, IconeValider, styleMono } from '../../composants/ui/index.js';
import { baseLocale } from '../../horsligne/db.js';
import { CadreResponsable } from './CadreResponsable.js';
import { creerDefaillogramme, messageErreurPilotage, modifierDefaillogramme } from './api.js';

/* -------------------------------------------------------------------------- */
/* Diagramme — SVG, quatre étages fixes                                        */
/* -------------------------------------------------------------------------- */

function Diagramme({ valeurs, symptome }: { valeurs: SaisieDefaillogramme; symptome: string }) {
  /** Découpe un texte en lignes courtes : SVG n'a pas de retour à la ligne automatique. */
  const lignes = (texte: string, largeurMax = 24, maxLignes = 3): string[] => {
    const mots = (texte || '—').split(/\s+/);
    const sortie: string[] = [];
    let courante = '';

    for (const mot of mots) {
      if ((courante + ' ' + mot).trim().length <= largeurMax) {
        courante = (courante + ' ' + mot).trim();
      } else {
        if (courante) sortie.push(courante);
        courante = mot;
      }
      if (sortie.length === maxLignes) break;
    }
    if (courante && sortie.length < maxLignes) sortie.push(courante);
    if (sortie.length === maxLignes && mots.join(' ').length > sortie.join(' ').length) {
      sortie[maxLignes - 1] = `${sortie[maxLignes - 1]!.slice(0, largeurMax - 1)}…`;
    }
    return sortie;
  };

  const Bloc = ({
    x, y, l, h, fond, bordure, titre, corps, epaisseur = 1.5,
  }: {
    x: number; y: number; l: number; h: number;
    fond: string; bordure: string; titre?: string; corps: string[]; epaisseur?: number;
  }) => (
    <g>
      <rect x={x} y={y} width={l} height={h} rx={9} fill={fond} stroke={bordure} strokeWidth={epaisseur} />
      {titre && (
        <text x={x + 18} y={y + 24} fontSize={10} fontWeight={700} letterSpacing="0.8" fill="var(--c-texte-secondaire)">
          {titre}
        </text>
      )}
      {corps.map((ligne, i) => (
        <text key={`${ligne}-${i}`} x={x + 18} y={y + (titre ? 46 : 32) + i * 20} fontSize={14.5} fontWeight={600} fill="var(--c-texte)">
          {ligne}
        </text>
      ))}
    </g>
  );

  return (
    <svg viewBox="0 0 1020 420" style={{ width: '100%', height: 'auto' }} role="img"
      aria-label="Défaillogramme : deux branches contributives convergeant vers le symptôme, puis cause intermédiaire et cause première">
      <defs>
        <marker id="fl" markerWidth="9" markerHeight="9" refX="7.5" refY="4.5" orient="auto">
          <path d="M0,1 L8,4.5 L0,8 z" fill="var(--c-texte-secondaire)" />
        </marker>
        <marker id="flb" markerWidth="9" markerHeight="9" refX="7.5" refY="4.5" orient="auto">
          <path d="M0,1 L8,4.5 L0,8 z" fill="var(--c-primaire)" />
        </marker>
      </defs>

      {[
        [115, 'BRANCHES CONTRIBUTIVES', 'var(--c-texte-secondaire)'],
        [390, 'CONVERGENCE', 'var(--c-primaire)'],
        [650, 'CAUSE INTERMÉDIAIRE', 'var(--c-texte-secondaire)'],
        [910, 'CAUSE PREMIÈRE', 'var(--c-alerte)'],
      ].map(([x, texte, couleur]) => (
        <text key={texte as string} x={x as number} y={20} textAnchor="middle" fontSize={11.5}
          fontWeight={700} letterSpacing="0.9" fill={couleur as string}>
          {texte as string}
        </text>
      ))}

      <path d="M220,105 C258,105 252,210 290,210" fill="none" stroke="var(--c-texte-secondaire)" strokeWidth={2} markerEnd="url(#fl)" />
      <path d="M220,315 C258,315 252,210 290,210" fill="none" stroke="var(--c-texte-secondaire)" strokeWidth={2} markerEnd="url(#fl)" />
      <path d="M490,210 L544,210" fill="none" stroke="var(--c-primaire)" strokeWidth={2.5} markerEnd="url(#flb)" />
      <path d="M750,210 L804,210" fill="none" stroke="var(--c-primaire)" strokeWidth={2.5} markerEnd="url(#flb)" />

      <Bloc x={10} y={40} l={210} h={130} fond="var(--c-fond)" bordure="var(--c-bordure-forte)"
        titre="OBJET / DÉFAUT" corps={[...lignes(valeurs.branche1_objet, 22, 1), ...lignes(valeurs.branche1_defaut, 22, 2)]} />
      <Bloc x={10} y={250} l={210} h={130} fond="var(--c-fond)" bordure="var(--c-bordure-forte)"
        titre="OBJET / DÉFAUT" corps={[...lignes(valeurs.branche2_objet, 22, 1), ...lignes(valeurs.branche2_defaut, 22, 2)]} />

      <Bloc x={290} y={145} l={200} h={130} fond="var(--c-primaire-clair)" bordure="var(--c-primaire)"
        epaisseur={2} titre="SYMPTÔME" corps={lignes(symptome, 22, 3)} />

      <Bloc x={550} y={145} l={200} h={130} fond="var(--c-fond)" bordure="var(--c-bordure-forte)"
        corps={lignes(valeurs.cause_intermediaire, 22, 4)} />

      <Bloc x={810} y={145} l={200} h={130} fond="var(--c-alerte-clair)" bordure="var(--c-alerte)"
        epaisseur={2} corps={lignes(valeurs.cause_premiere, 22, 4)} />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */

const VIDE: Omit<SaisieDefaillogramme, 'id_sdcr'> = {
  branche1_objet: '',
  branche1_defaut: '',
  branche2_objet: '',
  branche2_defaut: '',
  cause_intermediaire: '',
  cause_premiere: '',
};

const champ: React.CSSProperties = {
  width: '100%',
  minHeight: 40,
  padding: '9px 12px',
  border: '1.5px solid var(--c-bordure)',
  borderRadius: 8,
  background: 'var(--c-fond)',
  fontSize: 15,
  fontFamily: 'inherit',
};

export function DefaillogrammePage(): JSX.Element {
  const [parametres] = useSearchParams();
  const naviguer = useNavigate();
  const idSdcr = Number.parseInt(parametres.get('sdcr') ?? '', 10);

  const [saisie, setSaisie] = useState(VIDE);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enregistre, setEnregistre] = useState<Defaillogramme | null>(null);

  const donnees = useLiveQuery(async () => {
    const [fiche, defaillogrammes, equipements] = await Promise.all([
      Number.isInteger(idSdcr) ? baseLocale.entreesSdcr.get(idSdcr) : undefined,
      baseLocale.defaillogrammes.toArray(),
      baseLocale.equipements.toArray(),
    ]);
    return { fiche, defaillogrammes, equipements };
  }, [idSdcr], undefined);

  /** Défaillogramme déjà ouvert sur cette récurrence : on le révise au lieu d'en créer un second. */
  const existant = useMemo(
    () => (donnees?.defaillogrammes ?? []).find((d) => d.id_sdcr === idSdcr) ?? null,
    [donnees?.defaillogrammes, idSdcr],
  );

  useEffect(() => {
    if (existant) {
      setSaisie({
        branche1_objet: existant.branche1_objet,
        branche1_defaut: existant.branche1_defaut,
        branche2_objet: existant.branche2_objet,
        branche2_defaut: existant.branche2_defaut,
        cause_intermediaire: existant.cause_intermediaire,
        cause_premiere: existant.cause_premiere,
      });
    }
  }, [existant]);

  const fiche = enregistre ? donnees?.fiche : donnees?.fiche;
  const equipement = donnees?.equipements.find((e) => e.id_equipement === fiche?.id_equipement);

  const complet =
    saisie.branche1_objet.trim().length >= 3 &&
    saisie.branche1_defaut.trim().length >= 3 &&
    saisie.branche2_objet.trim().length >= 3 &&
    saisie.branche2_defaut.trim().length >= 3 &&
    saisie.cause_intermediaire.trim().length >= 10 &&
    saisie.cause_premiere.trim().length >= 10;

  const distinctes = branchesDistinctes(saisie);

  async function enregistrer(): Promise<void> {
    if (!complet || !distinctes) return;
    setEnCours(true);
    setErreur(null);
    try {
      const charge = { ...saisie, id_sdcr: idSdcr };
      const resultat = existant
        ? await modifierDefaillogramme(existant.id_defaillogramme, charge)
        : await creerDefaillogramme(charge);
      setEnregistre(resultat);
    } catch (e) {
      setErreur(messageErreurPilotage(e));
    } finally {
      setEnCours(false);
    }
  }

  if (!Number.isInteger(idSdcr)) {
    return (
      <CadreResponsable>
        <EtatVide
          titre="Aucune récurrence désignée"
          explication="Un défaillogramme s’ouvre depuis une récurrence signalée au tableau de bord. C’est votre décision, jamais un déclenchement automatique."
        />
      </CadreResponsable>
    );
  }

  if (donnees === undefined) {
    return <CadreResponsable><Chargement /></CadreResponsable>;
  }

  if (!fiche) {
    return (
      <CadreResponsable>
        <EtatVide
          titre="Fiche introuvable"
          explication="Cette récurrence n’est pas dans le cache local. Synchronisez, puis réessayez."
        />
      </CadreResponsable>
    );
  }

  return (
    <CadreResponsable>
      <div style={{ flexGrow: 1, display: 'flex', flexWrap: 'wrap', alignItems: 'stretch' }}>
        {/* Contexte et saisie */}
        <aside style={{ width: 380, flexShrink: 0, background: 'var(--c-fond)',
          borderRight: '1.5px solid var(--c-bordure)', padding: 20, display: 'flex',
          flexDirection: 'column', gap: 16, overflow: 'auto' }}>
          <div>
            <h1 style={{ fontSize: 19, fontWeight: 700, margin: 0 }}>Défaillogramme</h1>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--c-texte-secondaire)' }}>
              Analyse de niveau 2 — fiabilisation
            </p>
          </div>

          <div style={{ border: '1.5px solid var(--c-bordure)', borderRadius: 10,
            background: 'var(--c-fond-secondaire)', padding: '14px 15px' }}>
            <Etiquette>Récurrence à l’origine</Etiquette>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, marginTop: 9 }}>
              <span style={{ ...styleMono, fontSize: 21, fontWeight: 600, color: 'var(--c-alerte)' }}>
                {fiche.frequence_observee}×
              </span>
              <span style={{ flexGrow: 1, fontSize: 15, fontWeight: 600, textWrap: 'pretty' }}>{fiche.cause}</span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--c-texte-secondaire)', marginTop: 6, lineHeight: 1.5 }}>
              {equipement?.nom} · {equipement?.chaine}<br />
              Symptôme : {fiche.symptome}<br />
              <span style={styleMono}>Fiche SDCR nº {fiche.id_sdcr}</span>
            </div>
          </div>

          <div style={{ border: '1.5px solid var(--c-primaire)', borderRadius: 10,
            background: 'var(--c-primaire-clair)', padding: '13px 15px', fontSize: 13.5,
            color: 'var(--c-primaire)', lineHeight: 1.5, textWrap: 'pretty' }}>
            La structure est fixe : exactement deux branches contributives, qui convergent vers le
            symptôme, puis remontent jusqu’à la cause première. On n’ajoute pas de branche.
          </div>

          {([
            ['branche1_objet', 'Branche 1 — objet', 'Graissage centralisé'],
            ['branche1_defaut', 'Branche 1 — défaut', 'Débit insuffisant'],
            ['branche2_objet', 'Branche 2 — objet', 'Plan de maintenance'],
            ['branche2_defaut', 'Branche 2 — défaut', 'Périodicité non tenue'],
          ] as const).map(([cle, intitule, exemple]) => (
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

          {!distinctes && complet && (
            <div role="alert" style={{ border: '1.5px solid var(--c-danger)', background: 'var(--c-danger-clair)',
              color: 'var(--c-danger)', borderRadius: 8, padding: '11px 13px', fontSize: 13.5, textWrap: 'pretty' }}>
              Les deux branches sont identiques. Un défaillogramme montre la rencontre de deux causes
              indépendantes — sans quoi il n’y a rien à faire converger.
            </div>
          )}

          {([
            ['cause_intermediaire', 'Cause intermédiaire', 'Encrassement accéléré du capteur, constaté en 3 semaines'],
            ['cause_premiere', 'Cause première', 'Gamme préventive jamais révisée depuis la mise en service'],
          ] as const).map(([cle, intitule, exemple]) => (
            <label key={cle} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <Etiquette couleur={cle === 'cause_premiere' ? 'var(--c-alerte)' : undefined}>{intitule}</Etiquette>
              <textarea
                value={saisie[cle]}
                onChange={(e) => setSaisie((p) => ({ ...p, [cle]: e.target.value }))}
                placeholder={exemple}
                rows={3}
                style={{ ...champ, resize: 'vertical', lineHeight: 1.5 }}
              />
            </label>
          ))}

          {erreur && (
            <div role="alert" style={{ border: '1.5px solid var(--c-danger)', background: 'var(--c-danger-clair)',
              color: 'var(--c-danger)', borderRadius: 8, padding: '11px 13px', fontSize: 13.5, textWrap: 'pretty' }}>
              {erreur}
            </div>
          )}

          {enregistre && (
            <div role="status" style={{ border: '1.5px solid var(--c-succes)', background: 'var(--c-succes-clair)',
              color: 'var(--c-succes)', borderRadius: 8, padding: '11px 13px', fontSize: 13.5, fontWeight: 600 }}>
              Défaillogramme enregistré.
            </div>
          )}

          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 8 }}>
            <button
              type="button"
              disabled={enCours || !complet || !distinctes}
              onClick={() => void enregistrer()}
              style={{
                minHeight: 48, borderRadius: 8, border: 'none',
                background: complet && distinctes && !enCours ? 'var(--c-primaire)' : 'var(--c-fond-secondaire)',
                color: complet && distinctes && !enCours ? '#FFFFFF' : 'var(--c-texte-secondaire)',
                fontSize: 16, fontWeight: 600, display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: 10,
              }}
            >
              <IconeValider taille={20} />
              {enCours ? 'Enregistrement…' : existant ? 'Mettre à jour' : 'Enregistrer'}
            </button>
            <button
              type="button"
              onClick={() => naviguer('/pilotage')}
              style={{ minHeight: 44, border: '1.5px solid var(--c-bordure)', borderRadius: 8,
                background: 'var(--c-fond)', fontSize: 15, fontWeight: 600 }}
            >
              Retour au tableau de bord
            </button>
          </div>
        </aside>

        {/* Chaîne causale */}
        <section style={{ flexGrow: 1, minWidth: 420, padding: 26, display: 'flex',
          flexDirection: 'column', gap: 18 }}>
          <div style={{ border: '1.5px solid var(--c-bordure)', borderRadius: 10,
            background: 'var(--c-fond)', flexGrow: 1, padding: '20px 22px', display: 'flex',
            flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>Chaîne causale</h2>
              {existant && <Badge ton="succes">déjà ouvert</Badge>}
              <span style={{ fontSize: 13, color: 'var(--c-texte-secondaire)' }}>
                Le diagramme suit votre saisie en direct.
              </span>
            </div>

            <div style={{ flexGrow: 1, display: 'flex', alignItems: 'center' }}>
              <Diagramme valeurs={{ ...saisie, id_sdcr: idSdcr }} symptome={fiche.symptome} />
            </div>
          </div>

          <div style={{ border: '1.5px solid var(--c-bordure)', borderRadius: 10,
            background: 'var(--c-fond)', padding: '14px 20px', display: 'flex',
            alignItems: 'center', gap: 22, flexWrap: 'wrap' }}>
            <div style={{ flexGrow: 1, minWidth: 280 }}>
              <Etiquette>Ce que change ce niveau d’analyse</Etiquette>
              <p style={{ margin: '5px 0 0', fontSize: 14.5, color: 'var(--c-texte)', lineHeight: 1.45, textWrap: 'pretty' }}>
                Le niveau 1 remet la machine en service — et le refera la fois suivante. Le niveau 2
                désigne la cause première : c’est elle qu’il faut traiter pour que le symptôme cesse
                de revenir.
              </p>
            </div>
            <div style={{ width: 132, textAlign: 'center', borderLeft: '1px solid var(--c-bordure)', paddingLeft: 22 }}>
              <div style={{ ...styleMono, fontSize: 30, fontWeight: 600, color: 'var(--c-alerte)' }}>
                {fiche.frequence_observee}
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--c-texte-secondaire)', lineHeight: 1.3 }}>
                arrêts déjà observés
              </div>
            </div>
          </div>
        </section>
      </div>
    </CadreResponsable>
  );
}
