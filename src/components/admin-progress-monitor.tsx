import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Star,
  Clock,
  RotateCcw,
  History,
  AlertTriangle,
  Search,
  BookOpen,
  Filter,
} from "lucide-react";
import { reopenCompletedTarget, getTargetCheckHistory } from "@/lib/targets.functions";

type Term = { id: string; term_name: string };
type ClassItem = { id: string; class_name: string };

type AssignmentRow = {
  id: string;
  student_id: string;
  term_id: string;
  class_id: string | null;
  target_id: string | null;
  template_item_id: string | null;
  current_status: string;
  attempt_count: number;
  last_check_date: string | null;
  last_teacher_comment: string | null;
  student: { full_name: string; student_number: string | null } | null;
  class: { class_name: string } | null;
  item: {
    target_title_dhivehi: string | null;
    title_dv: string | null;
    target_title: string | null;
    title_en: string | null;
    arabic_text: string | null;
  } | null;
};

type AttemptHistory = {
  id: string;
  attempt_number: number;
  checked_at: string;
  result: string;
  teacher_comment: string | null;
  private_teacher_note?: string | null;
  score: number | null;
};

export function AdminProgressMonitor() {
  const [terms, setTerms] = useState<Term[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedTerm, setSelectedTerm] = useState<string>("");
  const [selectedClass, setSelectedClass] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<AssignmentRow[]>([]);

  // Reopen Modal state
  const [reopenModalOpen, setReopenModalOpen] = useState(false);
  const [reopenTargetItem, setReopenTargetItem] = useState<AssignmentRow | null>(null);
  const [reopenReason, setReopenReason] = useState("");
  const [reopening, setReopening] = useState(false);

  // History Modal state
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyItem, setHistoryItem] = useState<AssignmentRow | null>(null);
  const [historyList, setHistoryList] = useState<AttemptHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data: t }, { data: c }] = await Promise.all([
        supabase.from("academic_terms").select("id, term_name").order("created_at"),
        supabase.from("classes").select("id, class_name").order("class_name"),
      ]);
      setTerms(t ?? []);
      setClasses(c ?? []);
      if (t?.[0]) setSelectedTerm(t[0].id);
    })();
  }, []);

  const loadAssignments = useCallback(async () => {
    if (!selectedTerm) return;
    setLoading(true);
    try {
      let query = supabase
        .from("student_target_assignments")
        .select(
          `
          id,
          student_id,
          term_id,
          class_id,
          target_id,
          template_item_id,
          current_status,
          attempt_count,
          last_check_date,
          last_teacher_comment,
          student:students(full_name, student_number),
          class:classes(class_name),
          item:target_template_items(target_title_dhivehi, title_dv, target_title, title_en, arabic_text)
        `,
        )
        .eq("term_id", selectedTerm);

      if (selectedClass !== "all") {
        query = query.eq("class_id", selectedClass);
      }

      const { data, error } = await query;
      if (error) throw error;
      setRows((data ?? []) as unknown as AssignmentRow[]);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to load progress monitor");
    } finally {
      setLoading(false);
    }
  }, [selectedTerm, selectedClass]);

  useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);

  // Metrics
  const total = rows.length;
  const completed = rows.filter((r) => r.current_status === "completed").length;
  const practicing = rows.filter(
    (r) => r.current_status === "practicing" || r.current_status === "progressing",
  ).length;
  const checkRequested = rows.filter(
    (r) => r.current_status === "check_requested" || r.current_status === "under_checking",
  ).length;
  const needsAttention = rows.filter(
    (r) => (r.attempt_count ?? 0) >= 2 && r.current_status !== "completed",
  ).length;

  // Filtered rows
  const filtered = rows.filter((r) => {
    if (statusFilter !== "all") {
      if (statusFilter === "needs_attention") {
        if ((r.attempt_count ?? 0) < 2 || r.current_status === "completed") return false;
      } else if (r.current_status !== statusFilter) {
        return false;
      }
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      const sName = r.student?.full_name?.toLowerCase() ?? "";
      const sNum = r.student?.student_number?.toLowerCase() ?? "";
      const tDv = r.item?.target_title_dhivehi ?? r.item?.title_dv ?? "";
      const tEn = r.item?.target_title?.toLowerCase() ?? r.item?.title_en?.toLowerCase() ?? "";
      return sName.includes(q) || sNum.includes(q) || tDv.includes(q) || tEn.includes(q);
    }
    return true;
  });

  async function openHistoryModal(row: AssignmentRow) {
    setHistoryItem(row);
    setHistoryModalOpen(true);
    setLoadingHistory(true);
    try {
      const res = await getTargetCheckHistory({ data: { assignment_id: row.id } });
      setHistoryList((res.attempts ?? []) as unknown as AttemptHistory[]);
    } catch {
      // fallback to supabase client if needed
      const { data } = await supabase
        .from("target_check_attempts")
        .select(
          "id, attempt_number, checked_at, result, teacher_comment, private_teacher_note, score",
        )
        .eq("student_target_assignment_id", row.id)
        .order("attempt_number", { ascending: false });
      setHistoryList((data ?? []) as AttemptHistory[]);
    } finally {
      setLoadingHistory(false);
    }
  }

  function openReopenModal(row: AssignmentRow) {
    setReopenTargetItem(row);
    setReopenReason("");
    setReopenModalOpen(true);
  }

  async function handleConfirmReopen() {
    if (!reopenTargetItem || !reopenReason.trim()) {
      toast.error("A justification reason is required to reopen a completed target");
      return;
    }
    setReopening(true);
    try {
      await reopenCompletedTarget({
        data: {
          assignment_id: reopenTargetItem.id,
          reason: reopenReason.trim(),
          supersede_attempt: true,
        },
      });
      toast.success("Target successfully reopened and logged to audit trail");
      setReopenModalOpen(false);
      await loadAssignments();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to reopen target");
    } finally {
      setReopening(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Metric Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Card className="border-border/70 shadow-xs">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground font-medium">Total Assignments</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">{total}</div>
          </CardContent>
        </Card>

        <Card className="border-emerald-200 bg-emerald-50/40 shadow-xs">
          <CardContent className="p-4">
            <div className="text-xs text-emerald-800 font-medium flex items-center gap-1">
              <Star className="h-3.5 w-3.5 fill-red-500 text-red-500" />
              Mastered Stars
            </div>
            <div className="text-2xl font-bold text-emerald-700 mt-1">
              {completed}{" "}
              <span className="text-xs font-normal text-emerald-600">
                ({total ? Math.round((completed / total) * 100) : 0}%)
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-sky-200 bg-sky-50/40 shadow-xs">
          <CardContent className="p-4">
            <div className="text-xs text-sky-800 font-medium flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              Check Requests
            </div>
            <div className="text-2xl font-bold text-sky-700 mt-1">{checkRequested}</div>
          </CardContent>
        </Card>

        <Card className="border-amber-200 bg-amber-50/40 shadow-xs">
          <CardContent className="p-4">
            <div className="text-xs text-amber-800 font-medium flex items-center gap-1">
              <BookOpen className="h-3.5 w-3.5" />
              In Practice
            </div>
            <div className="text-2xl font-bold text-amber-700 mt-1">{practicing}</div>
          </CardContent>
        </Card>

        <Card className="border-rose-200 bg-rose-50/40 shadow-xs col-span-2 sm:col-span-1">
          <CardContent className="p-4">
            <div className="text-xs text-rose-800 font-medium flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5" />
              Needs Support
            </div>
            <div className="text-2xl font-bold text-rose-700 mt-1">
              {needsAttention}{" "}
              <span className="text-xs font-normal text-rose-600">(&ge;2 attempts)</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Bar */}
      <Card className="border-border/70 shadow-xs">
        <CardContent className="p-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <div>
              <Label className="text-xs">Academic Term</Label>
              <select
                value={selectedTerm}
                onChange={(e) => setSelectedTerm(e.target.value)}
                className="mt-1 w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {terms.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.term_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label className="text-xs">Class</Label>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="mt-1 w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="all">All Classes</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.class_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label className="text-xs">Status Filter</Label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="mt-1 w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="all">All Statuses</option>
                <option value="completed">Completed (Mastered)</option>
                <option value="check_requested">Check Requested</option>
                <option value="practicing">Practicing</option>
                <option value="progressing">Progressing</option>
                <option value="practice_again">Practice Again</option>
                <option value="needs_attention">Needs Support (&ge;2 attempts)</option>
              </select>
            </div>

            <div>
              <Label className="text-xs">Search Student or Target</Label>
              <div className="relative mt-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search name, code, title..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 text-sm h-9"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Targets Table */}
      <Card className="border-border/70 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 border-b text-xs text-muted-foreground uppercase font-semibold">
              <tr>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Class</th>
                <th className="px-4 py-3">Target Details</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center">Attempts</th>
                <th className="px-4 py-3">Last Feedback</th>
                <th className="px-4 py-3 text-right">Admin Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filtered.map((r) => {
                const titleDv = r.item?.target_title_dhivehi || r.item?.title_dv || "—";
                const titleEn = r.item?.target_title || r.item?.title_en;
                const isCompleted = r.current_status === "completed";
                const needsSupport = (r.attempt_count ?? 0) >= 2 && !isCompleted;

                return (
                  <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">
                        {r.student?.full_name ?? "—"}
                      </div>
                      <div className="text-xs font-mono text-muted-foreground">
                        {r.student?.student_number ?? ""}
                      </div>
                    </td>

                    <td className="px-4 py-3 text-xs font-medium text-slate-700">
                      {r.class?.class_name ?? "—"}
                    </td>

                    <td className="px-4 py-3 max-w-xs">
                      {r.item?.arabic_text && (
                        <div
                          className="font-arabic font-bold text-sm text-sky-950 mb-0.5 text-right"
                          dir="rtl"
                        >
                          {r.item.arabic_text}
                        </div>
                      )}
                      <div
                        className="font-dhivehi font-semibold text-slate-900 text-sm text-right"
                        dir="rtl"
                      >
                        {titleDv}
                      </div>
                      {titleEn && <div className="text-xs text-muted-foreground">{titleEn}</div>}
                    </td>

                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      {isCompleted ? (
                        <Badge className="bg-emerald-600 text-white hover:bg-emerald-700 gap-1">
                          <Star className="h-3 w-3 fill-red-500 text-red-500" />
                          Completed
                        </Badge>
                      ) : r.current_status === "check_requested" ? (
                        <Badge className="bg-sky-600 text-white">Check Requested</Badge>
                      ) : r.current_status === "progressing" ? (
                        <Badge className="bg-indigo-600 text-white">Progressing</Badge>
                      ) : r.current_status === "practice_again" ? (
                        <Badge variant="destructive">Practice Again</Badge>
                      ) : (
                        <Badge variant="outline" className="text-slate-600">
                          {r.current_status.replace("_", " ")}
                        </Badge>
                      )}
                    </td>

                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                          needsSupport
                            ? "bg-rose-100 text-rose-700 border border-rose-200 font-bold"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {r.attempt_count ?? 0}
                      </span>
                    </td>

                    <td className="px-4 py-3 max-w-xs text-xs text-slate-600 truncate">
                      {r.last_teacher_comment || (
                        <span className="text-muted-foreground italic">None</span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-right whitespace-nowrap space-x-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-xs text-slate-700"
                        onClick={() => openHistoryModal(r)}
                      >
                        <History className="h-3.5 w-3.5 mr-1" />
                        History
                      </Button>

                      {isCompleted && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs text-amber-700 border-amber-300 hover:bg-amber-50"
                          onClick={() => openReopenModal(r)}
                        >
                          <RotateCcw className="h-3 w-3 mr-1" />
                          Reopen
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-sm text-muted-foreground">
                    {loading ? "Loading target progress..." : "No targets match current filters."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Reopen Modal */}
      <Dialog open={reopenModalOpen} onOpenChange={setReopenModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-700">
              <RotateCcw className="h-5 w-5" />
              Reopen Completed Target
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <p className="text-xs text-muted-foreground">
              Reopening a completed target resets its status back to <strong>practicing</strong> so
              the student can be re-tested. Under the immutable audit requirement, a detailed reason
              must be supplied and logged to the permanent audit record.
            </p>

            <div className="p-3 bg-slate-50 rounded-lg border text-xs space-y-1">
              <div>
                Student: <strong>{reopenTargetItem?.student?.full_name}</strong>
              </div>
              <div dir="rtl" className="font-dhivehi font-medium text-slate-800">
                {reopenTargetItem?.item?.target_title_dhivehi || reopenTargetItem?.item?.title_dv}
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-800">
                Justification Reason (Mandatory) *
              </Label>
              <Textarea
                rows={3}
                placeholder="Explain why this completed target requires additional practice or re-testing..."
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                className="mt-1 text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReopenModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmReopen}
              disabled={reopening || reopenReason.trim().length < 5}
            >
              {reopening ? "Reopening..." : "Confirm & Reopen Target"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Modal */}
      <Dialog open={historyModalOpen} onOpenChange={setHistoryModalOpen}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Target Assessment History
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <div className="p-3 bg-slate-50 rounded-lg border text-xs space-y-1">
              <div>
                Student: <strong>{historyItem?.student?.full_name}</strong>
              </div>
              <div dir="rtl" className="font-dhivehi font-medium text-slate-900 text-sm">
                {historyItem?.item?.target_title_dhivehi || historyItem?.item?.title_dv}
              </div>
            </div>

            {loadingHistory ? (
              <div className="p-6 text-center text-xs text-muted-foreground">
                Loading attempt audit trail...
              </div>
            ) : historyList.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">
                No formal check attempts recorded yet.
              </div>
            ) : (
              <div className="space-y-3">
                {historyList.map((att) => (
                  <div
                    key={att.id}
                    className="p-3.5 rounded-lg border border-border/80 bg-white space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          Attempt #{att.attempt_number}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(att.checked_at).toLocaleString()}
                        </span>
                      </div>
                      <Badge
                        className={
                          att.result === "completed"
                            ? "bg-emerald-600 text-white"
                            : att.result === "progressing"
                              ? "bg-indigo-600 text-white"
                              : "bg-rose-600 text-white"
                        }
                      >
                        {att.result.replace("_", " ").toUpperCase()}
                      </Badge>
                    </div>

                    {att.teacher_comment && (
                      <div className="text-xs text-slate-800 bg-slate-50 p-2 rounded">
                        <span className="font-semibold">Teacher Feedback: </span>
                        {att.teacher_comment}
                      </div>
                    )}

                    {att.private_teacher_note && (
                      <div className="text-xs text-purple-900 bg-purple-50 p-2 rounded border border-purple-100">
                        <span className="font-semibold">Staff Internal Note: </span>
                        {att.private_teacher_note}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHistoryModalOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
