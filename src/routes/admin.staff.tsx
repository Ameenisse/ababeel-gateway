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

export const Route = createFileRoute("/admin/staff")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Staff — Admin" }, { name: "robots", content: "noindex,nofollow" }],
  }),
  component: StaffPage,
});

type Staff = {
  id: string;
  user_id: string;
  staff_number: string;
  full_name: string;
  designation: string | null;
  phone: string | null;
  status: string;
  assigned_classes: string[] | null;
};

type Profile = {
  user_id: string;
  full_name: string;
  phone: string | null;
  account_status: string;
};

type ClassRow = { id: string; class_name: string };

function StaffPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<Staff> | null>(null);

  const staff = useQuery({
    queryKey: ["staff"],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff").select("*").order("full_name");
      if (error) throw error;
      return (data ?? []) as Staff[];
    },
  });

  const profiles = useQuery({
    queryKey: ["profiles_lite"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, phone, account_status");
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
  });

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

  const profileMap = useMemo(() => {
    const m = new Map<string, Profile>();
    (profiles.data ?? []).forEach((p) => m.set(p.user_id, p));
    return m;
  }, [profiles.data]);

  const classMap = useMemo(() => {
    const m = new Map<string, string>();
    (classes.data ?? []).forEach((c) => m.set(c.id, c.class_name));
    return m;
  }, [classes.data]);

  // profiles without a staff record yet, usable for creating a new staff link
  const availableProfiles = useMemo(() => {
    const staffUserIds = new Set((staff.data ?? []).map((s) => s.user_id));
    return (profiles.data ?? []).filter((p) => !staffUserIds.has(p.user_id));
  }, [profiles.data, staff.data]);

  const saveMut = useMutation({
    mutationFn: async (s: Partial<Staff>) => {
      const payload = {
        full_name: s.full_name!,
        designation: s.designation || null,
        phone: s.phone || null,
        status: s.status ?? "active",
        assigned_classes: s.assigned_classes ?? [],
      };
      if (s.id) {
        const { error } = await supabase.from("staff").update(payload).eq("id", s.id);
        if (error) throw error;
      } else {
        if (!s.user_id) throw new Error("Select a user account to link");
        const { error } = await supabase.from("staff").insert({ ...payload, user_id: s.user_id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff"] });
      setEditing(null);
      toast.success("Saved");
    },
    onError: (e: unknown) => toast.error((e as Error).message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("staff").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff"] });
      toast.success("Deleted");
    },
    onError: (e: unknown) => toast.error((e as Error).message),
  });

  const toggleClass = (classId: string) => {
    if (!editing) return;
    const current = editing.assigned_classes ?? [];
    const next = current.includes(classId)
      ? current.filter((c) => c !== classId)
      : [...current, classId];
    setEditing({ ...editing, assigned_classes: next });
  };

  return (
    <RoleShell role="admin" title="Staff">
      <div className="flex flex-col gap-4">
        <div className="flex justify-end">
          <Button onClick={() => setEditing({ status: "active", assigned_classes: [] })}>
            <Plus className="mr-1 h-4 w-4" /> New Staff
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            {staff.isLoading ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
            ) : (staff.data ?? []).length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">No staff yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Staff #</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Designation</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Account</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(staff.data ?? []).map((s) => {
                      const p = profileMap.get(s.user_id);
                      return (
                        <TableRow key={s.id}>
                          <TableCell className="font-mono text-xs">{s.staff_number}</TableCell>
                          <TableCell className="font-medium">{s.full_name}</TableCell>
                          <TableCell>{s.designation ?? "—"}</TableCell>
                          <TableCell>{s.phone ?? "—"}</TableCell>
                          <TableCell>
                            {p ? (
                              <Badge
                                className={
                                  p.account_status === "active"
                                    ? "bg-success/15 text-success"
                                    : "bg-destructive/15 text-destructive"
                                }
                              >
                                {p.account_status}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">No profile</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={
                                s.status === "active"
                                  ? "bg-success/15 text-success"
                                  : "bg-muted text-muted-foreground"
                              }
                            >
                              {s.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="flex justify-end gap-2 text-right">
                            <Button size="sm" variant="outline" onClick={() => setEditing(s)}>
                              <Pencil className="mr-1 h-4 w-4" /> Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                if (confirm(`Remove staff record for "${s.full_name}"?`))
                                  deleteMut.mutate(s.id);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
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
            <DialogTitle>{editing?.id ? "Edit" : "New"} staff member</DialogTitle>
            <DialogDescription>
              {editing?.id
                ? "Update staff details."
                : "Link an existing user account to a new staff record."}
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="grid gap-3">
              {!editing.id && (
                <div>
                  <Label>User account</Label>
                  <Select
                    value={editing.user_id ?? ""}
                    onValueChange={(v) => {
                      const p = profileMap.get(v);
                      setEditing({
                        ...editing,
                        user_id: v,
                        full_name: p?.full_name ?? editing.full_name,
                        phone: p?.phone ?? editing.phone,
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a user" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableProfiles.map((p) => (
                        <SelectItem key={p.user_id} value={p.user_id}>
                          {p.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label>Full name</Label>
                <Input
                  value={editing.full_name ?? ""}
                  onChange={(e) => setEditing({ ...editing, full_name: e.target.value })}
                />
              </div>
              <div>
                <Label>Designation</Label>
                <Input
                  value={editing.designation ?? ""}
                  onChange={(e) => setEditing({ ...editing, designation: e.target.value })}
                  placeholder="Teacher, Coordinator…"
                />
              </div>
              <div>
                <Label>Phone</Label>
                <Input
                  value={editing.phone ?? ""}
                  onChange={(e) => setEditing({ ...editing, phone: e.target.value })}
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
              <div>
                <Label>Assigned classes</Label>
                <div className="mt-1 flex flex-wrap gap-2">
                  {(classes.data ?? []).map((c) => {
                    const active = (editing.assigned_classes ?? []).includes(c.id);
                    return (
                      <Badge
                        key={c.id}
                        onClick={() => toggleClass(c.id)}
                        className={`cursor-pointer ${
                          active ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                        }`}
                      >
                        {c.class_name}
                      </Badge>
                    );
                  })}
                </div>
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
                if (!editing?.full_name) {
                  toast.error("Full name is required");
                  return;
                }
                if (!editing.id && !editing.user_id) {
                  toast.error("Select a user account to link");
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
