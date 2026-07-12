import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { RoleShell } from "@/components/role-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

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

  const s = student.data;

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
        <Card className="border-border/60 lg:col-span-2">
          <CardHeader>
            <CardTitle className="font-display">Assalamu alaikum</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Your attendance, competitions, results, and announcements will be shown here as they
            become available.
          </CardContent>
        </Card>
      </div>
    </RoleShell>
  );
}
