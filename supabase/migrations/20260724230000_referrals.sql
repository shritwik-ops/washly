-- Story 1.8: referral code/link, status tracking, reward on the referred
-- friend's first paid wash.
--
-- No invite-send mechanism exists (no SMS/email dispatched through our own
-- system when a student shares their code) -- a student just shares a raw
-- code/link via the OS share sheet, which we can't observe. That means the
-- earliest state we can ever *record* is 'joined' (the friend actually
-- signed up with the code); there is no server-observable "invited but
-- hasn't joined yet" row to store. The code itself is the "invited" state
-- from the UI's point of view -- you have something to share -- so the
-- referrals table only models the three states we can genuinely track.

alter table public.students add column referral_code text unique;
alter table public.students add column referred_by uuid references public.students(id);

create or replace function public.generate_referral_code()
returns text
language plpgsql
as $$
declare
  v_code text;
begin
  loop
    v_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    exit when not exists (select 1 from public.students where referral_code = v_code);
  end loop;
  return v_code;
end;
$$;

create or replace function public.students_set_referral_code()
returns trigger
language plpgsql
as $$
begin
  if new.referral_code is null then
    new.referral_code := public.generate_referral_code();
  end if;
  if new.referred_by = new.id then
    raise exception 'a student cannot refer themself';
  end if;
  return new;
end;
$$;

create trigger students_before_insert_referral_code
  before insert on public.students
  for each row execute function public.students_set_referral_code();

-- Backfill: the trigger above only fires for rows inserted after this
-- migration -- every student who signed up before it would otherwise have
-- no code at all to share.
update public.students set referral_code = public.generate_referral_code() where referral_code is null;

-- referred_by is resolved client-side via resolve_referral_code() below
-- before the students insert, same as every other RPC-mediated write in
-- this schema -- like recharge_wallet's documented gateway-trust caveat,
-- a client crafting the insert directly could set referred_by to an
-- arbitrary student id without actually going through that RPC. The
-- consequence is a bogus reward paid to a stranger, not any benefit to the
-- attacker themself -- multi-account referral collusion is the same
-- fraud-review problem every referral program has, and per CLAUDE.md is a
-- 3.5 (super-admin fraud/dispute handling) concern, not something this
-- migration tries to architecturally prevent.
create or replace function public.resolve_referral_code(p_code text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.students where referral_code = upper(trim(p_code));
$$;

revoke all on function public.resolve_referral_code(text) from public;
grant execute on function public.resolve_referral_code(text) to authenticated;

-- referred_by/referral_code join the columns students may not rewrite
-- post-creation -- otherwise a student could backdate/fabricate a referral
-- after the fact, or change their own code to impersonate someone else's.
create or replace function public.enforce_student_update_permissions()
returns trigger
language plpgsql
as $$
declare
  acting_as_admin boolean := auth.uid() is null or public.is_super_admin() or public.admin_college_id() = old.college_id;
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

create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.students(id),
  referred_id uuid not null unique references public.students(id),
  status text not null default 'joined'
    check (status in ('joined', 'completed_first_wash', 'reward_credited')),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  reward_credited_at timestamptz,
  check (referrer_id <> referred_id)
);

alter table public.referrals enable row level security;

-- Visible to the referrer (tracking who they've brought in) and super
-- admin. The referred student has no need to see it -- 1.8's status
-- tracking is described from the referrer's point of view.
create policy "referrals_select_referrer_or_super_admin"
  on public.referrals for select
  using (referrer_id = auth.uid() or public.is_super_admin());

create or replace function public.create_referral_on_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.referred_by is not null then
    insert into public.referrals (referrer_id, referred_id, status)
    values (new.referred_by, new.id, 'joined');
  end if;
  return new;
end;
$$;

create trigger students_after_insert_create_referral
  after insert on public.students
  for each row execute function public.create_referral_on_signup();

alter table public.pricing_config drop constraint pricing_config_key_check;
alter table public.pricing_config add constraint pricing_config_key_check
  check (key in (
    'booking_fee', 'flash_slot_premium', 'wash_price', 'prewash_full_checklist_threshold',
    'referral_reward_amount'
  ));

insert into public.pricing_config (key, value) values ('referral_reward_amount', 50.00);

alter table public.wallet_transactions drop constraint wallet_transactions_type_check;
alter table public.wallet_transactions add constraint wallet_transactions_type_check
  check (type in ('recharge', 'booking_fee', 'flash_fee', 'wash_payment', 'forfeiture', 'refund', 'referral_reward'));

alter table public.notifications_log drop constraint notifications_log_type_check;
alter table public.notifications_log add constraint notifications_log_type_check
  check (type in ('wash_complete', 'flash_slot', 'support_reply', 'referral_reward'));

-- 1.8: "reward triggers only after the referred friend completes their
-- first paid wash". Fires alongside 1.6's wash-complete notification on
-- the same status transition -- "first" means this is their first-ever
-- completed booking (not just first since referring), and "paid" means
-- total_amount actually charged for it (per 1.7's total_amount fix) is
-- greater than zero, not merely that a completed row exists.
create or replace function public.credit_referral_reward()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referral public.referrals;
  v_prior_completed_count integer;
  v_charged numeric(10, 2);
  v_reward numeric(10, 2);
begin
  select * into v_referral from public.referrals where referred_id = new.student_id and status = 'joined';
  if v_referral is null then
    return new;
  end if;

  select count(*) into v_prior_completed_count
  from public.bookings
  where student_id = new.student_id and status = 'completed';
  if v_prior_completed_count <> 1 then
    return new;
  end if;

  select coalesce(sum(total_amount), 0) into v_charged
  from public.wallet_transactions
  where booking_id = new.id and type in ('booking_fee', 'flash_fee', 'wash_payment');
  if v_charged <= 0 then
    return new;
  end if;

  select value into v_reward
  from public.pricing_config
  where key = 'referral_reward_amount'
    and effective_from <= now()
    and (effective_to is null or effective_to > now());
  v_reward := coalesce(v_reward, 50.00);

  update public.referrals
  set status = 'reward_credited', completed_at = now(), reward_credited_at = now()
  where id = v_referral.id;

  insert into public.wallet_transactions (student_id, type, amount, total_amount, description)
  values (v_referral.referrer_id, 'referral_reward', v_reward, v_reward, 'Referral reward -- friend completed their first paid wash');

  perform public.notify_student(
    v_referral.referrer_id, 'referral_reward', 'Referral reward credited',
    '₹' || v_reward || ' added to your wallet -- your friend completed their first paid wash.'
  );

  return new;
end;
$$;

create trigger bookings_credit_referral_reward
  after update of status on public.bookings
  for each row when (new.status = 'completed' and old.status is distinct from 'completed')
  execute function public.credit_referral_reward();
