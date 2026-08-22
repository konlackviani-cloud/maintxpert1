-- MaintXpert — 0004 : EntreeSDCR
-- Une entrée = un quadruplet complet attesté S -> D -> C -> R sur un équipement donné.
--
-- Chaque niveau est stocké en couple : FK vers terme_nomenclature (nullable) + libellé dénormalisé.
--   - la FK permet la fusion / le renommage / l'archivage de termes (B2) ;
--   - le libellé permet la saisie libre (« Autre », via_nomenclature = false) et rend la
--     recherche FP1 exécutable telle quelle sur le cache IndexedDB, sans jointure.
-- Décision validée — voir docs/03-decisions.md (D3).

create table entree_sdcr (
  id_sdcr            integer generated always as identity primary key,
  id_equipement      integer      not null references equipement (id_equipement),

  id_terme_symptome  integer      references terme_nomenclature (id_terme),
  symptome           varchar(150) not null,
  id_terme_defaut    integer      references terme_nomenclature (id_terme),
  defaut             varchar(150) not null,
  id_terme_cause     integer      references terme_nomenclature (id_terme),
  cause              varchar(150) not null,
  id_terme_remede    integer      references terme_nomenclature (id_terme),
  remede             varchar(150) not null,

  frequence_observee integer      not null default 1 check (frequence_observee >= 0),
  via_nomenclature   boolean      not null default true,
  statut             statut_sdcr  not null default 'en_attente',
  photo_url          varchar(255),

  -- AJOUT validé (A1 du dictionnaire complété) : sans contributeur, A12 est infaisable.
  id_contributeur    integer      not null references utilisateur (id_utilisateur),
  id_valideur        integer      references utilisateur (id_utilisateur),

  -- AJOUT validé : sans date, B5 / UC4 (filtres par période) sont infaisables.
  date_creation      timestamptz  not null default now(),
  date_modification  timestamptz  not null default now(),

  -- Cohérence du drapeau : une entrée « via nomenclature » référence les quatre termes.
  constraint chk_via_nomenclature check (
    via_nomenclature = false
    or (id_terme_symptome is not null
        and id_terme_defaut is not null
        and id_terme_cause is not null
        and id_terme_remede is not null)
  ),

  -- Un valideur n'est renseigné que sur une entrée effectivement traitée.
  constraint chk_valideur_si_traitee check (
    statut = 'en_attente' or id_valideur is not null or statut = 'archivee'
  )
);

comment on column entree_sdcr.frequence_observee is
  'Incrémentée à chaque confirmation de cause (A5). Clé du tri FP1.';
comment on column entree_sdcr.via_nomenclature is
  'Faux si saisie via « Autre ». Alimente le taux de recours à la nomenclature non contrôlée (B5).';

-- Normalisation de libellé — MIROIR EXACT de normaliserLibelle() dans
-- packages/shared/src/regles/recherche-frequence.ts. Toute modification doit être
-- répercutée des deux côtés, sans quoi la recherche hors ligne et la recherche
-- serveur divergent.
-- Elle absorbe uniquement casse et espaces surnuméraires : ce n'est PAS une
-- similarité approchée. Deux libellés différents restent différents.
create or replace function normaliser_libelle(libelle text)
returns text
language sql
immutable
strict
parallel safe
as $$
  select lower(regexp_replace(btrim(libelle), '\s+', ' ', 'g'));
$$;

-- FP1 : égalité stricte (symptome, id_equipement) sur les entrées validées, tri par fréquence.
-- Pas de recherche floue, pas de distance calculée.
create index idx_sdcr_fp1
  on entree_sdcr (id_equipement, normaliser_libelle(symptome), statut, frequence_observee desc);

-- B1 : file d'attente de validation, plus ancienne en tête.
create index idx_sdcr_file_validation
  on entree_sdcr (statut, date_creation)
  where statut in ('en_attente', 'en_correction');

-- A12 : « le statut de mes contributions ».
create index idx_sdcr_contributeur
  on entree_sdcr (id_contributeur, date_creation desc);

-- FP5 : détection des récurrences pour la suggestion de défaillogramme.
create index idx_sdcr_recurrence
  on entree_sdcr (frequence_observee desc)
  where statut = 'validee';


-- Maintien automatique de date_modification.
create or replace function trg_entree_sdcr_touch()
returns trigger
language plpgsql
as $$
begin
  new.date_modification := now();
  return new;
end;
$$;

create trigger entree_sdcr_touch
  before update on entree_sdcr
  for each row
  execute function trg_entree_sdcr_touch();
