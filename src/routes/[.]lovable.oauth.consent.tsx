import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield } from "lucide-react";

// Beta auth.oauth namespace — type it locally so we don't have to grep node_modules.
type AuthorizationDetails = {
  client?: { name?: string; client_id?: string; redirect_uris?: string[] } | null;
  scope?: string | null;
  redirect_url?: string | null;
  redirect_to?: string | null;
};
type OAuthResult = { data: AuthorizationDetails | null; error: { message: string } | null };
type OAuthNamespace = {
  getAuthorizationDetails: (id: string) => Promise<OAuthResult>;
  approveAuthorization: (id: string) => Promise<OAuthResult>;
  denyAuthorization: (id: string) => Promise<OAuthResult>;
};
function oauth(): OAuthNamespace {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase.auth as any).oauth as OAuthNamespace;
}

export const Route = createFileRoute("/.lovable/oauth/consent")({
  // Session lives in localStorage — SSR would see no session and bounce
  // signed-in users to login.
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Missing authorization_id");
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      // Send unauthenticated visitors to the staff/admin login (admins & staff
      // are the intended MCP users). Preserve the full consent URL as `next`.
      const next = location.pathname + location.searchStr;
      throw redirect({ to: "/staff", search: { next } });
    }
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauth().getAuthorizationDetails(authorizationId);
    if (error) throw new Error(error.message);
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <div className="grid min-h-screen place-items-center bg-background px-4">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Could not load authorization</CardTitle>
          <CardDescription>{String((error as Error)?.message ?? error)}</CardDescription>
        </CardHeader>
      </Card>
    </div>
  ),
});

function Consent() {
  const details = Route.useLoaderData() as AuthorizationDetails | null;
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const { data, error } = approve
      ? await oauth().approveAuthorization(authorization_id)
      : await oauth().denyAuthorization(authorization_id);
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("No redirect returned by the authorization server.");
      return;
    }
    window.location.href = target;
  }

  const clientName = details?.client?.name ?? "an application";

  return (
    <div className="grid min-h-screen place-items-center bg-gradient-to-br from-primary-soft via-background to-background px-4">
      <Card className="w-full max-w-md border-border/60 shadow-glow">
        <CardHeader className="text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-primary text-primary-foreground">
            <Shield className="h-6 w-6" />
          </div>
          <CardTitle className="font-display text-2xl">Connect {clientName}</CardTitle>
          <CardDescription>
            This lets {clientName} use Ababeel Quran Class as you. It does not bypass this app&apos;s
            permissions — role-based access still applies.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <Button className="w-full" disabled={busy} onClick={() => decide(true)}>
            {busy ? "Working…" : "Approve"}
          </Button>
          <Button variant="outline" className="w-full" disabled={busy} onClick={() => decide(false)}>
            Cancel connection
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
