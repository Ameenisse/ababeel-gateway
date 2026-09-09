import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { RoleShell } from "@/components/role-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreditCard, AlertTriangle, CheckCircle2, Clock, ArrowRight } from "lucide-react";
import { getStudentFeeData } from "@/lib/fees.functions";

export const Route = createFileRoute("/student/dashboard")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Student Dashboard — Ababeel Quran Class" }],
  }),
  component: StudentDashboard,
});

function StudentDashboard() {
  const student = useQuery({
    queryKey: ["me_student"],
    queryFn: async () => {
      const { data: sess } = await supabase.auth.getUser();
      if (!sess.user) return null;
      const { data } = await supabase
        .from("students")
        .select("*, class:classes(class_name)")
        .eq("user_id", sess.user.id)
        .maybeSingle();
      return data;
    },
  });

  const feeData = useQuery({
    queryKey: ["student_fee_dashboard"],
    queryFn: async () => {
      return await getStudentFeeData();
    },
  });

  const s = student.data;
  const summary = feeData.data?.summary;
  const hasOutstanding = summary && summary.total_outstanding > 0;

  return (
    <RoleShell role="student" title="My Dashboard">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-border/60 lg:col-span-1">
          <CardHeader className="text-center">
            <Avatar className="mx-auto h-20 w-20">
              <AvatarImage src={s?.photo_url ?? undefined} />
              <AvatarFallback>{s?.full_name?.[0] ?? "S"}</AvatarFallback>
            </Avatar>
            <CardTitle className="mt-3 font-display">{s?.full_name ?? "Student"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Student ID</span>
              <span className="font-medium">{s?.student_number ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Class</span>
              <span className="font-medium">
                {(s as { class?: { class_name?: string } } | null)?.class?.class_name ?? "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Session</span>
              <span className="font-medium">{s?.session ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <span className="font-medium capitalize">{s?.status ?? "active"}</span>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4 lg:col-span-2">
          {/* Fee Overview Widget */}
          <Card
            className={`border ${hasOutstanding ? "border-rose-200 bg-rose-50/20" : "border-emerald-200 bg-emerald-50/20"}`}
          >
            <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <CreditCard
                    className={`h-4 w-4 ${hasOutstanding ? "text-rose-600" : "text-emerald-600"}`}
                  />
                  <span className="font-display font-bold text-base">Fee Standing</span>
                  {hasOutstanding ? (
                    <Badge variant="destructive" className="text-[10px]">
                      Payment Due
                    </Badge>
                  ) : (
                    <Badge className="bg-emerald-600 text-white text-[10px]">Up to Date</Badge>
                  )}
                </div>

                {hasOutstanding ? (
                  <div className="text-sm">
                    Total outstanding balance:{" "}
                    <strong className="text-rose-600 text-base font-display font-bold">
                      MVR {summary.total_outstanding.toFixed(2)}
                    </strong>{" "}
                    ({summary.unpaid_bills_count}{" "}
                    {summary.unpaid_bills_count === 1 ? "bill" : "bills"})
                    {summary.has_pending_submission && (
                      <div className="text-xs text-amber-700 flex items-center gap-1 mt-1">
                        <Clock className="h-3 w-3" />A payment submission is waiting for Admin
                        review.
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-emerald-700">
                    Alhamdulillah, all your tuition fees are fully settled!
                  </div>
                )}
              </div>

              <Button
                asChild
                size="sm"
                className={hasOutstanding ? "bg-rose-600 hover:bg-rose-700 text-white" : ""}
              >
                <Link to="/student/fees" className="gap-1.5 text-xs">
                  {hasOutstanding ? "Pay Fees" : "View Fee History"}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="font-display">Assalamu alaikum</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>
                Welcome to your Ababeel Quran Class student portal. Monitor your daily recitation
                targets, check attendance, review competition progress, and manage tuition fee
                payments seamlessly.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </RoleShell>
  );
}
