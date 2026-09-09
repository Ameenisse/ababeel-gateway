import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type {
  FeeBill,
  FeePayment,
  FeePaymentSubmission,
  FeeSettings,
  FinancialAccount,
  StudentFeeSummary,
} from "@/types/fees";

/**
 * Fetch all fee data for the authenticated student
 */
export const getStudentFeeData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Identify student
    const { data: student, error: studErr } = await supabaseAdmin
      .from("students")
      .select("id, full_name, student_number, class_id, user_id, status, classes(class_name)")
      .eq("user_id", context.userId)
      .maybeSingle();

    if (studErr) throw new Error(studErr.message);
    if (!student) {
      return {
        student: null,
        bills: [],
        submissions: [],
        payments: [],
        settings: null,
        summary: {
          student_name: "",
          student_number: "",
          current_month_fee: 0,
          total_outstanding: 0,
          paid_this_year: 0,
          pending_approval_amount: 0,
          overdue_balance: 0,
          unpaid_bills_count: 0,
          oldest_due_month: null,
          oldest_due_date: null,
          has_pending_submission: false,
          pending_submission_bill_id: null,
        } as StudentFeeSummary,
      };
    }

    // 2. Fetch fee bills
    const { data: bills, error: billsErr } = await supabaseAdmin
      .from("fee_bills")
      .select("*")
      .eq("student_id", student.id)
      .order("due_date", { ascending: false });

    if (billsErr) throw new Error(billsErr.message);

    // 3. Fetch payment submissions
    const { data: submissions, error: subsErr } = await supabaseAdmin
      .from("fee_payment_submissions")
      .select("*")
      .eq("student_id", student.id)
      .order("submitted_at", { ascending: false });

    if (subsErr) throw new Error(subsErr.message);

    // 4. Fetch official payments
    const { data: payments, error: payErr } = await supabaseAdmin
      .from("fee_payments")
      .select("*, financial_account:financial_accounts(account_name)")
      .eq("student_id", student.id)
      .order("approved_at", { ascending: false });

    if (payErr) throw new Error(payErr.message);

    // 5. Fetch settings
    const { data: settings } = await supabaseAdmin
      .from("fee_settings")
      .select("*")
      .eq("singleton", true)
      .maybeSingle();

    // Map active submissions to bills
    const activeSubsByBill: Record<string, FeePaymentSubmission> = {};
    for (const sub of (submissions as unknown as FeePaymentSubmission[]) || []) {
      if (sub.status === "pending" || sub.status === "under_review") {
        if (!activeSubsByBill[sub.fee_bill_id]) {
          activeSubsByBill[sub.fee_bill_id] = sub;
        }
      }
    }

    // Attach active submission to each bill
    const enrichedBills = ((bills as unknown as FeeBill[]) || []).map((b) => ({
      ...b,
      active_submission: activeSubsByBill[b.id] || null,
    }));

    // Calculate Summary Metrics
    const today = new Date().toISOString().slice(0, 10);
    let totalOutstanding = 0;
    let pendingApprovalAmount = 0;
    let overdueBalance = 0;
    let unpaidCount = 0;
    let paidThisYear = 0;
    let oldestDueDate: string | null = null;
    let oldestDueMonth: string | null = null;
    let hasPending = false;
    let pendingBillId: string | null = null;

    const currentYear = new Date().getFullYear().toString();
    for (const p of (payments as unknown as FeePayment[]) || []) {
      if (p.payment_date?.startsWith(currentYear) || p.approved_at?.startsWith(currentYear)) {
        paidThisYear += Number(p.amount || 0);
      }
    }

    for (const sub of (submissions as unknown as FeePaymentSubmission[]) || []) {
      if (sub.status === "pending" || sub.status === "under_review") {
        pendingApprovalAmount += Number(sub.submitted_amount || 0);
        hasPending = true;
        if (!pendingBillId) pendingBillId = sub.fee_bill_id;
      }
    }

    // Bills sorted oldest first for oldest due finding
    const sortedByDateAsc = [...enrichedBills].sort((a, b) => a.due_date.localeCompare(b.due_date));
    for (const b of sortedByDateAsc) {
      const isUnpaidOrOverdue =
        b.status === "unpaid" ||
        b.status === "partially_paid" ||
        b.status === "overdue" ||
        b.status === "pending_approval";

      if (isUnpaidOrOverdue && Number(b.outstanding_amount) > 0) {
        totalOutstanding += Number(b.outstanding_amount);
        unpaidCount += 1;

        if (b.due_date < today) {
          overdueBalance += Number(b.outstanding_amount);
        }

        if (!oldestDueDate) {
          oldestDueDate = b.due_date;
          oldestDueMonth = b.fee_month;
        }
      }
    }

    // Current month fee (e.g. fee matching current month name or most recent bill)
    const currentMonthBill = enrichedBills[0];
    const currentMonthFee = currentMonthBill ? Number(currentMonthBill.amount) : 0;

    const summary: StudentFeeSummary = {
      student_name: student.full_name,
      student_number: student.student_number,
      current_month_fee: currentMonthFee,
      total_outstanding: totalOutstanding,
      paid_this_year: paidThisYear,
      pending_approval_amount: pendingApprovalAmount,
      overdue_balance: overdueBalance,
      unpaid_bills_count: unpaidCount,
      oldest_due_month: oldestDueMonth,
      oldest_due_date: oldestDueDate,
      has_pending_submission: hasPending,
      pending_submission_bill_id: pendingBillId,
    };

    return {
      student,
      bills: enrichedBills,
      submissions: (submissions as unknown as FeePaymentSubmission[]) || [],
      payments: (payments as unknown as FeePayment[]) || [],
      settings: (settings as unknown as FeeSettings) || null,
      summary,
    };
  });

/**
 * Submit self-payment by student
 */
export const submitStudentPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (input: {
      fee_bill_id: string;
      submitted_amount: number;
      payment_date: string;
      payment_method: "bank_transfer" | "online_transfer" | "cash";
      payment_account_text?: string;
      transfer_reference?: string;
      slip_path?: string;
      student_note?: string;
    }) =>
      z
        .object({
          fee_bill_id: z.string().uuid(),
          submitted_amount: z.number().positive("Payment amount must be greater than 0"),
          payment_date: z.string().min(1, "Payment date is required"),
          payment_method: z.enum(["bank_transfer", "online_transfer", "cash"]),
          payment_account_text: z.string().optional(),
          transfer_reference: z.string().optional(),
          slip_path: z.string().optional(),
          student_note: z.string().optional(),
        })
        .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Verify student identity
    const { data: student, error: studErr } = await supabaseAdmin
      .from("students")
      .select("id, full_name, student_number")
      .eq("user_id", context.userId)
      .maybeSingle();

    if (studErr) throw new Error(studErr.message);
    if (!student) throw new Error("Student account not found");

    // 2. Verify fee bill belongs to student
    const { data: bill, error: billErr } = await supabaseAdmin
      .from("fee_bills")
      .select("*")
      .eq("id", data.fee_bill_id)
      .eq("student_id", student.id)
      .maybeSingle();

    if (billErr) throw new Error(billErr.message);
    if (!bill) throw new Error("Fee bill not found or does not belong to your account");

    if (Number(bill.outstanding_amount) <= 0) {
      throw new Error("This fee bill has already been fully paid.");
    }

    // 3. Check for existing active submission (Pending or Under Review)
    const { data: existingSub } = await supabaseAdmin
      .from("fee_payment_submissions")
      .select("id, submitted_amount, status")
      .eq("fee_bill_id", data.fee_bill_id)
      .in("status", ["pending", "under_review"])
      .maybeSingle();

    if (existingSub) {
      throw new Error(
        "A payment submission for this fee is already waiting for approval. Please wait for Admin review before submitting again.",
      );
    }

    // 4. Validate slip requirement for bank/online transfer
    if (
      (data.payment_method === "bank_transfer" || data.payment_method === "online_transfer") &&
      !data.slip_path
    ) {
      throw new Error("Payment slip is required for Bank/Online transfers.");
    }

    // 5. Create payment submission
    const { data: newSub, error: insertErr } = await supabaseAdmin
      .from("fee_payment_submissions")
      .insert({
        fee_bill_id: data.fee_bill_id,
        student_id: student.id,
        submitted_amount: data.submitted_amount,
        payment_date: data.payment_date,
        payment_method: data.payment_method,
        payment_account_text: data.payment_account_text || null,
        transfer_reference: data.transfer_reference || null,
        slip_path: data.slip_path || null,
        student_note: data.student_note || null,
        status: "pending",
        submitted_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertErr) throw new Error(insertErr.message);

    // 6. Update fee bill status to 'pending_approval' (without altering paid/outstanding balances)
    await supabaseAdmin
      .from("fee_bills")
      .update({
        status: "pending_approval",
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.fee_bill_id);

    // 7. Notify Admins
    try {
      const { data: adminUsers } = await supabaseAdmin
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");

      if (adminUsers && adminUsers.length > 0) {
        const notifs = adminUsers.map((a) => ({
          user_id: a.user_id,
          title: "New Fee Payment Submission",
          message: `${student.full_name} submitted MVR ${data.submitted_amount.toFixed(2)} for ${bill.fee_month} (${data.payment_method.replace("_", " ")}).`,
          type: "fee_submission",
          action_url: "/admin/fees?tab=approvals",
          created_at: new Date().toISOString(),
        }));
        await supabaseAdmin.from("in_app_notifications").insert(notifs);
      }
    } catch (e) {
      console.warn("Failed to create admin notifications:", e);
    }

    return {
      success: true,
      submission: newSub,
      message: "Payment submitted successfully. Your payment is waiting for Admin approval.",
    };
  });

/**
 * Get signed URL for previewing payment slips securely
 */
export const getPaymentSlipSignedUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { slipPath: string }) =>
    z.object({ slipPath: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Check if admin
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });

    if (!isAdmin) {
      // Must be student and path must start with student.id
      const { data: student } = await supabaseAdmin
        .from("students")
        .select("id")
        .eq("user_id", context.userId)
        .maybeSingle();

      if (!student || !data.slipPath.startsWith(student.id)) {
        throw new Error("Access denied to requested payment slip.");
      }
    }

    const { data: signed, error } = await supabaseAdmin.storage
      .from("fee-payment-slips")
      .createSignedUrl(data.slipPath, 1800); // 30 minutes

    if (error) throw new Error(error.message);
    return { signedUrl: signed?.signedUrl ?? null };
  });

/**
 * Admin: Fetch Payment Approvals Queue & stats
 */
export const getAdminPaymentApprovalsQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Admin gate
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden: Admin access required.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Fetch submissions with joined students & bills
    const { data: submissions, error: subErr } = await supabaseAdmin
      .from("fee_payment_submissions")
      .select(
        `
        *,
        students(id, full_name, student_number, class_id, classes(class_name)),
        fee_bills(id, bill_number, fee_month, amount, approved_paid_amount, outstanding_amount, due_date, status)
      `,
      )
      .order("submitted_at", { ascending: true }); // Oldest pending first

    if (subErr) throw new Error(subErr.message);

    // Fetch financial accounts
    const { data: accounts } = await supabaseAdmin
      .from("financial_accounts")
      .select("*")
      .eq("is_active", true)
      .order("account_name");

    // Fetch fee settings
    const { data: settings } = await supabaseAdmin
      .from("fee_settings")
      .select("*")
      .eq("singleton", true)
      .maybeSingle();

    // Stats
    const today = new Date().toISOString().slice(0, 10);
    let pendingCount = 0;
    let approvedToday = 0;
    let rejectedToday = 0;
    let totalPendingAmount = 0;

    for (const sub of submissions || []) {
      if (sub.status === "pending" || sub.status === "under_review") {
        pendingCount += 1;
        totalPendingAmount += Number(sub.submitted_amount || 0);
      } else if (sub.status === "approved" && sub.reviewed_at?.startsWith(today)) {
        approvedToday += 1;
      } else if (sub.status === "rejected" && sub.reviewed_at?.startsWith(today)) {
        rejectedToday += 1;
      }
    }

    return {
      submissions: submissions || [],
      accounts: (accounts as unknown as FinancialAccount[]) || [],
      settings: (settings as unknown as FeeSettings) || null,
      stats: {
        pendingCount,
        approvedToday,
        rejectedToday,
        totalPendingAmount,
      },
    };
  });

/**
 * Admin: Approve a payment submission atomically
 */
export const approvePaymentSubmission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (input: {
      submission_id: string;
      receiving_account_id: string;
      approved_amount?: number;
      admin_comment?: string;
      difference_reason?: string;
    }) =>
      z
        .object({
          submission_id: z.string().uuid(),
          receiving_account_id: z.string().uuid("Please select a receiving financial account"),
          approved_amount: z.number().positive().optional(),
          admin_comment: z.string().optional(),
          difference_reason: z.string().optional(),
        })
        .parse(input),
  )
  .handler(async ({ data, context }) => {
    // Admin gate
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden: Admin access required.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Fetch submission
    const { data: sub, error: subErr } = await supabaseAdmin
      .from("fee_payment_submissions")
      .select("*, students(id, full_name, student_number, user_id), fee_bills(*)")
      .eq("id", data.submission_id)
      .maybeSingle();

    if (subErr) throw new Error(subErr.message);
    if (!sub) throw new Error("Payment submission not found");

    if (sub.status !== "pending" && sub.status !== "under_review") {
      throw new Error(`Submission cannot be approved because it is currently "${sub.status}".`);
    }

    const bill = sub.fee_bills as unknown as FeeBill;
    if (!bill) throw new Error("Associated fee bill not found");

    const student = sub.students as unknown as {
      id: string;
      full_name: string;
      student_number: string;
      user_id: string;
    };

    // Determine final approved amount
    const approvedAmount =
      data.approved_amount !== undefined && data.approved_amount > 0
        ? data.approved_amount
        : Number(sub.submitted_amount);

    if (approvedAmount !== Number(sub.submitted_amount) && !data.difference_reason) {
      throw new Error(
        "A justification reason is required when the approved amount differs from the submitted amount.",
      );
    }

    // 2. Fetch and validate receiving financial account
    const { data: account, error: accErr } = await supabaseAdmin
      .from("financial_accounts")
      .select("*")
      .eq("id", data.receiving_account_id)
      .maybeSingle();

    if (accErr || !account) throw new Error("Receiving financial account not found");

    // 3. Generate unique official receipt number
    const year = new Date().getFullYear();
    const randSeq = Math.floor(100000 + Math.random() * 900000);
    const receiptNumber = `REC-${year}-${randSeq}`;

    // 4. Create financial account transaction
    const { data: tx, error: txErr } = await supabaseAdmin
      .from("account_transactions")
      .insert({
        financial_account_id: data.receiving_account_id,
        transaction_type: "fee_income",
        amount: approvedAmount,
        reference: sub.transfer_reference || `Fee Bill ${bill.bill_number}`,
        description: `Fee Income: ${bill.fee_month} — ${student.full_name} (${student.student_number})`,
        student_id: student.id,
        fee_bill_id: bill.id,
        transaction_date: sub.payment_date || new Date().toISOString().slice(0, 10),
        created_by: context.userId,
      })
      .select()
      .single();

    if (txErr) throw new Error(txErr.message);

    // Update account balance
    const newBalance = Number(account.current_balance || 0) + approvedAmount;
    await supabaseAdmin
      .from("financial_accounts")
      .update({ current_balance: newBalance, updated_at: new Date().toISOString() })
      .eq("id", account.id);

    // 5. Create official fee_payments record
    const { error: payErr } = await supabaseAdmin.from("fee_payments").insert({
      fee_bill_id: bill.id,
      student_id: student.id,
      payment_submission_id: sub.id,
      receipt_number: receiptNumber,
      amount: approvedAmount,
      payment_date: sub.payment_date || new Date().toISOString().slice(0, 10),
      approved_at: new Date().toISOString(),
      payment_method: sub.payment_method,
      financial_account_id: account.id,
      transaction_id: tx.id,
      reference: sub.transfer_reference || null,
      approved_by: context.userId,
      notes: data.admin_comment || data.difference_reason || null,
    });

    if (payErr) throw new Error(payErr.message);

    // 6. Recalculate fee bill
    const currentPaid = Number(bill.approved_paid_amount || 0);
    const newPaid = currentPaid + approvedAmount;
    const newOutstanding = Math.max(0, Number(bill.amount) - newPaid);
    const newStatus = newOutstanding <= 0 ? "paid" : "partially_paid";

    const { error: billUpdateErr } = await supabaseAdmin
      .from("fee_bills")
      .update({
        approved_paid_amount: newPaid,
        outstanding_amount: newOutstanding,
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", bill.id);

    if (billUpdateErr) throw new Error(billUpdateErr.message);

    // 7. Update fee_payment_submissions
    const { error: subUpdateErr } = await supabaseAdmin
      .from("fee_payment_submissions")
      .update({
        status: "approved",
        approved_amount: approvedAmount,
        receiving_account_id: account.id,
        admin_comment: data.admin_comment || data.difference_reason || null,
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", sub.id);

    if (subUpdateErr) throw new Error(subUpdateErr.message);

    // 8. Send in-app notification to student
    if (student.user_id) {
      await supabaseAdmin.from("in_app_notifications").insert({
        user_id: student.user_id,
        title: "Fee Payment Approved",
        message: `Your payment of MVR ${approvedAmount.toFixed(2)} for ${bill.fee_month} has been approved. Receipt ${receiptNumber} is now available.`,
        type: "fee_approved",
        action_url: "/student/fees?tab=paid",
        created_at: new Date().toISOString(),
      });
    }

    return {
      success: true,
      receiptNumber,
      approvedAmount,
      newStatus,
      message: `Payment successfully approved and posted. Receipt: ${receiptNumber}`,
    };
  });

/**
 * Admin: Reject a payment submission
 */
export const rejectPaymentSubmission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { submission_id: string; rejection_reason: string; admin_comment?: string }) =>
    z
      .object({
        submission_id: z.string().uuid(),
        rejection_reason: z.string().min(3, "Please provide a specific rejection reason"),
        admin_comment: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    // Admin gate
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden: Admin access required.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Fetch submission
    const { data: sub, error: subErr } = await supabaseAdmin
      .from("fee_payment_submissions")
      .select("*, students(id, full_name, user_id), fee_bills(*)")
      .eq("id", data.submission_id)
      .maybeSingle();

    if (subErr) throw new Error(subErr.message);
    if (!sub) throw new Error("Payment submission not found");

    if (sub.status !== "pending" && sub.status !== "under_review") {
      throw new Error(`Submission cannot be rejected because it is currently "${sub.status}".`);
    }

    const bill = sub.fee_bills as unknown as FeeBill;
    const student = sub.students as unknown as { id: string; full_name: string; user_id: string };

    // 2. Mark submission Rejected
    const { error: updateSubErr } = await supabaseAdmin
      .from("fee_payment_submissions")
      .update({
        status: "rejected",
        rejection_reason: data.rejection_reason,
        admin_comment: data.admin_comment || null,
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", sub.id);

    if (updateSubErr) throw new Error(updateSubErr.message);

    // 3. Return fee bill to appropriate outstanding status
    if (bill) {
      const today = new Date().toISOString().slice(0, 10);
      let calculatedStatus: FeeBill["status"] = "unpaid";
      if (Number(bill.approved_paid_amount || 0) > 0) {
        calculatedStatus = "partially_paid";
      } else if (bill.due_date < today) {
        calculatedStatus = "overdue";
      } else {
        calculatedStatus = "unpaid";
      }

      await supabaseAdmin
        .from("fee_bills")
        .update({
          status: calculatedStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", bill.id);
    }

    // 4. Notify student
    if (student?.user_id) {
      await supabaseAdmin.from("in_app_notifications").insert({
        user_id: student.user_id,
        title: "Payment Submission Not Approved",
        message: `Your payment submission of MVR ${Number(sub.submitted_amount).toFixed(2)} for ${bill?.fee_month || "fee"} was rejected: "${data.rejection_reason}". You can submit a new payment with updated details.`,
        type: "fee_rejected",
        action_url: "/student/fees?tab=outstanding",
        created_at: new Date().toISOString(),
      });
    }

    return {
      success: true,
      message: "Payment submission rejected.",
    };
  });

/**
 * Admin: Update fee settings
 */
export const updateFeeSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: Partial<FeeSettings>) => z.object({}).passthrough().parse(input))
  .handler(async ({ data, context }) => {
    // Admin gate
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden: Admin access required.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const payload = {
      bank_name: data.bank_name,
      account_name: data.account_name,
      account_number: data.account_number,
      secondary_account: data.secondary_account,
      payment_instructions: data.payment_instructions,
      viber_contact: data.viber_contact,
      default_fee_due_day: data.default_fee_due_day ?? 10,
      require_payment_slip: data.require_payment_slip ?? true,
      allow_partial_payment: data.allow_partial_payment ?? true,
      allow_cash_submission: data.allow_cash_submission ?? true,
      fee_reminder_popup: data.fee_reminder_popup ?? true,
      reminder_days_before_due: data.reminder_days_before_due ?? 5,
      overdue_reminder: data.overdue_reminder ?? true,
      updated_at: new Date().toISOString(),
    };

    const { data: res, error } = await supabaseAdmin
      .from("fee_settings")
      .update(payload)
      .eq("singleton", true)
      .select()
      .maybeSingle();

    if (error) throw new Error(error.message);
    return res;
  });

/**
 * Admin: Generate monthly fee bills for class(es)
 */
export const generateMonthlyFeeBills = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (input: { class_id?: string | null; fee_month: string; due_date: string; amount: number }) =>
      z
        .object({
          class_id: z.string().uuid().nullable().optional(),
          fee_month: z.string().min(2, "Fee month is required"),
          due_date: z.string().min(1, "Due date is required"),
          amount: z.number().positive("Amount must be greater than 0"),
        })
        .parse(input),
  )
  .handler(async ({ data, context }) => {
    // Admin gate
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden: Admin access required.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Query active students
    let query = supabaseAdmin
      .from("students")
      .select("id, class_id, full_name, user_id")
      .eq("status", "active");

    if (data.class_id) {
      query = query.eq("class_id", data.class_id);
    }

    const { data: students, error: studErr } = await query;
    if (studErr) throw new Error(studErr.message);
    if (!students || students.length === 0) {
      return { count: 0, message: "No active students found in selected criteria." };
    }

    let createdCount = 0;
    const now = new Date();
    const monthSlug = data.fee_month.replace(/[^a-zA-Z0-9]/g, "-").slice(0, 10);

    for (const s of students) {
      // Check if bill already exists for this student & fee_month
      const { data: existing } = await supabaseAdmin
        .from("fee_bills")
        .select("id")
        .eq("student_id", s.id)
        .eq("fee_month", data.fee_month)
        .maybeSingle();

      if (!existing) {
        const rand = Math.floor(1000 + Math.random() * 9000);
        const billNumber = `BILL-${now.getFullYear()}-${monthSlug}-${rand}`;

        await supabaseAdmin.from("fee_bills").insert({
          bill_number: billNumber,
          student_id: s.id,
          class_id: s.class_id,
          fee_month: data.fee_month,
          due_date: data.due_date,
          amount: data.amount,
          approved_paid_amount: 0,
          outstanding_amount: data.amount,
          status: "unpaid",
          notes: `Generated fee bill for ${data.fee_month}`,
        });

        // In-app notification to student
        if (s.user_id) {
          await supabaseAdmin.from("in_app_notifications").insert({
            user_id: s.user_id,
            title: "New Fee Bill Issued",
            message: `A fee bill of MVR ${data.amount.toFixed(2)} for ${data.fee_month} has been issued. Due date: ${data.due_date}.`,
            type: "fee_bill",
            action_url: "/student/fees",
            created_at: new Date().toISOString(),
          });
        }

        createdCount++;
      }
    }

    return {
      count: createdCount,
      message: `Generated ${createdCount} fee bills for ${data.fee_month}.`,
    };
  });
