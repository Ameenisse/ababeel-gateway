import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, supabaseForUser, textResult, unauthenticated } from "../shared";

export default defineTool({
  name: "get_student",
  title: "Get student",
  description:
    "Fetch a single student's full profile by their UUID. RLS applies to the signed-in user.",
  inputSchema: {
    student_id: z.string().uuid().describe("The student's UUID (students.id)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ student_id }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("students")
      .select("*")
      .eq("id", student_id)
      .maybeSingle();
    if (error) return errorResult(error.message);
    if (!data) return errorResult("Student not found or not accessible.");
    return textResult(JSON.stringify(data, null, 2), { student: data });
  },
});
