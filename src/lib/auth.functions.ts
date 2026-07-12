import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Return the current user's primary role (highest privilege first).
 */
export const getMyRole = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (error) throw error;
    const roles = (data ?? []).map((r) => r.role);
    if (roles.includes("admin")) return { role: "admin" as const };
    if (roles.includes("staff")) return { role: "staff" as const };
    if (roles.includes("student")) return { role: "student" as const };
    return { role: null };
  });

/**
 * Look up the synthetic email for a student username so the browser client
 * can call supabase.auth.signInWithPassword with the PIN.
 * This does NOT reveal existence of an account (returns null uniformly).
 */
export const resolveStudentLogin = createServerFn({ method: "POST" })
  .inputValidator((input: { username: string }) =>
    z.object({ username: z.string().min(1).max(64) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: acc, error } = await supabaseAdmin
      .from("student_accounts")
      .select("username, is_active, is_locked, user_id")
      .eq("username", data.username.trim().toLowerCase())
      .maybeSingle();
    if (error) throw error;
    if (!acc || !acc.user_id) return { email: null, reason: "not_found" as const };
    if (!acc.is_active) return { email: null, reason: "inactive" as const };
    if (acc.is_locked) return { email: null, reason: "locked" as const };
    // Look up the auth user email
    const { data: userData, error: userErr } = await supabaseAdmin.auth.admin.getUserById(
      acc.user_id,
    );
    if (userErr || !userData.user?.email) return { email: null, reason: "not_found" as const };
    return { email: userData.user.email, reason: null };
  });
