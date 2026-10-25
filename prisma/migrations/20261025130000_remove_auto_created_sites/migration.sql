-- Remove pending sites created automatically by the old install flow.
-- A real import creates a FIRST_BUILD job in the same transaction as the site.

DELETE FROM "Site" AS s
WHERE s."status" = 'PENDING'
  AND NOT EXISTS (
    SELECT 1 FROM "Page" AS p WHERE p."siteId" = s."id"
  )
  AND NOT EXISTS (
    SELECT 1
    FROM "Job" AS j
    WHERE j."repoId" = s."repoId" AND j."kind" = 'FIRST_BUILD'
  );
