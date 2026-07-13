import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { STUDENT_EMAIL_DOMAIN } from "@/lib/student-auth";

/**
 * Approve an admission request:
 *  - creates a Supabase Auth user for the student (synthetic email + PIN password)
 *  - inserts into students, student_accounts, user_roles
 *  - marks the admission request approved and links it to the new student
 *  - returns { username, pin } once (the caller must display/print/copy)
 */
export const approveAdmissionRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { requestId: string; classId?: string | null }) =>
    z
      .object({
        requestId: z.string().uuid(),
        classId: z.string().uuid().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    // Admin gate
    const { data: isAdmin, error: roleErr } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleErr) throw new Error(roleErr.message);
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Load request
    const { data: req, error: reqErr } = await supabaseAdmin
      .from("admission_requests")
      .select("*")
      .eq("id", data.requestId)
      .maybeSingle();
    if (reqErr) throw new Error(reqErr.message);
    if (!req) throw new Error("Admission request not found");
    if (req.linked_student_id) throw new Error("This request has already been approved");
    if (req.status === "rejected") throw new Error("Cannot approve a rejected request");

    // Generate credentials
    const baseUsername = (req.full_name as string)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "")
      .slice(0, 12) || "student";
    let username = baseUsername + Math.floor(1000 + Math.random() * 9000).toString();
    // Ensure uniqueness
    for (let i = 0; i < 5; i++) {
      const { data: existing } = await supabaseAdmin
        .from("student_accounts")
        .select("id")
        .eq("username", username)
        .maybeSingle();
      if (!existing) break;
      username = baseUsername + Math.floor(1000 + Math.random() * 9000).toString();
    }
    const email = `${username}@${STUDENT_EMAIL_DOMAIN}`;
    const pin = Math.floor(1000 + Math.random() * 9000).toString();

    // 1) Create auth user
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: pin,
      email_confirm: true,
      user_metadata: { full_name: req.full_name, kind: "student" },
    });
    if (createErr || !created.user) throw new Error(createErr?.message ?? "Failed to create user");
    const authUserId = created.user.id;

    // Helper: cleanup on failure
    async function cleanup(msg: string): Promise<never> {
      try {
        await supabaseAdmin.auth.admin.deleteUser(authUserId);
      } catch {
        /* ignore */
      }
      throw new Error(msg);
    }

    // 2) Student number
    const { data: numData, error: numErr } = await supabaseAdmin.rpc("generate_student_number");
    if (numErr || !numData) await cleanup(numErr?.message ?? "Failed to generate student number");
    const studentNumber = numData as unknown as string;

    // 3) Insert student
    const { data: student, error: studentErr } = await supabaseAdmin
      .from("students")
      .insert({
        admission_request_id: req.id,
        user_id: authUserId,
        student_number: studentNumber,
        full_name: req.full_name,
        date_of_birth: req.date_of_birth,
        gender: req.gender,
        identity_number: req.identity_number,
        guardian_name: req.guardian_name,
        guardian_identity_number: req.guardian_identity_number,
        mobile: req.mobile,
        alternative_mobile: req.alternative_mobile,
        address: req.address,
        island: req.island,
        atoll: req.atoll,
        class_id: data.classId ?? req.preferred_class ?? null,
        session: req.preferred_session,
        admission_date: new Date().toISOString().slice(0, 10),
        status: "active",
        photo_url: req.photo_url,
      })
      .select("*")
      .single();
    if (studentErr || !student) await cleanup(studentErr?.message ?? "Failed to create student");

    // 4) Student account
    const { error: accErr } = await supabaseAdmin.from("student_accounts").insert({
      student_id: student!.id,
      user_id: authUserId,
      username,
      is_active: true,
      is_locked: false,
    });
    if (accErr) await cleanup(accErr.message);

    // 5) Role
    const { error: roleInsertErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: authUserId, role: "student" });
    if (roleInsertErr) await cleanup(roleInsertErr.message);

    // 6) Update admission request
    const { error: updErr } = await supabaseAdmin
      .from("admission_requests")
      .update({
        status: "approved",
        linked_student_id: student!.id,
        reviewed_at: new Date().toISOString(),
        reviewed_by: context.userId,
      })
      .eq("id", req.id);
    if (updErr) await cleanup(updErr.message);

    return {
      studentId: student!.id,
      studentNumber,
      username,
      pin,
    };
  });

/** Reject or waitlist an admission request (with optional admin note). */
export const setAdmissionStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { requestId: string; status: "rejected" | "waitlisted" | "pending"; adminNote?: string }) =>
    z
      .object({
        requestId: z.string().uuid(),
        status: z.enum(["rejected", "waitlisted", "pending"]),
        adminNote: z.string().max(2000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("admission_requests")
      .update({
        status: data.status,
        admin_notes: data.adminNote ?? null,
        reviewed_at: new Date().toISOString(),
        reviewed_by: context.userId,
      })
      .eq("id", data.requestId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
