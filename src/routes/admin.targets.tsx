import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { RoleShell } from "@/components/role-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/targets")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Targets & Badges — Ababeel Quran Class" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: TargetsPage,
});

type Category = {
  id: string;
  name: string;
  description: string | null;
  weight_percent: number;
  color: string | null;
  sort_order: number;
  is_active: boolean;
};

type Target = {
  id: string;
  category_id: string;
  code: string | null;
  title: string;
  description: string | null;
  unit: string | null;
  max_value: number | null;
  term_scope: "term1" | "term2" | "both";
  sort_order: number;
  is_active: boolean;
};

type BadgeRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  is_active: boolean;
};

function TargetsPage() {
  return (
    <RoleShell role="admin" title="Targets & Badges">
      <Tabs defaultValue="categories" className="w-full">
        <TabsList>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="targets">Targets</TabsTrigger>
          <TabsTrigger value="badges">Badges</TabsTrigger>
        </TabsList>
        <TabsContent value="categories" className="mt-4">
          <CategoriesTab />
        </TabsContent>
        <TabsContent value="targets" className="mt-4">
          <TargetsTab />
        </TabsContent>
        <TabsContent value="badges" className="mt-4">
          <BadgesTab />
        </TabsContent>
      </Tabs>
    </RoleShell>
  );
}

/* ------------------------- Categories ------------------------- */
function CategoriesTab() {
  const qc = useQueryClient();
  const { data: items = [] } = useQuery({
    queryKey: ["target_categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("target_categories")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Category[];
    },
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);

  function startNew() {
    setEditing({
      id: "",
      name: "",
      description: "",
      weight_percent: 0,
      color: "#3b82f6",
      sort_order: items.length,
      is_active: true,
    } as Category);
    setOpen(true);
  }

  const totalWeight = items
    .filter((i) => i.is_active)
    .reduce((s, i) => s + Number(i.weight_percent || 0), 0);

  const save = useMutation({
    mutationFn: async (row: Category) => {
      const payload = {
        name: row.name.trim(),
        description: row.description,
        weight_percent: row.weight_percent,
        color: row.color,
        sort_order: row.sort_order,
        is_active: row.is_active,
      };
      if (row.id) {
        const { error } = await supabase.from("target_categories").update(payload).eq("id", row.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("target_categories").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Category saved");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["target_categories"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("target_categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["target_categories"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="border-border/60">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="font-display">Target Categories</CardTitle>
          <div className="mt-1 text-xs text-muted-foreground">
            Active weight total: <span className={totalWeight === 100 ? "text-success" : "text-warning-foreground"}>{totalWeight.toFixed(1)}%</span>
          </div>
        </div>
        <Button onClick={startNew}><Plus className="mr-1 h-4 w-4" /> New</Button>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="py-2">Name</th>
                <th>Weight</th>
                <th>Order</th>
                <th>Active</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id} className="border-t border-border/60">
                  <td className="py-2">
                    <div className="flex items-center gap-2">
                      <span className="inline-block h-3 w-3 rounded-full" style={{ background: c.color ?? "#94a3b8" }} />
                      <span className="font-medium">{c.name}</span>
                    </div>
                    {c.description && <div className="text-xs text-muted-foreground">{c.description}</div>}
                  </td>
                  <td>{Number(c.weight_percent).toFixed(1)}%</td>
                  <td>{c.sort_order}</td>
                  <td>
                    {c.is_active ? (
                      <Badge variant="secondary" className="bg-success/15 text-success">Active</Badge>
                    ) : (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </td>
                  <td className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => { setEditing(c); setOpen(true); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => {
                      if (confirm(`Delete "${c.name}"? Targets in it must be removed first.`)) remove.mutate(c.id);
                    }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">No categories yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit Category" : "New Category"}</DialogTitle>
            <DialogDescription>Categories group targets and hold a weight used in performance calculations.</DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="grid gap-3">
              <div>
                <Label>Name</Label>
                <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea rows={2} value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Weight %</Label>
                  <Input type="number" step="0.1" value={editing.weight_percent} onChange={(e) => setEditing({ ...editing, weight_percent: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>Order</Label>
                  <Input type="number" value={editing.sort_order} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>Color</Label>
                  <Input type="color" value={editing.color ?? "#3b82f6"} onChange={(e) => setEditing({ ...editing, color: e.target.value })} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={editing.is_active} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} />
                <Label>Active</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={!editing?.name || save.isPending} onClick={() => editing && save.mutate(editing)}>
              {save.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* ------------------------- Targets ------------------------- */
function TargetsTab() {
  const qc = useQueryClient();
  const { data: categories = [] } = useQuery({
    queryKey: ["target_categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("target_categories").select("*").order("sort_order");
      if (error) throw error;
      return (data ?? []) as Category[];
    },
  });
  const { data: items = [] } = useQuery({
    queryKey: ["targets"],
    queryFn: async () => {
      const { data, error } = await supabase.from("targets").select("*").order("sort_order");
      if (error) throw error;
      return (data ?? []) as Target[];
    },
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Target | null>(null);

  function startNew() {
    if (categories.length === 0) {
      toast.error("Create a category first.");
      return;
    }
    setEditing({
      id: "",
      category_id: categories[0].id,
      code: "",
      title: "",
      description: "",
      unit: "",
      max_value: null,
      term_scope: "both",
      sort_order: items.length,
      is_active: true,
    });
    setOpen(true);
  }

  const save = useMutation({
    mutationFn: async (row: Target) => {
      const payload = {
        category_id: row.category_id,
        code: row.code || null,
        title: row.title.trim(),
        description: row.description,
        unit: row.unit || null,
        max_value: row.max_value,
        term_scope: row.term_scope,
        sort_order: row.sort_order,
        is_active: row.is_active,
      };
      if (row.id) {
        const { error } = await supabase.from("targets").update(payload).eq("id", row.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("targets").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Target saved");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["targets"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("targets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["targets"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const catMap = new Map(categories.map((c) => [c.id, c]));

  return (
    <Card className="border-border/60">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="font-display">Targets</CardTitle>
        <Button onClick={startNew}><Plus className="mr-1 h-4 w-4" /> New</Button>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="py-2">Title</th>
                <th>Category</th>
                <th>Code</th>
                <th>Unit</th>
                <th>Max</th>
                <th>Term</th>
                <th>Active</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((t) => {
                const c = catMap.get(t.category_id);
                return (
                  <tr key={t.id} className="border-t border-border/60">
                    <td className="py-2">
                      <div className="font-medium">{t.title}</div>
                      {t.description && <div className="text-xs text-muted-foreground">{t.description}</div>}
                    </td>
                    <td>
                      {c ? (
                        <span className="inline-flex items-center gap-1">
                          <span className="inline-block h-2 w-2 rounded-full" style={{ background: c.color ?? "#94a3b8" }} />
                          {c.name}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="font-mono text-xs">{t.code ?? "—"}</td>
                    <td>{t.unit ?? "—"}</td>
                    <td>{t.max_value ?? "—"}</td>
                    <td><Badge variant="secondary">{t.term_scope}</Badge></td>
                    <td>{t.is_active ? "Yes" : "No"}</td>
                    <td className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => { setEditing(t); setOpen(true); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => {
                        if (confirm(`Delete "${t.title}"?`)) remove.mutate(t.id);
                      }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {items.length === 0 && (
                <tr><td colSpan={8} className="py-6 text-center text-muted-foreground">No targets yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit Target" : "New Target"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="grid gap-3">
              <div>
                <Label>Title</Label>
                <Input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
              </div>
              <div>
                <Label>Category</Label>
                <Select value={editing.category_id} onValueChange={(v) => setEditing({ ...editing, category_id: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Description</Label>
                <Textarea rows={2} value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Code</Label>
                  <Input value={editing.code ?? ""} onChange={(e) => setEditing({ ...editing, code: e.target.value })} />
                </div>
                <div>
                  <Label>Unit</Label>
                  <Input placeholder="pages, verses, %…" value={editing.unit ?? ""} onChange={(e) => setEditing({ ...editing, unit: e.target.value })} />
                </div>
                <div>
                  <Label>Max value</Label>
                  <Input type="number" step="0.01" value={editing.max_value ?? ""} onChange={(e) => setEditing({ ...editing, max_value: e.target.value === "" ? null : Number(e.target.value) })} />
                </div>
                <div>
                  <Label>Order</Label>
                  <Input type="number" value={editing.sort_order} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} />
                </div>
              </div>
              <div>
                <Label>Term scope</Label>
                <Select value={editing.term_scope} onValueChange={(v) => setEditing({ ...editing, term_scope: v as Target["term_scope"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="term1">Term 1 only</SelectItem>
                    <SelectItem value="term2">Term 2 only</SelectItem>
                    <SelectItem value="both">Both terms</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={editing.is_active} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} />
                <Label>Active</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={!editing?.title || save.isPending} onClick={() => editing && save.mutate(editing)}>
              {save.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* ------------------------- Badges ------------------------- */
function BadgesTab() {
  const qc = useQueryClient();
  const { data: items = [] } = useQuery({
    queryKey: ["badges"],
    queryFn: async () => {
      const { data, error } = await supabase.from("badges").select("*").order("code");
      if (error) throw error;
      return (data ?? []) as BadgeRow[];
    },
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BadgeRow | null>(null);

  function startNew() {
    setEditing({
      id: "",
      code: "",
      name: "",
      description: "",
      icon: "🏆",
      color: "#f5b301",
      is_active: true,
    });
    setOpen(true);
  }

  const save = useMutation({
    mutationFn: async (row: BadgeRow) => {
      const payload = {
        code: row.code.trim(),
        name: row.name.trim(),
        description: row.description,
        icon: row.icon,
        color: row.color,
        is_active: row.is_active,
      };
      if (row.id) {
        const { error } = await supabase.from("badges").update(payload).eq("id", row.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("badges").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Badge saved");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["badges"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("badges").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["badges"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="border-border/60">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="font-display">Badges</CardTitle>
        <Button onClick={startNew}><Plus className="mr-1 h-4 w-4" /> New</Button>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((b) => (
            <div key={b.id} className="flex items-start gap-3 rounded-xl border border-border/60 p-3">
              <div
                className="grid h-12 w-12 shrink-0 place-items-center rounded-xl text-xl"
                style={{ background: (b.color ?? "#f5b301") + "22", color: b.color ?? "#f5b301" }}
              >
                <span>{b.icon ?? "🏆"}</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <div className="truncate font-medium">{b.name}</div>
                  {!b.is_active && <Badge variant="secondary">Inactive</Badge>}
                </div>
                <div className="font-mono text-xs text-muted-foreground">{b.code}</div>
                {b.description && <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{b.description}</div>}
                <div className="mt-2 flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => { setEditing(b); setOpen(true); }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => {
                    if (confirm(`Delete "${b.name}"?`)) remove.mutate(b.id);
                  }}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
          {items.length === 0 && (
            <div className="col-span-full py-6 text-center text-sm text-muted-foreground">No badges yet.</div>
          )}
        </div>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit Badge" : "New Badge"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Code</Label>
                  <Input value={editing.code} onChange={(e) => setEditing({ ...editing, code: e.target.value })} />
                </div>
                <div>
                  <Label>Name</Label>
                  <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Description</Label>
                <Textarea rows={2} value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Icon (emoji)</Label>
                  <Input value={editing.icon ?? ""} onChange={(e) => setEditing({ ...editing, icon: e.target.value })} />
                </div>
                <div>
                  <Label>Color</Label>
                  <Input type="color" value={editing.color ?? "#f5b301"} onChange={(e) => setEditing({ ...editing, color: e.target.value })} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={editing.is_active} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} />
                <Label>Active</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={!editing?.code || !editing?.name || save.isPending} onClick={() => editing && save.mutate(editing)}>
              {save.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
