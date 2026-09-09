import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { TargetStatus, CheckResult } from "@/types/targets";

/** Admin: create template */
export const createTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (i: {
      class_level: string;
      term_id: string;
      name: string;
      class_id?: string | null;
      academic_year_id?: string | null;
      description?: string | null;
    }) =>
      z
        .object({
          class_level: z.enum(["baby", "nursery", "lkg", "ukg", "ks1", "ks2_3"]),
          term_id: z.string().uuid(),
          name: z.string().min(1),
          class_id: z.string().uuid().nullish(),
          academic_year_id: z.string().uuid().nullish(),
          description: z.string().nullish(),
        })
        .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("target_templates")
      .insert({
        class_level: data.class_level,
        term_id: data.term_id,
        name: data.name,
        template_name: data.name,
        class_id: data.class_id ?? null,
        academic_year_id: data.academic_year_id ?? null,
        description: data.description ?? null,
        created_by: context.userId,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

/** Admin: update template */
export const updateTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (i: {
      id: string;
      name: string;
      class_level: string;
      term_id: string;
      class_id?: string | null;
      academic_year_id?: string | null;
      description?: string | null;
      status?: string;
    }) =>
      z
        .object({
          id: z.string().uuid(),
          name: z.string().min(1),
          class_level: z.enum(["baby", "nursery", "lkg", "ukg", "ks1", "ks2_3"]),
          term_id: z.string().uuid(),
          class_id: z.string().uuid().nullish(),
          academic_year_id: z.string().uuid().nullish(),
          description: z.string().nullish(),
          status: z.string().default("active"),
        })
        .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("target_templates")
      .update({
        name: data.name,
        template_name: data.name,
        class_level: data.class_level,
        term_id: data.term_id,
        class_id: data.class_id ?? null,
        academic_year_id: data.academic_year_id ?? null,
        description: data.description ?? null,
        status: data.status,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Admin: duplicate a template with all sections and items */
export const duplicateTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { template_id: string; new_name: string; target_term_id?: string | null }) =>
    z
      .object({
        template_id: z.string().uuid(),
        new_name: z.string().min(1),
        target_term_id: z.string().uuid().nullish(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: original, error: origErr } = await supabaseAdmin
      .from("target_templates")
      .select("*")
      .eq("id", data.template_id)
      .single();
    if (origErr || !original) throw new Error("Template not found");

    const { data: newTpl, error: newErr } = await supabaseAdmin
      .from("target_templates")
      .insert({
        name: data.new_name,
        template_name: data.new_name,
        class_level: original.class_level,
        class_id: original.class_id,
        academic_year_id: original.academic_year_id,
        term_id: data.target_term_id ?? original.term_id,
        description: original.description,
        version_number: (original.version_number ?? 1) + 1,
        created_by: context.userId,
      })
      .select("*")
      .single();
    if (newErr || !newTpl) throw new Error(newErr?.message ?? "Failed to duplicate template");

    // Copy sections
    const { data: sections } = await supabaseAdmin
      .from("target_template_sections")
      .select("*")
      .eq("target_template_id", data.template_id);

    const sectionMap = new Map<string, string>();
    for (const sec of sections ?? []) {
      const { data: newSec } = await supabaseAdmin
        .from("target_template_sections")
        .insert({
          target_template_id: newTpl.id,
          section_name: sec.section_name,
          section_name_dhivehi: sec.section_name_dhivehi,
          section_type: sec.section_type,
          display_order: sec.display_order,
          status: sec.status,
        })
        .select("id")
        .single();
      if (newSec?.id) sectionMap.set(sec.id, newSec.id);
    }

    // Copy items
    const { data: items } = await supabaseAdmin
      .from("target_template_items")
      .select("*")
      .eq("template_id", data.template_id);

    for (const it of items ?? []) {
      await supabaseAdmin.from("target_template_items").insert({
        template_id: newTpl.id,
        section_id: it.section_id ? (sectionMap.get(it.section_id) ?? null) : null,
        category_id: it.category_id,
        target_code: it.target_code,
        target_title: it.target_title ?? it.title_en,
        target_title_dhivehi: it.target_title_dhivehi ?? it.title_dv,
        title_dv: it.title_dv ?? it.target_title_dhivehi,
        title_en: it.title_en ?? it.target_title,
        arabic_text: it.arabic_text,
        description: it.description,
        instructions: it.instructions,
        is_required: it.is_required ?? true,
        default_points: it.default_points ?? 1,
        display_order: it.display_order ?? it.sort_order ?? 0,
        sort_order: it.sort_order ?? it.display_order ?? 0,
        star_group: it.star_group,
        is_active: it.is_active ?? true,
      });
    }

    return { id: newTpl.id };
  });

/** Admin: upsert template section */
export const upsertSection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (i: {
      id?: string;
      target_template_id: string;
      section_name: string;
      section_name_dhivehi?: string | null;
      section_type?: string | null;
      display_order?: number;
      status?: string;
    }) =>
      z
        .object({
          id: z.string().uuid().optional(),
          target_template_id: z.string().uuid(),
          section_name: z.string().min(1),
          section_name_dhivehi: z.string().nullish(),
          section_type: z.string().nullish(),
          display_order: z.number().int().default(0),
          status: z.string().default("active"),
        })
        .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    if (data.id) {
      const { error } = await supabase
        .from("target_template_sections")
        .update({
          section_name: data.section_name,
          section_name_dhivehi: data.section_name_dhivehi ?? null,
          section_type: data.section_type ?? null,
          display_order: data.display_order ?? 0,
          status: data.status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("target_template_sections").insert({
        target_template_id: data.target_template_id,
        section_name: data.section_name,
        section_name_dhivehi: data.section_name_dhivehi ?? null,
        section_type: data.section_type ?? null,
        display_order: data.display_order ?? 0,
        status: data.status,
      });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

/** Admin: delete template section */
export const deleteSection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("target_template_sections")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Admin: create or update a template item */
export const upsertTemplateItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (i: {
      id?: string;
      template_id: string;
      section_id?: string | null;
      category_id?: string | null;
      target_code?: string | null;
      target_title?: string | null;
      target_title_dhivehi: string;
      title_dv?: string;
      title_en?: string | null;
      arabic_text?: string | null;
      description?: string | null;
      instructions?: string | null;
      star_group?: string | null;
      is_required?: boolean;
      default_points?: number;
      display_order?: number;
      sort_order?: number;
      is_active?: boolean;
    }) =>
      z
        .object({
          id: z.string().uuid().optional(),
          template_id: z.string().uuid(),
          section_id: z.string().uuid().nullish(),
          category_id: z.string().uuid().nullish(),
          target_code: z.string().nullish(),
          target_title: z.string().nullish(),
          target_title_dhivehi: z.string().min(1),
          title_dv: z.string().nullish(),
          title_en: z.string().nullish(),
          arabic_text: z.string().nullish(),
          description: z.string().nullish(),
          instructions: z.string().nullish(),
          star_group: z.string().nullish(),
          is_required: z.boolean().default(true),
          default_points: z.number().default(1),
          display_order: z.number().int().default(0),
          sort_order: z.number().int().default(0),
          is_active: z.boolean().default(true),
        })
        .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const titleDv = data.target_title_dhivehi || data.title_dv || "";
    const titleEn = data.target_title || data.title_en || null;
    const order = data.display_order ?? data.sort_order ?? 0;

    const payload = {
      template_id: data.template_id,
      section_id: data.section_id ?? null,
      category_id: data.category_id ?? null,
      target_code: data.target_code ?? null,
      target_title: titleEn,
      target_title_dhivehi: titleDv,
      title_dv: titleDv,
      title_en: titleEn,
      arabic_text: data.arabic_text ?? null,
      description: data.description ?? null,
      instructions: data.instructions ?? null,
      star_group: data.star_group ?? null,
      is_required: data.is_required ?? true,
      default_points: data.default_points ?? 1,
      display_order: order,
      sort_order: order,
      is_active: data.is_active ?? true,
      updated_at: new Date().toISOString(),
    };

    if (data.id) {
      const { error } = await supabase
        .from("target_template_items")
        .update(payload)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("target_template_items").insert(payload);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

/** Admin: delete template item */
export const deleteTemplateItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("target_template_items")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Admin: apply whole template to class or matching level */
export const applyTemplateToStudents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { template_id: string; target_class_id?: string | null }) =>
    z
      .object({ template_id: z.string().uuid(), target_class_id: z.string().uuid().nullish() })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: tpl, error: tplErr } = await supabaseAdmin
      .from("target_templates")
      .select("*")
      .eq("id", data.template_id)
      .single();
    if (tplErr || !tpl) throw new Error(tplErr?.message ?? "Template not found");

    const { data: items } = await supabaseAdmin
      .from("target_template_items")
      .select("id")
      .eq("template_id", data.template_id)
      .eq("is_active", true);
    if (!items?.length) return { assigned: 0 };

    let classIds: string[] = [];
    if (data.target_class_id) {
      classIds = [data.target_class_id];
    } else if (tpl.class_id) {
      classIds = [tpl.class_id];
    } else {
      const { data: classes } = await supabaseAdmin
        .from("classes")
        .select("id")
        .eq("class_level", tpl.class_level);
      classIds = (classes ?? []).map((c) => c.id);
    }
    if (!classIds.length) return { assigned: 0 };

    const { data: students } = await supabaseAdmin
      .from("students")
      .select("id, class_id")
      .in("class_id", classIds)
      .eq("status", "active");

    const rows: {
      student_id: string;
      term_id: string;
      template_item_id: string;
      template_id: string;
      class_id: string | null;
      academic_year_id: string | null;
      current_status: TargetStatus;
      assigned_by: string;
    }[] = [];

    for (const s of students ?? []) {
      for (const it of items) {
        rows.push({
          student_id: s.id,
          term_id: tpl.term_id,
          template_item_id: it.id,
          template_id: tpl.id,
          class_id: s.class_id ?? null,
          academic_year_id: tpl.academic_year_id ?? null,
          current_status: "not_started",
          assigned_by: context.userId,
        });
      }
    }
    if (!rows.length) return { assigned: 0 };

    const { error: insErr } = await supabaseAdmin
      .from("student_target_assignments")
      .upsert(rows, { onConflict: "student_id,term_id,template_item_id", ignoreDuplicates: true });
    if (insErr) throw new Error(insErr.message);
    return { assigned: rows.length };
  });

/** Student: submit a check request */
export const submitTargetCheckRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (i: {
      assignment_id: string;
      student_message?: string | null;
      preferred_check_date?: string | null;
    }) =>
      z
        .object({
          assignment_id: z.string().uuid(),
          student_message: z.string().max(1000).nullish(),
          preferred_check_date: z.string().nullish(),
        })
        .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Fetch assignment and verify ownership
    const { data: assignment, error: aErr } = await supabaseAdmin
      .from("student_target_assignments")
      .select("id, student_id, term_id, class_id, academic_year_id, current_status, status")
      .eq("id", data.assignment_id)
      .single();

    if (aErr || !assignment) throw new Error("Assignment not found");

    // Ensure user is the student
    const { data: student } = await supabaseAdmin
      .from("students")
      .select("id, full_name, user_id")
      .eq("id", assignment.student_id)
      .single();

    if (student?.user_id !== userId) {
      // Check if admin
      const { data: isAdmin } = await supabase.rpc("has_role", {
        _user_id: userId,
        _role: "admin",
      });
      if (!isAdmin) throw new Error("Unauthorized to request check for this target");
    }

    if (assignment.current_status === "completed") {
      throw new Error("Target is already completed");
    }
    if (assignment.current_status === "exempted") {
      throw new Error("Target is exempted");
    }

    // Check if open request already exists
    const { data: openReq } = await supabaseAdmin
      .from("target_check_requests")
      .select("id")
      .eq("student_target_assignment_id", data.assignment_id)
      .in("request_status", ["pending", "accepted", "under_checking"])
      .maybeSingle();

    if (openReq) {
      throw new Error("A check request is already open for this target");
    }

    // Insert new check request
    const { data: newReq, error: reqErr } = await supabaseAdmin
      .from("target_check_requests")
      .insert({
        student_target_assignment_id: data.assignment_id,
        student_id: assignment.student_id,
        term_id: assignment.term_id,
        class_id: assignment.class_id,
        academic_year_id: assignment.academic_year_id,
        requested_by: userId,
        student_message: data.student_message ?? null,
        preferred_check_date: data.preferred_check_date ?? null,
        request_status: "pending",
      })
      .select("id")
      .single();

    if (reqErr || !newReq) throw new Error(reqErr?.message ?? "Failed to create check request");

    // Update assignment status
    await supabaseAdmin
      .from("student_target_assignments")
      .update({
        previous_status: assignment.current_status,
        current_status: "check_requested",
        status: "in_review",
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.assignment_id);

    // Record history
    await supabaseAdmin.from("target_status_history").insert({
      student_target_assignment_id: data.assignment_id,
      previous_status: assignment.current_status,
      new_status: "check_requested",
      related_check_request_id: newReq.id,
      changed_by: userId,
      change_reason: "Student submitted check request",
    });

    return { ok: true, request_id: newReq.id };
  });

/** Student: cancel a pending check request */
export const cancelTargetCheckRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { request_id: string; reason?: string | null }) =>
    z
      .object({
        request_id: z.string().uuid(),
        reason: z.string().max(500).nullish(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: req, error: reqErr } = await supabaseAdmin
      .from("target_check_requests")
      .select("id, student_target_assignment_id, student_id, request_status")
      .eq("id", data.request_id)
      .single();

    if (reqErr || !req) throw new Error("Request not found");
    if (req.request_status !== "pending") {
      throw new Error("Only pending check requests can be cancelled");
    }

    // Cancel request
    await supabaseAdmin
      .from("target_check_requests")
      .update({
        request_status: "cancelled",
        cancelled_at: new Date().toISOString(),
        cancellation_reason: data.reason ?? "Cancelled by student",
        closed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.request_id);

    // Get previous status or default to practicing
    const { data: assignment } = await supabaseAdmin
      .from("student_target_assignments")
      .select("previous_status")
      .eq("id", req.student_target_assignment_id)
      .single();

    const restoredStatus: TargetStatus =
      assignment?.previous_status === "not_started" ? "not_started" : "practicing";

    await supabaseAdmin
      .from("student_target_assignments")
      .update({
        current_status: restoredStatus,
        status: "assigned",
        updated_at: new Date().toISOString(),
      })
      .eq("id", req.student_target_assignment_id);

    // Record history
    await supabaseAdmin.from("target_status_history").insert({
      student_target_assignment_id: req.student_target_assignment_id,
      previous_status: "check_requested",
      new_status: restoredStatus,
      related_check_request_id: req.id,
      changed_by: userId,
      change_reason: data.reason ?? "Student cancelled check request",
    });

    return { ok: true };
  });

/** Teacher: accept check request into under_checking */
export const acceptTargetCheckRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { request_id: string }) =>
    z.object({ request_id: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: req, error: reqErr } = await supabaseAdmin
      .from("target_check_requests")
      .select("id, student_target_assignment_id, request_status")
      .eq("id", data.request_id)
      .single();

    if (reqErr || !req) throw new Error("Request not found");

    await supabaseAdmin
      .from("target_check_requests")
      .update({
        request_status: "under_checking",
        accepted_by: userId,
        accepted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.request_id);

    await supabaseAdmin
      .from("student_target_assignments")
      .update({
        current_status: "under_checking",
        updated_at: new Date().toISOString(),
      })
      .eq("id", req.student_target_assignment_id);

    await supabaseAdmin.from("target_status_history").insert({
      student_target_assignment_id: req.student_target_assignment_id,
      previous_status: "check_requested",
      new_status: "under_checking",
      related_check_request_id: req.id,
      changed_by: userId,
      change_reason: "Teacher initiated checking",
    });

    return { ok: true };
  });

/** Teacher/Admin: Record official check attempt (Atomic & Immutable) */
export const recordCheckAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (i: {
      assignment_id: string;
      request_id?: string | null;
      checked_at?: string;
      result: CheckResult;
      teacher_comment: string;
      score?: number | null;
      recommendation?: string | null;
      next_check_date?: string | null;
      evidence_path?: string | null;
      private_teacher_note?: string | null;
    }) =>
      z
        .object({
          assignment_id: z.string().uuid(),
          request_id: z.string().uuid().nullish(),
          checked_at: z.string().optional(),
          result: z.enum([
            "completed",
            "practice_again",
            "progressing",
            "not_ready",
            "not_checked",
            "exempted",
          ]),
          teacher_comment: z.string().min(1, "Teacher feedback comment is required"),
          score: z.number().nullish(),
          recommendation: z.string().nullish(),
          next_check_date: z.string().nullish(),
          evidence_path: z.string().nullish(),
          private_teacher_note: z.string().nullish(),
        })
        .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Fetch assignment
    const { data: assignment, error: aErr } = await supabaseAdmin
      .from("student_target_assignments")
      .select("id, student_id, term_id, class_id, academic_year_id, attempt_count, current_status")
      .eq("id", data.assignment_id)
      .single();

    if (aErr || !assignment) throw new Error("Target assignment not found");

    const checkedDate = data.checked_at || new Date().toISOString();
    const isCompleted = data.result === "completed";
    const isExempted = data.result === "exempted";
    const nextAttemptNumber =
      (assignment.attempt_count ?? 0) + (data.result === "not_checked" ? 0 : 1);

    // 1. Create Immutable Attempt Record
    const { data: newAttempt, error: attErr } = await supabaseAdmin
      .from("target_check_attempts")
      .insert({
        assignment_id: data.assignment_id,
        student_target_assignment_id: data.assignment_id,
        target_check_request_id: data.request_id ?? null,
        student_id: assignment.student_id,
        term_id: assignment.term_id,
        class_id: assignment.class_id,
        academic_year_id: assignment.academic_year_id,
        attempt_number: nextAttemptNumber,
        teacher_id: userId,
        checked_at: checkedDate,
        result: data.result,
        outcome: isCompleted ? "completed" : "needs_improvement",
        teacher_comment: data.teacher_comment,
        teacher_note: data.teacher_comment,
        score: data.score ?? null,
        recommendation: data.recommendation ?? null,
        next_check_date: data.next_check_date ?? null,
        evidence_path: data.evidence_path ?? null,
        private_teacher_note: data.private_teacher_note ?? null,
        is_final_completion: isCompleted,
        superseded: false,
      })
      .select("id")
      .single();

    if (attErr || !newAttempt) throw new Error(attErr?.message ?? "Failed to record check attempt");

    // 2. If check request exists, mark checked & close
    if (data.request_id) {
      await supabaseAdmin
        .from("target_check_requests")
        .update({
          request_status: "checked",
          closed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", data.request_id);
    } else {
      // If there was any pending request on this assignment, close it
      await supabaseAdmin
        .from("target_check_requests")
        .update({
          request_status: "checked",
          closed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("student_target_assignment_id", data.assignment_id)
        .in("request_status", ["pending", "accepted", "under_checking"]);
    }

    // 3. Determine next assignment status
    let nextStatus: TargetStatus = assignment.current_status as TargetStatus;
    if (isCompleted) {
      nextStatus = "completed";
    } else if (isExempted) {
      nextStatus = "exempted";
    } else if (data.result === "practice_again") {
      nextStatus = "practice_again";
    } else if (data.result === "progressing") {
      nextStatus = "progressing";
    } else if (data.result === "not_ready") {
      nextStatus = "practicing";
    } else if (data.result === "not_checked") {
      nextStatus = "practicing";
    }

    // 4. Update assignment
    const updatePayload: Record<string, unknown> = {
      current_status: nextStatus,
      status: isCompleted ? "completed" : "assigned",
      attempt_count: nextAttemptNumber,
      last_check_date: checkedDate,
      last_teacher_comment: data.teacher_comment,
      updated_at: new Date().toISOString(),
    };

    if (isCompleted) {
      updatePayload.completed_date = checkedDate;
      updatePayload.completed_at = checkedDate;
      updatePayload.completed_by = userId;
      updatePayload.final_attempt_id = newAttempt.id;
      updatePayload.achieved_points = 1;
    }

    await supabaseAdmin
      .from("student_target_assignments")
      .update(updatePayload)
      .eq("id", data.assignment_id);

    // 5. Record status history
    await supabaseAdmin.from("target_status_history").insert({
      student_target_assignment_id: data.assignment_id,
      previous_status: assignment.current_status,
      new_status: nextStatus,
      related_check_request_id: data.request_id ?? null,
      related_attempt_id: newAttempt.id,
      changed_by: userId,
      change_reason: `Teacher checked target: result is ${data.result}`,
    });

    // 6. In-app notification for student
    const { data: studentUser } = await supabaseAdmin
      .from("students")
      .select("user_id, full_name")
      .eq("id", assignment.student_id)
      .single();

    if (studentUser?.user_id) {
      const statusTitle = isCompleted
        ? "Target Completed! ★"
        : data.result === "practice_again"
          ? "Target Feedback: Practice Again"
          : `Target Checked: ${data.result}`;

      await supabaseAdmin.from("in_app_notifications").insert({
        recipient_id: studentUser.user_id,
        sender_id: userId,
        role_target: "student",
        title: statusTitle,
        message: data.teacher_comment,
        link: "/student/targets",
        type: "target_check_result",
      });
    }

    return { ok: true, attempt_id: newAttempt.id };
  });

/** Admin: Reopen a completed target with mandatory justification (Section 14 & 21) */
export const reopenCompletedTarget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { assignment_id: string; reason: string; supersede_attempt?: boolean }) =>
    z
      .object({
        assignment_id: z.string().uuid(),
        reason: z.string().min(5, "Reason is required to reopen target"),
        supersede_attempt: z.boolean().default(true),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Only administrators can reopen completed targets");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: assignment, error: aErr } = await supabaseAdmin
      .from("student_target_assignments")
      .select("id, student_id, current_status, final_attempt_id")
      .eq("id", data.assignment_id)
      .single();

    if (aErr || !assignment) throw new Error("Assignment not found");

    if (data.supersede_attempt && assignment.final_attempt_id) {
      await supabaseAdmin
        .from("target_check_attempts")
        .update({ superseded: true, is_final_completion: false })
        .eq("id", assignment.final_attempt_id);
    }

    await supabaseAdmin
      .from("student_target_assignments")
      .update({
        previous_status: assignment.current_status,
        current_status: "practicing",
        status: "assigned",
        completed_date: null,
        completed_at: null,
        completed_by: null,
        final_attempt_id: null,
        achieved_points: 0,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.assignment_id);

    // Audit log
    await supabaseAdmin.from("target_audit_logs").insert({
      action: "reopen_target",
      entity_type: "student_target_assignments",
      entity_id: data.assignment_id,
      performed_by: userId,
      reason: data.reason,
      metadata: { previous_status: assignment.current_status, student_id: assignment.student_id },
    });

    // History log
    await supabaseAdmin.from("target_status_history").insert({
      student_target_assignment_id: data.assignment_id,
      previous_status: assignment.current_status,
      new_status: "practicing",
      changed_by: userId,
      change_reason: `Reopened by admin: ${data.reason}`,
    });

    return { ok: true };
  });

/** Fetch full check history for an assignment (sanitizing private notes for students) */
export const getTargetCheckHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { assignment_id: string }) =>
    z.object({ assignment_id: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Check if caller is student
    const { data: student } = await supabaseAdmin
      .from("students")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    const isStudent = Boolean(student);

    const { data: attempts, error } = await supabaseAdmin
      .from("target_check_attempts")
      .select(
        "id, attempt_number, checked_at, result, outcome, teacher_comment, score, recommendation, next_check_date, is_final_completion, superseded, private_teacher_note, teacher_id",
      )
      .or(
        `student_target_assignment_id.eq.${data.assignment_id},assignment_id.eq.${data.assignment_id}`,
      )
      .order("attempt_number", { ascending: true });

    if (error) throw new Error(error.message);

    // Fetch teacher names
    const teacherIds = Array.from(
      new Set((attempts ?? []).map((a) => a.teacher_id).filter(Boolean)),
    );
    const { data: teachers } = teacherIds.length
      ? await supabaseAdmin.from("profiles").select("id, full_name").in("id", teacherIds)
      : { data: [] };

    const teacherMap = new Map((teachers ?? []).map((t) => [t.id, t.full_name]));

    return (attempts ?? []).map((a) => ({
      ...a,
      private_teacher_note: isStudent ? null : a.private_teacher_note,
      teacher_name: a.teacher_id ? (teacherMap.get(a.teacher_id) ?? "Teacher") : "Teacher",
    }));
  });

/** Progress Monitor: aggregate metrics and student breakdown (Section 17) */
export const getTargetProgressMonitorData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { term_id?: string | null; class_id?: string | null }) =>
    z
      .object({
        term_id: z.string().uuid().nullish(),
        class_id: z.string().uuid().nullish(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let query = supabaseAdmin
      .from("student_target_assignments")
      .select(
        "id, student_id, term_id, class_id, current_status, attempt_count, last_check_date, achieved_points, students(id, full_name, student_number, class_id), target_template_items(id, target_title, target_title_dhivehi, is_required)",
      );

    if (data.term_id) query = query.eq("term_id", data.term_id);
    if (data.class_id && data.class_id !== "all") query = query.eq("class_id", data.class_id);

    const { data: assignments, error } = await query;
    if (error) throw new Error(error.message);

    const totalAssignments = assignments?.length ?? 0;
    const completed = assignments?.filter((a) => a.current_status === "completed").length ?? 0;
    const checkRequested =
      assignments?.filter((a) => a.current_status === "check_requested").length ?? 0;
    const underChecking =
      assignments?.filter((a) => a.current_status === "under_checking").length ?? 0;
    const practiceAgain =
      assignments?.filter((a) => a.current_status === "practice_again").length ?? 0;
    const progressing = assignments?.filter((a) => a.current_status === "progressing").length ?? 0;
    const notStarted = assignments?.filter((a) => a.current_status === "not_started").length ?? 0;
    const exempted = assignments?.filter((a) => a.current_status === "exempted").length ?? 0;
    const repeatedAttempts =
      assignments?.filter((a) => (a.attempt_count ?? 0) >= 2 && a.current_status !== "completed")
        .length ?? 0;

    return {
      total: totalAssignments,
      completed,
      checkRequested,
      underChecking,
      practiceAgain,
      progressing,
      notStarted,
      exempted,
      repeatedAttempts,
      completionRate: totalAssignments > 0 ? Math.round((completed / totalAssignments) * 100) : 0,
      assignments: assignments ?? [],
    };
  });
