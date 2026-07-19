
# Simplified Targets & Report Card Module

Rebuild the Targets + Report Card modules to match the uploaded artifacts exactly, and make the day-to-day flow as light as possible for admin, teacher, and student.

## What the uploads tell us

- **6 class-level checklists** (Baby, Nursery, LKG, UKG, KS1, KS2–3) + a generic `check_list.pdf`. Each is a Dhivehi RTL list of ~10–25 target items grouped by theme (Quran reading, memorisation, duas, tajweed, surahs, akhlaq, etc.), used per term.
- **Sample report card is 5 A4 pages, Dhivehi RTL:**
  1. Cover — logo + student name + year
  2. Quran letters/duas grid — each item has a **red star = achieved**, empty circle = not yet
  3. Awards page — 6 fixed ribbon badges (Best All Round, Best Reciter, Discipline, Attendance, Best Handwriter, Best Book)
  4. Parent/guardian feedback + staff & guardian signatures
  5. Lessons list + Surahs to learn (per term)

The current spec's weighted % / performance-level engine is heavier than the sample card actually shows. The sample is a **binary star chart + fixed awards + signatures** — no numeric grades on the printed card.

## Simplification decisions

1. **Drop weighted-% performance engine from the printed report.** Keep it as an optional internal analytic only. The published PDF shows stars + awards + comments, matching the sample.
2. **Target status collapses to 3 values only:** `assigned` · `in_review` · `completed`. (Plus `needs_improvement` as an internal flag on the latest check attempt, not a target state.) No "Not Started / In Progress / Exempted / Not Achieved" — the sample doesn't need them.
3. **One check-request loop** (see §Flow) replaces the current teacher tracking UI. Same UI for teacher and student, different actions.
4. **Class-level target templates** — one template per class level (Baby / Nursery / LKG / UKG / KS1 / KS2–3) per term. Assigning a student to a class auto-assigns that class's template for the current term. No per-student bulk assign wizard needed for the common case; admin can still override individual targets.
5. **Badges = the 6 fixed ribbons from the sample**, seeded. Teachers tick which of the 6 the student earned this term; no complex auto-award rules.
6. **Report generation is one click.** When the term closes, admin hits "Generate Report" for a class → PDF is built from: completed targets (stars), teacher-selected badges, teacher/parent comments, term surahs list. No draft/review/return workflow — teacher fills comments in one form, admin publishes.

## Flow: student ↔ teacher check-request loop

```text
 assigned  ──student "Request check"──▶  in_review
                                            │
                     teacher opens request  │
                                            ▼
                    ┌───────────────────────┴──────────────────────┐
                    │                                              │
        "Needs improvement" + comment           "Mark completed" + optional comment
                    │                                              │
                    ▼                                              ▼
              assigned (again)                                completed  ★
        (student can request check again,
         history of attempts kept)
```

- Every request → response is one `target_check_attempts` row (student_note, teacher_note, outcome, timestamps). Full history visible to both sides on the target row.
- `student_target_assignments.status` is derived from the latest attempt.
- Completed targets flow straight into the report card as red stars.

## Screens (final set)

**Student**
- `student/my-targets` — grouped by term → category, each row: title (Dhivehi), status pill, "Request check" button (disabled while `in_review`), attempt history drawer.

**Teacher**
- `staff/check-requests` — inbox of `in_review` targets across their students, oldest first. One-tap Complete / Needs improvement + comment.
- `staff/term-report/:studentId` — per student per term: auto-filled star grid (read-only from completed targets), 6 badge checkboxes, teacher comment field, parent feedback fields, submit.

**Admin**
- `admin/target-templates` — 6 class-level templates × 2 terms. CRUD target items (Dhivehi title, category, order). This replaces the current "Targets" catalog UI.
- `admin/reports` — list by class/term, buttons: Generate PDF, Publish, Unpublish. No return-for-correction step.

## Data model changes (delta on current schema)

- **New:** `target_templates` (class_level, term_id, name), `target_template_items` (template_id, category_id, title_dv, order, star_grid_group nullable), `target_check_attempts` (assignment_id, student_note, teacher_note, outcome enum `completed`|`needs_improvement`, created_by, created_at).
- **Modify:** `targets` becomes a thin catalog referenced by template items (or drop `targets` and let template items be the source of truth — recommended, less indirection). `student_target_assignments`: keep, but derive `status` from latest attempt via a view/trigger. Drop `difficulty`, `points`, `evidence_url`, `score` from the assignment (unused by the sample).
- **New:** `progress_reports` snapshot JSON keyed by `(student_id, term_id)` — frozen on publish. Stores stars grid, badges array, comments, surahs list.
- **Seed:** 6 ribbon badges from page 3 of the sample; 6 class-level templates from the uploaded PDFs (I'll transcribe the Dhivehi target lists from each PDF during Phase 1).

## PDF renderer

- Server-side via `@react-pdf/renderer` inside a `createServerFn`. Faruma + Amiri fonts registered from Lovable Assets.
- 5-page layout mirrors the sample 1:1. Red star SVG for achieved, hollow circle for pending.
- Output stored in a private `progress-reports` bucket; student sees a "Download" button once published.

## Phased delivery

- **P1 — Schema + seed templates from PDFs.** Migration; transcribe the 6 checklists as template items; seed 6 ribbon badges. Retire unused columns from current tables.
- **P2 — Student My Targets + check-request action.**
- **P3 — Teacher check-requests inbox + mark completed/needs-improvement.**
- **P4 — Admin target-template editor.**
- **P5 — Term report form (teacher) + PDF renderer + publish.**
- **P6 — Student view of published report + PDF download.**

## Open questions (assumed unless you say otherwise)

1. **Drop the weighted % engine from the printed card** — kept as internal analytic only. OK?
2. **Auto-assign template on class assignment** — student inherits the current term's template for their class level, admin can override. OK?
3. **Awards are the 6 fixed ribbons only** (no custom badges for now). OK?
4. **Report publish is one step** (no "in review → return for correction"). OK?
5. I'll transcribe Dhivehi target text from the 6 uploaded PDFs during P1 seeding — say if you'd rather paste a clean list.

Reply "approve" to start P1, or tell me which of the four assumptions to change.
