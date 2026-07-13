import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { RoleShell } from "@/components/role-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Copy, Printer, CheckCircle2, XCircle, Clock } from "lucide-react";
import {
  approveAdmissionRequest,
  setAdmissionStatus,
} from "@/lib/admissions.functions";

export const Route = createFileRoute("/admin/admissions")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Admission Requests — Admin" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AdminAdmissions,
});

type Status = "pending" | "approved" | "rejected" | "waitlisted" | "all";

function statusBadge(s: string) {
  const map: Record<string, string> = {
    pending: "bg-warning/20 text-warning-foreground",
    approved: "bg-success/15 text-success",
    rejected: "bg-destructive/15 text-destructive",
    waitlisted: "bg-info/15 text-info",
  };
  return <Badge className={map[s] ?? "bg-muted"}>{s}</Badge>;
}

function AdminAdmissions() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Status>("pending");
  const [search, setSearch] = useState("");

  const list = useQuery({
    queryKey: ["admissions", tab],
    queryFn: async () => {
      let q = supabase
        .from("admission_requests")
        .select("*, preferred_class:classes(id,class_name)")
        .order("submitted_at", { ascending: false });
      if (tab !== "all") q = q.eq("status", tab);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const classes = useQuery({
    queryKey: ["classes_active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classes")
        .select("id,class_name,class_code,session")
        .eq("status", "active")
        .order("class_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const rows = list.data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.full_name?.toLowerCase().includes(q) ||
        r.request_number?.toLowerCase().includes(q) ||
        r.mobile?.toLowerCase().includes(q) ||
        r.identity_number?.toLowerCase().includes(q),
    );
  }, [list.data, search]);

  // ---- Approve dialog ----
  const [approving, setApproving] = useState<null | { id: string; name: string }>(null);
  const [classId, setClassId] = useState<string>("");
  const approveFn = useServerFn(approveAdmissionRequest);
  const approveMut = useMutation({
    mutationFn: async () =>
      approveFn({
        data: { requestId: approving!.id, classId: classId || null },
      }),
    onSuccess: (creds) => {
      qc.invalidateQueries({ queryKey: ["admissions"] });
      qc.invalidateQueries({ queryKey: ["admin_dashboard_stats"] });
      setApproving(null);
      setClassId("");
      setCredentials({ ...creds, name: approving?.name ?? "Student" });
    },
    onError: (e: unknown) => toast.error((e as Error).message ?? "Failed to approve"),
  });

  // ---- Reject dialog ----
  const [rejecting, setRejecting] = useState<null | { id: string; name: string; action: "rejected" | "waitlisted" }>(null);
  const [rejectNote, setRejectNote] = useState("");
  const statusFn = useServerFn(setAdmissionStatus);
  const statusMut = useMutation({
    mutationFn: async () =>
      statusFn({
        data: {
          requestId: rejecting!.id,
          status: rejecting!.action,
          adminNote: rejectNote || undefined,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admissions"] });
      toast.success("Updated");
      setRejecting(null);
      setRejectNote("");
    },
    onError: (e: unknown) => toast.error((e as Error).message ?? "Failed"),
  });

  // ---- Credentials modal ----
  const [credentials, setCredentials] = useState<null | {
    studentNumber: string;
    username: string;
    pin: string;
    name: string;
  }>(null);

  function copyCreds() {
    if (!credentials) return;
    const text = `Ababeel Quran Class — Student Login\nName: ${credentials.name}\nStudent #: ${credentials.studentNumber}\nUsername: ${credentials.username}\nPIN: ${credentials.pin}`;
    navigator.clipboard.writeText(text);
    toast.success("Credentials copied");
  }

  function printCreds() {
    if (!credentials) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<html><head><title>Student Credentials</title>
      <style>body{font-family:system-ui;padding:2rem}h1{font-size:1.25rem}dl{margin-top:1rem}dt{font-weight:600;margin-top:.5rem}dd{margin:0 0 .5rem 0;font-family:ui-monospace,monospace;font-size:1.1rem}</style>
    </head><body><h1>Ababeel Quran Class — Student Login</h1><dl>
      <dt>Name</dt><dd>${credentials.name}</dd>
      <dt>Student #</dt><dd>${credentials.studentNumber}</dd>
      <dt>Username</dt><dd>${credentials.username}</dd>
      <dt>PIN</dt><dd>${credentials.pin}</dd>
    </dl><p style="margin-top:2rem;color:#666;font-size:.85rem">Please keep this information private.</p></body></html>`);
    w.document.close();
    w.print();
  }

  return (
    <RoleShell role="admin" title="Admission Requests">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Tabs value={tab} onValueChange={(v) => setTab(v as Status)}>
            <TabsList>
              <TabsTrigger value="pending">Pending</TabsTrigger>
              <TabsTrigger value="approved">Approved</TabsTrigger>
              <TabsTrigger value="waitlisted">Waitlisted</TabsTrigger>
              <TabsTrigger value="rejected">Rejected</TabsTrigger>
              <TabsTrigger value="all">All</TabsTrigger>
            </TabsList>
          </Tabs>
          <Input
            placeholder="Search name, request #, mobile, ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="sm:max-w-sm"
          />
        </div>

        {list.isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              No admission requests here.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {filtered.map((r) => (
              <Card key={r.id} className="border-border/60">
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-display text-base font-semibold">{r.full_name}</span>
                      {statusBadge(r.status)}
                      <span className="text-xs text-muted-foreground">#{r.request_number}</span>
                    </div>
                    <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-muted-foreground sm:grid-cols-4">
                      <span>DOB: {r.date_of_birth}</span>
                      <span>Gender: {r.gender}</span>
                      <span>Mobile: {r.mobile}</span>
                      <span>Guardian: {r.guardian_name}</span>
                      <span>
                        Class:{" "}
                        {(r as { preferred_class?: { class_name?: string } }).preferred_class
                          ?.class_name ?? "—"}
                      </span>
                      <span>Session: {r.preferred_session ?? "—"}</span>
                      <span>Submitted: {new Date(r.submitted_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  {r.status === "pending" && (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          setApproving({ id: r.id, name: r.full_name });
                          setClassId(r.preferred_class?.id ?? "");
                        }}
                      >
                        <CheckCircle2 className="mr-1 h-4 w-4" /> Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setRejecting({ id: r.id, name: r.full_name, action: "waitlisted" })
                        }
                      >
                        <Clock className="mr-1 h-4 w-4" /> Waitlist
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() =>
                          setRejecting({ id: r.id, name: r.full_name, action: "rejected" })
                        }
                      >
                        <XCircle className="mr-1 h-4 w-4" /> Reject
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Approve dialog */}
      <Dialog open={!!approving} onOpenChange={(o) => !o && setApproving(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve admission</DialogTitle>
            <DialogDescription>
              Approving <strong>{approving?.name}</strong> creates a student profile and login
              credentials.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Assign to class (optional)</Label>
              <Select value={classId} onValueChange={setClassId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a class…" />
                </SelectTrigger>
                <SelectContent>
                  {(classes.data ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.class_name} {c.session ? `· ${c.session}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">
                You can assign or change the class later from Student Management.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproving(null)}>
              Cancel
            </Button>
            <Button disabled={approveMut.isPending} onClick={() => approveMut.mutate()}>
              {approveMut.isPending ? "Approving…" : "Approve & create student"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject / waitlist dialog */}
      <Dialog open={!!rejecting} onOpenChange={(o) => !o && setRejecting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {rejecting?.action === "rejected" ? "Reject" : "Waitlist"} admission
            </DialogTitle>
            <DialogDescription>{rejecting?.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Note (optional)</Label>
            <Textarea
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              rows={4}
              placeholder="Reason or notes for internal records…"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejecting(null)}>
              Cancel
            </Button>
            <Button
              variant={rejecting?.action === "rejected" ? "destructive" : "default"}
              disabled={statusMut.isPending}
              onClick={() => statusMut.mutate()}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Credentials modal */}
      <Dialog open={!!credentials} onOpenChange={(o) => !o && setCredentials(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Student created</DialogTitle>
            <DialogDescription>
              Copy or print these credentials now. The PIN will not be shown again.
            </DialogDescription>
          </DialogHeader>
          {credentials && (
            <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-2 rounded-lg border border-border/60 bg-muted/40 p-4 text-sm">
              <dt className="text-muted-foreground">Name</dt>
              <dd className="font-medium">{credentials.name}</dd>
              <dt className="text-muted-foreground">Student #</dt>
              <dd className="font-mono">{credentials.studentNumber}</dd>
              <dt className="text-muted-foreground">Username</dt>
              <dd className="font-mono">{credentials.username}</dd>
              <dt className="text-muted-foreground">PIN</dt>
              <dd className="font-mono text-lg font-bold text-primary">{credentials.pin}</dd>
            </dl>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={copyCreds}>
              <Copy className="mr-1 h-4 w-4" /> Copy
            </Button>
            <Button variant="outline" onClick={printCreds}>
              <Printer className="mr-1 h-4 w-4" /> Print
            </Button>
            <Button onClick={() => setCredentials(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </RoleShell>
  );
}
