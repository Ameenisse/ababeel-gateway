import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, supabaseForUser, textResult, unauthenticated } from "../shared";

export default defineTool({
  name: "create_announcement",
  title: "Create announcement",
  description: "Publish a new announcement. Requires admin or staff role; RLS enforces this.",
  inputSchema: {
    title: z.string().describe("Announcement title."),
    body: z.string().describe("Announcement body / message text."),
    audience: z.enum(["public", "staff", "students", "all"]).describe("Who should see this announcement.").optional(),
    pinned: z.boolean().describe("Pin to the top of the list.").optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async ({ title, body, audience, pinned }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const userId = ctx.getUserId();
    if (!userId) return errorResult("No user ID in token");
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("announcements")
      .insert({
        title: title.trim(),
        body: body.trim(),
        audience: audience ?? "all",
        pinned: pinned ?? false,
        created_by: userId,
      })
      .select()
      .single();
    if (error) return errorResult(error.message);
    return textResult(`Announcement created: ${data.id}`, { announcement: data });
  },
});
