-- Beta application review state.
-- Apply once to the marketing database in BETA_DATABASE_URL after 001_beta_application.sql.
--
--   psql "$BETA_DATABASE_URL" -f docs/marketing-db/002_beta_application_review.sql
--
-- The beta app reads and updates this table through MARKETING_DATABASE_URL.
-- The marketing site keeps inserting applications unchanged because the new
-- columns have defaults.

ALTER TABLE beta_application
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by text;

CREATE INDEX IF NOT EXISTS beta_application_status_created_at_idx
  ON beta_application (status, created_at DESC);
