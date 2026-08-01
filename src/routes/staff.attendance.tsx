import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { RoleShell } from "@/components/role-shell";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Save } from "lucide-react";

export const Route = createFileRoute("/staff/attendance")({
  ssr: false,
  head: () => ({ meta: [{ title: "Attendance — Staff" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: Page,
});

type ClassRow = { id: string; class_name: string; class_code: string };
type StudentRow = { id: string; full_name: string; student_number: string };
type Status = "present" | "absent" | "late" | "excused";

const STATUS_OPTIONS: Status[] = ["present", "absent", "late", "excused"];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function Page() {
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [classId, setClassId] = useState<string>("");
  const [date, setDate] = useState<string>(todayStr());
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [statusMap, setStatusMap] = useState<Record<string, Status>>({});
  const [notesMap, setNotesMap] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) return;
      const { data } = await supabase
        .from("classes")
        .select("id, class_name, class_code")
        .or(`teacher_id.eq.${uid},assistant_teacher_id.eq.${uid}`)
        .order("class_name");
      const list = (data ?? []) as ClassRow[];
      setClasses(list);
      if (list[0]) setClassId(list[0].id);
    })();
  }, []);

  const load = useCallback(async () => {
    if (!classId || !date) return;
    const { data: studentData } = await supabase
      .from("students")
      .select("id, full_name, student_number")
      .eq("class_id", classId)
      .order("full_name");
    const list = (studentData ?? []) as StudentRow[];
    setStudents(list);
    const { data: existing } = await supabase
      .from("attendance")
      .select("student_id, status, notes")
      .eq("class_id", classId)
      .eq("attendance_date", date);
    const sMap: Record<string, Status> = {};
    const nMap: Record<string, string> = {};
    for (const s of list) sMap[s.id] = "present";
    for (const e of (existing ?? []) as { student_id: string; status: string; notes: string | null }[]) {
      sMap[e.student_id] = e.status as Status;
      if (e.notes) nMap[e.student_id] = e.notes;
    }
    setStatusMap(sMap);
    setNotesMap(nMap);
  }, [classId, date]);

  useEffect(() => { load(); }, [load]);

  async function submit() {
    if (!classId || !date) return;
    setBusy(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id ?? null;
      const rows = students.map((s) => ({
        student_id: s.id,
        class_id: classId,
        attendance_date: date,
        status: statusMap[s.id] ?? "present",
        notes: notesMap[s.id] ?? null,
        recorded_by: uid,
      }));
      const { error } = await supabase.from("attendance").upsert(rows, { onConflict: "student_id,class_id,attendance_date" });
      if (error) throw error;
      toast.success("Attendance saved");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to save attendance");
    } finally {
      setBusy(false);
    }
  }

  return (
    <RoleShell role="staff" title="Attendance">
      <Card className="mb-4">
        <CardContent className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-muted-foreground">Class</label>
            <Select value={classId} onValueChange={setClassId}>
              <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
              <SelectContent>
                {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.class_name} · {c.class_code}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Date</label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <Button onClick={submit} disabled={busy || !classId}><Save className="h-4 w-4 mr-1" />Save</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Students</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {students.map((s) => (
            <div key={s.id} className="flex flex-col gap-2 rounded-md border border-border/60 p-3 sm:flex-row sm:items-center">
              <div className="flex-1">
                <div className="text-sm font-medium">{s.full_name}</div>
                <div className="text-xs text-muted-foreground">{s.student_number}</div>
              </div>
              <div className="flex gap-1">
                {STATUS_OPTIONS.map((opt) => (
                  <Button
                    key={opt}
                    size="sm"
                    variant={statusMap[s.id] === opt ? "default" : "outline"}
                    onClick={() => setStatusMap((p) => ({ ...p, [s.id]: opt }))}
                  >
                    {opt}
                  </Button>
                ))}
              </div>
              <Textarea
                className="sm:w-48"
                placeholder="Notes"
                value={notesMap[s.id] ?? ""}
                onChange={(e) => setNotesMap((p) => ({ ...p, [s.id]: e.target.value }))}
              />
            </div>
          ))}
          {students.length === 0 && <div className="p-4 text-sm text-muted-foreground">Select a class to mark attendance.</div>}
        </CardContent>
      </Card>
    </RoleShell>
  );
}
