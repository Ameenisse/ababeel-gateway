import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { changeStudentPin } from "@/lib/admissions.functions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ShieldCheck, Eye, EyeOff, KeyRound, ArrowRight, Lock } from "lucide-react";

export const Route = createFileRoute("/student/change-pin")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Change Student PIN — Ababeel Quran Class" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: ChangePinPage,
});

function ChangePinPage() {
  const navigate = useNavigate();
  const changePinFn = useServerFn(changeStudentPin);

  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!currentPin) {
      toast.error("Please enter your current temporary PIN.");
      return;
    }

    if (!/^\d{4,8}$/.test(newPin)) {
      toast.error("New PIN must be between 4 and 8 numeric digits.");
      return;
    }

    if (newPin !== confirmPin) {
      toast.error("New PIN and confirmation PIN do not match.");
      return;
    }

    if (currentPin === newPin) {
      toast.error("New PIN must be different from your temporary PIN.");
      return;
    }

    setSubmitting(true);
    try {
      await changePinFn({
        data: {
          currentPin: currentPin.trim(),
          newPin: newPin.trim(),
          confirmPin: confirmPin.trim(),
        },
      });

      toast.success("PIN changed successfully! Welcome to your student dashboard.");
      navigate({ to: "/student/dashboard", replace: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to change PIN";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-12">
      <Card className="w-full max-w-md border-border/80 shadow-md">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
            <KeyRound className="h-6 w-6" />
          </div>
          <CardTitle className="font-display text-2xl font-bold">Create New PIN</CardTitle>
          <CardDescription className="text-sm">
            This is your first login. For your account security, you must update your temporary initial PIN
            to a new private PIN before accessing the Student Dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="currentPin">Current Temporary PIN</Label>
              <div className="relative">
                <Input
                  id="currentPin"
                  type={showCurrent ? "text" : "password"}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={currentPin}
                  onChange={(e) => setCurrentPin(e.target.value)}
                  placeholder="e.g. last 4 digits of NID"
                  required
                  className="pr-10 font-mono tracking-widest"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Toggle password visibility"
                >
                  {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Your initial PIN was sent to your guardian's Google email upon admission approval.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="newPin">New Private PIN (4–8 digits)</Label>
              <div className="relative">
                <Input
                  id="newPin"
                  type={showNew ? "text" : "password"}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={8}
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  placeholder="Enter 4 to 8 digits"
                  required
                  className="pr-10 font-mono tracking-widest"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Toggle password visibility"
                >
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirmPin">Confirm New PIN</Label>
              <div className="relative">
                <Input
                  id="confirmPin"
                  type={showConfirm ? "text" : "password"}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={8}
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value)}
                  placeholder="Re-enter new PIN"
                  required
                  className="pr-10 font-mono tracking-widest"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Toggle password visibility"
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-foreground space-y-1">
              <div className="flex items-center gap-1.5 font-medium text-primary">
                <ShieldCheck className="h-4 w-4" /> Security Requirements
              </div>
              <ul className="list-inside list-disc text-muted-foreground space-y-0.5">
                <li>Must be 4 to 8 numeric digits (0–9)</li>
                <li>Do not share this PIN with anyone else</li>
                <li>You will use this new PIN for all future logins</li>
              </ul>
            </div>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? (
                "Updating PIN..."
              ) : (
                <>
                  Save New PIN & Continue <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
