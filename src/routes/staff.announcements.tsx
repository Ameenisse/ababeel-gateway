import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { RoleShell } from "@/components/role-shell";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil } from "lucide-react";

export const Route = createFileRoute("/staff/announcements")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Announcements — Staff" }, { name: "robots", content: "noindex,nofollow" }],
  }),
  component: Page,
});

type Announcement = {
  id: string;
  title: string;
  description: string | null;
  audience: string;
  priority: string;
  publish_date: string | null;
  expiry_date: string | null;
  status: string;
  created_by: string | null;
};

const empty = {
  title: "",
  description: "",
  audience: "staff",
  priority: "normal",
  publish_date: "",
  expiry_date: "",
  status: "draft",
};

function Page() {
  const [rows, setRows] = useState<Announcement[]>([]);
  const [uid, setUid] = useState<string | null>(null);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [form, setForm] = useState(empty);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("announcements")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error(error.message);
      return;
    }
    setRows((data ?? []) as Announcement[]);
  }, []);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setUid(data.user?.id ?? null);
    })();
    load();
  }, [load]);

  function openNew() {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  }

  function openEdit(a: Announcement) {
    setEditing(a);
    setForm({
      title: a.title,
      description: a.description ?? "",
      audience: a.audience,
      priority: a.priority,
      publish_date: a.publish_date ?? "",
      expiry_date: a.expiry_date ?? "",
      status: a.status,
    });
    setOpen(true);
  }

  async function submit() {
    if (!form.title.trim()) {
      toast.error("Title required");
      return;
    }
    try {
      const payload = {
        title: form.title,
        description: form.description || null,
        audience: form.audience,
        priority: form.priority,
        publish_date: form.publish_date || null,
        expiry_date: form.expiry_date || null,
        status: form.status,
      };
      if (editing) {
        const { error } = await supabase.from("announcements").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast.success("Announcement updated");
      } else {
        const { error } = await supabase
          .from("announcements")
          .insert([{ ...payload, created_by: uid }]);
        if (error) throw error;
        toast.success("Announcement created");
      }
      setOpen(false);
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    }
  }

  return (
    <RoleShell role="staff" title="Announcements">
      <div className="mb-3 flex justify-end">
        <Button size="sm" onClick={openNew}>
          <Plus className="h-4 w-4 mr-1" />
          New announcement
        </Button>
      </div>
      <div className="space-y-2">
        {rows.map((a) => (
          <Card key={a.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base">
                <span>{a.title}</span>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{a.audience}</Badge>
                  <Badge variant={a.priority === "high" ? "destructive" : "secondary"}>
                    {a.priority}
                  </Badge>
                  <Badge variant="outline">{a.status}</Badge>
                  {a.created_by === uid && (
                    <Button size="icon" variant="ghost" onClick={() => openEdit(a)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardTitle>
            </CardHeader>
            {a.description && (
              <CardContent className="text-sm text-muted-foreground">{a.description}</CardContent>
            )}
          </Card>
        ))}
        {rows.length === 0 && (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              No announcements yet.
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit announcement" : "New announcement"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Title</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Audience</Label>
                <Select
                  value={form.audience}
                  onValueChange={(v) => setForm({ ...form, audience: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="staff">Staff</SelectItem>
                    <SelectItem value="students">Students</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Priority</Label>
                <Select
                  value={form.priority}
                  onValueChange={(v) => setForm({ ...form, priority: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Publish date</Label>
                <Input
                  type="date"
                  value={form.publish_date}
                  onChange={(e) => setForm({ ...form, publish_date: e.target.value })}
                />
              </div>
              <div>
                <Label>Expiry date</Label>
                <Input
                  type="date"
                  value={form.expiry_date}
                  onChange={(e) => setForm({ ...form, expiry_date: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </RoleShell>
  );
}
