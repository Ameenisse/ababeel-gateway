import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { RoleShell } from "@/components/role-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { CalendarCheck, Save } from "lucide-react";

export const Route = createFileRoute("/admin/attendance")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Attendance — Admin" }, { name: "robots", content: "noindex,nofollow" }],
  }),
  component: AttendancePage,
});

type ClassRow = { id: string; class_name: string; session: string | null };
type Student = { id: string; student_number: string; full_name: string; class_id: string | null };
type AttendanceStatus = "present" | "absent" | "late" | "excused";
type AttendanceRow = {
  id: string;
  student_id: string;
  class_id: string;
  attendance_date: string;
  status: string;
  notes: string | null;
};

const STATUS_OPTIONS: AttendanceStatus[] = ["present", "absent", "late", "excused"];

const statusBadge = (s: string) => {
  const map: Record<string, string> = {
    present: "bg-success/15 text-success",
    absent: "bg-destructive/15 text-destructive",
    late: "bg-warning/15 text-warning",
    excused: "bg-info/15 text-info",
  };
  return <Badge className={map[s] ?? "bg-muted text-foreground"}>{s}</Badge>;
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function AttendancePage() {
  const [tab, setTab] = useState<"mark" | "summary">("mark");
  return (
    <RoleShell role="admin" title="Attendance">
      <Tabs value={tab} onValueChange={(v) => setTab(v as "mark" | "summary")}>
        <TabsList>
          <TabsTrigger value="mark">Mark Attendance</TabsTrigger>
          <TabsTrigger value="summary">Summary</TabsTrigger>
        </TabsList>
        <TabsContent value="mark" className="mt-4">
          <MarkPanel />
        </TabsContent>
        <TabsContent value="summary" className="mt-4">
          <SummaryPanel />
        </TabsContent>
      </Tabs>
    </RoleShell>
  );
}

function useClasses() {
  return useQuery({
    queryKey: ["classes_list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classes")
        .select("id, class_name, session")
        .order("class_name");
      if (error) throw error;
      return (data ?? []) as ClassRow[];
    },
  });
}

/* ---------------------------- Mark ---------------------------- */

function MarkPanel() {
  const qc = useQueryClient();
  const classes = useClasses();
  const [classId, setClassId] = useState<string>("");
  const [date, setDate] = useState<string>(todayISO());

  const activeClassId = classId || classes.data?.[0]?.id || "";

  const students = useQuery({
    queryKey: ["class_students", activeClassId],
    enabled: !!activeClassId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("id, student_number, full_name, class_id")
        .eq("class_id", activeClassId)
        .order("full_name");
      if (error) throw error;
      return (data ?? []) as Student[];
    },
  });

  const existing = useQuery({
    queryKey: ["attendance_for", activeClassId, date],
    enabled: !!activeClassId && !!date,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance")
        .select("*")
        .eq("class_id", activeClassId)
        .eq("attendance_date", date);
      if (error) throw error;
      return (data ?? []) as AttendanceRow[];
    },
  });

  const [draft, setDraft] = useState<Record<string, { status: AttendanceStatus; notes: string }>>(
    {},
  );

  const rows = useMemo(() => {
    const map: Record<string, { status: AttendanceStatus; notes: string }> = {};
    (existing.data ?? []).forEach((r) => {
      map[r.student_id] = { status: r.status as AttendanceStatus, notes: r.notes ?? "" };
    });
    return map;
  }, [existing.data]);

  function getValue(studentId: string) {
    return (
      draft[studentId] ?? rows[studentId] ?? { status: "present" as AttendanceStatus, notes: "" }
    );
  }

  function setValue(
    studentId: string,
    patch: Partial<{ status: AttendanceStatus; notes: string }>,
  ) {
    setDraft((d) => ({ ...d, [studentId]: { ...getValue(studentId), ...patch } }));
  }

  const saveMut = useMutation({
    mutationFn: async () => {
      const { data: sess } = await supabase.auth.getUser();
      const uid = sess.user?.id ?? null;
      const payload = (students.data ?? []).map((s) => {
        const v = getValue(s.id);
        return {
          student_id: s.id,
          class_id: activeClassId,
          attendance_date: date,
          status: v.status,
          notes: v.notes || null,
          recorded_by: uid,
        };
      });
      if (payload.length === 0) return;
      const { error } = await supabase
        .from("attendance")
        .upsert(payload, { onConflict: "student_id,class_id,attendance_date" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance_for", activeClassId, date] });
      setDraft({});
      toast.success("Attendance saved");
    },
    onError: (e: unknown) => toast.error((e as Error).message),
  });

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Label className="text-xs uppercase text-muted-foreground">Class</Label>
              <Select value={activeClassId} onValueChange={setClassId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select class" />
                </SelectTrigger>
                <SelectContent>
                  {(classes.data ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.class_name} {c.session ? `· ${c.session}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs uppercase text-muted-foreground">Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending || !activeClassId}>
            <Save className="mr-1 h-4 w-4" /> Save Attendance
          </Button>
        </CardContent>
      </Card>

      {!activeClassId ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Select a class to mark attendance.
          </CardContent>
        </Card>
      ) : students.isLoading ? (
        <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
      ) : (students.data ?? []).length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            No students in this class.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead className="w-40">Status</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(students.data ?? []).map((s) => {
                  const v = getValue(s.id);
                  return (
                    <TableRow key={s.id}>
                      <TableCell>
                        <div className="font-medium">{s.full_name}</div>
                        <div className="text-xs text-muted-foreground">{s.student_number}</div>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={v.status}
                          onValueChange={(val) =>
                            setValue(s.id, { status: val as AttendanceStatus })
                          }
                        >
                          <SelectTrigger className="w-36">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map((opt) => (
                              <SelectItem key={opt} value={opt}>
                                {opt}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          value={v.notes}
                          onChange={(e) => setValue(s.id, { notes: e.target.value })}
                          placeholder="Optional note"
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ---------------------------- Summary ---------------------------- */

function SummaryPanel() {
  const classes = useClasses();
  const [classId, setClassId] = useState<string>("");
  const activeClassId = classId || classes.data?.[0]?.id || "";
  const [from, setFrom] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState<string>(todayISO());

  const students = useQuery({
    queryKey: ["class_students", activeClassId],
    enabled: !!activeClassId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("id, student_number, full_name, class_id")
        .eq("class_id", activeClassId)
        .order("full_name");
      if (error) throw error;
      return (data ?? []) as Student[];
    },
  });

  const attendance = useQuery({
    queryKey: ["attendance_range", activeClassId, from, to],
    enabled: !!activeClassId && !!from && !!to,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance")
        .select("student_id, status, attendance_date")
        .eq("class_id", activeClassId)
        .gte("attendance_date", from)
        .lte("attendance_date", to);
      if (error) throw error;
      return (data ?? []) as Pick<AttendanceRow, "student_id" | "status" | "attendance_date">[];
    },
  });

  const summary = useMemo(() => {
    const byStudent: Record<string, { total: number; present: number }> = {};
    (attendance.data ?? []).forEach((r) => {
      byStudent[r.student_id] ??= { total: 0, present: 0 };
      byStudent[r.student_id].total += 1;
      if (r.status === "present" || r.status === "late") byStudent[r.student_id].present += 1;
    });
    return byStudent;
  }, [attendance.data]);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Label className="text-xs uppercase text-muted-foreground">Class</Label>
            <Select value={activeClassId} onValueChange={setClassId}>
              <SelectTrigger>
                <SelectValue placeholder="Select class" />
              </SelectTrigger>
              <SelectContent>
                {(classes.data ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.class_name} {c.session ? `· ${c.session}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs uppercase text-muted-foreground">From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs uppercase text-muted-foreground">To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {!activeClassId ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Select a class to view summary.
          </CardContent>
        </Card>
      ) : students.isLoading || attendance.isLoading ? (
        <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Days recorded</TableHead>
                  <TableHead>Present/Late</TableHead>
                  <TableHead>Attendance %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(students.data ?? []).map((s) => {
                  const stat = summary[s.id] ?? { total: 0, present: 0 };
                  const pct = stat.total ? Math.round((stat.present / stat.total) * 100) : 0;
                  return (
                    <TableRow key={s.id}>
                      <TableCell>
                        <div className="font-medium">{s.full_name}</div>
                        <div className="text-xs text-muted-foreground">{s.student_number}</div>
                      </TableCell>
                      <TableCell>{stat.total}</TableCell>
                      <TableCell>{stat.present}</TableCell>
                      <TableCell>
                        <Badge
                          className={
                            pct >= 90
                              ? "bg-success/15 text-success"
                              : pct >= 75
                                ? "bg-warning/15 text-warning"
                                : "bg-destructive/15 text-destructive"
                          }
                        >
                          {pct}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <CalendarCheck className="h-3.5 w-3.5" /> Percentage counts present and late as attended.
      </div>
    </div>
  );
}
