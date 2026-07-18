import { auth, defineMcp } from "@lovable.dev/mcp-js";
import whoamiTool from "./tools/whoami";
import listStudentsTool from "./tools/list-students";
import getStudentTool from "./tools/get-student";
import listAdmissionRequestsTool from "./tools/list-admission-requests";
import listClassesTool from "./tools/list-classes";
import listAnnouncementsTool from "./tools/list-announcements";
import listCompetitionsTool from "./tools/list-competitions";
import createAnnouncementTool from "./tools/create-announcement";

// Issuer MUST be the direct Supabase auth host, not the .lovable.cloud proxy.
// See app-mcp-server-authoring — the proxy discovery advertises the direct
// issuer and mcp-js rejects a mismatch (RFC 8414).
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "ababeel-quran-class-mcp",
  title: "Ababeel Quran Class",
  version: "0.1.0",
  instructions:
    "Tools for the Ababeel Quran Class admissions and academic system. " +
    "Use `whoami` to check the signed-in user. Read-only tools list students, classes, admissions, " +
    "competitions and announcements — all scoped by row-level security to what the caller can see. " +
    "`create_announcement` publishes a new announcement (staff/admin only).",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    whoamiTool,
    listStudentsTool,
    getStudentTool,
    listAdmissionRequestsTool,
    listClassesTool,
    listAnnouncementsTool,
    listCompetitionsTool,
    createAnnouncementTool,
  ],
});
