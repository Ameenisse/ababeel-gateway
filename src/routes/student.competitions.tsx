import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { RoleShell } from "@/components/role-shell";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Trophy } from "lucide-react";

export const Route = createFileRoute("/student/competitions")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Competitions — Student" }, { name: "robots", content: "noindex,nofollow" }],
  }),
  component: Page,
});

type Category = { id: string; category_name: string };
type Competition = {
  id: string;
  title: string;
  short_description: string | null;
  status: string;
  student_registration_enabled: boolean;
  registration_open_date: string | null;
  registration_close_date: string | null;
  competition_categories: Category[];
};
type Participation = {
  id: string;
  competition_id: string;
  category_id: string | null;
  approval_status: string;
  participation_status: string;
};
type Result = {
  id: string;
  participant_id: string;
  rank: number | null;
  grade: string | null;
  score: number | null;
  is_published: boolean;
};

function isRegistrationOpen(c: Competition) {
  if (!c.student_registration_enabled) return false;
  const now = new Date();
  if (c.registration_open_date && now < new Date(c.registration_open_date)) return false;
  if (c.registration_close_date && now > new Date(c.registration_close_date)) return false;
  return true;
}

function Page() {
  const [studentId, setStudentId] = useState<string | null>(null);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [participations, setParticipations] = useState<Participation[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [registerFor, setRegisterFor] = useState<Competition | null>(null);
  const [categoryId, setCategoryId] = useState<string>("");
  const [agreed, setAgreed] = useState(false);

  const load = useCallback(async () => {
    const { data: s } = await supabase.from("students").select("id").maybeSingle();
    const sid = (s as { id: string } | null)?.id ?? null;
    setStudentId(sid);
    const { data } = await supabase
      .from("competitions")
      .select(
        "id, title, short_description, status, student_registration_enabled, registration_open_date, registration_close_date, competition_categories(id, category_name)",
      )
      .neq("status", "draft")
      .order("created_at", { ascending: false });
    setCompetitions((data ?? []) as unknown as Competition[]);
    if (sid) {
      const { data: parts } = await supabase
        .from("competition_participants")
        .select("id, competition_id, category_id, approval_status, participation_status")
        .eq("student_id", sid);
      setParticipations((parts ?? []) as Participation[]);
      const ids = (parts ?? []).map((p: { id: string }) => p.id);
      if (ids.length) {
        const { data: res } = await supabase
          .from("competition_results")
          .select("id, participant_id, rank, grade, score, is_published")
          .in("participant_id", ids)
          .eq("is_published", true);
        setResults((res ?? []) as Result[]);
      }
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openRegister(c: Competition) {
    setRegisterFor(c);
    setCategoryId(c.competition_categories?.[0]?.id ?? "");
    setAgreed(false);
  }

  async function submitRegistration() {
    if (!registerFor || !studentId) return;
    if (!agreed) {
      toast.error("You must agree to the rules");
      return;
    }
    try {
      const { data: s } = await supabase
        .from("students")
        .select("full_name, gender, date_of_birth")
        .eq("id", studentId)
        .single();
      const student = s as { full_name: string; gender: string; date_of_birth: string } | null;
      const { error } = await supabase.from("competition_participants").insert([
        {
          competition_id: registerFor.id,
          category_id: categoryId || null,
          participant_type: "student",
          student_id: studentId,
          full_name: student?.full_name ?? "",
          gender: student?.gender ?? null,
          date_of_birth: student?.date_of_birth ?? null,
          agreed_to_rules: agreed,
          registration_number: `REG-${Date.now()}`,
        },
      ]);
      if (error) throw error;
      toast.success("Registered successfully");
      setRegisterFor(null);
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Registration failed");
    }
  }

  return (
    <RoleShell role="student" title="Competitions">
      <div className="grid gap-3 sm:grid-cols-2">
        {competitions.map((c) => {
          const mine = participations.find((p) => p.competition_id === c.id);
          const myResult = mine ? results.find((r) => r.participant_id === mine.id) : undefined;
          const open = isRegistrationOpen(c);
          return (
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
                {c.short_description && (
                  <div className="text-muted-foreground">{c.short_description}</div>
                )}
                {mine ? (
                  <div className="rounded-md border border-border/60 p-2">
                    <div>
                      Registered · <Badge variant="secondary">{mine.approval_status}</Badge>
                    </div>
                    {myResult && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        {myResult.rank && `Rank: ${myResult.rank} `}
                        {myResult.grade && `Grade: ${myResult.grade} `}
                        {myResult.score != null && `Score: ${myResult.score}`}
                      </div>
                    )}
                  </div>
                ) : open ? (
                  <Button size="sm" onClick={() => openRegister(c)}>
                    Register
                  </Button>
                ) : (
                  <div className="text-xs text-muted-foreground">Registration not open.</div>
                )}
              </CardContent>
            </Card>
          );
        })}
        {competitions.length === 0 && (
          <Card className="sm:col-span-2">
            <CardContent className="p-6 text-sm text-muted-foreground">
              No competitions available.
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={!!registerFor} onOpenChange={(o) => !o && setRegisterFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Register for {registerFor?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {registerFor?.competition_categories?.length ? (
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {registerFor.competition_categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.category_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={agreed} onCheckedChange={(v) => setAgreed(!!v)} />I agree to the
              competition rules
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRegisterFor(null)}>
              Cancel
            </Button>
            <Button onClick={submitRegistration}>Submit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </RoleShell>
  );
}
