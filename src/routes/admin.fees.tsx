import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { RoleShell } from "@/components/role-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Building2,
  DollarSign,
  FileText,
  Eye,
  RefreshCw,
  PlusCircle,
  Search,
  Receipt,
  Settings,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import {
  getAdminPaymentApprovalsQueue,
  approvePaymentSubmission,
  rejectPaymentSubmission,
  updateFeeSettings,
  generateMonthlyFeeBills,
  getPaymentSlipSignedUrl,
} from "@/lib/fees.functions";
import type { FeePaymentSubmission, FeeSettings, FinancialAccount } from "@/types/fees";

export const Route = createFileRoute("/admin/fees")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Fee Management & Approvals — Admin" }],
  }),
  component: AdminFeesPage,
});

function AdminFeesPage() {
  const [loading, setLoading] = useState(true);
  const [submissions, setSubmissions] = useState<FeePaymentSubmission[]>([]);
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [settings, setSettings] = useState<FeeSettings | null>(null);
  const [stats, setStats] = useState({
    pendingCount: 0,
    approvedToday: 0,
    rejectedToday: 0,
    totalPendingAmount: 0,
  });

  // Approval Modal
  const [selectedSubForApprove, setSelectedSubForApprove] = useState<FeePaymentSubmission | null>(
    null,
  );
  const [receivingAccountId, setReceivingAccountId] = useState<string>("");
  const [approvedAmount, setApprovedAmount] = useState<string>("");
  const [adminComment, setAdminComment] = useState<string>("");
  const [differenceReason, setDifferenceReason] = useState<string>("");
  const [approving, setApproving] = useState(false);

  // Rejection Modal
  const [selectedSubForReject, setSelectedSubForReject] = useState<FeePaymentSubmission | null>(
    null,
  );
  const [rejectionReason, setRejectionReason] = useState<string>("");
  const [rejectComment, setRejectComment] = useState<string>("");
  const [rejecting, setRejecting] = useState(false);

  // Slip Preview Modal
  const [previewSlipUrl, setPreviewSlipUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Bill Generation State
  const [genMonth, setGenMonth] = useState<string>("October 2026");
  const [genDueDate, setGenDueDate] = useState<string>("2026-10-10");
  const [genAmount, setGenAmount] = useState<string>("500");
  const [generating, setGenerating] = useState(false);

  // Settings form
  const [settingsForm, setSettingsForm] = useState<Partial<FeeSettings>>({});
  const [savingSettings, setSavingSettings] = useState(false);

  // Search filter
  const [searchTerm, setSearchTerm] = useState("");
  const [historyFilter, setHistoryFilter] = useState("all");

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getAdminPaymentApprovalsQueue();
      setSubmissions((res.submissions as unknown as FeePaymentSubmission[]) || []);
      setAccounts(res.accounts || []);
      setSettings(res.settings);
      setStats(res.stats);
      if (res.settings) {
        setSettingsForm(res.settings);
      }
      if (res.accounts && res.accounts.length > 0) {
        setReceivingAccountId(res.accounts[0].id);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to load approvals queue";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenApprove = (sub: FeePaymentSubmission) => {
    setSelectedSubForApprove(sub);
    setApprovedAmount(Number(sub.submitted_amount).toString());
    setAdminComment("");
    setDifferenceReason("");
    if (accounts.length > 0 && !receivingAccountId) {
      setReceivingAccountId(accounts[0].id);
    }
  };

  const handleConfirmApprove = async () => {
    if (!selectedSubForApprove) return;
    if (!receivingAccountId) {
      toast.error("Please select a receiving financial account.");
      return;
    }

    const appAmount = Number(approvedAmount);
    if (!appAmount || appAmount <= 0) {
      toast.error("Please enter a valid approved amount.");
      return;
    }

    if (appAmount !== Number(selectedSubForApprove.submitted_amount) && !differenceReason) {
      toast.error("Please enter a reason for the amount difference.");
      return;
    }

    setApproving(true);
    try {
      const res = await approvePaymentSubmission({
        data: {
          submission_id: selectedSubForApprove.id,
          receiving_account_id: receivingAccountId,
          approved_amount: appAmount,
          admin_comment: adminComment || undefined,
          difference_reason: differenceReason || undefined,
        },
      });

      toast.success(res.message);
      setSelectedSubForApprove(null);
      loadData();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to approve payment";
      toast.error(msg);
    } finally {
      setApproving(false);
    }
  };

  const handleOpenReject = (sub: FeePaymentSubmission) => {
    setSelectedSubForReject(sub);
    setRejectionReason("");
    setRejectComment("");
  };

  const handleConfirmReject = async () => {
    if (!selectedSubForReject) return;
    if (!rejectionReason.trim()) {
      toast.error("Please provide a rejection reason for the student.");
      return;
    }

    setRejecting(true);
    try {
      const res = await rejectPaymentSubmission({
        data: {
          submission_id: selectedSubForReject.id,
          rejection_reason: rejectionReason,
          admin_comment: rejectComment || undefined,
        },
      });

      toast.success(res.message);
      setSelectedSubForReject(null);
      loadData();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to reject submission";
      toast.error(msg);
    } finally {
      setRejecting(false);
    }
  };

  const handlePreviewSlip = async (slipPath: string) => {
    setPreviewLoading(true);
    try {
      const res = await getPaymentSlipSignedUrl({ data: { slipPath } });
      if (res.signedUrl) {
        setPreviewSlipUrl(res.signedUrl);
      } else {
        toast.error("Could not generate signed URL for slip");
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to load slip";
      toast.error(msg);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await updateFeeSettings({ data: settingsForm });
      toast.success("Fee settings and bank instructions updated successfully!");
      loadData();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to update settings";
      toast.error(msg);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleGenerateBills = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(genAmount);
    if (!amount || amount <= 0) {
      toast.error("Please enter a valid fee amount.");
      return;
    }

    setGenerating(true);
    try {
      const res = await generateMonthlyFeeBills({
        data: {
          fee_month: genMonth,
          due_date: genDueDate,
          amount,
        },
      });

      toast.success(res.message);
      loadData();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to generate fee bills";
      toast.error(msg);
    } finally {
      setGenerating(false);
    }
  };

  const pendingQueue = submissions.filter(
    (s) => s.status === "pending" || s.status === "under_review",
  );

  const filteredHistory = submissions.filter((s) => {
    if (historyFilter !== "all" && s.status !== historyFilter) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const studentName = s.students?.full_name?.toLowerCase() || "";
      const studentNum = s.students?.student_number?.toLowerCase() || "";
      const billNum = s.fee_bills?.bill_number?.toLowerCase() || "";
      const month = s.fee_bills?.fee_month?.toLowerCase() || "";
      return (
        studentName.includes(term) ||
        studentNum.includes(term) ||
        billNum.includes(term) ||
        month.includes(term)
      );
    }
    return true;
  });

  return (
    <RoleShell role="admin" title="Fee Approvals & Management">
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold font-display tracking-tight">
              Fee Management & Approvals
            </h2>
            <p className="text-sm text-muted-foreground">
              Review student transfer receipts, post financial entries, configure bank details, and
              issue fee bills.
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
            Refresh Queue
          </Button>
        </div>

        {/* 4 Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-amber-200 bg-amber-50/40 dark:bg-amber-950/10">
            <CardContent className="p-4 space-y-1">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-400 flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                Pending Review
              </div>
              <div className="text-2xl font-bold font-display text-amber-800 dark:text-amber-400">
                {stats.pendingCount}
              </div>
              <div className="text-xs text-muted-foreground">Waiting for approval</div>
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardContent className="p-4 space-y-1">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <DollarSign className="h-4 w-4 text-primary" />
                Pending Amount
              </div>
              <div className="text-2xl font-bold font-display">
                MVR {stats.totalPendingAmount.toFixed(2)}
              </div>
              <div className="text-xs text-muted-foreground">In submission queue</div>
            </CardContent>
          </Card>

          <Card className="border-emerald-200 bg-emerald-50/40 dark:bg-emerald-950/10">
            <CardContent className="p-4 space-y-1">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4" />
                Approved Today
              </div>
              <div className="text-2xl font-bold font-display text-emerald-800 dark:text-emerald-400">
                {stats.approvedToday}
              </div>
              <div className="text-xs text-muted-foreground">Officially posted</div>
            </CardContent>
          </Card>

          <Card className="border-rose-200 bg-rose-50/40 dark:bg-rose-950/10">
            <CardContent className="p-4 space-y-1">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-rose-800 dark:text-rose-400 flex items-center gap-1.5">
                <XCircle className="h-4 w-4" />
                Rejected Today
              </div>
              <div className="text-2xl font-bold font-display text-rose-800 dark:text-rose-400">
                {stats.rejectedToday}
              </div>
              <div className="text-xs text-muted-foreground">Returned with feedback</div>
            </CardContent>
          </Card>
        </div>

        {/* Main Tabs */}
        <Tabs defaultValue="approvals" className="space-y-4">
          <TabsList className="bg-muted/60 p-1 flex flex-wrap w-full sm:w-auto">
            <TabsTrigger value="approvals" className="gap-1.5 text-xs sm:text-sm">
              <Clock className="h-3.5 w-3.5" />
              Approvals Queue
              {stats.pendingCount > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-1 px-1.5 py-0 text-[10px] bg-amber-200 text-amber-900 font-bold"
                >
                  {stats.pendingCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-1.5 text-xs sm:text-sm">
              <Settings className="h-3.5 w-3.5" />
              Fee & Bank Settings
            </TabsTrigger>
            <TabsTrigger value="generate" className="gap-1.5 text-xs sm:text-sm">
              <PlusCircle className="h-3.5 w-3.5" />
              Issue Monthly Bills
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-1.5 text-xs sm:text-sm">
              <FileText className="h-3.5 w-3.5" />
              All Submissions Log
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: APPROVALS QUEUE */}
          <TabsContent value="approvals" className="space-y-4">
            {pendingQueue.length === 0 ? (
              <Card className="border-border/60">
                <CardContent className="p-10 text-center space-y-2">
                  <CheckCircle2 className="h-10 w-10 text-emerald-600 mx-auto" />
                  <div className="font-display font-semibold text-lg">
                    Approvals Queue is Clear!
                  </div>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    All student fee payment submissions have been reviewed and verified.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {pendingQueue.map((sub) => {
                  const bill = sub.fee_bills;
                  const student = sub.students;
                  return (
                    <Card
                      key={sub.id}
                      className="border-border/60 hover:border-border transition-colors"
                    >
                      <CardContent className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="space-y-2">
                          {/* Student & Bill Header */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-display font-bold text-base text-foreground">
                              {student?.full_name}
                            </span>
                            <Badge variant="outline" className="font-mono text-[11px]">
                              {student?.student_number}
                            </Badge>
                            {student?.classes?.class_name && (
                              <Badge variant="secondary" className="text-[11px]">
                                {student.classes.class_name}
                              </Badge>
                            )}
                            <Badge className="bg-amber-500 text-white text-[11px]">
                              Pending Review
                            </Badge>
                          </div>

                          {/* Details Row */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-muted/30 p-2.5 rounded-lg border">
                            <div>
                              <span className="text-muted-foreground">Fee Month:</span>
                              <div className="font-semibold text-foreground">{bill?.fee_month}</div>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Bill / Outstanding:</span>
                              <div className="font-mono">
                                MVR {Number(bill?.outstanding_amount || 0).toFixed(2)}
                              </div>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Submitted Amount:</span>
                              <div className="font-bold font-mono text-emerald-700 dark:text-emerald-400 text-sm">
                                MVR {Number(sub.submitted_amount).toFixed(2)}
                              </div>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Method / Date:</span>
                              <div className="capitalize">
                                {sub.payment_method.replace("_", " ")} ({sub.payment_date})
                              </div>
                            </div>
                          </div>

                          {/* Reference / Note / Slip */}
                          <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                            {sub.transfer_reference && (
                              <span>
                                Reference:{" "}
                                <strong className="font-mono text-foreground">
                                  {sub.transfer_reference}
                                </strong>
                              </span>
                            )}
                            {sub.payment_account_text && (
                              <span>
                                Sent From: <strong>{sub.payment_account_text}</strong>
                              </span>
                            )}
                            {sub.student_note && (
                              <span className="italic">Note: "{sub.student_note}"</span>
                            )}
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2.5 shrink-0 self-end lg:self-center">
                          {sub.slip_path ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handlePreviewSlip(sub.slip_path!)}
                              className="text-xs gap-1.5"
                            >
                              <Eye className="h-3.5 w-3.5 text-primary" />
                              View Slip
                            </Button>
                          ) : (
                            <Badge variant="secondary" className="text-xs">
                              No Slip Attached
                            </Badge>
                          )}

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenReject(sub)}
                            className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200 gap-1"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            Reject
                          </Button>

                          <Button
                            size="sm"
                            onClick={() => handleOpenApprove(sub)}
                            className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Approve Payment
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* TAB 2: FEE & BANK SETTINGS */}
          <TabsContent value="settings" className="space-y-4">
            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="text-lg font-display flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  Bank Account & Payment Configuration
                </CardTitle>
                <CardDescription className="text-xs">
                  These details and instructions are shown to students in the Fee Due popup and
                  Payment modal.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSaveSettings} className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="bank_name">Bank Name</Label>
                      <Input
                        id="bank_name"
                        value={settingsForm.bank_name || ""}
                        onChange={(e) =>
                          setSettingsForm({ ...settingsForm, bank_name: e.target.value })
                        }
                        placeholder="Bank of Maldives (BML)"
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="account_name">Account Name</Label>
                      <Input
                        id="account_name"
                        value={settingsForm.account_name || ""}
                        onChange={(e) =>
                          setSettingsForm({ ...settingsForm, account_name: e.target.value })
                        }
                        placeholder="Ababeel Quran Class"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="account_number">
                        Primary Account Number <span className="text-rose-500">*</span>
                      </Label>
                      <Input
                        id="account_number"
                        className="font-mono text-base font-semibold"
                        value={settingsForm.account_number || ""}
                        onChange={(e) =>
                          setSettingsForm({ ...settingsForm, account_number: e.target.value })
                        }
                        placeholder="7701123456789"
                        required
                      />
                      <span className="text-[11px] text-muted-foreground">
                        This is the number copied by the student with 1 click.
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="secondary_account">
                        Secondary / Alternative Account (optional)
                      </Label>
                      <Input
                        id="secondary_account"
                        value={settingsForm.secondary_account || ""}
                        onChange={(e) =>
                          setSettingsForm({ ...settingsForm, secondary_account: e.target.value })
                        }
                        placeholder="e.g. 7701987654321 (MVR Savings)"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="payment_instructions">Payment Instructions for Students</Label>
                    <Textarea
                      id="payment_instructions"
                      rows={3}
                      value={settingsForm.payment_instructions || ""}
                      onChange={(e) =>
                        setSettingsForm({ ...settingsForm, payment_instructions: e.target.value })
                      }
                      placeholder="Please include Student ID and Fee Month in transfer remarks. Submit slip after transfer."
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="viber_contact">Viber / Support Contact</Label>
                      <Input
                        id="viber_contact"
                        value={settingsForm.viber_contact || ""}
                        onChange={(e) =>
                          setSettingsForm({ ...settingsForm, viber_contact: e.target.value })
                        }
                        placeholder="+960 7771234"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="default_fee_due_day">Default Due Day of Month</Label>
                      <Input
                        id="default_fee_due_day"
                        type="number"
                        min="1"
                        max="31"
                        value={settingsForm.default_fee_due_day ?? 10}
                        onChange={(e) =>
                          setSettingsForm({
                            ...settingsForm,
                            default_fee_due_day: parseInt(e.target.value, 10) || 10,
                          })
                        }
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="reminder_days">Reminder Days Before Due</Label>
                      <Input
                        id="reminder_days"
                        type="number"
                        min="1"
                        max="30"
                        value={settingsForm.reminder_days_before_due ?? 5}
                        onChange={(e) =>
                          setSettingsForm({
                            ...settingsForm,
                            reminder_days_before_due: parseInt(e.target.value, 10) || 5,
                          })
                        }
                      />
                    </div>
                  </div>

                  {/* Toggles */}
                  <div className="border rounded-xl p-4 divide-y space-y-3 bg-muted/10">
                    <div className="flex items-center justify-between pt-1">
                      <div>
                        <div className="font-semibold text-sm">
                          Fee Reminder Popup on Student Login
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Automatically prompts students if they have outstanding bills upon login.
                        </div>
                      </div>
                      <Switch
                        checked={settingsForm.fee_reminder_popup ?? true}
                        onCheckedChange={(c) =>
                          setSettingsForm({ ...settingsForm, fee_reminder_popup: c })
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between pt-3">
                      <div>
                        <div className="font-semibold text-sm">Require Payment Slip Upload</div>
                        <div className="text-xs text-muted-foreground">
                          Mandates transfer receipt file attachment for Bank & Online transfers.
                        </div>
                      </div>
                      <Switch
                        checked={settingsForm.require_payment_slip ?? true}
                        onCheckedChange={(c) =>
                          setSettingsForm({ ...settingsForm, require_payment_slip: c })
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between pt-3">
                      <div>
                        <div className="font-semibold text-sm">Allow Partial Payments</div>
                        <div className="text-xs text-muted-foreground">
                          Permits students to submit amounts less than the total outstanding bill.
                        </div>
                      </div>
                      <Switch
                        checked={settingsForm.allow_partial_payment ?? true}
                        onCheckedChange={(c) =>
                          setSettingsForm({ ...settingsForm, allow_partial_payment: c })
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between pt-3">
                      <div>
                        <div className="font-semibold text-sm">Allow Cash Submission in Portal</div>
                        <div className="text-xs text-muted-foreground">
                          Allows students to log an in-person cash payment notice.
                        </div>
                      </div>
                      <Switch
                        checked={settingsForm.allow_cash_submission ?? true}
                        onCheckedChange={(c) =>
                          setSettingsForm({ ...settingsForm, allow_cash_submission: c })
                        }
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button type="submit" disabled={savingSettings} className="min-w-[150px]">
                      {savingSettings ? "Saving Settings..." : "Save Settings"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 3: GENERATE MONTHLY BILLS */}
          <TabsContent value="generate" className="space-y-4">
            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="text-lg font-display flex items-center gap-2">
                  <PlusCircle className="h-5 w-5 text-primary" />
                  Issue Monthly Fee Bills
                </CardTitle>
                <CardDescription className="text-xs">
                  Generate official tuition fee invoices for active students. Existing bills for the
                  same month are automatically skipped to prevent duplicates.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleGenerateBills} className="space-y-4 max-w-xl">
                  <div className="space-y-1.5">
                    <Label htmlFor="gen-month">Fee Month</Label>
                    <Input
                      id="gen-month"
                      value={genMonth}
                      onChange={(e) => setGenMonth(e.target.value)}
                      placeholder="e.g. October 2026"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="gen-due">Due Date</Label>
                      <Input
                        id="gen-due"
                        type="date"
                        value={genDueDate}
                        onChange={(e) => setGenDueDate(e.target.value)}
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="gen-amount">Fee Amount (MVR)</Label>
                      <Input
                        id="gen-amount"
                        type="number"
                        step="0.01"
                        min="1"
                        value={genAmount}
                        onChange={(e) => setGenAmount(e.target.value)}
                        placeholder="500"
                        required
                      />
                    </div>
                  </div>

                  <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground border">
                    Bills will be issued for all active enrolled students. Students will receive an
                    in-app fee notification and reminder upon login.
                  </div>

                  <Button type="submit" disabled={generating} className="gap-2">
                    <PlusCircle className="h-4 w-4" />
                    {generating ? "Generating Bills..." : "Generate Fee Bills"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 4: ALL SUBMISSIONS LOG */}
          <TabsContent value="history" className="space-y-4">
            <Card className="border-border/60">
              <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base font-display">
                    Payment Submissions History
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Audit log of all student payment claims, review actions, and financial
                    transactions.
                  </CardDescription>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                    <Input
                      placeholder="Search student or bill..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8 h-8 text-xs w-48"
                    />
                  </div>

                  <Select value={historyFilter} onValueChange={setHistoryFilter}>
                    <SelectTrigger className="h-8 text-xs w-32">
                      <SelectValue placeholder="Filter Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-muted/40 border-y text-muted-foreground uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="p-3">Date</th>
                        <th className="p-3">Student</th>
                        <th className="p-3">Fee Month</th>
                        <th className="p-3">Submitted</th>
                        <th className="p-3">Approved</th>
                        <th className="p-3">Method</th>
                        <th className="p-3">Slip</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Review Notes</th>
                        <th className="p-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filteredHistory.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="p-6 text-center text-muted-foreground">
                            No submissions match the filter criteria.
                          </td>
                        </tr>
                      ) : (
                        filteredHistory.map((sub) => (
                          <tr key={sub.id} className="hover:bg-muted/20">
                            <td className="p-3">
                              {new Date(sub.submitted_at).toLocaleDateString()}
                            </td>
                            <td className="p-3">
                              <div className="font-semibold text-foreground">
                                {sub.students?.full_name}
                              </div>
                              <div className="text-[10px] text-muted-foreground font-mono">
                                {sub.students?.student_number}
                              </div>
                            </td>
                            <td className="p-3 font-medium">{sub.fee_bills?.fee_month}</td>
                            <td className="p-3 font-mono">
                              MVR {Number(sub.submitted_amount).toFixed(2)}
                            </td>
                            <td className="p-3 font-mono text-emerald-600 font-semibold">
                              {sub.approved_amount
                                ? `MVR ${Number(sub.approved_amount).toFixed(2)}`
                                : "—"}
                            </td>
                            <td className="p-3 capitalize">
                              {sub.payment_method.replace("_", " ")}
                            </td>
                            <td className="p-3">
                              {sub.slip_path ? (
                                <button
                                  type="button"
                                  onClick={() => handlePreviewSlip(sub.slip_path!)}
                                  className="text-primary hover:underline flex items-center gap-1 font-medium"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                  Slip
                                </button>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="p-3">
                              <Badge
                                variant={
                                  sub.status === "approved"
                                    ? "default"
                                    : sub.status === "rejected"
                                      ? "destructive"
                                      : "outline"
                                }
                                className={
                                  sub.status === "approved"
                                    ? "bg-emerald-600 text-white"
                                    : sub.status === "pending"
                                      ? "bg-amber-500 text-white"
                                      : ""
                                }
                              >
                                {sub.status}
                              </Badge>
                            </td>
                            <td className="p-3 text-muted-foreground max-w-xs truncate">
                              {sub.rejection_reason ? (
                                <span className="text-rose-600">
                                  Rejection: {sub.rejection_reason}
                                </span>
                              ) : (
                                sub.admin_comment || "—"
                              )}
                            </td>
                            <td className="p-3 text-right">
                              {sub.status === "pending" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleOpenApprove(sub)}
                                  className="h-7 text-xs text-emerald-700"
                                >
                                  Review
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* APPROVAL DIALOG */}
        {selectedSubForApprove && (
          <Dialog
            open={Boolean(selectedSubForApprove)}
            onOpenChange={(open) => !open && setSelectedSubForApprove(null)}
          >
            <DialogContent className="max-w-lg p-6 space-y-4">
              <DialogHeader>
                <DialogTitle className="font-display text-lg font-bold flex items-center gap-2 text-emerald-700">
                  <CheckCircle2 className="h-5 w-5" />
                  Approve Fee Payment
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Posting this approval will atomically credit the financial account, create an
                  official receipt, and update the student's fee balance.
                </DialogDescription>
              </DialogHeader>

              {/* Sub snapshot */}
              <div className="grid grid-cols-2 gap-2.5 text-xs bg-muted/40 p-3.5 rounded-xl border">
                <div>
                  <span className="text-muted-foreground">Student:</span>
                  <div className="font-bold">{selectedSubForApprove.students?.full_name}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Fee Month:</span>
                  <div className="font-semibold">{selectedSubForApprove.fee_bills?.fee_month}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Submitted Amount:</span>
                  <div className="font-bold text-sm text-foreground">
                    MVR {Number(selectedSubForApprove.submitted_amount).toFixed(2)}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Method:</span>
                  <div className="capitalize">
                    {selectedSubForApprove.payment_method.replace("_", " ")}
                  </div>
                </div>
              </div>

              {/* Approval Form */}
              <div className="space-y-3.5">
                <div className="space-y-1.5">
                  <Label htmlFor="receiving-account">
                    Receiving Financial Account <span className="text-rose-500">*</span>
                  </Label>
                  <Select value={receivingAccountId} onValueChange={setReceivingAccountId}>
                    <SelectTrigger id="receiving-account">
                      <SelectValue placeholder="Select Account" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((acc) => (
                        <SelectItem key={acc.id} value={acc.id}>
                          {acc.account_name} ({acc.account_type}) — Balance: MVR{" "}
                          {Number(acc.current_balance).toFixed(2)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="approved-amount">
                    Approved Amount (MVR) <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    id="approved-amount"
                    type="number"
                    step="0.01"
                    min="1"
                    value={approvedAmount}
                    onChange={(e) => setApprovedAmount(e.target.value)}
                    required
                  />
                </div>

                {Number(approvedAmount) !== Number(selectedSubForApprove.submitted_amount) && (
                  <div className="space-y-1.5">
                    <Label htmlFor="difference-reason" className="text-amber-700">
                      Amount Difference Justification <span className="text-rose-500">*</span>
                    </Label>
                    <Input
                      id="difference-reason"
                      placeholder="e.g. Bank charge deducted / Partial bank receipt verified"
                      value={differenceReason}
                      onChange={(e) => setDifferenceReason(e.target.value)}
                      required
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="admin-comment">Internal Note / Receipt Remarks (optional)</Label>
                  <Textarea
                    id="admin-comment"
                    rows={2}
                    placeholder="Verified on bank statement..."
                    value={adminComment}
                    onChange={(e) => setAdminComment(e.target.value)}
                  />
                </div>
              </div>

              <DialogFooter className="pt-2">
                <Button variant="outline" onClick={() => setSelectedSubForApprove(null)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirmApprove}
                  disabled={approving}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {approving ? "Posting..." : "Confirm & Post Payment"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* REJECTION DIALOG */}
        {selectedSubForReject && (
          <Dialog
            open={Boolean(selectedSubForReject)}
            onOpenChange={(open) => !open && setSelectedSubForReject(null)}
          >
            <DialogContent className="max-w-md p-6 space-y-4">
              <DialogHeader>
                <DialogTitle className="font-display text-lg font-bold flex items-center gap-2 text-rose-600">
                  <XCircle className="h-5 w-5" />
                  Reject Payment Submission
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Please provide a clear reason so the student understands what to correct and can
                  resubmit their payment.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="quick-reason">Quick Reasons</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      "Transfer slip is blurry or unreadable",
                      "Amount does not match bank transfer",
                      "Payment not found on bank statement",
                      "Duplicate slip submitted",
                      "Incorrect account credited",
                    ].map((reason) => (
                      <Button
                        key={reason}
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="text-[11px] h-7 px-2"
                        onClick={() => setRejectionReason(reason)}
                      >
                        {reason}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="rejection-reason">
                    Rejection Reason <span className="text-rose-500">*</span>
                  </Label>
                  <Textarea
                    id="rejection-reason"
                    rows={3}
                    placeholder="Enter the reason why this payment cannot be approved..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    required
                  />
                </div>
              </div>

              <DialogFooter className="pt-2">
                <Button variant="outline" onClick={() => setSelectedSubForReject(null)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirmReject}
                  disabled={rejecting}
                  className="bg-rose-600 hover:bg-rose-700 text-white"
                >
                  {rejecting ? "Rejecting..." : "Confirm Rejection"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* SLIP PREVIEW MODAL */}
        {previewSlipUrl && (
          <Dialog
            open={Boolean(previewSlipUrl)}
            onOpenChange={(open) => !open && setPreviewSlipUrl(null)}
          >
            <DialogContent className="max-w-2xl p-4 space-y-3">
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <DialogTitle className="font-display text-base font-bold flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    Payment Slip Proof
                  </DialogTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs gap-1"
                    onClick={() => window.open(previewSlipUrl, "_blank")}
                  >
                    Open in New Tab
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </DialogHeader>

              <div className="rounded-xl border bg-black/5 overflow-hidden flex items-center justify-center min-h-[300px] max-h-[70vh]">
                {previewSlipUrl.includes(".pdf") ? (
                  <iframe
                    src={previewSlipUrl}
                    className="w-full h-[60vh] border-0"
                    title="Payment Slip PDF"
                  />
                ) : (
                  <img
                    src={previewSlipUrl}
                    alt="Payment Slip Proof"
                    className="max-h-[65vh] object-contain rounded-lg"
                    referrerPolicy="no-referrer"
                  />
                )}
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </RoleShell>
  );
}
