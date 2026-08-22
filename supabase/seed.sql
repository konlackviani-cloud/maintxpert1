-- MaintXpert — jeu de données de développement
--
-- ATTENTION : les équipements ci-dessous sont des PLACEHOLDERS plausibles pour une ligne
-- d'embouteillage. Ils seront remplacés par l'import CSV DimoMaint réel (B7, phase 6).
-- Aucun utilisateur n'est créé ici : les comptes se créent via le script CLI de la phase 2
-- (hachage argon2id), jamais par un INSERT avec mot de passe en clair.

insert into equipement (nom, famille, chaine) values
  -- CH02
  ('Dépalettiseur',          'Manutention',   'CH02'),
  ('Décaisseuse',            'Manutention',   'CH02'),
  ('Laveuse bouteilles',     'Lavage',        'CH02'),
  ('Inspectrice bouteille vide', 'Inspection', 'CH02'),
  ('Soutireuse-boucheuse',   'Remplissage',   'CH02'),
  ('Étiqueteuse',            'Étiquetage',    'CH02'),
  ('Encaisseuse',            'Manutention',   'CH02'),
  ('Palettiseur',            'Manutention',   'CH02'),
  ('Convoyeur bouteilles',   'Convoyage',     'CH02'),

  -- CH05
  ('Dépalettiseur',          'Manutention',   'CH05'),
  ('Laveuse bouteilles',     'Lavage',        'CH05'),
  ('Inspectrice bouteille vide', 'Inspection', 'CH05'),
  ('Soutireuse-boucheuse',   'Remplissage',   'CH05'),
  ('Pasteurisateur tunnel',  'Traitement thermique', 'CH05'),
  ('Étiqueteuse',            'Étiquetage',    'CH05'),
  ('Encaisseuse',            'Manutention',   'CH05'),
  ('Convoyeur bouteilles',   'Convoyage',     'CH05'),

  -- CH06
  ('Dépalettiseur',          'Manutention',   'CH06'),
  ('Rinceuse',               'Lavage',        'CH06'),
  ('Soutireuse-boucheuse',   'Remplissage',   'CH06'),
  ('Étiqueteuse',            'Étiquetage',    'CH06'),
  ('Fardeleuse',             'Conditionnement', 'CH06'),
  ('Palettiseur',            'Manutention',   'CH06'),
  ('Convoyeur bouteilles',   'Convoyage',     'CH06'),

  -- CH09
  ('Souffleuse préformes',   'Soufflage',     'CH09'),
  ('Rinceuse',               'Lavage',        'CH09'),
  ('Soutireuse-boucheuse',   'Remplissage',   'CH09'),
  ('Étiqueteuse',            'Étiquetage',    'CH09'),
  ('Fardeleuse',             'Conditionnement', 'CH09'),
  ('Palettiseur',            'Manutention',   'CH09'),
  ('Convoyeur bouteilles',   'Convoyage',     'CH09')
on conflict (chaine, nom) do nothing;
