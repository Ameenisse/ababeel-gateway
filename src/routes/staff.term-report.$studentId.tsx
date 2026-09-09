import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { RoleShell } from "@/components/role-shell";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Save, Eye, CheckCircle2, AlertCircle, Clock, Star } from "lucide-react";
import {
  saveTermReport,
  previewReportSnapshot,
  validateTermReportCompletion,
} from "@/lib/reports.functions";
import { ReportCardView, type ReportSnapshot } from "@/components/report-card-view";

export const Route = createFileRoute("/staff/term-report/$studentId")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Term Report & Assessment — Staff" }, { name: "robots", content: "noindex" }],
  }),
  component: Page,
});

type Term = { id: string; term_name: string };
type BadgeItem = {
  id: string;
  code: string;
  name: string;
  icon: string | null;
  color: string | null;
};

type ValidationState = {
  total: number;
  completed: number;
  progressing: number;
  practiceAgain: number;
  notStarted: number;
  exempted: number;
  pendingRequests: number;
  requiredWithoutResult: number;
  missingTeacherComment: boolean;
  canPublish: boolean;
};

function Page() {
  const { studentId } = Route.useParams();
  const navigate = useNavigate();
  const [student, setStudent] = useState<{
    full_name: string;
    student_number: string | null;
  } | null>(null);
  const [terms, setTerms] = useState<Term[]>([]);
  const [termId, setTermId] = useState<string>("");
  const [badges, setBadges] = useState<BadgeItem[]>([]);
  const [selectedBadges, setSelectedBadges] = useState<Set<string>>(new Set());
  const [teacherComment, setTeacherComment] = useState("");
  const [parentComment, setParentComment] = useState("");
  const [parentName, setParentName] = useState("");
  const [snap, setSnap] = useState<ReportSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [validation, setValidation] = useState<ValidationState | null>(null);

  useEffect(() => {
    (async () => {
      const [{ data: s }, { data: t }, { data: b }] = await Promise.all([
        supabase.from("students").select("full_name, student_number").eq("id", studentId).single(),
        supabase.from("academic_terms").select("id, term_name").order("created_at"),
        supabase
          .from("badges")
          .select("id, code, name, icon, color")
          .eq("is_active", true)
          .order("name"),
      ]);
      setStudent(s as never);
      setTerms((t ?? []) as Term[]);
      setBadges((b ?? []) as BadgeItem[]);
      if (t?.[0]) setTermId((t[0] as { id: string }).id);
    })();
  }, [studentId]);

  const loadExisting = useCallback(
    async (tid: string) => {
      if (!tid) return;
      const [{ data: report }, { data: sb }, val] = await Promise.all([
        supabase
          .from("progress_reports")
          .select("teacher_comment, parent_feedback")
          .eq("student_id", studentId)
          .eq("term_id", tid)
          .maybeSingle(),
        supabase
          .from("student_badges")
          .select("badge_id")
          .eq("student_id", studentId)
          .eq("term_id", tid),
        validateTermReportCompletion({ data: { student_id: studentId, term_id: tid } }).catch(
          () => null,
        ),
      ]);
      setTeacherComment(
        (report as { teacher_comment: string | null } | null)?.teacher_comment ?? "",
      );
      const pf =
        (report as { parent_feedback: { parent_comment?: string; parent_name?: string } } | null)
          ?.parent_feedback ?? {};
      setParentComment(pf.parent_comment ?? "");
      setParentName(pf.parent_name ?? "");
      setSelectedBadges(new Set(((sb ?? []) as { badge_id: string }[]).map((r) => r.badge_id)));
      if (val) setValidation(val as ValidationState);
    },
    [studentId],
  );

  useEffect(() => {
    if (termId) loadExisting(termId);
  }, [termId, loadExisting]);

  async function handleSave() {
    setBusy(true);
    try {
      await saveTermReport({
        data: {
          student_id: studentId,
          term_id: termId,
          teacher_comment: teacherComment,
          badge_ids: Array.from(selectedBadges),
          parent_comment: parentComment,
          parent_name: parentName,
        },
      });
      toast.success("Report saved as draft");
      await loadExisting(termId);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function handlePreview() {
    try {
      const s = await previewReportSnapshot({ data: { student_id: studentId, term_id: termId } });
      const enriched: ReportSnapshot = {
        ...(s as ReportSnapshot),
        teacher_comment: teacherComment,
        parent_feedback: { parent_comment: parentComment, parent_name: parentName },
        badges: badges
          .filter((b) => selectedBadges.has(b.id))
          .map(({ code, name, icon, color }) => ({ code, name, icon, color })),
      };
      setSnap(enriched);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <RoleShell role="staff" title="Term Report & Assessment">
      <div className="mb-4">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/staff/dashboard" })}>
          ← Back to Dashboard
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Input Form */}
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="border-b pb-3">
            <CardTitle className="text-base font-semibold flex items-center justify-between">
              <span>
                {student?.full_name ?? "Student"}
                {student?.student_number && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    ({student.student_number})
                  </span>
                )}
              </span>
              <Badge variant="outline" className="text-xs">
                Term Evaluation
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div>
              <Label>Academic Term</Label>
              <Select value={termId} onValueChange={setTermId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select term" />
                </SelectTrigger>
                <SelectContent>
                  {terms.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.term_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Section 15: Term Readiness Validation Banner */}
            {validation && (
              <div className="rounded-xl border border-border/80 bg-slate-50/60 p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-slate-800 uppercase tracking-wide">
                    Term Readiness Checklist
                  </span>
                  {validation.pendingRequests > 0 ? (
                    <Badge variant="destructive" className="text-[10px] px-2 py-0">
                      <Clock className="h-3 w-3 mr-1" />
                      {validation.pendingRequests} Pending Requests
                    </Badge>
                  ) : validation.canPublish ? (
                    <Badge className="bg-emerald-600 text-white text-[10px] px-2 py-0">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Ready for Publish
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[10px] px-2 py-0">
                      In Progress
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2 rounded bg-white border">
                    <div className="font-bold text-slate-900">{validation.total}</div>
                    <div className="text-[10px] text-muted-foreground">Total Targets</div>
                  </div>
                  <div className="p-2 rounded bg-emerald-50 border border-emerald-100">
                    <div className="font-bold text-emerald-700 flex items-center justify-center gap-0.5">
                      <Star className="h-3 w-3 fill-red-500 text-red-500" />
                      {validation.completed}
                    </div>
                    <div className="text-[10px] text-emerald-800">Completed Stars</div>
                  </div>
                  <div className="p-2 rounded bg-white border">
                    <div className="font-bold text-slate-900">
                      {validation.progressing + validation.practiceAgain}
                    </div>
                    <div className="text-[10px] text-muted-foreground">Practicing</div>
                  </div>
                </div>

                {validation.pendingRequests > 0 && (
                  <div className="text-xs text-rose-700 bg-rose-50 p-2 rounded border border-rose-200 flex items-start gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5 text-rose-600 shrink-0 mt-0.5" />
                    <span>
                      Please assess all pending check requests in the Check Requests queue before
                      finalizing this report card.
                    </span>
                  </div>
                )}
              </div>
            )}

            <div>
              <Label>Teacher's Overall Remarks & Assessment</Label>
              <Textarea
                rows={4}
                placeholder="Detailed remarks on recitation fluency, tajweed accuracy, discipline, and attendance..."
                value={teacherComment}
                onChange={(e) => setTeacherComment(e.target.value)}
                className="mt-1 text-sm"
              />
            </div>

            <div>
              <Label>Honors & Badges Awarded</Label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 mt-1">
                {badges.map((b) => (
                  <label
                    key={b.id}
                    className="flex cursor-pointer items-center gap-2 rounded-lg border border-border/60 p-2.5 text-sm hover:bg-slate-50 transition-colors"
                  >
                    <Checkbox
                      checked={selectedBadges.has(b.id)}
                      onCheckedChange={(v) => {
                        const s = new Set(selectedBadges);
                        if (v) s.add(b.id);
                        else s.delete(b.id);
                        setSelectedBadges(s);
                      }}
                    />
                    <span className="text-lg">{b.icon ?? "🏅"}</span>
                    <span className="font-medium text-slate-800 text-xs">{b.name}</span>
                  </label>
                ))}
                {badges.length === 0 && (
                  <div className="text-xs text-muted-foreground">No badges configured.</div>
                )}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 pt-2 border-t">
              <div>
                <Label>Parent / Guardian Name</Label>
                <Input
                  placeholder="Guardian's full name"
                  value={parentName}
                  onChange={(e) => setParentName(e.target.value)}
                  className="mt-1 text-sm"
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Parent / Guardian Feedback (optional)</Label>
                <Textarea
                  rows={2}
                  placeholder="Comments submitted by parent..."
                  value={parentComment}
                  onChange={(e) => setParentComment(e.target.value)}
                  className="mt-1 text-sm"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button onClick={handleSave} disabled={busy || !termId}>
                <Save className="h-4 w-4 mr-1.5" />
                Save Draft
              </Button>
              <Button variant="outline" onClick={handlePreview} disabled={!termId}>
                <Eye className="h-4 w-4 mr-1.5" />
                Live Preview
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Once saved, administrators can review and publish the formal immutable report card.
            </p>
          </CardContent>
        </Card>

        {/* Right: Preview Card */}
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="border-b pb-3 flex items-center justify-between">
            <CardTitle className="text-base font-semibold">Report Card Preview</CardTitle>
            {snap && (
              <Button size="sm" variant="outline" onClick={() => window.print()}>
                Print Preview
              </Button>
            )}
          </CardHeader>
          <CardContent className="p-4">
            {snap ? (
              <div className="max-h-[78vh] overflow-y-auto rounded-lg border bg-slate-100/50 p-2">
                <ReportCardView snap={snap} />
              </div>
            ) : (
              <div className="p-16 text-center text-sm text-muted-foreground space-y-2">
                <Eye className="h-10 w-10 mx-auto text-slate-300 stroke-1" />
                <div className="font-medium text-slate-700">Preview not generated</div>
                <p className="text-xs max-w-xs mx-auto">
                  Click "Live Preview" to render the complete target checklist, stars, and
                  attendance records.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </RoleShell>
  );
}
