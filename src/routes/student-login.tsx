import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { GraduationCap, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { getMyRole, resolveStudentLogin } from "@/lib/auth.functions";

export const Route = createFileRoute("/student-login")({
  head: () => ({
    meta: [{ title: "Student Login — Ababeel Quran Class" }],
  }),
  component: StudentLogin,
});

function StudentLogin() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d+$/.test(pin)) {
      toast.error("PIN must be numeric only.");
      return;
    }
    setLoading(true);
    try {
      const res = await resolveStudentLogin({ data: { username } });
      if (!res.email) {
        setLoading(false);
        if (res.reason === "inactive") toast.error("Your account is inactive. Please contact administration.");
        else if (res.reason === "locked") toast.error("Your account is locked. Please contact administration.");
        else toast.error("Incorrect username or PIN.");
        return;
      }
      const { error } = await supabase.auth.signInWithPassword({ email: res.email, password: pin });
      if (error) {
        setLoading(false);
        toast.error("Incorrect username or PIN.");
        return;
      }
      const r = await getMyRole();
      if (r.role !== "student") {
        await supabase.auth.signOut();
        toast.error("Account does not have student access.");
        setLoading(false);
        return;
      }
      navigate({ to: "/student/dashboard" });
    } catch {
      toast.error("Sign-in failed. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-gradient-to-br from-primary-soft via-background to-background px-4">
      <Card className="w-full max-w-md border-border/60 shadow-glow">
        <CardHeader className="text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-primary text-primary-foreground">
            <GraduationCap className="h-6 w-6" />
          </div>
          <CardTitle className="font-display text-2xl">Student Login</CardTitle>
          <CardDescription>Sign in with your username and numeric PIN.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                required
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pin">PIN</Label>
              <div className="relative">
                <Input
                  id="pin"
                  required
                  inputMode="numeric"
                  pattern="[0-9]*"
                  type={showPin ? "text" : "password"}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPin((v) => !v)}
                  aria-label={showPin ? "Hide PIN" : "Show PIN"}
                >
                  {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>
          <Link
            to="/"
            className="mt-4 flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" /> Back to site
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
