-- Pre-wash checklist progressive disclosure: the full illustrated 4-step
-- carousel for a student's first few washes, collapsing to a single
-- quick-confirm row once they've passed prewash_full_checklist_threshold
-- confirmed starts. The mobile client decides which variant to render;
-- this migration only owns the counter and the threshold it's compared
-- against.

-- Server-authoritative "how many washes has this student actually
-- started" counter. Not check(>= 0) or trigger-protected the way
-- no_show_count is -- see the comment on the increment below for why a
-- student being able to nudge their own value isn't worth guarding
-- against here.
alter table public.students add column prewash_checklist_count integer not null default 0;

-- Same effective-dating pattern as booking_fee/flash_slot_premium/
-- wash_price -- super-admin editable, takes effect for future reads
-- without an app update, and old values aren't retroactively disturbed.
alter table public.pricing_config drop constraint pricing_config_key_check;
alter table public.pricing_config add constraint pricing_config_key_check
  check (key in ('booking_fee', 'flash_slot_premium', 'wash_price', 'prewash_full_checklist_threshold'));

insert into public.pricing_config (key, value) values ('prewash_full_checklist_threshold', 3);

-- Both wash-start entrypoints increment the counter in the same
-- transaction as the state transition they perform -- there's no
-- separate client call to skip, and no path that increments without a
-- real, successful start (an abandoned checklist just never calls the
-- RPC at all; a retry after a transient network failure re-hits the
-- "booking not active" / "already have an active booking" guards below
-- rather than incrementing twice).
--
-- This column is deliberately NOT added to
-- enforce_student_update_permissions' student-forbidden list the way
-- no_show_count is: that trigger can't distinguish "this RPC's own
-- trusted UPDATE" from "the student PATCHing their own row directly" --
-- both run with the student's own auth.uid(), unlike the scheduler jobs
-- which run with none. Blocking the field would break these RPCs' own
-- increment. Unlike no_show_count, gaming this value has no financial or
-- safety consequence -- the confirmation checkbox is still mandatory on
-- both checklist variants either way -- so it isn't worth the added
-- complexity of a session-flag or similar bypass mechanism.
create or replace function public.start_instant_wash(p_machine_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_id uuid := auth.uid();
  v_student public.students;
  v_machine public.machines;
  v_wash_price numeric(10, 2);
  v_booking public.bookings;
begin
  if v_student_id is null then
    raise exception 'authentication required';
  end if;

  select * into v_student from public.students where id = v_student_id;
  if v_student is null then
    raise exception 'student profile not found';
  end if;
  if v_student.account_status <> 'active' then
    raise exception 'account is suspended';
  end if;
  if exists (
    select 1 from public.bookings
    where student_id = v_student_id and status in ('active', 'started')
  ) then
    raise exception 'you already have an active booking';
  end if;

  select * into v_machine from public.machines where id = p_machine_id for update;
  if v_machine is null then
    raise exception 'machine not found';
  end if;
  if v_machine.hostel_id <> v_student.hostel_id then
    raise exception 'machine is not at your hostel';
  end if;
  if v_machine.status <> 'free' then
    raise exception 'machine is not free';
  end if;
  if exists (select 1 from public.flash_slots where machine_id = p_machine_id and status = 'open') then
    raise exception 'machine has an open flash slot -- claim it instead';
  end if;

  select value into v_wash_price
  from public.pricing_config
  where key = 'wash_price'
    and effective_from <= now()
    and (effective_to is null or effective_to > now());

  -- TODO(1.4): take payment here (wallet-first, UPI top-up for the
  -- remainder) before this insert -- see the comment above.

  insert into public.bookings (
    student_id, machine_id, booking_type, status,
    slot_start, slot_end, start_deadline, started_at,
    booking_fee, fee_applied_to_wash
  ) values (
    v_student_id, p_machine_id, 'instant', 'started',
    now(), now() + interval '45 minutes', now() + interval '7 minutes', now(),
    coalesce(v_wash_price, 30.00), true
  ) returning * into v_booking;

  update public.students set prewash_checklist_count = prewash_checklist_count + 1 where id = v_student_id;

  return v_booking;
end;
$$;

create or replace function public.start_booking(p_booking_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_id uuid := auth.uid();
  v_booking public.bookings;
begin
  if v_student_id is null then
    raise exception 'authentication required';
  end if;

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if v_booking is null or v_booking.student_id <> v_student_id then
    raise exception 'booking not found';
  end if;
  if v_booking.status <> 'active' then
    raise exception 'booking is not active';
  end if;
  if now() > v_booking.start_deadline then
    raise exception 'start window has passed';
  end if;

  update public.bookings
  set status = 'started', started_at = now(), fee_applied_to_wash = true
  where id = p_booking_id
  returning * into v_booking;

  update public.students set prewash_checklist_count = prewash_checklist_count + 1 where id = v_student_id;

  return v_booking;
end;
$$;
