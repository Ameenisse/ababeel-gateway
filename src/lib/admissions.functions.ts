import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { STUDENT_EMAIL_DOMAIN, studentUsernameToEmail } from "@/lib/student-auth";
import {
  hashPin,
  verifyPin,
  extractPinFromNid,
  sendAdmissionCredentialsEmail,
} from "@/lib/admissions-auth.server";

// Helper for audit logging
async function recordAuditLog(
  supabaseAdmin: any,
  params: {
    userId: string;
    action: string;
    module: string;
    recordId?: string;
    oldData?: any;
    newData?: any;
  },
) {
  try {
    await supabaseAdmin.from("audit_logs").insert({
      user_id: params.userId,
      action: params.action,
      module: params.module,
      record_id: params.recordId ?? null,
      old_data: params.oldData ?? null,
      new_data: params.newData ?? null,
    });
  } catch (err) {
    console.warn("[Audit Log Warning]:", err);
  }
}

// Helper for sending applicant/user in-app notification
async function createInAppNotification(
  supabaseAdmin: any,
  params: {
    recipientId: string;
    senderId?: string;
    title: string;
    message: string;
    link?: string;
    type: string;
    roleTarget?: string;
  },
) {
  try {
    await supabaseAdmin.from("in_app_notifications").insert({
      recipient_id: params.recipientId,
      sender_id: params.senderId ?? null,
      title: params.title,
      message: params.message,
      link: params.link ?? null,
      type: params.type,
      role_target: params.roleTarget ?? null,
    });
  } catch (err) {
    console.warn("[Notification Warning]:", err);
  }
}

/**
 * Check if there is an active admission request for a student
 * Rule 6: Google applicant account, Student NID, Student Name + DOB, Guardian contact
 */
export const checkActiveAdmission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      identityNumber?: string;
      fullName?: string;
      dateOfBirth?: string;
      mobile?: string;
    }) =>
      z
        .object({
          identityNumber: z.string().optional(),
          fullName: z.string().optional(),
          dateOfBirth: z.string().optional(),
          mobile: z.string().optional(),
        })
        .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Check Google applicant account active application
    const { data: byUser } = await supabaseAdmin
      .from("admission_requests")
      .select("id, request_number, full_name, status, submitted_at")
      .eq("applicant_user_id", context.userId)
      .not("status", "in", '("rejected")')
      .order("submitted_at", { ascending: false })
      .limit(1);

    if (byUser && byUser.length > 0) {
      return { hasActive: true, existing: byUser[0], matchType: "google_account" };
    }

    // 2. Check Student NID
    if (data.identityNumber) {
      const { data: byNid } = await supabaseAdmin
        .from("admission_requests")
        .select("id, request_number, full_name, status, submitted_at")
        .eq("identity_number", data.identityNumber.trim().toUpperCase())
        .not("status", "in", '("rejected")')
        .limit(1);

      if (byNid && byNid.length > 0) {
        return { hasActive: true, existing: byNid[0], matchType: "student_nid" };
      }
    }

    // 3. Check Full Name + Date of Birth
    if (data.fullName && data.dateOfBirth) {
      const { data: byNameDob } = await supabaseAdmin
        .from("admission_requests")
        .select("id, request_number, full_name, status, submitted_at")
        .ilike("full_name", data.fullName.trim())
        .eq("date_of_birth", data.dateOfBirth)
        .not("status", "in", '("rejected")')
        .limit(1);

      if (byNameDob && byNameDob.length > 0) {
        return { hasActive: true, existing: byNameDob[0], matchType: "name_and_dob" };
      }
    }

    // 4. Check Guardian contact mobile
    if (data.mobile) {
      const { data: byMobile } = await supabaseAdmin
        .from("admission_requests")
        .select("id, request_number, full_name, status, submitted_at")
        .eq("mobile", data.mobile.trim())
        .not("status", "in", '("rejected")')
        .limit(1);

      if (byMobile && byMobile.length > 0) {
        return { hasActive: true, existing: byMobile[0], matchType: "mobile" };
      }
    }

    return { hasActive: false };
  });

/**
 * Submit an admission request by authenticated Google user
 */
export const submitGoogleAdmissionRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Record<string, unknown>) => input)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Retrieve verified Google user identity from auth
    const {
      data: { user },
      error: userErr,
    } = await context.supabase.auth.getUser();
    if (userErr || !user) throw new Error("Authenticated user identity required.");

    const applicantEmail = user.email || (data.applicantEmail as string) || "";
    const applicantName =
      (user.user_metadata?.full_name as string) ||
      (user.user_metadata?.name as string) ||
      (data.applicantName as string) ||
      "";
    const applicantAvatar =
      (user.user_metadata?.avatar_url as string) ||
      (user.user_metadata?.picture as string) ||
      null;

    const studentNid = String(data.identity_number || "").trim().toUpperCase();
    const studentName = String(data.full_name || "").trim();
    const dob = String(data.date_of_birth || "");
    const mobile = String(data.mobile || "").trim();

    // Check one active application rule
    const { data: existingActive } = await supabaseAdmin
      .from("admission_requests")
      .select("id, request_number, full_name, status")
      .eq("applicant_user_id", context.userId)
      .not("status", "in", '("rejected")')
      .limit(1);

    if (existingActive && existingActive.length > 0) {
      throw new Error(
        `An admission application (${existingActive[0].request_number}) is already active for your account. You can view or track it on My Admission.`,
      );
    }

    // Check student NID
    if (studentNid) {
      const { data: nidActive } = await supabaseAdmin
        .from("admission_requests")
        .select("id, request_number, full_name, status")
        .eq("identity_number", studentNid)
        .not("status", "in", '("rejected")')
        .limit(1);

      if (nidActive && nidActive.length > 0) {
        throw new Error(
          `An admission application is already active for student with NID ${studentNid}.`,
        );
      }
    }

    // Generate Request Number: ADM-YYYY-XXXX
    let requestNumber = "";
    try {
      const { data: reqNumData } = await supabaseAdmin.rpc("generate_admission_request_number");
      if (reqNumData) requestNumber = reqNumData as unknown as string;
    } catch {
      /* fallback */
    }
    if (!requestNumber) {
      const year = new Date().getFullYear();
      const rand = Math.floor(1000 + Math.random() * 9000);
      requestNumber = `ADM-${year}-${rand}`;
    }

    const insertPayload: any = {
      request_number: requestNumber,
      applicant_user_id: context.userId,
      applicant_email: applicantEmail,
      applicant_name: applicantName,
      applicant_avatar_url: applicantAvatar,
      full_name: studentName,
      identity_number: studentNid,
      date_of_birth: dob,
      gender: data.gender || "male",
      guardian_name: data.guardian_name || "",
      guardian_identity_number: data.guardian_identity_number || null,
      mobile: mobile,
      alternative_mobile: data.alternative_mobile || null,
      address: data.address || null,
      island: data.island || null,
      atoll: data.atoll || null,
      preferred_class: data.preferred_class || null,
      preferred_session: data.preferred_session || null,
      previous_experience: data.previous_experience || null,
      reading_level: data.reading_level || null,
      school: data.school || null,
      grade_studying: data.grade_studying || null,
      medical_notes: data.medical_notes || null,
      remarks: data.remarks || null,
      photo_url: data.photo_url || null,
      student_id_url: data.student_id_url || null,
      guardian_id_url: data.guardian_id_url || null,
      agreed_to_rules: true,
      rules_version: 1,
      status: "pending",
      submitted_at: new Date().toISOString(),
      monthly_fee: 300.0,
    };

    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from("admission_requests")
      .insert(insertPayload)
      .select("*")
      .single();

    if (insertErr || !inserted) {
      throw new Error(insertErr?.message || "Failed to submit admission application.");
    }

    // Record audit log
    await recordAuditLog(supabaseAdmin, {
      userId: context.userId,
      action: "Admission Submitted",
      module: "admissions",
      recordId: inserted.id,
      newData: {
        request_number: requestNumber,
        applicant_email: applicantEmail,
        student_name: studentName,
        identity_number: studentNid,
      },
    });

    // In-app notification
    await createInAppNotification(supabaseAdmin, {
      recipientId: context.userId,
      title: "Admission Application Received",
      message: `Your application (${requestNumber}) for ${studentName} has been received and is pending review.`,
      link: "/my-admission",
      type: "admission_submitted",
    });

    return {
      ok: true,
      id: inserted.id,
      requestNumber,
      applicantEmail,
    };
  });

/**
 * Fetch all admission applications for the current authenticated Google applicant
 */
export const getMyAdmissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Fetch applications belonging to applicant_user_id
    const { data: requests, error } = await supabaseAdmin
      .from("admission_requests")
      .select(
        `
        *,
        classes:preferred_class(class_name, monthly_fee),
        linked_student:linked_student_id(id, student_number, full_name, admission_date, classes(class_name))
      `,
      )
      .eq("applicant_user_id", context.userId)
      .order("submitted_at", { ascending: false });

    if (error) throw new Error(error.message);

    return (requests || []) as any[];
  });

/**
 * Edit an admission request by the applicant while in editable status:
 * 'draft', 'submitted', 'pending', 'correction_requested'
 */
export const updateApplicantAdmission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { requestId: string; updates: Record<string, unknown> }) =>
    z
      .object({
        requestId: z.string().uuid(),
        updates: z.record(z.unknown()),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing, error: getErr } = await supabaseAdmin
      .from("admission_requests")
      .select("*")
      .eq("id", data.requestId)
      .single();

    if (getErr || !existing) throw new Error("Application not found.");

    if (existing.applicant_user_id !== context.userId) {
      throw new Error("You do not have permission to edit this application.");
    }

    const editableStatuses = ["draft", "submitted", "pending", "correction_requested"];
    if (!editableStatuses.includes(existing.status)) {
      throw new Error(
        `This application is currently ${existing.status} and locked from applicant editing.`,
      );
    }

    const safeUpdates: any = {
      full_name: data.updates.full_name ?? existing.full_name,
      identity_number: (data.updates.identity_number as string)?.toUpperCase() ?? existing.identity_number,
      date_of_birth: data.updates.date_of_birth ?? existing.date_of_birth,
      gender: data.updates.gender ?? existing.gender,
      guardian_name: data.updates.guardian_name ?? existing.guardian_name,
      guardian_identity_number:
        data.updates.guardian_identity_number ?? existing.guardian_identity_number,
      mobile: data.updates.mobile ?? existing.mobile,
      alternative_mobile: data.updates.alternative_mobile ?? existing.alternative_mobile,
      address: data.updates.address ?? existing.address,
      island: data.updates.island ?? existing.island,
      atoll: data.updates.atoll ?? existing.atoll,
      preferred_class: data.updates.preferred_class ?? existing.preferred_class,
      preferred_session: data.updates.preferred_session ?? existing.preferred_session,
      previous_experience: data.updates.previous_experience ?? existing.previous_experience,
      reading_level: data.updates.reading_level ?? existing.reading_level,
      school: data.updates.school ?? existing.school,
      grade_studying: data.updates.grade_studying ?? existing.grade_studying,
      medical_notes: data.updates.medical_notes ?? existing.medical_notes,
      remarks: data.updates.remarks ?? existing.remarks,
      photo_url: data.updates.photo_url ?? existing.photo_url,
      student_id_url: data.updates.student_id_url ?? existing.student_id_url,
      guardian_id_url: data.updates.guardian_id_url ?? existing.guardian_id_url,
    };

    // If correction was requested, resubmitting moves status back to pending
    if (existing.status === "correction_requested") {
      safeUpdates.status = "pending";
    }

    const { error: updErr } = await supabaseAdmin
      .from("admission_requests")
      .update(safeUpdates)
      .eq("id", data.requestId);

    if (updErr) throw new Error(updErr.message);

    await recordAuditLog(supabaseAdmin, {
      userId: context.userId,
      action: "Application Updated",
      module: "admissions",
      recordId: data.requestId,
      oldData: { status: existing.status },
      newData: safeUpdates,
    });

    return { ok: true };
  });

/**
 * Admin action: Request correction from applicant
 */
export const requestAdmissionCorrection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { requestId: string; correctionNotes: string }) =>
    z
      .object({
        requestId: z.string().uuid(),
        correctionNotes: z.string().min(3).max(2000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden: Admin access required.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: req, error: reqErr } = await supabaseAdmin
      .from("admission_requests")
      .select("id, request_number, full_name, applicant_user_id, status")
      .eq("id", data.requestId)
      .single();

    if (reqErr || !req) throw new Error("Admission request not found.");

    const { error: updErr } = await supabaseAdmin
      .from("admission_requests")
      .update({
        status: "correction_requested",
        correction_notes: data.correctionNotes,
        reviewed_at: new Date().toISOString(),
        reviewed_by: context.userId,
      })
      .eq("id", data.requestId);

    if (updErr) throw new Error(updErr.message);

    await recordAuditLog(supabaseAdmin, {
      userId: context.userId,
      action: "Correction Requested",
      module: "admissions",
      recordId: data.requestId,
      newData: { correction_notes: data.correctionNotes },
    });

    if (req.applicant_user_id) {
      await createInAppNotification(supabaseAdmin, {
        recipientId: req.applicant_user_id,
        senderId: context.userId,
        title: "Correction Requested for Admission Application",
        message: `Please update your admission application (${req.request_number}) for ${req.full_name}: ${data.correctionNotes}`,
        link: "/my-admission",
        type: "correction_requested",
      });
    }

    return { ok: true };
  });

/**
 * Admin action: Set application to Under Review
 */
export const setAdmissionUnderReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { requestId: string }) =>
    z
      .object({
        requestId: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden: Admin access required.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: req } = await supabaseAdmin
      .from("admission_requests")
      .select("id, request_number, full_name, applicant_user_id")
      .eq("id", data.requestId)
      .single();

    const { error } = await supabaseAdmin
      .from("admission_requests")
      .update({
        status: "under_review",
        reviewed_at: new Date().toISOString(),
        reviewed_by: context.userId,
      })
      .eq("id", data.requestId);

    if (error) throw new Error(error.message);

    await recordAuditLog(supabaseAdmin, {
      userId: context.userId,
      action: "Admin Review Started",
      module: "admissions",
      recordId: data.requestId,
    });

    if (req?.applicant_user_id) {
      await createInAppNotification(supabaseAdmin, {
        recipientId: req.applicant_user_id,
        senderId: context.userId,
        title: "Application Under Review",
        message: `Your admission application (${req.request_number}) is currently under review by our administration.`,
        link: "/my-admission",
        type: "under_review",
      });
    }

    return { ok: true };
  });

/**
 * Admin action: Reject admission request
 * Requires admin reason (internal) and optional applicant-visible reason
 */
export const rejectAdmissionRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      requestId: string;
      adminNote: string;
      applicantRejectionReason?: string;
    }) =>
      z
        .object({
          requestId: z.string().uuid(),
          adminNote: z.string().min(2, "Internal admin reason is required").max(2000),
          applicantRejectionReason: z.string().max(2000).optional(),
        })
        .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden: Admin access required.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: req, error: reqErr } = await supabaseAdmin
      .from("admission_requests")
      .select("id, request_number, full_name, applicant_user_id")
      .eq("id", data.requestId)
      .single();

    if (reqErr || !req) throw new Error("Admission request not found.");

    const { error: updErr } = await supabaseAdmin
      .from("admission_requests")
      .update({
        status: "rejected",
        admin_notes: data.adminNote,
        applicant_rejection_reason: data.applicantRejectionReason || null,
        reviewed_at: new Date().toISOString(),
        reviewed_by: context.userId,
      })
      .eq("id", data.requestId);

    if (updErr) throw new Error(updErr.message);

    await recordAuditLog(supabaseAdmin, {
      userId: context.userId,
      action: "Admission Rejected",
      module: "admissions",
      recordId: data.requestId,
      newData: {
        admin_notes: data.adminNote,
        applicant_rejection_reason: data.applicantRejectionReason,
      },
    });

    if (req.applicant_user_id) {
      await createInAppNotification(supabaseAdmin, {
        recipientId: req.applicant_user_id,
        senderId: context.userId,
        title: "Admission Application Update",
        message: `Your admission application (${req.request_number}) for ${req.full_name} was not approved.${data.applicantRejectionReason ? " Reason: " + data.applicantRejectionReason : ""}`,
        link: "/my-admission",
        type: "admission_rejected",
      });
    }

    return { ok: true };
  });

/**
 * Approve an admission request:
 *  - Validates student NID uniqueness
 *  - Generates Student ID (AQC-YYYY-XXXX)
 *  - Calculates temporary PIN from last 4 digits of student NID (or custom PIN if provided)
 *  - Hashes PIN securely (scrypt)
 *  - Creates auth account for student with username = student ID
 *  - Inserts student, student_accounts, user_roles
 *  - Marks admission request approved and links to student
 *  - Sends transactional email to applicant's Google email
 *  - Returns credentials once (for admin display, print, copy) with email delivery status
 */
export const approveAdmissionRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      requestId: string;
      classId?: string | null;
      monthlyFee?: number | null;
      customTemporaryPin?: string | null;
    }) =>
      z
        .object({
          requestId: z.string().uuid(),
          classId: z.string().uuid().nullable().optional(),
          monthlyFee: z.number().positive().optional().nullable(),
          customTemporaryPin: z
            .string()
            .regex(/^\d{4}$/, "Custom temporary PIN must be 4 digits")
            .optional()
            .nullable(),
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
    if (!isAdmin) throw new Error("Forbidden: Admin access required.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Load request
    const { data: req, error: reqErr } = await supabaseAdmin
      .from("admission_requests")
      .select("*")
      .eq("id", data.requestId)
      .maybeSingle();

    if (reqErr) throw new Error(reqErr.message);
    if (!req) throw new Error("Admission request not found.");
    if (req.linked_student_id) throw new Error("This request has already been approved.");
    if (req.status === "rejected") throw new Error("Cannot approve a rejected request.");

    // Check Student NID uniqueness among active students
    if (req.identity_number) {
      const { data: existingStudent } = await supabaseAdmin
        .from("students")
        .select("id, student_number, full_name")
        .eq("identity_number", req.identity_number.trim().toUpperCase())
        .eq("status", "active")
        .maybeSingle();

      if (existingStudent) {
        throw new Error(
          `A student (${existingStudent.student_number} — ${existingStudent.full_name}) already exists with NID ${req.identity_number}.`,
        );
      }
    }

    // Determine Temporary PIN
    let temporaryPin: string | null = null;
    if (data.customTemporaryPin) {
      temporaryPin = data.customTemporaryPin;
    } else {
      temporaryPin = extractPinFromNid(req.identity_number);
    }

    if (!temporaryPin || temporaryPin.length !== 4) {
      throw new Error(
        `Unable to extract 4-digit PIN from Student NID "${req.identity_number}". Please specify a 4-digit temporary PIN in the approval form.`,
      );
    }

    // Generate Student ID (student_number)
    const { data: numData, error: numErr } = await supabaseAdmin.rpc("generate_student_number");
    if (numErr || !numData) {
      throw new Error(numErr?.message ?? "Failed to generate student number.");
    }
    const studentNumber = String(numData);

    // Username = Student ID (case-insensitive)
    const username = studentNumber;
    const syntheticEmail = studentUsernameToEmail(username);

    // PIN Hash
    const pinHash = hashPin(temporaryPin);

    // 1) Create Supabase Auth user
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: syntheticEmail,
      password: temporaryPin,
      email_confirm: true,
      user_metadata: {
        full_name: req.full_name,
        kind: "student",
        student_number: studentNumber,
      },
    });

    if (createErr || !created.user) {
      throw new Error(createErr?.message ?? "Failed to create student authentication user.");
    }
    const authUserId = created.user.id;

    // Helper: cleanup auth user on failure
    async function cleanup(msg: string): Promise<never> {
      try {
        await supabaseAdmin.auth.admin.deleteUser(authUserId);
      } catch {
        /* ignore */
      }
      throw new Error(msg);
    }

    const assignedClassId = data.classId ?? req.preferred_class ?? null;
    const monthlyFee = data.monthlyFee ?? req.monthly_fee ?? 300.0;

    // 2) Insert Student record
    const { data: student, error: studentErr } = await supabaseAdmin
      .from("students")
      .insert({
        admission_request_id: req.id,
        user_id: authUserId,
        student_number: studentNumber,
        full_name: req.full_name,
        date_of_birth: req.date_of_birth,
        gender: req.gender,
        identity_number: req.identity_number ? req.identity_number.trim().toUpperCase() : null,
        guardian_name: req.guardian_name,
        guardian_identity_number: req.guardian_identity_number,
        mobile: req.mobile,
        alternative_mobile: req.alternative_mobile,
        address: req.address,
        island: req.island,
        atoll: req.atoll,
        class_id: assignedClassId,
        session: req.preferred_session,
        admission_date: new Date().toISOString().slice(0, 10),
        status: "active",
        photo_url: req.photo_url,
        admission_contact_email: req.applicant_email,
        monthly_fee: monthlyFee,
      })
      .select("*")
      .single();

    if (studentErr || !student) {
      await cleanup(studentErr?.message ?? "Failed to create student profile.");
    }

    // 3) Insert Student Account with pin_hash, must_change_pin = true
    const { error: accErr } = await supabaseAdmin.from("student_accounts").insert({
      student_id: student!.id,
      user_id: authUserId,
      username,
      pin_hash: pinHash,
      must_change_pin: true,
      status: "active",
      is_active: true,
      is_locked: false,
    });

    if (accErr) {
      await cleanup(accErr.message);
    }

    // 4) Insert role into user_roles
    const { error: roleInsertErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: authUserId, role: "student" });

    if (roleInsertErr) {
      await cleanup(roleInsertErr.message);
    }

    // 5) Fetch class name for display/email
    let assignedClassName = "Unassigned";
    if (assignedClassId) {
      const { data: cls } = await supabaseAdmin
        .from("classes")
        .select("class_name")
        .eq("id", assignedClassId)
        .maybeSingle();
      if (cls) assignedClassName = cls.class_name;
    }

    // 6) Send credentials email to Google applicant email
    let emailDeliveryStatus: "sent" | "failed" | "pending_retry" = "pending";
    let emailDeliveryError: string | null = null;

    if (req.applicant_email) {
      const emailRes = await sendAdmissionCredentialsEmail({
        recipientEmail: req.applicant_email,
        recipientName: req.applicant_name || req.guardian_name || req.full_name,
        studentName: req.full_name,
        studentNumber,
        username,
        temporaryPin,
        assignedClassName,
      });

      emailDeliveryStatus = emailRes.status;
      emailDeliveryError = emailRes.error || null;
    } else {
      emailDeliveryStatus = "failed";
      emailDeliveryError = "No applicant Google email recorded on this request.";
    }

    // 7) Update admission request record
    const { error: updErr } = await supabaseAdmin
      .from("admission_requests")
      .update({
        status: "approved",
        linked_student_id: student!.id,
        created_student_id: student!.id,
        reviewed_at: new Date().toISOString(),
        reviewed_by: context.userId,
        email_delivery_status: emailDeliveryStatus,
        email_delivery_error: emailDeliveryError,
        email_sent_at: emailDeliveryStatus === "sent" ? new Date().toISOString() : null,
      })
      .eq("id", req.id);

    if (updErr) {
      console.error("[Update Request Error]:", updErr);
    }

    // 8) Record Audit Log
    await recordAuditLog(supabaseAdmin, {
      userId: context.userId,
      action: "Approved & Student Account Created",
      module: "admissions",
      recordId: req.id,
      newData: {
        student_id: student!.id,
        student_number: studentNumber,
        username,
        email_delivery_status: emailDeliveryStatus,
        email_recipient: req.applicant_email,
      },
    });

    // 9) In-app notification for applicant
    if (req.applicant_user_id) {
      await createInAppNotification(supabaseAdmin, {
        recipientId: req.applicant_user_id,
        senderId: context.userId,
        title: "Admission Approved!",
        message: `Congratulations! The admission for ${req.full_name} has been approved. Student ID: ${studentNumber}. Check your Google email for login details.`,
        link: "/my-admission",
        type: "admission_approved",
      });
    }

    // Return credentials once for Admin screen (plaintext PIN is NEVER stored in database)
    return {
      studentId: student!.id,
      studentNumber,
      username,
      pin: temporaryPin,
      name: req.full_name,
      assignedClassName,
      emailDeliveryStatus,
      emailDeliveryError,
      applicantEmail: req.applicant_email,
    };
  });

/**
 * Check if the currently authenticated student must change PIN
 */
export const getStudentAccountStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Check student account for context.userId
    const { data: account, error } = await supabaseAdmin
      .from("student_accounts")
      .select("id, username, must_change_pin, status, is_active, is_locked, student_id")
      .eq("user_id", context.userId)
      .maybeSingle();

    if (error || !account) {
      return { mustChangePin: false, account: null };
    }

    return {
      mustChangePin: !!account.must_change_pin,
      account,
    };
  });

/**
 * Student changes PIN from temporary PIN to a new private PIN
 */
export const changeStudentPin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { currentPin: string; newPin: string; confirmPin: string }) =>
      z
        .object({
          currentPin: z.string().min(4),
          newPin: z.string().regex(/^\d{4,8}$/, "PIN must be between 4 and 8 digits"),
          confirmPin: z.string().min(4),
        })
        .refine((val) => val.newPin === val.confirmPin, {
          message: "New PIN and Confirm PIN do not match",
          path: ["confirmPin"],
        })
        .refine((val) => val.currentPin !== val.newPin, {
          message: "New PIN must be different from current PIN",
          path: ["newPin"],
        })
        .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: account, error: accErr } = await supabaseAdmin
      .from("student_accounts")
      .select("id, user_id, pin_hash, username, student_id")
      .eq("user_id", context.userId)
      .single();

    if (accErr || !account) throw new Error("Student account not found.");

    // Verify current PIN
    let pinValid = false;
    if (account.pin_hash) {
      pinValid = verifyPin(data.currentPin, account.pin_hash);
    }

    // If pin_hash was empty (legacy account), verify via Supabase Auth sign-in test
    if (!pinValid && !account.pin_hash) {
      const { error: signInErr } = await context.supabase.auth.signInWithPassword({
        email: studentUsernameToEmail(account.username),
        password: data.currentPin,
      });
      if (!signInErr) pinValid = true;
    }

    if (!pinValid) {
      throw new Error("Current PIN is incorrect.");
    }

    // Hash new PIN
    const newPinHash = hashPin(data.newPin);

    // Update Supabase Auth user password
    const { error: updateAuthErr } = await supabaseAdmin.auth.admin.updateUserById(
      context.userId,
      {
        password: data.newPin,
      },
    );

    if (updateAuthErr) {
      throw new Error(`Failed to update authentication: ${updateAuthErr.message}`);
    }

    // Update student_accounts table
    const { error: updateAccErr } = await supabaseAdmin
      .from("student_accounts")
      .update({
        pin_hash: newPinHash,
        must_change_pin: false,
        pin_last_changed_at: new Date().toISOString(),
      })
      .eq("id", account.id);

    if (updateAccErr) throw new Error(updateAccErr.message);

    await recordAuditLog(supabaseAdmin, {
      userId: context.userId,
      action: "PIN Changed",
      module: "student_accounts",
      recordId: account.id,
      newData: { student_id: account.student_id, must_change_pin: false },
    });

    return { ok: true };
  });

/**
 * Admin action: Reset student PIN (sets must_change_pin = true and sends credentials email)
 */
export const adminResetStudentPin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { studentId: string; customPin?: string | null }) =>
      z
        .object({
          studentId: z.string().uuid(),
          customPin: z
            .string()
            .regex(/^\d{4,8}$/, "PIN must be between 4 and 8 digits")
            .optional()
            .nullable(),
        })
        .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden: Admin access required.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Fetch student and account
    const { data: student, error: studErr } = await supabaseAdmin
      .from("students")
      .select("id, user_id, full_name, student_number, identity_number, admission_contact_email, classes(class_name)")
      .eq("id", data.studentId)
      .single();

    if (studErr || !student) throw new Error("Student not found.");
    if (!student.user_id) throw new Error("Student does not have an active portal account.");

    const { data: account, error: accErr } = await supabaseAdmin
      .from("student_accounts")
      .select("id, username")
      .eq("student_id", student.id)
      .single();

    if (accErr || !account) throw new Error("Student portal account not found.");

    // Determine new temporary PIN: customPin or last 4 digits of NID or random 4 digits
    let newTempPin = data.customPin;
    if (!newTempPin) {
      newTempPin = extractPinFromNid(student.identity_number);
    }
    if (!newTempPin) {
      newTempPin = Math.floor(1000 + Math.random() * 9000).toString();
    }

    const pinHash = hashPin(newTempPin);

    // Update Supabase Auth user password
    const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(student.user_id, {
      password: newTempPin,
    });
    if (authErr) throw new Error(`Failed to reset auth password: ${authErr.message}`);

    // Send credentials email
    let emailStatus: "sent" | "failed" | "pending_retry" = "pending";
    let emailError: string | null = null;
    const recipientEmail = student.admission_contact_email;

    if (recipientEmail) {
      const clsName = (student.classes as any)?.class_name || "Enrolled Class";
      const emailRes = await sendAdmissionCredentialsEmail({
        recipientEmail,
        recipientName: student.full_name,
        studentName: student.full_name,
        studentNumber: student.student_number,
        username: account.username,
        temporaryPin: newTempPin,
        assignedClassName: clsName,
      });
      emailStatus = emailRes.status;
      emailError = emailRes.error || null;
    } else {
      emailStatus = "failed";
      emailError = "No guardian/contact email on student record.";
    }

    // Update student_accounts
    const { error: updErr } = await supabaseAdmin
      .from("student_accounts")
      .update({
        pin_hash: pinHash,
        must_change_pin: true,
        reset_by: context.userId,
        reset_at: new Date().toISOString(),
        last_credentials_sent_at: emailStatus === "sent" ? new Date().toISOString() : null,
        credentials_email_status: emailStatus,
        credentials_email_error: emailError,
      })
      .eq("id", account.id);

    if (updErr) throw new Error(updErr.message);

    await recordAuditLog(supabaseAdmin, {
      userId: context.userId,
      action: "PIN Reset",
      module: "student_accounts",
      recordId: account.id,
      newData: {
        student_id: student.id,
        reset_by: context.userId,
        email_status: emailStatus,
      },
    });

    return {
      ok: true,
      temporaryPin: newTempPin,
      username: account.username,
      studentName: student.full_name,
      studentNumber: student.student_number,
      emailStatus,
      emailError,
      recipientEmail,
    };
  });

/**
 * Admin action: Resend credentials (generates a NEW temporary PIN and dispatches email)
 */
export const adminResendStudentCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { studentId: string }) =>
    z
      .object({
        studentId: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden: Admin access required.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Delegate to reset with auto-derived PIN
    const result = await adminResetStudentPin({
      data: { studentId: data.studentId, customPin: null },
    });

    await recordAuditLog(supabaseAdmin, {
      userId: context.userId,
      action: "Credentials Resent",
      module: "student_accounts",
      recordId: data.studentId,
      newData: { emailStatus: result.emailStatus },
    });

    return result;
  });

/**
 * Admin action: Toggle Student Account Status (Active / Suspended)
 */
export const adminToggleStudentAccountStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { accountId: string; status: "active" | "suspended" | "disabled" }) =>
      z
        .object({
          accountId: z.string().uuid(),
          status: z.enum(["active", "suspended", "disabled"]),
        })
        .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden: Admin access required.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const isActive = data.status === "active";
    const isLocked = data.status !== "active";

    const { data: acc, error: getErr } = await supabaseAdmin
      .from("student_accounts")
      .select("id, student_id, user_id, status")
      .eq("id", data.accountId)
      .single();

    if (getErr || !acc) throw new Error("Account not found.");

    const { error: updErr } = await supabaseAdmin
      .from("student_accounts")
      .update({
        status: data.status,
        is_active: isActive,
        is_locked: isLocked,
      })
      .eq("id", data.accountId);

    if (updErr) throw new Error(updErr.message);

    await recordAuditLog(supabaseAdmin, {
      userId: context.userId,
      action: isActive ? "Account Reactivated" : "Account Suspended",
      module: "student_accounts",
      recordId: data.accountId,
      oldData: { status: acc.status },
      newData: { status: data.status },
    });

    return { ok: true, status: data.status };
  });

/**
 * Fetch all Student Accounts for Admin User Management
 */
export const getAdminStudentAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden: Admin access required.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data, error } = await supabaseAdmin
      .from("student_accounts")
      .select(
        `
        id,
        student_id,
        user_id,
        username,
        status,
        is_active,
        is_locked,
        must_change_pin,
        last_login,
        pin_last_changed_at,
        created_at,
        last_credentials_sent_at,
        credentials_email_status,
        credentials_email_error,
        students:student_id (
          id,
          student_number,
          full_name,
          identity_number,
          mobile,
          admission_contact_email,
          admission_request_id,
          classes:class_id (class_name)
        )
      `,
      )
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    return (data || []) as any[];
  });

/**
 * Status updater for waitlist, pending, etc.
 */
export const setAdmissionStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      requestId: string;
      status: "rejected" | "waitlisted" | "pending" | "under_review";
      adminNote?: string;
    }) =>
      z
        .object({
          requestId: z.string().uuid(),
          status: z.enum(["rejected", "waitlisted", "pending", "under_review"]),
          adminNote: z.string().max(2000).optional(),
        })
        .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden: Admin access required.");

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

    await recordAuditLog(supabaseAdmin, {
      userId: context.userId,
      action: `Status set to ${data.status}`,
      module: "admissions",
      recordId: data.requestId,
      newData: { status: data.status, admin_notes: data.adminNote },
    });

    return { ok: true };
  });
