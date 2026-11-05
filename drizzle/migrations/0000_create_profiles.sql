CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  username text,
  country text,
  location text,
  bio text,
  avatar_path text,
  onboarded boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profiles_full_name_len CHECK (full_name IS NULL OR char_length(full_name) BETWEEN 2 AND 60),
  CONSTRAINT profiles_username_format CHECK (username IS NULL OR username ~ '^[a-z][a-z0-9_]{2,19}$'),
  CONSTRAINT profiles_country_len CHECK (country IS NULL OR char_length(country) BETWEEN 2 AND 60),
  CONSTRAINT profiles_location_len CHECK (location IS NULL OR char_length(location) BETWEEN 2 AND 80),
  CONSTRAINT profiles_bio_len CHECK (bio IS NULL OR char_length(bio) <= 160),
  CONSTRAINT profiles_avatar_path_format CHECK (avatar_path IS NULL OR avatar_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$')
);

CREATE UNIQUE INDEX profiles_username_unique ON public.profiles (lower(username)) WHERE username IS NOT NULL;

GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  raw_name text;
BEGIN
  raw_name := left(btrim(coalesce(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', '')), 60);
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, CASE WHEN char_length(raw_name) >= 2 THEN raw_name ELSE NULL END)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.is_username_available(_username text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE lower(username) = lower(_username)
      AND id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_username_available(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_username_available(text) TO authenticated;