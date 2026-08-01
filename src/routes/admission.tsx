import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { LandingHeader, LandingFooter } from "@/components/landing";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { CheckCircle2, Send } from "lucide-react";

export const Route = createFileRoute("/admission")({
  head: () => ({
    meta: [
      { title: "Apply for Admission — Ababeel Quran Class" },
      { name: "description", content: "Submit an online admission application to join Ababeel Quran Class. Fill in student and guardian details and track your request number." },
      { property: "og:title", content: "Apply for Admission — Ababeel Quran Class" },
      { property: "og:description", content: "Submit an online admission application to join Ababeel Quran Class." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdmissionPage,
});

type Form = {
  full_name: string;
  date_of_birth: string;
  gender: string;
  identity_number: string;
  guardian_name: string;
  guardian_identity_number: string;
  mobile: string;
  alternative_mobile: string;
  address: string;
  island: string;
  atoll: string;
  previous_experience: string;
  reading_level: string;
  preferred_class: string;
  preferred_session: string;
  medical_notes: string;
  remarks: string;
};

const EMPTY: Form = {
  full_name: "", date_of_birth: "", gender: "", identity_number: "",
  guardian_name: "", guardian_identity_number: "", mobile: "", alternative_mobile: "",
  address: "", island: "", atoll: "", previous_experience: "", reading_level: "",
  preferred_class: "", preferred_session: "", medical_notes: "", remarks: "",
};

function AdmissionPage() {
  const [form, setForm] = useState<Form>(EMPTY);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState<string | null>(null);

  const settings = useQuery({
    queryKey: ["admission_settings_public"],
    queryFn: async () => {
      const { data } = await supabase.from("admission_settings").select("*").maybeSingle();
      return data;
    },
  });
  const classes = useQuery({
    queryKey: ["public_classes"],
    queryFn: async () => {
      const { data } = await supabase.from("classes").select("id, class_name, session").eq("status", "active").order("class_name");
      return data ?? [];
    },
  });

  const s = settings.data;
  const now = new Date();
  const open =
    !!s?.is_open &&
    (!s?.opening_date || new Date(s.opening_date) <= now) &&
    (!s?.closing_date || new Date(s.closing_date) >= now);

  const set = (k: keyof Form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit() {
    if (!form.full_name || !form.date_of_birth || !form.gender || !form.identity_number || !form.guardian_name || !form.mobile) {
      toast.error("Please fill in all required fields");
      return;
    }
    if (!agreed) {
      toast.error("You must agree to the rules and regulations");
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase
        .from("admission_requests")
        .insert({
          full_name: form.full_name,
          date_of_birth: form.date_of_birth,
          gender: form.gender,
          identity_number: form.identity_number,
          guardian_name: form.guardian_name,
          guardian_identity_number: form.guardian_identity_number || null,
          mobile: form.mobile,
          alternative_mobile: form.alternative_mobile || null,
          address: form.address || null,
          island: form.island || null,
          atoll: form.atoll || null,
          previous_experience: form.previous_experience || null,
          reading_level: form.reading_level || null,
          preferred_class: form.preferred_class || null,
          preferred_session: form.preferred_session || null,
          medical_notes: form.medical_notes || null,
          remarks: form.remarks || null,
          agreed_to_rules: true,
          rules_version: s?.rules_version ?? 1,
        })
        .select("request_number")
        .single();
      if (error) throw error;
      setSubmitted((data as { request_number: string }).request_number);
      setForm(EMPTY);
      setAgreed(false);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not submit the application");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <LandingHeader />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="font-display text-3xl font-bold text-primary">{s?.title ?? "Admission Application"}</h1>
        {s?.description && <p className="mt-2 text-muted-foreground">{s.description}</p>}

        {submitted ? (
          <Card className="mt-8">
            <CardContent className="space-y-4 p-8 text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
              <h2 className="font-display text-xl font-semibold">{s?.success_message ?? "Application submitted"}</h2>
              <p className="text-sm text-muted-foreground">Your request number is</p>
              <p className="font-mono text-lg font-semibold">{submitted}</p>
              <p className="text-sm text-muted-foreground">Please keep this number safe. We will contact you on the mobile number provided.</p>
              <Button asChild variant="outline"><Link to="/">Back to home</Link></Button>
            </CardContent>
          </Card>
        ) : !open ? (
          <Card className="mt-8">
            <CardContent className="p-8 text-center text-muted-foreground">
              Admissions are currently closed. Please check back later.
            </CardContent>
          </Card>
        ) : (
          <div className="mt-8 space-y-6">
            <Card>
              <CardHeader><CardTitle className="text-base">Student details</CardTitle></CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <Field label="Full name *"><Input value={form.full_name} onChange={(e) => set("full_name")(e.target.value)} /></Field>
                <Field label="Date of birth *"><Input type="date" value={form.date_of_birth} onChange={(e) => set("date_of_birth")(e.target.value)} /></Field>
                <Field label="Gender *">
                  <Select value={form.gender} onValueChange={set("gender")}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="ID / birth certificate no. *"><Input value={form.identity_number} onChange={(e) => set("identity_number")(e.target.value)} /></Field>
                <Field label="Island"><Input value={form.island} onChange={(e) => set("island")(e.target.value)} /></Field>
                <Field label="Atoll"><Input value={form.atoll} onChange={(e) => set("atoll")(e.target.value)} /></Field>
                <div className="sm:col-span-2">
                  <Field label="Address"><Textarea rows={2} value={form.address} onChange={(e) => set("address")(e.target.value)} /></Field>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Guardian & contact</CardTitle></CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <Field label="Guardian name *"><Input value={form.guardian_name} onChange={(e) => set("guardian_name")(e.target.value)} /></Field>
                <Field label="Guardian ID number"><Input value={form.guardian_identity_number} onChange={(e) => set("guardian_identity_number")(e.target.value)} /></Field>
                <Field label="Mobile *"><Input value={form.mobile} onChange={(e) => set("mobile")(e.target.value)} /></Field>
                <Field label="Alternative mobile"><Input value={form.alternative_mobile} onChange={(e) => set("alternative_mobile")(e.target.value)} /></Field>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Class preference</CardTitle></CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <Field label="Preferred class">
                  <Select value={form.preferred_class} onValueChange={set("preferred_class")}>
                    <SelectTrigger><SelectValue placeholder="No preference" /></SelectTrigger>
                    <SelectContent>
                      {(classes.data ?? []).map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.class_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Preferred session">
                  <Select value={form.preferred_session} onValueChange={set("preferred_session")}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="morning">Morning</SelectItem>
                      <SelectItem value="afternoon">Afternoon</SelectItem>
                      <SelectItem value="evening">Evening</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Reading level"><Input placeholder="e.g. Qaida, Juz 30" value={form.reading_level} onChange={(e) => set("reading_level")(e.target.value)} /></Field>
                <Field label="Previous experience"><Input value={form.previous_experience} onChange={(e) => set("previous_experience")(e.target.value)} /></Field>
                <div className="sm:col-span-2">
                  <Field label="Medical notes"><Textarea rows={2} value={form.medical_notes} onChange={(e) => set("medical_notes")(e.target.value)} /></Field>
                </div>
                <div className="sm:col-span-2">
                  <Field label="Remarks"><Textarea rows={2} value={form.remarks} onChange={(e) => set("remarks")(e.target.value)} /></Field>
                </div>
              </CardContent>
            </Card>

            {s?.rules && (
              <Card>
                <CardHeader><CardTitle className="text-base">Rules & regulations</CardTitle></CardHeader>
                <CardContent>
                  <div className="max-h-56 overflow-auto whitespace-pre-wrap rounded-md border border-border/60 bg-muted/40 p-4 text-sm">{s.rules}</div>
                </CardContent>
              </Card>
            )}

            <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border/60 p-4 text-sm">
              <Checkbox checked={agreed} onCheckedChange={(v) => setAgreed(v === true)} />
              <span>I confirm the information provided is correct and I agree to the rules and regulations of Ababeel Quran Class.</span>
            </label>

            <Button className="w-full" size="lg" onClick={submit} disabled={busy}>
              <Send className="mr-2 h-4 w-4" />
              {busy ? "Submitting…" : "Submit application"}
            </Button>
          </div>
        )}
      </main>
      <LandingFooter />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
