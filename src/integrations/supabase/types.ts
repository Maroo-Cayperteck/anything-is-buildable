export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      academic_events: {
        Row: {
          audience_scope: Database["public"]["Enums"]["document_audience"];
          created_at: string;
          created_by: string | null;
          description: string | null;
          ends_at: string | null;
          event_type: Database["public"]["Enums"]["event_kind"];
          id: string;
          is_published: boolean;
          level_id: string | null;
          location: string | null;
          offering_id: string | null;
          program_id: string | null;
          semester_id: string | null;
          starts_at: string;
          target_student_user_id: string | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          audience_scope?: Database["public"]["Enums"]["document_audience"];
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          ends_at?: string | null;
          event_type?: Database["public"]["Enums"]["event_kind"];
          id?: string;
          is_published?: boolean;
          level_id?: string | null;
          location?: string | null;
          offering_id?: string | null;
          program_id?: string | null;
          semester_id?: string | null;
          starts_at: string;
          target_student_user_id?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          audience_scope?: Database["public"]["Enums"]["document_audience"];
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          ends_at?: string | null;
          event_type?: Database["public"]["Enums"]["event_kind"];
          id?: string;
          is_published?: boolean;
          level_id?: string | null;
          location?: string | null;
          offering_id?: string | null;
          program_id?: string | null;
          semester_id?: string | null;
          starts_at?: string;
          target_student_user_id?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      academic_groups: {
        Row: {
          capacity: number | null;
          created_at: string;
          id: string;
          instructor: string | null;
          name: string;
          offering_id: string;
        };
        Insert: {
          capacity?: number | null;
          created_at?: string;
          id?: string;
          instructor?: string | null;
          name: string;
          offering_id: string;
        };
        Update: {
          capacity?: number | null;
          created_at?: string;
          id?: string;
          instructor?: string | null;
          name?: string;
          offering_id?: string;
        };
        Relationships: [];
      };
      academic_levels: {
        Row: {
          created_at: string;
          id: string;
          level_number: number;
          name_ar: string;
          program_id: string;
          sort_order: number;
        };
        Insert: {
          created_at?: string;
          id?: string;
          level_number: number;
          name_ar: string;
          program_id: string;
          sort_order?: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          level_number?: number;
          name_ar?: string;
          program_id?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      academic_programs: {
        Row: {
          code: string;
          created_at: string;
          faculty: string | null;
          id: string;
          is_active: boolean;
          name_ar: string;
          name_en: string | null;
          updated_at: string;
        };
        Insert: {
          code: string;
          created_at?: string;
          faculty?: string | null;
          id?: string;
          is_active?: boolean;
          name_ar: string;
          name_en?: string | null;
          updated_at?: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          faculty?: string | null;
          id?: string;
          is_active?: boolean;
          name_ar?: string;
          name_en?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      academic_years: {
        Row: {
          created_at: string;
          id: string;
          is_current: boolean;
          name: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_current?: boolean;
          name: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_current?: boolean;
          name?: string;
        };
        Relationships: [];
      };
      admin_activity_logs: {
        Row: {
          action: string;
          actor_label: string | null;
          actor_user_id: string | null;
          created_at: string;
          entity_id: string | null;
          entity_type: string;
          id: string;
          metadata: Json;
        };
        Insert: {
          action: string;
          actor_label?: string | null;
          actor_user_id?: string | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type: string;
          id?: string;
          metadata?: Json;
        };
        Update: {
          action?: string;
          actor_label?: string | null;
          actor_user_id?: string | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string;
          id?: string;
          metadata?: Json;
        };
        Relationships: [];
      };
      announcements: {
        Row: {
          audience_scope: Database["public"]["Enums"]["document_audience"];
          body: string;
          created_at: string;
          created_by: string | null;
          id: string;
          is_archived: boolean;
          is_published: boolean;
          level_id: string | null;
          program_id: string | null;
          published_at: string | null;
          target_student_user_id: string | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          audience_scope?: Database["public"]["Enums"]["document_audience"];
          body: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_archived?: boolean;
          is_published?: boolean;
          level_id?: string | null;
          program_id?: string | null;
          published_at?: string | null;
          target_student_user_id?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          audience_scope?: Database["public"]["Enums"]["document_audience"];
          body?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_archived?: boolean;
          is_published?: boolean;
          level_id?: string | null;
          program_id?: string | null;
          published_at?: string | null;
          target_student_user_id?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      course_offerings: {
        Row: {
          course_id: string;
          created_at: string;
          id: string;
          is_active: boolean;
          level_id: string | null;
          program_id: string | null;
          semester_id: string;
        };
        Insert: {
          course_id: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          level_id?: string | null;
          program_id?: string | null;
          semester_id: string;
        };
        Update: {
          course_id?: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          level_id?: string | null;
          program_id?: string | null;
          semester_id?: string;
        };
        Relationships: [];
      };
      courses: {
        Row: {
          code: string;
          created_at: string;
          credit_hours: number;
          id: string;
          is_active: boolean;
          name: string;
          name_ar: string | null;
          updated_at: string;
        };
        Insert: {
          code: string;
          created_at?: string;
          credit_hours?: number;
          id?: string;
          is_active?: boolean;
          name: string;
          name_ar?: string | null;
          updated_at?: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          credit_hours?: number;
          id?: string;
          is_active?: boolean;
          name?: string;
          name_ar?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      documents: {
        Row: {
          audience_scope: Database["public"]["Enums"]["document_audience"];
          created_at: string;
          description: string | null;
          doc_category: string;
          file_name: string | null;
          file_path: string | null;
          file_size: number | null;
          id: string;
          is_available: boolean;
          level_id: string | null;
          offering_id: string | null;
          program_id: string | null;
          sort_order: number;
          target_student_user_id: string | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          audience_scope?: Database["public"]["Enums"]["document_audience"];
          created_at?: string;
          description?: string | null;
          doc_category?: string;
          file_name?: string | null;
          file_path?: string | null;
          file_size?: number | null;
          id?: string;
          is_available?: boolean;
          level_id?: string | null;
          offering_id?: string | null;
          program_id?: string | null;
          sort_order?: number;
          target_student_user_id?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          audience_scope?: Database["public"]["Enums"]["document_audience"];
          created_at?: string;
          description?: string | null;
          doc_category?: string;
          file_name?: string | null;
          file_path?: string | null;
          file_size?: number | null;
          id?: string;
          is_available?: boolean;
          level_id?: string | null;
          offering_id?: string | null;
          program_id?: string | null;
          sort_order?: number;
          target_student_user_id?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      enrollments: {
        Row: {
          created_at: string;
          group_id: string;
          id: string;
          offering_id: string;
          status: string;
          student_user_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          group_id: string;
          id?: string;
          offering_id: string;
          status?: string;
          student_user_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          group_id?: string;
          id?: string;
          offering_id?: string;
          status?: string;
          student_user_id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      lectures: {
        Row: {
          created_at: string;
          day_of_week: string;
          end_hour: number;
          group_id: string;
          id: string;
          instructor: string | null;
          kind: Database["public"]["Enums"]["slot_kind"];
          location: string;
          start_hour: number;
        };
        Insert: {
          created_at?: string;
          day_of_week: string;
          end_hour: number;
          group_id: string;
          id?: string;
          instructor?: string | null;
          kind?: Database["public"]["Enums"]["slot_kind"];
          location: string;
          start_hour: number;
        };
        Update: {
          created_at?: string;
          day_of_week?: string;
          end_hour?: number;
          group_id?: string;
          id?: string;
          instructor?: string | null;
          kind?: Database["public"]["Enums"]["slot_kind"];
          location?: string;
          start_hour?: number;
        };
        Relationships: [];
      };
      registration_requests: {
        Row: {
          auth_user_id: string;
          created_at: string;
          email: string;
          full_name_ar: string;
          full_name_en: string | null;
          gender: string | null;
          id: string;
          phone: string | null;
          rejection_reason: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          roster_id: string | null;
          status: Database["public"]["Enums"]["account_status"];
          student_code: string;
          updated_at: string;
        };
        Insert: {
          auth_user_id: string;
          created_at?: string;
          email: string;
          full_name_ar: string;
          full_name_en?: string | null;
          gender?: string | null;
          id?: string;
          phone?: string | null;
          rejection_reason?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          roster_id?: string | null;
          status?: Database["public"]["Enums"]["account_status"];
          student_code: string;
          updated_at?: string;
        };
        Update: {
          auth_user_id?: string;
          created_at?: string;
          email?: string;
          full_name_ar?: string;
          full_name_en?: string | null;
          gender?: string | null;
          id?: string;
          phone?: string | null;
          rejection_reason?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          roster_id?: string | null;
          status?: Database["public"]["Enums"]["account_status"];
          student_code?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      semester_grade_summaries: {
        Row: {
          created_at: string;
          id: string;
          is_published: boolean;
          semester_gpa: number | null;
          semester_id: string;
          student_user_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_published?: boolean;
          semester_gpa?: number | null;
          semester_id: string;
          student_user_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_published?: boolean;
          semester_gpa?: number | null;
          semester_id?: string;
          student_user_id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      semesters: {
        Row: {
          academic_year_id: string;
          created_at: string;
          ends_on: string | null;
          id: string;
          is_closed: boolean;
          is_current: boolean;
          name_ar: string;
          season: string;
          starts_on: string | null;
        };
        Insert: {
          academic_year_id: string;
          created_at?: string;
          ends_on?: string | null;
          id?: string;
          is_closed?: boolean;
          is_current?: boolean;
          name_ar: string;
          season: string;
          starts_on?: string | null;
        };
        Update: {
          academic_year_id?: string;
          created_at?: string;
          ends_on?: string | null;
          id?: string;
          is_closed?: boolean;
          is_current?: boolean;
          name_ar?: string;
          season?: string;
          starts_on?: string | null;
        };
        Relationships: [];
      };
      student_documents: {
        Row: {
          created_at: string;
          description: string | null;
          file_name: string;
          file_path: string;
          file_size: number | null;
          id: string;
          is_available: boolean;
          student_user_id: string;
          title: string;
          updated_at: string;
          uploaded_by: string | null;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          file_name: string;
          file_path: string;
          file_size?: number | null;
          id?: string;
          is_available?: boolean;
          student_user_id: string;
          title: string;
          updated_at?: string;
          uploaded_by?: string | null;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          file_name?: string;
          file_path?: string;
          file_size?: number | null;
          id?: string;
          is_available?: boolean;
          student_user_id?: string;
          title?: string;
          updated_at?: string;
          uploaded_by?: string | null;
        };
        Relationships: [];
      };
      student_grades: {
        Row: {
          course_id: string;
          created_at: string;
          grade_letter: string | null;
          grade_points: number | null;
          id: string;
          is_published: boolean;
          marks: number | null;
          semester_id: string;
          status_label: string;
          student_user_id: string;
          updated_at: string;
        };
        Insert: {
          course_id: string;
          created_at?: string;
          grade_letter?: string | null;
          grade_points?: number | null;
          id?: string;
          is_published?: boolean;
          marks?: number | null;
          semester_id: string;
          status_label?: string;
          student_user_id: string;
          updated_at?: string;
        };
        Update: {
          course_id?: string;
          created_at?: string;
          grade_letter?: string | null;
          grade_points?: number | null;
          id?: string;
          is_published?: boolean;
          marks?: number | null;
          semester_id?: string;
          status_label?: string;
          student_user_id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      student_profiles: {
        Row: {
          academic_level: string | null;
          academic_status: string | null;
          academic_year: string | null;
          academic_year_id: string | null;
          account_status: Database["public"]["Enums"]["account_status"];
          cgpa: number | null;
          created_at: string;
          earned_hours: number | null;
          email: string | null;
          extra: Json;
          faculty: string | null;
          full_name_ar: string;
          full_name_en: string | null;
          gender: string | null;
          level_id: string | null;
          national_id: string | null;
          phone: string | null;
          program: string | null;
          program_id: string | null;
          student_code: string | null;
          updated_at: string;
          user_id: string;
          username: string;
        };
        Insert: {
          academic_level?: string | null;
          academic_status?: string | null;
          academic_year?: string | null;
          academic_year_id?: string | null;
          account_status?: Database["public"]["Enums"]["account_status"];
          cgpa?: number | null;
          created_at?: string;
          earned_hours?: number | null;
          email?: string | null;
          extra?: Json;
          faculty?: string | null;
          full_name_ar: string;
          full_name_en?: string | null;
          gender?: string | null;
          level_id?: string | null;
          national_id?: string | null;
          phone?: string | null;
          program?: string | null;
          program_id?: string | null;
          student_code?: string | null;
          updated_at?: string;
          user_id: string;
          username: string;
        };
        Update: {
          academic_level?: string | null;
          academic_status?: string | null;
          academic_year?: string | null;
          academic_year_id?: string | null;
          account_status?: Database["public"]["Enums"]["account_status"];
          cgpa?: number | null;
          created_at?: string;
          earned_hours?: number | null;
          email?: string | null;
          extra?: Json;
          faculty?: string | null;
          full_name_ar?: string;
          full_name_en?: string | null;
          gender?: string | null;
          level_id?: string | null;
          national_id?: string | null;
          phone?: string | null;
          program?: string | null;
          program_id?: string | null;
          student_code?: string | null;
          updated_at?: string;
          user_id?: string;
          username?: string;
        };
        Relationships: [];
      };
      student_roster: {
        Row: {
          approved_email: string;
          created_at: string;
          full_name_ar: string | null;
          full_name_en: string | null;
          id: string;
          is_active: boolean;
          level_id: string | null;
          program_id: string | null;
          student_code: string;
          updated_at: string;
        };
        Insert: {
          approved_email: string;
          created_at?: string;
          full_name_ar?: string | null;
          full_name_en?: string | null;
          id?: string;
          is_active?: boolean;
          level_id?: string | null;
          program_id?: string | null;
          student_code: string;
          updated_at?: string;
        };
        Update: {
          approved_email?: string;
          created_at?: string;
          full_name_ar?: string | null;
          full_name_en?: string | null;
          id?: string;
          is_active?: boolean;
          level_id?: string | null;
          program_id?: string | null;
          student_code?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      can_access_audience: {
        Args: {
          _audience: Database["public"]["Enums"]["document_audience"];
          _level_id: string | null;
          _program_id: string | null;
          _target_student_user_id: string | null;
        };
        Returns: boolean;
      };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      is_active_student: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
    };
    Enums: {
      account_status: "pending" | "active" | "rejected" | "suspended";
      app_role: "admin" | "student";
      document_audience: "all" | "program" | "level" | "student";
      event_kind: "exam" | "deadline" | "academic" | "announcement";
      slot_kind: "lecture" | "section" | "lab";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;
type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      account_status: ["pending", "active", "rejected", "suspended"],
      app_role: ["admin", "student"],
      document_audience: ["all", "program", "level", "student"],
      event_kind: ["exam", "deadline", "academic", "announcement"],
      slot_kind: ["lecture", "section", "lab"],
    },
  },
} as const;
