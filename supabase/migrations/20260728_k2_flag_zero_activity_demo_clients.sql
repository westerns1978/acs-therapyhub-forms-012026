-- K2 (2026-07-28): clear the J3 stop-list via ONE new safe predicate —
-- PROVENANCE, not names: a candidate row with ZERO real clinical activity
-- (no placement determination, no clinical notes, no payments, no completed
-- appointments) is demo. A real client with no activity of any kind isn't a
-- compliance risk either way, so the false-positive cost is near-zero.
--
-- Dry-run SELECT (predicate over the full is_demo=false population, printed
-- in-session 2026-07-28) matched EXACTLY these 5 rows — all of them J3
-- stop-list members, no other row caught:
--   df7568d1-55bf-44d1-9b33-8b83ebd38a93  (prospect 2026-06-17, front-door /intake)
--   4a77739e-11ba-4c56-be9b-3d01324544ad  (active   2026-07-14, staff-walk batch)
--   df2e0d21-8363-4cf5-944a-14627980cb87  (active   2026-07-15, staff-walk batch)
--   6cbbf0d6-2d26-4c95-842b-cb68cf0c54a6  (active   2026-07-15, staff-walk batch)
--   7e7681e4-f5a2-4675-8a50-85c5ae777679  (active   2026-07-15, staff-walk batch)
--
-- Ids are PINNED (J3 convention) so the migration can never catch a row the
-- dry run didn't show. NO deletes; rows stay queryable via the per-user "Show demo
-- data" setting (Settings) through
-- config/demoData.ts applyDemoFilter().
--
-- STILL HELD (real clinical activity — human call, not auto-flagged):
--   4ebd1879 ($250 succeeded Stripe payment w/ stripe_event_id),
--   dd9098b2 (SIGNED level-III determination + DAP note + 11 form submissions),
--   cd24234c (4 session notes, 3 signed).
--
-- DOWN-PATH (exact reverse; these 5 rows were is_demo=false before this ran):
--   UPDATE clients SET is_demo = false WHERE id IN (
--     'df7568d1-55bf-44d1-9b33-8b83ebd38a93',
--     '4a77739e-11ba-4c56-be9b-3d01324544ad',
--     'df2e0d21-8363-4cf5-944a-14627980cb87',
--     '6cbbf0d6-2d26-4c95-842b-cb68cf0c54a6',
--     '7e7681e4-f5a2-4675-8a50-85c5ae777679');

UPDATE clients SET is_demo = true
WHERE id IN (
  'df7568d1-55bf-44d1-9b33-8b83ebd38a93',
  '4a77739e-11ba-4c56-be9b-3d01324544ad',
  'df2e0d21-8363-4cf5-944a-14627980cb87',
  '6cbbf0d6-2d26-4c95-842b-cb68cf0c54a6',
  '7e7681e4-f5a2-4675-8a50-85c5ae777679'
) AND is_demo = false;
