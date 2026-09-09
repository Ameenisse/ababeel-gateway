import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { RoleShell } from "@/components/role-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/system")({
  ssr: false,
  head: () => ({
    meta: [{ title: "System Settings — Admin" }, { name: "robots", content: "noindex,nofollow" }],
  }),
  component: SystemSettingsPage,
});

type AdmissionSettings = {
  id: string;
  title: string;
  description: string | null;
  rules: string | null;
  rules_pdf_url: string | null;
  rules_version: number;
  opening_date: string | null;
  closing_date: string | null;
  is_open: boolean;
  minimum_age: number | null;
  maximum_age: number | null;
  success_message: string | null;
};

function SystemSettingsPage() {
  const qc = useQueryClient();
  const [admission, setAdmission] = useState<Partial<AdmissionSettings> | null>(null);
  const [pinMinLength, setPinMinLength] = useState<number>(4);
  const [websiteId, setWebsiteId] = useState<string | null>(null);

  const admissionQuery = useQuery({
    queryKey: ["admission_settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admission_settings")
        .select("*")
        .eq("singleton", true)
        .maybeSingle();
      if (error) throw error;
      return data as AdmissionSettings | null;
    },
  });

  const websiteQuery = useQuery({
    queryKey: ["website_settings_pin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("website_settings")
        .select("id, student_pin_min_length")
        .eq("singleton", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (admissionQuery.data) setAdmission(admissionQuery.data);
    else if (admissionQuery.isFetched && !admissionQuery.data)
      setAdmission({ title: "Admission", is_open: true });
  }, [admissionQuery.data, admissionQuery.isFetched]);

  useEffect(() => {
    if (websiteQuery.data) {
      setWebsiteId(websiteQuery.data.id);
      setPinMinLength(websiteQuery.data.student_pin_min_length ?? 4);
    }
  }, [websiteQuery.data]);

  const saveAdmissionMut = useMutation({
    mutationFn: async (v: Partial<AdmissionSettings>) => {
      const payload = {
        title: v.title || "Admission",
        description: v.description ?? null,
        rules: v.rules ?? null,
        rules_pdf_url: v.rules_pdf_url ?? null,
        rules_version: v.rules_version ?? 1,
        opening_date: v.opening_date || null,
        closing_date: v.closing_date || null,
        is_open: v.is_open ?? true,
        minimum_age: v.minimum_age ?? null,
        maximum_age: v.maximum_age ?? null,
        success_message: v.success_message ?? null,
        singleton: true,
      };
      if (v.id) {
        const { error } = await supabase.from("admission_settings").update(payload).eq("id", v.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("admission_settings").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admission_settings"] });
      toast.success("Admission settings saved");
    },
    onError: (e: unknown) => toast.error((e as Error).message),
  });

  const savePinMut = useMutation({
    mutationFn: async () => {
      if (websiteId) {
        const { error } = await supabase
          .from("website_settings")
          .update({ student_pin_min_length: pinMinLength })
          .eq("id", websiteId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("website_settings")
          .insert({ student_pin_min_length: pinMinLength, singleton: true });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["website_settings_pin"] });
      qc.invalidateQueries({ queryKey: ["website_settings"] });
      toast.success("PIN policy saved");
    },
    onError: (e: unknown) => toast.error((e as Error).message),
  });

  if (!admission) {
    return (
      <RoleShell role="admin" title="System Settings">
        <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
      </RoleShell>
    );
  }

  return (
    <RoleShell role="admin" title="System Settings">
      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-base">Admission Settings</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="flex items-center justify-between rounded-md border border-border/60 p-3">
              <div>
                <Label className="text-sm">Admissions open</Label>
                <p className="text-xs text-muted-foreground">
                  Toggle whether new applications are accepted.
                </p>
              </div>
              <Switch
                checked={admission?.is_open ?? true}
                onCheckedChange={(c) => setAdmission({ ...admission, is_open: c })}
              />
            </div>
            <div>
              <Label>Title</Label>
              <Input
                value={admission.title ?? ""}
                onChange={(e) => setAdmission({ ...admission, title: e.target.value })}
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                rows={3}
                value={admission.description ?? ""}
                onChange={(e) => setAdmission({ ...admission, description: e.target.value })}
              />
            </div>
            <div>
              <Label>Rules text</Label>
              <Textarea
                rows={4}
                value={admission.rules ?? ""}
                onChange={(e) => setAdmission({ ...admission, rules: e.target.value })}
              />
            </div>
            <div>
              <Label>Rules PDF / Document</Label>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  type="text"
                  placeholder="Paste PDF URL or upload file below..."
                  value={admission.rules_pdf_url ?? ""}
                  onChange={(e) => setAdmission({ ...admission, rules_pdf_url: e.target.value })}
                />
                <Input
                  type="file"
                  accept="application/pdf,image/*"
                  className="sm:w-60"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (evt) => {
                      setAdmission({
                        ...admission,
                        rules_pdf_url: evt.target?.result as string,
                      });
                      toast.success("Rules document uploaded");
                    };
                    reader.readAsDataURL(file);
                  }}
                />
              </div>
              {admission.rules_pdf_url && (
                <div className="mt-1 flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">Document set</span>
                  <a
                    href={admission.rules_pdf_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline"
                  >
                    Preview current rules document
                  </a>
                  <button
                    type="button"
                    className="text-destructive hover:underline"
                    onClick={() => setAdmission({ ...admission, rules_pdf_url: null })}
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <Label>Rules version</Label>
                <Input
                  type="number"
                  value={admission.rules_version ?? 1}
                  onChange={(e) =>
                    setAdmission({ ...admission, rules_version: Number(e.target.value) })
                  }
                />
              </div>
              <div>
                <Label>Minimum age</Label>
                <Input
                  type="number"
                  value={admission.minimum_age ?? ""}
                  onChange={(e) =>
                    setAdmission({
                      ...admission,
                      minimum_age: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                />
              </div>
              <div>
                <Label>Maximum age</Label>
                <Input
                  type="number"
                  value={admission.maximum_age ?? ""}
                  onChange={(e) =>
                    setAdmission({
                      ...admission,
                      maximum_age: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Opening date</Label>
                <Input
                  type="date"
                  value={admission.opening_date ?? ""}
                  onChange={(e) => setAdmission({ ...admission, opening_date: e.target.value })}
                />
              </div>
              <div>
                <Label>Closing date</Label>
                <Input
                  type="date"
                  value={admission.closing_date ?? ""}
                  onChange={(e) => setAdmission({ ...admission, closing_date: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Success message</Label>
              <Textarea
                rows={2}
                value={admission.success_message ?? ""}
                onChange={(e) => setAdmission({ ...admission, success_message: e.target.value })}
              />
            </div>
            <div className="flex justify-end">
              <Button
                disabled={saveAdmissionMut.isPending}
                onClick={() => saveAdmissionMut.mutate(admission)}
              >
                Save admission settings
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-base">Student PIN Policy</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:max-w-xs">
            <div>
              <Label>Minimum PIN length</Label>
              <Input
                type="number"
                min={4}
                value={pinMinLength}
                onChange={(e) => setPinMinLength(Number(e.target.value))}
              />
            </div>
            <div className="flex justify-end">
              <Button disabled={savePinMut.isPending} onClick={() => savePinMut.mutate()}>
                Save PIN policy
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </RoleShell>
  );
}
