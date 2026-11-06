-- Upload slots handed out by the server; files land in staging under a server-chosen name.
CREATE TABLE public.media_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('photo', 'video', 'cover')),
  staging_path text NOT NULL UNIQUE,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX media_uploads_user_idx ON public.media_uploads (user_id, created_at DESC);
GRANT ALL ON public.media_uploads TO service_role;
ALTER TABLE public.media_uploads ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('text', 'photo', 'video')),
  body text NOT NULL DEFAULT '' CHECK (char_length(body) <= 2200),
  text_style jsonb,
  song jsonb,
  mute_original boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX posts_author_idx ON public.posts (author_id, created_at DESC);
CREATE INDEX posts_created_idx ON public.posts (created_at DESC);

CREATE TABLE public.post_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  position smallint NOT NULL DEFAULT 0,
  kind text NOT NULL CHECK (kind IN ('photo', 'video', 'cover')),
  storage_path text NOT NULL UNIQUE,
  width integer NOT NULL,
  height integer NOT NULL,
  byte_size integer NOT NULL,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX post_media_post_idx ON public.post_media (post_id, position);

CREATE TABLE public.post_people_tags (
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, user_id)
);
CREATE INDEX post_people_tags_user_idx ON public.post_people_tags (user_id);

CREATE TABLE public.hashtags (
  tag text PRIMARY KEY CHECK (tag ~ '^[a-z0-9_]{1,30}$'),
  post_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX hashtags_prefix_idx ON public.hashtags (tag text_pattern_ops);
CREATE INDEX hashtags_popular_idx ON public.hashtags (post_count DESC);

CREATE TABLE public.post_hashtags (
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  tag text NOT NULL REFERENCES public.hashtags(tag) ON DELETE CASCADE,
  PRIMARY KEY (post_id, tag)
);
CREATE INDEX post_hashtags_tag_idx ON public.post_hashtags (tag);

-- Moderation: one perceptual + exact fingerprint per video keyframe.
CREATE TABLE public.video_frame_fingerprints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  storage_path text NOT NULL,
  frame_index integer NOT NULL,
  time_ms integer NOT NULL,
  sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  phash text NOT NULL CHECK (phash ~ '^[0-9a-f]{16}$'),
  width integer NOT NULL,
  height integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX video_frame_fp_phash_idx ON public.video_frame_fingerprints (phash);
CREATE INDEX video_frame_fp_path_idx ON public.video_frame_fingerprints (storage_path, frame_index);
GRANT ALL ON public.video_frame_fingerprints TO service_role;
ALTER TABLE public.video_frame_fingerprints ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.upload_fingerprints DROP CONSTRAINT upload_fingerprints_purpose;
ALTER TABLE public.upload_fingerprints ADD CONSTRAINT upload_fingerprints_purpose
  CHECK (purpose IN ('avatar', 'post_photo', 'post_video', 'post_cover'));

-- Posts are written only by the server after it has checked every file.
GRANT SELECT ON public.posts, public.post_media, public.post_people_tags, public.hashtags, public.post_hashtags TO authenticated;
GRANT ALL ON public.posts, public.post_media, public.post_people_tags, public.hashtags, public.post_hashtags TO service_role;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_people_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hashtags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_hashtags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users can read posts" ON public.posts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Signed-in users can read post media" ON public.post_media FOR SELECT TO authenticated USING (true);
CREATE POLICY "Signed-in users can read people tags" ON public.post_people_tags FOR SELECT TO authenticated USING (true);
CREATE POLICY "Signed-in users can read hashtags" ON public.hashtags FOR SELECT TO authenticated USING (true);
CREATE POLICY "Signed-in users can read post hashtags" ON public.post_hashtags FOR SELECT TO authenticated USING (true);

-- Server-only: create/bump hashtags in one statement.
CREATE OR REPLACE FUNCTION public.register_hashtags(_tags text[])
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.hashtags (tag, post_count, last_used_at)
  SELECT DISTINCT t, 1, now() FROM unnest(_tags) AS t
  ON CONFLICT (tag) DO UPDATE
    SET post_count = public.hashtags.post_count + 1, last_used_at = now();
$$;
REVOKE ALL ON FUNCTION public.register_hashtags(text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_hashtags(text[]) TO service_role;

-- Published post files are readable by signed-in users; staging files are not.
CREATE OR REPLACE FUNCTION public.is_post_media(_path text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.post_media WHERE storage_path = _path);
$$;
REVOKE ALL ON FUNCTION public.is_post_media(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_post_media(text) TO authenticated, service_role;

CREATE POLICY "Signed-in users can read published post files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'post-media' AND public.is_post_media(name));