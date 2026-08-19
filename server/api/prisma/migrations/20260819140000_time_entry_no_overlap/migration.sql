-- VAL-32: no employee may hold two overlapping time entries.
--
-- The service checks for a clash and then writes, which two concurrent requests
-- can both pass before either commits — a double-clicked submit stores the day
-- twice. The invariant every later read depends on (day totals, the monthly
-- view, payroll) cannot be maintained by a check-then-act in application code,
-- so it is enforced here instead.
--
-- `btree_gist` is what lets a plain equality column (user_id) share a GiST index
-- with a range operator.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Half-open ranges: '[)' makes an entry ending at 12:00 and one starting at
-- 12:00 adjacent rather than overlapping, matching `intervalsOverlap` in
-- contracts, which treats touching boundaries as non-overlapping.
--
-- `tsrange`, not `tstzrange`: start_at/end_at are TIMESTAMP(3) (Prisma DateTime
-- without @db.Timestamptz). tstzrange() would cast timestamp → timestamptz,
-- which depends on the session TimeZone and is STABLE, so Postgres rejects the
-- index with "functions in index expression must be marked IMMUTABLE".
--
-- Restricted to live, completed entries. A soft-deleted row must not block its
-- own slot being re-reported, and a running entry has no end instant to bound a
-- range with — the Punch Clock epic enforces its own single-timer rule (VAL-37).
ALTER TABLE "time_entries"
  ADD CONSTRAINT "time_entries_no_overlap"
  EXCLUDE USING gist (
    "user_id" WITH =,
    tsrange("start_at", "end_at", '[)') WITH &&
  )
  WHERE ("deleted_at" IS NULL AND "end_at" IS NOT NULL);
