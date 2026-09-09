import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, supabaseForUser, textResult, unauthenticated } from "../shared";

export default defineTool({
  name: "list_students",
  title: "List students",
  description:
    "List students visible to the signed-in user (scoped by RLS). Supports search by name or student number and a result limit.",
  inputSchema: {
    search: z
      .string()
      .describe("Optional case-insensitive name or student number match.")
      .optional(),
    limit: z
      .number()
      .int()
      .min(1)
      .max(200)
      .describe("Maximum number of rows to return (default 50).")
      .optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ search, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("students")
      .select("id, student_number, full_name, class_id, status, gender, date_of_birth")
      .order("full_name", { ascending: true })
      .limit(limit ?? 50);
    if (search && search.trim()) {
      const q = search.trim();
      query = query.or(`full_name.ilike.%${q}%,student_number.ilike.%${q}%`);
    }
    const { data, error } = await query;
    if (error) return errorResult(error.message);
    return textResult(JSON.stringify(data ?? [], null, 2), {
      students: data ?? [],
      count: data?.length ?? 0,
    });
  },
});
