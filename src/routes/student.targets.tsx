import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useMemo } from "react";
import { RoleShell } from "@/components/role-shell";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Star,
  Clock,
  History,
  Send,
  XCircle,
  Sparkles,
  BookOpen,
  Calendar,
  AlertCircle,
} from "lucide-react";
import {
  submitTargetCheckRequest,
  cancelTargetCheckRequest,
  getTargetCheckHistory,
} from "@/lib/targets.functions";
import {
  type TargetStatus,
  type CheckResult,
  TARGET_STATUS_CONFIG,
  CHECK_RESULT_CONFIG,
} from "@/types/targets";

export const Route = createFileRoute("/student/targets")({
  ssr: false,
  head: () => ({
    meta: [{ title: "My Targets — Student" }, { name: "robots", content: "noindex" }],
  }),
  component: Page,
});

type AssignmentItem = {
  id: string;
  current_status: TargetStatus;
  status?: string;
  template_item_id: string;
  term_id: string;
  attempt_count: number;
  last_check_date: string | null;
  last_teacher_comment: string | null;
  completed_date: string | null;
  achieved_points: number;
  target_template_items: {
    id: string;
    title_dv?: string;
    title_en?: string | null;
    target_title?: string | null;
    target_title_dhivehi?: string | null;
    arabic_text?: string | null;
    star_group?: string | null;
    section_id?: string | null;
    instructions?: string | null;
    target_template_sections?: {
      section_name: string;
      section_name_dhivehi?: string | null;
    } | null;
  };
  academic_terms: { id: string; term_name: string };
  open_request?: {
    id: string;
    request_status: string;
    requested_at: string;
    preferred_check_date: string | null;
    student_message: string | null;
  } | null;
};

type HistoryAttempt = {
  id: string;
  attempt_number: number;
  checked_at: string;
  result: CheckResult;
  teacher_comment: string | null;
  score: number | null;
  recommendation: string | null;
  next_check_date: string | null;
  teacher_name: string;
};

function Page() {
  const [rows, setRows] = useState<AssignmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("all");
  const [selectedTerm, setSelectedTerm] = useState<string>("all");

  // Check request dialog
  const [reqTarget, setReqTarget] = useState<AssignmentItem | null>(null);
  const [studentMessage, setStudentMessage] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [submittingReq, setSubmittingReq] = useState(false);

  // History timeline dialog
  const [historyTarget, setHistoryTarget] = useState<AssignmentItem | null>(null);
  const [historyAttempts, setHistoryAttempts] = useState<HistoryAttempt[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: s } = await supabase.from("students").select("id").maybeSingle();
      if (!s) {
        setLoading(false);
        return;
      }

      // Load assignments
      const { data: assignments, error } = await supabase
        .from("student_target_assignments")
        .select(
          `
          id,
          current_status,
          status,
          template_item_id,
          term_id,
          attempt_count,
          last_check_date,
          last_teacher_comment,
          completed_date,
          achieved_points,
          target_template_items (
            id,
            title_dv,
            title_en,
            target_title,
            target_title_dhivehi,
            arabic_text,
            star_group,
            section_id,
            instructions,
            target_template_sections (
              section_name,
              section_name_dhivehi
            )
          ),
          academic_terms (
            id,
            term_name
          )
        `,
        )
        .eq("student_id", s.id)
        .order("created_at", { ascending: true });

      if (error) throw error;

      // Load open requests
      const assignmentIds = (assignments ?? []).map((a) => a.id);
      const openRequestsMap: Record<string, AssignmentItem["open_request"]> = {};

      if (assignmentIds.length > 0) {
        const { data: requests } = await supabase
          .from("target_check_requests")
          .select(
            "id, student_target_assignment_id, request_status, requested_at, preferred_check_date, student_message",
          )
          .in("student_target_assignment_id", assignmentIds)
          .in("request_status", ["pending", "accepted", "under_checking"]);

        if (requests) {
          for (const req of requests) {
            openRequestsMap[req.student_target_assignment_id] = req;
          }
        }
      }

      const formatted: AssignmentItem[] = ((assignments ?? []) as unknown as AssignmentItem[]).map(
        (a) => ({
          ...a,
          current_status: (a.current_status ||
            (a.status === "completed" ? "completed" : "not_started")) as TargetStatus,
          open_request: openRequestsMap[a.id] || null,
        }),
      );

      setRows(formatted);
    } catch (e: unknown) {
      console.error(e);
      toast.error("Failed to load targets");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Handle request check submission
  async function handleSubmitRequest() {
    if (!reqTarget) return;
    setSubmittingReq(true);
    try {
      await submitTargetCheckRequest({
        data: {
          assignment_id: reqTarget.id,
          student_message: studentMessage.trim() || null,
          preferred_check_date: preferredDate || null,
        },
      });
      toast.success("Check request sent to teacher!");
      setReqTarget(null);
      setStudentMessage("");
      setPreferredDate("");
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to submit request");
    } finally {
      setSubmittingReq(false);
    }
  }

  // Handle cancel request
  async function handleCancelRequest(requestId: string) {
    if (!confirm("Are you sure you want to cancel this check request?")) return;
    try {
      await cancelTargetCheckRequest({
        data: { request_id: requestId, reason: "Cancelled by student" },
      });
      toast.success("Check request cancelled");
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to cancel request");
    }
  }

  // Load history attempts
  async function openHistory(target: AssignmentItem) {
    setHistoryTarget(target);
    setLoadingHistory(true);
    try {
      const data = await getTargetCheckHistory({ data: { assignment_id: target.id } });
      setHistoryAttempts((data as HistoryAttempt[]) || []);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to load check history");
      setHistoryAttempts([]);
    } finally {
      setLoadingHistory(false);
    }
  }

  // Unique terms
  const termsList = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rows) {
      if (r.academic_terms?.id) {
        map.set(r.academic_terms.id, r.academic_terms.term_name);
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [rows]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (selectedTerm !== "all" && r.term_id !== selectedTerm) return false;
      if (activeTab === "completed") return r.current_status === "completed";
      if (activeTab === "pending")
        return r.current_status === "check_requested" || r.current_status === "under_checking";
      if (activeTab === "practice")
        return (
          r.current_status === "practicing" ||
          r.current_status === "practice_again" ||
          r.current_status === "progressing"
        );
      return true;
    });
  }, [rows, selectedTerm, activeTab]);

  // Group by Term and Category / Section
  const groupedByTermAndSection = useMemo(() => {
    const res: Record<string, Record<string, AssignmentItem[]>> = {};
    for (const r of filteredRows) {
      const termName = r.academic_terms?.term_name || "Academic Term";
      const it = r.target_template_items;
      const secName =
        it?.target_template_sections?.section_name || it?.star_group || "General Targets";

      if (!res[termName]) res[termName] = {};
      if (!res[termName][secName]) res[termName][secName] = [];
      res[termName][secName].push(r);
    }
    return res;
  }, [filteredRows]);

  // Overall statistics
  const totalCount = rows.length;
  const completedCount = rows.filter((r) => r.current_status === "completed").length;
  const pendingCount = rows.filter(
    (r) => r.current_status === "check_requested" || r.current_status === "under_checking",
  ).length;

  return (
    <RoleShell role="student" title="My Targets">
      <div className="space-y-6">
        {/* Top Summary Banner */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card className="border-sky-100 bg-sky-50/40">
            <CardContent className="p-4">
              <div className="text-xs text-sky-700 font-medium">Total Assigned</div>
              <div className="text-2xl font-bold text-sky-950 mt-1">{totalCount}</div>
            </CardContent>
          </Card>
          <Card className="border-emerald-100 bg-emerald-50/40">
            <CardContent className="p-4">
              <div className="text-xs text-emerald-700 font-medium flex items-center gap-1">
                <Star className="h-3.5 w-3.5 fill-red-500 text-red-500" />
                Completed Stars
              </div>
              <div className="text-2xl font-bold text-emerald-950 mt-1">{completedCount}</div>
            </CardContent>
          </Card>
          <Card className="border-blue-100 bg-blue-50/40">
            <CardContent className="p-4">
              <div className="text-xs text-blue-700 font-medium">Under Review</div>
              <div className="text-2xl font-bold text-blue-950 mt-1">{pendingCount}</div>
            </CardContent>
          </Card>
          <Card className="border-amber-100 bg-amber-50/40">
            <CardContent className="p-4">
              <div className="text-xs text-amber-700 font-medium">Completion Rate</div>
              <div className="text-2xl font-bold text-amber-950 mt-1">
                {totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0}%
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full sm:w-auto">
            <TabsList className="grid grid-cols-4 w-full sm:w-auto">
              <TabsTrigger value="all">All ({totalCount})</TabsTrigger>
              <TabsTrigger value="pending">Reviewing ({pendingCount})</TabsTrigger>
              <TabsTrigger value="practice">Practicing</TabsTrigger>
              <TabsTrigger value="completed">Completed ({completedCount})</TabsTrigger>
            </TabsList>
          </Tabs>

          {termsList.length > 1 && (
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground whitespace-nowrap">
                Filter Term:
              </Label>
              <select
                value={selectedTerm}
                onChange={(e) => setSelectedTerm(e.target.value)}
                className="text-xs rounded-md border border-input bg-background px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="all">All Terms</option>
                {termsList.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Target Lists grouped by Term & Section */}
        {loading ? (
          <div className="p-12 text-center text-sm text-muted-foreground">Loading targets...</div>
        ) : Object.keys(groupedByTermAndSection).length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center space-y-3">
              <BookOpen className="h-10 w-10 mx-auto text-muted-foreground stroke-1" />
              <div className="font-medium text-slate-700">No targets found in this view</div>
              <p className="text-xs text-muted-foreground">
                Your teachers will assign target practice items for each academic term.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {Object.entries(groupedByTermAndSection).map(([termName, sections]) => (
              <div key={termName} className="space-y-4">
                <div className="flex items-center gap-2 border-b pb-2">
                  <BookOpen className="h-5 w-5 text-primary" />
                  <h2 className="font-display text-lg font-bold text-slate-900">{termName}</h2>
                </div>

                {Object.entries(sections).map(([secName, targets]) => (
                  <Card key={secName} className="border-border/70 overflow-hidden shadow-sm">
                    <CardHeader className="bg-slate-50/70 border-b border-border/50 py-3 px-4">
                      <CardTitle className="text-sm font-semibold flex items-center justify-between text-slate-800">
                        <span>{secName}</span>
                        <span className="text-xs font-normal text-muted-foreground">
                          {targets.filter((t) => t.current_status === "completed").length} /{" "}
                          {targets.length} completed
                        </span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 divide-y divide-border/50">
                      {targets.map((t) => {
                        const it = t.target_template_items;
                        const statusConfig = TARGET_STATUS_CONFIG[t.current_status];
                        const isCompleted = t.current_status === "completed";
                        const isPending =
                          t.current_status === "check_requested" ||
                          t.current_status === "under_checking";

                        return (
                          <div
                            key={t.id}
                            className={`p-4 transition-colors flex flex-col sm:flex-row sm:items-start justify-between gap-4 ${
                              isCompleted ? "bg-emerald-50/20" : ""
                            }`}
                          >
                            {/* Left: Star + Titles */}
                            <div className="flex items-start gap-3 flex-1">
                              {/* Bright Red Star if Completed (Section 23) */}
                              <div className="shrink-0 pt-0.5">
                                {isCompleted ? (
                                  <div
                                    className="p-1 rounded-full bg-red-50 text-red-500"
                                    title="Achieved"
                                  >
                                    <Star className="h-6 w-6 fill-red-500 text-red-500 drop-shadow-sm" />
                                  </div>
                                ) : (
                                  <div className="p-1 text-slate-300" title="Target in progress">
                                    <Star className="h-6 w-6 stroke-[1.5]" />
                                  </div>
                                )}
                              </div>

                              <div className="space-y-1.5 flex-1">
                                {/* Arabic Text with Diacritics */}
                                {it?.arabic_text && (
                                  <div
                                    className="text-right font-arabic text-xl font-bold text-slate-900 leading-relaxed"
                                    dir="rtl"
                                  >
                                    {it.arabic_text}
                                  </div>
                                )}

                                {/* Dhivehi Title */}
                                <div
                                  className="text-right font-dhivehi text-lg font-semibold text-slate-900"
                                  dir="rtl"
                                >
                                  {it?.target_title_dhivehi || it?.title_dv || "Target"}
                                </div>

                                {/* English subtitle */}
                                {(it?.target_title || it?.title_en) && (
                                  <div className="text-xs text-slate-600 font-medium">
                                    {it?.target_title || it?.title_en}
                                  </div>
                                )}

                                {/* Instructions / description */}
                                {it?.instructions && (
                                  <div className="text-xs text-muted-foreground bg-slate-50 p-2 rounded border border-slate-100 mt-1">
                                    <span className="font-semibold text-slate-700">Guide: </span>
                                    {it.instructions}
                                  </div>
                                )}

                                {/* Status details / Feedback */}
                                <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                                  <Badge
                                    variant="outline"
                                    className={`text-xs px-2.5 py-0.5 rounded-full ${statusConfig.badgeClass}`}
                                  >
                                    {statusConfig.label} ({statusConfig.dhivehi})
                                  </Badge>

                                  {t.attempt_count > 0 && (
                                    <span className="text-slate-500 flex items-center gap-1">
                                      Attempts:{" "}
                                      <strong className="text-slate-700">{t.attempt_count}</strong>
                                    </span>
                                  )}

                                  {t.last_check_date && (
                                    <span className="text-slate-400">
                                      Checked: {new Date(t.last_check_date).toLocaleDateString()}
                                    </span>
                                  )}
                                </div>

                                {/* Last Teacher Comment */}
                                {t.last_teacher_comment && (
                                  <div className="mt-2 text-xs bg-amber-50/70 border border-amber-200/80 rounded p-2 text-amber-900">
                                    <span className="font-semibold text-amber-950">
                                      Teacher's feedback:{" "}
                                    </span>
                                    {t.last_teacher_comment}
                                  </div>
                                )}

                                {/* Open Request Status Alert */}
                                {t.open_request && (
                                  <div className="mt-2 flex items-center justify-between text-xs bg-blue-50/80 border border-blue-200 rounded p-2 text-blue-900">
                                    <div className="flex items-center gap-1.5">
                                      <Clock className="h-3.5 w-3.5 text-blue-600 animate-pulse" />
                                      <span>
                                        Requested on{" "}
                                        {new Date(t.open_request.requested_at).toLocaleDateString()}
                                        {t.open_request.preferred_check_date && (
                                          <> (Preferred: {t.open_request.preferred_check_date})</>
                                        )}
                                      </span>
                                    </div>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 text-[11px] text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                                      onClick={() => handleCancelRequest(t.open_request!.id)}
                                    >
                                      Cancel Request
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Right: Actions */}
                            <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0 pt-2 sm:pt-0">
                              {isCompleted ? (
                                <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-semibold bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                                  <Star className="h-3.5 w-3.5 fill-red-500 text-red-500" />
                                  Mastered
                                </div>
                              ) : isPending ? (
                                <Badge
                                  variant="secondary"
                                  className="text-xs bg-blue-100 text-blue-800"
                                >
                                  Waiting for Teacher
                                </Badge>
                              ) : (
                                <Button
                                  size="sm"
                                  className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs shadow-sm"
                                  onClick={() => {
                                    setReqTarget(t);
                                    setStudentMessage("");
                                    setPreferredDate("");
                                  }}
                                >
                                  <Send className="h-3.5 w-3.5 mr-1" />
                                  Request Check
                                </Button>
                              )}

                              {/* View Check History */}
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-xs text-slate-500 hover:text-slate-800 h-8"
                                onClick={() => openHistory(t)}
                              >
                                <History className="h-3.5 w-3.5 mr-1" />
                                History
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Request Check Dialog */}
      <Dialog open={Boolean(reqTarget)} onOpenChange={(open) => !open && setReqTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Request Target Check
            </DialogTitle>
          </DialogHeader>

          {reqTarget && (
            <div className="space-y-4 text-sm">
              <div className="rounded-lg bg-slate-50 p-3 border space-y-1">
                <div className="text-xs text-muted-foreground">Target to check:</div>
                <div className="font-dhivehi font-bold text-base text-right" dir="rtl">
                  {reqTarget.target_template_items?.target_title_dhivehi ||
                    reqTarget.target_template_items?.title_dv}
                </div>
                {reqTarget.target_template_items?.arabic_text && (
                  <div className="font-arabic font-bold text-lg text-right text-sky-900" dir="rtl">
                    {reqTarget.target_template_items.arabic_text}
                  </div>
                )}
                {reqTarget.target_template_items?.title_en && (
                  <div className="text-xs text-slate-600">
                    {reqTarget.target_template_items.title_en}
                  </div>
                )}
              </div>

              <div>
                <Label htmlFor="req-date">Preferred Check Date (optional)</Label>
                <Input
                  id="req-date"
                  type="date"
                  value={preferredDate}
                  onChange={(e) => setPreferredDate(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="req-msg">Note for Teacher (optional)</Label>
                <Textarea
                  id="req-msg"
                  rows={3}
                  placeholder="e.g. I have practiced 10 times and ready to recite without mistakes..."
                  value={studentMessage}
                  onChange={(e) => setStudentMessage(e.target.value)}
                  className="mt-1 text-sm"
                />
              </div>

              <div className="text-xs text-slate-500 bg-sky-50/60 p-2.5 rounded border border-sky-100 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-sky-600 shrink-0 mt-0.5" />
                <span>
                  Once submitted, your teacher will be notified to assess your recitation and mark
                  your achievement.
                </span>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setReqTarget(null)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitRequest} disabled={submittingReq}>
              {submittingReq ? "Submitting..." : "Send Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Timeline Dialog (Section 8) */}
      <Dialog
        open={Boolean(historyTarget)}
        onOpenChange={(open) => !open && setHistoryTarget(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Check History & Feedback
            </DialogTitle>
          </DialogHeader>

          {historyTarget && (
            <div className="space-y-4">
              <div className="border-b pb-2">
                <div className="text-xs text-muted-foreground">Target:</div>
                <div className="font-dhivehi font-bold text-base" dir="rtl">
                  {historyTarget.target_template_items?.target_title_dhivehi ||
                    historyTarget.target_template_items?.title_dv}
                </div>
              </div>

              {loadingHistory ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  Loading history...
                </div>
              ) : historyAttempts.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  No checking attempts recorded yet.
                </div>
              ) : (
                <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                  {historyAttempts.map((attempt) => {
                    const resultConfig = CHECK_RESULT_CONFIG[attempt.result];
                    return (
                      <div
                        key={attempt.id}
                        className={`rounded-lg border p-3 text-sm space-y-2 ${
                          attempt.result === "completed"
                            ? "border-emerald-200 bg-emerald-50/40"
                            : "border-slate-200 bg-slate-50/60"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-800">
                            Attempt #{attempt.attempt_number}
                          </span>
                          <span className="text-xs text-slate-500">
                            {new Date(attempt.checked_at).toLocaleDateString()}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={`text-xs px-2 py-0.5 ${
                              resultConfig?.badgeClass || "bg-slate-100"
                            }`}
                          >
                            {resultConfig?.label || attempt.result}
                          </Badge>
                          <span className="text-xs text-slate-500">By {attempt.teacher_name}</span>
                        </div>

                        {attempt.teacher_comment && (
                          <div className="text-xs bg-white/80 p-2.5 rounded border border-slate-200/80 text-slate-800">
                            <span className="font-semibold text-slate-700">Teacher Note: </span>
                            {attempt.teacher_comment}
                          </div>
                        )}

                        {attempt.recommendation && (
                          <div className="text-xs text-slate-600">
                            <strong>Recommendation:</strong> {attempt.recommendation}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setHistoryTarget(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </RoleShell>
  );
}
