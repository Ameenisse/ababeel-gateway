import { Star, Award, Calendar, CheckCircle2, UserCheck } from "lucide-react";

export type ReportItem = {
  title_dv: string;
  title_en: string | null;
  arabic_text?: string | null;
  completed: boolean;
  achievement_status?: string;
  teacher_comment?: string | null;
  completed_date?: string | null;
  star?: boolean;
};

export type ReportGroup = {
  name: string;
  name_dv?: string | null;
  items: ReportItem[];
};

export type ReportSnapshot = {
  student: {
    id?: string;
    full_name: string;
    student_number: string | null;
    photo_url: string | null;
  };
  class: { class_name: string | null; class_level: string | null } | null;
  term: { term_name: string; academic_year: string | null };
  teacher?: { name: string | null };
  attendance?: {
    total_days: number;
    present_days: number;
    absent_days: number;
    late_days: number;
    attendance_rate: number;
  };
  groups: ReportGroup[];
  badges: { code: string; name: string; icon: string | null; color: string | null }[];
  teacher_comment: string;
  parent_feedback: { parent_comment?: string; parent_name?: string; signature_date?: string };
  published_at?: string;
};

export function ReportCardView({ snap }: { snap: ReportSnapshot }) {
  const totalTargets = snap.groups.reduce((acc, g) => acc + g.items.length, 0);
  const completedTargets = snap.groups.reduce(
    (acc, g) => acc + g.items.filter((i) => i.completed).length,
    0,
  );
  const completionPercentage =
    totalTargets > 0 ? Math.round((completedTargets / totalTargets) * 100) : 0;

  return (
    <div className="report-card mx-auto max-w-[840px] bg-white text-slate-900 shadow-sm print:max-w-none print:shadow-none">
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 12mm; }
          .page-break { break-before: page; }
          .no-print { display: none !important; }
          body { background: white !important; }
        }
      `}</style>

      {/* Page 1 — Cover */}
      <section className="flex min-h-[260mm] flex-col items-center justify-between border-b border-slate-200 p-12 text-center">
        <div className="w-full space-y-2">
          <div className="text-xs font-semibold uppercase tracking-[0.35em] text-sky-700">
            Ababeel Quran Class
          </div>
          <div className="text-sm text-slate-500 font-dhivehi" dir="rtl">
            އަބާބީލް ޤުރްއާން ކްލާސް
          </div>
        </div>

        <div className="my-auto flex flex-col items-center space-y-6">
          <div className="relative">
            <div className="h-32 w-32 overflow-hidden rounded-full bg-sky-50 ring-4 ring-sky-100 flex items-center justify-center">
              {snap.student.photo_url ? (
                <img src={snap.student.photo_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-4xl font-bold text-sky-600">
                  {snap.student.full_name?.charAt(0) || "A"}
                </span>
              )}
            </div>
            {completedTargets === totalTargets && totalTargets > 0 && (
              <div className="absolute -bottom-2 -right-2 rounded-full bg-amber-400 p-2 text-white shadow-md">
                <Award className="h-6 w-6" />
              </div>
            )}
          </div>

          <div>
            <h1 className="font-display text-4xl font-bold text-sky-950">Target Progress Report</h1>
            <div className="mt-1 text-sm text-sky-700 font-dhivehi" dir="rtl">
              ޓާގެޓް ޕްރޮގްރެސް ރިޕޯޓް
            </div>
          </div>

          <div className="rounded-xl border border-sky-100 bg-sky-50/50 px-8 py-4 space-y-1">
            <div className="text-2xl font-bold text-slate-900">{snap.student.full_name}</div>
            <div className="flex items-center justify-center gap-2 text-sm text-slate-600">
              {snap.student.student_number && <span>ID: {snap.student.student_number}</span>}
              <span>·</span>
              <span>Class: {snap.class?.class_name ?? "—"}</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-6 text-center pt-4">
            <div className="rounded-lg border border-slate-200 p-4 min-w-[120px]">
              <div className="text-2xl font-bold text-sky-900">{completedTargets}</div>
              <div className="text-xs text-slate-500 uppercase tracking-wide">Achieved</div>
            </div>
            <div className="rounded-lg border border-slate-200 p-4 min-w-[120px]">
              <div className="text-2xl font-bold text-slate-700">{totalTargets}</div>
              <div className="text-xs text-slate-500 uppercase tracking-wide">Total Targets</div>
            </div>
            <div className="rounded-lg border border-slate-200 p-4 min-w-[120px]">
              <div className="text-2xl font-bold text-emerald-600">{completionPercentage}%</div>
              <div className="text-xs text-slate-500 uppercase tracking-wide">Completion</div>
            </div>
          </div>
        </div>

        <div className="w-full border-t border-slate-200 pt-6 text-sm text-slate-600 flex justify-between items-center">
          <div>
            <span className="font-semibold text-slate-900">{snap.term.term_name}</span>
            {snap.term.academic_year && <span> · {snap.term.academic_year}</span>}
          </div>
          {snap.published_at && (
            <div className="text-xs text-slate-500">
              Issued: {new Date(snap.published_at).toLocaleDateString()}
            </div>
          )}
        </div>
      </section>

      {/* Page 2+ — Target checklist star grids */}
      {snap.groups.map((group, gIdx) => (
        <section key={gIdx} className="page-break p-10 space-y-6">
          <div className="border-b-2 border-sky-600 pb-3 flex justify-between items-end">
            <div>
              <h2 className="font-display text-2xl font-bold text-sky-900">{group.name}</h2>
              {group.name_dv && (
                <div className="text-sm text-sky-700 font-dhivehi" dir="rtl">
                  {group.name_dv}
                </div>
              )}
            </div>
            <div className="text-xs text-slate-500">
              {group.items.filter((i) => i.completed).length} / {group.items.length} Completed
            </div>
          </div>

          <div className="space-y-3">
            {group.items.map((item, idx) => (
              <div
                key={idx}
                className={`flex items-start gap-4 rounded-lg border p-4 transition-colors ${
                  item.completed
                    ? "border-emerald-200 bg-emerald-50/30"
                    : "border-slate-200 bg-slate-50/40"
                }`}
              >
                {/* Achievement Star */}
                <div className="shrink-0 pt-0.5">
                  {item.completed ? (
                    <div className="flex flex-col items-center">
                      <Star className="h-7 w-7 fill-red-500 text-red-500 drop-shadow-sm" />
                      <span className="text-[10px] font-bold text-red-600 uppercase tracking-tighter mt-0.5">
                        Achieved
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <Star className="h-7 w-7 text-slate-300 stroke-[1.5]" />
                      <span className="text-[10px] text-slate-400 mt-0.5">—</span>
                    </div>
                  )}
                </div>

                {/* Target Content */}
                <div className="flex-1 space-y-1">
                  {/* Arabic Text if provided */}
                  {item.arabic_text && (
                    <div
                      className="text-right text-lg font-bold text-slate-900 font-arabic leading-relaxed"
                      dir="rtl"
                    >
                      {item.arabic_text}
                    </div>
                  )}

                  {/* Dhivehi Title */}
                  <div
                    className="text-right font-semibold text-slate-900 font-dhivehi text-base"
                    dir="rtl"
                  >
                    {item.title_dv}
                  </div>

                  {/* English Title */}
                  {item.title_en && (
                    <div className="text-xs text-slate-600 font-medium">{item.title_en}</div>
                  )}

                  {/* Teacher Feedback */}
                  {item.teacher_comment && (
                    <div className="mt-2 rounded bg-white/80 p-2 text-xs text-slate-700 border border-slate-200/80">
                      <span className="font-semibold text-sky-800">Teacher note: </span>
                      {item.teacher_comment}
                    </div>
                  )}
                </div>

                {/* Date stamp if completed */}
                {item.completed && item.completed_date && (
                  <div className="shrink-0 text-right text-[11px] text-slate-400">
                    <CheckCircle2 className="h-3.5 w-3.5 inline mr-1 text-emerald-600" />
                    {new Date(item.completed_date).toLocaleDateString()}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}

      {/* Page 3: Awards & Attendance Summary */}
      <section className="page-break p-10 space-y-8">
        <div>
          <h2 className="mb-4 border-b-2 border-sky-600 pb-2 font-display text-2xl font-bold text-sky-900">
            Awards & Honors
          </h2>
          {snap.badges.length ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {snap.badges.map((b) => (
                <div
                  key={b.code}
                  className="rounded-xl border-2 p-4 text-center transition-all"
                  style={{
                    borderColor: b.color ?? "#e2c98a",
                    background: (b.color ?? "#fef7e0") + "22",
                  }}
                >
                  <div className="text-4xl mb-2">{b.icon ?? "🏅"}</div>
                  <div className="font-bold text-slate-900">{b.name}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
              No special awards recorded for this term.
            </div>
          )}
        </div>

        {/* Attendance Summary */}
        {snap.attendance && (
          <div>
            <h3 className="mb-3 font-display text-lg font-bold text-sky-900 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-sky-600" />
              Attendance Summary
            </h3>
            <div className="grid grid-cols-4 gap-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-center">
              <div>
                <div className="text-xl font-bold text-slate-900">
                  {snap.attendance.total_days || 0}
                </div>
                <div className="text-xs text-slate-500">Total Classes</div>
              </div>
              <div>
                <div className="text-xl font-bold text-emerald-600">
                  {snap.attendance.present_days || 0}
                </div>
                <div className="text-xs text-slate-500">Present</div>
              </div>
              <div>
                <div className="text-xl font-bold text-rose-600">
                  {snap.attendance.absent_days || 0}
                </div>
                <div className="text-xs text-slate-500">Absent</div>
              </div>
              <div>
                <div className="text-xl font-bold text-sky-600">
                  {snap.attendance.attendance_rate || 0}%
                </div>
                <div className="text-xs text-slate-500">Attendance Rate</div>
              </div>
            </div>
          </div>
        )}

        {/* Teacher's Overall Comment */}
        <div className="space-y-2">
          <h3 className="font-display text-lg font-bold text-sky-900 flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-sky-600" />
            Teacher's Overall Assessment & Remarks
          </h3>
          <div className="min-h-[100px] whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-sm text-slate-800 leading-relaxed">
            {snap.teacher_comment || (
              <span className="text-slate-400 italic">No overall teacher remarks recorded.</span>
            )}
          </div>
        </div>

        {/* Parent Feedback & Signatures */}
        <div className="space-y-4 pt-4 border-t border-slate-200">
          <div>
            <h4 className="font-semibold text-slate-800 text-sm">Parent / Guardian Feedback</h4>
            <div className="mt-1 min-h-[70px] whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50/40 p-3 text-sm text-slate-700">
              {snap.parent_feedback?.parent_comment || (
                <span className="text-slate-400 italic">No comments submitted.</span>
              )}
            </div>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-12 pt-6">
            <div className="space-y-2">
              <div className="border-b border-slate-400 pb-10"></div>
              <div className="text-xs font-semibold text-slate-700">Class Teacher Signature</div>
              <div className="text-[11px] text-slate-400">
                {snap.teacher?.name ?? "Ababeel Quran Class Faculty"}
              </div>
            </div>

            <div className="space-y-2">
              <div className="border-b border-slate-400 pb-10"></div>
              <div className="text-xs font-semibold text-slate-700">
                Parent / Guardian Signature
              </div>
              <div className="text-[11px] text-slate-400">
                {snap.parent_feedback?.parent_name ?? "Parent / Guardian"}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
