import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
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
import { Megaphone, Plus, Pencil, Trash2 } from "lucide-react";

export const Route = createFileRoute("/admin/announcements")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Announcements — Admin" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AnnouncementsPage,
});

type Announcement = {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  audience: string;
  audience_reference: string | null;
  priority: string;
  publish_date: string | null;
  expiry_date: string | null;
  status: string;
};

const AUDIENCES = ["all", "students", "staff", "parents", "class"];
const PRIORITIES = ["low", "normal", "high", "urgent"];
const STATUSES = ["draft", "published", "archived"];

const statusBadge = (s: string) => {
  const map: Record<string, string> = {
    draft: "bg-muted text-foreground",
    published: "bg-success/15 text-success",
    archived: "bg-muted text-muted-foreground",
  };
  return <Badge className={map[s] ?? "bg-muted text-foreground"}>{s}</Badge>;
};

const priorityBadge = (p: string) => {
  const map: Record<string, string> = {
    low: "bg-muted text-muted-foreground",
    normal: "bg-info/15 text-info",
    high: "bg-warning/15 text-warning",
    urgent: "bg-destructive/15 text-destructive",
  };
  return <Badge className={map[p] ?? "bg-muted text-foreground"}>{p}</Badge>;
};

function AnnouncementsPage() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const announcements = useQuery({
    queryKey: ["announcements", statusFilter],
    queryFn: async () => {
      let q = supabase.from("announcements").select("*").order("publish_date", { ascending: false });
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Announcement[];
    },
  });

  const [editing, setEditing] = useState<null | Partial<Announcement>>(null);

  const saveMut = useMutation({
    mutationFn: async (a: Partial<Announcement>) => {
      const { data: sess } = await supabase.auth.getUser();
      const payload = {
        title: a.title!,
        description: a.description ?? null,
        image_url: a.image_url ?? null,
        audience: a.audience ?? "all",
        audience_reference: a.audience_reference ?? null,
        priority: a.priority ?? "normal",
        publish_date: a.publish_date || null,
        expiry_date: a.expiry_date || null,
        status: a.status ?? "draft",
      };
      if (a.id) {
        const { error } = await supabase.from("announcements").update(payload).eq("id", a.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("announcements")
          .insert({ ...payload, created_by: sess.user?.id ?? null });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["announcements"] });
      setEditing(null);
      toast.success("Saved");
    },
    onError: (e: unknown) => toast.error((e as Error).message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("announcements").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["announcements"] });
      toast.success("Deleted");
    },
    onError: (e: unknown) => toast.error((e as Error).message),
  });

  return (
    <RoleShell role="admin" title="Announcements">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Label className="text-xs uppercase text-muted-foreground">Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={() => setEditing({ audience: "all", priority: "normal", status: "draft" })}
          >
            <Plus className="mr-1 h-4 w-4" /> New Announcement
          </Button>
        </div>

        {announcements.isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
        ) : (announcements.data ?? []).length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              No announcements yet.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {(announcements.data ?? []).map((a) => (
              <Card key={a.id}>
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Megaphone className="h-4 w-4 text-primary" />
                      <span className="font-display text-base font-semibold">{a.title}</span>
                      {statusBadge(a.status)}
                      {priorityBadge(a.priority)}
                    </div>
                    {a.description && (
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{a.description}</p>
                    )}
                    <div className="mt-1 text-xs text-muted-foreground">
                      Audience: {a.audience}
                      {a.audience_reference ? ` (${a.audience_reference})` : ""} · Publish:{" "}
                      {a.publish_date ?? "—"} · Expiry: {a.expiry_date ?? "—"}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => setEditing(a)}>
                      <Pencil className="mr-1 h-4 w-4" /> Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (confirm(`Delete "${a.title}"?`)) deleteMut.mutate(a.id);
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

        <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing?.id ? "Edit" : "New"} announcement</DialogTitle>
            </DialogHeader>
            {editing && (
              <div className="grid gap-3">
                <div>
                  <Label>Title</Label>
                  <Input
                    value={editing.title ?? ""}
                    onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea
                    rows={3}
                    value={editing.description ?? ""}
                    onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Image URL</Label>
                  <Input
                    value={editing.image_url ?? ""}
                    onChange={(e) => setEditing({ ...editing, image_url: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Audience</Label>
                    <Select
                      value={editing.audience ?? "all"}
                      onValueChange={(v) => setEditing({ ...editing, audience: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {AUDIENCES.map((a) => (
                          <SelectItem key={a} value={a}>
                            {a}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Audience reference</Label>
                    <Input
                      placeholder="e.g. class id/name"
                      value={editing.audience_reference ?? ""}
                      onChange={(e) => setEditing({ ...editing, audience_reference: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Priority</Label>
                    <Select
                      value={editing.priority ?? "normal"}
                      onValueChange={(v) => setEditing({ ...editing, priority: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PRIORITIES.map((p) => (
                          <SelectItem key={p} value={p}>
                            {p}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Status</Label>
                    <Select
                      value={editing.status ?? "draft"}
                      onValueChange={(v) => setEditing({ ...editing, status: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Publish date</Label>
                    <Input
                      type="date"
                      value={editing.publish_date ?? ""}
                      onChange={(e) => setEditing({ ...editing, publish_date: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Expiry date</Label>
                    <Input
                      type="date"
                      value={editing.expiry_date ?? ""}
                      onChange={(e) => setEditing({ ...editing, expiry_date: e.target.value })}
                    />
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
                  if (!editing?.title) {
                    toast.error("Title is required");
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
      </div>
    </RoleShell>
  );
}
