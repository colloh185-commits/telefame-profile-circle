-- Reactions, saves, reposts, shares, hides, reports and blocks for the feed.
CREATE TABLE public.post_likes (
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
CREATE INDEX post_likes_user_idx ON public.post_likes (user_id, created_at DESC);

CREATE TABLE public.post_favorites (
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
CREATE INDEX post_favorites_user_idx ON public.post_favorites (user_id, created_at DESC);

CREATE TABLE public.post_reposts (
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
CREATE INDEX post_reposts_user_idx ON public.post_reposts (user_id, created_at DESC);

CREATE TABLE public.post_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('copy','native','whatsapp','telegram','x','facebook','messenger','email','sms','reddit')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX post_shares_post_idx ON public.post_shares (post_id, user_id);

CREATE TABLE public.post_not_interested (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);

CREATE TABLE public.post_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (reason IN ('spam','nudity','violence','harassment','hate','false_info','scam','other')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, reporter_id)
);

CREATE TABLE public.user_blocks (
  blocker_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CONSTRAINT user_blocks_no_self CHECK (blocker_id <> blocked_id)
);
CREATE INDEX user_blocks_blocked_idx ON public.user_blocks (blocked_id, blocker_id);

GRANT SELECT, INSERT, DELETE ON public.post_likes, public.post_favorites, public.post_reposts, public.post_not_interested, public.user_blocks TO authenticated;
GRANT INSERT ON public.post_shares, public.post_reports TO authenticated;
GRANT ALL ON public.post_likes, public.post_favorites, public.post_reposts, public.post_shares, public.post_not_interested, public.post_reports, public.user_blocks TO service_role;

ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_reposts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_not_interested ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

-- Helpers (security definer so they can see rows hidden from the caller).
CREATE OR REPLACE FUNCTION public.is_blocked_pair(_other uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_blocks
    WHERE (blocker_id = auth.uid() AND blocked_id = _other)
       OR (blocker_id = _other AND blocked_id = auth.uid())
  );
$$;
REVOKE EXECUTE ON FUNCTION public.is_blocked_pair(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_blocked_pair(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_see_post(_post uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.posts p
    JOIN public.profiles a ON a.id = p.author_id AND a.onboarded
    WHERE p.id = _post AND NOT public.is_blocked_pair(p.author_id)
  );
$$;
REVOKE EXECUTE ON FUNCTION public.can_see_post(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_see_post(uuid) TO authenticated;

-- Own-row policies.
CREATE POLICY "Users see their likes" ON public.post_likes FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users like visible posts" ON public.post_likes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.is_onboarded_profile(user_id) AND public.can_see_post(post_id));
CREATE POLICY "Users remove their likes" ON public.post_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users see their favorites" ON public.post_favorites FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users save visible posts" ON public.post_favorites FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.is_onboarded_profile(user_id) AND public.can_see_post(post_id));
CREATE POLICY "Users remove their favorites" ON public.post_favorites FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users see their reposts" ON public.post_reposts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users repost visible posts" ON public.post_reposts FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND public.is_onboarded_profile(user_id) AND public.can_see_post(post_id)
    AND NOT EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.author_id = auth.uid())
  );
CREATE POLICY "Users undo their reposts" ON public.post_reposts FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users record their shares" ON public.post_shares FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.can_see_post(post_id));

CREATE POLICY "Users see their hidden posts" ON public.post_not_interested FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users hide visible posts" ON public.post_not_interested FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.can_see_post(post_id));
CREATE POLICY "Users unhide posts" ON public.post_not_interested FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users report visible posts" ON public.post_reports FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reporter_id AND public.can_see_post(post_id));

CREATE POLICY "Users see who they blocked" ON public.user_blocks FOR SELECT TO authenticated USING (auth.uid() = blocker_id);
CREATE POLICY "Users unblock" ON public.user_blocks FOR DELETE TO authenticated USING (auth.uid() = blocker_id);

-- Blocked pairs can't follow each other or read each other's posts.
DROP POLICY "Users follow others as themselves" ON public.follows;
CREATE POLICY "Users follow others as themselves" ON public.follows FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = follower_id
    AND public.is_onboarded_profile(follower_id)
    AND public.is_onboarded_profile(following_id)
    AND NOT public.is_blocked_pair(following_id)
  );

DROP POLICY "Signed-in users can read posts" ON public.posts;
CREATE POLICY "Signed-in users can read posts" ON public.posts FOR SELECT TO authenticated
  USING (author_id = auth.uid() OR NOT public.is_blocked_pair(author_id));

-- Block: record it and drop follows in both directions.
CREATE OR REPLACE FUNCTION public.block_user(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid();
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501'; END IF;
  IF _id IS NULL OR _id = me OR NOT public.is_onboarded_profile(_id) THEN
    RAISE EXCEPTION 'invalid user' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.user_blocks (blocker_id, blocked_id) VALUES (me, _id) ON CONFLICT DO NOTHING;
  DELETE FROM public.follows
   WHERE (follower_id = me AND following_id = _id) OR (follower_id = _id AND following_id = me);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.block_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.block_user(uuid) TO authenticated;

-- Server-only: lower hashtag counts when a post is edited or deleted.
CREATE OR REPLACE FUNCTION public.unregister_hashtags(_tags text[])
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.hashtags SET post_count = greatest(post_count - 1, 0) WHERE tag = ANY(_tags);
$$;
REVOKE ALL ON FUNCTION public.unregister_hashtags(text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.unregister_hashtags(text[]) TO service_role;

-- One post as the JSON card the feed renders. Internal: called by the feed functions only.
CREATE OR REPLACE FUNCTION public.post_card(_id uuid, _me uuid, _via uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'id', p.id,
    'kind', p.kind,
    'body', p.body,
    'textStyle', p.text_style,
    'song', p.song,
    'muteOriginal', p.mute_original,
    'createdAt', p.created_at,
    'author', jsonb_build_object('id', a.id, 'name', a.full_name, 'username', a.username, 'avatarPath', a.avatar_path),
    'mine', p.author_id = _me,
    'iFollow', EXISTS (SELECT 1 FROM public.follows f WHERE f.follower_id = _me AND f.following_id = p.author_id),
    'likes', (SELECT count(*) FROM public.post_likes l WHERE l.post_id = p.id),
    'favorites', (SELECT count(*) FROM public.post_favorites l WHERE l.post_id = p.id),
    'reposts', (SELECT count(*) FROM public.post_reposts l WHERE l.post_id = p.id),
    'shares', (SELECT count(DISTINCT s.user_id) FROM public.post_shares s WHERE s.post_id = p.id),
    'liked', EXISTS (SELECT 1 FROM public.post_likes l WHERE l.post_id = p.id AND l.user_id = _me),
    'favorited', EXISTS (SELECT 1 FROM public.post_favorites l WHERE l.post_id = p.id AND l.user_id = _me),
    'reposted', EXISTS (SELECT 1 FROM public.post_reposts l WHERE l.post_id = p.id AND l.user_id = _me),
    'shared', EXISTS (SELECT 1 FROM public.post_shares s WHERE s.post_id = p.id AND s.user_id = _me),
    'media', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('kind', m.kind, 'path', m.storage_path, 'width', m.width,
                                          'height', m.height, 'durationMs', m.duration_ms) ORDER BY m.position, m.kind)
      FROM public.post_media m WHERE m.post_id = p.id), '[]'::jsonb),
    'hashtags', COALESCE((SELECT jsonb_agg(h.tag ORDER BY h.tag) FROM public.post_hashtags h WHERE h.post_id = p.id), '[]'::jsonb),
    'people', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', u.id, 'name', u.full_name, 'username', u.username, 'avatarPath', u.avatar_path))
      FROM public.post_people_tags t JOIN public.profiles u ON u.id = t.user_id AND u.onboarded
      WHERE t.post_id = p.id), '[]'::jsonb),
    'repostedBy', CASE WHEN _via IS NULL THEN NULL ELSE (
      SELECT jsonb_build_object('id', v.id, 'name', v.full_name, 'username', v.username)
      FROM public.profiles v WHERE v.id = _via) END
  )
  FROM public.posts p JOIN public.profiles a ON a.id = p.author_id
  WHERE p.id = _id;
$$;
REVOKE ALL ON FUNCTION public.post_card(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;

-- Feed pages: "for_you" = everyone, "following" = people you follow + what they repost.
CREATE OR REPLACE FUNCTION public.feed_posts(
  _tab text DEFAULT 'for_you', _before_at timestamptz DEFAULT NULL, _before_id uuid DEFAULT NULL, _limit integer DEFAULT 8)
RETURNS TABLE(sort_at timestamptz, post_id uuid, card jsonb)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE
  me uuid := auth.uid();
  lim integer := least(greatest(coalesce(_limit, 8), 1), 30);
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501'; END IF;
  IF _tab NOT IN ('for_you', 'following') THEN RAISE EXCEPTION 'invalid tab' USING ERRCODE = '22023'; END IF;

  RETURN QUERY
  WITH cand AS (
    SELECT p.id AS pid, p.created_at AS at, NULL::uuid AS via FROM public.posts p WHERE _tab = 'for_you'
    UNION ALL
    SELECT p.id, p.created_at, NULL::uuid FROM public.posts p
      JOIN public.follows f ON f.follower_id = me AND f.following_id = p.author_id
      WHERE _tab = 'following'
    UNION ALL
    SELECT r.post_id, r.created_at, r.user_id FROM public.post_reposts r
      JOIN public.follows f ON f.follower_id = me AND f.following_id = r.user_id
      WHERE _tab = 'following'
  ), best AS (
    SELECT DISTINCT ON (c.pid) c.pid, c.at, c.via FROM cand c ORDER BY c.pid, c.at DESC
  )
  SELECT b.at, b.pid, public.post_card(b.pid, me, b.via)
  FROM best b
  JOIN public.posts p ON p.id = b.pid
  JOIN public.profiles a ON a.id = p.author_id AND a.onboarded
  WHERE (_before_at IS NULL OR (b.at, b.pid) < (_before_at, _before_id))
    AND NOT EXISTS (SELECT 1 FROM public.post_not_interested n WHERE n.user_id = me AND n.post_id = b.pid)
    AND NOT EXISTS (SELECT 1 FROM public.user_blocks k
                    WHERE (k.blocker_id = me AND k.blocked_id = p.author_id)
                       OR (k.blocker_id = p.author_id AND k.blocked_id = me))
  ORDER BY b.at DESC, b.pid DESC
  LIMIT lim;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.feed_posts(text, timestamptz, uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.feed_posts(text, timestamptz, uuid, integer) TO authenticated;

-- Search posts by words, @people, #hashtags or song.
CREATE OR REPLACE FUNCTION public.search_posts(
  _q text DEFAULT '', _kind text DEFAULT 'all', _limit integer DEFAULT 18, _offset integer DEFAULT 0)
RETURNS TABLE(post_id uuid, card jsonb)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE
  me uuid := auth.uid();
  q text := left(btrim(coalesce(_q, '')), 60);
  is_tag boolean;
  needle text;
  lim integer := least(greatest(coalesce(_limit, 18), 1), 40);
  off integer := least(greatest(coalesce(_offset, 0), 0), 5000);
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501'; END IF;
  IF _kind NOT IN ('all', 'video', 'photo', 'text') THEN RAISE EXCEPTION 'invalid kind' USING ERRCODE = '22023'; END IF;
  is_tag := q LIKE '#%';
  needle := lower(regexp_replace(regexp_replace(q, '^[#@]+', ''), '\s+', ' ', 'g'));
  needle := replace(replace(replace(needle, '\', '\\'), '%', '\%'), '_', '\_');

  RETURN QUERY
  SELECT p.id, public.post_card(p.id, me, NULL)
  FROM public.posts p
  JOIN public.profiles a ON a.id = p.author_id AND a.onboarded
  WHERE (_kind = 'all' OR p.kind = _kind)
    AND NOT EXISTS (SELECT 1 FROM public.post_not_interested n WHERE n.user_id = me AND n.post_id = p.id)
    AND NOT EXISTS (SELECT 1 FROM public.user_blocks k
                    WHERE (k.blocker_id = me AND k.blocked_id = p.author_id)
                       OR (k.blocker_id = p.author_id AND k.blocked_id = me))
    AND (
      needle = ''
      OR (is_tag AND EXISTS (SELECT 1 FROM public.post_hashtags h WHERE h.post_id = p.id AND h.tag LIKE needle || '%'))
      OR (NOT is_tag AND (
        p.body ILIKE '%' || needle || '%'
        OR a.username ILIKE '%' || needle || '%'
        OR a.full_name ILIKE '%' || needle || '%'
        OR p.song->>'title' ILIKE '%' || needle || '%'
        OR p.song->>'artist' ILIKE '%' || needle || '%'
        OR EXISTS (SELECT 1 FROM public.post_hashtags h WHERE h.post_id = p.id AND h.tag LIKE '%' || replace(needle, ' ', '') || '%')
      ))
    )
  ORDER BY p.created_at DESC, p.id DESC
  LIMIT lim OFFSET off;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.search_posts(text, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_posts(text, text, integer, integer) TO authenticated;

-- A single post (shared links); null if missing or hidden by a block.
CREATE OR REPLACE FUNCTION public.get_post(_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid();
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501'; END IF;
  IF NOT public.can_see_post(_id) THEN RETURN NULL; END IF;
  RETURN public.post_card(_id, me, NULL);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.get_post(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_post(uuid) TO authenticated;

-- Contacts skip anyone in a block with you.
CREATE OR REPLACE FUNCTION public.list_contacts(_tab text DEFAULT 'all'::text, _search text DEFAULT ''::text, _limit integer DEFAULT 20, _offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, full_name text, username text, avatar_path text, country text, i_follow boolean, follows_me boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    AND NOT EXISTS (SELECT 1 FROM public.user_blocks k
                    WHERE (k.blocker_id = me AND k.blocked_id = p.id)
                       OR (k.blocker_id = p.id AND k.blocked_id = me))
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
$function$;