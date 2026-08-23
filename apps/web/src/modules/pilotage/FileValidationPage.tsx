/**
 * B1 / UC2 — file de validation.
 *
 * Deux volets : la file à gauche, le détail à droite. Le détail porte le geste
 * central du cahier des charges — « corriger le libellé » — sous la forme d'un
 * rattachement de chaque niveau saisi librement à un terme de la nomenclature.
 * C'est là que la nomenclature se construit réellement.
 */

import type {
  ContributionAValider,
  CorrectionsFiche,
  DetailContribution,
  TypeTerme,
} from '@maintxpert/shared';
import { useCallback, useEffect, useState } from 'react';

import { Badge, Chargement, EtatVide, Etiquette, IconeValider, styleMono } from '../../composants/ui/index.js';
import { CadreResponsable } from './CadreResponsable.js';
import {
  chargerDetail,
  chargerFile,
  fusionnerAvec,
  messageErreurPilotage,
  rejeterContribution,
  renvoyerEnCorrection,
  validerContribution,
} from './api.js';

const NIVEAUX: TypeTerme[] = ['symptome', 'defaut', 'cause', 'remede'];
const INTITULES: Record<TypeTerme, string> = {
  symptome: 'Symptôme',
  defaut: 'Défaut',
  cause: 'Cause',
  remede: 'Remède',
};
/** Article défini par niveau — « la cause », pas « le cause ». */
const ARTICLES: Record<TypeTerme, string> = {
  symptome: 'le symptôme',
  defaut: 'le défaut',
  cause: 'la cause',
  remede: 'le remède',
};

const messageDErreur = messageErreurPilotage;

/* -------------------------------------------------------------------------- */

function LigneFile({
  contribution,
  actif,
  onClick,
}: {
  contribution: ContributionAValider;
  actif: boolean;
  onClick: () => void;
}): JSX.Element {
  const ancienne = contribution.age_jours >= 7;

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%',
        textAlign: 'left',
        padding: '14px 18px',
        border: 'none',
        borderBottom: actif ? '1.5px solid var(--c-primaire)' : '1px solid var(--c-bordure)',
        background: actif ? 'var(--c-primaire-clair)' : 'var(--c-fond)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            flexGrow: 1,
            fontSize: 15,
            fontWeight: 600,
            color: actif ? 'var(--c-primaire)' : 'var(--c-texte)',
            textWrap: 'pretty',
          }}
        >
          {contribution.fiche.symptome}
        </span>
        <Badge ton={ancienne ? 'alerte' : 'neutre'}>
          {contribution.age_jours} J
        </Badge>
      </div>
      <div style={{ fontSize: 13, color: 'var(--c-texte-secondaire)', marginTop: 4 }}>
        {contribution.equipement.nom} · {contribution.equipement.chaine}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
        <span style={{ ...styleMono, fontSize: 'var(--taille-xs)', color: 'var(--c-texte-secondaire)' }}>
          {contribution.contributeur.matricule}
        </span>
        {contribution.niveaux_libres > 0 && <Badge ton="alerte">saisie libre</Badge>}
        {contribution.fiche.statut === 'en_correction' && <Badge ton="primaire">en correction</Badge>}
      </div>
    </button>
  );
}

/* -------------------------------------------------------------------------- */

export function FileValidationPage(): JSX.Element {
  const [contributions, setContributions] = useState<ContributionAValider[] | null>(null);
  const [selection, setSelection] = useState<number | null>(null);
  const [detail, setDetail] = useState<DetailContribution | null>(null);
  const [corrections, setCorrections] = useState<CorrectionsFiche>({});
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const rafraichirFile = useCallback(async (): Promise<void> => {
    try {
      const { contributions: liste } = await chargerFile();
      setContributions(liste);
      setSelection((precedent) =>
        precedent !== null && liste.some((c) => c.fiche.id_sdcr === precedent)
          ? precedent
          : (liste[0]?.fiche.id_sdcr ?? null),
      );
    } catch (e) {
      setContributions([]);
      setErreur(messageDErreur(e));
    }
  }, []);

  useEffect(() => {
    void rafraichirFile();
  }, [rafraichirFile]);

  useEffect(() => {
    if (selection === null) {
      setDetail(null);
      return;
    }
    let actif = true;
    setCorrections({});
    void chargerDetail(selection)
      .then((d) => actif && setDetail(d))
      .catch((e: unknown) => actif && setErreur(messageDErreur(e)));
    return () => {
      actif = false;
    };
  }, [selection]);

  async function agir(action: () => Promise<void>): Promise<void> {
    setEnCours(true);
    setErreur(null);
    try {
      await action();
      setSelection(null);
      await rafraichirFile();
    } catch (e) {
      setErreur(messageDErreur(e));
    } finally {
      setEnCours(false);
    }
  }

  function rattacher(niveau: TypeTerme, idTerme: number | null, libelle: string): void {
    setCorrections((precedent) => ({ ...precedent, [niveau]: { id_terme: idTerme, libelle } }));
  }

  const nb = contributions?.length ?? 0;

  /**
   * Niveaux encore hors nomenclature, corrections en cours comprises.
   * Recompté à chaque rattachement : l'avertissement doit refléter l'écran, pas
   * l'état au chargement — sinon il réclame encore trois rattachements alors
   * que le responsable vient d'en faire deux.
   */
  const libresRestants = detail
    ? NIVEAUX.filter((niveau) =>
        corrections[niveau]
          ? corrections[niveau]!.id_terme === null
          : detail.fiche[`id_terme_${niveau}` as const] === null,
      ).length
    : 0;

  return (
    <CadreResponsable compteurValidation={nb}>
      <div style={{ flexGrow: 1, display: 'flex', flexWrap: 'wrap', alignItems: 'stretch' }}>
        {/* Volet gauche — la file */}
        <aside
          style={{
            width: 396,
            flexShrink: 0,
            background: 'var(--c-fond)',
            borderRight: '1.5px solid var(--c-bordure)',
          }}
        >
          <div style={{ padding: '16px 18px 12px', borderBottom: '1.5px solid var(--c-bordure)' }}>
            <h1 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>File de validation</h1>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--c-texte-secondaire)' }}>
              {contributions === null
                ? 'Chargement…'
                : nb === 0
                  ? 'Rien en attente'
                  : `${nb} contribution${nb > 1 ? 's' : ''} · plus anciennes en tête`}
            </p>
          </div>

          {contributions?.map((contribution) => (
            <LigneFile
              key={contribution.fiche.id_sdcr}
              contribution={contribution}
              actif={contribution.fiche.id_sdcr === selection}
              onClick={() => setSelection(contribution.fiche.id_sdcr)}
            />
          ))}
        </aside>

        {/* Volet droit — le détail */}
        <section style={{ flexGrow: 1, minWidth: 420, display: 'flex', flexDirection: 'column' }}>
          {contributions?.length === 0 && (
            <EtatVide
              titre="File vide"
              explication="Toutes les contributions ont été traitées. Les nouvelles fiches proposées par les techniciens apparaîtront ici."
            />
          )}

          {contributions && contributions.length > 0 && detail === null && <Chargement />}

          {detail && (
            <>
              <div style={{ flexGrow: 1, padding: '22px 26px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>
                    Contribution de {detail.contributeur.matricule} — {detail.contributeur.prenom}{' '}
                    {detail.contributeur.nom}
                  </h2>
                  <p style={{ margin: '3px 0 0', fontSize: 14, color: 'var(--c-texte-secondaire)' }}>
                    Soumise le{' '}
                    {new Date(detail.fiche.date_creation).toLocaleString('fr-FR', {
                      dateStyle: 'long',
                      timeStyle: 'short',
                    })}{' '}
                    · {detail.equipement.nom} · {detail.equipement.chaine}
                  </p>
                </div>

                {libresRestants > 0 && (
                  <div
                    style={{
                      border: '1.5px solid var(--c-alerte)',
                      background: 'var(--c-alerte-clair)',
                      borderRadius: 10,
                      padding: '13px 15px',
                      fontSize: 14,
                      color: 'var(--c-alerte)',
                      lineHeight: 1.45,
                      textWrap: 'pretty',
                    }}
                  >
                    {libresRestants} niveau{libresRestants > 1 ? 'x' : ''} sur 4 encore saisi
                    {libresRestants > 1 ? 's' : ''} en texte libre.{' '}
                    {libresRestants > 1
                      ? 'Rattachez-les à la nomenclature avant de valider, sinon ils resteront introuvables par la recherche des autres techniciens.'
                      : 'Rattachez-le à la nomenclature avant de valider, sinon il restera introuvable par la recherche des autres techniciens.'}
                  </div>
                )}

                {libresRestants === 0 && detail.niveaux_libres > 0 && (
                  <div
                    style={{
                      border: '1.5px solid var(--c-succes)',
                      background: 'var(--c-succes-clair)',
                      borderRadius: 10,
                      padding: '13px 15px',
                      fontSize: 14,
                      color: 'var(--c-succes)',
                      textWrap: 'pretty',
                    }}
                  >
                    Les quatre niveaux sont rattachés à la nomenclature. La fiche sera trouvable par
                    la recherche.
                  </div>
                )}

                <div
                  style={{
                    border: '1.5px solid var(--c-bordure)',
                    borderRadius: 10,
                    background: 'var(--c-fond)',
                    overflow: 'hidden',
                  }}
                >
                  {NIVEAUX.map((niveau, index) => {
                    const idTerme = detail.fiche[`id_terme_${niveau}` as const];
                    const libelle = corrections[niveau]?.libelle ?? detail.fiche[niveau];
                    const rattache = corrections[niveau]
                      ? corrections[niveau]!.id_terme !== null
                      : idTerme !== null;
                    const candidats = detail.termes.filter((t) => t.type === niveau);

                    return (
                      <div
                        key={niveau}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 16,
                          flexWrap: 'wrap',
                          padding: '14px 16px',
                          borderBottom:
                            index < NIVEAUX.length - 1 ? '1px solid var(--c-bordure)' : 'none',
                        }}
                      >
                        <div style={{ width: 78, flexShrink: 0 }}>
                          <Etiquette couleur={niveau === 'defaut' ? 'var(--c-primaire)' : undefined}>
                            {INTITULES[niveau]}
                          </Etiquette>
                        </div>
                        <div style={{ flexGrow: 1, minWidth: 180, fontSize: 16, fontWeight: 600, textWrap: 'pretty' }}>
                          {libelle}
                        </div>
                        <Badge ton={rattache ? 'succes' : 'alerte'}>
                          {rattache ? 'nomenclature' : 'saisie libre'}
                        </Badge>

                        {!rattache && (
                          <select
                            aria-label={`Rattacher ${ARTICLES[niveau]} à un terme`}
                            value=""
                            onChange={(e) => {
                              const choisi = candidats.find(
                                (t) => t.id_terme === Number.parseInt(e.target.value, 10),
                              );
                              if (choisi) rattacher(niveau, choisi.id_terme, choisi.libelle);
                            }}
                            style={{
                              width: 260,
                              height: 40,
                              padding: '0 10px',
                              border: '1.5px solid var(--c-primaire)',
                              borderRadius: 8,
                              background: 'var(--c-fond)',
                              fontSize: 14,
                            }}
                          >
                            <option value="">Rattacher à un terme…</option>
                            {candidats.map((t) => (
                              <option key={t.id_terme} value={t.id_terme}>
                                {t.libelle}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    );
                  })}
                </div>

                {detail.doublons.length > 0 && (
                  <div
                    style={{
                      border: '1.5px solid var(--c-bordure)',
                      borderRadius: 10,
                      background: 'var(--c-fond)',
                      padding: '14px 16px',
                    }}
                  >
                    <Etiquette>Fiches proches déjà validées</Etiquette>
                    {detail.doublons.map(({ fiche, symptome_different }) => (
                      <div
                        key={fiche.id_sdcr}
                        style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 11, flexWrap: 'wrap' }}
                      >
                        <span style={{ ...styleMono, fontSize: 16, fontWeight: 600, color: 'var(--c-texte-secondaire)' }}>
                          {fiche.frequence_observee}×
                        </span>
                        {symptome_different && <Badge ton="primaire">autre symptôme</Badge>}
                        <span style={{ flexGrow: 1, minWidth: 220, fontSize: 15, textWrap: 'pretty' }}>
                          {fiche.symptome} → {fiche.defaut} → {fiche.cause}
                        </span>
                        <button
                          type="button"
                          disabled={enCours}
                          onClick={() =>
                            void agir(() => fusionnerAvec(detail.fiche.id_sdcr, fiche.id_sdcr))
                          }
                          style={{
                            minHeight: 40,
                            padding: '0 14px',
                            border: '1.5px solid var(--c-primaire)',
                            borderRadius: 8,
                            background: 'var(--c-fond)',
                            fontSize: 14,
                            fontWeight: 600,
                            color: 'var(--c-primaire)',
                          }}
                        >
                          Fusionner
                        </button>
                      </div>
                    ))}
                    <p
                      style={{
                        margin: '10px 0 0',
                        fontSize: 13,
                        color: 'var(--c-texte-secondaire)',
                        textWrap: 'pretty',
                      }}
                    >
                      {detail.doublons.some((d) => d.symptome_different)
                        ? 'Le symptôme diffère mais le couple défaut / cause est identique. Fusionner reporte la fréquence sur la fiche existante au lieu de créer un doublon.'
                        : 'Même défaut et même cause qu’une fiche existante.'}
                    </p>
                  </div>
                )}

                {erreur && (
                  <div
                    role="alert"
                    style={{
                      border: '1.5px solid var(--c-danger)',
                      background: 'var(--c-danger-clair)',
                      color: 'var(--c-danger)',
                      borderRadius: 10,
                      padding: '12px 16px',
                      fontSize: 15,
                    }}
                  >
                    {erreur}
                  </div>
                )}
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  flexWrap: 'wrap',
                  padding: '15px 26px',
                  background: 'var(--c-fond)',
                  borderTop: '1.5px solid var(--c-bordure)',
                }}
              >
                <button
                  type="button"
                  disabled={enCours}
                  onClick={() =>
                    void agir(() =>
                      validerContribution(
                        detail.fiche.id_sdcr,
                        Object.keys(corrections).length > 0 ? corrections : undefined,
                      ),
                    )
                  }
                  style={{
                    minHeight: 48,
                    padding: '0 22px',
                    border: 'none',
                    borderRadius: 8,
                    background: 'var(--c-succes)',
                    color: '#FFFFFF',
                    fontSize: 16,
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <IconeValider taille={20} couleur="#FFFFFF" />
                  Valider et publier
                </button>

                <button
                  type="button"
                  disabled={enCours}
                  onClick={() => {
                    const motif = window.prompt('Que doit corriger le technicien ?');
                    if (motif) void agir(() => renvoyerEnCorrection(detail.fiche.id_sdcr, motif));
                  }}
                  style={{
                    minHeight: 48,
                    padding: '0 20px',
                    border: '1.5px solid var(--c-bordure)',
                    borderRadius: 8,
                    background: 'var(--c-fond)',
                    fontSize: 16,
                    fontWeight: 600,
                  }}
                >
                  Renvoyer en correction
                </button>

                <button
                  type="button"
                  disabled={enCours}
                  onClick={() => {
                    const motif = window.prompt('Motif du rejet ?');
                    if (motif) void agir(() => rejeterContribution(detail.fiche.id_sdcr, motif));
                  }}
                  style={{
                    minHeight: 48,
                    padding: '0 20px',
                    border: '1.5px solid var(--c-danger)',
                    borderRadius: 8,
                    background: 'var(--c-fond)',
                    fontSize: 16,
                    fontWeight: 600,
                    color: 'var(--c-danger)',
                  }}
                >
                  Rejeter
                </button>

                <p
                  style={{
                    marginLeft: 'auto',
                    marginBlock: 0,
                    fontSize: 13,
                    color: 'var(--c-texte-secondaire)',
                    textWrap: 'pretty',
                  }}
                >
                  Une fois validée, la fiche est visible par tous les techniciens immédiatement.
                </p>
              </div>
            </>
          )}
        </section>
      </div>
    </CadreResponsable>
  );
}
