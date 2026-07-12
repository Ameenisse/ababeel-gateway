import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Users, ArrowLeft } from "lucide-react";
import { getMyRole } from "@/lib/auth.functions";

export const Route = createFileRoute("/staff/")({
  head: () => ({
    meta: [
      { title: "Staff Login — Ababeel Quran Class" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: StaffLogin,
});

function StaffLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      toast.error(error.message);
      return;
    }
    try {
      const r = await getMyRole();
      if (r.role !== "staff" && r.role !== "admin") {
        await supabase.auth.signOut();
        toast.error("This account does not have staff access.");
        setLoading(false);
        return;
      }
      navigate({ to: r.role === "admin" ? "/admin/dashboard" : "/staff/dashboard" });
    } catch {
      toast.error("Could not verify role.");
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-gradient-to-br from-primary-soft via-background to-background px-4">
      <Card className="w-full max-w-md border-border/60 shadow-glow">
        <CardHeader className="text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-primary text-primary-foreground">
            <Users className="h-6 w-6" />
          </div>
          <CardTitle className="font-display text-2xl">Staff Login</CardTitle>
          <CardDescription>Sign in with the credentials issued by administration.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>
          <Link to="/" className="mt-4 flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3 w-3" /> Back to site
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
