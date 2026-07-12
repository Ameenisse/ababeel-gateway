import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LandingHeader, LandingFooter, StatusBadge } from "@/components/landing";
import { BookOpen, Trophy, GraduationCap, Megaphone, ArrowRight, Calendar } from "lucide-react";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

function LandingPage() {
  const settings = useQuery({
    queryKey: ["website_settings"],
    queryFn: async () => {
      const { data } = await supabase.from("website_settings").select("*").maybeSingle();
      return data;
    },
  });
  const admission = useQuery({
    queryKey: ["admission_settings"],
    queryFn: async () => {
      const { data } = await supabase.from("admission_settings").select("*").maybeSingle();
      return data;
    },
  });
  const competitions = useQuery({
    queryKey: ["landing_competitions"],
    queryFn: async () => {
      const { data } = await supabase
        .from("competitions")
        .select("id, title, short_description, competition_type, competition_date, registration_close_date, banner_url, status")
        .order("competition_date", { ascending: true });
      return data ?? [];
    },
  });
  const announcements = useQuery({
    queryKey: ["landing_announcements"],
    queryFn: async () => {
      const { data } = await supabase
        .from("announcements")
        .select("id, title, description, priority, publish_date")
        .order("publish_date", { ascending: false })
        .limit(6);
      return data ?? [];
    },
  });

  const s = settings.data;
  const adm = admission.data;

  const admissionStatus = (() => {
    if (!adm) return { label: "Opening Soon", variant: "info" as const };
    const now = new Date();
    const opening = adm.opening_date ? new Date(adm.opening_date) : null;
    const closing = adm.closing_date ? new Date(adm.closing_date) : null;
    if (!adm.is_open) return { label: "Closed", variant: "destructive" as const };
    if (opening && now < opening) return { label: "Opening Soon", variant: "info" as const };
    if (closing && now > closing) return { label: "Closed", variant: "destructive" as const };
    return { label: "Open", variant: "success" as const };
  })();

  return (
    <div className="min-h-screen bg-background">
      <LandingHeader />

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary-soft via-background to-background" />
        <div className="absolute -right-32 -top-32 -z-10 h-96 w-96 rounded-full bg-gold/20 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 -z-10 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />

        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 md:grid-cols-2 md:py-24 md:items-center">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-gold/20 px-3 py-1 text-xs font-medium text-gold-foreground">
              ✨ Welcome to our community
            </div>
            <h1 className="font-display text-4xl font-bold leading-tight text-foreground sm:text-5xl md:text-6xl">
              {s?.hero_title ?? "Ababeel Quran Class"}
            </h1>
            <p className="mt-4 max-w-xl text-lg text-muted-foreground">
              {s?.hero_description ??
                "A caring space where children and adults learn to read, understand, and love the noble Qur'an."}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button size="lg" asChild>
                <a href="#admission">
                  <GraduationCap className="mr-2 h-4 w-4" /> Apply for Admission
                </a>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <a href="#competitions">
                  <Trophy className="mr-2 h-4 w-4" /> View Competitions
                </a>
              </Button>
              <Button size="lg" variant="ghost" asChild>
                <Link to="/student-login">Student Login</Link>
              </Button>
            </div>
          </div>
          <div className="relative">
            <div className="rounded-3xl border border-border/60 bg-card p-8 shadow-glow">
              <div className="grid h-16 w-16 place-items-center rounded-2xl bg-primary text-primary-foreground">
                <BookOpen className="h-8 w-8" />
              </div>
              <h3 className="mt-6 font-display text-2xl font-bold">Our Vision</h3>
              <p className="mt-2 text-muted-foreground">
                To raise a generation connected to Allah through the timeless words of the Qur'an —
                with excellence, sincerity, and love.
              </p>
              <div className="mt-6 grid grid-cols-3 gap-3 text-center">
                {[
                  { label: "Classes", value: "10+" },
                  { label: "Categories", value: "6" },
                  { label: "Since", value: new Date().getFullYear() },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl bg-primary-soft/60 p-3">
                    <div className="font-display text-xl font-bold text-primary">{s.value}</div>
                    <div className="text-xs text-muted-foreground">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ABOUT */}
      <section id="about" className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <h2 className="font-display text-3xl font-bold">About the Class</h2>
        <p className="mt-3 max-w-3xl text-muted-foreground">
          {s?.about_section ??
            "Ababeel Quran Class offers structured Qur'an learning across multiple levels — from Baby Class and Nursery to Hifz and Hathim — with dedicated teachers, small groups, and a warm, family-friendly atmosphere."}
        </p>
      </section>

      {/* ADMISSION */}
      <section id="admission" className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="rounded-3xl border border-border/60 bg-card p-6 shadow-soft sm:p-10">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="font-display text-3xl font-bold">Admission</h2>
                <StatusBadge variant={admissionStatus.variant}>{admissionStatus.label}</StatusBadge>
              </div>
              <p className="mt-2 max-w-2xl text-muted-foreground">
                {adm?.description ?? "Applications for our upcoming intake."}
              </p>
              {(adm?.opening_date || adm?.closing_date) && (
                <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted-foreground">
                  {adm?.opening_date && (
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="h-4 w-4" /> Opens {format(new Date(adm.opening_date), "PP")}
                    </span>
                  )}
                  {adm?.closing_date && (
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="h-4 w-4" /> Closes {format(new Date(adm.closing_date), "PP")}
                    </span>
                  )}
                </div>
              )}
            </div>
            <Button size="lg" disabled={admissionStatus.variant !== "success"} asChild={admissionStatus.variant === "success"}>
              {admissionStatus.variant === "success" ? (
                <Link to="/admission">
                  Apply Now <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              ) : (
                <span>Apply Now</span>
              )}
            </Button>
          </div>
        </div>
      </section>

      {/* COMPETITIONS */}
      <section id="competitions" className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-display text-3xl font-bold">Active Competitions</h2>
          <Trophy className="h-6 w-6 text-gold" />
        </div>
        {competitions.isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-56 animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        ) : (competitions.data ?? []).length === 0 ? (
          <p className="text-muted-foreground">No competitions are currently open. Please check back later.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {competitions.data!.map((c) => (
              <Card key={c.id} className="overflow-hidden border-border/60 transition-shadow hover:shadow-glow">
                {c.banner_url ? (
                  <div className="aspect-video w-full bg-muted" style={{ backgroundImage: `url(${c.banner_url})`, backgroundSize: "cover", backgroundPosition: "center" }} />
                ) : (
                  <div className="aspect-video w-full bg-gradient-to-br from-primary/70 to-gold/70">
                    <div className="grid h-full place-items-center">
                      <Trophy className="h-12 w-12 text-primary-foreground" />
                    </div>
                  </div>
                )}
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="font-display text-lg leading-tight">{c.title}</CardTitle>
                    <StatusBadge variant="gold">{c.competition_type ?? "Event"}</StatusBadge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {c.short_description && (
                    <p className="line-clamp-2 text-sm text-muted-foreground">{c.short_description}</p>
                  )}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {c.competition_date && (
                      <span>📅 {format(new Date(c.competition_date), "PP")}</span>
                    )}
                    {c.registration_close_date && (
                      <span>Register by {format(new Date(c.registration_close_date), "PP")}</span>
                    )}
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" className="flex-1" disabled>
                      Participate
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1" disabled>
                      Read Rules
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* ANNOUNCEMENTS */}
      <section id="announcements" className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="mb-6 flex items-center gap-2">
          <Megaphone className="h-6 w-6 text-primary" />
          <h2 className="font-display text-3xl font-bold">Announcements</h2>
        </div>
        {announcements.isLoading ? (
          <div className="grid gap-3 md:grid-cols-2">
            {[0, 1].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        ) : (announcements.data ?? []).length === 0 ? (
          <p className="text-muted-foreground">No announcements yet.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {announcements.data!.map((a) => (
              <Card key={a.id} className="border-border/60">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base">{a.title}</CardTitle>
                    {a.priority === "urgent" && <StatusBadge variant="destructive">Urgent</StatusBadge>}
                    {a.priority === "important" && <StatusBadge variant="warning">Important</StatusBadge>}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{a.description}</p>
                  {a.publish_date && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {format(new Date(a.publish_date), "PP")}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <LandingFooter
        siteName={s?.website_name ?? undefined}
        contactNumber={s?.contact_number}
        contactEmail={s?.contact_email}
        address={s?.address}
      />
    </div>
  );
}
