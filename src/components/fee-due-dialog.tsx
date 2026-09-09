import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Clock, Receipt, ArrowRight, X } from "lucide-react";
import { getStudentFeeData } from "@/lib/fees.functions";
import type { FeeBill, FeeSettings, StudentFeeSummary } from "@/types/fees";
import { StudentPayFeeModal } from "@/components/student-pay-fee-modal";

export function FeeDueDialog() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<StudentFeeSummary | null>(null);
  const [settings, setSettings] = useState<FeeSettings | null>(null);
  const [activeBill, setActiveBill] = useState<FeeBill | null>(null);
  const [payModalOpen, setPayModalOpen] = useState(false);

  const checkFees = async () => {
    try {
      // Check session storage first
      const dismissed = sessionStorage.getItem("ababeel_fee_reminder_dismissed");
      if (dismissed === "true") {
        setLoading(false);
        return;
      }

      const res = await getStudentFeeData();
      if (!res?.student || !res.summary) {
        setLoading(false);
        return;
      }

      setSummary(res.summary);
      setSettings(res.settings);

      // Find oldest unpaid/outstanding bill for quick "Pay Now"
      const outstandingBills = (res.bills || []).filter(
        (b) =>
          b.status === "unpaid" ||
          b.status === "partially_paid" ||
          b.status === "overdue" ||
          b.status === "pending_approval",
      );

      if (outstandingBills.length > 0) {
        setActiveBill(outstandingBills[0]);
        // If settings allow popup (default true)
        if (res.settings?.fee_reminder_popup !== false) {
          setOpen(true);
        }
      }
    } catch {
      // silently ignore if not a student
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkFees();
  }, []);

  const handleRemindLater = () => {
    sessionStorage.setItem("ababeel_fee_reminder_dismissed", "true");
    setOpen(false);
  };

  const handleViewFees = () => {
    setOpen(false);
    navigate({ to: "/student/fees" });
  };

  const handlePayNow = () => {
    setOpen(false);
    setPayModalOpen(true);
  };

  if (loading || !summary || summary.unpaid_bills_count === 0) {
    return null;
  }

  const hasPending = summary.has_pending_submission;

  return (
    <>
      <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleRemindLater()}>
        <DialogContent className="max-w-md p-6 border-rose-200">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-rose-600">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-rose-100">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <DialogTitle className="text-xl font-bold font-display text-foreground">
                  Fee Payment Reminder
                </DialogTitle>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground"
                onClick={handleRemindLater}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <DialogDescription className="text-sm pt-1">
              Student: <span className="font-semibold text-foreground">{summary.student_name}</span>{" "}
              ({summary.student_number})
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Outstanding Box */}
            <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-4 space-y-3">
              <div className="flex justify-between items-baseline">
                <span className="text-xs text-rose-800 font-medium">Total Outstanding</span>
                <span className="font-display text-2xl font-black text-rose-700">
                  MVR {summary.total_outstanding.toFixed(2)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs border-t border-rose-200/80 pt-2.5">
                <div>
                  <span className="text-rose-700">Unpaid Bills:</span>
                  <div className="font-semibold text-foreground">
                    {summary.unpaid_bills_count}{" "}
                    {summary.unpaid_bills_count === 1 ? "bill" : "bills"}
                  </div>
                </div>
                {summary.oldest_due_month && (
                  <div>
                    <span className="text-rose-700">Oldest Due:</span>
                    <div className="font-semibold text-foreground">{summary.oldest_due_month}</div>
                  </div>
                )}
                {summary.oldest_due_date && (
                  <div>
                    <span className="text-rose-700">Due Date:</span>
                    <div className="font-medium text-foreground">{summary.oldest_due_date}</div>
                  </div>
                )}
                {summary.overdue_balance > 0 && (
                  <div>
                    <span className="text-rose-700 font-bold">Overdue Amount:</span>
                    <div className="font-bold text-rose-700">
                      MVR {summary.overdue_balance.toFixed(2)}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Pending submission indicator */}
            {hasPending ? (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 flex items-start gap-2.5">
                <Clock className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">Payment submitted — waiting for Admin approval</div>
                  <div className="text-amber-800 mt-0.5">
                    Your previous payment slip was received and is currently in the verification
                    queue.
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRemindLater}
              className="text-xs"
            >
              Remind Me Later
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleViewFees}
              className="text-xs flex items-center gap-1.5"
            >
              <Receipt className="h-3.5 w-3.5" />
              View Fees
            </Button>
            {!hasPending && (
              <Button
                type="button"
                size="sm"
                onClick={handlePayNow}
                className="text-xs flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white"
              >
                Pay Now
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pay modal if opened */}
      {activeBill && (
        <StudentPayFeeModal
          open={payModalOpen}
          onOpenChange={setPayModalOpen}
          bill={activeBill}
          studentName={summary.student_name}
          studentNumber={summary.student_number}
          settings={settings}
          onSuccess={() => {
            sessionStorage.setItem("ababeel_fee_reminder_dismissed", "true");
            checkFees();
          }}
        />
      )}
    </>
  );
}
