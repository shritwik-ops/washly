-- Fixes a real gap surfaced while testing 1.8's referral list: the
-- referrer's screen embeds the referred student's name/phone via
-- `referrals!referrals_referred_id_fkey`, but students' select policy only
-- ever allowed a student to see their own row (or an admin's scoped view)
-- -- so that embed silently returned null for every referral, rendering a
-- blank name instead of an error. A referrer needs visibility into who
-- they referred, same as they already see the referred_id relationship
-- itself via referrals' own policy.

drop policy "students_select_self_or_admin" on public.students;

create policy "students_select_self_or_admin_or_referrer"
  on public.students for select
  using (
    id = auth.uid()
    or public.is_super_admin()
    or public.admin_college_id() = college_id
    or exists (
      select 1 from public.referrals r
      where r.referred_id = students.id and r.referrer_id = auth.uid()
    )
  );
