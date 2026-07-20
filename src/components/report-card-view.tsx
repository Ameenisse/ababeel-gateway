import { Star } from "lucide-react";

export type ReportSnapshot = {
  student: { full_name: string; student_number: string | null; photo_url: string | null };
  class: { class_name: string | null; class_level: string | null } | null;
  term: { term_name: string; academic_year: string | null };
  groups: { name: string; items: { title_dv: string; title_en: string | null; completed: boolean }[] }[];
  badges: { code: string; name: string; icon: string | null; color: string | null }[];
  teacher_comment: string;
  parent_feedback: { parent_comment?: string; parent_name?: string };
};

export function ReportCardView({ snap }: { snap: ReportSnapshot }) {
  return (
    <div className="report-card mx-auto max-w-[820px] bg-white text-slate-900 print:max-w-none">
      <style>{`@media print { @page { size: A4; margin: 14mm; } .page-break { break-before: page; } .no-print { display: none !important; } body { background: white; } }`}</style>

      {/* Page 1 — Cover */}
      <section className="flex min-h-[260mm] flex-col items-center justify-center gap-6 border-b border-slate-200 p-10 text-center">
        <div className="text-xs uppercase tracking-[0.35em] text-sky-700">Ababeel Quran Class</div>
        <h1 className="font-display text-4xl font-bold text-sky-900">Progress Report</h1>
        <div className="mt-4 h-24 w-24 overflow-hidden rounded-full bg-sky-50 ring-2 ring-sky-200">
          {snap.student.photo_url && <img src={snap.student.photo_url} alt="" className="h-full w-full object-cover" />}
        </div>
        <div className="text-2xl font-semibold">{snap.student.full_name}</div>
        <div className="text-sm text-slate-600">
          {snap.student.student_number ?? ""} · {snap.class?.class_name ?? "—"}
        </div>
        <div className="mt-6 text-sm">
          <span className="font-medium">{snap.term.term_name}</span>
          {snap.term.academic_year && <> · {snap.term.academic_year}</>}
        </div>
      </section>

      {/* Page 2+ — Target star grids */}
      {snap.groups.map((g) => (
        <section key={g.name} className="page-break p-10">
          <h2 className="mb-4 border-b border-sky-200 pb-2 font-display text-2xl font-semibold text-sky-900">{g.name}</h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {g.items.map((it, i) => (
              <div key={i} className="flex items-center gap-3 rounded-md border border-slate-200 p-3">
                {it.completed ? (
                  <Star className="h-6 w-6 shrink-0 fill-red-500 text-red-500" />
                ) : (
                  <div className="h-6 w-6 shrink-0 rounded-full border-2 border-slate-300" />
                )}
                <div className="flex-1">
                  <div className="text-right font-medium" dir="rtl">{it.title_dv}</div>
                  {it.title_en && <div className="text-xs text-slate-500">{it.title_en}</div>}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      {/* Awards page */}
      <section className="page-break p-10">
        <h2 className="mb-6 border-b border-sky-200 pb-2 font-display text-2xl font-semibold text-sky-900">Awards</h2>
        {snap.badges.length ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {snap.badges.map((b) => (
              <div key={b.code} className="rounded-xl border-2 p-4 text-center" style={{ borderColor: b.color ?? "#e2c98a", background: (b.color ?? "#fef7e0") + "22" }}>
                <div className="text-4xl">{b.icon ?? "🏅"}</div>
                <div className="mt-2 font-semibold">{b.name}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-slate-500">No awards this term.</div>
        )}
      </section>

      {/* Feedback + signatures */}
      <section className="page-break p-10 space-y-6">
        <div>
          <h3 className="mb-2 font-display text-lg font-semibold text-sky-900">Teacher's comment</h3>
          <div className="min-h-[80px] whitespace-pre-wrap rounded-md border border-slate-200 bg-slate-50/60 p-4 text-sm">
            {snap.teacher_comment || <span className="text-slate-400">—</span>}
          </div>
        </div>
        <div>
          <h3 className="mb-2 font-display text-lg font-semibold text-sky-900">Parent / guardian feedback</h3>
          <div className="min-h-[80px] whitespace-pre-wrap rounded-md border border-slate-200 bg-slate-50/60 p-4 text-sm">
            {snap.parent_feedback?.parent_comment || <span className="text-slate-400">—</span>}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-6 text-sm">
            <div>
              <div className="border-b border-slate-400 pb-6"></div>
              <div className="mt-1 text-slate-500">Parent / guardian signature</div>
              {snap.parent_feedback?.parent_name && <div className="text-xs">{snap.parent_feedback.parent_name}</div>}
            </div>
            <div>
              <div className="border-b border-slate-400 pb-6"></div>
              <div className="mt-1 text-slate-500">Class teacher signature</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
