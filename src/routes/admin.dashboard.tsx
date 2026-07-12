import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { RoleShell } from "@/components/role-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users,
  GraduationCap,
  ClipboardList,
  Trophy,
  Megaphone,
  ListChecks,
} from "lucide-react";

export const Route = createFileRoute("/admin/dashboard")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Admin Dashboard — Ababeel Quran Class" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AdminDashboard,
});

function StatCard({
  label,
  value,
  icon: Icon,
  tone = "primary",
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  tone?: "primary" | "gold" | "success" | "warning" | "info";
}) {
  const bg =
    tone === "gold"
      ? "bg-gold/20 text-gold-foreground"
      : tone === "success"
        ? "bg-success/15 text-success"
        : tone === "warning"
          ? "bg-warning/20 text-warning-foreground"
          : tone === "info"
            ? "bg-info/15 text-info"
            : "bg-primary/15 text-primary";
  return (
    <Card className="border-border/60">
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${bg}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="font-display text-2xl font-bold">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function AdminDashboard() {
  const stats = useQuery({
    queryKey: ["admin_dashboard_stats"],
    queryFn: async () => {
      const [students, staff, pending, approved, comps, participants, announcements] = await Promise.all([
        supabase.from("students").select("*", { count: "exact", head: true }),
        supabase.from("staff").select("*", { count: "exact", head: true }),
        supabase.from("admission_requests").select("*", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("admission_requests").select("*", { count: "exact", head: true }).eq("status", "approved"),
        supabase.from("competitions").select("*", { count: "exact", head: true }).in("status", ["published", "registration_open"]),
        supabase.from("competition_participants").select("*", { count: "exact", head: true }).eq("approval_status", "pending"),
        supabase.from("announcements").select("*", { count: "exact", head: true }).eq("status", "published"),
      ]);
      return {
        students: students.count ?? 0,
        staff: staff.count ?? 0,
        pending: pending.count ?? 0,
        approved: approved.count ?? 0,
        comps: comps.count ?? 0,
        participants: participants.count ?? 0,
        announcements: announcements.count ?? 0,
      };
    },
  });

  const s = stats.data;

  return (
    <RoleShell role="admin" title="Admin Dashboard">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <StatCard label="Total Students" value={s?.students ?? "—"} icon={GraduationCap} tone="primary" />
        <StatCard label="Total Staff" value={s?.staff ?? "—"} icon={Users} tone="info" />
        <StatCard label="Pending Admissions" value={s?.pending ?? "—"} icon={ClipboardList} tone="warning" />
        <StatCard label="Approved Admissions" value={s?.approved ?? "—"} icon={GraduationCap} tone="success" />
        <StatCard label="Active Competitions" value={s?.comps ?? "—"} icon={Trophy} tone="gold" />
        <StatCard label="Pending Participants" value={s?.participants ?? "—"} icon={ListChecks} tone="warning" />
        <StatCard label="Announcements" value={s?.announcements ?? "—"} icon={Megaphone} tone="primary" />
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="font-display">Welcome, Admin</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p>
              This is the foundation of your admin panel. Modules in the sidebar are stubbed and will
              be built out in the next phases: admissions, students, users, competitions, attendance,
              announcements, reports, and settings.
            </p>
            <p className="mt-3">
              To bootstrap: create the first admin auth user (Users tab in Cloud), then grant the{" "}
              <code className="rounded bg-muted px-1 py-0.5">admin</code> role in{" "}
              <code className="rounded bg-muted px-1 py-0.5">user_roles</code>.
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="font-display">System Status</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center justify-between">
                <span className="text-muted-foreground">Database</span>
                <span className="rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success">
                  Connected
                </span>
              </li>
              <li className="flex items-center justify-between">
                <span className="text-muted-foreground">Authentication</span>
                <span className="rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success">
                  Ready
                </span>
              </li>
              <li className="flex items-center justify-between">
                <span className="text-muted-foreground">Storage</span>
                <span className="rounded-full bg-warning/20 px-2 py-0.5 text-xs font-medium text-warning-foreground">
                  Configure in Phase 2
                </span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </RoleShell>
  );
}
