import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { RoleShell } from "@/components/role-shell";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CheckCircle2, RotateCcw, Eye, Pencil } from "lucide-react";
import { publishReport, unpublishReport, previewReportSnapshot } from "@/lib/reports.functions";
import { ReportCardView, type ReportSnapshot } from "@/components/report-card-view";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/admin/reports")({
  ssr: false,
  head: () => ({ meta: [{ title: "Reports — Admin" }, { name: "robots", content: "noindex" }] }),
  component: Page,
});

type Row = {
  student_id: string; term_id: string;
  full_name: string; student_number: string | null;
  class_name: string | null;
  report_id: string | null; status: "draft" | "published" | null;
};

function Page() {
  const navigate = useNavigate();
  const [terms, setTerms] = useState<{ id: string; term_name: string }[]>([]);
  const [classes, setClasses] = useState<{ id: string; class_name: string }[]>([]);
  const [termId, setTermId] = useState<string>("");
  const [classId, setClassId] = useState<string>("all");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [snap, setSnap] = useState<ReportSnapshot | null>(null);

  useEffect(() => {
    (async () => {
      const [{ data: t }, { data: c }] = await Promise.all([
        supabase.from("academic_terms").select("id, term_name").order("created_at"),
        supabase.from("classes").select("id, class_name").order("class_name"),
      ]);
      setTerms((t ?? []) as never);
      setClasses((c ?? []) as never);
      if (t?.[0]) setTermId((t[0] as { id: string }).id);
    })();
  }, []);

  const load = useCallback(async () => {
    if (!termId) return;
    let studentsQ = supabase.from("students").select("id, full_name, student_number, class_id, classes(class_name)").eq("status", "active");
    if (classId !== "all") studentsQ = studentsQ.eq("class_id", classId);
    const { data: students } = await studentsQ.order("full_name");
    const ids = ((students ?? []) as { id: string }[]).map((s) => s.id);
    const { data: reports } = ids.length
      ? await supabase.from("progress_reports").select("id, student_id, status").eq("term_id", termId).in("student_id", ids)
      : { data: [] };
    const map = new Map<string, { id: string; status: "draft" | "published" }>();
    for (const r of (reports ?? []) as { id: string; student_id: string; status: "draft" | "published" }[]) map.set(r.student_id, { id: r.id, status: r.status });
    const list: Row[] = ((students ?? []) as never[]).map((s) => {
      const st = s as { id: string; full_name: string; student_number: string | null; classes: { class_name: string | null } | null };
      const r = map.get(st.id);
      return { student_id: st.id, term_id: termId, full_name: st.full_name, student_number: st.student_number, class_name: st.classes?.class_name ?? null, report_id: r?.id ?? null, status: r?.status ?? null };
    });
    setRows(q ? list.filter((r) => r.full_name.toLowerCase().includes(q.toLowerCase()) || (r.student_number ?? "").toLowerCase().includes(q.toLowerCase())) : list);
  }, [termId, classId, q]);

  useEffect(() => { load(); }, [load]);

  async function handlePublish(r: Row) {
    try { await publishReport({ data: { student_id: r.student_id, term_id: r.term_id } }); toast.success("Published"); await load(); }
    catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }
  async function handleUnpublish(r: Row) {
    if (!r.report_id) return;
    try { await unpublishReport({ data: { report_id: r.report_id } }); toast.success("Unpublished"); await load(); }
    catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }
  async function preview(r: Row) {
    try {
      if (r.status === "published" && r.report_id) {
        const { data } = await supabase.from("progress_reports").select("snapshot").eq("id", r.report_id).single();
        setSnap((data as { snapshot: ReportSnapshot }).snapshot);
      } else {
        const s = await previewReportSnapshot({ data: { student_id: r.student_id, term_id: r.term_id } });
        setSnap(s as ReportSnapshot);
      }
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }

  return (
    <RoleShell role="admin" title="Progress Reports">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr]">
            <Select value={termId} onValueChange={setTermId}>
              <SelectTrigger><SelectValue placeholder="Term" /></SelectTrigger>
              <SelectContent>{terms.map((t) => <SelectItem key={t.id} value={t.id}>{t.term_name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={classId} onValueChange={setClassId}>
              <SelectTrigger><SelectValue placeholder="Class" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All classes</SelectItem>
                {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.class_name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input placeholder="Search student name or number…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <div className="mt-4 divide-y rounded-md border bg-card">
        {rows.map((r) => (
          <div key={r.student_id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
            <div className="flex-1">
              <div className="font-medium">{r.full_name} <span className="text-xs text-muted-foreground">{r.student_number}</span></div>
              <div className="text-xs text-muted-foreground">{r.class_name ?? "—"}</div>
            </div>
            <div className="flex items-center gap-2">
              {r.status === "published" && <Badge className="bg-green-600">Published</Badge>}
              {r.status === "draft" && <Badge variant="secondary">Draft</Badge>}
              {!r.status && <Badge variant="outline">Not started</Badge>}
              <Button size="sm" variant="ghost" onClick={() => preview(r)}><Eye className="h-4 w-4" /></Button>
              <Button size="sm" variant="outline" onClick={() => navigate({ to: "/staff/term-report/$studentId", params: { studentId: r.student_id } })}>
                <Pencil className="h-4 w-4 mr-1" />Edit
              </Button>
              {r.status !== "published" ? (
                <Button size="sm" onClick={() => handlePublish(r)}><CheckCircle2 className="h-4 w-4 mr-1" />Publish</Button>
              ) : (
                <Button size="sm" variant="outline" onClick={() => handleUnpublish(r)}><RotateCcw className="h-4 w-4 mr-1" />Unpublish</Button>
              )}
            </div>
          </div>
        ))}
        {rows.length === 0 && <div className="p-6 text-sm text-muted-foreground">No students match.</div>}
      </div>

      <Dialog open={!!snap} onOpenChange={(o) => !o && setSnap(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader><DialogTitle>Report preview</DialogTitle></DialogHeader>
          <div className="max-h-[75vh] overflow-auto">
            {snap && (
              <>
                <div className="mb-2 flex justify-end no-print"><Button size="sm" onClick={() => window.print()}>Print / Save as PDF</Button></div>
                <ReportCardView snap={snap} />
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </RoleShell>
  );
}
