-- MaintXpert — 0003 : TermeNomenclature
-- Un terme est propre à un équipement (choix du mémoire, section 3).

create table terme_nomenclature (
  id_terme        integer generated always as identity primary key,
  libelle         varchar(150) not null,
  type            type_terme   not null,
  id_equipement   integer      not null references equipement (id_equipement),
  statut          statut_terme not null default 'actif',
  compteur_usage  integer      not null default 0 check (compteur_usage >= 0),
  categorie_afnor varchar(100)
);

comment on column terme_nomenclature.compteur_usage is
  'Incrémenté à chaque sélection. Oriente le tri des listes déroulantes (A3, A10).';
comment on column terme_nomenclature.statut is
  'Jamais de DELETE : archivage uniquement (auditabilité).';
comment on column terme_nomenclature.categorie_afnor is
  'Rattachement optionnel à une nomenclature normalisée.';

-- Pas deux fois le même libellé pour un même (équipement, type).
create unique index uq_terme_equipement_type_libelle
  on terme_nomenclature (id_equipement, type, lower(libelle));

-- Index de service des listes déroulantes filtrables : actifs d'abord, plus utilisés en tête.
create index idx_terme_selection
  on terme_nomenclature (id_equipement, type, statut, compteur_usage desc);
