import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RoleShell } from "@/components/role-shell";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Printer, FileText } from "lucide-react";
import { ReportCardView, type ReportSnapshot } from "@/components/report-card-view";

export const Route = createFileRoute("/student/reports")({
  ssr: false,
  head: () => ({
    meta: [{ title: "My Reports — Student" }, { name: "robots", content: "noindex" }],
  }),
  component: Page,
});

type Report = {
  id: string;
  term_id: string;
  published_at: string;
  snapshot: ReportSnapshot;
  academic_terms: { term_name: string };
};

function Page() {
  const [reports, setReports] = useState<Report[]>([]);
  const [active, setActive] = useState<Report | null>(null);

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.from("students").select("id").maybeSingle();
      if (!s) return;
      const { data } = await supabase
        .from("progress_reports")
        .select("id, term_id, published_at, snapshot, academic_terms(term_name)")
        .eq("student_id", (s as { id: string }).id)
        .eq("status", "published")
        .order("published_at", { ascending: false });
      setReports((data ?? []) as unknown as Report[]);
    })();
  }, []);

  if (active) {
    return (
      <RoleShell role="student" title="Progress Report">
        <div className="mb-3 flex items-center justify-between no-print">
          <Button variant="ghost" size="sm" onClick={() => setActive(null)}>
            ← Back
          </Button>
          <Button size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-1" />
            Print / Save PDF
          </Button>
        </div>
        <ReportCardView snap={active.snapshot} />
      </RoleShell>
    );
  }

  return (
    <RoleShell role="student" title="My Reports">
      <div className="grid gap-3 sm:grid-cols-2">
        {reports.map((r) => (
          <Card
            key={r.id}
            className="cursor-pointer transition hover:shadow-md"
            onClick={() => setActive(r)}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4 text-primary" />
                {r.academic_terms?.term_name ?? "Term"}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Published {new Date(r.published_at).toLocaleDateString()}
            </CardContent>
          </Card>
        ))}
        {reports.length === 0 && (
          <Card className="sm:col-span-2">
            <CardContent className="p-6 text-sm text-muted-foreground">
              No published reports yet.
            </CardContent>
          </Card>
        )}
      </div>
    </RoleShell>
  );
}
