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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Check, X, Plus, Pencil, Award } from "lucide-react";

export const Route = createFileRoute("/admin/participants")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Competition Participants — Admin" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: ParticipantsPage,
});

type Competition = { id: string; title: string };
type Category = { id: string; competition_id: string; category_name: string };
type Participant = {
  id: string;
  competition_id: string;
  category_id: string | null;
  registration_number: string;
  full_name: string;
  participant_type: string;
  approval_status: string;
  participation_status: string;
  admin_notes: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  submitted_at: string;
};
type ResultRow = {
  id: string;
  participant_id: string;
  competition_id: string;
  category_id: string | null;
  rank: number | null;
  score: number | null;
  grade: string | null;
  judge_remarks: string | null;
  prize_details: string | null;
  certificate_number: string | null;
  is_published: boolean;
  result_status: string;
};

const approvalBadge = (s: string) => {
  const map: Record<string, string> = {
    pending: "bg-warning/15 text-warning",
    approved: "bg-success/15 text-success",
    rejected: "bg-destructive/15 text-destructive",
  };
  return <Badge className={map[s] ?? "bg-muted text-foreground"}>{s}</Badge>;
};

function useCompetitions() {
  return useQuery({
    queryKey: ["competitions_list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("competitions")
        .select("id, title")
        .order("title");
      if (error) throw error;
      return (data ?? []) as Competition[];
    },
  });
}

function ParticipantsPage() {
  const [tab, setTab] = useState<"approvals" | "results">("approvals");
  const competitions = useCompetitions();
  const [competitionId, setCompetitionId] = useState<string>("");
  const activeCompetitionId = competitionId || competitions.data?.[0]?.id || "";

  const categories = useQuery({
    queryKey: ["competition_categories_for", activeCompetitionId],
    enabled: !!activeCompetitionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("competition_categories")
        .select("id, competition_id, category_name")
        .eq("competition_id", activeCompetitionId)
        .order("category_name");
      if (error) throw error;
      return (data ?? []) as Category[];
    },
  });

  return (
    <RoleShell role="admin" title="Competition Participants">
      <div className="flex flex-col gap-4">
        <Card>
          <CardContent className="p-4">
            <Label className="text-xs uppercase text-muted-foreground">Competition</Label>
            <Select value={activeCompetitionId} onValueChange={setCompetitionId}>
              <SelectTrigger className="w-full sm:w-72">
                <SelectValue placeholder="Select competition" />
              </SelectTrigger>
              <SelectContent>
                {(competitions.data ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {!activeCompetitionId ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              Select a competition to manage participants.
            </CardContent>
          </Card>
        ) : (
          <Tabs value={tab} onValueChange={(v) => setTab(v as "approvals" | "results")}>
            <TabsList>
              <TabsTrigger value="approvals">Approvals</TabsTrigger>
              <TabsTrigger value="results">Results</TabsTrigger>
            </TabsList>
            <TabsContent value="approvals" className="mt-4">
              <ApprovalsPanel competitionId={activeCompetitionId} categories={categories.data ?? []} />
            </TabsContent>
            <TabsContent value="results" className="mt-4">
              <ResultsPanel competitionId={activeCompetitionId} categories={categories.data ?? []} />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </RoleShell>
  );
}

/* ---------------------------- Approvals ---------------------------- */

function ApprovalsPanel({
  competitionId,
  categories,
}: {
  competitionId: string;
  categories: Category[];
}) {
  const qc = useQueryClient();
  const [categoryId, setCategoryId] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const participants = useQuery({
    queryKey: ["competition_participants", competitionId, categoryId, statusFilter],
    queryFn: async () => {
      let q = supabase
        .from("competition_participants")
        .select("*")
        .eq("competition_id", competitionId)
        .order("submitted_at", { ascending: false });
      if (categoryId !== "all") q = q.eq("category_id", categoryId);
      if (statusFilter !== "all") q = q.eq("approval_status", statusFilter);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Participant[];
    },
  });

  const [editing, setEditing] = useState<null | Participant>(null);
  const [notes, setNotes] = useState("");

  const reviewMut = useMutation({
    mutationFn: async (p: { id: string; approval_status: string; admin_notes: string }) => {
      const { data: sess } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("competition_participants")
        .update({
          approval_status: p.approval_status,
          admin_notes: p.admin_notes || null,
          reviewed_at: new Date().toISOString(),
          reviewed_by: sess.user?.id ?? null,
        })
        .eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["competition_participants", competitionId] });
      setEditing(null);
      toast.success("Updated");
    },
    onError: (e: unknown) => toast.error((e as Error).message),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3">
        <div>
          <Label className="text-xs uppercase text-muted-foreground">Category</Label>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.category_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs uppercase text-muted-foreground">Approval status</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending">pending</SelectItem>
              <SelectItem value="approved">approved</SelectItem>
              <SelectItem value="rejected">rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {participants.isLoading ? (
        <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
      ) : (participants.data ?? []).length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            No participants found.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {(participants.data ?? []).map((p) => (
            <Card key={p.id}>
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-base font-semibold">{p.full_name}</span>
                    <span className="text-xs text-muted-foreground">{p.registration_number}</span>
                    {approvalBadge(p.approval_status)}
                    <Badge className="bg-muted text-foreground">{p.participant_type}</Badge>
                  </div>
                  {p.admin_notes && (
                    <p className="mt-1 text-xs text-muted-foreground">Notes: {p.admin_notes}</p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {p.approval_status !== "approved" && (
                    <Button
                      size="sm"
                      onClick={() => {
                        setNotes(p.admin_notes ?? "");
                        setEditing({ ...p, approval_status: "approved" });
                      }}
                    >
                      <Check className="mr-1 h-4 w-4" /> Approve
                    </Button>
                  )}
                  {p.approval_status !== "rejected" && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        setNotes(p.admin_notes ?? "");
                        setEditing({ ...p, approval_status: "rejected" });
                      }}
                    >
                      <X className="mr-1 h-4 w-4" /> Reject
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing?.approval_status === "approved" ? "Approve" : "Reject"} {editing?.full_name}
            </DialogTitle>
          </DialogHeader>
          <div>
            <Label>Admin notes</Label>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              disabled={reviewMut.isPending}
              onClick={() =>
                editing &&
                reviewMut.mutate({
                  id: editing.id,
                  approval_status: editing.approval_status,
                  admin_notes: notes,
                })
              }
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------------------------- Results ---------------------------- */

function ResultsPanel({
  competitionId,
  categories,
}: {
  competitionId: string;
  categories: Category[];
}) {
  const qc = useQueryClient();

  const participants = useQuery({
    queryKey: ["approved_participants", competitionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("competition_participants")
        .select("*")
        .eq("competition_id", competitionId)
        .eq("approval_status", "approved")
        .order("full_name");
      if (error) throw error;
      return (data ?? []) as Participant[];
    },
  });

  const results = useQuery({
    queryKey: ["competition_results", competitionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("competition_results")
        .select("*")
        .eq("competition_id", competitionId);
      if (error) throw error;
      return (data ?? []) as ResultRow[];
    },
  });

  const resultByParticipant = useMemo(() => {
    const map: Record<string, ResultRow> = {};
    (results.data ?? []).forEach((r) => (map[r.participant_id] = r));
    return map;
  }, [results.data]);

  const [editing, setEditing] = useState<null | Partial<ResultRow> & { participant: Participant }>(
    null
  );

  const saveMut = useMutation({
    mutationFn: async (r: Partial<ResultRow> & { participant: Participant }) => {
      const payload = {
        participant_id: r.participant.id,
        competition_id: competitionId,
        category_id: r.participant.category_id,
        rank: r.rank ?? null,
        score: r.score ?? null,
        grade: r.grade ?? null,
        judge_remarks: r.judge_remarks ?? null,
        prize_details: r.prize_details ?? null,
        certificate_number: r.certificate_number ?? null,
        is_published: r.is_published ?? false,
      };
      if (r.id) {
        const { error } = await supabase.from("competition_results").update(payload).eq("id", r.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("competition_results").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["competition_results", competitionId] });
      setEditing(null);
      toast.success("Saved");
    },
    onError: (e: unknown) => toast.error((e as Error).message),
  });

  return (
    <div className="flex flex-col gap-3">
      {participants.isLoading ? (
        <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
      ) : (participants.data ?? []).length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            No approved participants yet.
          </CardContent>
        </Card>
      ) : (
        (participants.data ?? []).map((p) => {
          const r = resultByParticipant[p.id];
          return (
            <Card key={p.id}>
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Award className="h-4 w-4 text-primary" />
                    <span className="font-display text-base font-semibold">{p.full_name}</span>
                    {r?.rank != null && <Badge className="bg-primary text-primary-foreground">Rank {r.rank}</Badge>}
                    {r?.is_published && <Badge className="bg-success/15 text-success">Published</Badge>}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Score: {r?.score ?? "—"} · Grade: {r?.grade ?? "—"} · Certificate:{" "}
                    {r?.certificate_number ?? "—"}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setEditing({
                      ...(r ?? {}),
                      participant: p,
                      is_published: r?.is_published ?? false,
                    })
                  }
                >
                  <Pencil className="mr-1 h-4 w-4" /> {r ? "Edit result" : "Add result"}
                </Button>
              </CardContent>
            </Card>
          );
        })
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Result for {editing?.participant.full_name}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="grid gap-3">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Rank</Label>
                  <Input
                    type="number"
                    value={editing.rank ?? ""}
                    onChange={(e) =>
                      setEditing({ ...editing, rank: e.target.value ? Number(e.target.value) : null })
                    }
                  />
                </div>
                <div>
                  <Label>Score</Label>
                  <Input
                    type="number"
                    value={editing.score ?? ""}
                    onChange={(e) =>
                      setEditing({ ...editing, score: e.target.value ? Number(e.target.value) : null })
                    }
                  />
                </div>
                <div>
                  <Label>Grade</Label>
                  <Input
                    value={editing.grade ?? ""}
                    onChange={(e) => setEditing({ ...editing, grade: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label>Judge remarks</Label>
                <Textarea
                  rows={2}
                  value={editing.judge_remarks ?? ""}
                  onChange={(e) => setEditing({ ...editing, judge_remarks: e.target.value })}
                />
              </div>
              <div>
                <Label>Prize details</Label>
                <Input
                  value={editing.prize_details ?? ""}
                  onChange={(e) => setEditing({ ...editing, prize_details: e.target.value })}
                />
              </div>
              <div>
                <Label>Certificate number</Label>
                <Input
                  value={editing.certificate_number ?? ""}
                  onChange={(e) => setEditing({ ...editing, certificate_number: e.target.value })}
                />
              </div>
              <div className="flex items-center justify-between rounded-md border p-2">
                <Label className="text-sm">Published</Label>
                <Switch
                  checked={editing.is_published ?? false}
                  onCheckedChange={(v) => setEditing({ ...editing, is_published: v })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button disabled={saveMut.isPending} onClick={() => editing && saveMut.mutate(editing)}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
