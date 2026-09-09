import { createFileRoute, Link } from "@tanstack/react-router";
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
import { FileText, Search } from "lucide-react";

export const Route = createFileRoute("/admin/students")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Students — Admin" }, { name: "robots", content: "noindex,nofollow" }],
  }),
  component: StudentsPage,
});

type Student = {
  id: string;
  student_number: string;
  full_name: string;
  date_of_birth: string;
  gender: string;
  identity_number: string | null;
  guardian_name: string | null;
  guardian_identity_number: string | null;
  mobile: string | null;
  alternative_mobile: string | null;
  address: string | null;
  island: string | null;
  atoll: string | null;
  class_id: string | null;
  session: string | null;
  admission_date: string | null;
  status: string;
  photo_url: string | null;
};

type ClassRow = { id: string; class_name: string };

const statusBadge = (s: string) => {
  const map: Record<string, string> = {
    active: "bg-success/15 text-success",
    inactive: "bg-muted text-muted-foreground",
    graduated: "bg-info/15 text-info",
    suspended: "bg-destructive/15 text-destructive",
  };
  return <Badge className={map[s] ?? "bg-muted text-foreground"}>{s}</Badge>;
};

function StudentsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [editing, setEditing] = useState<Partial<Student> | null>(null);

  const classes = useQuery({
    queryKey: ["classes_lite"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classes")
        .select("id, class_name")
        .order("class_name");
      if (error) throw error;
      return (data ?? []) as ClassRow[];
    },
  });

  const students = useQuery({
    queryKey: ["students"],
    queryFn: async () => {
      const { data, error } = await supabase.from("students").select("*").order("full_name");
      if (error) throw error;
      return (data ?? []) as Student[];
    },
  });

  const classMap = useMemo(() => {
    const m = new Map<string, string>();
    (classes.data ?? []).forEach((c) => m.set(c.id, c.class_name));
    return m;
  }, [classes.data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (students.data ?? []).filter((s) => {
      if (classFilter !== "all" && s.class_id !== classFilter) return false;
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      if (!q) return true;
      return (
        s.full_name.toLowerCase().includes(q) ||
        s.student_number.toLowerCase().includes(q) ||
        (s.mobile ?? "").toLowerCase().includes(q)
      );
    });
  }, [students.data, search, classFilter, statusFilter]);

  const saveMut = useMutation({
    mutationFn: async (s: Partial<Student>) => {
      if (!s.id) throw new Error("Missing student id");
      const { error } = await supabase
        .from("students")
        .update({
          full_name: s.full_name,
          date_of_birth: s.date_of_birth,
          gender: s.gender,
          identity_number: s.identity_number || null,
          guardian_name: s.guardian_name || null,
          guardian_identity_number: s.guardian_identity_number || null,
          mobile: s.mobile || null,
          alternative_mobile: s.alternative_mobile || null,
          address: s.address || null,
          island: s.island || null,
          atoll: s.atoll || null,
          class_id: s.class_id || null,
          session: s.session || null,
          admission_date: s.admission_date || null,
          status: s.status,
          photo_url: s.photo_url || null,
        })
        .eq("id", s.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["students"] });
      setEditing(null);
      toast.success("Student updated");
    },
    onError: (e: unknown) => toast.error((e as Error).message),
  });

  return (
    <RoleShell role="admin" title="Students">
      <div className="flex flex-col gap-4">
        <Card>
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Search by name, student number or mobile…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={classFilter} onValueChange={setClassFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Class" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All classes</SelectItem>
                {(classes.data ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.class_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="graduated">Graduated</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            {students.isLoading ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No students match your filters.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student #</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead>Mobile</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-mono text-xs">{s.student_number}</TableCell>
                        <TableCell className="font-medium">{s.full_name}</TableCell>
                        <TableCell>
                          {s.class_id ? (classMap.get(s.class_id) ?? "—") : "—"}
                        </TableCell>
                        <TableCell>{s.mobile ?? "—"}</TableCell>
                        <TableCell>{statusBadge(s.status)}</TableCell>
                        <TableCell className="flex flex-wrap justify-end gap-2 text-right">
                          <Button size="sm" variant="outline" onClick={() => setEditing(s)}>
                            Edit
                          </Button>
                          <Button size="sm" variant="ghost" asChild>
                            <Link to="/staff/term-report/$studentId" params={{ studentId: s.id }}>
                              <FileText className="mr-1 h-4 w-4" /> Report
                            </Link>
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
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit student</DialogTitle>
            <DialogDescription>Update the student's profile details.</DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Full name</Label>
                <Input
                  value={editing.full_name ?? ""}
                  onChange={(e) => setEditing({ ...editing, full_name: e.target.value })}
                />
              </div>
              <div>
                <Label>Date of birth</Label>
                <Input
                  type="date"
                  value={editing.date_of_birth ?? ""}
                  onChange={(e) => setEditing({ ...editing, date_of_birth: e.target.value })}
                />
              </div>
              <div>
                <Label>Gender</Label>
                <Select
                  value={editing.gender ?? ""}
                  onValueChange={(v) => setEditing({ ...editing, gender: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Identity number</Label>
                <Input
                  value={editing.identity_number ?? ""}
                  onChange={(e) => setEditing({ ...editing, identity_number: e.target.value })}
                />
              </div>
              <div>
                <Label>Guardian name</Label>
                <Input
                  value={editing.guardian_name ?? ""}
                  onChange={(e) => setEditing({ ...editing, guardian_name: e.target.value })}
                />
              </div>
              <div>
                <Label>Guardian identity number</Label>
                <Input
                  value={editing.guardian_identity_number ?? ""}
                  onChange={(e) =>
                    setEditing({ ...editing, guardian_identity_number: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Mobile</Label>
                <Input
                  value={editing.mobile ?? ""}
                  onChange={(e) => setEditing({ ...editing, mobile: e.target.value })}
                />
              </div>
              <div>
                <Label>Alternative mobile</Label>
                <Input
                  value={editing.alternative_mobile ?? ""}
                  onChange={(e) => setEditing({ ...editing, alternative_mobile: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Address</Label>
                <Input
                  value={editing.address ?? ""}
                  onChange={(e) => setEditing({ ...editing, address: e.target.value })}
                />
              </div>
              <div>
                <Label>Island</Label>
                <Input
                  value={editing.island ?? ""}
                  onChange={(e) => setEditing({ ...editing, island: e.target.value })}
                />
              </div>
              <div>
                <Label>Atoll</Label>
                <Input
                  value={editing.atoll ?? ""}
                  onChange={(e) => setEditing({ ...editing, atoll: e.target.value })}
                />
              </div>
              <div>
                <Label>Class</Label>
                <Select
                  value={editing.class_id ?? "none"}
                  onValueChange={(v) =>
                    setEditing({ ...editing, class_id: v === "none" ? null : v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select class" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {(classes.data ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.class_name}
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
                <Label>Admission date</Label>
                <Input
                  type="date"
                  value={editing.admission_date ?? ""}
                  onChange={(e) => setEditing({ ...editing, admission_date: e.target.value })}
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
                    <SelectItem value="graduated">Graduated</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label>Photo URL</Label>
                <Input
                  value={editing.photo_url ?? ""}
                  onChange={(e) => setEditing({ ...editing, photo_url: e.target.value })}
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
                if (!editing?.full_name || !editing.date_of_birth || !editing.gender) {
                  toast.error("Full name, date of birth and gender are required");
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
