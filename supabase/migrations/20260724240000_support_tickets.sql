-- Story 1.9: support tickets. Category picker, optional photo, routing
-- (machine/booking -> college admin; payment/ID -> super admin directly),
-- status tracking, reply thread.
--
-- Neither the college admin panel (2.4) nor the super admin panel (3.6)
-- exist yet -- per CLAUDE.md's build order they come after the student
-- app. This migration builds the full schema/RPC surface those stories
-- will read and write against (routing, escalation flag, reply
-- authorship), same as subscriptions in 1.7 was built ahead of 3.4's
-- purchase flow -- but the only client today is the student mobile app,
-- so admin-side replies/status changes are exercised directly against the
-- database for now, not through a UI that doesn't exist.

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id),
  category text not null
    check (category in ('payment_wallet', 'machine_malfunction', 'booking_flash', 'id_verification', 'other')),
  description text not null,
  -- Storage object path within the `ticket-photos` bucket, same
  -- private-bucket-plus-signed-URL pattern as students.id_image_url --
  -- never a public URL.
  photo_path text,
  -- Derived server-side from category (1.9's routing rule), never
  -- client-supplied -- a client-trusted routed_to would let a student
  -- route a machine complaint straight to super admin, defeating the
  -- location-specific/platform-specific split the rule exists for.
  routed_to text not null check (routed_to in ('college_admin', 'super_admin')),
  -- Snapshotted from the student's college at creation, same rationale as
  -- booking_fee snapshotting pricing_config in 1.3 -- scopes college-admin
  -- visibility (2.4) without a join back through students on every read.
  college_id uuid not null references public.colleges(id),
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved')),
  -- 2.4: "escalate to Super Admin if it's a hardware issue beyond local
  -- fix, or unresolved past a time threshold". Only meaningful when
  -- routed_to = 'college_admin' -- a ticket already routed to super admin
  -- has nowhere further to escalate.
  escalated_to_super_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger support_tickets_set_updated_at
  before update on public.support_tickets
  for each row execute function public.set_updated_at();

alter table public.support_tickets enable row level security;

create policy "support_tickets_select_self_or_scoped_admin"
  on public.support_tickets for select
  using (
    student_id = auth.uid()
    or public.is_super_admin()
    or (routed_to = 'college_admin' and public.admin_college_id() = college_id)
  );

-- No insert/update policy for anon/authenticated -- category->routed_to
-- derivation and the college_id snapshot must not be client-trusted, so
-- writes go through create_support_ticket/add_ticket_reply/status-change
-- RPCs only, same reasoning as bookings' create_booking-only write path.

create table public.ticket_replies (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id),
  author_type text not null check (author_type in ('student', 'college_admin', 'super_admin')),
  author_id uuid not null,
  body text not null,
  created_at timestamptz not null default now()
);

alter table public.ticket_replies enable row level security;

create policy "ticket_replies_select_matches_ticket_visibility"
  on public.ticket_replies for select
  using (
    exists (
      select 1 from public.support_tickets st
      where st.id = ticket_replies.ticket_id
        and (
          st.student_id = auth.uid()
          or public.is_super_admin()
          or (st.routed_to = 'college_admin' and public.admin_college_id() = st.college_id)
        )
    )
  );

create or replace function public.create_support_ticket(
  p_category text,
  p_description text,
  p_photo_path text default null
) returns public.support_tickets
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student public.students;
  v_routed_to text;
  v_ticket public.support_tickets;
begin
  select * into v_student from public.students where id = auth.uid();
  if v_student is null then
    raise exception 'student profile not found';
  end if;
  if p_description is null or length(trim(p_description)) = 0 then
    raise exception 'description is required';
  end if;

  -- 1.9's routing rule: payment/wallet and ID verification touch
  -- platform-wide financial/compliance data college admin shouldn't see,
  -- so they go straight to super admin; everything else is
  -- location-specific and starts with the college admin.
  v_routed_to := case
    when p_category in ('payment_wallet', 'id_verification') then 'super_admin'
    else 'college_admin'
  end;

  insert into public.support_tickets (student_id, category, description, photo_path, routed_to, college_id)
  values (auth.uid(), p_category, trim(p_description), p_photo_path, v_routed_to, v_student.college_id)
  returning * into v_ticket;

  return v_ticket;
end;
$$;

revoke all on function public.create_support_ticket(text, text, text) from public;
grant execute on function public.create_support_ticket(text, text, text) to authenticated;

-- Single entrypoint for every reply -- student, college admin, or super
-- admin -- so authorship/notification logic lives in one place rather
-- than three separate insert paths each needing their own RLS policy.
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
  elsif public.is_super_admin() then
    v_author_type := 'super_admin';
  elsif v_ticket.routed_to = 'college_admin' and public.admin_college_id() = v_ticket.college_id then
    v_author_type := 'college_admin';
  else
    raise exception 'not authorized to reply to this ticket';
  end if;

  -- 1.9: "closed tickets remain visible in history for reference" --
  -- read-only once resolved, for every author type equally.
  if v_ticket.status = 'resolved' then
    raise exception 'ticket is resolved -- it can no longer be replied to';
  end if;

  insert into public.ticket_replies (ticket_id, author_type, author_id, body)
  values (p_ticket_id, v_author_type, auth.uid(), trim(p_body))
  returning * into v_reply;

  -- Only an admin reply is news to the student -- their own reply doesn't
  -- need to notify themself. Reuses 1.6's shared notification infra
  -- rather than a bespoke ticket-specific notification path.
  if v_author_type <> 'student' then
    perform public.notify_student(
      v_ticket.student_id, 'support_reply', 'New reply on your ticket',
      left(trim(p_body), 140)
    );
  end if;

  return v_reply;
end;
$$;

revoke all on function public.add_ticket_reply(uuid, text) from public;
grant execute on function public.add_ticket_reply(uuid, text) to authenticated;

-- Private bucket for ticket photos -- same access-controlled, never-public
-- pattern as student-ids (1.1).
insert into storage.buckets (id, name, public)
values ('ticket-photos', 'ticket-photos', false)
on conflict (id) do nothing;

create policy "ticket_photos_insert_own"
  on storage.objects for insert
  with check (
    bucket_id = 'ticket-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "ticket_photos_select_own_or_scoped_admin"
  on storage.objects for select
  using (
    bucket_id = 'ticket-photos'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_super_admin()
      or exists (
        select 1 from public.support_tickets st
        where st.student_id::text = (storage.foldername(name))[1]
          and st.routed_to = 'college_admin'
          and st.college_id = public.admin_college_id()
      )
    )
  );

alter publication supabase_realtime add table public.support_tickets;
alter publication supabase_realtime add table public.ticket_replies;
