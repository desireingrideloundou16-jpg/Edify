-- ─── Limites de taille (audit de sécurité, point 8.1) ───────────────────────
-- Un projet contient le design, le logo (image) et l'illustration IA : 5 Mo suffisent
-- largement (une illustration fait ~1 Mo, un logo quelques centaines de Ko). Empêche un
-- client de remplir la base via l'API avec des projets géants.
do $$ begin
  alter table public.projects add constraint projects_data_size check (octet_length(data::text) <= 5000000);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.projects add constraint projects_name_size check (char_length(name) <= 120);
exception when duplicate_object then null; end $$;

-- Seuls champs du profil modifiables par le client : longueurs bornées.
do $$ begin
  alter table public.profiles add constraint profiles_name_size check (full_name is null or char_length(full_name) <= 120);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.profiles add constraint profiles_avatar_size check (avatar_url is null or char_length(avatar_url) <= 1000);
exception when duplicate_object then null; end $$;
