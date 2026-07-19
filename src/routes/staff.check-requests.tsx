import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { RoleShell } from "@/components/role-shell";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Star, RefreshCcw } from "lucide-react";
import { respondCheck } from "@/lib/targets.functions";

export const Route = createFileRoute("/staff/check-requests")({
  ssr: false,
  head: () => ({ meta: [{ title: "Check Requests — Staff" }, { name: "robots", content: "noindex" }] }),
  component: Page,
});

type PendingRow = {
  id: string;
  student_note: string | null;
  requested_at: string;
  assignment_id: string;
  student_target_assignments: {
    id: string;
    student_id: string;
    students: { full_name: string; student_number: string } | null;
    target_template_items: { title_dv: string; title_en: string | null } | null;
  } | null;
};

function Page() {
  const [rows, setRows] = useState<PendingRow[]>([]);
  const [respondFor, setRespondFor] = useState<PendingRow | null>(null);
  const [note, setNote] = useState("");
  const [outcome, setOutcome] = useState<"completed" | "needs_improvement">("completed");

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("target_check_attempts")
      .select("id, student_note, requested_at, assignment_id, student_target_assignments!inner(id, student_id, students(full_name, student_number), target_template_items(title_dv, title_en))")
      .is("outcome", null)
      .order("requested_at", { ascending: true });
    if (error) { toast.error(error.message); return; }
    setRows((data ?? []) as unknown as PendingRow[]);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function submit() {
    if (!respondFor) return;
    try {
      await respondCheck({ data: { attempt_id: respondFor.id, outcome, note } });
      toast.success(outcome === "completed" ? "Marked as completed" : "Sent back for improvement");
      setRespondFor(null); setNote(""); setOutcome("completed");
      await load();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }

  return (
    <RoleShell role="staff" title="Check Requests">
      <div className="mb-3 flex justify-end">
        <Button size="sm" variant="outline" onClick={load}><RefreshCcw className="h-4 w-4 mr-1" />Refresh</Button>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Pending requests</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {rows.map((r) => {
            const sa = r.student_target_assignments;
            return (
              <div key={r.id} className="flex flex-col gap-2 rounded-md border border-border/60 p-3 sm:flex-row sm:items-center">
                <div className="flex-1">
                  <div className="text-sm font-semibold">{sa?.students?.full_name} <span className="text-xs text-muted-foreground">· {sa?.students?.student_number}</span></div>
                  <div className="font-medium" dir="rtl">{sa?.target_template_items?.title_dv}</div>
                  {sa?.target_template_items?.title_en && <div className="text-xs text-muted-foreground">{sa.target_template_items.title_en}</div>}
                  {r.student_note && <div className="mt-1 text-xs italic">Note: {r.student_note}</div>}
                </div>
                <Button size="sm" onClick={() => setRespondFor(r)}>Review</Button>
              </div>
            );
          })}
          {rows.length === 0 && <div className="p-4 text-sm text-muted-foreground">No pending requests.</div>}
        </CardContent>
      </Card>

      <Dialog open={!!respondFor} onOpenChange={(o) => !o && setRespondFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Review check</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="rounded-md border p-2 text-sm">
              <div className="font-semibold">{respondFor?.student_target_assignments?.students?.full_name}</div>
              <div dir="rtl">{respondFor?.student_target_assignments?.target_template_items?.title_dv}</div>
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" variant={outcome === "completed" ? "default" : "outline"} onClick={() => setOutcome("completed")}>
                <Star className="h-4 w-4 mr-1" /> Completed
              </Button>
              <Button className="flex-1" variant={outcome === "needs_improvement" ? "default" : "outline"} onClick={() => setOutcome("needs_improvement")}>
                Needs improvement
              </Button>
            </div>
            <Textarea placeholder="Comment for the student (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRespondFor(null)}>Cancel</Button>
            <Button onClick={submit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </RoleShell>
  );
}
