
# Academic Progress, Targets & Reports — Build Plan

This is a very large spec (13 new tables, 6 new modules, 3 role workflows). I'll ship it in phases so each is testable before moving on. All work respects the existing Phase 1 foundation (roles, RLS, `has_role`, `_authenticated` layout) and the still-pending Phase 2 admissions module from the original plan.

Because the spec depends on admission approval creating a student, **Phase A wraps the outstanding admission-approval workflow first** — otherwise there is no student to target.

## Phase A — Approved admission → student (spec §1, §25)

Server-side approval RPC (`approve_admission_request`) runs in one transaction:
- guard: request must be `pending` and not already linked
- create auth user (synthetic email), row in `students` (copying admission fields), `student_accounts` (username + hashed PIN via `pgcrypto`), `user_roles`
- write `linked_student_id` on the admission request to enforce single-use
- return generated username + one-time PIN for the admin UI to copy/print

Admin Admissions page gets Approve/Reject/Waitlist actions and a credentials modal. Approved students appear immediately in Student Management, Class Assignment, Target Assignment, and (once class-assigned) staff & attendance lists.

## Phase B — Academic structure (§4, §23)

New tables: `academic_years`, `academic_terms`, `student_class_assignments` (with `is_current`, main/assistant teacher, session).

Admin modules:
- Academic Years CRUD, one `is_current`
- Terms CRUD scoped to a year (First / Second seeded), status Draft/Active/Completed/Archived, target-open + deadline + report-available dates
- Class Assignment page: assign year/class/session/main+assistant teacher/current term to a student; historical rows preserved; teacher visibility derives from the current assignment

## Phase C — Target catalog (§5, §6, §23)

Tables: `target_categories`, `targets`, `badges`.

Admin modules:
- **Target Categories** — CRUD, reorder, activate, restrict to classes/terms, archive-instead-of-delete when in use. Seeded with the 13 suggested categories.
- **Targets** — CRUD, duplicate, archive, difficulty/points/badge/display_order, CSV import/export, filtered by category/class/year/term.
- **Badges** — CRUD, auto vs manual award, thresholds (min completed targets, min points), category/term scope.

## Phase D — Target assignment & tracking (§7, §8, §9, §10, §11)

Tables: `student_target_assignments` (unique on student+year+term+target), `student_target_history` (trigger-populated on status/comment/date change).

Admin **Target Assignment** page:
- filters: year, term, class, category
- assign methods: single student, multi-select, whole class, whole year, copy from previous term, copy from another student, saved template

Staff **Target Tracking** page (mobile-first card list):
- teacher sees only students in classes where they are main/assistant teacher on the current assignment
- statuses: Not Started / In Progress / Completed / Needs Improvement / Not Achieved / Exempted
- quick actions + bulk actions (bulk still writes per-row completion date + updater)
- Complete requires completion_date (default today) + teacher comment
- optional evidence (file upload to `target-evidence` bucket), score, remarks

Student **My Targets** — read-only, grouped by year → term → category, per-term progress bar.

Every write goes through a server function using `requireSupabaseAuth`; DB trigger writes history and enforces teacher-scope via `has_role` + assignment lookup.

## Phase E — Assessments, badges & performance (§12, §13, §14, §15)

Tables: `teacher_term_assessments` (unique on student+year+term), `student_badges`, `performance_settings` (singleton row).

- Teacher **Term Assessment** form (draft-save, all comment fields, overall level, signature name)
- **Complete Term Report** action: validates all required targets have a status, required comments filled, then locks the assessment (`report_status = completed`) and creates/updates a `progress_reports` row
- **Performance calculator** (SQL function): weights from `performance_settings`; exempted targets excluded from denominator; returns totals, %s, level
- **Badge engine**: SQL function evaluates auto-award badges after every target status change; manual awards via teacher UI; admin approval gate before visibility
- Admin **Performance Settings** page: weights, level thresholds, auto-publish toggle, require-admin-approval toggle

## Phase F — Progress reports (§16, §17, §18, §20)

Table: `progress_reports` (one per student/year/term).

- Admin **Progress Reports** list with filters (year/term/class/teacher/status) + review actions: Approve, Return for Correction, Publish/Unpublish, Archive, Print, Export PDF
- Report renderer: parent-friendly A4 print layout — header (logo, student, class), performance summary, targets grouped by category with status icons, teacher comments block, achievements/badges, signature areas
- Student **My Progress**: current year, first-term + second-term cards, only shows a term once its report `status = published`; View / Print / Download PDF
- Status flow: Draft → In Review → Completed → Published (or Returned for Correction / Archived); teachers write draft & submit; admins publish
- PDF generated server-side on publish (stored in `progress-reports` bucket) so download is instant and stable

## Phase G — Notifications & analytics (§21, §22)

- `notifications` table + in-dashboard bell for teachers/admins/students with the event set from §21
- Admin analytics tiles: completion by class/term/category, top performers, students needing support, teacher report progress, badge counts — with year/term/class/teacher/category filters

## Technical details

- **RLS everywhere.** Student rows scoped to `auth.uid() = students.user_id`. Teacher rows scoped through `student_class_assignments` where teacher is main/assistant AND `is_current`. Admin via `has_role(auth.uid(),'admin')`. History and audit tables: admin-only SELECT; teachers see rows for students in their scope; students never see history.
- **All mutating logic in `createServerFn` handlers with `requireSupabaseAuth`.** SQL functions used for: `approve_admission_request`, `recalculate_student_performance(student, year, term)`, `evaluate_auto_badges(student, year, term)`, and target-history trigger.
- **Storage buckets** (created via storage tool, not SQL): `target-evidence` (private, teacher/admin/student-owner read), `progress-reports` (private, admin write, student-owner read on publish), `badge-icons` (public read).
- **Uniqueness constraints** as in §23: `(student, year, term, target)` on assignments and `(student, year, term)` on assessments.
- **Term separation.** Every performance query, badge query, and report row is keyed by `(academic_year_id, term_id)` — no cross-term aggregation.
- **Grants.** Every new public-schema table gets explicit GRANTs to `authenticated` and `service_role` in the same migration.
- **Types.** All new enums added as Postgres `enum`s (`target_status`, `target_difficulty`, `term_status`, `report_status`, `performance_level`, `badge_award_method`, `badge_approval_status`).

## Delivery pace

Ship phases in order; each phase ends in a working, testable slice. Phases A–B and C are prerequisites for D onward. Estimated iterations: A (1 turn), B (1), C (1–2), D (2), E (1–2), F (1–2), G (1).

## Open questions (I'll assume these unless you say otherwise)

1. **Default academic year** — I'll seed `2026–2027` as current; edit anytime.
2. **PDF renderer** — server-side HTML → PDF via a Worker-compatible library (no Chromium). Layout will match §16 exactly. If you'd rather use browser print-to-PDF from the student view, say so.
3. **Publishing** — default `require_admin_approval = true`, `auto_publish_after_teacher_completion = false`. Toggle in Performance Settings.
4. **Attendance %** — pulled from the existing `attendance` table filtered by term dates. If you want a different formula, tell me.
5. **Notifications delivery** — in-app only for now (per §21 "display inside the dashboard"). Email/SMS can come later.

Reply "approve" to start Phase A, or tell me which phase to start with / what to change.
