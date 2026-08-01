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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";

export const Route = createFileRoute("/admin/classes")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Classes — Admin" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: ClassesPage,
});

const CLASS_LEVELS = ["baby", "nursery", "lkg", "ukg", "ks1", "ks2_3"] as const;
type ClassLevel = (typeof CLASS_LEVELS)[number];

type ClassRow = {
  id: string;
  class_code: string;
  class_name: string;
  class_level: ClassLevel | null;
  teacher_id: string | null;
  assistant_teacher_id: string | null;
  session: string | null;
  room: string | null;
  maximum_students: number | null;
  status: string;
};

type Staff = { id: string; full_name: string };

function ClassesPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<ClassRow> | null>(null);

  const classes = useQuery({
    queryKey: ["classes_full"],
    queryFn: async () => {
      const { data, error } = await supabase.from("classes").select("*").order("class_name");
      if (error) throw error;
      return (data ?? []) as ClassRow[];
    },
  });

  const staff = useQuery({
    queryKey: ["staff_lite"],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff").select("id, full_name").order("full_name");
      if (error) throw error;
      return (data ?? []) as Staff[];
    },
  });

  const students = useQuery({
    queryKey: ["students_class_counts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("students").select("class_id");
      if (error) throw error;
      return (data ?? []) as { class_id: string | null }[];
    },
  });

  const staffMap = useMemo(() => {
    const m = new Map<string, string>();
    (staff.data ?? []).forEach((s) => m.set(s.id, s.full_name));
    return m;
  }, [staff.data]);

  const countByClass = useMemo(() => {
    const m = new Map<string, number>();
    (students.data ?? []).forEach((s) => {
      if (!s.class_id) return;
      m.set(s.class_id, (m.get(s.class_id) ?? 0) + 1);
    });
    return m;
  }, [students.data]);

  const saveMut = useMutation({
    mutationFn: async (c: Partial<ClassRow>) => {
      const payload = {
        class_code: c.class_code!,
        class_name: c.class_name!,
        class_level: c.class_level ?? null,
        teacher_id: c.teacher_id || null,
        assistant_teacher_id: c.assistant_teacher_id || null,
        session: c.session || null,
        room: c.room || null,
        maximum_students: c.maximum_students ?? null,
        status: c.status ?? "active",
      };
      if (c.id) {
        const { error } = await supabase.from("classes").update(payload).eq("id", c.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("classes").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["classes_full"] });
      qc.invalidateQueries({ queryKey: ["classes_lite"] });
      setEditing(null);
      toast.success("Saved");
    },
    onError: (e: unknown) => toast.error((e as Error).message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("classes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["classes_full"] });
      toast.success("Deleted");
    },
    onError: (e: unknown) => toast.error((e as Error).message),
  });

  return (
    <RoleShell role="admin" title="Classes">
      <div className="flex flex-col gap-4">
        <div className="flex justify-end">
          <Button onClick={() => setEditing({ status: "active" })}>
            <Plus className="mr-1 h-4 w-4" /> New Class
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            {classes.isLoading ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
            ) : (classes.data ?? []).length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">No classes yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Level</TableHead>
                      <TableHead>Teacher</TableHead>
                      <TableHead>Session</TableHead>
                      <TableHead>Students</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(classes.data ?? []).map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-mono text-xs">{c.class_code}</TableCell>
                        <TableCell className="font-medium">{c.class_name}</TableCell>
                        <TableCell>{c.class_level ?? "—"}</TableCell>
                        <TableCell>{c.teacher_id ? staffMap.get(c.teacher_id) ?? "—" : "—"}</TableCell>
                        <TableCell>{c.session ?? "—"}</TableCell>
                        <TableCell>
                          {countByClass.get(c.id) ?? 0}
                          {c.maximum_students ? ` / ${c.maximum_students}` : ""}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={
                              c.status === "active"
                                ? "bg-success/15 text-success"
                                : "bg-muted text-muted-foreground"
                            }
                          >
                            {c.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="flex justify-end gap-2 text-right">
                          <Button size="sm" variant="outline" onClick={() => setEditing(c)}>
                            <Pencil className="mr-1 h-4 w-4" /> Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              if (confirm(`Delete class "${c.class_name}"?`)) deleteMut.mutate(c.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit" : "New"} class</DialogTitle>
            <DialogDescription>Configure class details and staffing.</DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Class code</Label>
                <Input
                  value={editing.class_code ?? ""}
                  onChange={(e) => setEditing({ ...editing, class_code: e.target.value })}
                />
              </div>
              <div>
                <Label>Class name</Label>
                <Input
                  value={editing.class_name ?? ""}
                  onChange={(e) => setEditing({ ...editing, class_name: e.target.value })}
                />
              </div>
              <div>
                <Label>Level</Label>
                <Select
                  value={editing.class_level ?? "none"}
                  onValueChange={(v) =>
                    setEditing({ ...editing, class_level: v === "none" ? null : (v as ClassLevel) })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {CLASS_LEVELS.map((l) => (
                      <SelectItem key={l} value={l}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Session</Label>
                <Input
                  value={editing.session ?? ""}
                  onChange={(e) => setEditing({ ...editing, session: e.target.value })}
                  placeholder="Morning / Afternoon"
                />
              </div>
              <div>
                <Label>Teacher</Label>
                <Select
                  value={editing.teacher_id ?? "none"}
                  onValueChange={(v) => setEditing({ ...editing, teacher_id: v === "none" ? null : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select teacher" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
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
                  value={editing.assistant_teacher_id ?? "none"}
                  onValueChange={(v) =>
                    setEditing({ ...editing, assistant_teacher_id: v === "none" ? null : v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select assistant" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {(staff.data ?? []).map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Room</Label>
                <Input
                  value={editing.room ?? ""}
                  onChange={(e) => setEditing({ ...editing, room: e.target.value })}
                />
              </div>
              <div>
                <Label>Maximum students</Label>
                <Input
                  type="number"
                  value={editing.maximum_students ?? ""}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      maximum_students: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                />
              </div>
              <div>
                <Label>Status</Label>
                <Select
                  value={editing.status ?? "active"}
                  onValueChange={(v) => setEditing({ ...editing, status: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
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
                if (!editing?.class_code || !editing.class_name) {
                  toast.error("Class code and name are required");
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
