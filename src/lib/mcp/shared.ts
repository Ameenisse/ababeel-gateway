import { defineTool } from "@lovable.dev/mcp-js";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { ToolContext } from "@lovable.dev/mcp-js";

/**
 * Build a Supabase client that acts as the OAuth-authenticated user.
 * The MCP bearer token is a Supabase OAuth access token — forwarding it
 * means every query runs under RLS as that user.
 */
export function supabaseForUser(ctx: ToolContext) {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient<Database>(url, key, {
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        // Publishable sb_* keys are opaque; the client would send them as
        // Bearer by default. Force the caller's OAuth token instead.
        headers.set("apikey", key);
        headers.set("Authorization", `Bearer ${ctx.getToken()}`);
        return fetch(input, { ...init, headers });
      },
    },
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
  });
}

export function unauthenticated() {
  return {
    content: [{ type: "text" as const, text: "Not authenticated. Sign in to Ababeel Quran Class first." }],
    isError: true as const,
  };
}

export function textResult(text: string, structured?: Record<string, unknown>) {
  return {
    content: [{ type: "text" as const, text }],
    ...(structured ? { structuredContent: structured } : {}),
  };
}

export function errorResult(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true as const };
}

export { defineTool };
