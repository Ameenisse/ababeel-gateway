export type FeeStatus =
  "unpaid" | "partially_paid" | "pending_approval" | "paid" | "overdue" | "waived" | "cancelled";

export type PaymentMethod = "bank_transfer" | "online_transfer" | "cash";

export type SubmissionStatus = "pending" | "under_review" | "approved" | "rejected" | "cancelled";

export type FeeSettings = {
  id: string;
  bank_name: string;
  account_name: string;
  account_number: string;
  secondary_account: string | null;
  payment_instructions: string | null;
  viber_contact: string | null;
  default_fee_due_day: number;
  require_payment_slip: boolean;
  allow_partial_payment: boolean;
  allow_cash_submission: boolean;
  fee_reminder_popup: boolean;
  reminder_days_before_due: number;
  overdue_reminder: boolean;
  singleton: boolean;
};

export type FinancialAccount = {
  id: string;
  account_name: string;
  account_type: "bank" | "cash" | "other";
  account_number: string | null;
  current_balance: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type FeeBill = {
  id: string;
  bill_number: string;
  student_id: string;
  class_id: string | null;
  academic_year_id: string | null;
  fee_month: string;
  due_date: string;
  amount: number;
  approved_paid_amount: number;
  outstanding_amount: number;
  status: FeeStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // joined info if queried
  student?: {
    id: string;
    full_name: string;
    student_number: string;
    class_id?: string | null;
    classes?: { class_name: string } | null;
  };
  active_submission?: FeePaymentSubmission | null;
  payments?: FeePayment[];
};

export type FeePaymentSubmission = {
  id: string;
  fee_bill_id: string;
  student_id: string;
  submitted_amount: number;
  payment_date: string;
  payment_method: PaymentMethod;
  payment_account_text: string | null;
  transfer_reference: string | null;
  slip_path: string | null;
  student_note: string | null;
  status: SubmissionStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  approved_amount: number | null;
  receiving_account_id: string | null;
  admin_comment: string | null;
  rejection_reason: string | null;
  submitted_at: string;
  created_at: string;
  updated_at: string;
  // joined
  fee_bills?: FeeBill | null;
  students?: {
    id: string;
    full_name: string;
    student_number: string;
    classes?: { class_name: string } | null;
  } | null;
  reviewer?: {
    email?: string;
  } | null;
};

export type FeePayment = {
  id: string;
  fee_bill_id: string;
  student_id: string;
  payment_submission_id: string | null;
  receipt_number: string;
  amount: number;
  payment_date: string;
  approved_at: string;
  payment_method: string;
  financial_account_id: string | null;
  transaction_id: string | null;
  reference: string | null;
  approved_by: string | null;
  notes: string | null;
  created_at: string;
  // joined
  financial_account?: {
    account_name: string;
  } | null;
};

export type StudentFeeSummary = {
  student_name: string;
  student_number: string;
  current_month_fee: number;
  total_outstanding: number;
  paid_this_year: number;
  pending_approval_amount: number;
  overdue_balance: number;
  unpaid_bills_count: number;
  oldest_due_month: string | null;
  oldest_due_date: string | null;
  has_pending_submission: boolean;
  pending_submission_bill_id: string | null;
};
