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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Star,
  RefreshCcw,
  Clock,
  CheckCircle2,
  AlertTriangle,
  History,
  Search,
  BookOpen,
  UserCheck,
  Calendar,
  Lock,
  MessageSquare,
} from "lucide-react";
import {
  acceptTargetCheckRequest,
  recordCheckAttempt,
  getTargetCheckHistory,
} from "@/lib/targets.functions";
import { type CheckResult, CHECK_RESULT_CONFIG, TARGET_STATUS_CONFIG } from "@/types/targets";

export const Route = createFileRoute("/staff/check-requests")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Check Requests & Assessment — Staff" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});

type CheckRequestRow = {
  id: string;
  student_target_assignment_id: string;
  student_id: string;
  term_id: string;
  class_id: string | null;
  request_status: string;
  requested_at: string;
  preferred_check_date: string | null;
  student_message: string | null;
  student_target_assignments: {
    id: string;
    student_id: string;
    term_id: string;
    attempt_count: number;
    current_status: string;
    last_teacher_comment: string | null;
    students: {
      id: string;
      full_name: string;
      student_number: string;
      photo_url: string | null;
      class_id: string | null;
    } | null;
    classes: {
      id: string;
      class_name: string;
    } | null;
    target_template_items: {
      id: string;
      title_dv?: string;
      title_en?: string | null;
      target_title?: string | null;
      target_title_dhivehi?: string | null;
      arabic_text?: string | null;
      instructions?: string | null;
      star_group?: string | null;
    } | null;
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
  private_teacher_note?: string | null;
  teacher_name: string;
};

const QUICK_COMMENTS = [
  "ما شاء الله recitation was fluent, accurate and melodious.",
  "Excellent improvement! Tajweed and makharij are clear.",
  "Good effort. Please revise noon sakinah and tanween rules.",
  "Practiced well, minor correction needed on ghunnah duration.",
  "Needs additional practice before mastery. Keep going!",
];

function Page() {
  const [requests, setRequests] = useState<CheckRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClass, setSelectedClass] = useState<string>("all");
  const [classesList, setClassesList] = useState<{ id: string; name: string }[]>([]);

  // Assessment Dialog state
  const [activeAssessment, setActiveAssessment] = useState<CheckRequestRow | null>(null);
  const [result, setResult] = useState<CheckResult>("completed");
  const [teacherComment, setTeacherComment] = useState("");
  const [score, setScore] = useState<string>("");
  const [recommendation, setRecommendation] = useState("");
  const [nextCheckDate, setNextCheckDate] = useState("");
  const [privateNote, setPrivateNote] = useState("");
  const [submittingCheck, setSubmittingCheck] = useState(false);

  // History in Assessment dialog
  const [historyAttempts, setHistoryAttempts] = useState<HistoryAttempt[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Direct check state (checking during class without student request)
  const [directCheckOpen, setDirectCheckOpen] = useState(false);
  const [allStudents, setAllStudents] = useState<
    { id: string; full_name: string; student_number: string; class_id: string }[]
  >([]);
  const [directStudentId, setDirectStudentId] = useState("");
  const [studentTargets, setStudentTargets] = useState<
    {
      id: string;
      current_status: string;
      target_template_items: {
        title_dv: string;
        target_title_dhivehi?: string;
        arabic_text?: string;
      };
    }[]
  >([]);
  const [directAssignmentId, setDirectAssignmentId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Load classes
      const { data: cls } = await supabase
        .from("classes")
        .select("id, class_name")
        .order("class_name");
      if (cls) setClassesList(cls.map((c) => ({ id: c.id, name: c.class_name })));

      // Load check requests
      const { data, error } = await supabase
        .from("target_check_requests")
        .select(
          `
          id,
          student_target_assignment_id,
          student_id,
          term_id,
          class_id,
          request_status,
          requested_at,
          preferred_check_date,
          student_message,
          student_target_assignments (
            id,
            student_id,
            term_id,
            attempt_count,
            current_status,
            last_teacher_comment,
            students (
              id,
              full_name,
              student_number,
              photo_url,
              class_id
            ),
            classes (
              id,
              class_name
            ),
            target_template_items (
              id,
              title_dv,
              title_en,
              target_title,
              target_title_dhivehi,
              arabic_text,
              instructions,
              star_group
            )
          )
        `,
        )
        .order("requested_at", { ascending: false });

      if (error) throw error;
      setRequests((data ?? []) as unknown as CheckRequestRow[]);

      // Load students list for direct check
      const { data: st } = await supabase
        .from("students")
        .select("id, full_name, student_number, class_id")
        .eq("status", "active")
        .order("full_name");
      if (st) setAllStudents(st);
    } catch (e: unknown) {
      console.error(e);
      toast.error("Failed to load requests");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // When teacher selects student in direct check modal, load their targets
  useEffect(() => {
    if (!directStudentId) {
      setStudentTargets([]);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("student_target_assignments")
        .select(
          `id, current_status, target_template_items (title_dv, target_title_dhivehi, arabic_text)`,
        )
        .eq("student_id", directStudentId)
        .neq("current_status", "completed");
      setStudentTargets((data ?? []) as never[]);
    })();
  }, [directStudentId]);

  // Open assessment modal for a request
  async function openAssessment(req: CheckRequestRow) {
    setActiveAssessment(req);
    setResult("completed");
    setTeacherComment("");
    setScore("");
    setRecommendation("");
    setNextCheckDate("");
    setPrivateNote("");

    // If request was pending, transition to under_checking automatically
    if (req.request_status === "pending") {
      try {
        await acceptTargetCheckRequest({ data: { request_id: req.id } });
      } catch (e) {
        console.error("Auto accept status notice:", e);
      }
    }

    // Load past attempts
    setLoadingHistory(true);
    try {
      const hist = await getTargetCheckHistory({
        data: { assignment_id: req.student_target_assignment_id },
      });
      setHistoryAttempts((hist as HistoryAttempt[]) || []);
    } catch (e) {
      console.error(e);
      setHistoryAttempts([]);
    } finally {
      setLoadingHistory(false);
    }
  }

  // Submit assessment attempt
  async function handleSubmitAssessment() {
    if (!activeAssessment) return;
    if (!teacherComment.trim()) {
      toast.error("Teacher feedback comment is required");
      return;
    }

    setSubmittingCheck(true);
    try {
      await recordCheckAttempt({
        data: {
          assignment_id: activeAssessment.student_target_assignment_id,
          request_id: activeAssessment.id,
          result,
          teacher_comment: teacherComment.trim(),
          score: score ? parseFloat(score) : null,
          recommendation: recommendation.trim() || null,
          next_check_date: nextCheckDate || null,
          private_teacher_note: privateNote.trim() || null,
        },
      });

      toast.success(
        result === "completed"
          ? "Target marked as Completed! ★ Student star awarded."
          : `Checked: Result saved as ${CHECK_RESULT_CONFIG[result]?.label || result}`,
      );

      setActiveAssessment(null);
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to record check");
    } finally {
      setSubmittingCheck(false);
    }
  }

  // Submit direct check without prior request
  async function handleSubmitDirectCheck() {
    if (!directAssignmentId) {
      toast.error("Select a target");
      return;
    }
    if (!teacherComment.trim()) {
      toast.error("Teacher feedback comment is required");
      return;
    }

    setSubmittingCheck(true);
    try {
      await recordCheckAttempt({
        data: {
          assignment_id: directAssignmentId,
          result,
          teacher_comment: teacherComment.trim(),
          score: score ? parseFloat(score) : null,
          recommendation: recommendation.trim() || null,
          next_check_date: nextCheckDate || null,
          private_teacher_note: privateNote.trim() || null,
        },
      });

      toast.success("Direct check attempt recorded successfully!");
      setDirectCheckOpen(false);
      setDirectStudentId("");
      setDirectAssignmentId("");
      setTeacherComment("");
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to record check");
    } finally {
      setSubmittingCheck(false);
    }
  }

  // Filtered requests
  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      // Status filter
      if (statusFilter === "pending" && r.request_status !== "pending") return false;
      if (statusFilter === "under_checking" && r.request_status !== "under_checking") return false;
      if (statusFilter === "checked" && r.request_status !== "checked") return false;

      // Class filter
      if (selectedClass !== "all") {
        const studentClass = r.student_target_assignments?.students?.class_id || r.class_id;
        if (studentClass !== selectedClass) return false;
      }

      // Search query (student name or number)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const sName = r.student_target_assignments?.students?.full_name?.toLowerCase() || "";
        const sNum = r.student_target_assignments?.students?.student_number?.toLowerCase() || "";
        if (!sName.includes(q) && !sNum.includes(q)) return false;
      }

      return true;
    });
  }, [requests, statusFilter, selectedClass, searchQuery]);

  const pendingCount = requests.filter((r) => r.request_status === "pending").length;
  const underCheckingCount = requests.filter((r) => r.request_status === "under_checking").length;

  return (
    <RoleShell role="staff" title="Target Checking & Assessment">
      <div className="space-y-6">
        {/* Top Action Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Badge
              variant="secondary"
              className="px-3 py-1 bg-amber-100 text-amber-900 border-amber-200"
            >
              <Clock className="h-3.5 w-3.5 mr-1" />
              {pendingCount} Pending Requests
            </Badge>
            {underCheckingCount > 0 && (
              <Badge
                variant="secondary"
                className="px-3 py-1 bg-blue-100 text-blue-900 border-blue-200"
              >
                {underCheckingCount} In Progress
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
              onClick={() => {
                setDirectCheckOpen(true);
                setDirectStudentId("");
                setDirectAssignmentId("");
                setTeacherComment("");
              }}
            >
              <UserCheck className="h-4 w-4 mr-1.5" />
              Direct Class Check
            </Button>
            <Button size="sm" variant="outline" onClick={load}>
              <RefreshCcw className="h-4 w-4 mr-1" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div className="relative sm:col-span-2">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search student by name or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 text-sm"
            />
          </div>

          <div>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">All Classes</option>
              {classesList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="pending">Pending Queue ({pendingCount})</option>
              <option value="under_checking">Under Checking ({underCheckingCount})</option>
              <option value="checked">Completed / Checked</option>
              <option value="all">All Requests</option>
            </select>
          </div>
        </div>

        {/* Check Requests List */}
        {loading ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            Loading check requests...
          </div>
        ) : filteredRequests.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center space-y-3">
              <CheckCircle2 className="h-10 w-10 mx-auto text-emerald-500 stroke-1" />
              <div className="font-medium text-slate-800">No requests in this queue</div>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Students will appear here when they request a target check, or you can use "Direct
                Class Check" to test students right away.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredRequests.map((req) => {
              const sa = req.student_target_assignments;
              const student = sa?.students;
              const target = sa?.target_template_items;
              const isUnderChecking = req.request_status === "under_checking";

              return (
                <Card
                  key={req.id}
                  className={`transition-all border-border/70 overflow-hidden shadow-sm hover:border-primary/40 ${
                    isUnderChecking ? "bg-blue-50/20 border-blue-200" : ""
                  }`}
                >
                  <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    {/* Student & Target Details */}
                    <div className="flex items-start gap-3.5 flex-1">
                      <div className="h-11 w-11 rounded-full bg-sky-100 ring-2 ring-sky-200 flex items-center justify-center font-bold text-sky-800 shrink-0 text-sm overflow-hidden">
                        {student?.photo_url ? (
                          <img
                            src={student.photo_url}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          student?.full_name?.charAt(0) || "S"
                        )}
                      </div>

                      <div className="space-y-1 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-slate-900 text-sm">
                            {student?.full_name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            · ID: {student?.student_number || "—"}
                          </span>
                          {sa?.classes?.class_name && (
                            <Badge variant="outline" className="text-[10px] px-2 py-0">
                              {sa.classes.class_name}
                            </Badge>
                          )}
                          {isUnderChecking && (
                            <Badge className="bg-blue-600 text-white text-[10px] px-2 py-0">
                              Under Checking
                            </Badge>
                          )}
                        </div>

                        {/* Arabic text */}
                        {target?.arabic_text && (
                          <div
                            className="text-right font-arabic font-bold text-lg text-sky-950 leading-relaxed"
                            dir="rtl"
                          >
                            {target.arabic_text}
                          </div>
                        )}

                        {/* Dhivehi title */}
                        <div
                          className="text-right font-dhivehi font-semibold text-slate-800 text-base"
                          dir="rtl"
                        >
                          {target?.target_title_dhivehi || target?.title_dv}
                        </div>

                        {/* English title */}
                        {(target?.target_title || target?.title_en) && (
                          <div className="text-xs text-slate-600 font-medium">
                            {target?.target_title || target?.title_en}
                          </div>
                        )}

                        {/* Student request message */}
                        {req.student_message && (
                          <div className="text-xs bg-slate-50 p-2 rounded border text-slate-700 mt-1 flex items-start gap-1.5">
                            <MessageSquare className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                            <span>
                              <strong>Student message:</strong> "{req.student_message}"
                            </span>
                          </div>
                        )}

                        {/* Request meta */}
                        <div className="flex items-center gap-3 text-[11px] text-slate-400 pt-1">
                          <span>Requested: {new Date(req.requested_at).toLocaleDateString()}</span>
                          {req.preferred_check_date && (
                            <span className="text-sky-600 font-medium">
                              Preferred Date: {req.preferred_check_date}
                            </span>
                          )}
                          <span>Attempts: {sa?.attempt_count ?? 0}</span>
                        </div>
                      </div>
                    </div>

                    {/* Action Button */}
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <Button
                        size="sm"
                        className="bg-sky-600 hover:bg-sky-700 text-white shadow-sm"
                        onClick={() => openAssessment(req)}
                      >
                        <UserCheck className="h-4 w-4 mr-1.5" />
                        Check Now
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Teacher Checking Assessment Modal (Section 13) */}
      <Dialog
        open={Boolean(activeAssessment)}
        onOpenChange={(open) => !open && setActiveAssessment(null)}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <UserCheck className="h-5 w-5 text-primary" />
              Teacher Target Assessment
            </DialogTitle>
          </DialogHeader>

          {activeAssessment && (
            <div className="space-y-5 text-sm">
              {/* Student Header */}
              <div className="flex items-center justify-between rounded-lg bg-sky-50/60 p-3.5 border border-sky-100">
                <div>
                  <div className="font-bold text-slate-900 text-base">
                    {activeAssessment.student_target_assignments?.students?.full_name}
                  </div>
                  <div className="text-xs text-slate-600">
                    ID: {activeAssessment.student_target_assignments?.students?.student_number} ·{" "}
                    Class: {activeAssessment.student_target_assignments?.classes?.class_name ?? "—"}
                  </div>
                </div>
                <Badge variant="outline" className="bg-white">
                  Next Attempt #
                  {(activeAssessment.student_target_assignments?.attempt_count ?? 0) + 1}
                </Badge>
              </div>

              {/* Target Details Card with Large Arabic Text & Diacritics */}
              <div className="rounded-lg border p-4 bg-slate-50/40 space-y-2">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Target Under Assessment
                </div>

                {activeAssessment.student_target_assignments?.target_template_items
                  ?.arabic_text && (
                  <div
                    className="font-arabic font-bold text-2xl text-right text-sky-950 leading-relaxed border-b pb-2"
                    dir="rtl"
                  >
                    {activeAssessment.student_target_assignments.target_template_items.arabic_text}
                  </div>
                )}

                <div className="font-dhivehi font-bold text-lg text-right text-slate-900" dir="rtl">
                  {activeAssessment.student_target_assignments?.target_template_items
                    ?.target_title_dhivehi ||
                    activeAssessment.student_target_assignments?.target_template_items?.title_dv}
                </div>

                {activeAssessment.student_target_assignments?.target_template_items
                  ?.instructions && (
                  <div className="text-xs text-slate-600 bg-white p-2.5 rounded border border-slate-200">
                    <strong>Instructions:</strong>{" "}
                    {activeAssessment.student_target_assignments.target_template_items.instructions}
                  </div>
                )}
              </div>

              {/* Previous History Timeline (Section 8) */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <History className="h-3.5 w-3.5 text-muted-foreground" />
                  Previous Checking Attempts ({historyAttempts.length})
                </div>

                {loadingHistory ? (
                  <div className="text-xs text-muted-foreground p-2">Loading past attempts...</div>
                ) : historyAttempts.length === 0 ? (
                  <div className="text-xs text-slate-400 italic p-2 rounded bg-slate-50 border">
                    First check attempt for this target.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                    {historyAttempts.map((att) => (
                      <div key={att.id} className="rounded border p-2 text-xs bg-white space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-800">
                            Attempt #{att.attempt_number} ·{" "}
                            {new Date(att.checked_at).toLocaleDateString()}
                          </span>
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1.5 py-0 ${
                              CHECK_RESULT_CONFIG[att.result]?.badgeClass || ""
                            }`}
                          >
                            {CHECK_RESULT_CONFIG[att.result]?.label || att.result}
                          </Badge>
                        </div>
                        {att.teacher_comment && (
                          <div className="text-slate-600">Comment: {att.teacher_comment}</div>
                        )}
                        {att.private_teacher_note && (
                          <div className="text-amber-800 bg-amber-50 p-1 rounded font-mono text-[11px]">
                            Private Note: {att.private_teacher_note}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Result Buttons (Section 13) */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-800">
                  Assessment Result <span className="text-rose-500">*</span>
                </Label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <Button
                    type="button"
                    variant={result === "completed" ? "default" : "outline"}
                    className={
                      result === "completed"
                        ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                        : "hover:border-emerald-300"
                    }
                    onClick={() => setResult("completed")}
                  >
                    <Star className="h-4 w-4 mr-1.5 fill-red-500 text-red-500" />
                    Completed (Mastered)
                  </Button>

                  <Button
                    type="button"
                    variant={result === "practice_again" ? "default" : "outline"}
                    className={
                      result === "practice_again"
                        ? "bg-amber-600 hover:bg-amber-700 text-white"
                        : "hover:border-amber-300"
                    }
                    onClick={() => setResult("practice_again")}
                  >
                    Practice Again
                  </Button>

                  <Button
                    type="button"
                    variant={result === "progressing" ? "default" : "outline"}
                    className={
                      result === "progressing"
                        ? "bg-sky-600 hover:bg-sky-700 text-white"
                        : "hover:border-sky-300"
                    }
                    onClick={() => setResult("progressing")}
                  >
                    Progressing
                  </Button>

                  <Button
                    type="button"
                    variant={result === "not_ready" ? "default" : "outline"}
                    className={
                      result === "not_ready"
                        ? "bg-slate-700 hover:bg-slate-800 text-white"
                        : "hover:border-slate-300"
                    }
                    onClick={() => setResult("not_ready")}
                  >
                    Not Ready
                  </Button>

                  <Button
                    type="button"
                    variant={result === "exempted" ? "default" : "outline"}
                    className={
                      result === "exempted"
                        ? "bg-purple-700 hover:bg-purple-800 text-white"
                        : "hover:border-purple-300"
                    }
                    onClick={() => setResult("exempted")}
                  >
                    Exempted
                  </Button>
                </div>
              </div>

              {/* Teacher Feedback Comment (MANDATORY) */}
              <div className="space-y-2">
                <Label htmlFor="t-comment" className="text-xs font-semibold text-slate-800">
                  Teacher Feedback / Comments <span className="text-rose-500">*</span>
                </Label>
                <Textarea
                  id="t-comment"
                  rows={3}
                  placeholder="Recitation feedback visible to student & guardian..."
                  value={teacherComment}
                  onChange={(e) => setTeacherComment(e.target.value)}
                  className="text-sm"
                />

                {/* Quick Comments Chips */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {QUICK_COMMENTS.map((chip, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setTeacherComment(chip)}
                      className="text-[11px] rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-700 hover:bg-sky-50 hover:text-sky-900 hover:border-sky-200 transition-colors"
                    >
                      + {chip.slice(0, 32)}...
                    </button>
                  ))}
                </div>
              </div>

              {/* Recommendation & Next Check Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="t-rec" className="text-xs">
                    Recommendation / Practice Focus
                  </Label>
                  <Input
                    id="t-rec"
                    placeholder="e.g. Focus on Ayat 1-5 Tajweed"
                    value={recommendation}
                    onChange={(e) => setRecommendation(e.target.value)}
                    className="mt-1 text-xs"
                  />
                </div>

                <div>
                  <Label htmlFor="t-next" className="text-xs">
                    Next Check Date (if practicing again)
                  </Label>
                  <Input
                    id="t-next"
                    type="date"
                    value={nextCheckDate}
                    onChange={(e) => setNextCheckDate(e.target.value)}
                    className="mt-1 text-xs"
                  />
                </div>
              </div>

              {/* Confidential Teacher Note */}
              <div>
                <Label
                  htmlFor="t-private"
                  className="text-xs text-amber-900 font-medium flex items-center gap-1"
                >
                  <Lock className="h-3.5 w-3.5 text-amber-700" />
                  Private Faculty Note (confidential — never visible to student/guardian)
                </Label>
                <Input
                  id="t-private"
                  placeholder="Internal teacher observation..."
                  value={privateNote}
                  onChange={(e) => setPrivateNote(e.target.value)}
                  className="mt-1 text-xs bg-amber-50/40 border-amber-200"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0 pt-4 border-t">
            <Button variant="outline" onClick={() => setActiveAssessment(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmitAssessment}
              disabled={submittingCheck}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {submittingCheck ? "Recording..." : "Save & Finalize Assessment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Direct Class Check Modal (Section 14) */}
      <Dialog open={directCheckOpen} onOpenChange={setDirectCheckOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-primary" />
              Direct In-Class Assessment
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 text-sm">
            <div>
              <Label className="text-xs font-semibold">Select Student</Label>
              <select
                value={directStudentId}
                onChange={(e) => {
                  setDirectStudentId(e.target.value);
                  setDirectAssignmentId("");
                }}
                className="mt-1 w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">-- Choose student from class --</option>
                {allStudents.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name} ({s.student_number})
                  </option>
                ))}
              </select>
            </div>

            {directStudentId && (
              <div>
                <Label className="text-xs font-semibold">Select Target to Test</Label>
                {studentTargets.length === 0 ? (
                  <div className="text-xs text-muted-foreground p-3 border rounded mt-1 bg-slate-50">
                    No active incomplete targets assigned for this student.
                  </div>
                ) : (
                  <select
                    value={directAssignmentId}
                    onChange={(e) => setDirectAssignmentId(e.target.value)}
                    className="mt-1 w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">-- Choose target --</option>
                    {studentTargets.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.target_template_items?.target_title_dhivehi ||
                          t.target_template_items?.title_dv}{" "}
                        ({t.current_status})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {directAssignmentId && (
              <>
                {/* Result selection */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Result</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={result === "completed" ? "default" : "outline"}
                      className={result === "completed" ? "bg-emerald-600 text-white" : ""}
                      onClick={() => setResult("completed")}
                    >
                      <Star className="h-3.5 w-3.5 mr-1 fill-red-500 text-red-500" />
                      Completed
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={result === "practice_again" ? "default" : "outline"}
                      className={result === "practice_again" ? "bg-amber-600 text-white" : ""}
                      onClick={() => setResult("practice_again")}
                    >
                      Practice Again
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={result === "progressing" ? "default" : "outline"}
                      className={result === "progressing" ? "bg-sky-600 text-white" : ""}
                      onClick={() => setResult("progressing")}
                    >
                      Progressing
                    </Button>
                  </div>
                </div>

                <div>
                  <Label htmlFor="dir-comment" className="text-xs font-semibold">
                    Teacher Comment <span className="text-rose-500">*</span>
                  </Label>
                  <Textarea
                    id="dir-comment"
                    rows={3}
                    placeholder="Feedback for student..."
                    value={teacherComment}
                    onChange={(e) => setTeacherComment(e.target.value)}
                    className="mt-1 text-sm"
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDirectCheckOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmitDirectCheck}
              disabled={submittingCheck || !directAssignmentId}
            >
              {submittingCheck ? "Saving..." : "Record Assessment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </RoleShell>
  );
}
