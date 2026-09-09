import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RoleShell } from "@/components/role-shell";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Users } from "lucide-react";

export const Route = createFileRoute("/staff/competitions")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Competitions — Staff" }, { name: "robots", content: "noindex,nofollow" }],
  }),
  component: Page,
});

type Category = { id: string; category_name: string; category_code: string };
type Competition = {
  id: string;
  title: string;
  status: string;
  competition_date: string | null;
  competition_categories: Category[];
};

function Page() {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("competitions")
        .select(
          "id, title, status, competition_date, competition_categories(id, category_name, category_code)",
        )
        .order("created_at", { ascending: false });
      if (error) return;
      const list = (data ?? []) as unknown as Competition[];
      setCompetitions(list);
      const { data: parts } = await supabase
        .from("competition_participants")
        .select("competition_id");
      const map: Record<string, number> = {};
      for (const p of (parts ?? []) as { competition_id: string }[]) {
        map[p.competition_id] = (map[p.competition_id] ?? 0) + 1;
      }
      setCounts(map);
    })();
  }, []);

  return (
    <RoleShell role="staff" title="Competitions">
      <div className="grid gap-3 sm:grid-cols-2">
        {competitions.map((c) => (
          <Card key={c.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base">
                <span className="flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-primary" />
                  {c.title}
                </span>
                <Badge variant="outline">{c.status}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {c.competition_date && (
                <div className="text-muted-foreground">
                  Date: {new Date(c.competition_date).toLocaleDateString()}
                </div>
              )}
              <div className="flex items-center gap-1 text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                {counts[c.id] ?? 0} participants
              </div>
              <div className="flex flex-wrap gap-1 pt-1">
                {(c.competition_categories ?? []).map((cat) => (
                  <Badge key={cat.id} variant="secondary">
                    {cat.category_name}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
        {competitions.length === 0 && (
          <Card className="sm:col-span-2">
            <CardContent className="p-6 text-sm text-muted-foreground">
              No competitions yet.
            </CardContent>
          </Card>
        )}
      </div>
    </RoleShell>
  );
}
