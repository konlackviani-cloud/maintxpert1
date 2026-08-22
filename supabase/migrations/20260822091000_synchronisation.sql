-- MaintXpert — 0009 : journal d'idempotence de la synchronisation
--
-- Addition d'INFRASTRUCTURE, pas de domaine : elle ne figure pas au dictionnaire
-- de données et n'y ajoute aucune notion métier.
--
-- Pourquoi elle est indispensable : le technicien saisit hors ligne, la file
-- d'attente est rejouée à la reconnexion, et un rejeu peut se produire deux fois
-- (réseau coupé après traitement mais avant l'accusé de réception). Sans journal,
-- une confirmation de cause rejouée incrémenterait `frequence_observee` deux
-- fois — et c'est précisément cette fréquence qui ordonne les résultats de FP1
-- et qui déclenche la suggestion de défaillogramme. Une base faussée par des
-- doublons de réseau invaliderait le retour d'expérience.
--
-- Chaque mutation porte un identifiant local (UUID généré sur le terminal). Le
-- serveur enregistre l'identifiant ET le résultat produit : un rejeu renvoie le
-- résultat d'origine sans rien réappliquer.

create table mutation_appliquee (
  id_local       uuid        primary key,
  type           varchar(60) not null,
  id_utilisateur integer     not null references utilisateur (id_utilisateur),
  resultat       jsonb,
  applique_le    timestamptz not null default now()
);

comment on table mutation_appliquee is
  'Journal d''idempotence de la synchronisation montante. Un id_local rejoué renvoie le résultat d''origine.';
comment on column mutation_appliquee.resultat is
  'Réponse renvoyée au client lors du premier traitement, rejouée telle quelle ensuite.';

-- Purge des vieilles entrées : la file d'un terminal ne survit pas des mois.
create index idx_mutation_applique_le on mutation_appliquee (applique_le);
