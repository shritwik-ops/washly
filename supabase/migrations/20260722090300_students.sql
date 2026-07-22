-- Student profiles (story 1.1) + the private storage bucket for college ID
-- images.

create table public.students (
  id uuid primary key references auth.users(id) on delete cascade,
  phone text not null unique,
  full_name text,
  college_id uuid not null references public.colleges(id),
  hostel_id uuid not null references public.hostels(id),
  roll_number text,
  -- Storage object path within the `student-ids` bucket, e.g.
  -- "<student_id>/id.jpg" -- NOT a public URL. The bucket is private;
  -- clients must request a signed URL to view it.
  id_image_url text,
  id_verification_status text not null default 'pending'
    check (id_verification_status in ('pending', 'verified', 'rejected')),
  id_rejection_reason text,
  account_status text not null default 'active'
    check (account_status in ('active', 'suspended')),
  -- Incremented on booking forfeiture (1.3). Feeds future trust/priority
  -- scoring -- not consumed by anything in scope yet.
  no_show_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- CHECK constraints can't join across tables, so hostel/college consistency
-- is enforced here instead: a student's hostel_id must actually belong to
-- their college_id.
create or replace function public.check_student_hostel_matches_college()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1 from public.hostels
    where id = new.hostel_id and college_id = new.college_id
  ) then
    raise exception 'hostel_id % does not belong to college_id %', new.hostel_id, new.college_id;
  end if;
  return new;
end;
$$;

create trigger students_check_hostel_college
  before insert or update of hostel_id, college_id on public.students
  for each row execute function public.check_student_hostel_matches_college();

create trigger students_set_updated_at
  before update on public.students
  for each row execute function public.set_updated_at();

-- RLS grants both the student themself and their college/super admin
-- update access, but that's too coarse: a student must not be able to
-- verify their own ID or lift their own suspension, and an admin has no
-- business editing a student's name or phone. This trigger enforces the
-- column-level split that RLS alone can't express.
create or replace function public.enforce_student_update_permissions()
returns trigger
language plpgsql
as $$
declare
  acting_as_admin boolean := public.is_super_admin() or public.admin_college_id() = old.college_id;
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
    then
      raise exception 'students may not modify verification, account status, no-show count, or college assignment';
    end if;
    -- Resubmitting a new ID after rejection puts verification back to pending.
    if new.id_image_url is distinct from old.id_image_url and old.id_verification_status = 'rejected' then
      new.id_verification_status := 'pending';
      new.id_rejection_reason := null;
    end if;
  end if;
  return new;
end;
$$;

create trigger students_enforce_update_permissions
  before update on public.students
  for each row execute function public.enforce_student_update_permissions();

alter table public.students enable row level security;

create policy "students_select_self_or_admin"
  on public.students for select
  using (
    id = auth.uid()
    or public.is_super_admin()
    or public.admin_college_id() = college_id
  );

create policy "students_insert_self"
  on public.students for insert
  with check (id = auth.uid());

create policy "students_update_self_or_admin"
  on public.students for update
  using (
    id = auth.uid()
    or public.is_super_admin()
    or public.admin_college_id() = college_id
  )
  with check (
    id = auth.uid()
    or public.is_super_admin()
    or public.admin_college_id() = college_id
  );

-- Private bucket for college ID photos -- access-controlled, never public,
-- per CLAUDE.md.
insert into storage.buckets (id, name, public)
values ('student-ids', 'student-ids', false)
on conflict (id) do nothing;

-- Objects are stored under "<student_id>/..." so ownership is just a
-- foldername check.
create policy "student_ids_insert_own"
  on storage.objects for insert
  with check (
    bucket_id = 'student-ids'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "student_ids_update_own"
  on storage.objects for update
  using (
    bucket_id = 'student-ids'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "student_ids_delete_own"
  on storage.objects for delete
  using (
    bucket_id = 'student-ids'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "student_ids_select_self_or_admin"
  on storage.objects for select
  using (
    bucket_id = 'student-ids'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_super_admin()
      or exists (
        select 1 from public.students s
        where s.id::text = (storage.foldername(name))[1]
          and s.college_id = public.admin_college_id()
      )
    )
  );
