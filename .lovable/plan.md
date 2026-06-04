# Implementation Plan

This is a large set of changes. I'll group them into 6 work blocks. Approve to proceed, or tell me which subset to start with.

---

## 1. Multi-branch scoping & multi-branch role assignments

**Today:** A user has one `branch_id` on `profiles`. Roles are flat in `user_roles`. Admins can't switch the branch they're viewing.

**Changes:**
- New table `user_branch_roles(user_id, branch_id, role)` — replaces the single `branch_id` on `profiles` as the source of truth for "which branches can I act in, and with what roles in each". A user can be assigned to 1+ branches, with same or different roles per branch.
- Keep `profiles.branch_id` as the user's *default/home* branch only.
- New `useBranchScope()` hook: returns `{ availableBranches, activeBranchId, setActiveBranchId, isAllBranches }`.
  - Admins / `view_all_branches`: can pick any branch, plus an "All branches" option.
  - Everyone else: can only pick from their assigned branches; no "All" option; if only 1 branch, picker is hidden.
- Branch picker dropdown lives in the top header (next to the notification bell) and persists in `localStorage`.
- Every list/report query (visits, visitors, pre-registrations, reports, dashboard) is filtered by `activeBranchId` — and additionally hard-clamped server-side to the user's allowed branches so a non-admin can't bypass the UI filter.
- Settings → Staff form: replace the single "Branch" dropdown with a repeatable "Branch + roles" block. Each row = one branch + checkboxes for roles in that branch. Admin role is global (not per-branch).

## 2. Host-only notification for pre-registration

**Today:** The DB trigger `notify_host_on_visit` already inserts a notification for the host on pre-registration (single recipient = `NEW.host_id`). But the bell currently shows all notifications for "everyone" because the client-side filter is wrong / overstay scanner fans out to all branch staff.

**Changes:**
- Tighten `notifications-bell.tsx` query to `recipient_id = me.userId` only.
- Keep overstay fan-out (that's a security alert), but scope it to staff in the same branch as the visit (already done in `scan_overstays`).
- No new notification rows for pre-reg are added for non-hosts.

## 3. Dashboard graphs

Add a new dashboard section with 4 charts (Recharts, already installed):
- **Monthly visitor trend** — line chart, last 12 months.
- **Visitor type distribution** — pie/donut (guest / supplier / contractor).
- **Department visit distribution** — bar, count by host's `profiles.department`.
- **Branch comparison** — bar, count per branch (hidden / single-bar for non-admins scoped to their branch).

All scoped by the active branch picker (block 1).

## 4. Expanded Reports module

Convert reports page into a tabbed report library. Each tab is a saved query + table + CSV export.

| Tab | Source |
|---|---|
| Visitors per day / week / month | `visits` grouped by date |
| Peak visitation times | `visits.check_in_at` by hour (chart already exists) |
| Most visited departments | `visits` joined to `profiles.department` |
| Most visited hosts | `visits` grouped by `host_id` |
| Frequent visitors | `visits` grouped by `visitor_id` |
| Frequent companies | `visits` grouped by `visitors.company` |
| Currently inside | `visits.status = 'checked_in'` |
| Overstayed | `status='checked_in' AND check_in_at + duration < now()` |
| Blacklisted visitors | `blacklist` joined to `visitors` |
| Unapproved entries | `approval = 'pending' OR approval = 'rejected'` |
| Visitor movement history | per-visitor timeline |
| Walk-ins vs pre-registered | `visit_mode` grouping |
| Host reports / Visits per employee | grouped by `host_id` |
| Visits per department | grouped by host department |
| Missed appointments | pre-registered, no check-in past expected time |
| Vehicle entries by date / company | `visit.vehicle_plate IS NOT NULL` |
| Visitor history by person / company | search-driven detail view |

All filtered by active branch + date range. CSV export on each tab.

## 5. QR self-registration kiosk

**Flow:**
1. Admin/front-desk opens `/settings → Kiosk` and gets a printable QR code that points to `/kiosk/<branch_id>` (public route, no auth).
2. Visitor scans → fills name, phone, company, ID, purpose, picks host from a dropdown of staff in that branch.
3. Submission creates a `visits` row with `status='pending'`, `approval='pending'`, `visit_mode='walk_in'`, `pre_registered=false`, `kiosk=true` (new column).
4. Two notifications are created:
   - To the **host** — "X has self-registered to see you. Approve?"
   - To **front-desk staff at that branch** — "Pending self-registration awaiting approval".
5. Either the host approves (→ front desk gets "ready to check in / issue badge" notification) **or** front desk approves directly (→ checks in + issues badge in one step).
6. Public route uses a TanStack server route under `/api/public/kiosk-register` with admin client + Zod validation + rate-limit by IP/phone.

**New:**
- `src/routes/kiosk.$branchId.tsx` — public self-registration form.
- `src/routes/api/public/kiosk-register.ts` — server route to insert.
- `src/lib/kiosk-qr.functions.ts` — generates the QR (using `qrcode` npm package) for the printable page at `/settings`.
- `visits.kiosk_self_registered boolean default false` column.

---

## Technical notes (skip if not interested)

- New migration adds `user_branch_roles` table with GRANTs + RLS, plus `visits.kiosk_self_registered`.
- `useCurrentUser()` extended with `allowedBranchIds: string[]` and `rolesByBranch: Record<branch_id, Role[]>`.
- A new `has(role, branchId?)` helper replaces global `has(role)` — global roles (admin, manage_staff, manage_branches) ignore branchId; operational roles (register_guest, checkout_visitor, view_reports, etc.) require a matching `(role, activeBranch)` entry.
- Sidebar and per-page permission checks updated to use the scoped helper.
- All Supabase reads in pages filtered with `.in('branch_id', allowedBranchIds)` for non-admins, and `.eq('branch_id', activeBranchId)` when a specific branch is picked.

---

## Suggested execution order

1. Block 1 (branches + roles) — foundation everything else depends on.
2. Block 2 (host-only notif) — small.
3. Block 3 (dashboard graphs).
4. Block 4 (reports tabs).
5. Block 5 (QR kiosk).

**Do you want me to proceed with all 5 blocks in order, or start with a subset?**
