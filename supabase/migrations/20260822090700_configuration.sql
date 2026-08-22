-- MaintXpert — 0007 : Configuration
-- Le cahier des charges impose un seuil de récurrence « configurable » (FP5) :
-- il lui faut un support de persistance.

create table configuration (
  cle         varchar(50)  primary key,
  valeur      varchar(255) not null,
  description text         not null
);

insert into configuration (cle, valeur, description) values
  ('seuil_recurrence',
   '3',
   'Nombre d''occurrences (frequence_observee) à partir duquel une EntreeSDCR est signalée comme récurrente et déclenche une SUGGESTION de défaillogramme au tableau de bord responsable (FP5). L''ouverture reste une décision manuelle.'),
  ('seuil_ipr_critique',
   '12',
   'IPR (gravite x frequence x detection) à partir duquel un mode AMDEC est considéré critique (B4).');
