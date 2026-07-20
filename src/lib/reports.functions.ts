import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Snapshot = {
  student: { id: string; full_name: string; student_number: string | null; photo_url: string | null };
  class: { class_name: string | null; class_level: string | null } | null;
  term: { term_name: string; academic_year: string | null };
  groups: { name: string; items: { title_dv: string; title_en: string | null; completed: boolean; teacher_note: string | null }[] }[];
  badges: { code: string; name: string; icon: string | null; color: string | null }[];
  teacher_comment: string;
  parent_feedback: { parent_comment?: string; parent_name?: string; signature_date?: string };
};

async function buildSnapshot(supabase: ReturnType<typeof import("@supabase/supabase-js").createClient>, studentId: string, termId: string): Promise<Snapshot> {
  const [{ data: student }, { data: term }, { data: assignments }] = await Promise.all([
    supabase.from("students").select("id, full_name, student_number, photo_url, class_id, classes(class_name, class_level)").eq("id", studentId).single(),
    supabase.from("academic_terms").select("term_name, academic_years(year_label)").eq("id", termId).single(),
    supabase.from("student_target_assignments")
      .select("status, target_template_items(title_dv, title_en, star_group, sort_order)")
      .eq("student_id", studentId).eq("term_id", termId),
  ]);
  const groupsMap: Record<string, Snapshot["groups"][number]["items"]> = {};
  for (const a of (assignments ?? []) as never[]) {
    const it = (a as { target_template_items: { title_dv: string; title_en: string | null; star_group: string | null; sort_order: number } }).target_template_items;
    const status = (a as { status: string }).status;
    const g = it?.star_group || "General";
    (groupsMap[g] ||= []).push({ title_dv: it.title_dv, title_en: it.title_en, completed: status === "completed", teacher_note: null });
  }
  const groups = Object.entries(groupsMap).map(([name, items]) => ({ name, items }));
  return {
    student: {
      id: (student as { id: string }).id,
      full_name: (student as { full_name: string }).full_name,
      student_number: (student as { student_number: string | null }).student_number,
      photo_url: (student as { photo_url: string | null }).photo_url,
    },
    class: (student as { classes: { class_name: string | null; class_level: string | null } | null }).classes,
    term: {
      term_name: (term as { term_name: string }).term_name,
      academic_year: (term as { academic_years: { year_label: string } | null } | null)?.academic_years?.year_label ?? null,
    },
    groups,
    badges: [],
    teacher_comment: "",
    parent_feedback: {},
  } as Snapshot;
}

/** Teacher/admin: save (or draft) a term report */
export const saveTermReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: {
    student_id: string;
    term_id: string;
    teacher_comment?: string;
    badge_ids?: string[];
    parent_comment?: string;
    parent_name?: string;
  }) => z.object({
    student_id: z.string().uuid(),
    term_id: z.string().uuid(),
    teacher_comment: z.string().max(4000).optional(),
    badge_ids: z.array(z.string().uuid()).optional(),
    parent_comment: z.string().max(2000).optional(),
    parent_name: z.string().max(200).optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Load existing (if any) — keep status stable
    const { data: existing } = await supabase.from("progress_reports")
      .select("id, status").eq("student_id", data.student_id).eq("term_id", data.term_id).maybeSingle();

    const payload = {
      student_id: data.student_id,
      term_id: data.term_id,
      teacher_comment: data.teacher_comment ?? "",
      parent_feedback: { parent_comment: data.parent_comment ?? "", parent_name: data.parent_name ?? "" },
      submitted_by: userId,
      submitted_at: new Date().toISOString(),
    };

    let reportId: string;
    if (existing?.id) {
      const { error } = await supabase.from("progress_reports").update(payload).eq("id", existing.id);
      if (error) throw new Error(error.message);
      reportId = existing.id;
    } else {
      const { data: row, error } = await supabase.from("progress_reports")
        .insert({ ...payload, status: "draft" }).select("id").single();
      if (error) throw new Error(error.message);
      reportId = (row as { id: string }).id;
    }

    // Sync badges for this student+term
    if (data.badge_ids) {
      await supabase.from("student_badges").delete().eq("student_id", data.student_id).eq("term_id", data.term_id);
      if (data.badge_ids.length) {
        const rows = data.badge_ids.map((badge_id) => ({
          student_id: data.student_id, term_id: data.term_id, badge_id, awarded_by: userId,
        }));
        const { error } = await supabase.from("student_badges").insert(rows);
        if (error) throw new Error(error.message);
      }
    }
    return { id: reportId };
  });

/** Admin: publish a report — freezes snapshot */
export const publishReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { student_id: string; term_id: string }) =>
    z.object({ student_id: z.string().uuid(), term_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Only admins can publish reports");

    // Build snapshot using authenticated client (RLS-safe reads)
    const snap = await buildSnapshot(context.supabase as never, data.student_id, data.term_id);

    // Enrich snapshot with badges + comments from DB
    const [{ data: sb }, { data: report }] = await Promise.all([
      context.supabase.from("student_badges").select("badges(code,name,icon,color)").eq("student_id", data.student_id).eq("term_id", data.term_id),
      context.supabase.from("progress_reports").select("teacher_comment, parent_feedback").eq("student_id", data.student_id).eq("term_id", data.term_id).maybeSingle(),
    ]);
    snap.badges = ((sb ?? []) as never[]).map((r) => (r as { badges: { code: string; name: string; icon: string | null; color: string | null } }).badges);
    snap.teacher_comment = (report as { teacher_comment: string | null } | null)?.teacher_comment ?? "";
    snap.parent_feedback = ((report as { parent_feedback: Snapshot["parent_feedback"] } | null)?.parent_feedback) ?? {};

    const { error } = await context.supabase.from("progress_reports").upsert({
      student_id: data.student_id,
      term_id: data.term_id,
      status: "published",
      snapshot: snap as unknown as Record<string, unknown>,
      teacher_comment: snap.teacher_comment,
      parent_feedback: snap.parent_feedback as unknown as Record<string, unknown>,
      published_by: context.userId,
      published_at: new Date().toISOString(),
    }, { onConflict: "student_id,term_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Admin: unpublish */
export const unpublishReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { report_id: string }) => z.object({ report_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { error } = await context.supabase.from("progress_reports")
      .update({ status: "draft", published_at: null, published_by: null })
      .eq("id", data.report_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Preview snapshot (draft) — used by teacher form / admin preview */
export const previewReportSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { student_id: string; term_id: string }) =>
    z.object({ student_id: z.string().uuid(), term_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    return buildSnapshot(context.supabase as never, data.student_id, data.term_id);
  });
