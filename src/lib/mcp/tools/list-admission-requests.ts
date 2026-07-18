import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, supabaseForUser, textResult, unauthenticated } from "../shared";

export default defineTool({
  name: "list_admission_requests",
  title: "List admission requests",
  description: "List admission requests visible to the signed-in user (admin sees all). Filter by status.",
  inputSchema: {
    status: z.enum(["pending", "approved", "rejected", "waitlisted"]).describe("Optional status filter.").optional(),
    limit: z.number().int().min(1).max(200).describe("Maximum rows to return (default 50).").optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("admission_requests")
      .select("id, applicant_name, gender, date_of_birth, parent_name, parent_phone, preferred_class_id, status, submitted_at")
      .order("submitted_at", { ascending: false })
      .limit(limit ?? 50);
    if (status) query = query.eq("status", status);
    const { data, error } = await query;
    if (error) return errorResult(error.message);
    return textResult(JSON.stringify(data ?? [], null, 2), { requests: data ?? [], count: data?.length ?? 0 });
  },
});
