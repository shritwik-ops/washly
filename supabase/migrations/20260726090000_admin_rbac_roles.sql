-- Story 3.9: admin role management (RBAC). Extends admin_users from the
-- 2-role model (college_admin/super_admin) every earlier migration relies
-- on to the full 4-role platform-admin model, then re-does every existing
-- admin-facing RLS policy so the 3 new roles are actually functional the
-- moment this migration lands -- not just accepted by a check constraint
-- with nothing anywhere else recognizing them.
--
-- New roles: operations_admin, support_admin, finance_admin. All three are
-- platform-wide, same as super_admin (college_id is null) -- none of them
-- are scoped to a single college. college_admin is untouched.
--
-- Deliberately built ahead of the college/super admin panels (2.x/3.x
-- haven't been started) -- same "schema ahead of the UI" pattern as
-- subscriptions (1.7) and support_tickets (1.9), but explicitly requested
-- now rather than assumed.

alter table public.admin_users
  drop constraint admin_users_college_scope;

alter table public.admin_users
  add constraint admin_users_college_scope check (
    (role in ('super_admin', 'operations_admin', 'support_admin', 'finance_admin') and college_id is null)
    or (role = 'college_admin' and college_id is not null)
  );

alter table public.admin_users
  drop constraint admin_users_role_check;

alter table public.admin_users
  add constraint admin_users_role_check check (
    role in ('college_admin', 'super_admin', 'operations_admin', 'support_admin', 'finance_admin')
  );

-- Returns the caller's admin role as text, or null if they're not an admin.
create or replace function public.admin_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.admin_users
  where id = auth.uid()
  limit 1;
$$;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users
    where id = auth.uid()
    and role in ('super_admin', 'operations_admin', 'support_admin', 'finance_admin')
  );
$$;

-- One helper per new role, same shape as is_super_admin() -- lets every
-- policy below read as a role name rather than a repeated admin_role()
-- string comparison.
create or replace function public.is_operations_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admin_users where id = auth.uid() and role = 'operations_admin');
$$;

create or replace function public.is_support_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admin_users where id = auth.uid() and role = 'support_admin');
$$;

create or replace function public.is_finance_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admin_users where id = auth.uid() and role = 'finance_admin');
$$;

comment on function public.admin_role() is
  'Returns the calling admin''s role, or null if not an admin. SECURITY DEFINER to avoid RLS recursion.';
comment on function public.is_platform_admin() is
  'True if caller is any platform-wide admin role (super_admin/operations_admin/support_admin/finance_admin), false for college_admin or non-admins.';

-- Audit log for admin actions (3.9: "every admin action gets an audit log
-- entry"). Insert-only from admins' perspective -- writes happen via
-- log_admin_action() below, not direct inserts.
create table public.admin_action_log (
  id bigint generated always as identity primary key,
  admin_id uuid references public.admin_users(id) on delete set null,
  role text not null,
  action text not null,
  target_table text,
  target_id text,
  detail jsonb,
  created_at timestamptz not null default now()
);

comment on table public.admin_action_log is
  'Audit trail for admin actions per story 3.9. Written via log_admin_action(), not direct insert.';

alter table public.admin_action_log enable row level security;

create policy "admin_action_log_select_super_admin"
  on public.admin_action_log for select
  using (public.is_super_admin());

create or replace function public.log_admin_action(
  p_action text,
  p_target_table text default null,
  p_target_id text default null,
  p_detail jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.admin_action_log (admin_id, role, action, target_table, target_id, detail)
  values (auth.uid(), public.admin_role(), p_action, p_target_table, p_target_id, p_detail);
end;
$$;

comment on function public.log_admin_action(text, text, text, jsonb) is
  'Call this from any admin RPC to record an audit entry. Captures the caller''s current role automatically.';

-- ============================================================
-- admin_users itself: "only super_admin can create/edit/deactivate
-- other admin_users records". No insert/update/delete policy existed
-- before this migration (service-role only) -- add them scoped to
-- super_admin so the future super-admin panel can manage admins directly.
-- ============================================================

create policy "admin_users_insert_super_admin"
  on public.admin_users for insert
  with check (public.is_super_admin());

create policy "admin_users_update_super_admin"
  on public.admin_users for update
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy "admin_users_delete_super_admin"
  on public.admin_users for delete
  using (public.is_super_admin());

-- ============================================================
-- colleges / hostels -- operations_admin owns 3.2 (onboard new college),
-- read+write same as super_admin.
-- ============================================================

drop policy "colleges_select_active_or_super_admin" on public.colleges;
create policy "colleges_select_active_or_admin"
  on public.colleges for select
  using (is_active or public.is_super_admin() or public.is_operations_admin());

drop policy "colleges_write_super_admin" on public.colleges;
create policy "colleges_write_super_admin_or_operations"
  on public.colleges for all
  using (public.is_super_admin() or public.is_operations_admin())
  with check (public.is_super_admin() or public.is_operations_admin());

drop policy "hostels_select_active_college_or_admin" on public.hostels;
create policy "hostels_select_active_college_or_admin"
  on public.hostels for select
  using (
    exists (
      select 1 from public.colleges c
      where c.id = hostels.college_id and c.is_active
    )
    or public.is_super_admin()
    or public.is_operations_admin()
    or public.admin_college_id() = hostels.college_id
  );

drop policy "hostels_write_super_admin" on public.hostels;
create policy "hostels_write_super_admin_or_operations"
  on public.hostels for all
  using (public.is_super_admin() or public.is_operations_admin())
  with check (public.is_super_admin() or public.is_operations_admin());

-- ============================================================
-- machines -- operations_admin owns 3.3 (machine inventory management).
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
      where h.id = machines.hostel_id and h.college_id = public.admin_college_id()
    )
  );

drop policy "machines_write_super_admin" on public.machines;
create policy "machines_write_super_admin_or_operations"
  on public.machines for all
  using (public.is_super_admin() or public.is_operations_admin())
  with check (public.is_super_admin() or public.is_operations_admin());

-- ============================================================
-- pricing_config -- operations_admin owns 3.4 (read+write); finance_admin
-- gets read-only access to the full history (dashboard/statements need to
-- see what pricing was in effect when), never write.
-- ============================================================

drop policy "pricing_config_select_active_or_super_admin" on public.pricing_config;
create policy "pricing_config_select_active_or_admin"
  on public.pricing_config for select
  using (
    public.is_super_admin()
    or public.is_operations_admin()
    or public.is_finance_admin()
    or (effective_from <= now() and (effective_to is null or effective_to > now()))
  );

drop policy "pricing_config_write_super_admin" on public.pricing_config;
create policy "pricing_config_write_super_admin_or_operations"
  on public.pricing_config for all
  using (public.is_super_admin() or public.is_operations_admin())
  with check (public.is_super_admin() or public.is_operations_admin());

-- ============================================================
-- students -- support_admin owns 3.5 (user management/ID verification),
-- platform-wide, same visibility/edit rights as super_admin. Recreates
-- the CURRENT select policy (students_select_self_or_admin_or_referrer,
-- from referral_visibility.sql) rather than the original, since that's
-- what's actually live.
-- ============================================================

drop policy "students_select_self_or_admin_or_referrer" on public.students;
create policy "students_select_self_or_admin_or_referrer"
  on public.students for select
  using (
    id = auth.uid()
    or public.is_super_admin()
    or public.is_support_admin()
    or public.admin_college_id() = college_id
    or exists (
      select 1 from public.referrals r
      where r.referred_id = students.id and r.referrer_id = auth.uid()
    )
  );

drop policy "students_update_self_or_admin" on public.students;
create policy "students_update_self_or_admin"
  on public.students for update
  using (
    id = auth.uid()
    or public.is_super_admin()
    or public.is_support_admin()
    or public.admin_college_id() = college_id
  )
  with check (
    id = auth.uid()
    or public.is_super_admin()
    or public.is_support_admin()
    or public.admin_college_id() = college_id
  );

-- enforce_student_update_permissions' acting_as_admin flag gates which
-- columns a caller may touch (verification/account-status fields for
-- admins, everything-but-those for the student themself) -- support_admin
-- needs to land on the "acting_as_admin" branch same as super_admin/
-- college_admin, or the update policy above would let them through RLS
-- but the trigger would then reject the verification-status change itself.
create or replace function public.enforce_student_update_permissions()
returns trigger
language plpgsql
as $$
declare
  acting_as_admin boolean :=
    auth.uid() is null
    or public.is_super_admin()
    or public.is_support_admin()
    or public.admin_college_id() = old.college_id;
begin
  if acting_as_admin then
    if new.full_name is distinct from old.full_name
      or new.phone is distinct from old.phone
      or new.hostel_id is distinct from old.hostel_id
      or new.college_id is distinct from old.college_id
      or new.roll_number is distinct from old.roll_number
      or new.id_image_url is distinct from old.id_image_url
    then
      raise exception 'admins may only change verification and account status fields';
    end if;
  else
    if new.id_verification_status is distinct from old.id_verification_status
      or new.id_rejection_reason is distinct from old.id_rejection_reason
      or new.account_status is distinct from old.account_status
      or new.no_show_count is distinct from old.no_show_count
      or new.college_id is distinct from old.college_id
      or new.referral_code is distinct from old.referral_code
      or new.referred_by is distinct from old.referred_by
    then
      raise exception 'students may not modify verification, account status, no-show count, college assignment, or referral fields';
    end if;
    if new.id_image_url is distinct from old.id_image_url and old.id_verification_status = 'rejected' then
      new.id_verification_status := 'pending';
      new.id_rejection_reason := null;
    end if;
  end if;
  return new;
end;
$$;

-- Same student-ids storage bucket visibility support_admin needs for ID
-- verification (3.5's "view uploaded ID images").
drop policy "student_ids_select_self_or_admin" on storage.objects;
create policy "student_ids_select_self_or_admin"
  on storage.objects for select
  using (
    bucket_id = 'student-ids'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_super_admin()
      or public.is_support_admin()
      or exists (
        select 1 from public.students s
        where s.id::text = (storage.foldername(name))[1]
          and s.college_id = public.admin_college_id()
      )
    )
  );

-- ============================================================
-- bookings / flash_slots -- finance_admin needs these for 3.1's revenue
-- figures and statement generation (booking fees, flash premiums).
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
      where m.id = bookings.machine_id and h.college_id = public.admin_college_id()
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
      where m.id = flash_slots.machine_id and h.college_id = public.admin_college_id()
    )
    or exists (
      select 1 from public.students s
      join public.machines m on m.hostel_id = s.hostel_id
      where s.id = auth.uid() and m.id = flash_slots.machine_id
    )
  );

-- ============================================================
-- wallet_transactions -- finance_admin needs the ledger for revenue/
-- statement reporting (3.1).
-- ============================================================

drop policy "wallet_transactions_select_self_or_super_admin" on public.wallet_transactions;
create policy "wallet_transactions_select_self_or_admin"
  on public.wallet_transactions for select
  using (student_id = auth.uid() or public.is_super_admin() or public.is_finance_admin());

-- ============================================================
-- support_tickets / ticket_replies -- support_admin owns 3.6 (the same
-- escalation queue super_admin currently sees: everything routed to super
-- admin directly, plus anything escalated). Treated as equivalent to
-- super_admin for ticket visibility and reply authorship -- 3.9 exists
-- specifically so support_admin can take over this queue from super_admin.
-- ============================================================

drop policy "support_tickets_select_self_or_scoped_admin" on public.support_tickets;
create policy "support_tickets_select_self_or_scoped_admin"
  on public.support_tickets for select
  using (
    student_id = auth.uid()
    or public.is_super_admin()
    or public.is_support_admin()
    or (routed_to = 'college_admin' and public.admin_college_id() = college_id)
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
          or (st.routed_to = 'college_admin' and public.admin_college_id() = st.college_id)
        )
    )
  );

-- add_ticket_reply's author_type resolution: support_admin replies land in
-- the thread labeled 'super_admin' (same as the mobile UI's existing
-- AUTHOR_LABEL mapping to "Washly support") -- students don't need to
-- distinguish which specific platform-admin role answered them.
create or replace function public.add_ticket_reply(p_ticket_id uuid, p_body text)
returns public.ticket_replies
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ticket public.support_tickets;
  v_author_type text;
  v_reply public.ticket_replies;
begin
  if p_body is null or length(trim(p_body)) = 0 then
    raise exception 'reply body is required';
  end if;

  select * into v_ticket from public.support_tickets where id = p_ticket_id for update;
  if v_ticket is null then
    raise exception 'ticket not found';
  end if;

  if v_ticket.student_id = auth.uid() then
    v_author_type := 'student';
  elsif public.is_super_admin() or public.is_support_admin() then
    v_author_type := 'super_admin';
  elsif v_ticket.routed_to = 'college_admin' and public.admin_college_id() = v_ticket.college_id then
    v_author_type := 'college_admin';
  else
    raise exception 'not authorized to reply to this ticket';
  end if;

  if v_ticket.status = 'resolved' then
    raise exception 'ticket is resolved -- it can no longer be replied to';
  end if;

  insert into public.ticket_replies (ticket_id, author_type, author_id, body)
  values (p_ticket_id, v_author_type, auth.uid(), trim(p_body))
  returning * into v_reply;

  if v_author_type <> 'student' then
    perform public.notify_student(
      v_ticket.student_id, 'support_reply', 'New reply on your ticket',
      left(trim(p_body), 140)
    );
  end if;

  return v_reply;
end;
$$;

drop policy "ticket_photos_select_own_or_scoped_admin" on storage.objects;
create policy "ticket_photos_select_own_or_scoped_admin"
  on storage.objects for select
  using (
    bucket_id = 'ticket-photos'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_super_admin()
      or public.is_support_admin()
      or exists (
        select 1 from public.support_tickets st
        where st.student_id::text = (storage.foldername(name))[1]
          and st.routed_to = 'college_admin'
          and st.college_id = public.admin_college_id()
      )
    )
  );
