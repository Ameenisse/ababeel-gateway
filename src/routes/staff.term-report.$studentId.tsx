import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { RoleShell } from "@/components/role-shell";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Save, Eye } from "lucide-react";
import { saveTermReport, previewReportSnapshot } from "@/lib/reports.functions";
import { ReportCardView, type ReportSnapshot } from "@/components/report-card-view";

export const Route = createFileRoute("/staff/term-report/$studentId")({
  ssr: false,
  head: () => ({ meta: [{ title: "Term Report — Staff" }, { name: "robots", content: "noindex" }] }),
  component: Page,
});

type Term = { id: string; term_name: string };
type Badge = { id: string; code: string; name: string; icon: string | null; color: string | null };

function Page() {
  const { studentId } = Route.useParams();
  const navigate = useNavigate();
  const [student, setStudent] = useState<{ full_name: string; student_number: string | null } | null>(null);
  const [terms, setTerms] = useState<Term[]>([]);
  const [termId, setTermId] = useState<string>("");
  const [badges, setBadges] = useState<Badge[]>([]);
  const [selectedBadges, setSelectedBadges] = useState<Set<string>>(new Set());
  const [teacherComment, setTeacherComment] = useState("");
  const [parentComment, setParentComment] = useState("");
  const [parentName, setParentName] = useState("");
  const [snap, setSnap] = useState<ReportSnapshot | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data: s }, { data: t }, { data: b }] = await Promise.all([
        supabase.from("students").select("full_name, student_number").eq("id", studentId).single(),
        supabase.from("academic_terms").select("id, term_name").order("created_at"),
        supabase.from("badges").select("id, code, name, icon, color").eq("is_active", true).order("name"),
      ]);
      setStudent(s as never);
      setTerms((t ?? []) as Term[]);
      setBadges((b ?? []) as Badge[]);
      if (t?.[0]) setTermId((t[0] as { id: string }).id);
    })();
  }, [studentId]);

  const loadExisting = useCallback(async (tid: string) => {
    if (!tid) return;
    const [{ data: report }, { data: sb }] = await Promise.all([
      supabase.from("progress_reports").select("teacher_comment, parent_feedback").eq("student_id", studentId).eq("term_id", tid).maybeSingle(),
      supabase.from("student_badges").select("badge_id").eq("student_id", studentId).eq("term_id", tid),
    ]);
    setTeacherComment((report as { teacher_comment: string | null } | null)?.teacher_comment ?? "");
    const pf = ((report as { parent_feedback: { parent_comment?: string; parent_name?: string } } | null)?.parent_feedback) ?? {};
    setParentComment(pf.parent_comment ?? "");
    setParentName(pf.parent_name ?? "");
    setSelectedBadges(new Set(((sb ?? []) as { badge_id: string }[]).map((r) => r.badge_id)));
  }, [studentId]);

  useEffect(() => { if (termId) loadExisting(termId); }, [termId, loadExisting]);

  async function handleSave() {
    setBusy(true);
    try {
      await saveTermReport({ data: {
        student_id: studentId, term_id: termId,
        teacher_comment: teacherComment,
        badge_ids: Array.from(selectedBadges),
        parent_comment: parentComment, parent_name: parentName,
      }});
      toast.success("Report saved as draft");
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }

  async function handlePreview() {
    try {
      const s = await previewReportSnapshot({ data: { student_id: studentId, term_id: termId } });
      // enrich with in-form values so the preview reflects unsaved edits
      const enriched: ReportSnapshot = {
        ...(s as ReportSnapshot),
        teacher_comment: teacherComment,
        parent_feedback: { parent_comment: parentComment, parent_name: parentName },
        badges: badges.filter((b) => selectedBadges.has(b.id)).map(({ code, name, icon, color }) => ({ code, name, icon, color })),
      };
      setSnap(enriched);
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }

  return (
    <RoleShell role="staff" title="Term Report">
      <div className="mb-3">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/staff/dashboard" })}>← Back</Button>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {student?.full_name ?? "Student"}
              {student?.student_number && <span className="ml-2 text-sm text-muted-foreground">({student.student_number})</span>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Term</Label>
              <Select value={termId} onValueChange={setTermId}>
                <SelectTrigger><SelectValue placeholder="Select term" /></SelectTrigger>
                <SelectContent>{terms.map((t) => <SelectItem key={t.id} value={t.id}>{t.term_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Teacher's comment</Label>
              <Textarea rows={4} value={teacherComment} onChange={(e) => setTeacherComment(e.target.value)} />
            </div>
            <div>
              <Label>Awards this term</Label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {badges.map((b) => (
                  <label key={b.id} className="flex cursor-pointer items-center gap-2 rounded-md border border-border/60 p-2 text-sm">
                    <Checkbox checked={selectedBadges.has(b.id)} onCheckedChange={(v) => {
                      const s = new Set(selectedBadges);
                      v ? s.add(b.id) : s.delete(b.id);
                      setSelectedBadges(s);
                    }} />
                    <span className="text-lg">{b.icon ?? "🏅"}</span>
                    <span>{b.name}</span>
                  </label>
                ))}
                {badges.length === 0 && <div className="text-sm text-muted-foreground">No badges configured.</div>}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Parent name</Label>
                <Input value={parentName} onChange={(e) => setParentName(e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <Label>Parent / guardian comment</Label>
                <Textarea rows={3} value={parentComment} onChange={(e) => setParentComment(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={busy || !termId}><Save className="h-4 w-4 mr-1" />Save draft</Button>
              <Button variant="outline" onClick={handlePreview} disabled={!termId}><Eye className="h-4 w-4 mr-1" />Preview</Button>
            </div>
            <p className="text-xs text-muted-foreground">An admin will publish the report from the Reports page.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Preview</CardTitle></CardHeader>
          <CardContent>
            {snap ? <div className="max-h-[70vh] overflow-auto"><ReportCardView snap={snap} /></div>
              : <div className="text-sm text-muted-foreground">Click "Preview" to render the report card from the current form values.</div>}
          </CardContent>
        </Card>
      </div>
    </RoleShell>
  );
}
