import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { RoleShell } from "@/components/role-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Eye } from "lucide-react";

export const Route = createFileRoute("/admin/audit")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Audit Logs — Admin" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AuditLogsPage,
});

type AuditLog = {
  id: string;
  created_at: string;
  action: string;
  module: string;
  record_id: string | null;
  user_id: string | null;
  previous_data: unknown;
  new_data: unknown;
};

const PAGE_SIZE = 25;

function AuditLogsPage() {
  const [moduleFilter, setModuleFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [page, setPage] = useState(0);
  const [viewing, setViewing] = useState<AuditLog | null>(null);

  const query = useQuery({
    queryKey: ["audit_logs", moduleFilter, actionFilter, page],
    queryFn: async () => {
      let q = supabase
        .from("audit_logs")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      if (moduleFilter.trim()) q = q.ilike("module", `%${moduleFilter.trim()}%`);
      if (actionFilter.trim()) q = q.ilike("action", `%${actionFilter.trim()}%`);
      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: (data ?? []) as AuditLog[], count: count ?? 0 };
    },
  });

  const rows = query.data?.rows ?? [];
  const total = query.data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <RoleShell role="admin" title="Audit Logs">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            placeholder="Filter by module"
            value={moduleFilter}
            onChange={(e) => {
              setPage(0);
              setModuleFilter(e.target.value);
            }}
          />
          <Input
            placeholder="Filter by action"
            value={actionFilter}
            onChange={(e) => {
              setPage(0);
              setActionFilter(e.target.value);
            }}
          />
        </div>

        <Card>
          <CardContent className="p-0">
            {query.isLoading ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
            ) : rows.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">No audit logs found.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Module</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Record</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead className="text-right">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap text-xs">
                        {new Date(r.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{r.module}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">{r.action}</TableCell>
                      <TableCell className="max-w-[160px] truncate text-xs text-muted-foreground">
                        {r.record_id ?? "—"}
                      </TableCell>
                      <TableCell className="max-w-[160px] truncate text-xs text-muted-foreground">
                        {r.user_id ?? "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => setViewing(r)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {page + 1} of {totalPages} · {total} logs
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page + 1 >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {viewing?.module} · {viewing?.action}
            </DialogTitle>
          </DialogHeader>
          {viewing && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">Previous data</p>
                <pre className="max-h-72 overflow-auto rounded-md bg-muted p-3 text-xs">
                  {JSON.stringify(viewing.previous_data ?? {}, null, 2)}
                </pre>
              </div>
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">New data</p>
                <pre className="max-h-72 overflow-auto rounded-md bg-muted p-3 text-xs">
                  {JSON.stringify(viewing.new_data ?? {}, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </RoleShell>
  );
}
