-- Story 1.6: notifications, built as one shared piece of infrastructure
-- (per CLAUDE.md's build order) rather than three separate ad-hoc systems.
-- notify_student() is the single insertion point every notification-firing
-- moment calls -- wash-complete and flash-slot triggers below, plus 1.9's
-- support-ticket-reply notification layered on top later without any new
-- table or client-side plumbing.
--
-- No FCM/push integration exists yet (CLAUDE.md's push layer) -- this is
-- the in-app half (notifications_log + realtime), which is the part that's
-- actually testable locally. A real push send is a TODO alongside every
-- other "real gateway" TODO already in this codebase, wired in wherever
-- notify_student() is called, not a structural change to it.

create table public.notifications_log (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id),
  type text not null check (type in ('wash_complete', 'flash_slot', 'support_reply')),
  title text not null,
  body text not null,
  related_booking_id uuid references public.bookings(id),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.notifications_log enable row level security;

create policy "notifications_select_self_or_super_admin"
  on public.notifications_log for select
  using (student_id = auth.uid() or public.is_super_admin());

-- A student may mark their own notification read, nothing else -- mirrors
-- students' own column-level enforcement trigger rather than trusting RLS
-- alone to express "only read_at".
create or replace function public.enforce_notification_read_only_update()
returns trigger
language plpgsql
as $$
begin
  if new.student_id is distinct from old.student_id
    or new.type is distinct from old.type
    or new.title is distinct from old.title
    or new.body is distinct from old.body
    or new.related_booking_id is distinct from old.related_booking_id
    or new.created_at is distinct from old.created_at
  then
    raise exception 'only read_at may be updated';
  end if;
  return new;
end;
$$;

create trigger notifications_enforce_read_only_update
  before update on public.notifications_log
  for each row execute function public.enforce_notification_read_only_update();

create policy "notifications_update_self_read_at"
  on public.notifications_log for update
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

-- 1.6: "notification preferences toggle for non-critical pings". Flash-slot
-- alerts are the opportunistic, non-critical one of the three types (a
-- missed one just means no premium-price upsell reached that student) --
-- wash-complete and support-reply are transactional status updates about
-- the student's own action/ticket, not toggleable.
alter table public.students add column notify_flash_slots boolean not null default true;

-- The one insertion point every notification-firing moment below (and 1.9's
-- support-reply notification later) goes through. Not exposed to clients --
-- only ever called from other SECURITY DEFINER functions/triggers.
create or replace function public.notify_student(
  p_student_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_related_booking_id uuid default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications_log (student_id, type, title, body, related_booking_id)
  values (p_student_id, p_type, p_title, p_body, p_related_booking_id);
end;
$$;

revoke all on function public.notify_student(uuid, text, text, text, uuid) from public;

-- 1.3/1.6: "every verified student at that hostel gets a push notification"
-- when a flash slot opens, respecting the non-critical toggle above.
create or replace function public.notify_flash_slot_opened()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hostel_id uuid;
  v_label text;
begin
  select hostel_id, label into v_hostel_id, v_label from public.machines where id = new.machine_id;

  perform public.notify_student(
    s.id, 'flash_slot', v_label || ' just opened up',
    '₹' || new.price || ' -- claim within 2 minutes.', new.original_booking_id
  )
  from public.students s
  where s.hostel_id = v_hostel_id
    and s.id_verification_status = 'verified'
    and s.notify_flash_slots;

  return new;
end;
$$;

create trigger flash_slots_notify_on_open
  after insert on public.flash_slots
  for each row when (new.status = 'open')
  execute function public.notify_flash_slot_opened();

-- 1.6's wash-complete notification needs bookings to actually reach
-- 'completed' -- nothing did that before this migration (1.3/1.4/1.5 only
-- ever moved a booking to 'started' and left it there). Runs alongside the
-- existing forfeiture/flash-revert scheduler below; freeing the machine
-- happens for free via the existing sync_machine_status_on_booking_update
-- trigger from 1.3, since 'completed' is one of the statuses it already
-- treats as "machine free".
create or replace function public.complete_finished_washes()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.bookings
  set status = 'completed'
  where status = 'started' and slot_end < now();
end;
$$;

revoke all on function public.complete_finished_washes() from public;

create or replace function public.notify_wash_complete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_label text;
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    select label into v_label from public.machines where id = new.machine_id;
    perform public.notify_student(
      new.student_id, 'wash_complete', 'Wash complete',
      'Your wash on ' || coalesce(v_label, 'your machine') || ' has finished.', new.id
    );
  end if;
  return new;
end;
$$;

create trigger bookings_notify_wash_complete
  after update of status on public.bookings
  for each row execute function public.notify_wash_complete();

create or replace function public.run_booking_scheduler()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.expire_overdue_bookings();
  perform public.revert_expired_flash_slots();
  perform public.complete_finished_washes();
end;
$$;

alter publication supabase_realtime add table public.notifications_log;
