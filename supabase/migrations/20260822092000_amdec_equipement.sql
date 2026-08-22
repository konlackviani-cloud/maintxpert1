-- MaintXpert — 0011 : rattachement des modes AMDEC à un équipement (B4)
--
-- Résout le point ouvert O2. Le dictionnaire ne donne à `mode_amdec` qu'un champ
-- `composant` en texte libre : impossible de filtrer l'analyse par chaîne ou par
-- équipement, alors que le tableau de bord (UC4) le demande explicitement et que
-- l'AMDEC n'a de sens que rapportée à une machine précise.
--
-- `composant` est conservé : il désigne la pièce à l'intérieur de l'équipement
-- (« capteur de niveau », « vérin de came »), pas la machine.

alter table mode_amdec
  add column id_equipement integer not null references equipement (id_equipement);

comment on column mode_amdec.id_equipement is
  'Équipement analysé. Ajout hors dictionnaire — sans lui, B4 ne peut pas être filtré par chaîne.';
comment on column mode_amdec.composant is
  'Pièce à l''intérieur de l''équipement, pas la machine elle-même.';

create index idx_amdec_equipement on mode_amdec (id_equipement, ipr desc);

-- Un même mode de défaillance ne se décrit qu'une fois par composant.
create unique index uq_amdec_composant_mode
  on mode_amdec (id_equipement, normaliser_libelle(composant), normaliser_libelle(mode_defaillance));
