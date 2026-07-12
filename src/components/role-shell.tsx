import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, Link, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  UserCog,
  BookOpen,
  CalendarCheck,
  Trophy,
  Megaphone,
  FileText,
  Settings,
  Cog,
  ListChecks,
  ClipboardList,
  LogOut,
  Shield,
} from "lucide-react";
import { getMyRole } from "@/lib/auth.functions";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

type Role = "admin" | "staff" | "student";

const menus: Record<Role, { label: string; to: string; icon: React.ElementType }[]> = {
  admin: [
    { label: "Dashboard", to: "/admin/dashboard", icon: LayoutDashboard },
    { label: "Admission Requests", to: "/admin/admissions", icon: ClipboardList },
    { label: "Students", to: "/admin/students", icon: GraduationCap },
    { label: "Staff", to: "/admin/staff", icon: Users },
    { label: "Users", to: "/admin/users", icon: UserCog },
    { label: "Classes", to: "/admin/classes", icon: BookOpen },
    { label: "Attendance", to: "/admin/attendance", icon: CalendarCheck },
    { label: "Competitions", to: "/admin/competitions", icon: Trophy },
    { label: "Participants", to: "/admin/participants", icon: ListChecks },
    { label: "Announcements", to: "/admin/announcements", icon: Megaphone },
    { label: "Reports", to: "/admin/reports", icon: FileText },
    { label: "Website Settings", to: "/admin/website", icon: Settings },
    { label: "System Settings", to: "/admin/system", icon: Cog },
    { label: "Audit Log", to: "/admin/audit", icon: Shield },
  ],
  staff: [
    { label: "Dashboard", to: "/staff/dashboard", icon: LayoutDashboard },
    { label: "My Classes", to: "/staff/classes", icon: BookOpen },
    { label: "Attendance", to: "/staff/attendance", icon: CalendarCheck },
    { label: "Competitions", to: "/staff/competitions", icon: Trophy },
    { label: "Announcements", to: "/staff/announcements", icon: Megaphone },
  ],
  student: [
    { label: "Dashboard", to: "/student/dashboard", icon: LayoutDashboard },
    { label: "My Profile", to: "/student/profile", icon: GraduationCap },
    { label: "Attendance", to: "/student/attendance", icon: CalendarCheck },
    { label: "Competitions", to: "/student/competitions", icon: Trophy },
    { label: "Announcements", to: "/student/announcements", icon: Megaphone },
  ],
};

function RoleSidebar({ role }: { role: Role }) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const currentPath = useRouterState({ select: (r) => r.location.pathname });
  const items = menus[role];
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: role === "student" ? "/student-login" : role === "staff" ? "/staff" : "/admin", replace: true });
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <div className="flex items-center gap-2 px-3 pb-2 pt-4">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
            <BookOpen className="h-4 w-4" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="truncate font-display text-sm font-bold">Ababeel</div>
              <div className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">
                {role} Panel
              </div>
            </div>
          )}
        </div>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const active = currentPath === item.to || currentPath.startsWith(item.to + "/");
                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton asChild isActive={active}>
                      <Link to={item.to} className={cn("flex items-center gap-2")}>
                        <item.icon className="h-4 w-4" />
                        {!collapsed && <span>{item.label}</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <Button variant="ghost" size="sm" className="w-full justify-start" onClick={handleSignOut}>
          <LogOut className="mr-2 h-4 w-4" />
          {!collapsed && "Sign out"}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}

export function RoleShell({
  role,
  title,
  children,
}: {
  role: Role;
  title: string;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const loginPath = role === "student" ? "/student-login" : role === "staff" ? "/staff" : "/admin";
        navigate({ to: loginPath, replace: true });
        return;
      }
      try {
        const r = await getMyRole();
        if (r.role !== role && !(role === "staff" && r.role === "admin")) {
          toast.error("You don't have access to this area.");
          const path = r.role === "admin" ? "/admin/dashboard" : r.role === "staff" ? "/staff/dashboard" : r.role === "student" ? "/student/dashboard" : "/";
          navigate({ to: path, replace: true });
          return;
        }
        if (!cancelled) setReady(true);
      } catch {
        navigate({ to: "/", replace: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [role, navigate]);

  if (!ready) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <div className="text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <RoleSidebar role={role} />
        <div className="flex flex-1 flex-col">
          <header className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b border-border/60 bg-background/85 px-4 backdrop-blur">
            <SidebarTrigger />
            <h1 className="font-display text-lg font-semibold">{title}</h1>
          </header>
          <main className="flex-1 p-4 sm:p-6">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
