-- MaintXpert — 0008 : buckets de stockage objet pour les photos
-- Photos privées : servies via URL signée, jamais publiques (données industrielles internes).
-- Ignoré silencieusement si la cible n'est pas une instance Supabase (schéma storage absent).

do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then

    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values
      ('photos-sdcr', 'photos-sdcr', false, 1048576, array['image/webp', 'image/jpeg']),
      ('photos-csd',  'photos-csd',  false, 1048576, array['image/webp', 'image/jpeg'])
    on conflict (id) do nothing;

  else
    raise notice 'Schéma "storage" absent : création des buckets ignorée (cible non-Supabase).';
  end if;
end
$$;

-- Limite à 1 Mo : la cible de compression client est 400 Ko (voir CLAUDE.md section 4).
-- La marge absorbe les cas où la recompression à 70 % ne suffit pas.
