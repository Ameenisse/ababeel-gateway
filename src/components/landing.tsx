import { Link } from "@tanstack/react-router";
import { BookOpen, Trophy, LogIn, Menu, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navLinks = [
  { to: "/", label: "Home" },
  { to: "/#about", label: "About" },
  { to: "/#admission", label: "Admission" },
  { to: "/#competitions", label: "Competitions" },
  { to: "/#announcements", label: "Announcements" },
  { to: "/#contact", label: "Contact" },
];

export function LandingHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground shadow-soft">
            <BookOpen className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="font-display text-lg font-bold leading-tight text-foreground">
              Ababeel Quran Class
            </div>
            <div className="text-xs text-muted-foreground">Learn • Recite • Grow</div>
          </div>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {navLinks.map((l) => (
            <a
              key={l.label}
              href={l.to === "/" ? "/" : l.to}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              {l.label}
            </a>
          ))}
          <Button asChild className="ml-2">
            <Link to="/student-login">
              <LogIn className="mr-1.5 h-4 w-4" /> Student Login
            </Link>
          </Button>
        </nav>

        <button
          onClick={() => setOpen((v) => !v)}
          className="grid h-10 w-10 place-items-center rounded-md text-foreground hover:bg-accent md:hidden"
          aria-label="Toggle menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      <div
        className={cn(
          "border-t border-border/60 bg-background md:hidden",
          open ? "block" : "hidden",
        )}
      >
        <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3">
          {navLinks.map((l) => (
            <a
              key={l.label}
              href={l.to === "/" ? "/" : l.to}
              onClick={() => setOpen(false)}
              className="rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-accent"
            >
              {l.label}
            </a>
          ))}
          <Button asChild className="mt-2">
            <Link to="/student-login">
              <LogIn className="mr-1.5 h-4 w-4" /> Student Login
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

export function LandingFooter({
  siteName,
  contactNumber,
  contactEmail,
  address,
}: {
  siteName?: string;
  contactNumber?: string | null;
  contactEmail?: string | null;
  address?: string | null;
}) {
  return (
    <footer id="contact" className="mt-16 border-t border-border/60 bg-primary-soft/40">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground">
              <BookOpen className="h-4 w-4" />
            </div>
            <div className="font-display text-lg font-bold">
              {siteName ?? "Ababeel Quran Class"}
            </div>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Nurturing hearts through the light of the Qur'an.
          </p>
        </div>
        <div>
          <h4 className="font-semibold text-foreground">Contact</h4>
          <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
            {contactNumber && <li>📞 {contactNumber}</li>}
            {contactEmail && <li>✉️ {contactEmail}</li>}
            {address && <li>📍 {address}</li>}
          </ul>
        </div>
        <div>
          <h4 className="font-semibold text-foreground">Quick Links</h4>
          <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
            <li>
              <a href="/#admission" className="hover:text-foreground">
                Admission
              </a>
            </li>
            <li>
              <a href="/#competitions" className="hover:text-foreground">
                Competitions
              </a>
            </li>
            <li>
              <a href="/#announcements" className="hover:text-foreground">
                Announcements
              </a>
            </li>
            <li>
              <Link to="/student-login" className="hover:text-foreground">
                Student Login
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border/60 bg-background/60">
        <div className="mx-auto max-w-6xl px-4 py-4 text-center text-xs text-muted-foreground sm:px-6">
          © {new Date().getFullYear()} Ababeel Quran Class. All rights reserved.
        </div>
      </div>
    </footer>
  );
}

export function StatusBadge({
  variant,
  children,
}: {
  variant: "success" | "warning" | "destructive" | "info" | "muted" | "gold";
  children: React.ReactNode;
}) {
  const styles: Record<string, string> = {
    success: "bg-success/15 text-success",
    warning: "bg-warning/20 text-warning-foreground",
    destructive: "bg-destructive/15 text-destructive",
    info: "bg-info/15 text-info",
    muted: "bg-muted text-muted-foreground",
    gold: "bg-gold/25 text-gold-foreground",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        styles[variant],
      )}
    >
      {children}
    </span>
  );
}

export { Trophy };
