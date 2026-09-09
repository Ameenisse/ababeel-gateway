import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { LandingHeader, LandingFooter } from "@/components/landing";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  CheckCircle2,
  Send,
  FileText,
  Upload,
  Eye,
  X,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  ArrowRight,
  UserCheck,
} from "lucide-react";
import { submitGoogleAdmissionRequest, checkActiveAdmission } from "@/lib/admissions.functions";

export const Route = createFileRoute("/admission")({
  head: () => ({
    meta: [
      { title: "Apply for Admission — Ababeel Quran Class" },
      {
        name: "description",
        content:
          "Submit an online admission application to join Ababeel Quran Class with verified Google authentication.",
      },
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
  preferred_class: string;
  preferred_session: string;
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
  preferred_class: "",
  preferred_session: "",
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

  // Google Authentication State
  const [sessionUser, setSessionUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [showDevLogin, setShowDevLogin] = useState(false);
  const [devEmail, setDevEmail] = useState("");

  const submitAdmissionFn = useServerFn(submitGoogleAdmissionRequest);
  const checkActiveFn = useServerFn(checkActiveAdmission);

  const [activeExisting, setActiveExisting] = useState<any | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSessionUser(data.session?.user ?? null);
      setAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Pre-fill guardian info from Google account if available
  useEffect(() => {
    if (sessionUser) {
      const gName =
        sessionUser.user_metadata?.full_name || sessionUser.user_metadata?.name || "";
      if (gName && !form.guardian_name) {
        setForm((prev) => ({ ...prev, guardian_name: gName }));
      }

      // Check active application for this account
      checkActiveFn({ data: {} })
        .then((res) => {
          if (res.hasActive && res.existing) {
            setActiveExisting(res.existing);
          } else {
            setActiveExisting(null);
          }
        })
        .catch(() => {});
    }
  }, [sessionUser]);

  const settings = useQuery({
    queryKey: ["admission_settings_public"],
    queryFn: async () => {
      const { data } = await supabase.from("admission_settings").select("*").maybeSingle();
      return data;
    },
  });

  const classesQuery = useQuery({
    queryKey: ["public_classes"],
    queryFn: async () => {
      const { data } = await supabase.from("classes").select("id, class_name, description");
      return data ?? [];
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

  async function handleGoogleSignIn() {
    setOauthLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/admission`,
        },
      });
      if (error) {
        toast.error(error.message);
        setShowDevLogin(true);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to connect to Google");
      setShowDevLogin(true);
    } finally {
      setOauthLoading(false);
    }
  }

  async function handleDevSignIn(e: React.FormEvent) {
    e.preventDefault();
    if (!devEmail) return;
    try {
      const email = devEmail.trim().toLowerCase();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: "TempApplicantPassword123!",
      });

      if (error) {
        const { error: signErr } = await supabase.auth.signUp({
          email,
          password: "TempApplicantPassword123!",
          options: {
            data: { full_name: "Google Applicant", kind: "applicant" },
          },
        });
        if (signErr) throw signErr;
      }
      toast.success(`Signed in as ${email}`);
      const { data } = await supabase.auth.getSession();
      setSessionUser(data.session?.user ?? null);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Dev sign in failed");
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    setSessionUser(null);
    setActiveExisting(null);
    toast.info("Signed out.");
  }

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
    if (!sessionUser) {
      toast.error("You must sign in with Google before submitting an application.");
      return;
    }

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
      toast.error("Please fill in all required fields.");
      return;
    }
    if (!form.student_id_url) {
      toast.error("Please upload Student ID card / birth certificate document.");
      return;
    }
    if (!form.guardian_id_url) {
      toast.error("Please upload Guardian ID card document.");
      return;
    }
    if (!agreed) {
      toast.error("You must view and agree to the rules and regulations to submit.");
      return;
    }

    setBusy(true);
    try {
      const res = await submitAdmissionFn({
        data: {
          ...form,
          applicantEmail: sessionUser.email,
          applicantName:
            sessionUser.user_metadata?.full_name || sessionUser.user_metadata?.name || form.guardian_name,
        },
      });

      setSubmitted(res.requestNumber);
      setForm(EMPTY);
      setAgreed(false);
      toast.success("Application submitted successfully!");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not submit the application.");
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
          <Card className="mt-8 border-border/80 shadow-md">
            <CardContent className="space-y-4 p-8 text-center">
              <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-600" />
              <h2 className="font-display text-2xl font-bold text-foreground">
                {s?.success_message ?? "Application Submitted Successfully"}
              </h2>
              <p className="text-sm text-muted-foreground">Your official admission request number is</p>
              <p className="font-mono text-xl font-bold text-primary bg-primary/10 py-2 px-4 rounded-md inline-block">
                {submitted}
              </p>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Your application has been tied to your Google account (<strong>{sessionUser?.email}</strong>).
                You can monitor review progress, updates, and find your student portal credentials directly on My Admission.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
                <Button asChild className="w-full sm:w-auto">
                  <Link to="/my-admission">
                    Track Status on My Admission <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" className="w-full sm:w-auto">
                  <Link to="/">Back to Home</Link>
                </Button>
              </div>
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
            {/* Step 1: Google Identity Verification Banner */}
            {!sessionUser ? (
              <Card className="border-primary/40 shadow-sm bg-primary-soft/10">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                    <ShieldCheck className="h-5 w-5" /> Step 1: Google Sign-In Required
                  </div>
                  <CardTitle className="text-xl font-bold">Authenticate Before Applying</CardTitle>
                  <CardDescription className="text-sm">
                    All admission applications must be linked to a verified Google account. This ensures secure
                    progress tracking, notifications, and Student Portal credentials delivery.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 pt-1">
                  <Button
                    size="lg"
                    onClick={handleGoogleSignIn}
                    disabled={oauthLoading}
                    className="w-full sm:w-auto flex items-center justify-center gap-3 bg-white text-gray-800 hover:bg-gray-50 border border-gray-300 shadow-sm font-semibold"
                  >
                    <svg className="h-5 w-5" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    <span>{oauthLoading ? "Connecting..." : "Continue with Google"}</span>
                  </Button>

                  <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
                    <span>Already submitted an application?</span>
                    <Button asChild variant="link" className="p-0 h-auto text-xs text-primary">
                      <Link to="/my-admission">Track in My Admission</Link>
                    </Button>
                  </div>

                  {/* Dev Sandbox Sign-In Fallback */}
                  <div className="border-t border-border/60 pt-3 mt-2">
                    <button
                      type="button"
                      onClick={() => setShowDevLogin(!showDevLogin)}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      {showDevLogin ? "Hide Sandbox Mode" : "Development Sandbox Login (Click here if OAuth not configured)"}
                    </button>
                    {showDevLogin && (
                      <form onSubmit={handleDevSignIn} className="mt-3 flex gap-2 max-w-sm">
                        <Input
                          type="email"
                          value={devEmail}
                          onChange={(e) => setDevEmail(e.target.value)}
                          placeholder="e.g. applicant@gmail.com"
                          className="text-xs h-8"
                        />
                        <Button type="submit" size="sm" variant="outline" className="text-xs h-8">
                          Sign In
                        </Button>
                      </form>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : (
              /* Authenticated Google User Banner */
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-emerald-600 text-white font-semibold">
                    {(sessionUser.user_metadata?.full_name || sessionUser.email || "G").charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-foreground">
                        {sessionUser.user_metadata?.full_name || "Google Applicant"}
                      </span>
                      <Badge className="bg-emerald-600 hover:bg-emerald-600 text-[10px] text-white">
                        <UserCheck className="mr-1 h-3 w-3" /> Verified Google Account
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">{sessionUser.email}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button asChild variant="outline" size="sm" className="h-8 text-xs">
                    <Link to="/my-admission">My Applications</Link>
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleSignOut} className="h-8 text-xs text-muted-foreground">
                    Switch Account
                  </Button>
                </div>
              </div>
            )}

            {/* Check Active Application Alert */}
            {activeExisting && (
              <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-5 space-y-3">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h3 className="font-semibold text-sm text-amber-900 dark:text-amber-300">
                      An admission application is already active for this account.
                    </h3>
                    <p className="text-xs text-amber-800 dark:text-amber-400">
                      We found active application <strong>{activeExisting.request_number}</strong> for student{" "}
                      <strong>{activeExisting.full_name}</strong> (Status: <strong>{activeExisting.status}</strong>).
                      Under our enrollment policy, only one active application is permitted at a time.
                    </p>
                  </div>
                </div>
                <div className="pt-1">
                  <Button asChild size="sm" className="bg-amber-600 hover:bg-amber-700 text-white">
                    <Link to="/my-admission">
                      View My Admission <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </div>
              </div>
            )}

            {/* Application Form — Unlocked once signed in and no blocking duplicates */}
            <div className={sessionUser ? "space-y-6" : "opacity-50 pointer-events-none space-y-6"}>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Student Details</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <Field label="Full name *">
                    <Input
                      value={form.full_name}
                      onChange={(e) => set("full_name")(e.target.value)}
                      placeholder="Student full legal name"
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
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
                      onChange={(e) => set("identity_number")(e.target.value.toUpperCase())}
                      placeholder="e.g. A123456"
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
                        placeholder="House, street, apartment"
                      />
                    </Field>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Guardian & Contact Information</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <Field label="Guardian name *">
                    <Input
                      value={form.guardian_name}
                      onChange={(e) => set("guardian_name")(e.target.value)}
                      placeholder="Parent / Guardian full name"
                    />
                  </Field>
                  <Field label="Guardian ID number">
                    <Input
                      value={form.guardian_identity_number}
                      onChange={(e) => set("guardian_identity_number")(e.target.value.toUpperCase())}
                      placeholder="e.g. A987654"
                    />
                  </Field>
                  <Field label="Mobile phone *">
                    <Input
                      value={form.mobile}
                      onChange={(e) => set("mobile")(e.target.value)}
                      placeholder="e.g. 7771234"
                    />
                  </Field>
                  <Field label="Alternative mobile">
                    <Input
                      value={form.alternative_mobile}
                      onChange={(e) => set("alternative_mobile")(e.target.value)}
                      placeholder="Optional second number"
                    />
                  </Field>
                  <div className="sm:col-span-2">
                    <Field label="Verified Google Email (Linked Automatically)">
                      <Input
                        value={sessionUser?.email || ""}
                        disabled
                        className="bg-muted/40 font-mono text-xs text-muted-foreground"
                      />
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Credentials and official notices will be sent to this email upon approval.
                      </p>
                    </Field>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Preferences & Experience</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <Field label="Preferred Class (Optional)">
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      value={form.preferred_class}
                      onChange={(e) => set("preferred_class")(e.target.value)}
                    >
                      <option value="">No preference / Any available</option>
                      {(classesQuery.data ?? []).map((c: any) => (
                        <option key={c.id} value={c.id}>
                          {c.class_name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Preferred Session">
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      value={form.preferred_session}
                      onChange={(e) => set("preferred_session")(e.target.value)}
                    >
                      <option value="">Select session</option>
                      <option value="morning">Morning Session</option>
                      <option value="afternoon">Afternoon Session</option>
                      <option value="evening">Evening Session</option>
                    </select>
                  </Field>
                  <Field label="Current Reading Level">
                    <Input
                      placeholder="e.g. Noorani Qaida, Juz Amma, Fluent Nazira"
                      value={form.reading_level}
                      onChange={(e) => set("reading_level")(e.target.value)}
                    />
                  </Field>
                  <Field label="Previous Quran Experience">
                    <Input
                      placeholder="Classes or tutors attended"
                      value={form.previous_experience}
                      onChange={(e) => set("previous_experience")(e.target.value)}
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
                          <span className="font-medium text-emerald-600">Document attached</span>
                          <div className="flex items-center gap-2">
                            <a
                              href={form.student_id_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary hover:underline flex items-center gap-1"
                            >
                              <Eye className="h-3 w-3" /> View
                            </a>
                            <button
                              type="button"
                              onClick={() => set("student_id_url")("")}
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
                          <span className="font-medium text-emerald-600">Document attached</span>
                          <div className="flex items-center gap-2">
                            <a
                              href={form.guardian_id_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary hover:underline flex items-center gap-1"
                            >
                              <Eye className="h-3 w-3" /> View
                            </a>
                            <button
                              type="button"
                              onClick={() => set("guardian_id_url")("")}
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

              {/* Rules agreement */}
              <div className="space-y-3 rounded-lg border border-border/80 bg-muted/30 p-4">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="rules"
                    checked={agreed}
                    onCheckedChange={(c) => setAgreed(!!c)}
                    className="mt-1"
                  />
                  <label htmlFor="rules" className="text-sm leading-snug">
                    I have read and agree to the{" "}
                    <button
                      type="button"
                      onClick={handleViewRules}
                      className="font-semibold text-primary underline underline-offset-2"
                    >
                      rules and regulations of Ababeel Quran Class
                    </button>
                    . I confirm that all information provided is accurate and truthful.
                  </label>
                </div>
              </div>

              <div className="pt-2">
                <Button
                  size="lg"
                  className="w-full"
                  onClick={submit}
                  disabled={busy || !sessionUser || !!activeExisting}
                >
                  <Send className="mr-2 h-4 w-4" />
                  {busy ? "Submitting Application..." : "Submit Admission Application"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Rules Modal */}
      <Dialog open={showRulesModal} onOpenChange={setShowRulesModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Rules & Regulations</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              1. <strong>Attendance:</strong> Regular attendance is mandatory. Parents must inform the
              administration in advance if a student will be absent.
            </p>
            <p>
              2. <strong>Punctuality:</strong> Students must arrive on time for their scheduled sessions with
              proper Islamic attire and necessary books.
            </p>
            <p>
              3. <strong>Discipline:</strong> Respect towards teachers, peers, and classroom property is
              strictly enforced.
            </p>
            <p>
              4. <strong>Fee Payment:</strong> Monthly tuition fees must be settled by the due date each month.
            </p>
            <p>
              5. <strong>Student Portal:</strong> The student must maintain the privacy of their Student Portal PIN
              and update it upon first login.
            </p>
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
      <Label className="text-sm font-medium">{label}</Label>
      {children}
    </div>
  );
}
