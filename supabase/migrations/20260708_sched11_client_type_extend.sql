-- Scheduling build, step 11 — client_type 6->9(+6=15) token extension. NON-DESTRUCTIVE:
-- this migration is a pure CHECK-constraint widening. No UPDATE statement touches a single
-- row's client_type value. Live baseline (queried immediately before this migration):
--   SATOP=16, null=5, RELAPSE_PREVENTION=3, GAMBLING_RECOVERY=2, ANGER_MANAGEMENT=2, INDIVIDUAL=1
--
-- David's 7/7 client-type list: Series, EAP, CIP, SROP, DWI Court, OP, RP, REACT, Eval.
-- These 9 are ADDED to the existing 6 straw-man tokens (clients_client_type_check, migration
-- 20260629) -- the old 6 remain valid values, nothing is retired.
--
-- "RP maps clean" (Dan, 7/8): RELAPSE_PREVENTION is conceptually David's RP -- but per the
-- explicit non-destructive instruction (witness: "confirm ZERO rows blanked or value-changed"),
-- the 3 RELAPSE_PREVENTION rows are NOT remapped to the new 'RP' token. Both tokens are valid
-- simultaneously; config/clientType.ts labels RELAPSE_PREVENTION to visually associate it with
-- RP without touching stored data. A future migration can retire RELAPSE_PREVENTION once David
-- confirms the remap explicitly.
--
-- ANGER_MANAGEMENT, GAMBLING_RECOVERY, and the 5 null rows are NOT remapped either -- no
-- confident 1:1 mapping exists in David's 9-token list, so guessing would be exactly the
-- "remapped by guess" this migration is instructed not to do. They're flagged for in-app
-- review instead (config/clientType.ts needsClientTypeReview + ClientTypeBadge), not silently
-- left invisible.
--
-- Re-runnable: drop-if-exists before create.

alter table public.clients drop constraint if exists clients_client_type_check;

alter table public.clients add constraint clients_client_type_check
  check (
    client_type is null or client_type = any (array[
      -- existing 6 (migration 20260629) -- kept valid, unchanged
      'SATOP', 'DOT', 'RELAPSE_PREVENTION', 'ANGER_MANAGEMENT', 'GAMBLING_RECOVERY', 'INDIVIDUAL',
      -- David's 7/7 additions
      'SERIES', 'EAP', 'CIP', 'SROP', 'DWI_COURT', 'OP', 'RP', 'REACT', 'EVAL'
    ])
  );

-- REVERT (restores the exact 20260629 6-token CHECK; safe only if no row has taken a new token):
--   alter table public.clients drop constraint if exists clients_client_type_check;
--   alter table public.clients add constraint clients_client_type_check
--     check (client_type is null or client_type = any (array[
--       'SATOP','DOT','RELAPSE_PREVENTION','ANGER_MANAGEMENT','GAMBLING_RECOVERY','INDIVIDUAL'
--     ]));
