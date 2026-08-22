-- MaintXpert — 0005 : FicheCSD, ModeAMDEC, Defaillogramme

-- ---------------------------------------------------------------------------
-- FicheCSD — Configuration Sans Défaut : une fiche par équipement (A7, B6).
-- ---------------------------------------------------------------------------
create table fiche_csd (
  id_csd        integer generated always as identity primary key,
  id_equipement integer not null unique references equipement (id_equipement),
  description   text    not null,
  photo_url     varchar(255)
);

comment on table fiche_csd is 'État de référence de l''équipement. Une seule fiche par équipement.';


-- ---------------------------------------------------------------------------
-- ModeAMDEC — IPR = gravite x frequence x detection, critique si >= 12 (B4).
-- ---------------------------------------------------------------------------
create table mode_amdec (
  id_mode          integer generated always as identity primary key,
  composant        varchar(150) not null,
  mode_defaillance varchar(150) not null,
  cause            varchar(150) not null,
  effet            varchar(150) not null,
  gravite          integer not null check (gravite   between 1 and 4),
  frequence        integer not null check (frequence between 1 and 4),
  detection        integer not null check (detection between 1 and 4),
  -- Colonne calculée : l'IPR ne peut pas diverger de ses trois facteurs.
  ipr              integer generated always as (gravite * frequence * detection) stored
);

comment on column mode_amdec.ipr is 'Calculé. Seuil de criticité : >= 12 (packages/shared constantes).';

create index idx_amdec_ipr on mode_amdec (ipr desc);


-- ---------------------------------------------------------------------------
-- Defaillogramme — niveau 2, structure FIXE à deux branches convergentes (B8).
-- Entité séparée : ce n'est pas une extension d'EntreeSDCR.
-- Ouverture toujours manuelle par le responsable (jamais automatisée).
-- ---------------------------------------------------------------------------
create table defaillogramme (
  id_defaillogramme    integer generated always as identity primary key,
  id_equipement        integer      not null references equipement (id_equipement),
  branche1_objet       varchar(150) not null,
  branche1_defaut      varchar(150) not null,
  branche2_objet       varchar(150) not null,
  branche2_defaut      varchar(150) not null,
  symptome_convergence varchar(150) not null,
  cause_intermediaire  text         not null,
  cause_premiere       text         not null,
  date_creation        date         not null default current_date
);

comment on table defaillogramme is
  'Formalisme MAXER allégé. Topologie fixe : exactement deux branches contributives convergentes.';
comment on column defaillogramme.symptome_convergence is
  'Libellé du symptôme de l''EntreeSDCR de convergence. FK id_sdcr en attente d''arbitrage (voir docs/03-decisions.md, point ouvert O1).';

create index idx_defaillogramme_equipement on defaillogramme (id_equipement, date_creation desc);
