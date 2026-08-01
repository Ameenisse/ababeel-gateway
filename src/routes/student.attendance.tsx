import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RoleShell } from "@/components/role-shell";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/student/attendance")({
  ssr: false,
  head: () => ({ meta: [{ title: "My Attendance — Student" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: Page,
});

type AttendanceRow = { id: string; attendance_date: string; status: string; notes: string | null };

const statusVariant: Record<string, "default" | "destructive" | "secondary" | "outline"> = {
  present: "default",
  absent: "destructive",
  late: "secondary",
  excused: "outline",
};

function monthKey(dateStr: string) {
  return dateStr.slice(0, 7);
}

function Page() {
  const [rows, setRows] = useState<AttendanceRow[]>([]);

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.from("students").select("id").maybeSingle();
      if (!s) return;
      const { data } = await supabase
        .from("attendance")
        .select("id, attendance_date, status, notes")
        .eq("student_id", (s as { id: string }).id)
        .order("attendance_date", { ascending: false });
      setRows((data ?? []) as AttendanceRow[]);
    })();
  }, []);

  const overallPresent = rows.filter((r) => r.status === "present").length;
  const overallPct = rows.length ? Math.round((overallPresent / rows.length) * 100) : 0;

  const byMonth: Record<string, AttendanceRow[]> = {};
  for (const r of rows) {
    const k = monthKey(r.attendance_date);
    byMonth[k] = byMonth[k] ?? [];
    byMonth[k].push(r);
  }
  const months = Object.keys(byMonth).sort((a, b) => b.localeCompare(a));

  return (
    <RoleShell role="student" title="My Attendance">
      <Card className="mb-4">
        <CardHeader><CardTitle className="text-base">Overall</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {rows.length === 0 ? "No attendance records yet." : `${overallPresent}/${rows.length} present (${overallPct}%)`}
        </CardContent>
      </Card>

      <div className="space-y-4">
        {months.map((m) => {
          const list = byMonth[m];
          const present = list.filter((r) => r.status === "present").length;
          const pct = list.length ? Math.round((present / list.length) * 100) : 0;
          return (
            <Card key={m}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-base">
                  <span>{new Date(m + "-01").toLocaleDateString(undefined, { month: "long", year: "numeric" })}</span>
                  <span className="text-xs font-normal text-muted-foreground">{present}/{list.length} present ({pct}%)</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {list.map((r) => (
                  <div key={r.id} className="flex items-center justify-between rounded-md border border-border/60 p-2 text-sm">
                    <span>{new Date(r.attendance_date).toLocaleDateString()}</span>
                    <span className="flex items-center gap-2">
                      {r.notes && <span className="text-xs text-muted-foreground">{r.notes}</span>}
                      <Badge variant={statusVariant[r.status] ?? "outline"}>{r.status}</Badge>
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}
        {months.length === 0 && (
          <Card><CardContent className="p-6 text-sm text-muted-foreground">No attendance records yet.</CardContent></Card>
        )}
      </div>
    </RoleShell>
  );
}
