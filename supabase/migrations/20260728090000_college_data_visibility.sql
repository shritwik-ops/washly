-- Story 3.10: per-college data visibility configuration. Super admin
-- controls which of 5 data categories each college's college_admin can
-- see, enforced via RLS (same "not just hidden UI" principle as 3.9).
--
-- Every default here is chosen to match CURRENT hardcoded behavior exactly
-- (per 3.10: "so nothing changes for existing colleges until a super_admin
-- actively changes it") -- machine_status/wash_volume/student_roster/
-- support_tickets default true because college_admin already has
-- unconditional access to all four today; revenue defaults false because
-- college_admin has NEVER had wallet_transactions access (this migration
-- is what introduces it, strictly opt-in per college).

create table public.college_data_visibility (
  id uuid primary key default gen_random_uuid(),
  college_id uuid not null unique references public.colleges(id),
  machine_status_visible boolean not null default true,
  wash_volume_visible boolean not null default true,
  revenue_visible boolean not null default false,
  student_roster_visible boolean not null default true,
  support_tickets_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger college_data_visibility_set_updated_at
  before update on public.college_data_visibility
  for each row execute function public.set_updated_at();

-- Auto-create a default row for every new college (3.2's onboarding
-- flow), so there's never a college without a visibility row to check
-- against -- college_data_visible() below would otherwise have to guess
-- at a fallback for a missing row.
create or replace function public.create_default_college_data_visibility()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.college_data_visibility (college_id) values (new.id);
  return new;
end;
$$;

create trigger colleges_create_default_visibility
  after insert on public.colleges
  for each row execute function public.create_default_college_data_visibility();

-- Backfill: every college created before this migration existed.
insert into public.college_data_visibility (college_id)
select id from public.colleges
on conflict (college_id) do nothing;

alter table public.college_data_visibility enable row level security;

-- Super admin manages these toggles (3.10 is framed as a super-admin
-- capability, not operations_admin's, even though operations_admin owns
-- colleges generally per 3.9). A college's own college_admin can see
-- their college's current settings -- reasonable transparency into why
-- they can/can't see something, not required by the story but harmless.
create policy "college_data_visibility_select_super_admin_or_own_college"
  on public.college_data_visibility for select
  using (public.is_super_admin() or public.admin_college_id() = college_id);

create policy "college_data_visibility_write_super_admin"
  on public.college_data_visibility for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- Single lookup every gated policy below calls, rather than repeating the
-- same subquery shape 5 times with 5 different column names. Missing-row
-- fallbacks match each column's own default (true/true/false/true/true)
-- so a college created by direct insert without the trigger firing (or
-- pre-backfill, defensively) fails open exactly like "nothing configured
-- yet" should.
create or replace function public.college_data_visible(p_college_id uuid, p_category text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case p_category
    when 'machine_status' then coalesce(
      (select machine_status_visible from public.college_data_visibility where college_id = p_college_id), true)
    when 'wash_volume' then coalesce(
      (select wash_volume_visible from public.college_data_visibility where college_id = p_college_id), true)
    when 'revenue' then coalesce(
      (select revenue_visible from public.college_data_visibility where college_id = p_college_id), false)
    when 'student_roster' then coalesce(
      (select student_roster_visible from public.college_data_visibility where college_id = p_college_id), true)
    when 'support_tickets' then coalesce(
      (select support_tickets_visible from public.college_data_visibility where college_id = p_college_id), true)
    else false
  end;
$$;

-- ============================================================
-- machines (machine_status_visible, 2.1). Only the college_admin clause
-- changes -- student's own-hostel clause, super_admin, operations_admin
-- untouched.
-- ============================================================

drop policy "machines_select_own_hostel_or_admin" on public.machines;
create policy "machines_select_own_hostel_or_admin"
  on public.machines for select
  using (
    exists (
      select 1 from public.students s
      where s.id = auth.uid() and s.hostel_id = machines.hostel_id
    )
    or public.is_super_admin()
    or public.is_operations_admin()
    or exists (
      select 1 from public.hostels h
      where h.id = machines.hostel_id
        and h.college_id = public.admin_college_id()
        and public.college_data_visible(h.college_id, 'machine_status')
    )
  );

-- ============================================================
-- bookings + flash_slots (wash_volume_visible, 2.1's "wash volume
-- counts"). flash_slots is gated under the same category, not a 6th
-- category of its own -- it's the same booking-lifecycle operational
-- data 2.1 describes, just a different table. Student self-visibility,
-- super_admin, finance_admin untouched on both.
-- ============================================================

drop policy "bookings_select_self_or_admin" on public.bookings;
create policy "bookings_select_self_or_admin"
  on public.bookings for select
  using (
    student_id = auth.uid()
    or public.is_super_admin()
    or public.is_finance_admin()
    or exists (
      select 1 from public.machines m
      join public.hostels h on h.id = m.hostel_id
      where m.id = bookings.machine_id
        and h.college_id = public.admin_college_id()
        and public.college_data_visible(h.college_id, 'wash_volume')
    )
  );

drop policy "flash_slots_select_hostel_or_admin" on public.flash_slots;
create policy "flash_slots_select_hostel_or_admin"
  on public.flash_slots for select
  using (
    public.is_super_admin()
    or public.is_finance_admin()
    or exists (
      select 1 from public.machines m
      join public.hostels h on h.id = m.hostel_id
      where m.id = flash_slots.machine_id
        and h.college_id = public.admin_college_id()
        and public.college_data_visible(h.college_id, 'wash_volume')
    )
    or exists (
      select 1 from public.students s
      join public.machines m on m.hostel_id = s.hostel_id
      where s.id = auth.uid() and m.id = flash_slots.machine_id
    )
  );

-- ============================================================
-- students (student_roster_visible, 2.2). Only the college_admin clause
-- changes -- self, super_admin, support_admin, referrer-visibility
-- untouched. Deliberately scoped to the SELECT policy only, matching
-- 3.10's "data visibility" framing -- the update policy (ID
-- approve/reject) is untouched by this migration; a college_admin who
-- can't see the roster has no rows to act on via the UI, but the raw
-- update permission staying unconditional is a known gap, not something
-- this migration was asked to close.
-- ============================================================

drop policy "students_select_self_or_admin_or_referrer" on public.students;
create policy "students_select_self_or_admin_or_referrer"
  on public.students for select
  using (
    id = auth.uid()
    or public.is_super_admin()
    or public.is_support_admin()
    or (public.admin_college_id() = college_id and public.college_data_visible(college_id, 'student_roster'))
    or exists (
      select 1 from public.referrals r
      where r.referred_id = students.id and r.referrer_id = auth.uid()
    )
  );

-- ============================================================
-- support_tickets + ticket_replies (support_tickets_visible, 2.4). Both
-- get the same AND -- ticket_replies has its own independent copy of the
-- same college_admin condition (not inherited from support_tickets'
-- policy), so gating only support_tickets would leave reply content
-- visible even when the parent ticket isn't. Student self-visibility,
-- super_admin, support_admin untouched on both.
-- ============================================================

drop policy "support_tickets_select_self_or_scoped_admin" on public.support_tickets;
create policy "support_tickets_select_self_or_scoped_admin"
  on public.support_tickets for select
  using (
    student_id = auth.uid()
    or public.is_super_admin()
    or public.is_support_admin()
    or (
      routed_to = 'college_admin'
      and public.admin_college_id() = college_id
      and public.college_data_visible(college_id, 'support_tickets')
    )
  );

drop policy "ticket_replies_select_matches_ticket_visibility" on public.ticket_replies;
create policy "ticket_replies_select_matches_ticket_visibility"
  on public.ticket_replies for select
  using (
    exists (
      select 1 from public.support_tickets st
      where st.id = ticket_replies.ticket_id
        and (
          st.student_id = auth.uid()
          or public.is_super_admin()
          or public.is_support_admin()
          or (
            st.routed_to = 'college_admin'
            and public.admin_college_id() = st.college_id
            and public.college_data_visible(st.college_id, 'support_tickets')
          )
        )
    )
  );

-- ============================================================
-- wallet_transactions (revenue_visible, 2.1/2.3/2.5). This is NEW access
-- for college_admin -- no clause existed here before, unlike the other
-- 4 categories which are narrowing existing unconditional access. Joins
-- through students (which carries college_id directly) rather than
-- through bookings/machines/hostels, since every wallet_transaction has
-- a student_id and that's the shortest path to a college_id.
-- ============================================================

drop policy "wallet_transactions_select_self_or_admin" on public.wallet_transactions;
create policy "wallet_transactions_select_self_or_admin"
  on public.wallet_transactions for select
  using (
    student_id = auth.uid()
    or public.is_super_admin()
    or public.is_finance_admin()
    or exists (
      select 1 from public.students s
      where s.id = wallet_transactions.student_id
        and s.college_id = public.admin_college_id()
        and public.college_data_visible(s.college_id, 'revenue')
    )
  );
