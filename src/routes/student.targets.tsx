import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { RoleShell } from "@/components/role-shell";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { CheckCircle2, Clock, Star } from "lucide-react";
import { requestCheck } from "@/lib/targets.functions";

export const Route = createFileRoute("/student/targets")({
  ssr: false,
  head: () => ({ meta: [{ title: "My Targets — Student" }, { name: "robots", content: "noindex" }] }),
  component: Page,
});

type Assignment = {
  id: string;
  status: "assigned" | "in_review" | "completed";
  template_item_id: string;
  term_id: string;
  target_template_items: { title_dv: string; title_en: string | null; star_group: string | null };
  academic_terms: { term_name: string };
};
type Attempt = { id: string; assignment_id: string; teacher_note: string | null; outcome: "completed" | "needs_improvement" | null; requested_at: string; responded_at: string | null };

function Page() {
  const [rows, setRows] = useState<Assignment[]>([]);
  const [attempts, setAttempts] = useState<Record<string, Attempt[]>>({});
  const [reqFor, setReqFor] = useState<Assignment | null>(null);
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    const { data: s } = await supabase.from("students").select("id").maybeSingle();
    if (!s) return;
    const { data } = await supabase
      .from("student_target_assignments")
      .select("id, status, template_item_id, term_id, target_template_items(title_dv, title_en, star_group), academic_terms(term_name)")
      .eq("student_id", s.id)
      .order("created_at", { ascending: true });
    const list = (data ?? []) as unknown as Assignment[];
    setRows(list);
    if (list.length) {
      const { data: att } = await supabase
        .from("target_check_attempts")
        .select("*")
        .in("assignment_id", list.map((r) => r.id))
        .order("requested_at", { ascending: false });
      const map: Record<string, Attempt[]> = {};
      for (const a of (att ?? []) as Attempt[]) (map[a.assignment_id] ||= []).push(a);
      setAttempts(map);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function submitRequest() {
    if (!reqFor) return;
    try {
      await requestCheck({ data: { assignment_id: reqFor.id, note } });
      toast.success("Check request sent to your teacher");
      setReqFor(null); setNote("");
      await load();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }

  const grouped: Record<string, Assignment[]> = {};
  for (const r of rows) (grouped[r.academic_terms?.term_name || "Term"] ||= []).push(r);

  return (
    <RoleShell role="student" title="My Targets">
      <div className="space-y-6">
        {Object.entries(grouped).map(([term, list]) => {
          const done = list.filter((r) => r.status === "completed").length;
          return (
            <Card key={term}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-base">
                  <span>{term}</span>
                  <span className="text-sm text-muted-foreground">{done} / {list.length} completed</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {list.map((r) => {
                  const latest = attempts[r.id]?.[0];
                  return (
                    <div key={r.id} className="flex flex-col gap-2 rounded-md border border-border/60 p-3 sm:flex-row sm:items-center">
                      <div className="flex-1">
                        <div className="font-medium" dir="rtl">{r.target_template_items?.title_dv}</div>
                        {r.target_template_items?.title_en && <div className="text-xs text-muted-foreground">{r.target_template_items.title_en}</div>}
                        {latest?.teacher_note && (
                          <div className="mt-1 text-xs italic text-muted-foreground">Teacher: {latest.teacher_note}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {r.status === "completed" && <Badge className="bg-green-600"><Star className="h-3 w-3 mr-1" />Completed</Badge>}
                        {r.status === "in_review" && <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />In review</Badge>}
                        {r.status === "assigned" && (
                          <Button size="sm" onClick={() => setReqFor(r)}>
                            <CheckCircle2 className="h-4 w-4 mr-1" /> Request check
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}
        {rows.length === 0 && (
          <Card><CardContent className="p-6 text-sm text-muted-foreground">No targets assigned yet.</CardContent></Card>
        )}
      </div>

      <Dialog open={!!reqFor} onOpenChange={(o) => !o && setReqFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Request a check</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <div className="text-sm" dir="rtl">{reqFor?.target_template_items?.title_dv}</div>
            <Textarea placeholder="Optional note for your teacher…" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReqFor(null)}>Cancel</Button>
            <Button onClick={submitRequest}>Send request</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </RoleShell>
  );
}
