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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { CheckCircle2, Send, FileText, Upload, Eye, X, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/admission")({
  head: () => ({
    meta: [
      { title: "Apply for Admission — Ababeel Quran Class" },
      {
        name: "description",
        content:
          "Submit an online admission application to join Ababeel Quran Class. Fill in student and guardian details and track your request number.",
      },
      { property: "og:title", content: "Apply for Admission — Ababeel Quran Class" },
      {
        property: "og:description",
        content: "Submit an online admission application to join Ababeel Quran Class.",
      },
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
  grade_studying: string;
  school: string;
  guardian_name: string;
  guardian_identity_number: string;
  mobile: string;
  alternative_mobile: string;
  address: string;
  island: string;
  atoll: string;
  previous_experience: string;
  reading_level: string;
  medical_notes: string;
  remarks: string;
  student_id_url: string;
  guardian_id_url: string;
};

const EMPTY: Form = {
  full_name: "",
  date_of_birth: "",
  gender: "",
  identity_number: "",
  grade_studying: "",
  school: "",
  guardian_name: "",
  guardian_identity_number: "",
  mobile: "",
  alternative_mobile: "",
  address: "",
  island: "",
  atoll: "",
  previous_experience: "",
  reading_level: "",
  medical_notes: "",
  remarks: "",
  student_id_url: "",
  guardian_id_url: "",
};

function AdmissionPage() {
  const [form, setForm] = useState<Form>(EMPTY);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [showRulesModal, setShowRulesModal] = useState(false);

  const settings = useQuery({
    queryKey: ["admission_settings_public"],
    queryFn: async () => {
      const { data } = await supabase.from("admission_settings").select("*").maybeSingle();
      return data;
    },
  });

  const s = settings.data;
  const now = new Date();
  const open =
    s === null || s === undefined
      ? true
      : (s.is_open ?? true) &&
        (!s.opening_date || new Date(s.opening_date) <= now) &&
        (!s.closing_date || new Date(s.closing_date) >= now);

  const set = (k: keyof Form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  function handleFileUpload(field: "student_id_url" | "guardian_id_url") {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > 10 * 1024 * 1024) {
        toast.error("File size must be under 10MB");
        return;
      }
      const reader = new FileReader();
      reader.onload = (evt) => {
        const result = evt.target?.result as string;
        setForm((f) => ({ ...f, [field]: result }));
        toast.success(field === "student_id_url" ? "Student ID uploaded" : "Guardian ID uploaded");
      };
      reader.readAsDataURL(file);
    };
  }

  async function submit() {
    if (
      !form.full_name ||
      !form.date_of_birth ||
      !form.gender ||
      !form.identity_number ||
      !form.grade_studying ||
      !form.school ||
      !form.guardian_name ||
      !form.mobile
    ) {
      toast.error("Please fill in all required fields");
      return;
    }
    if (!form.student_id_url) {
      toast.error("Please upload Student ID card / birth certificate document");
      return;
    }
    if (!form.guardian_id_url) {
      toast.error("Please upload Guardian ID card document");
      return;
    }
    if (!agreed) {
      toast.error("You must view and agree to the rules and regulations to submit");
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
          grade_studying: form.grade_studying || null,
          school: form.school || null,
          guardian_name: form.guardian_name,
          guardian_identity_number: form.guardian_identity_number || null,
          mobile: form.mobile,
          alternative_mobile: form.alternative_mobile || null,
          address: form.address || null,
          island: form.island || null,
          atoll: form.atoll || null,
          previous_experience: form.previous_experience || null,
          reading_level: form.reading_level || null,
          medical_notes: form.medical_notes || null,
          remarks: form.remarks || null,
          photo_url: form.student_id_url || null,
          document_url: form.guardian_id_url || null,
          student_id_url: form.student_id_url || null,
          guardian_id_url: form.guardian_id_url || null,
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

  function handleViewRules() {
    if (s?.rules_pdf_url) {
      window.open(s.rules_pdf_url, "_blank");
    } else {
      setShowRulesModal(true);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <LandingHeader />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="font-display text-3xl font-bold text-primary">
          {s?.title ?? "Admission Application"}
        </h1>
        {s?.description && <p className="mt-2 text-muted-foreground">{s.description}</p>}

        {submitted ? (
          <Card className="mt-8">
            <CardContent className="space-y-4 p-8 text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
              <h2 className="font-display text-xl font-semibold">
                {s?.success_message ?? "Application submitted"}
              </h2>
              <p className="text-sm text-muted-foreground">Your request number is</p>
              <p className="font-mono text-lg font-semibold">{submitted}</p>
              <p className="text-sm text-muted-foreground">
                Please keep this number safe. We will contact you on the mobile number provided.
              </p>
              <Button asChild variant="outline">
                <Link to="/">Back to home</Link>
              </Button>
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
              <CardHeader>
                <CardTitle className="text-base">Student details</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <Field label="Full name *">
                  <Input
                    value={form.full_name}
                    onChange={(e) => set("full_name")(e.target.value)}
                  />
                </Field>
                <Field label="Date of birth *">
                  <Input
                    type="date"
                    value={form.date_of_birth}
                    onChange={(e) => set("date_of_birth")(e.target.value)}
                  />
                </Field>
                <Field label="Gender *">
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={form.gender}
                    onChange={(e) => set("gender")(e.target.value)}
                  >
                    <option value="">Select gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </Field>
                <Field label="ID / birth certificate no. *">
                  <Input
                    value={form.identity_number}
                    onChange={(e) => set("identity_number")(e.target.value)}
                  />
                </Field>
                <Field label="Grade studying *">
                  <Input
                    placeholder="e.g. Grade 1, Grade 5, Kindergarten"
                    value={form.grade_studying}
                    onChange={(e) => set("grade_studying")(e.target.value)}
                  />
                </Field>
                <Field label="School name *">
                  <Input
                    placeholder="Current school name"
                    value={form.school}
                    onChange={(e) => set("school")(e.target.value)}
                  />
                </Field>
                <Field label="Island">
                  <Input value={form.island} onChange={(e) => set("island")(e.target.value)} />
                </Field>
                <Field label="Atoll">
                  <Input value={form.atoll} onChange={(e) => set("atoll")(e.target.value)} />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Address">
                    <Textarea
                      rows={2}
                      value={form.address}
                      onChange={(e) => set("address")(e.target.value)}
                    />
                  </Field>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Guardian & contact</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <Field label="Guardian name *">
                  <Input
                    value={form.guardian_name}
                    onChange={(e) => set("guardian_name")(e.target.value)}
                  />
                </Field>
                <Field label="Guardian ID number">
                  <Input
                    value={form.guardian_identity_number}
                    onChange={(e) => set("guardian_identity_number")(e.target.value)}
                  />
                </Field>
                <Field label="Mobile *">
                  <Input value={form.mobile} onChange={(e) => set("mobile")(e.target.value)} />
                </Field>
                <Field label="Alternative mobile">
                  <Input
                    value={form.alternative_mobile}
                    onChange={(e) => set("alternative_mobile")(e.target.value)}
                  />
                </Field>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Document Uploads (ID / Certificate)</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <Field label="Student ID Card / Birth Certificate (Image/PDF) *">
                  <div className="space-y-2">
                    <Input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={handleFileUpload("student_id_url")}
                    />
                    {form.student_id_url && (
                      <div className="flex items-center justify-between rounded border bg-muted/40 p-2 text-xs">
                        <span className="font-medium text-success">Document attached</span>
                        <div className="flex items-center gap-2">
                          <a
                            href={form.student_id_url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1 text-primary hover:underline"
                          >
                            <Eye className="h-3 w-3" /> View
                          </a>
                          <button
                            type="button"
                            onClick={() => setForm((f) => ({ ...f, student_id_url: "" }))}
                            className="text-destructive hover:underline"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </Field>

                <Field label="Guardian ID Card (Image/PDF) *">
                  <div className="space-y-2">
                    <Input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={handleFileUpload("guardian_id_url")}
                    />
                    {form.guardian_id_url && (
                      <div className="flex items-center justify-between rounded border bg-muted/40 p-2 text-xs">
                        <span className="font-medium text-success">Document attached</span>
                        <div className="flex items-center gap-2">
                          <a
                            href={form.guardian_id_url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1 text-primary hover:underline"
                          >
                            <Eye className="h-3 w-3" /> View
                          </a>
                          <button
                            type="button"
                            onClick={() => setForm((f) => ({ ...f, guardian_id_url: "" }))}
                            className="text-destructive hover:underline"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </Field>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Background & Quranic details</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <Field label="Reading level">
                  <Input
                    placeholder="e.g. Qaida, Juz 30"
                    value={form.reading_level}
                    onChange={(e) => set("reading_level")(e.target.value)}
                  />
                </Field>
                <Field label="Previous Quran experience">
                  <Input
                    value={form.previous_experience}
                    onChange={(e) => set("previous_experience")(e.target.value)}
                  />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Medical notes">
                    <Textarea
                      rows={2}
                      value={form.medical_notes}
                      onChange={(e) => set("medical_notes")(e.target.value)}
                    />
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <Field label="Remarks">
                    <Textarea
                      rows={2}
                      value={form.remarks}
                      onChange={(e) => set("remarks")(e.target.value)}
                    />
                  </Field>
                </div>
              </CardContent>
            </Card>

            {/* Rules & Regulations view button & agreement */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Rules & Regulations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Please review the rules and regulations of Ababeel Quran Class before submitting
                  your application.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={handleViewRules}>
                    <FileText className="mr-2 h-4 w-4" /> View Rules & Regulations
                    {s?.rules_pdf_url && <ExternalLink className="ml-1.5 h-3 w-3" />}
                  </Button>
                </div>

                <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border/60 bg-muted/20 p-4 text-sm">
                  <Checkbox
                    checked={agreed}
                    onCheckedChange={(v) => setAgreed(v === true)}
                    className="mt-0.5"
                  />
                  <span>
                    I confirm that I have read and agree to all rules and regulations of Ababeel
                    Quran Class, and that the information provided is accurate. *
                  </span>
                </label>
              </CardContent>
            </Card>

            <Button className="w-full" size="lg" onClick={submit} disabled={busy}>
              <Send className="mr-2 h-4 w-4" />
              {busy ? "Submitting…" : "Submit application"}
            </Button>
          </div>
        )}
      </main>

      {/* Rules Modal */}
      <Dialog open={showRulesModal} onOpenChange={setShowRulesModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Ababeel Quran Class — Rules & Regulations</DialogTitle>
          </DialogHeader>
          <div className="max-h-96 overflow-auto whitespace-pre-wrap rounded border p-4 text-sm leading-relaxed text-foreground">
            {s?.rules || "No text rules set. Please contact administration for guidelines."}
          </div>
          <div className="flex justify-end gap-2">
            <Button
              onClick={() => {
                setAgreed(true);
                setShowRulesModal(false);
                toast.success("Rules agreed");
              }}
            >
              I Agree to Rules
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
