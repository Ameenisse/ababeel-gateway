import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, supabaseForUser, textResult, unauthenticated } from "../shared";

export default defineTool({
  name: "list_competitions",
  title: "List competitions",
  description: "List Quran class competitions with their status and dates.",
  inputSchema: {
    limit: z.number().int().min(1).max(100).describe("Maximum rows (default 20).").optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("competitions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit ?? 20);
    if (error) return errorResult(error.message);
    return textResult(JSON.stringify(data ?? [], null, 2), { competitions: data ?? [], count: data?.length ?? 0 });
  },
});
