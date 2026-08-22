/**
 * B2 — gestion de la nomenclature : ajout, renommage, archivage, fusion.
 *
 * Trois garde-fous inscrits dans l'interface :
 *   - aucune suppression, seulement l'archivage ;
 *   - le nombre de fiches concernées est affiché avant toute action ;
 *   - une fusion n'est proposée qu'entre termes du même niveau SDCR.
 */

import type { TermeGere, TypeTerme } from '@maintxpert/shared';
import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useEffect, useState } from 'react';

import { Badge, Chargement, EtatVide, Etiquette, styleMono } from '../../composants/ui/index.js';
import { listerChaines, listerEquipements } from '../../horsligne/depots.js';
import { CadreResponsable } from './CadreResponsable.js';
import {
  archiverTerme,
  chargerTermes,
  creerTerme,
  fusionnerTermes,
  messageErreurPilotage,
  renommerTerme,
} from './api.js';

const NIVEAUX: TypeTerme[] = ['symptome', 'defaut', 'cause', 'remede'];
const INTITULES: Record<TypeTerme, string> = {
  symptome: 'Symptômes',
  defaut: 'Défauts',
  cause: 'Causes',
  remede: 'Remèdes',
};

const message = messageErreurPilotage;

export function NomenclaturePage(): JSX.Element {
  const chaines = useLiveQuery(() => listerChaines(), [], []);
  const [chaine, setChaine] = useState<string>('');
  const equipements = useLiveQuery(
    () => (chaine ? listerEquipements(chaine) : Promise.resolve([])),
    [chaine],
    [],
  );
  const [idEquipement, setIdEquipement] = useState<number | null>(null);

  const [termes, setTermes] = useState<TermeGere[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [nouveau, setNouveau] = useState<{ type: TypeTerme; libelle: string }>({
    type: 'symptome',
    libelle: '',
  });

  useEffect(() => {
    if (!chaine && (chaines ?? []).length > 0) setChaine(chaines![0]!.chaine);
  }, [chaines, chaine]);

  useEffect(() => {
    setIdEquipement((equipements ?? [])[0]?.id_equipement ?? null);
  }, [equipements]);

  const recharger = useCallback(async (): Promise<void> => {
    if (idEquipement === null) {
      setTermes(null);
      return;
    }
    try {
      const { termes: liste } = await chargerTermes(idEquipement);
      setTermes(liste);
    } catch (e) {
      setTermes([]);
      setErreur(message(e));
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
      setErreur(message(e));
    } finally {
      setEnCours(false);
    }
  }

  const selecteur: React.CSSProperties = {
    minHeight: 40,
    padding: '0 12px',
    border: '1.5px solid var(--c-bordure)',
    borderRadius: 8,
    background: 'var(--c-fond)',
    fontSize: 15,
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
        <Etiquette>Équipement</Etiquette>
        <select value={chaine} onChange={(e) => setChaine(e.target.value)} style={selecteur} aria-label="Chaîne">
          {(chaines ?? []).map((c) => (
            <option key={c.chaine} value={c.chaine}>
              {c.chaine}
            </option>
          ))}
        </select>
        <select
          value={idEquipement ?? ''}
          onChange={(e) => setIdEquipement(Number.parseInt(e.target.value, 10))}
          style={{ ...selecteur, minWidth: 260 }}
          aria-label="Équipement"
        >
          {(equipements ?? []).map((e) => (
            <option key={e.id_equipement} value={e.id_equipement}>
              {e.nom}
            </option>
          ))}
        </select>
      </div>

      <main style={{ flexGrow: 1, padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
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

        {/* Ajout d'un terme */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (idEquipement === null || nouveau.libelle.trim().length < 2) return;
            void agir(async () => {
              await creerTerme(nouveau.libelle.trim(), nouveau.type, idEquipement);
              setNouveau((p) => ({ ...p, libelle: '' }));
            });
          }}
          style={{
            display: 'flex',
            gap: 10,
            flexWrap: 'wrap',
            alignItems: 'center',
            border: '1.5px solid var(--c-bordure)',
            borderRadius: 10,
            background: 'var(--c-fond)',
            padding: 14,
          }}
        >
          <Etiquette>Ajouter un terme</Etiquette>
          <select
            value={nouveau.type}
            onChange={(e) => setNouveau((p) => ({ ...p, type: e.target.value as TypeTerme }))}
            style={selecteur}
            aria-label="Niveau SDCR"
          >
            {NIVEAUX.map((n) => (
              <option key={n} value={n}>
                {INTITULES[n]}
              </option>
            ))}
          </select>
          <input
            value={nouveau.libelle}
            onChange={(e) => setNouveau((p) => ({ ...p, libelle: e.target.value }))}
            placeholder="Libellé du terme"
            aria-label="Libellé du terme"
            style={{ ...selecteur, flexGrow: 1, minWidth: 260 }}
          />
          <button
            type="submit"
            disabled={enCours || nouveau.libelle.trim().length < 2}
            style={{
              minHeight: 40,
              padding: '0 18px',
              border: 'none',
              borderRadius: 8,
              background: 'var(--c-primaire)',
              color: '#FFFFFF',
              fontSize: 15,
              fontWeight: 600,
            }}
          >
            Ajouter
          </button>
        </form>

        {termes === null && <Chargement />}

        {termes?.length === 0 && (
          <EtatVide
            titre="Nomenclature vide"
            explication="Cet équipement n’a encore aucun terme. Ajoutez-en, ou laissez les techniciens en proposer par leurs contributions."
          />
        )}

        {termes && termes.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
            {NIVEAUX.map((niveau) => {
              const groupe = termes.filter((t) => t.type === niveau);
              const actifs = groupe.filter((t) => t.statut === 'actif');

              return (
                <section
                  key={niveau}
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
                      gap: 8,
                      padding: '12px 14px',
                      borderBottom: '1.5px solid var(--c-bordure)',
                      background: 'var(--c-fond-secondaire)',
                    }}
                  >
                    <Etiquette couleur={niveau === 'defaut' ? 'var(--c-primaire)' : undefined}>
                      {INTITULES[niveau]}
                    </Etiquette>
                    <span style={{ ...styleMono, marginLeft: 'auto', fontSize: 13, color: 'var(--c-texte-secondaire)' }}>
                      {groupe.length}
                    </span>
                  </header>

                  {groupe.length === 0 && (
                    <p style={{ padding: '16px 14px', margin: 0, fontSize: 14, color: 'var(--c-texte-secondaire)' }}>
                      Aucun terme à ce niveau.
                    </p>
                  )}

                  {groupe.map((terme) => {
                    const archive = terme.statut === 'archive';
                    const fusionnables = actifs.filter((t) => t.id_terme !== terme.id_terme);

                    return (
                      <div
                        key={terme.id_terme}
                        style={{
                          padding: '12px 14px',
                          borderBottom: '1px solid var(--c-bordure)',
                          opacity: archive ? 0.65 : 1,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                          <span
                            style={{
                              flexGrow: 1,
                              minWidth: 140,
                              fontSize: 15,
                              fontWeight: 600,
                              textDecoration: archive ? 'line-through' : 'none',
                              textWrap: 'pretty',
                            }}
                          >
                            {terme.libelle}
                          </span>
                          <span style={{ ...styleMono, fontSize: 13, color: 'var(--c-texte-secondaire)' }}>
                            {terme.compteur_usage} usages · {terme.nb_fiches} fiche
                            {terme.nb_fiches > 1 ? 's' : ''}
                          </span>
                        </div>

                        {archive && (
                          <div style={{ marginTop: 6, fontSize: 13, color: 'var(--c-texte-secondaire)' }}>
                            <Badge ton="neutre">archivé</Badge>
                            {terme.libelle_remplacant && (
                              <span style={{ marginLeft: 8 }}>
                                remplacé par « {terme.libelle_remplacant} »
                              </span>
                            )}
                          </div>
                        )}

                        {!archive && (
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 9 }}>
                            <button
                              type="button"
                              disabled={enCours}
                              onClick={() => {
                                const libelle = window.prompt('Nouveau libellé', terme.libelle);
                                if (libelle && libelle.trim() !== terme.libelle) {
                                  void agir(() => renommerTerme(terme.id_terme, libelle.trim()));
                                }
                              }}
                              style={boutonSecondaire}
                            >
                              Renommer
                            </button>

                            <button
                              type="button"
                              disabled={enCours}
                              onClick={() => {
                                const confirme = window.confirm(
                                  `Archiver « ${terme.libelle} » ?\n\nIl ne sera plus proposé aux techniciens. Les ${terme.nb_fiches} fiche(s) qui le référencent restent intactes.`,
                                );
                                if (confirme) void agir(() => archiverTerme(terme.id_terme));
                              }}
                              style={boutonSecondaire}
                            >
                              Archiver
                            </button>

                            {fusionnables.length > 0 && (
                              <select
                                value=""
                                disabled={enCours}
                                aria-label={`Fusionner « ${terme.libelle} » dans un autre terme`}
                                onChange={(e) => {
                                  const idCible = Number.parseInt(e.target.value, 10);
                                  const cible = fusionnables.find((t) => t.id_terme === idCible);
                                  if (!cible) return;
                                  const confirme = window.confirm(
                                    `Fusionner « ${terme.libelle} » dans « ${cible.libelle} » ?\n\n` +
                                      `${terme.nb_fiches} fiche(s) seront réécrites. « ${terme.libelle} » sera archivé et redirigé.`,
                                  );
                                  if (confirme) void agir(() => fusionnerTermes(terme.id_terme, idCible));
                                }}
                                style={{ ...boutonSecondaire, minWidth: 150 }}
                              >
                                <option value="">Fusionner dans…</option>
                                {fusionnables.map((t) => (
                                  <option key={t.id_terme} value={t.id_terme}>
                                    {t.libelle}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </section>
              );
            })}
          </div>
        )}
      </main>
    </CadreResponsable>
  );
}

const boutonSecondaire: React.CSSProperties = {
  minHeight: 36,
  padding: '0 12px',
  border: '1.5px solid var(--c-bordure)',
  borderRadius: 8,
  background: 'var(--c-fond)',
  fontSize: 14,
  fontWeight: 600,
  color: 'var(--c-primaire)',
};
