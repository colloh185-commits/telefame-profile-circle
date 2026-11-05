ALTER TABLE public.profiles DROP CONSTRAINT profiles_avatar_path_format;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_avatar_path_format
  CHECK (avatar_path IS NULL OR avatar_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(webp|jpg|png)$');