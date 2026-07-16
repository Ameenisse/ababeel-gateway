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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CalendarRange, Plus, Pencil, Star, Trash2 } from "lucide-react";

export const Route = createFileRoute("/admin/academic")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Academic Years & Terms — Admin" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AcademicPage,
});

type Year = {
  id: string;
  year_name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  notes: string | null;
};

type Term = {
  id: string;
  academic_year_id: string;
  term_name: string;
  term_sequence: number;
  start_date: string;
  end_date: string;
  target_open_date: string | null;
  target_deadline: string | null;
  report_available_date: string | null;
  status: "draft" | "active" | "completed" | "archived";
  notes: string | null;
};

const termStatusBadge = (s: Term["status"]) => {
  const map: Record<string, string> = {
    draft: "bg-muted text-foreground",
    active: "bg-success/15 text-success",
    completed: "bg-info/15 text-info",
    archived: "bg-muted text-muted-foreground",
  };
  return <Badge className={map[s]}>{s}</Badge>;
};

function AcademicPage() {
  const [tab, setTab] = useState<"years" | "terms">("years");

  return (
    <RoleShell role="admin" title="Academic Years & Terms">
      <Tabs value={tab} onValueChange={(v) => setTab(v as "years" | "terms")}>
        <TabsList>
          <TabsTrigger value="years">Academic Years</TabsTrigger>
          <TabsTrigger value="terms">Terms</TabsTrigger>
        </TabsList>
        <TabsContent value="years" className="mt-4">
          <YearsPanel />
        </TabsContent>
        <TabsContent value="terms" className="mt-4">
          <TermsPanel />
        </TabsContent>
      </Tabs>
    </RoleShell>
  );
}

/* ---------------------------- Years ---------------------------- */

function YearsPanel() {
  const qc = useQueryClient();
  const years = useQuery({
    queryKey: ["academic_years"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("academic_years")
        .select("*")
        .order("start_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Year[];
    },
  });

  const [editing, setEditing] = useState<null | Partial<Year>>(null);

  const saveMut = useMutation({
    mutationFn: async (y: Partial<Year>) => {
      if (y.id) {
        const { error } = await supabase
          .from("academic_years")
          .update({
            year_name: y.year_name!,
            start_date: y.start_date!,
            end_date: y.end_date!,
            notes: y.notes ?? null,
          })
          .eq("id", y.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("academic_years").insert({
          year_name: y.year_name!,
          start_date: y.start_date!,
          end_date: y.end_date!,
          notes: y.notes ?? null,
          is_current: false,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["academic_years"] });
      setEditing(null);
      toast.success("Saved");
    },
    onError: (e: unknown) => toast.error((e as Error).message),
  });

  const setCurrentMut = useMutation({
    mutationFn: async (id: string) => {
      // clear current on all, then set this one
      const { error: e1 } = await supabase
        .from("academic_years")
        .update({ is_current: false })
        .neq("id", id);
      if (e1) throw e1;
      const { error: e2 } = await supabase
        .from("academic_years")
        .update({ is_current: true })
        .eq("id", id);
      if (e2) throw e2;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["academic_years"] });
      toast.success("Set as current");
    },
    onError: (e: unknown) => toast.error((e as Error).message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("academic_years").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["academic_years"] });
      toast.success("Deleted");
    },
    onError: (e: unknown) => toast.error((e as Error).message),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button onClick={() => setEditing({})}>
          <Plus className="mr-1 h-4 w-4" /> New Academic Year
        </Button>
      </div>

      {years.isLoading ? (
        <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
      ) : (years.data ?? []).length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            No academic years yet. Create one to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {(years.data ?? []).map((y) => (
            <Card key={y.id}>
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <CalendarRange className="h-4 w-4 text-primary" />
                    <span className="font-display text-base font-semibold">{y.year_name}</span>
                    {y.is_current && (
                      <Badge className="bg-primary text-primary-foreground">Current</Badge>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {y.start_date} → {y.end_date}
                    {y.notes ? ` · ${y.notes}` : ""}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {!y.is_current && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setCurrentMut.mutate(y.id)}
                      disabled={setCurrentMut.isPending}
                    >
                      <Star className="mr-1 h-4 w-4" /> Set current
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => setEditing(y)}>
                    <Pencil className="mr-1 h-4 w-4" /> Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (confirm(`Delete "${y.year_name}"? This cannot be undone.`))
                        deleteMut.mutate(y.id);
                    }}
                    disabled={y.is_current}
                    title={y.is_current ? "Cannot delete current year" : "Delete"}
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit" : "New"} academic year</DialogTitle>
            <DialogDescription>
              Use a clear range name like "2026-2027".
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="grid gap-3">
              <div>
                <Label>Year name</Label>
                <Input
                  value={editing.year_name ?? ""}
                  onChange={(e) => setEditing({ ...editing, year_name: e.target.value })}
                  placeholder="2026-2027"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Start date</Label>
                  <Input
                    type="date"
                    value={editing.start_date ?? ""}
                    onChange={(e) => setEditing({ ...editing, start_date: e.target.value })}
                  />
                </div>
                <div>
                  <Label>End date</Label>
                  <Input
                    type="date"
                    value={editing.end_date ?? ""}
                    onChange={(e) => setEditing({ ...editing, end_date: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea
                  rows={3}
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
                if (!editing?.year_name || !editing.start_date || !editing.end_date) {
                  toast.error("Name, start and end date are required");
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
  );
}

/* ---------------------------- Terms ---------------------------- */

function TermsPanel() {
  const qc = useQueryClient();
  const years = useQuery({
    queryKey: ["academic_years"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("academic_years")
        .select("*")
        .order("start_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Year[];
    },
  });

  const [yearId, setYearId] = useState<string>("");
  const activeYear = useMemo(() => {
    if (!years.data?.length) return null;
    if (yearId) return years.data.find((y) => y.id === yearId) ?? null;
    return years.data.find((y) => y.is_current) ?? years.data[0];
  }, [years.data, yearId]);

  const terms = useQuery({
    queryKey: ["academic_terms", activeYear?.id],
    enabled: !!activeYear?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("academic_terms")
        .select("*")
        .eq("academic_year_id", activeYear!.id)
        .order("term_sequence");
      if (error) throw error;
      return (data ?? []) as Term[];
    },
  });

  const [editing, setEditing] = useState<null | Partial<Term>>(null);

  const saveMut = useMutation({
    mutationFn: async (t: Partial<Term>) => {
      const payload = {
        academic_year_id: activeYear!.id,
        term_name: t.term_name!,
        term_sequence: t.term_sequence!,
        start_date: t.start_date!,
        end_date: t.end_date!,
        target_open_date: t.target_open_date || null,
        target_deadline: t.target_deadline || null,
        report_available_date: t.report_available_date || null,
        status: t.status ?? "draft",
        notes: t.notes ?? null,
      };
      if (t.id) {
        const { error } = await supabase.from("academic_terms").update(payload).eq("id", t.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("academic_terms").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["academic_terms", activeYear?.id] });
      setEditing(null);
      toast.success("Saved");
    },
    onError: (e: unknown) => toast.error((e as Error).message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("academic_terms").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["academic_terms", activeYear?.id] });
      toast.success("Deleted");
    },
    onError: (e: unknown) => toast.error((e as Error).message),
  });

  function seedTerms() {
    if (!activeYear) return;
    const s = activeYear.start_date;
    const e = activeYear.end_date;
    // rough midpoint
    const mid = new Date(new Date(s).getTime() + (new Date(e).getTime() - new Date(s).getTime()) / 2)
      .toISOString()
      .slice(0, 10);
    saveMut.mutate({
      term_name: "First Term",
      term_sequence: 1,
      start_date: s,
      end_date: mid,
      status: "draft",
    });
    setTimeout(() => {
      saveMut.mutate({
        term_name: "Second Term",
        term_sequence: 2,
        start_date: mid,
        end_date: e,
        status: "draft",
      });
    }, 400);
  }

  if (!years.data?.length) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          Create an academic year first.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Label className="text-xs uppercase text-muted-foreground">Year</Label>
          <Select value={activeYear?.id ?? ""} onValueChange={setYearId}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.data.map((y) => (
                <SelectItem key={y.id} value={y.id}>
                  {y.year_name} {y.is_current ? "· current" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          {(terms.data?.length ?? 0) === 0 && (
            <Button variant="outline" onClick={seedTerms} disabled={saveMut.isPending}>
              Seed First & Second Term
            </Button>
          )}
          <Button
            onClick={() =>
              setEditing({
                term_sequence: (terms.data?.length ?? 0) + 1,
                status: "draft",
              })
            }
          >
            <Plus className="mr-1 h-4 w-4" /> New Term
          </Button>
        </div>
      </div>

      {terms.isLoading ? (
        <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
      ) : (terms.data ?? []).length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            No terms for this year yet.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {(terms.data ?? []).map((t) => (
            <Card key={t.id}>
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-base font-semibold">
                      {t.term_name}
                    </span>
                    <span className="text-xs text-muted-foreground">#{t.term_sequence}</span>
                    {termStatusBadge(t.status)}
                  </div>
                  <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-muted-foreground sm:grid-cols-4">
                    <span>Term: {t.start_date} → {t.end_date}</span>
                    <span>Targets open: {t.target_open_date ?? "—"}</span>
                    <span>Target deadline: {t.target_deadline ?? "—"}</span>
                    <span>Report available: {t.report_available_date ?? "—"}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => setEditing(t)}>
                    <Pencil className="mr-1 h-4 w-4" /> Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (confirm(`Delete "${t.term_name}"?`)) deleteMut.mutate(t.id);
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit" : "New"} term</DialogTitle>
            <DialogDescription>
              For {activeYear?.year_name}
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="grid gap-3">
              <div className="grid grid-cols-[1fr_6rem] gap-3">
                <div>
                  <Label>Term name</Label>
                  <Input
                    value={editing.term_name ?? ""}
                    onChange={(e) => setEditing({ ...editing, term_name: e.target.value })}
                    placeholder="First Term"
                  />
                </div>
                <div>
                  <Label>Sequence</Label>
                  <Input
                    type="number"
                    min={1}
                    value={editing.term_sequence ?? 1}
                    onChange={(e) =>
                      setEditing({ ...editing, term_sequence: Number(e.target.value) })
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Start</Label>
                  <Input
                    type="date"
                    value={editing.start_date ?? ""}
                    onChange={(e) => setEditing({ ...editing, start_date: e.target.value })}
                  />
                </div>
                <div>
                  <Label>End</Label>
                  <Input
                    type="date"
                    value={editing.end_date ?? ""}
                    onChange={(e) => setEditing({ ...editing, end_date: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Targets open</Label>
                  <Input
                    type="date"
                    value={editing.target_open_date ?? ""}
                    onChange={(e) =>
                      setEditing({ ...editing, target_open_date: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>Target deadline</Label>
                  <Input
                    type="date"
                    value={editing.target_deadline ?? ""}
                    onChange={(e) =>
                      setEditing({ ...editing, target_deadline: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>Report available</Label>
                  <Input
                    type="date"
                    value={editing.report_available_date ?? ""}
                    onChange={(e) =>
                      setEditing({ ...editing, report_available_date: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>Status</Label>
                  <Select
                    value={editing.status ?? "draft"}
                    onValueChange={(v) =>
                      setEditing({ ...editing, status: v as Term["status"] })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
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
                if (
                  !editing?.term_name ||
                  !editing.start_date ||
                  !editing.end_date ||
                  !editing.term_sequence
                ) {
                  toast.error("Name, sequence, start and end are required");
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
  );
}
