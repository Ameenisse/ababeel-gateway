import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, supabaseForUser, textResult, unauthenticated } from "../shared";

export default defineTool({
  name: "create_announcement",
  title: "Create announcement",
  description: "Publish a new announcement. Requires admin or staff role; RLS enforces this.",
  inputSchema: {
    title: z.string().describe("Announcement title."),
    description: z.string().describe("Announcement body / description text.").optional(),
    audience: z
      .enum(["public", "staff", "students", "all"])
      .describe("Who should see this announcement (default 'all').")
      .optional(),
    priority: z
      .enum(["low", "normal", "high", "urgent"])
      .describe("Priority label (default 'normal').")
      .optional(),
    status: z
      .enum(["draft", "published", "archived"])
      .describe("Publish status (default 'published').")
      .optional(),
  },
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
  },
  handler: async ({ title, description, audience, priority, status }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const userId = ctx.getUserId();
    if (!userId) return errorResult("No user ID in token");
    const supabase = supabaseForUser(ctx);
    const row: Record<string, unknown> = {
      title: title.trim(),
      description: description?.trim() ?? null,
      audience: audience ?? "all",
      priority: priority ?? "normal",
      status: status ?? "published",
      created_by: userId,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from("announcements") as any)
      .insert(row)
      .select()
      .single();
    if (error) return errorResult(error.message);
    return textResult(`Announcement created: ${data.id}`, { announcement: data });
  },
});
