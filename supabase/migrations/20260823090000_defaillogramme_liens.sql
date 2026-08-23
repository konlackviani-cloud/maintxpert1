-- MaintXpert — 0012 : rattachement du défaillogramme (B8, UC3)
--
-- Résout le point ouvert O1. Le dictionnaire décrit `symptome_convergence`
-- comme « lié à une EntreeSDCR » mais le type en VARCHAR : le lien était donc
-- décrit sans exister. Sans lui, impossible de savoir quelle récurrence a
-- déclenché l'analyse, ni d'empêcher qu'on en ouvre deux pour la même fiche.
--
-- Le libellé `symptome_convergence` est conservé : il fige le symptôme tel
-- qu'il était au moment de l'analyse. Si le responsable renomme le terme plus
-- tard (B2), le défaillogramme doit continuer de dire ce qui a été analysé.

alter table defaillogramme
  add column id_sdcr integer not null references entree_sdcr (id_sdcr);

comment on column defaillogramme.id_sdcr is
  'Fiche SDCR de convergence — la récurrence à l''origine de l''analyse.';
comment on column defaillogramme.symptome_convergence is
  'Libellé du symptôme figé au moment de l''analyse, indépendant des renommages ultérieurs.';

-- Une récurrence n'est analysée qu'une fois : ouvrir un second défaillogramme
-- sur la même fiche produirait deux vérités concurrentes sur la même panne.
create unique index uq_defaillogramme_sdcr on defaillogramme (id_sdcr);

-- ---------------------------------------------------------------------------
-- Traçabilité de la décision d'ouverture
--
-- AJOUT hors dictionnaire. Le cahier des charges insiste : l'ouverture d'un
-- défaillogramme est TOUJOURS une décision manuelle du responsable (principe
-- d'initiative a posteriori). Sans trace de qui a décidé et quand, ce principe
-- n'est pas auditable — on ne pourrait pas distinguer une analyse décidée d'une
-- analyse produite automatiquement.
-- ---------------------------------------------------------------------------

alter table defaillogramme
  add column id_responsable integer not null references utilisateur (id_utilisateur);

comment on column defaillogramme.id_responsable is
  'Responsable ayant décidé de l''ouverture. Rend auditable le principe d''initiative a posteriori.';

create index idx_defaillogramme_responsable on defaillogramme (id_responsable, date_creation desc);
