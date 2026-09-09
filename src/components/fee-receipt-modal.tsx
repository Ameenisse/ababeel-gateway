import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, Download, BookOpen, CheckCircle2 } from "lucide-react";
import type { FeePayment, FeeBill } from "@/types/fees";

interface FeeReceiptModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payment: FeePayment | null;
  bill?: FeeBill | null;
  studentName?: string;
  studentNumber?: string;
  classNameStr?: string;
}

export function FeeReceiptModal({
  open,
  onOpenChange,
  payment,
  bill,
  studentName,
  studentNumber,
  classNameStr,
}: FeeReceiptModalProps) {
  if (!payment) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0 overflow-hidden bg-background">
        <div className="p-6 border-b flex items-center justify-between bg-muted/20">
          <DialogTitle className="text-lg font-bold font-display flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            Official Payment Receipt
          </DialogTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="h-8 gap-1.5 text-xs"
            >
              <Printer className="h-3.5 w-3.5" />
              Print / Save PDF
            </Button>
          </div>
        </div>

        {/* Printable receipt container */}
        <div
          id="printable-fee-receipt"
          className="p-8 space-y-6 text-foreground bg-white dark:bg-slate-950"
        >
          {/* Header */}
          <div className="flex items-start justify-between border-b pb-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-emerald-600 text-white grid place-items-center font-bold">
                  <BookOpen className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-lg font-bold font-display tracking-tight text-emerald-800 dark:text-emerald-400">
                    Ababeel Quran Class
                  </h2>
                  <p className="text-[11px] text-muted-foreground">
                    Gateway to Quranic Excellence & Tarbiyyah
                  </p>
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs uppercase font-bold tracking-wider text-emerald-700 dark:text-emerald-400">
                Official Fee Receipt
              </div>
              <div className="font-mono text-sm font-bold text-foreground mt-0.5">
                {payment.receipt_number}
              </div>
              <div className="text-[11px] text-muted-foreground">
                Date: {payment.payment_date || new Date(payment.approved_at).toLocaleDateString()}
              </div>
            </div>
          </div>

          {/* Student & Bill Details Grid */}
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div className="rounded-lg border p-3 space-y-1.5 bg-muted/10">
              <div className="text-muted-foreground uppercase font-semibold text-[10px] tracking-wider">
                Student Information
              </div>
              <div className="font-bold text-sm text-foreground">{studentName || "Student"}</div>
              <div>
                <span className="text-muted-foreground">Student No: </span>
                <span className="font-medium font-mono">{studentNumber || "—"}</span>
              </div>
              {classNameStr && (
                <div>
                  <span className="text-muted-foreground">Class: </span>
                  <span className="font-medium">{classNameStr}</span>
                </div>
              )}
            </div>

            <div className="rounded-lg border p-3 space-y-1.5 bg-muted/10">
              <div className="text-muted-foreground uppercase font-semibold text-[10px] tracking-wider">
                Bill Information
              </div>
              <div>
                <span className="text-muted-foreground">Fee Month: </span>
                <span className="font-bold text-foreground">
                  {bill?.fee_month || "Tuition Fee"}
                </span>
              </div>
              {bill?.bill_number && (
                <div>
                  <span className="text-muted-foreground">Bill No: </span>
                  <span className="font-mono">{bill.bill_number}</span>
                </div>
              )}
              <div>
                <span className="text-muted-foreground">Approved On: </span>
                <span>{new Date(payment.approved_at).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          {/* Line Item Table */}
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 border-b text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="p-3">Description</th>
                  <th className="p-3">Payment Method</th>
                  <th className="p-3">Reference</th>
                  <th className="p-3 text-right">Amount Paid</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                <tr>
                  <td className="p-3 font-medium">
                    {bill?.fee_month ? `Tuition Fee — ${bill.fee_month}` : "Monthly Tuition Fee"}
                  </td>
                  <td className="p-3 capitalize">{payment.payment_method.replace("_", " ")}</td>
                  <td className="p-3 font-mono text-muted-foreground">
                    {payment.reference || "—"}
                  </td>
                  <td className="p-3 text-right font-bold text-sm text-foreground font-mono">
                    MVR {Number(payment.amount).toFixed(2)}
                  </td>
                </tr>
              </tbody>
              <tfoot className="bg-muted/20 border-t font-semibold">
                <tr>
                  <td colSpan={3} className="p-3 text-right text-xs">
                    Total Received:
                  </td>
                  <td className="p-3 text-right text-base font-bold text-emerald-700 font-mono">
                    MVR {Number(payment.amount).toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Account Details & Stamp */}
          <div className="flex items-center justify-between text-xs text-muted-foreground pt-3 border-t">
            <div className="space-y-1">
              <div>
                <span className="font-medium text-foreground">Receiving Account: </span>
                {payment.financial_account?.account_name || "Official Ababeel Account"}
              </div>
              {payment.notes && (
                <div>
                  <span className="font-medium text-foreground">Notes: </span>
                  {payment.notes}
                </div>
              )}
              <div className="text-[10px] text-muted-foreground pt-1">
                This is a computer-generated official receipt authorized by Ababeel Quran Class.
              </div>
            </div>
            <div className="text-center border-2 border-dashed border-emerald-600/40 rounded-xl p-2.5 px-4 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400">
              <div className="text-[10px] font-bold uppercase tracking-wider">Status</div>
              <div className="font-display font-black text-sm uppercase">VERIFIED & PAID</div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
