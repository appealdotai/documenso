-- AlterTable
ALTER TABLE "Field" ADD COLUMN "order" INTEGER NOT NULL DEFAULT 0;

-- Backfill stacking order from creation order so the current paint order
-- (array/insertion order, later = on top) is preserved exactly.
WITH ranked AS (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "envelopeId" ORDER BY "id" ASC) - 1 AS "rn"
  FROM "Field"
)
UPDATE "Field" AS f
SET "order" = ranked."rn"
FROM ranked
WHERE f."id" = ranked."id";
