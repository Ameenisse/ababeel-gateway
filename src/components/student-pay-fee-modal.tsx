import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Copy,
  Check,
  UploadCloud,
  FileText,
  AlertCircle,
  Building2,
  Phone,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { submitStudentPayment } from "@/lib/fees.functions";
import type { FeeBill, FeeSettings } from "@/types/fees";

interface StudentPayFeeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bill: FeeBill | null;
  studentName: string;
  studentNumber: string;
  settings: FeeSettings | null;
  onSuccess: () => void;
}

export function StudentPayFeeModal({
  open,
  onOpenChange,
  bill,
  studentName,
  studentNumber,
  settings,
  onSuccess,
}: StudentPayFeeModalProps) {
  const [copiedAccount, setCopiedAccount] = useState(false);
  const [copiedDetails, setCopiedDetails] = useState(false);
  const [amount, setAmount] = useState<string>("");
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState<"bank_transfer" | "online_transfer" | "cash">(
    "bank_transfer",
  );
  const [bankAccountUsed, setBankAccountUsed] = useState<string>("");
  const [transferRef, setTransferRef] = useState<string>("");
  const [studentNote, setStudentNote] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Sync default amount whenever modal opens with a bill
  const outstanding = bill ? Number(bill.outstanding_amount) : 0;
  const isPendingApproval = bill?.status === "pending_approval" || Boolean(bill?.active_submission);

  const bankName = settings?.bank_name || "Bank of Maldives (BML)";
  const accountName = settings?.account_name || "Ababeel Quran Class";
  const accountNumber = settings?.account_number || "7701123456789";

  const handleCopyAccount = async () => {
    try {
      await navigator.clipboard.writeText(accountNumber);
      setCopiedAccount(true);
      toast.success("Account number copied");
      setTimeout(() => setCopiedAccount(false), 2500);
    } catch {
      toast.error("Could not copy account number");
    }
  };

  const handleCopyDetails = async () => {
    if (!bill) return;
    const text = `Bank: ${bankName}\nAccount Name: ${accountName}\nAccount Number: ${accountNumber}\nFee Bill: ${bill.bill_number}\nStudent: ${studentName} (${studentNumber})\nAmount: MVR ${amount || outstanding}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedDetails(true);
      toast.success("Payment details copied to clipboard");
      setTimeout(() => setCopiedDetails(false), 2500);
    } catch {
      toast.error("Could not copy details");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      const validTypes = ["image/jpeg", "image/jpg", "image/png", "application/pdf"];
      if (!validTypes.includes(selected.type)) {
        toast.error("Only JPG, PNG, and PDF files are allowed.");
        return;
      }
      if (selected.size > 10 * 1024 * 1024) {
        toast.error("File size must be under 10MB.");
        return;
      }
      setFile(selected);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bill) return;

    if (isPendingApproval) {
      toast.error("A payment submission for this fee is already waiting for approval.");
      return;
    }

    const payAmount = Number(amount || outstanding);
    if (!payAmount || payAmount <= 0) {
      toast.error("Please enter a valid payment amount.");
      return;
    }

    if (payAmount > outstanding && !settings?.allow_partial_payment) {
      toast.error(`Payment cannot exceed outstanding balance of MVR ${outstanding.toFixed(2)}.`);
      return;
    }

    const requiresSlip =
      (paymentMethod === "bank_transfer" || paymentMethod === "online_transfer") &&
      settings?.require_payment_slip !== false;

    if (requiresSlip && !file) {
      toast.error("Payment slip upload is required for Bank and Online transfers.");
      return;
    }

    setSubmitting(true);
    let slipPath: string | undefined = undefined;

    try {
      // 1. Upload file if present
      if (file) {
        setUploading(true);
        const fileExt = file.name.split(".").pop();
        const safeName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${fileExt}`;
        const filePath = `${bill.student_id}/${bill.id}/${safeName}`;

        const { error: uploadErr } = await supabase.storage
          .from("fee-payment-slips")
          .upload(filePath, file, { upsert: true });

        if (uploadErr) {
          throw new Error(`Failed to upload slip: ${uploadErr.message}`);
        }
        slipPath = filePath;
        setUploading(false);
      }

      // 2. Submit payment record
      const res = await submitStudentPayment({
        data: {
          fee_bill_id: bill.id,
          submitted_amount: payAmount,
          payment_date: paymentDate,
          payment_method: paymentMethod,
          payment_account_text: bankAccountUsed || undefined,
          transfer_reference: transferRef || undefined,
          slip_path: slipPath,
          student_note: studentNote || undefined,
        },
      });

      toast.success(res.message);
      onSuccess();
      onOpenChange(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to submit payment";
      toast.error(msg);
    } finally {
      setUploading(false);
      setSubmitting(false);
    }
  };

  if (!bill) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-6">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl font-bold font-display">Pay Fee Bill</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Review payment instructions and submit your transfer receipt.
              </DialogDescription>
            </div>
            <Badge variant="outline" className="text-xs px-2.5 py-1">
              {bill.fee_month}
            </Badge>
          </div>
        </DialogHeader>

        {isPendingApproval && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3.5 text-amber-900 text-sm flex items-start gap-3">
            <Clock className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold">Payment submitted — waiting for Admin approval</div>
              <div className="text-xs text-amber-800 mt-0.5">
                You already have an active payment submission for this fee bill. Another submission
                cannot be made until Admin reviews it.
              </div>
            </div>
          </div>
        )}

        {/* Bill Summary Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-muted/40 rounded-xl p-3.5 border text-sm">
          <div>
            <div className="text-xs text-muted-foreground">Fee Bill</div>
            <div className="font-semibold text-foreground">{bill.bill_number}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Total Fee</div>
            <div className="font-semibold text-foreground">
              MVR {Number(bill.amount).toFixed(2)}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Already Paid</div>
            <div className="font-semibold text-emerald-600">
              MVR {Number(bill.approved_paid_amount || 0).toFixed(2)}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Outstanding</div>
            <div className="font-bold text-rose-600">MVR {outstanding.toFixed(2)}</div>
          </div>
        </div>

        {/* Bank Instructions Card */}
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-primary font-semibold text-sm">
              <Building2 className="h-4 w-4" />
              <span>Official Transfer Account</span>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs bg-background"
                onClick={handleCopyAccount}
              >
                {copiedAccount ? (
                  <Check className="h-3.5 w-3.5 text-emerald-600 mr-1" />
                ) : (
                  <Copy className="h-3.5 w-3.5 mr-1" />
                )}
                {copiedAccount ? "Copied" : "Copy Account"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                onClick={handleCopyDetails}
              >
                {copiedDetails ? (
                  <Check className="h-3.5 w-3.5 text-emerald-600 mr-1" />
                ) : (
                  <Copy className="h-3.5 w-3.5 mr-1" />
                )}
                Copy All Details
              </Button>
            </div>
          </div>

          <div className="space-y-1 text-sm bg-background/80 rounded-lg p-3 border border-border/50">
            <div className="flex justify-between items-center py-0.5">
              <span className="text-xs text-muted-foreground">Bank:</span>
              <span className="font-medium">{bankName}</span>
            </div>
            <div className="flex justify-between items-center py-0.5">
              <span className="text-xs text-muted-foreground">Account Name:</span>
              <span className="font-medium">{accountName}</span>
            </div>
            <div className="flex justify-between items-center py-0.5">
              <span className="text-xs text-muted-foreground">Account Number:</span>
              <span className="font-mono font-bold text-base text-primary tracking-wide">
                {accountNumber}
              </span>
            </div>
            {settings?.secondary_account && (
              <div className="flex justify-between items-center py-0.5">
                <span className="text-xs text-muted-foreground">Secondary Account:</span>
                <span className="font-mono text-xs">{settings.secondary_account}</span>
              </div>
            )}
          </div>

          {settings?.payment_instructions && (
            <div className="text-xs text-muted-foreground bg-muted/30 p-2.5 rounded border">
              <span className="font-semibold text-foreground">Instructions: </span>
              {settings.payment_instructions}
            </div>
          )}

          {settings?.viber_contact && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Phone className="h-3.5 w-3.5 text-primary" />
              <span>Viber / Support: </span>
              <span className="font-semibold text-foreground">{settings.viber_contact}</span>
            </div>
          )}
        </div>

        {/* Payment Submission Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="payment-amount">
                Payment Amount (MVR) <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="payment-amount"
                type="number"
                step="0.01"
                min="1"
                disabled={isPendingApproval}
                value={amount !== "" ? amount : outstanding.toString()}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={outstanding.toFixed(2)}
                required
              />
              <span className="text-[11px] text-muted-foreground">
                Outstanding balance: MVR {outstanding.toFixed(2)}
              </span>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="payment-date">
                Payment Date <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="payment-date"
                type="date"
                disabled={isPendingApproval}
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="payment-method">
                Payment Method <span className="text-rose-500">*</span>
              </Label>
              <Select
                disabled={isPendingApproval}
                value={paymentMethod}
                onValueChange={(v) =>
                  setPaymentMethod(v as "bank_transfer" | "online_transfer" | "cash")
                }
              >
                <SelectTrigger id="payment-method">
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_transfer">Bank Transfer (ATM / Teller)</SelectItem>
                  <SelectItem value="online_transfer">
                    Online Transfer (Internet Banking / App)
                  </SelectItem>
                  {settings?.allow_cash_submission && (
                    <SelectItem value="cash">Cash Submission (In-Person)</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="transfer-ref">Transfer Reference / Slip No.</Label>
              <Input
                id="transfer-ref"
                placeholder="e.g. BML Ref: 987654321"
                disabled={isPendingApproval}
                value={transferRef}
                onChange={(e) => setTransferRef(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bank-account-used">Your Bank / Account Sent From (optional)</Label>
            <Input
              id="bank-account-used"
              placeholder="e.g. BML Account 7701..."
              disabled={isPendingApproval}
              value={bankAccountUsed}
              onChange={(e) => setBankAccountUsed(e.target.value)}
            />
          </div>

          {/* Slip Upload Area */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="slip-file">
                Payment Slip / Receipt Proof
                {(paymentMethod === "bank_transfer" || paymentMethod === "online_transfer") && (
                  <span className="text-rose-500 font-bold ml-1">* REQUIRED</span>
                )}
              </Label>
              <span className="text-[11px] text-muted-foreground">JPG, PNG, or PDF (Max 10MB)</span>
            </div>

            <div className="rounded-xl border-2 border-dashed border-border/80 p-4 text-center hover:border-primary/50 transition-colors bg-muted/20">
              <input
                id="slip-file"
                type="file"
                accept="image/jpeg,image/png,image/jpg,application/pdf"
                disabled={isPendingApproval}
                onChange={handleFileChange}
                className="hidden"
              />
              <label
                htmlFor="slip-file"
                className="cursor-pointer flex flex-col items-center gap-1.5"
              >
                <UploadCloud className="h-8 w-8 text-muted-foreground" />
                {file ? (
                  <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                    <FileText className="h-4 w-4" />
                    <span>{file.name}</span>
                    <Badge variant="secondary" className="text-[10px]">
                      {(file.size / 1024).toFixed(0)} KB
                    </Badge>
                  </div>
                ) : (
                  <>
                    <span className="text-sm font-medium text-foreground">
                      Click to choose or drag transfer receipt here
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Stored securely in private storage
                    </span>
                  </>
                )}
              </label>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="student-note">Remarks / Note to Admin (optional)</Label>
            <Textarea
              id="student-note"
              placeholder="Any additional remarks or transfer verification details..."
              disabled={isPendingApproval}
              value={studentNote}
              onChange={(e) => setStudentNote(e.target.value)}
              rows={2}
            />
          </div>

          <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-blue-900 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Notice: </span>
              Submitting this payment places it in <strong>Pending Approval</strong>. The fee will
              only be officially marked as Paid after Admin review and verification.
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPendingApproval || submitting || uploading}
              className="min-w-[160px]"
            >
              {submitting || uploading
                ? uploading
                  ? "Uploading Slip..."
                  : "Submitting..."
                : "Submit for Approval"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
