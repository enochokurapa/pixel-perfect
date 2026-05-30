## Goal
Extend the existing VMS to support multiple site types (corporate, school) and add a full Student Movement & Pickup Control module for schools, plus a Guardian portal — while keeping all existing visitor management features intact.

## 1. Data model (new migration)

Add to `branches`:
- `site_type` enum: `corporate` | `school` (default `corporate`)

New `app_role` enum values:
- `teacher`, `school_admin`, `gate_officer`, `guardian`
- `manage_students`, `check_in_student`, `approve_pickup`, `view_student_reports`

New tables (all with GRANTs + RLS):
- `students` — id, student_code, full_name, class, photo_url, branch_id (= site), created_at
- `guardians` — id, user_id (FK to auth.users, nullable until portal account created), full_name, phone, email, created_at
- `student_guardians` — student_id, guardian_id, relation, is_primary (many-to-many; supports `assigned_guardian_id` via `is_primary`)
- `attendance_logs` — id, student_id, check_in_at, check_in_method (`van|parent|walking|other`), checked_in_by (profile id), check_out_at, checked_out_by, pickup_request_id, branch_id
- `pickup_requests` — id, student_id, branch_id, pickup_person_name, pickup_person_phone, vehicle_plate, pickup_person_photo_url, requested_at, status (`pending|approved|rejected|expired`), guardian_id, requested_by (gate staff profile), responded_at, rejection_reason
- `pickup_response_tokens` — id, pickup_request_id, token (unique), expires_at (request_time + 30 min), used_at, response (`approved|rejected`)
- new notification types: `student_arrival`, `pickup_approval_request`, `pickup_approved`, `pickup_rejected`

New storage bucket: `student-photos` (private) and `pickup-photos` (private).

DB trigger: prevent `attendance_logs.check_out_at` update unless a linked `pickup_request.status='approved'` exists OR `check_in_method='walking'` policy allows (configurable per branch — default block).

## 2. Server functions (`src/lib/`)

- `students.functions.ts` — CRUD students, list by branch.
- `guardians.functions.ts` — create guardian + invite to portal (creates Supabase auth user with `guardian` role), link to students.
- `attendance.functions.ts` — `checkInStudent` (writes log, enqueues guardian email), `checkOutStudent` (enforces approved pickup).
- `pickup.functions.ts` — `createPickupRequest` (uploads photo, generates token, emails primary guardian), `respondToPickup` (token-based, public, single-use, 30-min expiry).
- Reuse existing email queue (`send-transactional-email`) with new templates: `student-arrival`, `pickup-approval-request`, `pickup-decision`.

## 3. Public API route

`src/routes/api/public/pickup-response.$token.tsx` — landing page guardians hit from the email; lets them Approve/Reject without logging in (token-gated, single use, 30 min).

## 4. Permissions (`src/lib/permissions.ts`)

New group **School** (only meaningful when current branch.site_type='school'):
- `school_admin`, `teacher`, `gate_officer`, `guardian`
- `manage_students`, `check_in_student`, `approve_pickup` (staff override, optional), `view_student_reports`

Existing VMS roles remain — schools still use them for visitor/parent/supplier visits.

## 5. UI

Conditional on the current user's `branch.site_type`:
- **Corporate branch** → unchanged (current dashboard only).
- **School branch** → sidebar adds:
  - `Students` (list/create/edit, assign guardians)
  - `Attendance` (check-in form: pick student, method; today's log; reports)
  - `Pickup Control` (create request with photo capture, live status of pending/approved/rejected, blocks checkout if not approved)
  - `Guardians` (admin)
- **Guardian portal** (role=`guardian`, no other staff roles): separate minimal layout at `/portal`
  - Pending pickup approvals (approve/reject inline)
  - My children → attendance history
  - Past approvals audit trail

## 6. Reports (school mode)

Extend existing Reports page with tabs when site_type=school:
- Student attendance (daily/weekly/monthly, Excel + PDF)
- Pickup approvals/rejections
- Late pickups & unapproved attempts
- Visitor logs (existing, kept separate)

## 7. Notifications

Reuse existing notifications table + add transactional emails via the existing scaffolded infrastructure. Tokens expire after 30 min and are single-use (enforced in `respondToPickup`).

## 8. What stays exactly as-is
- All existing VMS tables, flows, dashboards, exports, roles, blacklist, badges.
- Existing settings role checklist — School roles appear as a new group, not replacing anything.

---

This is a sizable build (~1 migration, ~6 new server-fn modules, ~6 new routes, 1 public page, ~3 email templates, permissions + sidebar wiring). I'll implement it in that order in the next turn after you approve. Confirm and I'll proceed.