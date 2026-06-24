-- ACS TherapyHub — Correct PM-dropped appointment times (2026-06-24)
--
-- PURPOSE
--   Eight group sessions were booked for the evening but stored in the morning by the
--   old write path: ScheduleSessionModal formatted the time to 12-hour "06:00 PM", and
--   combineDateAndTime's split(':') dropped the meridiem -> 18:00 stored as 06:00. The
--   code is now fixed (config/time.ts is the single source of truth); this corrects the
--   8 historical rows that path already mis-stored.
--
-- TRANSFORMATION: + 12 hours on start_time AND end_time (reverses the hour-12 drop).
--   06:00-08:00 Central -> 18:00-20:00 Central (6-8 PM).
--
-- SCOPE — exactly these 8 ids (Group A: 6 Bill/Karen-demo SATOP; Group B: 2 David Wed):
--   Approved by Dan 2026-06-24. Deliberately EXCLUDED and left untouched:
--     • Group C (malformed/ambiguous): cf2fb3de (Gambling 03:00), cb7859ae (08:00 zero-dur),
--       the 2026-02-19 04:30 end-NULL outlier.
--     • ~145 Karen accrual-seed rows at :04/:34 (individual fixtures backing compliance).
--     • David's correct 09:00-12:00 canonical-group rows.
--
-- ACCRUAL: untouched. client_accrued_hours counts by service_type/status, not time-of-day.
--
-- IDEMPOTENT: the AM guard (Central hour < 12) means a second run is a no-op once the rows
--   are at 18:00. SAFE: never double-shifts.
-- REVERTIBLE:
--   update public.appointments
--      set start_time = start_time - interval '12 hours',
--          end_time   = end_time   - interval '12 hours',
--          updated_at = now()
--    where id in (
--      '80a5ba51-6042-4fdc-9433-24487f692f4a','6433ae1e-f6c6-402c-90b1-96081b1d2ff5',
--      '14c2e80d-c194-4b0b-8b23-542a2beb4809','b4840c6f-2abf-41ec-9bc2-acb464b9d1e4',
--      '428f5a4a-6392-4126-a1e3-6118dea937e8','2d1106d1-1dc0-4573-9c91-3c06bb759b38',
--      '697398a6-93f4-40cb-92ef-41b1617c9912','d9cbed6f-514d-459d-a6fc-f01ef97d7a1b')
--      and extract(hour from start_time at time zone 'America/Chicago') >= 12;

update public.appointments
   set start_time = start_time + interval '12 hours',
       end_time   = end_time   + interval '12 hours',
       updated_at = now()
 where id in (
     '80a5ba51-6042-4fdc-9433-24487f692f4a',  -- Bill   Sat 4/18
     '6433ae1e-f6c6-402c-90b1-96081b1d2ff5',  -- Bill   Mon 4/20
     '14c2e80d-c194-4b0b-8b23-542a2beb4809',  -- Bill   Thu 5/14
     'b4840c6f-2abf-41ec-9bc2-acb464b9d1e4',  -- Bill   Fri 5/15
     '428f5a4a-6392-4126-a1e3-6118dea937e8',  -- Bill   Sat 5/16
     '2d1106d1-1dc0-4573-9c91-3c06bb759b38',  -- Karen (Demo) Sun 6/14
     '697398a6-93f4-40cb-92ef-41b1617c9912',  -- David  Wed 6/17
     'd9cbed6f-514d-459d-a6fc-f01ef97d7a1b'   -- David  Wed 6/17
   )
   -- AM guard: only shift rows still stored in the morning (idempotent / no double-shift).
   and extract(hour from start_time at time zone 'America/Chicago') < 12;
