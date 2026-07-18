import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, supabaseForUser, textResult, unauthenticated } from "../shared";

export default defineTool({
  name: "list_classes",
  title: "List classes",
  description: "List classes visible to the signed-in user.",
  inputSchema: {
    limit: z.number().int().min(1).max(200).describe("Maximum rows (default 100).").optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("classes")
      .select("*")
      .order("display_order", { ascending: true, nullsFirst: false })
      .limit(limit ?? 100);
    if (error) return errorResult(error.message);
    return textResult(JSON.stringify(data ?? [], null, 2), { classes: data ?? [], count: data?.length ?? 0 });
  },
});
