CREATE TABLE public.upload_fingerprints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  purpose text NOT NULL DEFAULT 'avatar',
  storage_path text NOT NULL,
  sha256 text NOT NULL,
  phash text NOT NULL,
  byte_size integer NOT NULL,
  width integer NOT NULL,
  height integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT upload_fingerprints_sha256_format CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT upload_fingerprints_phash_format CHECK (phash ~ '^[0-9a-f]{16}$'),
  CONSTRAINT upload_fingerprints_purpose CHECK (purpose IN ('avatar'))
);

COMMENT ON TABLE public.upload_fingerprints IS 'Moderation record of every accepted upload: exact (sha256) and perceptual (64-bit dHash) fingerprints. Kept after the file is replaced.';

CREATE INDEX upload_fingerprints_sha256_idx ON public.upload_fingerprints (sha256);
CREATE INDEX upload_fingerprints_phash_idx ON public.upload_fingerprints (phash);
CREATE INDEX upload_fingerprints_user_idx ON public.upload_fingerprints (user_id, created_at DESC);

-- Moderation-only data: written and read by the server, never by app users.
GRANT ALL ON public.upload_fingerprints TO service_role;

ALTER TABLE public.upload_fingerprints ENABLE ROW LEVEL SECURITY;