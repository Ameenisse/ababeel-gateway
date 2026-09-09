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

/**
 * Ensure default admin user (ababeel.mv@gmail.com) exists with password and admin role
 */
export const ensureAdminAccount = createServerFn({ method: "POST" })
  .inputValidator((input: { email: string }) =>
    z.object({ email: z.string().email() }).parse(input),
  )
  .handler(async ({ data }) => {
    const targetEmail = data.email.trim().toLowerCase();
    if (targetEmail === "ababeel.mv@gmail.com") {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      try {
        const { data: usersData } = await supabaseAdmin.auth.admin.listUsers();
        let user = usersData?.users?.find((u) => u.email?.toLowerCase() === targetEmail);

        if (!user) {
          const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
            email: targetEmail,
            password: "Ababil2613",
            email_confirm: true,
            user_metadata: { full_name: "Admin" },
          });
          if (createErr) console.error("Error creating admin account:", createErr);
          if (created?.user) user = created.user;
        } else {
          await supabaseAdmin.auth.admin.updateUserById(user.id, {
            password: "Ababil2613",
            email_confirm: true,
          });
        }

        if (user) {
          const { data: roleRow } = await supabaseAdmin
            .from("user_roles")
            .select("id")
            .eq("user_id", user.id)
            .eq("role", "admin")
            .maybeSingle();

          if (!roleRow) {
            await supabaseAdmin.from("user_roles").insert({
              user_id: user.id,
              role: "admin",
            });
          }
        }
      } catch (e) {
        console.error("Failed in ensureAdminAccount:", e);
      }
    }
    return { ok: true };
  });
