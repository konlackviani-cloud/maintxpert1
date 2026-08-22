-- MaintXpert — 0006 : Intervention et jalons T1 / T1.5 / T2

create table intervention (
  id_intervention          integer generated always as identity primary key,
  id_technicien            integer not null references utilisateur (id_utilisateur),

  -- AJOUT validé : sans équipement, une intervention ouverte hors fiche existante (parcours A6)
  -- n'est rattachable à rien et le TTDi n'est pas ventilable par chaîne / équipement.
  id_equipement            integer not null references equipement (id_equipement),

  id_sdcr                  integer references entree_sdcr (id_sdcr),

  datetime_ouverture       timestamptz not null default now(),  -- T1   (A8)
  datetime_cause_confirmee timestamptz,                         -- T1.5 (A9)
  datetime_cloture         timestamptz,                         -- T2   (A11)

  constraint chk_jalons_ordonnes check (
    (datetime_cause_confirmee is null or datetime_cause_confirmee >= datetime_ouverture)
    and (datetime_cloture is null or datetime_cloture >= datetime_ouverture)
    and (datetime_cloture is null
         or datetime_cause_confirmee is null
         or datetime_cloture >= datetime_cause_confirmee)
  )
);

comment on column intervention.id_sdcr is
  'Nullable : une intervention peut s''ouvrir avant qu''une fiche SDCR ne soit identifiée ou créée (A6).';

create index idx_intervention_technicien on intervention (id_technicien, datetime_ouverture desc);
create index idx_intervention_equipement on intervention (id_equipement, datetime_ouverture desc);
create index idx_intervention_ouvertes   on intervention (datetime_ouverture desc) where datetime_cloture is null;


-- ---------------------------------------------------------------------------
-- Mesure du mémoire : TTDi et durée totale.
-- ENF « testabilité » : la structure de mesure existe dès la phase 1.
-- ---------------------------------------------------------------------------
create view vue_mesure_intervention as
select
  i.id_intervention,
  i.id_technicien,
  i.id_equipement,
  e.chaine,
  i.id_sdcr,
  i.datetime_ouverture,
  i.datetime_cause_confirmee,
  i.datetime_cloture,
  -- TTDi : temps de diagnostic, T1 -> T1.5, en secondes.
  extract(epoch from (i.datetime_cause_confirmee - i.datetime_ouverture))::bigint as ttdi_secondes,
  -- Durée totale d'intervention, T1 -> T2, en secondes.
  extract(epoch from (i.datetime_cloture - i.datetime_ouverture))::bigint as duree_totale_secondes,
  (i.datetime_cloture is null) as en_cours
from intervention i
join equipement e on e.id_equipement = i.id_equipement;

comment on view vue_mesure_intervention is
  'TTDi = T1.5 - T1, durée totale = T2 - T1. NULL tant que le jalon n''est pas franchi.';
