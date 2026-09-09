import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { RoleShell } from "@/components/role-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Search } from "lucide-react";

export const Route = createFileRoute("/admin/users")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Users & Roles — Admin" }, { name: "robots", content: "noindex,nofollow" }],
  }),
  component: UsersPage,
});

type Profile = {
  id: string;
  user_id: string;
  full_name: string;
  phone: string | null;
  account_status: string;
};

type UserRole = { id: string; user_id: string; role: "admin" | "staff" | "student" };

const ROLES: UserRole["role"][] = ["admin", "staff", "student"];

function UsersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  const profiles = useQuery({
    queryKey: ["profiles_all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, user_id, full_name, phone, account_status")
        .order("full_name");
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
  });

  const roles = useQuery({
    queryKey: ["user_roles_all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("*");
      if (error) throw error;
      return (data ?? []) as UserRole[];
    },
  });

  const rolesByUser = useMemo(() => {
    const m = new Map<string, UserRole[]>();
    (roles.data ?? []).forEach((r) => {
      const arr = m.get(r.user_id) ?? [];
      arr.push(r);
      m.set(r.user_id, arr);
    });
    return m;
  }, [roles.data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return profiles.data ?? [];
    return (profiles.data ?? []).filter(
      (p) => p.full_name.toLowerCase().includes(q) || (p.phone ?? "").toLowerCase().includes(q),
    );
  }, [profiles.data, search]);

  const setRoleMut = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: UserRole["role"] }) => {
      const existing = rolesByUser.get(userId) ?? [];
      const toRemove = existing.filter((r) => r.role !== role);
      for (const r of toRemove) {
        const { error } = await supabase.from("user_roles").delete().eq("id", r.id);
        if (error) throw error;
      }
      if (!existing.some((r) => r.role === role)) {
        const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user_roles_all"] });
      toast.success("Role updated");
    },
    onError: (e: unknown) => toast.error((e as Error).message),
  });

  const toggleStatusMut = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ account_status: status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profiles_all"] });
      toast.success("Account status updated");
    },
    onError: (e: unknown) => toast.error((e as Error).message),
  });

  return (
    <RoleShell role="admin" title="Users & Roles">
      <div className="flex flex-col gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Search by name or phone…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            {profiles.isLoading ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">No users found.</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Active</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((p) => {
                      const userRoles = rolesByUser.get(p.user_id) ?? [];
                      const currentRole = userRoles[0]?.role ?? "";
                      return (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">{p.full_name}</TableCell>
                          <TableCell>{p.phone ?? "—"}</TableCell>
                          <TableCell>
                            <Select
                              value={currentRole}
                              onValueChange={(v) =>
                                setRoleMut.mutate({
                                  userId: p.user_id,
                                  role: v as UserRole["role"],
                                })
                              }
                            >
                              <SelectTrigger className="w-36">
                                <SelectValue placeholder="No role" />
                              </SelectTrigger>
                              <SelectContent>
                                {ROLES.map((r) => (
                                  <SelectItem key={r} value={r}>
                                    {r}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={p.account_status === "active"}
                                onCheckedChange={(checked) =>
                                  toggleStatusMut.mutate({
                                    id: p.id,
                                    status: checked ? "active" : "suspended",
                                  })
                                }
                              />
                              <Badge
                                className={
                                  p.account_status === "active"
                                    ? "bg-success/15 text-success"
                                    : "bg-destructive/15 text-destructive"
                                }
                              >
                                {p.account_status}
                              </Badge>
                            </div>
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
    </RoleShell>
  );
}
