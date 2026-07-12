/**
 * Synthetic email domain used to store student PIN-auth accounts in Supabase Auth.
 * Students log in with username + PIN; we translate to email/password on the server.
 */
export const STUDENT_EMAIL_DOMAIN = "students.ababeel.local";

export function studentUsernameToEmail(username: string) {
  return `${username.trim().toLowerCase()}@${STUDENT_EMAIL_DOMAIN}`;
}
