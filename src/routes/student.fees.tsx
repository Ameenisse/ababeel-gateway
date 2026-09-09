import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { RoleShell } from "@/components/role-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CreditCard,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Receipt,
  FileText,
  ExternalLink,
  ChevronRight,
  Eye,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { getStudentFeeData, getPaymentSlipSignedUrl } from "@/lib/fees.functions";
import type {
  FeeBill,
  FeePayment,
  FeePaymentSubmission,
  FeeSettings,
  StudentFeeSummary,
} from "@/types/fees";
import { StudentPayFeeModal } from "@/components/student-pay-fee-modal";
import { FeeReceiptModal } from "@/components/fee-receipt-modal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/student/fees")({
  ssr: false,
  head: () => ({
    meta: [{ title: "My Fees — Ababeel Quran Class" }],
  }),
  component: StudentFeesPage,
});

function StudentFeesPage() {
  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState<{
    id: string;
    full_name: string;
    student_number: string;
    classes?: { class_name: string } | null;
  } | null>(null);
  const [bills, setBills] = useState<FeeBill[]>([]);
  const [submissions, setSubmissions] = useState<FeePaymentSubmission[]>([]);
  const [payments, setPayments] = useState<FeePayment[]>([]);
  const [settings, setSettings] = useState<FeeSettings | null>(null);
  const [summary, setSummary] = useState<StudentFeeSummary | null>(null);

  // Modals state
  const [selectedBillForPay, setSelectedBillForPay] = useState<FeeBill | null>(null);
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [selectedPaymentForReceipt, setSelectedPaymentForReceipt] = useState<{
    payment: FeePayment;
    bill?: FeeBill;
  } | null>(null);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);

  // Details Modal
  const [detailBill, setDetailBill] = useState<FeeBill | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getStudentFeeData();
      if (res?.student) {
        setStudent(res.student);
        setBills(res.bills || []);
        setSubmissions(res.submissions || []);
        setPayments(res.payments || []);
        setSettings(res.settings);
        setSummary(res.summary);
      }
    } catch (err) {
      toast.error("Failed to load fee information");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenPay = (bill: FeeBill) => {
    setSelectedBillForPay(bill);
    setPayModalOpen(true);
  };

  const handleOpenReceipt = (payment: FeePayment, bill?: FeeBill) => {
    setSelectedPaymentForReceipt({ payment, bill });
    setReceiptModalOpen(true);
  };

  const handlePreviewSlip = async (slipPath: string) => {
    try {
      const res = await getPaymentSlipSignedUrl({ data: { slipPath } });
      if (res.signedUrl) {
        window.open(res.signedUrl, "_blank");
      } else {
        toast.error("Unable to generate slip preview link");
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Access denied to slip";
      toast.error(msg);
    }
  };

  const getStatusBadge = (status: FeeBill["status"]) => {
    switch (status) {
      case "paid":
        return (
          <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium">Paid</Badge>
        );
      case "partially_paid":
        return (
          <Badge className="bg-orange-500 hover:bg-orange-600 text-white font-medium">
            Partially Paid
          </Badge>
        );
      case "pending_approval":
        return (
          <Badge className="bg-amber-500 hover:bg-amber-600 text-white font-medium">
            Pending Approval
          </Badge>
        );
      case "overdue":
        return (
          <Badge className="bg-rose-700 hover:bg-rose-800 text-white font-medium">Overdue</Badge>
        );
      case "unpaid":
        return (
          <Badge className="bg-rose-500 hover:bg-rose-600 text-white font-medium">Unpaid</Badge>
        );
      case "waived":
        return <Badge variant="secondary">Waived</Badge>;
      case "cancelled":
        return <Badge variant="outline">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getSubmissionStatusBadge = (status: FeePaymentSubmission["status"]) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-emerald-600 text-white">Approved</Badge>;
      case "pending":
        return <Badge className="bg-amber-500 text-white">Pending Approval</Badge>;
      case "under_review":
        return <Badge className="bg-blue-600 text-white">Under Review</Badge>;
      case "rejected":
        return <Badge className="bg-rose-600 text-white">Rejected</Badge>;
      case "cancelled":
        return <Badge variant="outline">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Filter lists for tabs
  const outstandingBills = bills.filter(
    (b) =>
      b.status === "unpaid" ||
      b.status === "partially_paid" ||
      b.status === "overdue" ||
      b.status === "pending_approval",
  );

  const pendingSubmissions = submissions.filter(
    (s) => s.status === "pending" || s.status === "under_review",
  );

  const paidBills = bills.filter((b) => b.status === "paid");

  return (
    <RoleShell role="student" title="My Fees">
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Top bar with refresh */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold font-display tracking-tight">Fee Management</h2>
            <p className="text-sm text-muted-foreground">
              Review monthly tuition fees, submit transfer slips, and download official payment
              receipts.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
            className="self-start sm:self-auto gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* 5 Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <Card className="border-border/60">
            <CardContent className="p-4 space-y-1">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <CreditCard className="h-3.5 w-3.5 text-primary" />
                Current Month Fee
              </div>
              <div className="text-xl font-bold font-display">
                MVR {summary ? summary.current_month_fee.toFixed(2) : "0.00"}
              </div>
            </CardContent>
          </Card>

          <Card className="border-rose-200 bg-rose-50/40 dark:bg-rose-950/10">
            <CardContent className="p-4 space-y-1">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                Total Outstanding
              </div>
              <div className="text-xl font-bold font-display text-rose-700 dark:text-rose-400">
                MVR {summary ? summary.total_outstanding.toFixed(2) : "0.00"}
              </div>
            </CardContent>
          </Card>

          <Card className="border-emerald-200 bg-emerald-50/40 dark:bg-emerald-950/10">
            <CardContent className="p-4 space-y-1">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Paid This Year
              </div>
              <div className="text-xl font-bold font-display text-emerald-700 dark:text-emerald-400">
                MVR {summary ? summary.paid_this_year.toFixed(2) : "0.00"}
              </div>
            </CardContent>
          </Card>

          <Card className="border-amber-200 bg-amber-50/40 dark:bg-amber-950/10">
            <CardContent className="p-4 space-y-1">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                Pending Approval
              </div>
              <div className="text-xl font-bold font-display text-amber-700 dark:text-amber-400">
                MVR {summary ? summary.pending_approval_amount.toFixed(2) : "0.00"}
              </div>
            </CardContent>
          </Card>

          <Card className="border-red-300 bg-red-50/60 dark:bg-red-950/20 col-span-2 sm:col-span-1">
            <CardContent className="p-4 space-y-1">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-red-800 dark:text-red-400 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                Overdue Balance
              </div>
              <div className="text-xl font-bold font-display text-red-800 dark:text-red-400">
                MVR {summary ? summary.overdue_balance.toFixed(2) : "0.00"}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs section */}
        <Tabs defaultValue="outstanding" className="space-y-4">
          <TabsList className="bg-muted/60 p-1 w-full sm:w-auto grid grid-cols-4 sm:flex">
            <TabsTrigger value="outstanding" className="gap-1.5 text-xs sm:text-sm">
              Outstanding
              {outstandingBills.length > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-1 px-1.5 py-0 text-[10px] bg-rose-100 text-rose-700"
                >
                  {outstandingBills.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="pending" className="gap-1.5 text-xs sm:text-sm">
              Pending Approval
              {pendingSubmissions.length > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-1 px-1.5 py-0 text-[10px] bg-amber-100 text-amber-800"
                >
                  {pendingSubmissions.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="paid" className="gap-1.5 text-xs sm:text-sm">
              Paid
              {paidBills.length > 0 && (
                <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px]">
                  {paidBills.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-1.5 text-xs sm:text-sm">
              All History
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: OUTSTANDING */}
          <TabsContent value="outstanding" className="space-y-3">
            {outstandingBills.length === 0 ? (
              <Card className="border-border/60">
                <CardContent className="p-8 text-center space-y-2">
                  <CheckCircle2 className="h-10 w-10 text-emerald-600 mx-auto" />
                  <div className="font-display font-semibold text-lg">No Outstanding Fees</div>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    Alhamdulillah! All your tuition fee bills are completely up to date.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {outstandingBills.map((b) => {
                  const isPending = b.status === "pending_approval" || Boolean(b.active_submission);
                  return (
                    <Card
                      key={b.id}
                      className="border-border/60 hover:border-border transition-colors"
                    >
                      <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-display font-bold text-base text-foreground">
                              {b.fee_month}
                            </span>
                            {getStatusBadge(b.status)}
                            <span className="text-xs font-mono text-muted-foreground">
                              {b.bill_number}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                            <span>
                              Due Date: <strong className="text-foreground">{b.due_date}</strong>
                            </span>
                            <span>
                              Total Fee: <strong>MVR {Number(b.amount).toFixed(2)}</strong>
                            </span>
                            {Number(b.approved_paid_amount || 0) > 0 && (
                              <span className="text-emerald-600">
                                Paid: MVR {Number(b.approved_paid_amount).toFixed(2)}
                              </span>
                            )}
                            <span className="text-rose-600 font-bold">
                              Outstanding: MVR {Number(b.outstanding_amount).toFixed(2)}
                            </span>
                          </div>

                          {isPending && (
                            <div className="text-xs text-amber-800 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-lg p-2 inline-flex items-center gap-1.5 mt-1">
                              <Clock className="h-3.5 w-3.5 text-amber-600" />
                              <span>
                                Payment submitted (MVR{" "}
                                {Number(
                                  b.active_submission?.submitted_amount || b.outstanding_amount,
                                ).toFixed(2)}
                                ) — waiting for Admin approval
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDetailBill(b)}
                            className="text-xs"
                          >
                            Details
                          </Button>
                          {isPending ? (
                            <Button
                              variant="secondary"
                              size="sm"
                              disabled
                              className="text-xs text-amber-800 bg-amber-100"
                            >
                              Waiting for Approval
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => handleOpenPay(b)}
                              className="text-xs bg-rose-600 hover:bg-rose-700 text-white gap-1.5"
                            >
                              <CreditCard className="h-3.5 w-3.5" />
                              Pay Now
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* TAB 2: PENDING APPROVAL SUBMISSIONS */}
          <TabsContent value="pending" className="space-y-3">
            {pendingSubmissions.length === 0 ? (
              <Card className="border-border/60">
                <CardContent className="p-8 text-center text-sm text-muted-foreground">
                  No payment submissions currently waiting for review.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {pendingSubmissions.map((sub) => {
                  const bill = bills.find((b) => b.id === sub.fee_bill_id);
                  return (
                    <Card key={sub.id} className="border-amber-200 bg-amber-50/20">
                      <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-display font-bold text-base text-foreground">
                              {bill?.fee_month || "Tuition Fee"}
                            </span>
                            {getSubmissionStatusBadge(sub.status)}
                            <span className="font-mono text-xs text-muted-foreground">
                              Submitted: {new Date(sub.submitted_at).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                            <span>
                              Amount Claimed:{" "}
                              <strong className="text-foreground">
                                MVR {Number(sub.submitted_amount).toFixed(2)}
                              </strong>
                            </span>
                            <span className="capitalize">
                              Method: {sub.payment_method.replace("_", " ")}
                            </span>
                            {sub.transfer_reference && <span>Ref: {sub.transfer_reference}</span>}
                          </div>
                          {sub.student_note && (
                            <div className="text-xs text-muted-foreground italic">
                              "{sub.student_note}"
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {sub.slip_path && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs gap-1"
                              onClick={() => handlePreviewSlip(sub.slip_path!)}
                            >
                              <Eye className="h-3.5 w-3.5" />
                              View Slip
                            </Button>
                          )}
                          <Badge
                            variant="outline"
                            className="text-amber-800 bg-amber-100 text-xs py-1"
                          >
                            Pending Admin Review
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* TAB 3: PAID */}
          <TabsContent value="paid" className="space-y-3">
            {paidBills.length === 0 ? (
              <Card className="border-border/60">
                <CardContent className="p-8 text-center text-sm text-muted-foreground">
                  No fully paid bills recorded yet.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {paidBills.map((b) => {
                  const billPayment = payments.find((p) => p.fee_bill_id === b.id);
                  return (
                    <Card key={b.id} className="border-emerald-200/60 bg-emerald-50/10">
                      <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-display font-bold text-base text-foreground">
                              {b.fee_month}
                            </span>
                            {getStatusBadge(b.status)}
                            <span className="text-xs font-mono text-muted-foreground">
                              {b.bill_number}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                            <span>
                              Total Paid:{" "}
                              <strong className="text-emerald-700">
                                MVR {Number(b.approved_paid_amount).toFixed(2)}
                              </strong>
                            </span>
                            {billPayment && (
                              <span>
                                Receipt:{" "}
                                <strong className="font-mono text-foreground">
                                  {billPayment.receipt_number}
                                </strong>
                              </span>
                            )}
                            {billPayment?.payment_date && (
                              <span>Paid Date: {billPayment.payment_date}</span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDetailBill(b)}
                            className="text-xs"
                          >
                            Details
                          </Button>
                          {billPayment && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleOpenReceipt(billPayment, b)}
                              className="text-xs gap-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
                            >
                              <Receipt className="h-3.5 w-3.5 text-emerald-700" />
                              View Receipt
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* TAB 4: ALL HISTORY & SUBMISSIONS */}
          <TabsContent value="history" className="space-y-4">
            <Card className="border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-display">All Fee Bills</CardTitle>
                <CardDescription className="text-xs">
                  Complete record of monthly fee invoices and current standing.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-muted/40 border-y text-muted-foreground uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="p-3">Fee Bill #</th>
                        <th className="p-3">Month</th>
                        <th className="p-3">Due Date</th>
                        <th className="p-3">Fee Amount</th>
                        <th className="p-3">Paid Amount</th>
                        <th className="p-3">Outstanding</th>
                        <th className="p-3">Status</th>
                        <th className="p-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {bills.map((b) => (
                        <tr key={b.id} className="hover:bg-muted/20">
                          <td className="p-3 font-mono font-medium">{b.bill_number}</td>
                          <td className="p-3 font-semibold">{b.fee_month}</td>
                          <td className="p-3 text-muted-foreground">{b.due_date}</td>
                          <td className="p-3 font-mono">MVR {Number(b.amount).toFixed(2)}</td>
                          <td className="p-3 font-mono text-emerald-600">
                            MVR {Number(b.approved_paid_amount || 0).toFixed(2)}
                          </td>
                          <td className="p-3 font-mono text-rose-600 font-bold">
                            MVR {Number(b.outstanding_amount).toFixed(2)}
                          </td>
                          <td className="p-3">{getStatusBadge(b.status)}</td>
                          <td className="p-3 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDetailBill(b)}
                              className="h-7 text-xs"
                            >
                              View Details
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Submissions & Proof History */}
            <Card className="border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-display">Payment Submissions Log</CardTitle>
                <CardDescription className="text-xs">
                  Every submitted transfer proof and the review verdict.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-muted/40 border-y text-muted-foreground uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="p-3">Submitted</th>
                        <th className="p-3">Amount</th>
                        <th className="p-3">Method</th>
                        <th className="p-3">Reference</th>
                        <th className="p-3">Slip Proof</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Admin Response</th>
                        <th className="p-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {submissions.map((sub) => {
                        const bill = bills.find((b) => b.id === sub.fee_bill_id);
                        return (
                          <tr key={sub.id} className="hover:bg-muted/20">
                            <td className="p-3">
                              {new Date(sub.submitted_at).toLocaleDateString()}
                            </td>
                            <td className="p-3 font-mono font-bold text-foreground">
                              MVR {Number(sub.submitted_amount).toFixed(2)}
                            </td>
                            <td className="p-3 capitalize">
                              {sub.payment_method.replace("_", " ")}
                            </td>
                            <td className="p-3 font-mono text-muted-foreground">
                              {sub.transfer_reference || "—"}
                            </td>
                            <td className="p-3">
                              {sub.slip_path ? (
                                <button
                                  type="button"
                                  onClick={() => handlePreviewSlip(sub.slip_path!)}
                                  className="text-primary hover:underline flex items-center gap-1 font-medium"
                                >
                                  <FileText className="h-3.5 w-3.5" />
                                  View Slip
                                </button>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="p-3">{getSubmissionStatusBadge(sub.status)}</td>
                            <td className="p-3 text-muted-foreground">
                              {sub.status === "rejected" ? (
                                <span className="text-rose-600 font-medium">
                                  Reason: {sub.rejection_reason}
                                </span>
                              ) : sub.status === "approved" ? (
                                <span className="text-emerald-700">
                                  Approved{" "}
                                  {sub.reviewed_at
                                    ? new Date(sub.reviewed_at).toLocaleDateString()
                                    : ""}
                                </span>
                              ) : (
                                <span>Waiting for review</span>
                              )}
                            </td>
                            <td className="p-3 text-right">
                              {sub.status === "rejected" && bill && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleOpenPay(bill)}
                                  className="h-7 text-xs text-rose-600 border-rose-200"
                                >
                                  Submit New Payment
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Bill Details Modal */}
        {detailBill && (
          <Dialog open={Boolean(detailBill)} onOpenChange={(open) => !open && setDetailBill(null)}>
            <DialogContent className="max-w-lg p-6 space-y-4">
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <DialogTitle className="font-display text-lg font-bold">
                    Fee Bill Details
                  </DialogTitle>
                  {getStatusBadge(detailBill.status)}
                </div>
                <DialogDescription className="text-xs">
                  Bill #{detailBill.bill_number} · {detailBill.fee_month}
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-2 gap-3 text-xs bg-muted/40 p-3.5 rounded-xl border">
                <div>
                  <span className="text-muted-foreground">Total Fee:</span>
                  <div className="font-bold text-sm">
                    MVR {Number(detailBill.amount).toFixed(2)}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Approved Paid:</span>
                  <div className="font-bold text-sm text-emerald-600">
                    MVR {Number(detailBill.approved_paid_amount || 0).toFixed(2)}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Due Date:</span>
                  <div className="font-medium">{detailBill.due_date}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Outstanding Balance:</span>
                  <div className="font-bold text-sm text-rose-600">
                    MVR {Number(detailBill.outstanding_amount).toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Associated Chronological Submissions/Payments */}
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Activity Timeline
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {/* Find payments for this bill */}
                  {payments
                    .filter((p) => p.fee_bill_id === detailBill.id)
                    .map((p) => (
                      <div
                        key={p.id}
                        className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-3 text-xs flex items-center justify-between"
                      >
                        <div>
                          <div className="font-semibold text-emerald-900 flex items-center gap-1.5">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                            Official Payment: MVR {Number(p.amount).toFixed(2)}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            Receipt: <span className="font-mono">{p.receipt_number}</span> ·
                            Approved: {new Date(p.approved_at).toLocaleDateString()}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenReceipt(p, detailBill)}
                          className="h-7 text-xs text-emerald-700"
                        >
                          Receipt
                        </Button>
                      </div>
                    ))}

                  {/* Find submissions for this bill */}
                  {submissions
                    .filter((s) => s.fee_bill_id === detailBill.id)
                    .map((s) => (
                      <div
                        key={s.id}
                        className="rounded-lg border p-3 text-xs flex items-center justify-between bg-background"
                      >
                        <div>
                          <div className="font-semibold flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                            Submission: MVR {Number(s.submitted_amount).toFixed(2)} (
                            {s.payment_method.replace("_", " ")})
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            Submitted: {new Date(s.submitted_at).toLocaleDateString()}
                            {s.status === "rejected" && (
                              <span className="text-rose-600 ml-2">
                                Rejected: {s.rejection_reason}
                              </span>
                            )}
                          </div>
                        </div>
                        {getSubmissionStatusBadge(s.status)}
                      </div>
                    ))}
                </div>
              </div>

              {Number(detailBill.outstanding_amount) > 0 &&
                detailBill.status !== "pending_approval" &&
                !detailBill.active_submission && (
                  <div className="pt-2 flex justify-end">
                    <Button
                      size="sm"
                      onClick={() => {
                        setDetailBill(null);
                        handleOpenPay(detailBill);
                      }}
                      className="bg-rose-600 hover:bg-rose-700 text-white gap-1.5 text-xs"
                    >
                      <CreditCard className="h-3.5 w-3.5" />
                      Pay This Fee
                    </Button>
                  </div>
                )}
            </DialogContent>
          </Dialog>
        )}

        {/* Pay Modal */}
        {selectedBillForPay && (
          <StudentPayFeeModal
            open={payModalOpen}
            onOpenChange={setPayModalOpen}
            bill={selectedBillForPay}
            studentName={student?.full_name || ""}
            studentNumber={student?.student_number || ""}
            settings={settings}
            onSuccess={loadData}
          />
        )}

        {/* Receipt Modal */}
        {selectedPaymentForReceipt && (
          <FeeReceiptModal
            open={receiptModalOpen}
            onOpenChange={setReceiptModalOpen}
            payment={selectedPaymentForReceipt.payment}
            bill={selectedPaymentForReceipt.bill}
            studentName={student?.full_name}
            studentNumber={student?.student_number}
            classNameStr={student?.classes?.class_name}
          />
        )}
      </div>
    </RoleShell>
  );
}
