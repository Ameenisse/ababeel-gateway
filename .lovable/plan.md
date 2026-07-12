
# Ababeel Quran Class — Build Plan

This is a large spec. I'll deliver it in phases so each is testable before moving on. All phases use Lovable Cloud (Supabase) for auth, database, storage, and RLS.

## Design direction
- Mobile-first, Islamic educational feel
- Palette: soft sky-blue primary, white surfaces, subtle gold accents; semantic tokens in `src/styles.css`
- Rounded cards, clear status badges (amber/green/red/blue/gray), large readable typography
- Distinctive display font (e.g. Amiri or Fraunces) + clean sans body (e.g. Plus Jakarta Sans) — not default Inter

## Roles & auth model
- Three roles via a separate `user_roles` table + `has_role()` SECURITY DEFINER function (no role columns on profiles)
- Admin/Staff login: email + password on hidden URLs `/admin`, `/staff`
- Student login: username + numeric PIN. Implemented as a server function that looks up `student_accounts` by username, verifies bcrypt PIN hash, then signs the user in via a paired synthetic email (`<username>@students.ababeel.local`) whose password is rotated on each PIN reset. This keeps everything inside Supabase Auth so RLS `auth.uid()` works uniformly.
- Route guards under `_authenticated/` layout + nested role-gated layouts (`_admin`, `_staff`, `_student`) redirecting mismatched roles

## Phase 1 — Foundation (this phase, first build)
1. Enable Lovable Cloud
2. Design tokens in `src/styles.css` (sky-blue/white/gold), typography via `<link>` in `__root.tsx`
3. Database migrations for all tables in section 22 + `user_roles` + `app_role` enum, with GRANTs and RLS policies
4. Seed rows: default `admission_settings`, empty website settings, suggested classes
5. Auth scaffolding: `_authenticated` layout, role sub-layouts, `has_role` RPC, server fns
6. Public landing page shell (header/hero/footer, only Student Login visible)
7. `/admin`, `/staff`, `/student-login` login pages with proper redirects
8. Admin dashboard shell + sidebar with all module links (empty pages stubbed)

## Phase 2 — Admissions
- Admission settings page (admin)
- Public admission form with rules gate, checkbox, validation, duplicate detection
- Admin admission requests table: filters, search, view/edit/notes, approve/reject/waitlist, CSV export, print
- Approval workflow: auto-create `students` + `student_accounts` + Supabase auth user, generate username + numeric PIN, show/edit credentials, copy/print

## Phase 3 — Students, Users, Classes, Staff
- Student directory + profile pages, status management, archive, print
- User management tabs (Student/Staff/Admin) with PIN reset, lock/unlock, activate
- Classes CRUD + assignments
- Staff panel + configurable permissions (stored in `staff_permissions` join table)

## Phase 4 — Competitions
- Competition + categories CRUD, banner upload, statuses, display date windowing
- Landing-page competition cards (only inside display window) + Rules modal
- Public participation form (rules gate, eligibility validation, duplicate protection)
- Logged-in student registration with autofill
- Competition Participants admin/staff page: approve/reject/waitlist, check-in, results
- Competition Results (publish/hide, student sees own)

## Phase 5 — Attendance, Announcements, Rules, Reports, Settings, Audit
- Attendance marking (staff), bulk, student/admin views, monthly/yearly reports
- Announcements CRUD with audience targeting and date windowing
- Rules management (versioned; agreement records store version + IP)
- Reports with filters, CSV + print-friendly PDF layout
- Website settings + system settings (PIN min length, etc.)
- Audit log writing via DB triggers + admin viewer

## Technical details

### Stack
TanStack Start + React 19 + Tailwind v4 + shadcn/ui + Lovable Cloud (Supabase). Server logic via `createServerFn` with `requireSupabaseAuth`; public webhooks n/a.

### Key tables & security
- Roles: `app_role` enum (`admin`,`staff`,`student`), `user_roles(user_id, role)`, `has_role(uuid, app_role)` SECURITY DEFINER
- All tables in spec section 22 created with explicit `GRANT` to `authenticated`/`service_role` (+ narrow `anon SELECT` only on: published announcements within date window, competitions within display window + their categories, admission_settings, website_settings)
- RLS: students see only their own rows via `auth.uid() = students.user_id`; staff limited via assigned classes; admin via `has_role(auth.uid(),'admin')`
- PIN hashing: `pgcrypto` `crypt()` with bcrypt in a `verify_student_pin` SECURITY DEFINER function; PIN never returned after creation
- Uploaded files: Supabase Storage buckets `admission-docs`, `competition-docs`, `student-photos`, `announcement-images`, `competition-banners` with size/type restrictions and RLS

### File additions (Phase 1)
- `src/styles.css` — new tokens
- `src/routes/__root.tsx` — real metadata + font `<link>`
- `src/routes/index.tsx` — landing page
- `src/routes/admin.tsx`, `src/routes/staff.tsx`, `src/routes/student-login.tsx` — login pages
- `src/routes/_authenticated/route.tsx` (integration-managed)
- `src/routes/_authenticated/_admin/route.tsx`, `.../dashboard.tsx`, plus stubs for each admin module
- `src/routes/_authenticated/_staff/route.tsx`, `.../dashboard.tsx`
- `src/routes/_authenticated/_student/route.tsx`, `.../dashboard.tsx`
- `src/lib/auth.functions.ts` (student PIN login server fn, role lookup)
- `src/components/app-sidebar.tsx`, header/footer, landing sections
- Migrations: `roles`, `profiles`, all spec tables, seed data

### Questions I'll assume unless you say otherwise
- Admin/Staff use email+password (not username); Student uses username+PIN
- Default PIN length = 4 (configurable in settings)
- Bootstrap admin: I'll add a one-time server fn that promotes the first signed-up user with a specific email to admin, then you rotate — OR you can tell me an admin email to seed
- Language: English only for now
- Currency for registration fees: MVR (Maldivian Rufiyaa) since spec mentions atoll/island

## Deliverable pace
I'll ship **Phase 1 first** end-to-end (working landing page + all three logins + role redirects + DB schema + admin dashboard shell), confirm it works, then proceed phase by phase. Each phase ends with a working, testable slice.

Reply "approve" to start Phase 1, or tell me what to change (scope, order, assumptions).
