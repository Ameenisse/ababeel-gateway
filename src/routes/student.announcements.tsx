import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RoleShell } from "@/components/role-shell";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Megaphone } from "lucide-react";

export const Route = createFileRoute("/student/announcements")({
  ssr: false,
  head: () => ({ meta: [{ title: "Announcements — Student" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: Page,
});

type Announcement = {
  id: string;
  title: string;
  description: string | null;
  audience: string;
  priority: string;
  publish_date: string | null;
  expiry_date: string | null;
  status: string;
  created_at: string;
};

function Page() {
  const [rows, setRows] = useState<Announcement[]>([]);
  const [active, setActive] = useState<Announcement | null>(null);

  useEffect(() => {
    (async () => {
      const now = new Date().toISOString();
      const { data } = await supabase
        .from("announcements")
        .select("*")
        .eq("status", "published")
        .in("audience", ["all", "students"])
        .or(`publish_date.is.null,publish_date.lte.${now}`)
        .or(`expiry_date.is.null,expiry_date.gte.${now}`)
        .order("publish_date", { ascending: false, nullsFirst: false });
      setRows((data ?? []) as Announcement[]);
    })();
  }, []);

  return (
    <RoleShell role="student" title="Announcements">
      <div className="space-y-2">
        {rows.map((a) => (
          <Card key={a.id} className="cursor-pointer transition hover:shadow-md" onClick={() => setActive(a)}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base">
                <span className="flex items-center gap-2"><Megaphone className="h-4 w-4 text-primary" />{a.title}</span>
                <Badge variant={a.priority === "high" ? "destructive" : "secondary"}>{a.priority}</Badge>
              </CardTitle>
            </CardHeader>
            {a.description && (
              <CardContent className="line-clamp-2 text-sm text-muted-foreground">{a.description}</CardContent>
            )}
          </Card>
        ))}
        {rows.length === 0 && (
          <Card><CardContent className="p-6 text-sm text-muted-foreground">No announcements right now.</CardContent></Card>
        )}
      </div>

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{active?.title}</DialogTitle></DialogHeader>
          <div className="space-y-2 text-sm">
            <div className="flex gap-2">
              <Badge variant="outline">{active?.audience}</Badge>
              <Badge variant={active?.priority === "high" ? "destructive" : "secondary"}>{active?.priority}</Badge>
            </div>
            <p className="whitespace-pre-wrap text-muted-foreground">{active?.description}</p>
            {active?.publish_date && (
              <div className="text-xs text-muted-foreground">Published {new Date(active.publish_date).toLocaleDateString()}</div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </RoleShell>
  );
}
