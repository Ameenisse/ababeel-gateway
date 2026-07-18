import { defineTool } from "@lovable.dev/mcp-js";
import { errorResult, supabaseForUser, textResult, unauthenticated } from "../shared";

export default defineTool({
  name: "whoami",
  title: "Who am I",
  description: "Returns the signed-in user's ID, email, role (admin/staff/student), and profile name.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const userId = ctx.getUserId();
    if (!userId) return errorResult("No user ID in token");
    const supabase = supabaseForUser(ctx);
    const [{ data: roles }, { data: profile }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase.from("profiles").select("full_name").eq("user_id", ctx.getUserId()).maybeSingle(),
    ]);
    const roleList = (roles ?? []).map((r) => r.role);
    const primary = roleList.includes("admin") ? "admin" : roleList.includes("staff") ? "staff" : roleList.includes("student") ? "student" : null;
    const info = {
      userId: ctx.getUserId(),
      email: ctx.getUserEmail(),
      role: primary,
      roles: roleList,
      fullName: profile?.full_name ?? null,
    };
    return textResult(JSON.stringify(info, null, 2), info);
  },
});

// Re-export a tiny helper used by other tools that need a shared error path.
export function _errorResult(m: string) {
  return errorResult(m);
}
