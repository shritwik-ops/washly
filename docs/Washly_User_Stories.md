# Washly — User Stories & Feature Specification

This document breaks every feature into user stories with acceptance criteria, organized by persona. Written to be handed directly to Claude Code as a build reference. Gig marketplace and related gamification features are deferred for now — noted at the end, not spec'd in depth yet.

---

## 1. Student app (iOS/Android)

**1.1 — Sign up, college verification & ID upload**
As a student, I want to sign up, verify my college, and submit my college ID, so that admins can confirm I'm a real, eligible student.
- OTP sent via SMS to phone number
- Student selects college + hostel from a searchable list (not free text)
- **After account creation**, student is prompted to upload a photo of their college ID (camera or gallery)
- ID image is stored securely on the server (treat as sensitive PII — access-logged, not publicly readable)
- ID and verification status are visible on both the **College Admin** roster (2.2) and **Super Admin** user management (3.5) screens
- Verification status per student: `Pending` → `Verified` / `Rejected (reason)`
- Student can resubmit if rejected; sees their current status in-app
- Account remains usable (browse/book) while `Pending`, but College/Super Admin can suspend an account at any time if an ID looks fake or fraudulent — verification isn't a hard gate on day one, but it is a moderation lever
- Edge case: student's college isn't in the list yet → capture as a lead ("notify me when Washly launches here") instead of blocking signup

**1.2 — View live machine status**
As a student, I want to see which machines at my hostel are free right now, so that I don't walk over to a machine that's occupied.
- List/grid view of all machines at the student's hostel
- Status per machine: Free / In use (time remaining) / Under maintenance
- Real-time updates (Supabase realtime) — no manual refresh needed
- Machines under maintenance are greyed out and not bookable

**1.3 — Slot booking, forfeiture & flash re-release**
As a student, I want to reserve a machine with a small booking fee, so that it's guaranteed free when I arrive — and if I don't show up, I understand I lose that fee.
- Booking requires a small **booking fee**, default **₹10**, editable by Super Admin (platform-wide setting)
- Booking window: 15–30 minutes ahead, consistent with earlier usage-pattern discussion
- Student has **7 minutes** from slot start to tap "Start wash" at the machine
- **If started within 7 minutes**: the ₹10 booking fee is adjusted against the final wash cost (acts as a deposit, not a separate charge)
- **If not started within 7 minutes**:
  - Booking is automatically cancelled
  - The ₹10 booking fee is **forfeited (non-refundable)**
  - This counts as a no-show strike on the student's record (ties into future priority/trust scoring)
  - The machine is released as a **flash slot**: every verified student at that hostel gets a push notification that the machine is available at a premium price of **₹40** if booked within the next **2 minutes**
  - First successful payment wins the flash slot — if two students try simultaneously, only the first completed transaction is honored; the other is auto-refunded with a clear "someone else got it first" message
  - If nobody claims the flash slot within 2 minutes, it reverts to the **normal booking flow** (regular ₹10 booking fee, first-come-first-serve, no premium)
- Booking fee amount (₹10) and flash price (₹40) are both configurable by Super Admin — not hardcoded, since these will need tuning based on real no-show rates

**1.4 — Wallet, recharge & smart payment routing**
As a student, I want a wallet I can top up, and I want the app to intelligently use my wallet balance first, so that I'm not always jumping to UPI for small payments.
- Wallet section: current balance, transaction ledger (recharges, deductions, forfeitures, refunds)
- **Recharge**: preset amounts (₹100 / ₹200 / ₹500) plus custom amount, paid via UPI/card
- **At checkout** (wash payment, booking fee, flash slot, subscription purchase), the app checks wallet balance first:
  - Wallet balance ≥ amount due → pay entirely from wallet, no UPI prompt
  - Wallet balance > 0 but < amount due → student is offered the choice to apply the **partial wallet balance** toward the payment, with the **remaining balance charged via UPI** in the same transaction — this is a choice, not forced, so a student can opt to preserve their wallet balance and pay the full amount via UPI instead if they prefer
  - Wallet balance = 0 → standard UPI/card flow, no wallet prompt shown
- Every wallet-touching transaction (recharge, spend, forfeiture) is itemized in the ledger with timestamp and reference (e.g., which booking/wash it was for)

**1.5 — Remote start**
As a student, I want to start the wash cycle from my phone once I'm at the machine, so that I don't need to touch a physical panel.
- "Start wash" button enabled only within the booked slot's active window
- Sends start command to backend → backend triggers ESP32 relay
- Visual confirmation once the machine confirms it has actually started (not just "command sent")
- Failure state: if the machine doesn't respond within a set timeout, show an error and offer retry/contact support — the student must not be charged for a failed start

**1.6 — Notifications**
As a student, I want to be notified about my wash, flash slots, and support replies, so I don't have to keep checking the app.
- Wash-complete notification
- Flash slot alert (1.3) when a machine near them frees up unexpectedly
- Support ticket status updates (1.9)
- Notification preferences toggle for non-critical pings

**1.7 — Wash history & usage tracker**
As a student, I want to see my past washes and subscription usage, so that I know when to top up.
- List of past washes: date, machine, cost, payment source (wallet/UPI/split)
- Subscription progress indicator ("6 of 10 washes used this month")
- Days remaining until subscription renews/expires

**1.8 — Referral**
As a student, I want to invite friends and get rewarded, so that I have a reason to spread the word.
- Unique referral code/link per student
- Reward triggers only after the referred friend completes their first paid wash
- Referral status visible in-app: invited / joined / completed first wash / reward credited

**1.9 — Support tickets**
As a student, I want to raise a support ticket when something goes wrong, so that I get help without needing to find a phone number or email.
- Ticket categories: Payment/wallet issue, Machine malfunction, Booking/flash slot issue, ID verification issue, Other
- Optional photo attachment (useful for machine malfunction reports)
- Routing logic:
  - Machine malfunction, booking issues → routed to **College Admin** first (2.4), since it's location-specific
  - Payment/wallet and ID verification issues → routed to **Super Admin** directly (3.6), since these touch platform-wide financial/compliance data that College Admin shouldn't see
  - College Admin can escalate any ticket to Super Admin if unresolved
- Student sees ticket status (Open / In Progress / Resolved) and can add replies/comments to an open ticket
- Closed tickets remain visible in history for reference

**1.10 — Instant wash**
As a student, I want to wash immediately on a free machine without reserving a slot, so that I'm not forced through a booking flow when I'm already standing at the machine.
- Available only when a machine's current status is Free — not offered on In-use or Maintenance machines
- No booking fee — charges the regular wash price directly (from `pricing_config`, same source as per-wash pricing elsewhere)
- Creates the booking record already in **`started`** state — never enters `active`, so the 7-minute start window and forfeiture logic (story 1.3) don't apply to it structurally, not just by convention
- Uses a dedicated `start_instant_wash(machine_id)` RPC, separate from `create_booking` — pricing source and state-machine entry point genuinely differ, so this isn't a variant of the booking flow, it's its own entry point
- Still subject to the one-booking-at-a-time rule and the flash-slot guard (a student can't instant-wash a machine that currently has an open flash slot, to protect the ₹40 flash premium from being bypassed)
- Same wallet/UPI payment routing as slot booking (story 1.4)
- On the machine grid, a Free machine offers two actions: **"Wash now"** (this story) and **"Book a slot"** (story 1.3) — wash now is the primary/default action, booking is secondary, since most students arriving at a free machine want to start immediately

**1.11 — Pre-wash checklist (progressive disclosure)**
As a student, I want a quick reminder to actually load my clothes and detergent before the machine starts, so that I don't accidentally trigger a wash cycle on an empty or improperly loaded machine.
- Shown after instant-wash confirmation (1.10) *and* after tapping "Start wash" on an active booking (1.3) — before the remote-start trigger (1.5) fires. This is a real gate, not a dismissible tip.
- **Content — 4 steps, one line each**: "Open the door" → "Load your clothes" → "Add detergent" → "Close the door"
- Ends in a single confirmation checkbox (e.g. "Clothes & detergent loaded, door closed") — the Start Wash CTA stays disabled until checked
- **Progressive disclosure**: shown as a full illustrated carousel (one step per slide, placeholder line-icon per step for now — real artwork later, not a blocker) for a student's first few washes; collapses to a single quick-confirm row (compact icon strip of all 4 steps + one checkbox, no carousel) once they've passed a threshold
- Backend: `students.prewash_checklist_count` (integer, default 0), incremented server-side inside whichever RPC actually starts the wash (`start_instant_wash` or the booking-start RPC) — only on a real confirmed start, in the same transaction as the wash-start logic, so it can't be skipped or double-counted
- Threshold: `prewash_full_checklist_threshold` in `pricing_config`, default **3**, super-admin editable (same effective-dating pattern as booking fee / flash premium) — not hardcoded, so it can be tuned without an app update
- No reset on inactivity — once a student passes the threshold, they stay on the quick-confirm version permanently (simplest default; revisit only if real usage shows it's needed)
- Mobile: student's `prewash_checklist_count` is available via the existing AuthContext student fetch; compare against the threshold client-side to decide which version to render

---

## 2. College admin panel (web)

**2.1 — College dashboard (operational only — no revenue)**
As a college admin, I want an operational overview of machines and usage at my hostel, so that I can monitor things at a glance without seeing commercial/financial details that aren't mine to manage.
- Machine count, live status breakdown (free/in-use/maintenance)
- Daily/weekly/monthly wash **volume** (counts, not currency figures)
- No revenue, pricing, or payout figures shown here — that stays on the statement in 2.5 and within Super Admin only

**2.2 — Student roster & ID review**
As a college admin, I want to see verified students and review their uploaded college IDs, so that I can confirm they're legitimately affiliated with my hostel.
- List of students at this hostel: name, roll number (if provided), verification status
- View uploaded ID image per student
- Approve / reject verification, with a required reason on rejection
- Ability to flag a student for Super Admin review (e.g., suspected fraud) without unilaterally banning them

**2.3 — Wash logs & revenue statement**
As a college admin, I want to see wash logs and the resulting statement, so that I can reconcile what Washly owes us.
- Exportable wash log (date, machine, student reference)
- Monthly statement: utility reimbursement + facility fee + revenue share, per the flat-rate model
- This is the one place revenue figures are appropriate for a college admin to see, since it's literally their own settlement statement

**2.4 — Complaint / support ticket handling**
As a college admin, I want to see and resolve tickets routed to me, so that hostel-level issues get handled quickly.
- Ticket queue: Open / In Progress / Resolved, filtered to machine/booking-related categories (per 1.9 routing)
- Reply to student directly from the ticket
- Escalate to Super Admin if it's a hardware issue beyond local fix, or unresolved past a time threshold

**2.5 — Rent/facility statement**
As a college admin, I want a clear monthly statement, so that I can pass it to our finance office.
- Same content as 2.3's statement, exportable as PDF/CSV per month

---

## 3. Super admin panel (web)

**3.1 — Platform-wide dashboard**
As the founder/ops lead, I want a single view of the whole platform's health, so I can track growth and spot problems early.
- Total colleges live, total machines, total active students
- Revenue (laundry + booking fees + flash slot premiums) — daily/monthly, trending
- Machine uptime/maintenance flags across the network
- No-show / flash-slot conversion rate (useful signal for tuning the ₹10/₹40 pricing)

**3.2 — Onboard new college**
As the super admin, I want to add a new college to the platform, so that it goes live with correct configuration from day one.
- Create college record: name, location, hostel count, negotiated rent/facility terms
- Set initial machine count and installation schedule
- MOU status tracker (draft/signed/live)

**3.3 — Machine inventory management**
As the super admin, I want to track every machine's install date, AMC status, and maintenance history, so nothing falls through the cracks at scale.
- Machine record: college, install date, AMC expiry, last service date
- Flag machines overdue for AMC or showing repeated fault reports
- Bulk actions for adding machines during a new college rollout

**3.4 — Pricing & fee configuration**
As the super admin, I want to control all pricing centrally, so I can tune the model without needing an app update.
- Per-wash price, subscription tier pricing/allowances
- **Booking fee** (default ₹10) and **flash slot premium** (default ₹40) — both editable, platform-wide or per-college override
- Effective-dating so changes don't retroactively affect already-purchased subscriptions

**3.5 — User management & ID verification**
As the super admin, I want to manage the full user base including ID verification, so I can handle fraud, disputes, and support escalations.
- Search/filter all students across all colleges
- View uploaded ID images and verification status (mirrors 2.2, but platform-wide)
- Verify/flag/suspend accounts; override a College Admin's rejection if needed
- View a student's full activity (washes, bookings, no-shows, wallet ledger) for support/dispute purposes, with internal access logging given the sensitivity of this data

**3.6 — Support ticket escalation queue**
As the super admin, I want to see payment/wallet/ID tickets and anything escalated from colleges, so platform-level issues get resolved centrally.
- Queue scoped to: Payment/wallet issues, ID verification issues (routed directly per 1.9), plus anything escalated from College Admins
- Same reply/status flow as College Admin tickets, with visibility into wallet/payment data College Admin doesn't have

**3.7 — User categorization & targeted offers**
As the super admin, I want to segment users by quality/engagement, so that I can offer different deals to different groups instead of one-size-fits-all pricing.
- Segments driven by measurable signals: wash frequency, payment reliability (no-show/forfeiture rate), tenure, referral activity, ID verification status
- Both **rule-based auto-tagging** (e.g., "5+ washes/month for 2 months" → `Power User`) and **manual tag override** for edge cases
- Example segments: `New`, `Power User`, `At Risk / Low Activity`, `Frequent No-Show`, `High Referral Value`
- Ability to create a targeted offer (discount code, bonus wallet credit, subscription upgrade prompt) scoped to one or more segments
- Offer performance tracking: redemption rate per segment, so you can tell if a segment's behavior actually shifted

**3.8 — Notification system (mandatory)**
As the super admin, I want to send notifications to any slice of the user base, so I can communicate offers, alerts, and updates without needing an app update or manual per-user messaging.
- Compose: title, body, optional deep link (e.g., straight to a subscription offer or a specific machine)
- Targeting: All users / specific college / specific city / specific segment (from 3.7) / individual student (for ticket replies)
- Send immediately or schedule for later
- Notification log: what was sent, to whom, when, and delivery/open stats where trackable
- This is shared infrastructure — it's the same system that powers flash-slot alerts (1.3), support reply notifications (1.9), and targeted segment offers (3.7), not a separate one-off feature

---

## Deferred (not specified in depth yet)

Gig marketplace, wallet-earning flows, tier-based gig unlocks, and related gamification are intentionally left out of this pass. Revisit once the above core is live and wash-count/no-show/wallet data exists to design against.

**3.9 — Admin role management (RBAC)**
As the super admin, I want fine-grained roles for anyone with admin access, so that not everyone with admin access can do everything.
- Four roles on `admin_users.role`: `super_admin`, `operations_admin`, `support_admin`, `finance_admin`
- Enforced via RLS on `admin_users` and every table admin panels touch — not just hidden UI, since a Support Admin hand-editing pricing via direct API call must be blocked at the database level
- Role scope:
  - `super_admin`: full access, including managing other admin_users' roles
  - `operations_admin`: colleges (3.2), machines (3.3), pricing config (3.4)
  - `support_admin`: user management/ID verification (3.5), support tickets (3.6)
  - `finance_admin`: dashboard revenue figures (3.1), pricing config read-only, statements
- Only `super_admin` can create/edit/deactivate other admin_users records
- Every admin action (approve ID, edit pricing, resolve ticket, send notification) gets an audit log entry: which admin, which role, what action, timestamp
- Admin login is separate from student auth — needs its own `admin_users` table/session, not reusing the student phone-OTP flow
