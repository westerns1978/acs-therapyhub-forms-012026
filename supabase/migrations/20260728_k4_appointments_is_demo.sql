-- K4 (2026-07-28): give `appointments` its own is_demo flag so the calendar can
-- stop rendering sessions for clients the client list no longer shows.
--
-- WHY A COLUMN AND NOT A JOIN: appointments.client_id is TEXT with no FK
-- (SECURITY_BACKLOG #7). A join-based filter would have to cast + regex every
-- read, and would silently drop the 27 rows whose client_id resolves to nothing.
-- A real column keeps the filter identical in shape to the clients one
-- (`.eq('is_demo', false)` via config/demoData.ts applyDemoFilter).
--
-- POPULATION AT WRITE TIME (262 rows, printed in-session):
--   226  uuid-shaped client_id owned by an is_demo client   -> FLAGGED here
--     9  uuid-shaped client_id owned by the REAL client     -> stay visible
--    15  legacy non-uuid text ids ('demo-alex-r' etc.)      -> LEFT UNFLAGGED
--    12  null/empty client_id (group-session shells)        -> LEFT UNFLAGGED
-- The last two groups are the "27 non-matching" rows; per instruction they are
-- printed and left alone, NOT swept. NOTE FOR THE NEXT PASS: 15 of those 27
-- carry a literal 'demo-' prefix in client_id and would be trivially flaggable
-- with a P7 predicate; until that call is made they still render on the board.
-- The 12 null/empty rows are genuine group slots with no individual client and
-- should probably stay visible regardless.
--
-- The flag is DERIVED FROM THE OWNING CLIENT, never set independently. That is
-- what makes this safe for the compliance surfaces: a real client's
-- appointments can never be flagged, so `client_accrued_hours` (which is
-- clients-driven SQL and does not read this column at all) cannot move, and no
-- client can be pushed non-compliant by hiding rows.
--
-- DOWN-PATH (no deletes anywhere):
--   DROP TRIGGER IF EXISTS trg_appointments_is_demo ON public.appointments;
--   DROP FUNCTION IF EXISTS public.appointments_inherit_is_demo();
--   ALTER TABLE public.appointments DROP COLUMN IF EXISTS is_demo;

-- 1 ─ column
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

-- 2 ─ backfill from the owning client (idempotent; re-runnable after any later
--     clients.is_demo change, which this trigger deliberately does NOT cascade)
UPDATE public.appointments a
SET is_demo = true
WHERE a.is_demo = false
  AND a.client_id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  AND EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id::text = a.client_id AND c.is_demo
  );

-- 3 ─ trigger: inherit the owning client's flag on INSERT, and on any re-parent.
--     Without this the relative-to-now() `dee0…` demo re-seed (migration
--     20260608 / 20260714) would regenerate demo appointments with is_demo=false
--     and the one-time backfill above would be stale the moment it is re-run.
CREATE OR REPLACE FUNCTION public.appointments_inherit_is_demo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.client_id IS NOT NULL
     AND NEW.client_id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  THEN
    SELECT COALESCE(c.is_demo, false) INTO NEW.is_demo
    FROM public.clients c
    WHERE c.id::text = NEW.client_id;
    -- No matching client (legacy/orphan id) -> leave whatever was supplied.
    IF NOT FOUND THEN
      NEW.is_demo := COALESCE(NEW.is_demo, false);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_appointments_is_demo ON public.appointments;
CREATE TRIGGER trg_appointments_is_demo
  BEFORE INSERT OR UPDATE OF client_id ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.appointments_inherit_is_demo();
