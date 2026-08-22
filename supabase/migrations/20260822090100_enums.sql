-- MaintXpert — 0001 : types énumérés
-- Source : dictionnaire de données du mémoire (section 3).

create type role_utilisateur as enum ('technicien', 'responsable');

-- Machine à états EntreeSDCR :
--   en_attente -> validee | rejetee | en_correction
--   en_correction -> validee | rejetee
--   validee | rejetee -> archivee
create type statut_sdcr as enum ('en_attente', 'validee', 'rejetee', 'en_correction', 'archivee');

-- Les quatre niveaux du modèle SDCR.
create type type_terme as enum ('symptome', 'defaut', 'cause', 'remede');

-- Jamais de suppression physique d'un terme : archivage uniquement.
create type statut_terme as enum ('actif', 'archive');
