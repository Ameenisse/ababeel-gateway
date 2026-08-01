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
import { Switch } from "@/components/ui/switch";
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
import { Trophy, Plus, Pencil, Trash2, Layers } from "lucide-react";

export const Route = createFileRoute("/admin/competitions")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Competitions — Admin" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: CompetitionsPage,
});

type Competition = {
  id: string;
  competition_code: string;
  title: string;
  short_description: string | null;
  full_description: string | null;
  competition_type: string | null;
  competition_date: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  eligible_classes: string[] | null;
  eligible_gender: string | null;
  minimum_age: number | null;
  maximum_age: number | null;
  maximum_participants: number | null;
  registration_open_date: string | null;
  registration_close_date: string | null;
  display_start_date: string | null;
  display_end_date: string | null;
  public_registration_enabled: boolean;
  student_registration_enabled: boolean;
  approval_required: boolean;
  rules: string | null;
  contact_info: string | null;
  banner_url: string | null;
  status: string;
};

type Category = {
  id: string;
  competition_id: string;
  category_code: string;
  category_name: string;
  description: string | null;
  eligible_gender: string | null;
  minimum_age: number | null;
  maximum_age: number | null;
  maximum_participants: number | null;
  registration_fee: number | null;
  category_rules: string | null;
  status: string;
};

const STATUSES = ["draft", "published", "closed", "completed", "cancelled"];

const statusBadge = (s: string) => {
  const map: Record<string, string> = {
    draft: "bg-muted text-foreground",
    published: "bg-success/15 text-success",
    closed: "bg-warning/15 text-warning",
    completed: "bg-info/15 text-info",
    cancelled: "bg-destructive/15 text-destructive",
  };
  return <Badge className={map[s] ?? "bg-muted text-foreground"}>{s}</Badge>;
};

function CompetitionsPage() {
  const qc = useQueryClient();
  const competitions = useQuery({
    queryKey: ["competitions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("competitions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Competition[];
    },
  });

  const [editing, setEditing] = useState<null | Partial<Competition>>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const saveMut = useMutation({
    mutationFn: async (c: Partial<Competition>) => {
      const payload = {
        competition_code: c.competition_code!,
        title: c.title!,
        short_description: c.short_description ?? null,
        full_description: c.full_description ?? null,
        competition_type: c.competition_type ?? null,
        competition_date: c.competition_date || null,
        start_time: c.start_time || null,
        end_time: c.end_time || null,
        location: c.location ?? null,
        eligible_gender: c.eligible_gender ?? null,
        minimum_age: c.minimum_age ?? null,
        maximum_age: c.maximum_age ?? null,
        maximum_participants: c.maximum_participants ?? null,
        registration_open_date: c.registration_open_date || null,
        registration_close_date: c.registration_close_date || null,
        display_start_date: c.display_start_date || null,
        display_end_date: c.display_end_date || null,
        public_registration_enabled: c.public_registration_enabled ?? false,
        student_registration_enabled: c.student_registration_enabled ?? false,
        approval_required: c.approval_required ?? true,
        rules: c.rules ?? null,
        contact_info: c.contact_info ?? null,
        banner_url: c.banner_url ?? null,
        status: c.status ?? "draft",
      };
      if (c.id) {
        const { error } = await supabase.from("competitions").update(payload).eq("id", c.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("competitions").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["competitions"] });
      setEditing(null);
      toast.success("Saved");
    },
    onError: (e: unknown) => toast.error((e as Error).message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("competitions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["competitions"] });
      if (selectedId) setSelectedId(null);
      toast.success("Deleted");
    },
    onError: (e: unknown) => toast.error((e as Error).message),
  });

  const selected = useMemo(
    () => (competitions.data ?? []).find((c) => c.id === selectedId) ?? null,
    [competitions.data, selectedId]
  );

  return (
    <RoleShell role="admin" title="Competitions">
      <div className="flex flex-col gap-4">
        <div className="flex justify-end">
          <Button
            onClick={() =>
              setEditing({
                status: "draft",
                public_registration_enabled: false,
                student_registration_enabled: true,
                approval_required: true,
              })
            }
          >
            <Plus className="mr-1 h-4 w-4" /> New Competition
          </Button>
        </div>

        {competitions.isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
        ) : (competitions.data ?? []).length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              No competitions yet.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {(competitions.data ?? []).map((c) => (
              <Card key={c.id} className={selectedId === c.id ? "border-primary" : undefined}>
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Trophy className="h-4 w-4 text-primary" />
                      <span className="font-display text-base font-semibold">{c.title}</span>
                      <span className="text-xs text-muted-foreground">{c.competition_code}</span>
                      {statusBadge(c.status)}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Date: {c.competition_date ?? "—"} · Registration:{" "}
                      {c.registration_open_date ?? "—"} → {c.registration_close_date ?? "—"}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant={selectedId === c.id ? "default" : "outline"}
                      onClick={() => setSelectedId(selectedId === c.id ? null : c.id)}
                    >
                      <Layers className="mr-1 h-4 w-4" /> Categories
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditing(c)}>
                      <Pencil className="mr-1 h-4 w-4" /> Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (confirm(`Delete "${c.title}"?`)) deleteMut.mutate(c.id);
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

        {selected && <CategoriesPanel competition={selected} />}

        <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
          <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing?.id ? "Edit" : "New"} competition</DialogTitle>
            </DialogHeader>
            {editing && (
              <div className="grid gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Code</Label>
                    <Input
                      value={editing.competition_code ?? ""}
                      onChange={(e) => setEditing({ ...editing, competition_code: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Title</Label>
                    <Input
                      value={editing.title ?? ""}
                      onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label>Short description</Label>
                  <Input
                    value={editing.short_description ?? ""}
                    onChange={(e) => setEditing({ ...editing, short_description: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Full description</Label>
                  <Textarea
                    rows={3}
                    value={editing.full_description ?? ""}
                    onChange={(e) => setEditing({ ...editing, full_description: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>Type</Label>
                    <Input
                      value={editing.competition_type ?? ""}
                      onChange={(e) => setEditing({ ...editing, competition_type: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Location</Label>
                    <Input
                      value={editing.location ?? ""}
                      onChange={(e) => setEditing({ ...editing, location: e.target.value })}
                    />
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
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>Competition date</Label>
                    <Input
                      type="date"
                      value={editing.competition_date ?? ""}
                      onChange={(e) => setEditing({ ...editing, competition_date: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Start time</Label>
                    <Input
                      type="time"
                      value={editing.start_time ?? ""}
                      onChange={(e) => setEditing({ ...editing, start_time: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>End time</Label>
                    <Input
                      type="time"
                      value={editing.end_time ?? ""}
                      onChange={(e) => setEditing({ ...editing, end_time: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Registration open</Label>
                    <Input
                      type="date"
                      value={editing.registration_open_date ?? ""}
                      onChange={(e) =>
                        setEditing({ ...editing, registration_open_date: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label>Registration close</Label>
                    <Input
                      type="date"
                      value={editing.registration_close_date ?? ""}
                      onChange={(e) =>
                        setEditing({ ...editing, registration_close_date: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Display start</Label>
                    <Input
                      type="date"
                      value={editing.display_start_date ?? ""}
                      onChange={(e) => setEditing({ ...editing, display_start_date: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Display end</Label>
                    <Input
                      type="date"
                      value={editing.display_end_date ?? ""}
                      onChange={(e) => setEditing({ ...editing, display_end_date: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <Label>Eligible gender</Label>
                    <Select
                      value={editing.eligible_gender ?? "any"}
                      onValueChange={(v) =>
                        setEditing({ ...editing, eligible_gender: v === "any" ? null : v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Any</SelectItem>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Min age</Label>
                    <Input
                      type="number"
                      value={editing.minimum_age ?? ""}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          minimum_age: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label>Max age</Label>
                    <Input
                      type="number"
                      value={editing.maximum_age ?? ""}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          maximum_age: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label>Max participants</Label>
                    <Input
                      type="number"
                      value={editing.maximum_participants ?? ""}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          maximum_participants: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="flex items-center justify-between rounded-md border p-2">
                    <Label className="text-sm">Public registration</Label>
                    <Switch
                      checked={editing.public_registration_enabled ?? false}
                      onCheckedChange={(v) => setEditing({ ...editing, public_registration_enabled: v })}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-md border p-2">
                    <Label className="text-sm">Student registration</Label>
                    <Switch
                      checked={editing.student_registration_enabled ?? false}
                      onCheckedChange={(v) =>
                        setEditing({ ...editing, student_registration_enabled: v })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-md border p-2">
                    <Label className="text-sm">Approval required</Label>
                    <Switch
                      checked={editing.approval_required ?? true}
                      onCheckedChange={(v) => setEditing({ ...editing, approval_required: v })}
                    />
                  </div>
                </div>
                <div>
                  <Label>Rules</Label>
                  <Textarea
                    rows={3}
                    value={editing.rules ?? ""}
                    onChange={(e) => setEditing({ ...editing, rules: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Contact info</Label>
                    <Input
                      value={editing.contact_info ?? ""}
                      onChange={(e) => setEditing({ ...editing, contact_info: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Banner URL</Label>
                    <Input
                      value={editing.banner_url ?? ""}
                      onChange={(e) => setEditing({ ...editing, banner_url: e.target.value })}
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
                  if (!editing?.title || !editing.competition_code) {
                    toast.error("Code and title are required");
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

/* ---------------------------- Categories ---------------------------- */

function CategoriesPanel({ competition }: { competition: Competition }) {
  const qc = useQueryClient();
  const categories = useQuery({
    queryKey: ["competition_categories", competition.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("competition_categories")
        .select("*")
        .eq("competition_id", competition.id)
        .order("category_name");
      if (error) throw error;
      return (data ?? []) as Category[];
    },
  });

  const [editing, setEditing] = useState<null | Partial<Category>>(null);

  const saveMut = useMutation({
    mutationFn: async (cat: Partial<Category>) => {
      const payload = {
        competition_id: competition.id,
        category_code: cat.category_code!,
        category_name: cat.category_name!,
        description: cat.description ?? null,
        eligible_gender: cat.eligible_gender ?? null,
        minimum_age: cat.minimum_age ?? null,
        maximum_age: cat.maximum_age ?? null,
        maximum_participants: cat.maximum_participants ?? null,
        registration_fee: cat.registration_fee ?? null,
        category_rules: cat.category_rules ?? null,
        status: cat.status ?? "active",
      };
      if (cat.id) {
        const { error } = await supabase.from("competition_categories").update(payload).eq("id", cat.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("competition_categories").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["competition_categories", competition.id] });
      setEditing(null);
      toast.success("Saved");
    },
    onError: (e: unknown) => toast.error((e as Error).message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("competition_categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["competition_categories", competition.id] });
      toast.success("Deleted");
    },
    onError: (e: unknown) => toast.error((e as Error).message),
  });

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-base font-semibold">
            Categories for {competition.title}
          </h3>
          <Button size="sm" onClick={() => setEditing({ status: "active" })}>
            <Plus className="mr-1 h-4 w-4" /> New Category
          </Button>
        </div>
        {categories.isLoading ? (
          <div className="p-4 text-center text-sm text-muted-foreground">Loading…</div>
        ) : (categories.data ?? []).length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">No categories yet.</div>
        ) : (
          <div className="grid gap-2">
            {(categories.data ?? []).map((cat) => (
              <div
                key={cat.id}
                className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{cat.category_name}</span>
                    <span className="text-xs text-muted-foreground">{cat.category_code}</span>
                    <Badge className="bg-muted text-foreground">{cat.status}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Age {cat.minimum_age ?? "—"}-{cat.maximum_age ?? "—"} · Gender:{" "}
                    {cat.eligible_gender ?? "any"} · Fee: {cat.registration_fee ?? 0}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setEditing(cat)}>
                    <Pencil className="mr-1 h-4 w-4" /> Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (confirm(`Delete "${cat.category_name}"?`)) deleteMut.mutate(cat.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing?.id ? "Edit" : "New"} category</DialogTitle>
            </DialogHeader>
            {editing && (
              <div className="grid gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Code</Label>
                    <Input
                      value={editing.category_code ?? ""}
                      onChange={(e) => setEditing({ ...editing, category_code: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Name</Label>
                    <Input
                      value={editing.category_name ?? ""}
                      onChange={(e) => setEditing({ ...editing, category_name: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea
                    rows={2}
                    value={editing.description ?? ""}
                    onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>Min age</Label>
                    <Input
                      type="number"
                      value={editing.minimum_age ?? ""}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          minimum_age: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label>Max age</Label>
                    <Input
                      type="number"
                      value={editing.maximum_age ?? ""}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          maximum_age: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label>Max participants</Label>
                    <Input
                      type="number"
                      value={editing.maximum_participants ?? ""}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          maximum_participants: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Eligible gender</Label>
                    <Select
                      value={editing.eligible_gender ?? "any"}
                      onValueChange={(v) =>
                        setEditing({ ...editing, eligible_gender: v === "any" ? null : v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Any</SelectItem>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Registration fee</Label>
                    <Input
                      type="number"
                      value={editing.registration_fee ?? ""}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          registration_fee: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                    />
                  </div>
                </div>
                <div>
                  <Label>Category rules</Label>
                  <Textarea
                    rows={2}
                    value={editing.category_rules ?? ""}
                    onChange={(e) => setEditing({ ...editing, category_rules: e.target.value })}
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
                      <SelectItem value="active">active</SelectItem>
                      <SelectItem value="inactive">inactive</SelectItem>
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
                  if (!editing?.category_code || !editing.category_name) {
                    toast.error("Code and name are required");
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
      </CardContent>
    </Card>
  );
}
