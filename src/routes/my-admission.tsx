import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { LandingHeader, LandingFooter } from "@/components/landing";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  LogIn,
  FileEdit,
  ArrowRight,
  ShieldCheck,
  User,
  GraduationCap,
  Calendar,
  BookOpen,
  Mail,
  ExternalLink,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { getMyAdmissions, updateApplicantAdmission } from "@/lib/admissions.functions";

export const Route = createFileRoute("/my-admission")({
  head: () => ({
    meta: [
      { title: "My Admission — Ababeel Quran Class" },
      {
        name: "description",
        content: "Track your admission application progress and Student Portal enrollment status.",
      },
    ],
  }),
  component: MyAdmissionPage,
});

function MyAdmissionPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const getAdmissionsFn = useServerFn(getMyAdmissions);
  const updateAdmissionsFn = useServerFn(updateApplicantAdmission);

  const [sessionUser, setSessionUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [devEmail, setDevEmail] = useState("");
  const [showDevLogin, setShowDevLogin] = useState(false);

  // Edit modal state
  const [editingApp, setEditingApp] = useState<any | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [savingEdit, setSavingEdit] = useState(false);

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

  async function handleGoogleSignIn() {
    setOauthLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/my-admission`,
        },
      });
      if (error) {
        toast.error(error.message);
        setShowDevLogin(true);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to initiate Google sign in");
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
      // Try to sign in or create test user
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
      qc.invalidateQueries({ queryKey: ["my_admissions"] });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Dev sign in failed");
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    setSessionUser(null);
    toast.info("Signed out successfully.");
  }

  const admissionsQuery = useQuery({
    queryKey: ["my_admissions", sessionUser?.id],
    enabled: !!sessionUser,
    queryFn: async () => {
      return getAdmissionsFn();
    },
  });

  const applications = (admissionsQuery.data ?? []) as any[];

  function openEditModal(app: any) {
    setEditingApp(app);
    setEditForm({
      full_name: app.full_name || "",
      identity_number: app.identity_number || "",
      date_of_birth: app.date_of_birth || "",
      gender: app.gender || "male",
      guardian_name: app.guardian_name || "",
      guardian_identity_number: app.guardian_identity_number || "",
      mobile: app.mobile || "",
      alternative_mobile: app.alternative_mobile || "",
      address: app.address || "",
      island: app.island || "",
      atoll: app.atoll || "",
      school: app.school || "",
      grade_studying: app.grade_studying || "",
      reading_level: app.reading_level || "",
      previous_experience: app.previous_experience || "",
      medical_notes: app.medical_notes || "",
      remarks: app.remarks || "",
    });
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingApp) return;
    setSavingEdit(true);
    try {
      await updateAdmissionsFn({
        data: {
          requestId: editingApp.id,
          updates: editForm,
        },
      });
      toast.success("Application updated successfully.");
      setEditingApp(null);
      qc.invalidateQueries({ queryKey: ["my_admissions"] });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update application");
    } finally {
      setSavingEdit(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <LandingHeader />

      <main className="flex-1 mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-border/70">
          <div>
            <h1 className="font-display text-3xl font-bold text-primary">My Admission</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Track your student's admission progress, review status, and access Student Portal credentials.
            </p>
          </div>

          {sessionUser && (
            <div className="flex items-center gap-3 bg-muted/40 p-2 rounded-lg border border-border/70">
              <div className="grid h-9 w-9 place-items-center rounded-full bg-primary/15 text-primary font-semibold text-sm">
                {(sessionUser.user_metadata?.full_name || sessionUser.email || "G").charAt(0).toUpperCase()}
              </div>
              <div className="text-xs">
                <div className="font-semibold text-foreground truncate max-w-[180px]">
                  {sessionUser.user_metadata?.full_name || "Google Applicant"}
                </div>
                <div className="text-muted-foreground truncate max-w-[180px]">
                  {sessionUser.email}
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={handleSignOut} className="h-8 text-xs ml-1">
                Sign Out
              </Button>
            </div>
          )}
        </div>

        {/* Content Area */}
        {authLoading ? (
          <div className="py-20 text-center text-muted-foreground">Loading your account...</div>
        ) : !sessionUser ? (
          /* Unauthenticated State */
          <div className="mt-8">
            <Card className="border-border/80 shadow-md">
              <CardHeader className="text-center space-y-2">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <CardTitle className="font-display text-2xl font-bold">Google Sign-In Required</CardTitle>
                <CardDescription className="max-w-md mx-auto text-sm">
                  To view your student's admission progress and enrollment status, please continue with the
                  Google account used when applying.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-4 py-4">
                <Button
                  size="lg"
                  onClick={handleGoogleSignIn}
                  disabled={oauthLoading}
                  className="w-full max-w-sm flex items-center justify-center gap-3 bg-white text-gray-800 hover:bg-gray-50 border border-gray-300 shadow-sm"
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

                <p className="text-xs text-muted-foreground text-center max-w-sm">
                  New to Ababeel Quran Class?{" "}
                  <Link to="/admission" className="text-primary hover:underline font-medium">
                    Submit an Admission Application
                  </Link>
                </p>

                {/* Development Sandbox Sign In fallback */}
                <div className="w-full max-w-sm border-t border-border/60 pt-4 mt-2">
                  <button
                    type="button"
                    onClick={() => setShowDevLogin(!showDevLogin)}
                    className="text-xs text-muted-foreground hover:text-foreground text-center w-full block"
                  >
                    {showDevLogin ? "Hide Sandbox Mode" : "Development Sandbox Login"}
                  </button>

                  {showDevLogin && (
                    <form onSubmit={handleDevSignIn} className="mt-3 space-y-2">
                      <Input
                        type="email"
                        value={devEmail}
                        onChange={(e) => setDevEmail(e.target.value)}
                        placeholder="e.g. applicant@gmail.com"
                        className="text-xs"
                      />
                      <Button type="submit" size="sm" variant="outline" className="w-full text-xs">
                        Sign In with Test Google Email
                      </Button>
                    </form>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        ) : admissionsQuery.isLoading ? (
          <div className="py-20 text-center text-muted-foreground">Loading your applications...</div>
        ) : applications.length === 0 ? (
          /* Authenticated but no application */
          <div className="mt-8">
            <Card className="border-border/80 text-center p-8">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-muted text-muted-foreground mb-4">
                <BookOpen className="h-6 w-6" />
              </div>
              <CardTitle className="text-xl font-bold">No Applications Found</CardTitle>
              <CardDescription className="max-w-md mx-auto mt-2 text-sm">
                We couldn't find any admission applications submitted under this Google account (
                {sessionUser.email}).
              </CardDescription>
              <div className="mt-6 flex justify-center gap-3">
                <Button asChild>
                  <Link to="/admission">
                    Start Admission Application <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </Card>
          </div>
        ) : (
          /* Applications Found */
          <div className="mt-8 space-y-6">
            {applications.map((app, index) => {
              const status = (app.status || "pending").toLowerCase();
              const isEditable = ["draft", "submitted", "pending", "correction_requested"].includes(
                status,
              );

              return (
                <Card key={app.id} className="border-border/80 shadow-md overflow-hidden">
                  {/* Card Header with Status Badge */}
                  <div className="p-6 border-b border-border/70 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-muted/20">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-muted-foreground uppercase">
                          {app.request_number}
                        </span>
                        {index === 0 && (
                          <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                            Latest Application
                          </Badge>
                        )}
                      </div>
                      <h2 className="font-display text-2xl font-bold text-foreground">
                        {app.full_name}
                      </h2>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span>NID: <strong className="font-mono text-foreground">{app.identity_number}</strong></span>
                        <span>•</span>
                        <span>DOB: {app.date_of_birth}</span>
                        <span>•</span>
                        <span>Submitted: {new Date(app.submitted_at || app.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <div>
                      {status === "approved" ? (
                        <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white px-3 py-1 text-sm font-semibold">
                          <CheckCircle2 className="mr-1.5 h-4 w-4" /> Approved
                        </Badge>
                      ) : status === "rejected" ? (
                        <Badge variant="destructive" className="px-3 py-1 text-sm font-semibold">
                          <XCircle className="mr-1.5 h-4 w-4" /> Not Approved
                        </Badge>
                      ) : status === "correction_requested" ? (
                        <Badge className="bg-amber-600 hover:bg-amber-600 text-white px-3 py-1 text-sm font-semibold">
                          <AlertCircle className="mr-1.5 h-4 w-4" /> Correction Requested
                        </Badge>
                      ) : status === "waiting_list" || status === "waitlisted" ? (
                        <Badge className="bg-purple-600 hover:bg-purple-600 text-white px-3 py-1 text-sm font-semibold">
                          <Clock className="mr-1.5 h-4 w-4" /> Waiting List
                        </Badge>
                      ) : status === "under_review" ? (
                        <Badge className="bg-blue-600 hover:bg-blue-600 text-white px-3 py-1 text-sm font-semibold">
                          <Clock className="mr-1.5 h-4 w-4" /> Under Review
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="px-3 py-1 text-sm font-semibold bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-300">
                          <Clock className="mr-1.5 h-4 w-4" /> Pending Review
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Progress Timeline Stepper */}
                  <div className="px-6 py-4 bg-background border-b border-border/60">
                    <div className="flex items-center justify-between text-xs font-medium">
                      {/* Step 1 */}
                      <div className="flex flex-col items-center text-center gap-1.5 flex-1">
                        <div className="h-7 w-7 rounded-full bg-emerald-600 text-white grid place-items-center font-bold text-xs shadow-sm">
                          ✓
                        </div>
                        <span className="text-emerald-700 dark:text-emerald-400 font-semibold">Submitted</span>
                      </div>
                      <div className="h-0.5 flex-1 bg-emerald-600 -mt-4"></div>

                      {/* Step 2 */}
                      <div className="flex flex-col items-center text-center gap-1.5 flex-1">
                        <div
                          className={`h-7 w-7 rounded-full grid place-items-center font-bold text-xs shadow-sm ${
                            ["under_review", "approved", "rejected", "correction_requested", "waiting_list"].includes(status)
                              ? "bg-emerald-600 text-white"
                              : "bg-primary text-primary-foreground"
                          }`}
                        >
                          {["under_review", "approved", "rejected", "correction_requested", "waiting_list"].includes(status) ? "✓" : "2"}
                        </div>
                        <span
                          className={
                            ["under_review", "approved", "rejected", "correction_requested", "waiting_list"].includes(status)
                              ? "text-emerald-700 dark:text-emerald-400 font-semibold"
                              : "text-primary font-semibold"
                          }
                        >
                          Under Review
                        </span>
                      </div>
                      <div
                        className={`h-0.5 flex-1 -mt-4 ${
                          ["approved", "rejected", "waiting_list"].includes(status) ? "bg-emerald-600" : "bg-muted"
                        }`}
                      ></div>

                      {/* Step 3 */}
                      <div className="flex flex-col items-center text-center gap-1.5 flex-1">
                        <div
                          className={`h-7 w-7 rounded-full grid place-items-center font-bold text-xs shadow-sm ${
                            status === "approved"
                              ? "bg-emerald-600 text-white"
                              : status === "rejected"
                              ? "bg-destructive text-destructive-foreground"
                              : status === "correction_requested"
                              ? "bg-amber-600 text-white"
                              : status === "waiting_list"
                              ? "bg-purple-600 text-white"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {status === "approved" ? "✓" : status === "rejected" ? "✕" : "3"}
                        </div>
                        <span
                          className={
                            status === "approved"
                              ? "text-emerald-600 font-bold"
                              : status === "rejected"
                              ? "text-destructive font-bold"
                              : status === "correction_requested"
                              ? "text-amber-600 font-bold"
                              : "text-muted-foreground"
                          }
                        >
                          {status === "approved"
                            ? "Approved"
                            : status === "rejected"
                            ? "Not Approved"
                            : status === "correction_requested"
                            ? "Action Needed"
                            : "Decision"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Status Banner & Detailed Actions */}
                  <CardContent className="p-6 space-y-5">
                    {/* Status Specific Messages */}
                    {status === "approved" && (
                      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5 space-y-4">
                        <div className="flex items-start gap-3">
                          <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0 mt-0.5" />
                          <div className="space-y-1">
                            <h3 className="font-display text-lg font-bold text-emerald-800 dark:text-emerald-300">
                              Congratulations! Your admission has been approved.
                            </h3>
                            <p className="text-sm text-emerald-700 dark:text-emerald-400">
                              Official student record and Student Portal access have been provisioned.
                            </p>
                          </div>
                        </div>

                        {/* Approved Student Info Card */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-background/80 p-4 rounded-lg border border-emerald-500/20 text-sm">
                          <div>
                            <span className="text-xs text-muted-foreground">Student Name</span>
                            <div className="font-semibold text-foreground">{app.full_name}</div>
                          </div>
                          <div>
                            <span className="text-xs text-muted-foreground">Student ID (Number)</span>
                            <div className="font-mono font-bold text-primary text-base">
                              {app.linked_student?.student_number || "Generated"}
                            </div>
                          </div>
                          <div>
                            <span className="text-xs text-muted-foreground">Assigned Class</span>
                            <div className="font-semibold text-foreground">
                              {app.linked_student?.classes?.class_name || app.classes?.class_name || "Enrolled Class"}
                            </div>
                          </div>
                          <div>
                            <span className="text-xs text-muted-foreground">Admission Date</span>
                            <div className="font-semibold text-foreground">
                              {app.linked_student?.admission_date || new Date().toISOString().slice(0, 10)}
                            </div>
                          </div>
                        </div>

                        {/* Security notice & credentials reminder */}
                        <div className="rounded-md bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-900 dark:text-amber-300 space-y-1">
                          <div className="font-semibold flex items-center gap-1.5">
                            <Mail className="h-4 w-4" /> Portal Credentials Sent to Registered Email
                          </div>
                          <p>
                            Your Student Portal username (<strong>{app.linked_student?.student_number}</strong>) and temporary initial PIN have been delivered to <strong>{app.applicant_email || sessionUser.email}</strong>.
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            * For security reasons, your temporary PIN is not permanently stored or displayed on this public tracking page.
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 pt-2">
                          <Button asChild className="bg-emerald-600 hover:bg-emerald-700 text-white">
                            <Link to="/student-login">
                              <LogIn className="mr-2 h-4 w-4" /> Go to Student Portal Login
                            </Link>
                          </Button>
                        </div>
                      </div>
                    )}

                    {status === "correction_requested" && (
                      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-5 space-y-3">
                        <div className="flex items-start gap-3">
                          <AlertCircle className="h-6 w-6 text-amber-600 shrink-0 mt-0.5" />
                          <div className="space-y-1">
                            <h3 className="font-display text-base font-bold text-amber-900 dark:text-amber-300">
                              Correction Requested by Administration
                            </h3>
                            <p className="text-sm text-amber-800 dark:text-amber-400">
                              Please review the following instructions and update your application:
                            </p>
                            <div className="bg-background/90 p-3 rounded border border-amber-500/20 text-sm font-medium text-foreground mt-2">
                              "{app.correction_notes || "Please review and correct submitted documents/information."}"
                            </div>
                          </div>
                        </div>

                        <div className="pt-2">
                          <Button onClick={() => openEditModal(app)} className="bg-amber-600 hover:bg-amber-700 text-white">
                            <FileEdit className="mr-2 h-4 w-4" /> Edit & Resubmit Application
                          </Button>
                        </div>
                      </div>
                    )}

                    {status === "under_review" && (
                      <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-4 flex items-start gap-3 text-sm text-blue-900 dark:text-blue-300">
                        <Clock className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                        <div>
                          <div className="font-semibold">Your application is currently being reviewed.</div>
                          <p className="text-xs text-blue-800 dark:text-blue-400 mt-0.5">
                            Our administration team is evaluating classroom capacity and qualifications. You will receive an email notification once a decision is posted.
                          </p>
                        </div>
                      </div>
                    )}

                    {status === "waiting_list" && (
                      <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 p-4 flex items-start gap-3 text-sm text-purple-900 dark:text-purple-300">
                        <Clock className="h-5 w-5 text-purple-600 shrink-0 mt-0.5" />
                        <div>
                          <div className="font-semibold">Your application is currently on the waiting list.</div>
                          <p className="text-xs text-purple-800 dark:text-purple-400 mt-0.5">
                            All seats in the requested session are currently filled. We will notify you immediately when an opening becomes available.
                          </p>
                        </div>
                      </div>
                    )}

                    {status === "rejected" && (
                      <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-5 space-y-3">
                        <div className="flex items-start gap-3">
                          <XCircle className="h-6 w-6 text-destructive shrink-0 mt-0.5" />
                          <div className="space-y-1">
                            <h3 className="font-display text-base font-bold text-destructive">
                              Your admission application was not approved.
                            </h3>
                            {app.applicant_rejection_reason && (
                              <div className="bg-background/90 p-3 rounded border border-destructive/20 text-sm text-foreground mt-2">
                                <span className="text-xs font-semibold text-muted-foreground block mb-1">
                                  Reason for decision:
                                </span>
                                {app.applicant_rejection_reason}
                              </div>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              If you have any questions regarding this decision, please contact the administration office.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {status === "pending" && (
                      <div className="rounded-xl border border-border/80 bg-muted/30 p-4 flex items-start justify-between gap-3 text-sm">
                        <div className="flex items-start gap-3">
                          <Clock className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                          <div>
                            <div className="font-semibold text-foreground">
                              Your application has been received and is waiting for review.
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Submitted under verified Google account: <strong>{app.applicant_email}</strong>.
                            </p>
                          </div>
                        </div>

                        {isEditable && (
                          <Button variant="outline" size="sm" onClick={() => openEditModal(app)}>
                            <FileEdit className="mr-1.5 h-3.5 w-3.5" /> Edit Info
                          </Button>
                        )}
                      </div>
                    )}

                    {/* Application Details Summary Accordion / Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-2 border-t border-border/60">
                      <div>
                        <span className="text-muted-foreground">Guardian Name</span>
                        <div className="font-medium text-foreground">{app.guardian_name}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Guardian Contact</span>
                        <div className="font-medium text-foreground">{app.mobile}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Requested Class</span>
                        <div className="font-medium text-foreground">
                          {app.classes?.class_name || "Any available"}
                        </div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Preferred Session</span>
                        <div className="font-medium text-foreground capitalize">
                          {app.preferred_session || "Standard"}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      {/* Edit Application Dialog */}
      <Dialog open={!!editingApp} onOpenChange={(open) => !open && setEditingApp(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Admission Application</DialogTitle>
            <DialogDescription>
              Update your application details. Resubmitting will notify administration for review.
            </DialogDescription>
          </DialogHeader>

          {editingApp && (
            <form onSubmit={handleSaveEdit} className="space-y-4 py-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="edit_full_name">Student Full Name</Label>
                  <Input
                    id="edit_full_name"
                    value={editForm.full_name || ""}
                    onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit_identity_number">Student NID / Passport</Label>
                  <Input
                    id="edit_identity_number"
                    value={editForm.identity_number || ""}
                    onChange={(e) => setEditForm({ ...editForm, identity_number: e.target.value.toUpperCase() })}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit_dob">Date of Birth</Label>
                  <Input
                    id="edit_dob"
                    type="date"
                    value={editForm.date_of_birth || ""}
                    onChange={(e) => setEditForm({ ...editForm, date_of_birth: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit_guardian_name">Guardian Name</Label>
                  <Input
                    id="edit_guardian_name"
                    value={editForm.guardian_name || ""}
                    onChange={(e) => setEditForm({ ...editForm, guardian_name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit_mobile">Contact Mobile</Label>
                  <Input
                    id="edit_mobile"
                    value={editForm.mobile || ""}
                    onChange={(e) => setEditForm({ ...editForm, mobile: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit_alt_mobile">Alternative Mobile</Label>
                  <Input
                    id="edit_alt_mobile"
                    value={editForm.alternative_mobile || ""}
                    onChange={(e) => setEditForm({ ...editForm, alternative_mobile: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="edit_address">Residential Address</Label>
                  <Input
                    id="edit_address"
                    value={editForm.address || ""}
                    onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="edit_remarks">Additional Notes or Clarifications</Label>
                  <Textarea
                    id="edit_remarks"
                    rows={3}
                    value={editForm.remarks || ""}
                    onChange={(e) => setEditForm({ ...editForm, remarks: e.target.value })}
                    placeholder="Provide any additional details or response to correction notes..."
                  />
                </div>
              </div>

              <DialogFooter className="pt-3">
                <Button type="button" variant="outline" onClick={() => setEditingApp(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={savingEdit}>
                  {savingEdit ? "Saving..." : "Save & Update Application"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <LandingFooter />
    </div>
  );
}
