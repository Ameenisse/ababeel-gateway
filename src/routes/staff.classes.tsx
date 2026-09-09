import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { RoleShell } from "@/components/role-shell";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Users } from "lucide-react";

export const Route = createFileRoute("/staff/classes")({
  ssr: false,
  head: () => ({
    meta: [{ title: "My Classes — Staff" }, { name: "robots", content: "noindex,nofollow" }],
  }),
  component: Page,
});

type ClassRow = {
  id: string;
  class_name: string;
  class_code: string;
  session: string | null;
  status: string;
};
type StudentRow = { id: string; full_name: string; student_number: string };

function Page() {
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [students, setStudents] = useState<Record<string, StudentRow[]>>({});
  const [progress, setProgress] = useState<Record<string, { done: number; total: number }>>({});
  const [currentTermId, setCurrentTermId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) return;
      const { data: term } = await supabase
        .from("academic_terms")
        .select("id")
        .eq("status", "active")
        .maybeSingle();
      setCurrentTermId((term as { id: string } | null)?.id ?? null);
      const { data, error } = await supabase
        .from("classes")
        .select("id, class_name, class_code, session, status")
        .or(`teacher_id.eq.${uid},assistant_teacher_id.eq.${uid}`)
        .order("class_name");
      if (error) return;
      setClasses((data ?? []) as ClassRow[]);
    })();
  }, []);

  const toggle = useCallback(
    async (classId: string) => {
      if (expanded === classId) {
        setExpanded(null);
        return;
      }
      setExpanded(classId);
      if (!students[classId]) {
        const { data } = await supabase
          .from("students")
          .select("id, full_name, student_number")
          .eq("class_id", classId)
          .order("full_name");
        const list = (data ?? []) as StudentRow[];
        setStudents((p) => ({ ...p, [classId]: list }));
        if (currentTermId && list.length) {
          const ids = list.map((s) => s.id);
          const { data: assignments } = await supabase
            .from("student_target_assignments")
            .select("student_id, status")
            .eq("term_id", currentTermId)
            .in("student_id", ids);
          const map: Record<string, { done: number; total: number }> = {};
          for (const s of list) map[s.id] = { done: 0, total: 0 };
          for (const a of (assignments ?? []) as { student_id: string; status: string }[]) {
            map[a.student_id] = map[a.student_id] ?? { done: 0, total: 0 };
            map[a.student_id].total += 1;
            if (a.status === "completed") map[a.student_id].done += 1;
          }
          setProgress((p) => ({ ...p, ...map }));
        }
      }
    },
    [expanded, students, currentTermId],
  );

  return (
    <RoleShell role="staff" title="My Classes">
      <div className="space-y-3">
        {classes.map((c) => (
          <Card key={c.id}>
            <CardHeader className="cursor-pointer select-none" onClick={() => toggle(c.id)}>
              <CardTitle className="flex items-center justify-between text-base">
                <span className="flex items-center gap-2">
                  {expanded === c.id ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  {c.class_name}{" "}
                  <span className="text-xs text-muted-foreground">· {c.class_code}</span>
                </span>
                <span className="text-xs font-normal text-muted-foreground">{c.status}</span>
              </CardTitle>
            </CardHeader>
            {expanded === c.id && (
              <CardContent className="space-y-2">
                {(students[c.id] ?? []).map((s) => {
                  const p = progress[s.id];
                  return (
                    <div
                      key={s.id}
                      className="flex items-center justify-between rounded-md border border-border/60 p-2"
                    >
                      <div>
                        <div className="text-sm font-medium">{s.full_name}</div>
                        <div className="text-xs text-muted-foreground">{s.student_number}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground">
                          Targets: {p ? `${p.done}/${p.total}` : "0/0"}
                        </span>
                        <Button asChild size="sm" variant="outline">
                          <Link to="/staff/term-report/$studentId" params={{ studentId: s.id }}>
                            Report
                          </Link>
                        </Button>
                      </div>
                    </div>
                  );
                })}
                {(students[c.id] ?? []).length === 0 && (
                  <div className="p-2 text-sm text-muted-foreground">
                    No students in this class.
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        ))}
        {classes.length === 0 && (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              You are not assigned to any classes.
            </CardContent>
          </Card>
        )}
      </div>
    </RoleShell>
  );
}
