export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      academic_terms: {
        Row: {
          academic_year_id: string
          created_at: string
          created_by: string | null
          end_date: string
          id: string
          notes: string | null
          report_available_date: string | null
          start_date: string
          status: Database["public"]["Enums"]["term_status"]
          target_deadline: string | null
          target_open_date: string | null
          term_name: string
          term_sequence: number
          updated_at: string
        }
        Insert: {
          academic_year_id: string
          created_at?: string
          created_by?: string | null
          end_date: string
          id?: string
          notes?: string | null
          report_available_date?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["term_status"]
          target_deadline?: string | null
          target_open_date?: string | null
          term_name: string
          term_sequence: number
          updated_at?: string
        }
        Update: {
          academic_year_id?: string
          created_at?: string
          created_by?: string | null
          end_date?: string
          id?: string
          notes?: string | null
          report_available_date?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["term_status"]
          target_deadline?: string | null
          target_open_date?: string | null
          term_name?: string
          term_sequence?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "academic_terms_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
        ]
      }
      academic_years: {
        Row: {
          created_at: string
          created_by: string | null
          end_date: string
          id: string
          is_current: boolean
          notes: string | null
          start_date: string
          updated_at: string
          year_name: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          end_date: string
          id?: string
          is_current?: boolean
          notes?: string | null
          start_date: string
          updated_at?: string
          year_name: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          end_date?: string
          id?: string
          is_current?: boolean
          notes?: string | null
          start_date?: string
          updated_at?: string
          year_name?: string
        }
        Relationships: []
      }
      admission_requests: {
        Row: {
          address: string | null
          admin_notes: string | null
          agreed_to_rules: boolean
          alternative_mobile: string | null
          atoll: string | null
          date_of_birth: string
          document_url: string | null
          full_name: string
          gender: string
          guardian_identity_number: string | null
          guardian_name: string
          id: string
          identity_number: string
          island: string | null
          linked_student_id: string | null
          medical_notes: string | null
          mobile: string
          photo_url: string | null
          preferred_class: string | null
          preferred_session: string | null
          previous_experience: string | null
          reading_level: string | null
          remarks: string | null
          request_number: string
          reviewed_at: string | null
          reviewed_by: string | null
          rules_version: number | null
          status: string
          submitted_at: string
        }
        Insert: {
          address?: string | null
          admin_notes?: string | null
          agreed_to_rules?: boolean
          alternative_mobile?: string | null
          atoll?: string | null
          date_of_birth: string
          document_url?: string | null
          full_name: string
          gender: string
          guardian_identity_number?: string | null
          guardian_name: string
          id?: string
          identity_number: string
          island?: string | null
          linked_student_id?: string | null
          medical_notes?: string | null
          mobile: string
          photo_url?: string | null
          preferred_class?: string | null
          preferred_session?: string | null
          previous_experience?: string | null
          reading_level?: string | null
          remarks?: string | null
          request_number?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          rules_version?: number | null
          status?: string
          submitted_at?: string
        }
        Update: {
          address?: string | null
          admin_notes?: string | null
          agreed_to_rules?: boolean
          alternative_mobile?: string | null
          atoll?: string | null
          date_of_birth?: string
          document_url?: string | null
          full_name?: string
          gender?: string
          guardian_identity_number?: string | null
          guardian_name?: string
          id?: string
          identity_number?: string
          island?: string | null
          linked_student_id?: string | null
          medical_notes?: string | null
          mobile?: string
          photo_url?: string | null
          preferred_class?: string | null
          preferred_session?: string | null
          previous_experience?: string | null
          reading_level?: string | null
          remarks?: string | null
          request_number?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          rules_version?: number | null
          status?: string
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "admission_requests_linked_student_id_fkey"
            columns: ["linked_student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admission_requests_preferred_class_fkey"
            columns: ["preferred_class"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      admission_settings: {
        Row: {
          closing_date: string | null
          created_at: string
          description: string | null
          id: string
          is_open: boolean
          maximum_age: number | null
          minimum_age: number | null
          opening_date: string | null
          rules: string | null
          rules_version: number
          singleton: boolean
          success_message: string | null
          title: string
          updated_at: string
        }
        Insert: {
          closing_date?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_open?: boolean
          maximum_age?: number | null
          minimum_age?: number | null
          opening_date?: string | null
          rules?: string | null
          rules_version?: number
          singleton?: boolean
          success_message?: string | null
          title?: string
          updated_at?: string
        }
        Update: {
          closing_date?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_open?: boolean
          maximum_age?: number | null
          minimum_age?: number | null
          opening_date?: string | null
          rules?: string | null
          rules_version?: number
          singleton?: boolean
          success_message?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      announcements: {
        Row: {
          audience: string
          audience_reference: string | null
          created_at: string
          created_by: string | null
          description: string | null
          expiry_date: string | null
          id: string
          image_url: string | null
          priority: string
          publish_date: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          audience?: string
          audience_reference?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          expiry_date?: string | null
          id?: string
          image_url?: string | null
          priority?: string
          publish_date?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          audience?: string
          audience_reference?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          expiry_date?: string | null
          id?: string
          image_url?: string | null
          priority?: string
          publish_date?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      attendance: {
        Row: {
          attendance_date: string
          class_id: string
          created_at: string
          id: string
          notes: string | null
          recorded_by: string | null
          status: string
          student_id: string
        }
        Insert: {
          attendance_date: string
          class_id: string
          created_at?: string
          id?: string
          notes?: string | null
          recorded_by?: string | null
          status: string
          student_id: string
        }
        Update: {
          attendance_date?: string
          class_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          recorded_by?: string | null
          status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          module: string
          new_data: Json | null
          previous_data: Json | null
          record_id: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          module: string
          new_data?: Json | null
          previous_data?: Json | null
          record_id?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          module?: string
          new_data?: Json | null
          previous_data?: Json | null
          record_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      classes: {
        Row: {
          assistant_teacher_id: string | null
          class_code: string
          class_name: string
          created_at: string
          id: string
          maximum_students: number | null
          room: string | null
          session: string | null
          status: string
          teacher_id: string | null
          updated_at: string
        }
        Insert: {
          assistant_teacher_id?: string | null
          class_code: string
          class_name: string
          created_at?: string
          id?: string
          maximum_students?: number | null
          room?: string | null
          session?: string | null
          status?: string
          teacher_id?: string | null
          updated_at?: string
        }
        Update: {
          assistant_teacher_id?: string | null
          class_code?: string
          class_name?: string
          created_at?: string
          id?: string
          maximum_students?: number | null
          room?: string | null
          session?: string | null
          status?: string
          teacher_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      competition_categories: {
        Row: {
          category_code: string
          category_name: string
          category_rules: string | null
          competition_id: string
          description: string | null
          eligible_classes: string[] | null
          eligible_gender: string | null
          id: string
          maximum_age: number | null
          maximum_participants: number | null
          minimum_age: number | null
          registration_fee: number | null
          status: string
        }
        Insert: {
          category_code: string
          category_name: string
          category_rules?: string | null
          competition_id: string
          description?: string | null
          eligible_classes?: string[] | null
          eligible_gender?: string | null
          id?: string
          maximum_age?: number | null
          maximum_participants?: number | null
          minimum_age?: number | null
          registration_fee?: number | null
          status?: string
        }
        Update: {
          category_code?: string
          category_name?: string
          category_rules?: string | null
          competition_id?: string
          description?: string | null
          eligible_classes?: string[] | null
          eligible_gender?: string | null
          id?: string
          maximum_age?: number | null
          maximum_participants?: number | null
          minimum_age?: number | null
          registration_fee?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "competition_categories_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
        ]
      }
      competition_participants: {
        Row: {
          address: string | null
          admin_notes: string | null
          agreed_to_rules: boolean
          approval_status: string
          atoll: string | null
          category_id: string | null
          competition_id: string
          date_of_birth: string | null
          document_url: string | null
          experience: string | null
          full_name: string
          gender: string | null
          guardian_name: string | null
          id: string
          identity_number: string | null
          island: string | null
          mobile: string | null
          notes: string | null
          participant_type: string
          participation_status: string
          photo_url: string | null
          registration_number: string
          reviewed_at: string | null
          reviewed_by: string | null
          rules_version: number | null
          school_or_class: string | null
          student_id: string | null
          submitted_at: string
        }
        Insert: {
          address?: string | null
          admin_notes?: string | null
          agreed_to_rules?: boolean
          approval_status?: string
          atoll?: string | null
          category_id?: string | null
          competition_id: string
          date_of_birth?: string | null
          document_url?: string | null
          experience?: string | null
          full_name: string
          gender?: string | null
          guardian_name?: string | null
          id?: string
          identity_number?: string | null
          island?: string | null
          mobile?: string | null
          notes?: string | null
          participant_type?: string
          participation_status?: string
          photo_url?: string | null
          registration_number?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          rules_version?: number | null
          school_or_class?: string | null
          student_id?: string | null
          submitted_at?: string
        }
        Update: {
          address?: string | null
          admin_notes?: string | null
          agreed_to_rules?: boolean
          approval_status?: string
          atoll?: string | null
          category_id?: string | null
          competition_id?: string
          date_of_birth?: string | null
          document_url?: string | null
          experience?: string | null
          full_name?: string
          gender?: string | null
          guardian_name?: string | null
          id?: string
          identity_number?: string | null
          island?: string | null
          mobile?: string | null
          notes?: string | null
          participant_type?: string
          participation_status?: string
          photo_url?: string | null
          registration_number?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          rules_version?: number | null
          school_or_class?: string | null
          student_id?: string | null
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "competition_participants_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "competition_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_participants_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_participants_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      competition_results: {
        Row: {
          category_id: string | null
          certificate_number: string | null
          competition_id: string
          created_at: string
          grade: string | null
          id: string
          is_published: boolean
          judge_remarks: string | null
          participant_id: string
          prize_details: string | null
          rank: number | null
          result_status: string
          score: number | null
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          certificate_number?: string | null
          competition_id: string
          created_at?: string
          grade?: string | null
          id?: string
          is_published?: boolean
          judge_remarks?: string | null
          participant_id: string
          prize_details?: string | null
          rank?: number | null
          result_status?: string
          score?: number | null
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          certificate_number?: string | null
          competition_id?: string
          created_at?: string
          grade?: string | null
          id?: string
          is_published?: boolean
          judge_remarks?: string | null
          participant_id?: string
          prize_details?: string | null
          rank?: number | null
          result_status?: string
          score?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "competition_results_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "competition_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_results_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_results_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "competition_participants"
            referencedColumns: ["id"]
          },
        ]
      }
      competitions: {
        Row: {
          approval_required: boolean
          banner_url: string | null
          competition_code: string
          competition_date: string | null
          competition_type: string | null
          contact_info: string | null
          created_at: string
          display_end_date: string | null
          display_start_date: string | null
          eligible_classes: string[] | null
          eligible_gender: string | null
          end_time: string | null
          full_description: string | null
          id: string
          location: string | null
          maximum_age: number | null
          maximum_participants: number | null
          minimum_age: number | null
          public_registration_enabled: boolean
          registration_close_date: string | null
          registration_open_date: string | null
          rules: string | null
          rules_version: number
          short_description: string | null
          start_time: string | null
          status: string
          student_registration_enabled: boolean
          title: string
          updated_at: string
        }
        Insert: {
          approval_required?: boolean
          banner_url?: string | null
          competition_code: string
          competition_date?: string | null
          competition_type?: string | null
          contact_info?: string | null
          created_at?: string
          display_end_date?: string | null
          display_start_date?: string | null
          eligible_classes?: string[] | null
          eligible_gender?: string | null
          end_time?: string | null
          full_description?: string | null
          id?: string
          location?: string | null
          maximum_age?: number | null
          maximum_participants?: number | null
          minimum_age?: number | null
          public_registration_enabled?: boolean
          registration_close_date?: string | null
          registration_open_date?: string | null
          rules?: string | null
          rules_version?: number
          short_description?: string | null
          start_time?: string | null
          status?: string
          student_registration_enabled?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          approval_required?: boolean
          banner_url?: string | null
          competition_code?: string
          competition_date?: string | null
          competition_type?: string | null
          contact_info?: string | null
          created_at?: string
          display_end_date?: string | null
          display_start_date?: string | null
          eligible_classes?: string[] | null
          eligible_gender?: string | null
          end_time?: string | null
          full_description?: string | null
          id?: string
          location?: string | null
          maximum_age?: number | null
          maximum_participants?: number | null
          minimum_age?: number | null
          public_registration_enabled?: boolean
          registration_close_date?: string | null
          registration_open_date?: string | null
          rules?: string | null
          rules_version?: number
          short_description?: string | null
          start_time?: string | null
          status?: string
          student_registration_enabled?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_status: string
          created_at: string
          full_name: string
          id: string
          phone: string | null
          photo_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_status?: string
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
          photo_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_status?: string
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
          photo_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      staff: {
        Row: {
          assigned_classes: string[] | null
          created_at: string
          designation: string | null
          full_name: string
          id: string
          permissions: string[] | null
          phone: string | null
          staff_number: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_classes?: string[] | null
          created_at?: string
          designation?: string | null
          full_name: string
          id?: string
          permissions?: string[] | null
          phone?: string | null
          staff_number?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_classes?: string[] | null
          created_at?: string
          designation?: string | null
          full_name?: string
          id?: string
          permissions?: string[] | null
          phone?: string | null
          staff_number?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      student_accounts: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          is_locked: boolean
          last_login: string | null
          student_id: string
          updated_at: string
          user_id: string | null
          username: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_locked?: boolean
          last_login?: string | null
          student_id: string
          updated_at?: string
          user_id?: string | null
          username: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_locked?: boolean
          last_login?: string | null
          student_id?: string
          updated_at?: string
          user_id?: string | null
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_accounts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_class_assignments: {
        Row: {
          academic_year_id: string
          assigned_at: string
          assigned_by: string | null
          assistant_teacher_id: string | null
          class_id: string
          created_at: string
          id: string
          is_current: boolean
          main_teacher_id: string | null
          notes: string | null
          session: string | null
          student_id: string
          term_id: string | null
          updated_at: string
        }
        Insert: {
          academic_year_id: string
          assigned_at?: string
          assigned_by?: string | null
          assistant_teacher_id?: string | null
          class_id: string
          created_at?: string
          id?: string
          is_current?: boolean
          main_teacher_id?: string | null
          notes?: string | null
          session?: string | null
          student_id: string
          term_id?: string | null
          updated_at?: string
        }
        Update: {
          academic_year_id?: string
          assigned_at?: string
          assigned_by?: string | null
          assistant_teacher_id?: string | null
          class_id?: string
          created_at?: string
          id?: string
          is_current?: boolean
          main_teacher_id?: string | null
          notes?: string | null
          session?: string | null
          student_id?: string
          term_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_class_assignments_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_class_assignments_assistant_teacher_id_fkey"
            columns: ["assistant_teacher_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_class_assignments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_class_assignments_main_teacher_id_fkey"
            columns: ["main_teacher_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_class_assignments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_class_assignments_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "academic_terms"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          address: string | null
          admission_date: string | null
          admission_request_id: string | null
          alternative_mobile: string | null
          atoll: string | null
          class_id: string | null
          created_at: string
          date_of_birth: string
          full_name: string
          gender: string
          guardian_identity_number: string | null
          guardian_name: string | null
          id: string
          identity_number: string | null
          island: string | null
          mobile: string | null
          photo_url: string | null
          session: string | null
          status: string
          student_number: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address?: string | null
          admission_date?: string | null
          admission_request_id?: string | null
          alternative_mobile?: string | null
          atoll?: string | null
          class_id?: string | null
          created_at?: string
          date_of_birth: string
          full_name: string
          gender: string
          guardian_identity_number?: string | null
          guardian_name?: string | null
          id?: string
          identity_number?: string | null
          island?: string | null
          mobile?: string | null
          photo_url?: string | null
          session?: string | null
          status?: string
          student_number?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: string | null
          admission_date?: string | null
          admission_request_id?: string | null
          alternative_mobile?: string | null
          atoll?: string | null
          class_id?: string | null
          created_at?: string
          date_of_birth?: string
          full_name?: string
          gender?: string
          guardian_identity_number?: string | null
          guardian_name?: string | null
          id?: string
          identity_number?: string | null
          island?: string | null
          mobile?: string | null
          photo_url?: string | null
          session?: string | null
          status?: string
          student_number?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "students_admission_request_id_fkey"
            columns: ["admission_request_id"]
            isOneToOne: false
            referencedRelation: "admission_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      website_settings: {
        Row: {
          about_section: string | null
          address: string | null
          contact_email: string | null
          contact_number: string | null
          favicon_url: string | null
          footer_text: string | null
          hero_description: string | null
          hero_title: string | null
          id: string
          landing_images: string[] | null
          logo_url: string | null
          singleton: boolean
          social_facebook: string | null
          social_instagram: string | null
          social_youtube: string | null
          student_pin_min_length: number
          theme: string | null
          updated_at: string
          website_name: string | null
        }
        Insert: {
          about_section?: string | null
          address?: string | null
          contact_email?: string | null
          contact_number?: string | null
          favicon_url?: string | null
          footer_text?: string | null
          hero_description?: string | null
          hero_title?: string | null
          id?: string
          landing_images?: string[] | null
          logo_url?: string | null
          singleton?: boolean
          social_facebook?: string | null
          social_instagram?: string | null
          social_youtube?: string | null
          student_pin_min_length?: number
          theme?: string | null
          updated_at?: string
          website_name?: string | null
        }
        Update: {
          about_section?: string | null
          address?: string | null
          contact_email?: string | null
          contact_number?: string | null
          favicon_url?: string | null
          footer_text?: string | null
          hero_description?: string | null
          hero_title?: string | null
          id?: string
          landing_images?: string[] | null
          logo_url?: string | null
          singleton?: boolean
          social_facebook?: string | null
          social_instagram?: string | null
          social_youtube?: string | null
          student_pin_min_length?: number
          theme?: string | null
          updated_at?: string
          website_name?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      generate_student_number: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "staff" | "student"
      term_status: "draft" | "active" | "completed" | "archived"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "staff", "student"],
      term_status: ["draft", "active", "completed", "archived"],
    },
  },
} as const
