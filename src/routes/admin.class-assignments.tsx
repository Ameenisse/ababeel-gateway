import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { RoleShell } from "@/components/role-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, School, Star, Trash2, History } from "lucide-react";

export const Route = createFileRoute("/admin/class-assignments")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Class Assignments — Admin" }, { name: "robots", content: "noindex,nofollow" }],
  }),
  component: ClassAssignmentsPage,
});

type Student = {
  id: string;
  student_number: string;
  full_name: string;
  class_id: string | null;
};
type ClassRow = { id: string; class_name: string; session: string | null };
type Staff = { id: string; full_name: string };
type Year = { id: string; year_name: string; is_current: boolean };
type Term = { id: string; term_name: string; academic_year_id: string };

type Assignment = {
  id: string;
  student_id: string;
  academic_year_id: string;
  term_id: string | null;
  class_id: string;
  session: string | null;
  main_teacher_id: string | null;
  assistant_teacher_id: string | null;
  is_current: boolean;
  assigned_at: string;
  notes: string | null;
};

function ClassAssignmentsPage() {
  const qc = useQueryClient();

  const [studentQuery, setStudentQuery] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  const students = useQuery({
    queryKey: ["students_active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("id,student_number,full_name,class_id")
        .eq("status", "active")
        .order("full_name");
      if (error) throw error;
      return (data ?? []) as Student[];
    },
  });

  const classes = useQuery({
    queryKey: ["classes_active_all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classes")
        .select("id,class_name,session")
        .eq("status", "active")
        .order("class_name");
      if (error) throw error;
      return (data ?? []) as ClassRow[];
    },
  });

  const staff = useQuery({
    queryKey: ["staff_all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff")
        .select("id,full_name")
        .order("full_name");
      if (error) throw error;
      return (data ?? []) as Staff[];
    },
  });

  const years = useQuery({
    queryKey: ["academic_years"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("academic_years")
        .select("id,year_name,is_current")
        .order("start_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Year[];
    },
  });

  const terms = useQuery({
    queryKey: ["academic_terms_all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("academic_terms")
        .select("id,term_name,academic_year_id")
        .order("term_sequence");
      if (error) throw error;
      return (data ?? []) as Term[];
    },
  });

  const assignments = useQuery({
    queryKey: ["assignments", selectedStudentId],
    enabled: !!selectedStudentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("student_class_assignments")
        .select("*")
        .eq("student_id", selectedStudentId!)
        .order("assigned_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Assignment[];
    },
  });

  const filteredStudents = useMemo(() => {
    const q = studentQuery.trim().toLowerCase();
    const rows = students.data ?? [];
    if (!q) return rows.slice(0, 60);
    return rows
      .filter(
        (s) => s.full_name.toLowerCase().includes(q) || s.student_number.toLowerCase().includes(q),
      )
      .slice(0, 60);
  }, [students.data, studentQuery]);

  const selectedStudent = students.data?.find((s) => s.id === selectedStudentId) ?? null;

  const [editing, setEditing] = useState<null | Partial<Assignment>>(null);

  const saveMut = useMutation({
    mutationFn: async (a: Partial<Assignment>) => {
      if (!selectedStudentId) throw new Error("No student selected");
      const payload = {
        student_id: selectedStudentId,
        academic_year_id: a.academic_year_id!,
        term_id: a.term_id || null,
        class_id: a.class_id!,
        session: a.session || null,
        main_teacher_id: a.main_teacher_id || null,
        assistant_teacher_id: a.assistant_teacher_id || null,
        is_current: !!a.is_current,
        notes: a.notes ?? null,
      };
      if (payload.is_current) {
        // clear other current rows for this student
        const { error: e0 } = await supabase
          .from("student_class_assignments")
          .update({ is_current: false })
          .eq("student_id", selectedStudentId)
          .neq("id", a.id ?? "00000000-0000-0000-0000-000000000000");
        if (e0) throw e0;
      }
      if (a.id) {
        const { error } = await supabase
          .from("student_class_assignments")
          .update(payload)
          .eq("id", a.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("student_class_assignments").insert(payload);
        if (error) throw error;
      }
      // If current, mirror onto student's primary class_id too
      if (payload.is_current) {
        await supabase
          .from("students")
          .update({ class_id: payload.class_id, session: payload.session })
          .eq("id", selectedStudentId);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assignments", selectedStudentId] });
      qc.invalidateQueries({ queryKey: ["students_active"] });
      setEditing(null);
      toast.success("Saved");
    },
    onError: (e: unknown) => toast.error((e as Error).message),
  });

  const setCurrentMut = useMutation({
    mutationFn: async (row: Assignment) => {
      const { error: e0 } = await supabase
        .from("student_class_assignments")
        .update({ is_current: false })
        .eq("student_id", row.student_id);
      if (e0) throw e0;
      const { error } = await supabase
        .from("student_class_assignments")
        .update({ is_current: true })
        .eq("id", row.id);
      if (error) throw error;
      await supabase
        .from("students")
        .update({ class_id: row.class_id, session: row.session })
        .eq("id", row.student_id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assignments", selectedStudentId] });
      qc.invalidateQueries({ queryKey: ["students_active"] });
      toast.success("Set as current");
    },
    onError: (e: unknown) => toast.error((e as Error).message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("student_class_assignments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assignments", selectedStudentId] });
      toast.success("Deleted");
    },
    onError: (e: unknown) => toast.error((e as Error).message),
  });

  const yearName = (id: string) => years.data?.find((y) => y.id === id)?.year_name ?? "—";
  const termName = (id: string | null) =>
    id ? (terms.data?.find((t) => t.id === id)?.term_name ?? "—") : "—";
  const className = (id: string) => classes.data?.find((c) => c.id === id)?.class_name ?? "—";
  const staffName = (id: string | null) =>
    id ? (staff.data?.find((s) => s.id === id)?.full_name ?? "—") : "—";

  const currentYear = years.data?.find((y) => y.is_current);

  const filteredTermsForEditor = useMemo(() => {
    if (!editing?.academic_year_id) return [] as Term[];
    return (terms.data ?? []).filter((t) => t.academic_year_id === editing.academic_year_id);
  }, [terms.data, editing?.academic_year_id]);

  return (
    <RoleShell role="admin" title="Class Assignments">
      <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
        {/* Student picker */}
        <Card className="h-fit">
          <CardContent className="p-3">
            <Input
              placeholder="Search student by name or #…"
              value={studentQuery}
              onChange={(e) => setStudentQuery(e.target.value)}
            />
            <div className="mt-3 flex max-h-[70vh] flex-col gap-1 overflow-auto">
              {filteredStudents.map((s) => {
                const active = s.id === selectedStudentId;
                return (
                  <button
                    key={s.id}
                    onClick={() => setSelectedStudentId(s.id)}
                    className={
                      "flex items-center justify-between rounded-md px-2 py-2 text-left text-sm hover:bg-muted " +
                      (active ? "bg-primary/10 text-primary" : "")
                    }
                  >
                    <span className="truncate">{s.full_name}</span>
                    <span className="ml-2 shrink-0 font-mono text-[10px] text-muted-foreground">
                      {s.student_number}
                    </span>
                  </button>
                );
              })}
              {filteredStudents.length === 0 && (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  No students match.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Assignments panel */}
        <div className="flex flex-col gap-3">
          {!selectedStudent ? (
            <Card>
              <CardContent className="p-8 text-center text-sm text-muted-foreground">
                Select a student to view and manage their class assignments.
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2">
                    <School className="h-5 w-5 text-primary" />
                    <div>
                      <div className="font-display text-base font-semibold">
                        {selectedStudent.full_name}
                      </div>
                      <div className="font-mono text-xs text-muted-foreground">
                        {selectedStudent.student_number}
                      </div>
                    </div>
                  </div>
                  <Button
                    onClick={() =>
                      setEditing({
                        academic_year_id: currentYear?.id ?? years.data?.[0]?.id,
                        is_current: true,
                      })
                    }
                  >
                    <Plus className="mr-1 h-4 w-4" /> New Assignment
                  </Button>
                </CardContent>
              </Card>

              {assignments.isLoading ? (
                <div className="p-6 text-center text-sm text-muted-foreground">Loading…</div>
              ) : (assignments.data ?? []).length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center text-sm text-muted-foreground">
                    No assignments yet for this student.
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-3">
                  {(assignments.data ?? []).map((a) => (
                    <Card key={a.id}>
                      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-display font-semibold">
                              {className(a.class_id)}
                            </span>
                            {a.session && (
                              <span className="text-xs text-muted-foreground">· {a.session}</span>
                            )}
                            {a.is_current ? (
                              <Badge className="bg-primary text-primary-foreground">Current</Badge>
                            ) : (
                              <Badge variant="outline">
                                <History className="mr-1 h-3 w-3" /> Past
                              </Badge>
                            )}
                          </div>
                          <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-muted-foreground sm:grid-cols-4">
                            <span>Year: {yearName(a.academic_year_id)}</span>
                            <span>Term: {termName(a.term_id)}</span>
                            <span>Main: {staffName(a.main_teacher_id)}</span>
                            <span>Assistant: {staffName(a.assistant_teacher_id)}</span>
                          </div>
                          {a.notes && (
                            <div className="mt-1 text-xs text-muted-foreground">{a.notes}</div>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {!a.is_current && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setCurrentMut.mutate(a)}
                              disabled={setCurrentMut.isPending}
                            >
                              <Star className="mr-1 h-4 w-4" /> Set current
                            </Button>
                          )}
                          <Button size="sm" variant="outline" onClick={() => setEditing(a)}>
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              if (confirm("Delete this assignment?")) deleteMut.mutate(a.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Editor */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit" : "New"} class assignment</DialogTitle>
            <DialogDescription>{selectedStudent?.full_name}</DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Academic year</Label>
                  <Select
                    value={editing.academic_year_id ?? ""}
                    onValueChange={(v) =>
                      setEditing({ ...editing, academic_year_id: v, term_id: null })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose…" />
                    </SelectTrigger>
                    <SelectContent>
                      {(years.data ?? []).map((y) => (
                        <SelectItem key={y.id} value={y.id}>
                          {y.year_name}
                          {y.is_current ? " · current" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Term</Label>
                  <Select
                    value={editing.term_id ?? ""}
                    onValueChange={(v) => setEditing({ ...editing, term_id: v })}
                    disabled={!editing.academic_year_id}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Optional" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredTermsForEditor.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.term_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Class</Label>
                  <Select
                    value={editing.class_id ?? ""}
                    onValueChange={(v) => setEditing({ ...editing, class_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose class…" />
                    </SelectTrigger>
                    <SelectContent>
                      {(classes.data ?? []).map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.class_name}
                          {c.session ? ` · ${c.session}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Session</Label>
                  <Input
                    placeholder="Morning / Evening / …"
                    value={editing.session ?? ""}
                    onChange={(e) => setEditing({ ...editing, session: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Main teacher</Label>
                  <Select
                    value={editing.main_teacher_id ?? ""}
                    onValueChange={(v) => setEditing({ ...editing, main_teacher_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Optional" />
                    </SelectTrigger>
                    <SelectContent>
                      {(staff.data ?? []).map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Assistant teacher</Label>
                  <Select
                    value={editing.assistant_teacher_id ?? ""}
                    onValueChange={(v) => setEditing({ ...editing, assistant_teacher_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Optional" />
                    </SelectTrigger>
                    <SelectContent>
                      {(staff.data ?? []).map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!editing.is_current}
                  onChange={(e) => setEditing({ ...editing, is_current: e.target.checked })}
                />
                Mark as current (unsets any other current assignment)
              </label>
              <div>
                <Label>Notes</Label>
                <Textarea
                  rows={2}
                  value={editing.notes ?? ""}
                  onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              disabled={saveMut.isPending}
              onClick={() => {
                if (!editing?.academic_year_id || !editing.class_id) {
                  toast.error("Academic year and class are required");
                  return;
                }
                saveMut.mutate(editing);
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </RoleShell>
  );
}
