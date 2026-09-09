export type TargetStatus =
  | "not_started"
  | "practicing"
  | "check_requested"
  | "under_checking"
  | "practice_again"
  | "progressing"
  | "completed"
  | "exempted";

export type CheckResult =
  "completed" | "practice_again" | "progressing" | "not_ready" | "not_checked" | "exempted";

export type CheckRequestStatus =
  "pending" | "accepted" | "under_checking" | "checked" | "cancelled";

export interface TargetTemplateSection {
  id: string;
  target_template_id: string;
  section_name: string;
  section_name_dhivehi: string | null;
  section_type: string | null;
  display_order: number;
  status: string;
  created_at?: string;
  updated_at?: string;
}

export interface TargetTemplateItem {
  id: string;
  template_id: string;
  section_id?: string | null;
  category_id?: string | null;
  target_code?: string | null;
  target_title?: string | null;
  target_title_dhivehi?: string | null;
  title_dv?: string;
  title_en?: string | null;
  arabic_text?: string | null;
  description?: string | null;
  instructions?: string | null;
  is_required?: boolean;
  default_points?: number;
  display_order?: number;
  sort_order?: number;
  star_group?: string | null;
  status?: string;
  is_active?: boolean;
}

export interface TargetTemplate {
  id: string;
  name?: string;
  template_name?: string | null;
  class_level?: string;
  class_id?: string | null;
  academic_year_id?: string | null;
  term_id: string;
  description?: string | null;
  version_number?: number;
  status?: string;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
  sections?: TargetTemplateSection[];
  items?: TargetTemplateItem[];
}

export interface StudentTargetAssignment {
  id: string;
  student_id: string;
  academic_year_id?: string | null;
  term_id: string;
  class_id?: string | null;
  template_id?: string | null;
  template_item_id: string;
  assigned_by?: string | null;
  assigned_date: string;
  due_date?: string | null;
  current_status: TargetStatus;
  status?: string;
  previous_status?: string | null;
  attempt_count: number;
  last_check_date?: string | null;
  last_teacher_comment?: string | null;
  completed_date?: string | null;
  completed_by?: string | null;
  final_attempt_id?: string | null;
  achieved_points?: number;
  report_card_visible?: boolean;
  created_at?: string;
  updated_at?: string;
  // Joins
  target_template_items?: TargetTemplateItem;
  academic_terms?: { id: string; term_name: string };
  students?: {
    id: string;
    full_name: string;
    student_number: string | null;
    photo_url?: string | null;
    class_id?: string | null;
  };
  target_check_requests?: TargetCheckRequest[];
  latest_request?: TargetCheckRequest | null;
  attempts?: TargetCheckAttempt[];
}

export interface TargetCheckRequest {
  id: string;
  student_target_assignment_id: string;
  student_id: string;
  academic_year_id?: string | null;
  term_id: string;
  class_id?: string | null;
  requested_by: string;
  requested_at: string;
  student_message?: string | null;
  preferred_check_date?: string | null;
  request_status: CheckRequestStatus;
  accepted_by?: string | null;
  accepted_at?: string | null;
  cancelled_at?: string | null;
  cancellation_reason?: string | null;
  closed_at?: string | null;
  created_at?: string;
  updated_at?: string;
  // Joins
  student_target_assignments?: StudentTargetAssignment;
  students?: {
    id: string;
    full_name: string;
    student_number: string | null;
    photo_url?: string | null;
    class_id?: string | null;
    classes?: { class_name: string | null; class_level: string | null } | null;
  };
  academic_terms?: { id: string; term_name: string };
}

export interface TargetCheckAttempt {
  id: string;
  target_check_request_id?: string | null;
  student_target_assignment_id: string;
  assignment_id?: string;
  student_id: string;
  academic_year_id?: string | null;
  term_id?: string | null;
  class_id?: string | null;
  attempt_number: number;
  teacher_id?: string | null;
  checked_at: string;
  result: CheckResult;
  outcome?: string | null;
  teacher_comment?: string | null;
  teacher_note?: string | null;
  score?: number | null;
  recommendation?: string | null;
  next_check_date?: string | null;
  evidence_path?: string | null;
  private_teacher_note?: string | null;
  is_final_completion: boolean;
  superseded: boolean;
  created_at?: string;
  updated_at?: string;
  // Joins
  teachers?: { full_name?: string | null; name?: string | null };
}

export interface TargetStatusHistory {
  id: string;
  student_target_assignment_id: string;
  previous_status?: string | null;
  new_status: string;
  related_check_request_id?: string | null;
  related_attempt_id?: string | null;
  changed_by?: string | null;
  change_reason?: string | null;
  changed_at: string;
}

export interface ReportCardItemResult {
  id: string;
  student_term_report_id: string;
  student_target_assignment_id: string;
  template_item_id: string;
  final_attempt_id?: string | null;
  achievement_status: string;
  achievement_star: boolean;
  completion_date?: string | null;
  final_teacher_comment?: string | null;
  achieved_points: number;
  snapshot_json?: unknown;
}

export interface InAppNotification {
  id: string;
  recipient_id: string;
  sender_id?: string | null;
  role_target?: string | null;
  title: string;
  message: string;
  link?: string | null;
  type: string;
  read: boolean;
  created_at: string;
}

export const TARGET_STATUS_CONFIG: Record<
  TargetStatus,
  { label: string; dhivehi: string; badgeClass: string; star: boolean }
> = {
  not_started: {
    label: "Not Started",
    dhivehi: "ފަށާފައި ނުވޭ",
    badgeClass:
      "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300",
    star: false,
  },
  practicing: {
    label: "Practicing",
    dhivehi: "ފަރިތަކުރަނީ",
    badgeClass:
      "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300",
    star: false,
  },
  check_requested: {
    label: "Check Requested",
    dhivehi: "ޗެކްކުރުމަށް އެދިފައި",
    badgeClass: "bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/50 dark:text-blue-300",
    star: false,
  },
  under_checking: {
    label: "Under Checking",
    dhivehi: "ޗެކްކުރެވެމުންދަނީ",
    badgeClass:
      "bg-purple-50 text-purple-700 border-purple-300 dark:bg-purple-950/50 dark:text-purple-300",
    star: false,
  },
  practice_again: {
    label: "Practice Again",
    dhivehi: "އަލުން ފަރިތަކުރުމަށް",
    badgeClass:
      "bg-orange-50 text-orange-700 border-orange-300 dark:bg-orange-950/50 dark:text-orange-300",
    star: false,
  },
  progressing: {
    label: "Progressing",
    dhivehi: "ކުރިއަރަމުންދޭ",
    badgeClass: "bg-teal-50 text-teal-700 border-teal-300 dark:bg-teal-950/50 dark:text-teal-300",
    star: false,
  },
  completed: {
    label: "Completed",
    dhivehi: "ހާސިލްވެއްޖެ",
    badgeClass:
      "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 font-semibold",
    star: true,
  },
  exempted: {
    label: "Exempted",
    dhivehi: "އިސްތިސްނާކުރެވިފައި",
    badgeClass: "bg-gray-100 text-gray-600 border-gray-300 dark:bg-gray-800 dark:text-gray-400",
    star: false,
  },
};

export const CHECK_RESULT_CONFIG: Record<
  CheckResult,
  { label: string; description: string; badgeClass: string; isComplete: boolean }
> = {
  completed: {
    label: "Completed (ހާސިލްވެއްޖެ)",
    description: "Target mastered satisfactorily, earns bright red achievement star.",
    badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-300",
    isComplete: true,
  },
  practice_again: {
    label: "Practice Again (އަލުން ފަރިތަކުރުމަށް)",
    description: "Needs more practice before the next check.",
    badgeClass: "bg-orange-100 text-orange-800 border-orange-300",
    isComplete: false,
  },
  progressing: {
    label: "Progressing (ކުރިއަރަމުންދޭ)",
    description: "Good progress made; continue practicing to complete.",
    badgeClass: "bg-teal-100 text-teal-800 border-teal-300",
    isComplete: false,
  },
  not_ready: {
    label: "Not Ready (ތައްޔާރެއް ނޫން)",
    description: "Student was not ready during check; returned to practicing.",
    badgeClass: "bg-amber-100 text-amber-800 border-amber-300",
    isComplete: false,
  },
  not_checked: {
    label: "Not Checked (ޗެކެއް ނުކުރެވޭ)",
    description: "Check could not occur (e.g. absent/time limit); request remains or rescheduled.",
    badgeClass: "bg-slate-100 text-slate-800 border-slate-300",
    isComplete: false,
  },
  exempted: {
    label: "Exempted (އިސްތިސްނާ)",
    description: "Exempted by teacher or administrator from this target.",
    badgeClass: "bg-gray-100 text-gray-700 border-gray-300",
    isComplete: false,
  },
};

export const SECTION_TYPES = [
  "Arabic Letter Recognition",
  "Arabic Letter Pronunciation",
  "Quran Reading Skills",
  "Qaida Skills",
  "Tajweed Skills",
  "General Learning Skills",
  "Daily Duas",
  "Dhikr",
  "Memorised Surahs",
  "Islamic Manners",
  "Handwriting",
  "Book Care",
  "Attendance",
  "Participation",
  "Custom",
] as const;

export const QUICK_FEEDBACK_TEMPLATES = [
  "Practice again with focus on tajweed rules.",
  "Good improvement, almost there!",
  "Needs clearer pronunciation of letters.",
  "Repeat without assistance.",
  "Memorisation needs more practice at home.",
  "Excellent recitation with proper makhraj and harakaat.",
  "Well prepared, completed successfully!",
  "Recited fluently with good confidence.",
] as const;
