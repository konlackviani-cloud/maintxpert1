-- MaintXpert — 0002 : Utilisateur et Equipement

-- Héritage à profils : un seul rôle actif par utilisateur (pas de multi-rôle en v1.0).
-- Pas de rôle Administrateur : création des comptes hors application (script CLI, phase 2).
create table utilisateur (
  id_utilisateur    integer generated always as identity primary key,
  nom               varchar(50)  not null,
  prenom            varchar(50)  not null,
  matricule         varchar(20)  not null unique,   -- identifiant de connexion (A1)
  role              role_utilisateur not null,
  mot_de_passe_hash varchar(255) not null,          -- argon2id — jamais de clair
  actif             boolean      not null default true
);

comment on column utilisateur.matricule is 'Identifiant de connexion (A1). Jamais un email.';
comment on column utilisateur.mot_de_passe_hash is 'Hachage argon2id. Aucun mot de passe en clair, nulle part.';

create index idx_utilisateur_actif on utilisateur (actif) where actif;


-- Chaînes d'embouteillage de l'usine Terrain Court : CH02, CH05, CH06, CH09.
create table equipement (
  id_equipement integer generated always as identity primary key,
  nom           varchar(100) not null,
  famille       varchar(100) not null,
  chaine        varchar(20)  not null,
  constraint uq_equipement_chaine_nom unique (chaine, nom)
);

comment on table equipement is 'Alimenté initialement par import CSV DimoMaint (B7).';

create index idx_equipement_chaine on equipement (chaine);
create index idx_equipement_famille on equipement (famille);
