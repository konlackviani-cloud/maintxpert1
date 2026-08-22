-- MaintXpert — 0010 : fusion de termes de nomenclature (B2)
--
-- Résout le point ouvert O3. La v1.0 interdit toute suppression physique : un
-- terme fusionné dans un autre doit donc rester en base, archivé, mais en
-- pointant vers celui qui le remplace. Sans ce pointeur, une fiche ancienne
-- référencerait un terme archivé sans qu'on sache par quoi il a été remplacé —
-- l'historique deviendrait illisible.

alter table terme_nomenclature
  add column id_terme_remplacant integer references terme_nomenclature (id_terme);

comment on column terme_nomenclature.id_terme_remplacant is
  'Renseigné lors d''une fusion (B2) : le terme est archivé et redirige vers celui-ci. NULL sinon.';

-- Un terme ne peut pas se remplacer lui-même.
alter table terme_nomenclature
  add constraint chk_remplacant_different check (id_terme_remplacant is distinct from id_terme);

-- Un terme qui en remplace un autre est nécessairement archivé.
alter table terme_nomenclature
  add constraint chk_remplacant_implique_archive
  check (id_terme_remplacant is null or statut = 'archive');

create index idx_terme_remplacant on terme_nomenclature (id_terme_remplacant)
  where id_terme_remplacant is not null;
