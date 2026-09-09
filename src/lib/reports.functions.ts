import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ReportSnapshot, ReportGroup } from "@/components/report-card-view";

async function buildSnapshot(
  supabaseAdmin: ReturnType<typeof import("@supabase/supabase-js").createClient>,
  studentId: string,
  termId: string,
): Promise<ReportSnapshot> {
  const [{ data: student }, { data: term }, { data: assignments }, { data: attendanceRows }] =
    await Promise.all([
      supabaseAdmin
        .from("students")
        .select(
          "id, full_name, student_number, photo_url, class_id, classes(class_name, class_level)",
        )
        .eq("id", studentId)
        .single(),
      supabaseAdmin
        .from("academic_terms")
        .select("term_name, academic_years(year_name)")
        .eq("id", termId)
        .single(),
      supabaseAdmin
        .from("student_target_assignments")
        .select(
          "current_status, status, completed_date, last_teacher_comment, target_template_items(id, title_dv, title_en, target_title, target_title_dhivehi, arabic_text, star_group, sort_order, display_order, section_id, target_template_sections(section_name, section_name_dhivehi, display_order))",
        )
        .eq("student_id", studentId)
        .eq("term_id", termId),
      supabaseAdmin.from("attendance_records").select("status").eq("student_id", studentId),
    ]);

  // Group assignments by section or star_group
  const groupsMap = new Map<string, ReportGroup>();

  for (const a of (assignments ?? []) as never[]) {
    const itemData = a as {
      current_status?: string;
      status?: string;
      completed_date?: string | null;
      last_teacher_comment?: string | null;
      target_template_items?: {
        id: string;
        title_dv?: string;
        title_en?: string | null;
        target_title?: string | null;
        target_title_dhivehi?: string | null;
        arabic_text?: string | null;
        star_group?: string | null;
        sort_order?: number;
        display_order?: number;
        target_template_sections?: {
          section_name: string;
          section_name_dhivehi?: string | null;
          display_order?: number;
        } | null;
      };
    };

    const it = itemData.target_template_items;
    const isCompleted = itemData.current_status === "completed" || itemData.status === "completed";
    const groupName =
      it?.target_template_sections?.section_name || it?.star_group || "General Targets";
    const groupNameDv = it?.target_template_sections?.section_name_dhivehi || null;

    if (!groupsMap.has(groupName)) {
      groupsMap.set(groupName, {
        name: groupName,
        name_dv: groupNameDv,
        items: [],
      });
    }

    groupsMap.get(groupName)!.items.push({
      title_dv: it?.target_title_dhivehi || it?.title_dv || "Target",
      title_en: it?.target_title || it?.title_en || null,
      arabic_text: it?.arabic_text ?? null,
      completed: isCompleted,
      achievement_status: isCompleted ? "completed" : itemData.current_status || "not_started",
      teacher_comment: itemData.last_teacher_comment ?? null,
      completed_date: itemData.completed_date ?? null,
      star: isCompleted,
    });
  }

  const groups = Array.from(groupsMap.values());

  // Compute attendance stats
  const totalDays = attendanceRows?.length ?? 0;
  const presentDays = attendanceRows?.filter((r) => r.status === "present").length ?? 0;
  const absentDays = attendanceRows?.filter((r) => r.status === "absent").length ?? 0;
  const lateDays = attendanceRows?.filter((r) => r.status === "late").length ?? 0;
  const attendanceRate =
    totalDays > 0 ? Math.round(((presentDays + lateDays) / totalDays) * 100) : 100;

  const s = student as unknown as {
    id: string;
    full_name: string;
    student_number: string | null;
    photo_url: string | null;
    classes: { class_name: string | null; class_level: string | null } | null;
  } | null;

  const tm = term as unknown as {
    term_name: string;
    academic_years: { year_name: string } | null;
  } | null;

  return {
    student: {
      id: s?.id ?? studentId,
      full_name: s?.full_name ?? "",
      student_number: s?.student_number ?? null,
      photo_url: s?.photo_url ?? null,
    },
    class: s?.classes ?? null,
    term: {
      term_name: tm?.term_name ?? "",
      academic_year: tm?.academic_years?.year_name ?? null,
    },
    attendance: {
      total_days: totalDays,
      present_days: presentDays,
      absent_days: absentDays,
      late_days: lateDays,
      attendance_rate: attendanceRate,
    },
    groups,
    badges: [],
    teacher_comment: "",
    parent_feedback: {},
  };
}

/** Validate term completion requirements (Section 15) */
export const validateTermReportCompletion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { student_id: string; term_id: string }) =>
    z.object({ student_id: z.string().uuid(), term_id: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Fetch assignments for student + term
    const { data: assignments } = await supabaseAdmin
      .from("student_target_assignments")
      .select(
        "id, current_status, attempt_count, last_teacher_comment, target_template_items(id, target_title, target_title_dhivehi, is_required)",
      )
      .eq("student_id", data.student_id)
      .eq("term_id", data.term_id);

    // Fetch open check requests
    const { data: openRequests } = await supabaseAdmin
      .from("target_check_requests")
      .select("id")
      .eq("student_id", data.student_id)
      .eq("term_id", data.term_id)
      .in("request_status", ["pending", "accepted", "under_checking"]);

    // Fetch report draft if exists
    const { data: report } = await supabaseAdmin
      .from("progress_reports")
      .select("teacher_comment")
      .eq("student_id", data.student_id)
      .eq("term_id", data.term_id)
      .maybeSingle();

    const total = assignments?.length ?? 0;
    const completed = assignments?.filter((a) => a.current_status === "completed").length ?? 0;
    const progressing = assignments?.filter((a) => a.current_status === "progressing").length ?? 0;
    const practiceAgain =
      assignments?.filter((a) => a.current_status === "practice_again").length ?? 0;
    const notStarted = assignments?.filter((a) => a.current_status === "not_started").length ?? 0;
    const exempted = assignments?.filter((a) => a.current_status === "exempted").length ?? 0;
    const pendingRequests = openRequests?.length ?? 0;

    const requiredWithoutResult =
      assignments?.filter(
        (a) =>
          (a as { target_template_items?: { is_required?: boolean } }).target_template_items
            ?.is_required &&
          a.current_status !== "completed" &&
          a.current_status !== "exempted",
      ).length ?? 0;

    const missingTeacherComment = !report?.teacher_comment?.trim();

    return {
      total,
      completed,
      progressing,
      practiceAgain,
      notStarted,
      exempted,
      pendingRequests,
      requiredWithoutResult,
      missingTeacherComment,
      canPublish: pendingRequests === 0 && total > 0,
    };
  });

/** Teacher/admin: save (or draft) a term report */
export const saveTermReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (i: {
      student_id: string;
      term_id: string;
      teacher_comment?: string;
      badge_ids?: string[];
      parent_comment?: string;
      parent_name?: string;
    }) =>
      z
        .object({
          student_id: z.string().uuid(),
          term_id: z.string().uuid(),
          teacher_comment: z.string().max(4000).optional(),
          badge_ids: z.array(z.string().uuid()).optional(),
          parent_comment: z.string().max(2000).optional(),
          parent_name: z.string().max(200).optional(),
        })
        .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Load existing (if any) — keep status stable
    const { data: existing } = await supabaseAdmin
      .from("progress_reports")
      .select("id, status")
      .eq("student_id", data.student_id)
      .eq("term_id", data.term_id)
      .maybeSingle();

    const payload = {
      student_id: data.student_id,
      term_id: data.term_id,
      teacher_comment: data.teacher_comment ?? "",
      parent_feedback: {
        parent_comment: data.parent_comment ?? "",
        parent_name: data.parent_name ?? "",
      },
      submitted_by: userId,
      submitted_at: new Date().toISOString(),
    };

    let reportId: string;
    if (existing?.id) {
      const { error } = await supabaseAdmin
        .from("progress_reports")
        .update(payload)
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
      reportId = existing.id;
    } else {
      const { data: row, error } = await supabaseAdmin
        .from("progress_reports")
        .insert({ ...payload, status: "draft" })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      reportId = (row as { id: string }).id;
    }

    // Sync badges for this student+term
    if (data.badge_ids) {
      await supabaseAdmin
        .from("student_badges")
        .delete()
        .eq("student_id", data.student_id)
        .eq("term_id", data.term_id);

      if (data.badge_ids.length) {
        const rows = data.badge_ids.map((badge_id) => ({
          student_id: data.student_id,
          term_id: data.term_id,
          badge_id,
          awarded_by: userId,
        }));
        const { error } = await supabaseAdmin.from("student_badges").insert(rows);
        if (error) throw new Error(error.message);
      }
    }
    return { id: reportId };
  });

/** Admin: publish a report — freezes immutable snapshot */
export const publishReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { student_id: string; term_id: string }) =>
    z.object({ student_id: z.string().uuid(), term_id: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Only admins can publish reports");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Build snapshot
    const snap = await buildSnapshot(supabaseAdmin, data.student_id, data.term_id);

    // Enrich snapshot with badges + comments from DB
    const [{ data: sb }, { data: report }] = await Promise.all([
      supabaseAdmin
        .from("student_badges")
        .select("badges(code,name,icon,color)")
        .eq("student_id", data.student_id)
        .eq("term_id", data.term_id),
      supabaseAdmin
        .from("progress_reports")
        .select("teacher_comment, parent_feedback")
        .eq("student_id", data.student_id)
        .eq("term_id", data.term_id)
        .maybeSingle(),
    ]);

    snap.badges = ((sb ?? []) as never[]).map(
      (r) =>
        (r as { badges: { code: string; name: string; icon: string | null; color: string | null } })
          .badges,
    );
    snap.teacher_comment = report?.teacher_comment ?? "";
    snap.parent_feedback = (report?.parent_feedback as never) ?? {};
    snap.published_at = new Date().toISOString();

    const { error } = await supabaseAdmin.from("progress_reports").upsert(
      {
        student_id: data.student_id,
        term_id: data.term_id,
        status: "published",
        snapshot: snap as never,
        teacher_comment: snap.teacher_comment,
        parent_feedback: snap.parent_feedback as never,
        published_by: context.userId,
        published_at: snap.published_at,
      },
      { onConflict: "student_id,term_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Admin: unpublish */
export const unpublishReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { report_id: string }) => z.object({ report_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("progress_reports")
      .update({ status: "draft", published_at: null, published_by: null })
      .eq("id", data.report_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Preview snapshot (draft) */
export const previewReportSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { student_id: string; term_id: string }) =>
    z.object({ student_id: z.string().uuid(), term_id: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return buildSnapshot(supabaseAdmin, data.student_id, data.term_id);
  });
