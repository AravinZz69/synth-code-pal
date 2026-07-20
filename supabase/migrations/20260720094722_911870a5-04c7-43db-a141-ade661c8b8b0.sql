
ALTER TABLE public.repositories
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS workflow text;

-- Ensure github_tokens has one row per user (needed for OAuth flow upsert)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'github_tokens_user_id_key' AND conrelid = 'public.github_tokens'::regclass
  ) THEN
    ALTER TABLE public.github_tokens ADD CONSTRAINT github_tokens_user_id_key UNIQUE (user_id);
  END IF;
END $$;

ALTER TABLE public.github_tokens
  ADD COLUMN IF NOT EXISTS github_login text,
  ADD COLUMN IF NOT EXISTS github_id bigint;
