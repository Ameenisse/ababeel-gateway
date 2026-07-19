import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Admin: create or update a template item */
export const upsertTemplateItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: {
    id?: string;
    template_id: string;
    title_dv: string;
    title_en?: string | null;
    star_group?: string | null;
    category_id?: string | null;
    sort_order?: number;
    is_active?: boolean;
  }) =>
    z.object({
      id: z.string().uuid().optional(),
      template_id: z.string().uuid(),
      title_dv: z.string().min(1),
      title_en: z.string().nullish(),
      star_group: z.string().nullish(),
      category_id: z.string().uuid().nullish(),
      sort_order: z.number().int().default(0),
      is_active: z.boolean().default(true),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    if (data.id) {
      const { error } = await supabase.from("target_template_items").update({
        title_dv: data.title_dv,
        title_en: data.title_en ?? null,
        star_group: data.star_group ?? null,
        category_id: data.category_id ?? null,
        sort_order: data.sort_order ?? 0,
        is_active: data.is_active ?? true,
      }).eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("target_template_items").insert({
        template_id: data.template_id,
        title_dv: data.title_dv,
        title_en: data.title_en ?? null,
        star_group: data.star_group ?? null,
        category_id: data.category_id ?? null,
        sort_order: data.sort_order ?? 0,
        is_active: data.is_active ?? true,
      });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

/** Admin: create template */
export const createTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { class_level: string; term_id: string; name: string }) =>
    z.object({
      class_level: z.enum(["baby","nursery","lkg","ukg","ks1","ks2_3"]),
      term_id: z.string().uuid(),
      name: z.string().min(1),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("target_templates")
      .insert({ class_level: data.class_level, term_id: data.term_id, name: data.name, created_by: context.userId })
      .select("*").single();
    if (error) throw new Error(error.message);
    return row;
  });

/** Admin: apply template to all students in matching classes for that term */
export const applyTemplateToStudents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { template_id: string }) => z.object({ template_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: tpl, error: tplErr } = await supabaseAdmin
      .from("target_templates").select("*").eq("id", data.template_id).single();
    if (tplErr || !tpl) throw new Error(tplErr?.message ?? "Template not found");

    const { data: items } = await supabaseAdmin
      .from("target_template_items").select("id").eq("template_id", data.template_id).eq("is_active", true);
    if (!items?.length) return { assigned: 0 };

    const { data: classes } = await supabaseAdmin
      .from("classes").select("id").eq("class_level", tpl.class_level);
    const classIds = (classes ?? []).map((c) => c.id);
    if (!classIds.length) return { assigned: 0 };

    const { data: students } = await supabaseAdmin
      .from("students").select("id").in("class_id", classIds).eq("status", "active");

    const rows: { student_id: string; term_id: string; template_item_id: string }[] = [];
    for (const s of students ?? []) {
      for (const it of items) rows.push({ student_id: s.id, term_id: tpl.term_id, template_item_id: it.id });
    }
    if (!rows.length) return { assigned: 0 };
    const { error: insErr } = await supabaseAdmin
      .from("student_target_assignments")
      .upsert(rows, { onConflict: "student_id,term_id,template_item_id", ignoreDuplicates: true });
    if (insErr) throw new Error(insErr.message);
    return { assigned: rows.length };
  });

/** Student: request a check for a target */
export const requestCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { assignment_id: string; note?: string }) =>
    z.object({ assignment_id: z.string().uuid(), note: z.string().max(1000).optional() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("target_check_attempts").insert({
      assignment_id: data.assignment_id,
      student_note: data.note ?? null,
      requested_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Teacher: respond to a check request */
export const respondCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { attempt_id: string; outcome: "completed" | "needs_improvement"; note?: string }) =>
    z.object({
      attempt_id: z.string().uuid(),
      outcome: z.enum(["completed", "needs_improvement"]),
      note: z.string().max(1000).optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("target_check_attempts").update({
      outcome: data.outcome,
      teacher_note: data.note ?? null,
      responded_at: new Date().toISOString(),
      responded_by: context.userId,
    }).eq("id", data.attempt_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
