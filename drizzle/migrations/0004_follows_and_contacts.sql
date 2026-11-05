-- Helper: is this profile a finished, visible account? (bypasses owner-only profile RLS)
CREATE OR REPLACE FUNCTION public.is_onboarded_profile(_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _id AND onboarded);
$$;
REVOKE EXECUTE ON FUNCTION public.is_onboarded_profile(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_onboarded_profile(uuid) TO authenticated;

-- Helper: is this storage object someone's current profile photo?
CREATE OR REPLACE FUNCTION public.is_current_avatar(_path text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE avatar_path = _path AND onboarded);
$$;
REVOKE EXECUTE ON FUNCTION public.is_current_avatar(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_current_avatar(text) TO authenticated;

CREATE TABLE public.follows (
  follower_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),
  CONSTRAINT follows_no_self CHECK (follower_id <> following_id)
);
CREATE INDEX follows_following_idx ON public.follows (following_id, follower_id);

GRANT SELECT, INSERT, DELETE ON public.follows TO authenticated;
GRANT ALL ON public.follows TO service_role;

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see follows that involve them"
  ON public.follows FOR SELECT TO authenticated
  USING (auth.uid() = follower_id OR auth.uid() = following_id);

CREATE POLICY "Users follow others as themselves"
  ON public.follows FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = follower_id
    AND public.is_onboarded_profile(follower_id)
    AND public.is_onboarded_profile(following_id)
  );

CREATE POLICY "Users unfollow as themselves"
  ON public.follows FOR DELETE TO authenticated
  USING (auth.uid() = follower_id);

-- Signed-in users may view anyone's current profile photo (old photos stay private).
CREATE POLICY "Signed-in users can read current avatars"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'avatars' AND public.is_current_avatar(name));

-- Paged contact list for the signed-in user.
CREATE OR REPLACE FUNCTION public.list_contacts(
  _tab text DEFAULT 'all',
  _search text DEFAULT '',
  _limit integer DEFAULT 20,
  _offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  full_name text,
  username text,
  avatar_path text,
  country text,
  i_follow boolean,
  follows_me boolean
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE
  me uuid := auth.uid();
  my_country text;
  q text := left(btrim(coalesce(_search, '')), 40);
  lim integer := least(greatest(coalesce(_limit, 20), 1), 50);
  off integer := least(greatest(coalesce(_offset, 0), 0), 10000);
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;
  IF _tab NOT IN ('all', 'suggestions', 'followers', 'following', 'friends') THEN
    RAISE EXCEPTION 'invalid tab' USING ERRCODE = '22023';
  END IF;

  SELECT pr.country INTO my_country FROM public.profiles pr WHERE pr.id = me;
  q := replace(replace(replace(q, '\', '\\'), '%', '\%'), '_', '\_');

  RETURN QUERY
  SELECT p.id, p.full_name, p.username, p.avatar_path, p.country,
         (f1.follower_id IS NOT NULL), (f2.follower_id IS NOT NULL)
  FROM public.profiles p
  LEFT JOIN public.follows f1 ON f1.follower_id = me AND f1.following_id = p.id
  LEFT JOIN public.follows f2 ON f2.follower_id = p.id AND f2.following_id = me
  WHERE p.onboarded
    AND p.id <> me
    AND (q = '' OR p.username ILIKE '%' || q || '%' OR p.full_name ILIKE '%' || q || '%')
    AND CASE _tab
          WHEN 'suggestions' THEN f1.follower_id IS NULL
          WHEN 'followers' THEN f2.follower_id IS NOT NULL
          WHEN 'following' THEN f1.follower_id IS NOT NULL
          WHEN 'friends' THEN f1.follower_id IS NOT NULL AND f2.follower_id IS NOT NULL
          ELSE true
        END
  ORDER BY
    CASE WHEN _tab = 'suggestions' AND f2.follower_id IS NOT NULL THEN 0 ELSE 1 END,
    CASE WHEN _tab = 'suggestions' AND p.country = my_country THEN 0 ELSE 1 END,
    CASE
      WHEN _tab = 'followers' THEN f2.created_at
      WHEN _tab IN ('following', 'friends') THEN f1.created_at
      ELSE NULL
    END DESC NULLS LAST,
    lower(p.full_name),
    p.id
  LIMIT lim OFFSET off;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.list_contacts(text, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_contacts(text, text, integer, integer) TO authenticated;

-- Follower / following / friend totals for the signed-in user.
CREATE OR REPLACE FUNCTION public.contact_counts()
RETURNS TABLE (followers bigint, following bigint, friends bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    (SELECT count(*) FROM public.follows f JOIN public.profiles p ON p.id = f.follower_id AND p.onboarded
       WHERE f.following_id = auth.uid()),
    (SELECT count(*) FROM public.follows f JOIN public.profiles p ON p.id = f.following_id AND p.onboarded
       WHERE f.follower_id = auth.uid()),
    (SELECT count(*) FROM public.follows a
       JOIN public.follows b ON b.follower_id = a.following_id AND b.following_id = a.follower_id
       JOIN public.profiles p ON p.id = a.following_id AND p.onboarded
       WHERE a.follower_id = auth.uid());
$$;
REVOKE EXECUTE ON FUNCTION public.contact_counts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contact_counts() TO authenticated;