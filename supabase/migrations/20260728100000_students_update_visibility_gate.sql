-- Closes the gap flagged in 20260728090000_college_data_visibility.sql's
-- own comment: the SELECT policy on students was gated by
-- student_roster_visible, but the UPDATE policy (ID approve/reject, 2.2)
-- was left unconditional -- a college_admin could still blind-UPDATE a
-- known student id via a direct API call even with roster visibility
-- switched off, since Postgres evaluates an UPDATE policy's USING clause
-- independently of any SELECT policy on the same table.
--
-- Only the college_admin clause changes, in both USING and WITH CHECK --
-- self, super_admin, support_admin untouched, matching the SELECT
-- policy's own scoping exactly.

drop policy "students_update_self_or_admin" on public.students;
create policy "students_update_self_or_admin"
  on public.students for update
  using (
    id = auth.uid()
    or public.is_super_admin()
    or public.is_support_admin()
    or (public.admin_college_id() = college_id and public.college_data_visible(college_id, 'student_roster'))
  )
  with check (
    id = auth.uid()
    or public.is_super_admin()
    or public.is_support_admin()
    or (public.admin_college_id() = college_id and public.college_data_visible(college_id, 'student_roster'))
  );
