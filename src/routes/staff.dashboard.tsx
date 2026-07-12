import { createFileRoute } from "@tanstack/react-router";
import { RoleShell } from "@/components/role-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/staff/dashboard")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Staff Dashboard — Ababeel Quran Class" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: StaffDashboard,
});

function StaffDashboard() {
  return (
    <RoleShell role="staff" title="Staff Dashboard">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="font-display">Welcome</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Your assigned classes, attendance tools, and competition workflows will appear here as
            they are enabled by administration.
          </CardContent>
        </Card>
      </div>
    </RoleShell>
  );
}
