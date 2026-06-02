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
      attendance_logs: {
        Row: {
          branch_id: string | null
          check_in_at: string
          check_in_method: Database["public"]["Enums"]["check_in_method"]
          check_out_at: string | null
          checked_in_by: string | null
          checked_out_by: string | null
          created_at: string
          id: string
          notes: string | null
          pickup_request_id: string | null
          student_id: string
        }
        Insert: {
          branch_id?: string | null
          check_in_at?: string
          check_in_method?: Database["public"]["Enums"]["check_in_method"]
          check_out_at?: string | null
          checked_in_by?: string | null
          checked_out_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          pickup_request_id?: string | null
          student_id: string
        }
        Update: {
          branch_id?: string | null
          check_in_at?: string
          check_in_method?: Database["public"]["Enums"]["check_in_method"]
          check_out_at?: string | null
          checked_in_by?: string | null
          checked_out_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          pickup_request_id?: string | null
          student_id?: string
        }
        Relationships: []
      }
      badges: {
        Row: {
          badge_number: string
          created_at: string
          id: string
          notes: string | null
          status: Database["public"]["Enums"]["badge_status"]
        }
        Insert: {
          badge_number: string
          created_at?: string
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["badge_status"]
        }
        Update: {
          badge_number?: string
          created_at?: string
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["badge_status"]
        }
        Relationships: []
      }
      blacklist: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          id: string
          reason: string
          visitor_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          reason: string
          visitor_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          reason?: string
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blacklist_visitor_id_fkey"
            columns: ["visitor_id"]
            isOneToOne: false
            referencedRelation: "visitors"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          created_at: string
          id: string
          location: string | null
          name: string
          site_type: Database["public"]["Enums"]["site_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          location?: string | null
          name: string
          site_type?: Database["public"]["Enums"]["site_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          location?: string | null
          name?: string
          site_type?: Database["public"]["Enums"]["site_type"]
          updated_at?: string
        }
        Relationships: []
      }
      guardians: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          phone: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          read: boolean
          recipient_id: string
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          visit_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          read?: boolean
          recipient_id: string
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          visit_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          read?: boolean
          recipient_id?: string
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          visit_id?: string | null
        }
        Relationships: []
      }
      organization_settings: {
        Row: {
          id: string
          office_name: string
          updated_at: string
        }
        Insert: {
          id?: string
          office_name?: string
          updated_at?: string
        }
        Update: {
          id?: string
          office_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      pickup_requests: {
        Row: {
          branch_id: string | null
          created_at: string
          guardian_id: string | null
          id: string
          pickup_person_name: string
          pickup_person_phone: string | null
          pickup_person_photo_url: string | null
          rejection_reason: string | null
          requested_at: string
          requested_by: string | null
          responded_at: string | null
          status: Database["public"]["Enums"]["pickup_status"]
          student_id: string
          updated_at: string
          vehicle_plate: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          guardian_id?: string | null
          id?: string
          pickup_person_name: string
          pickup_person_phone?: string | null
          pickup_person_photo_url?: string | null
          rejection_reason?: string | null
          requested_at?: string
          requested_by?: string | null
          responded_at?: string | null
          status?: Database["public"]["Enums"]["pickup_status"]
          student_id: string
          updated_at?: string
          vehicle_plate?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          guardian_id?: string | null
          id?: string
          pickup_person_name?: string
          pickup_person_phone?: string | null
          pickup_person_photo_url?: string | null
          rejection_reason?: string | null
          requested_at?: string
          requested_by?: string | null
          responded_at?: string | null
          status?: Database["public"]["Enums"]["pickup_status"]
          student_id?: string
          updated_at?: string
          vehicle_plate?: string | null
        }
        Relationships: []
      }
      pickup_response_tokens: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          pickup_request_id: string
          reason: string | null
          response: string | null
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          pickup_request_id: string
          reason?: string | null
          response?: string | null
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          pickup_request_id?: string
          reason?: string | null
          response?: string | null
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          branch_id: string | null
          created_at: string
          department: string | null
          email: string
          full_name: string
          id: string
          is_active: boolean
          phone: string | null
          position: string | null
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          department?: string | null
          email: string
          full_name: string
          id: string
          is_active?: boolean
          phone?: string | null
          position?: string | null
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          department?: string | null
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          phone?: string | null
          position?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      student_guardians: {
        Row: {
          created_at: string
          guardian_id: string
          id: string
          is_primary: boolean
          relation: string | null
          student_id: string
        }
        Insert: {
          created_at?: string
          guardian_id: string
          id?: string
          is_primary?: boolean
          relation?: string | null
          student_id: string
        }
        Update: {
          created_at?: string
          guardian_id?: string
          id?: string
          is_primary?: boolean
          relation?: string | null
          student_id?: string
        }
        Relationships: []
      }
      students: {
        Row: {
          branch_id: string | null
          class: string | null
          created_at: string
          full_name: string
          id: string
          is_active: boolean
          photo_url: string | null
          student_code: string | null
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          class?: string | null
          created_at?: string
          full_name: string
          id?: string
          is_active?: boolean
          photo_url?: string | null
          student_code?: string | null
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          class?: string | null
          created_at?: string
          full_name?: string
          id?: string
          is_active?: boolean
          photo_url?: string | null
          student_code?: string | null
          updated_at?: string
        }
        Relationships: []
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
      visit_assets: {
        Row: {
          brand: string | null
          created_at: string
          description: string | null
          id: string
          kind: Database["public"]["Enums"]["asset_kind"]
          serial: string | null
          visit_id: string
        }
        Insert: {
          brand?: string | null
          created_at?: string
          description?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["asset_kind"]
          serial?: string | null
          visit_id: string
        }
        Update: {
          brand?: string | null
          created_at?: string
          description?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["asset_kind"]
          serial?: string | null
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visit_assets_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      visit_response_tokens: {
        Row: {
          created_at: string
          id: string
          reason: string | null
          response: string | null
          token: string
          used_at: string | null
          visit_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reason?: string | null
          response?: string | null
          token: string
          used_at?: string | null
          visit_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string | null
          response?: string | null
          token?: string
          used_at?: string | null
          visit_id?: string
        }
        Relationships: []
      }
      visitors: {
        Row: {
          company: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          id_number: string | null
          id_scan_url: string | null
          id_type: string | null
          phone: string
          updated_at: string
        }
        Insert: {
          company?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          id_number?: string | null
          id_scan_url?: string | null
          id_type?: string | null
          phone: string
          updated_at?: string
        }
        Update: {
          company?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          id_number?: string | null
          id_scan_url?: string | null
          id_type?: string | null
          phone?: string
          updated_at?: string
        }
        Relationships: []
      }
      visits: {
        Row: {
          approval: Database["public"]["Enums"]["approval_status"]
          assets_verified: boolean
          badge_number: string | null
          badge_returned: boolean
          branch_id: string | null
          check_in_at: string | null
          check_out_at: string | null
          checkout_notes: string | null
          company: string | null
          created_at: string
          created_by: string | null
          expected_duration_minutes: number
          feedback: string | null
          host_id: string | null
          id: string
          overstay_notified_at: string | null
          pre_registered: boolean
          purpose: string
          rejection_reason: string | null
          status: Database["public"]["Enums"]["visit_status"]
          stay_extended_count: number
          updated_at: string
          vehicle_plate: string | null
          vehicle_type: string | null
          visit_mode: Database["public"]["Enums"]["visit_mode"]
          visit_type: Database["public"]["Enums"]["visit_type"]
          visitor_id: string
          work_description: string | null
        }
        Insert: {
          approval?: Database["public"]["Enums"]["approval_status"]
          assets_verified?: boolean
          badge_number?: string | null
          badge_returned?: boolean
          branch_id?: string | null
          check_in_at?: string | null
          check_out_at?: string | null
          checkout_notes?: string | null
          company?: string | null
          created_at?: string
          created_by?: string | null
          expected_duration_minutes?: number
          feedback?: string | null
          host_id?: string | null
          id?: string
          overstay_notified_at?: string | null
          pre_registered?: boolean
          purpose: string
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["visit_status"]
          stay_extended_count?: number
          updated_at?: string
          vehicle_plate?: string | null
          vehicle_type?: string | null
          visit_mode?: Database["public"]["Enums"]["visit_mode"]
          visit_type?: Database["public"]["Enums"]["visit_type"]
          visitor_id: string
          work_description?: string | null
        }
        Update: {
          approval?: Database["public"]["Enums"]["approval_status"]
          assets_verified?: boolean
          badge_number?: string | null
          badge_returned?: boolean
          branch_id?: string | null
          check_in_at?: string | null
          check_out_at?: string | null
          checkout_notes?: string | null
          company?: string | null
          created_at?: string
          created_by?: string | null
          expected_duration_minutes?: number
          feedback?: string | null
          host_id?: string | null
          id?: string
          overstay_notified_at?: string | null
          pre_registered?: boolean
          purpose?: string
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["visit_status"]
          stay_extended_count?: number
          updated_at?: string
          vehicle_plate?: string | null
          vehicle_type?: string | null
          visit_mode?: Database["public"]["Enums"]["visit_mode"]
          visit_type?: Database["public"]["Enums"]["visit_type"]
          visitor_id?: string
          work_description?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visits_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_visitor_id_fkey"
            columns: ["visitor_id"]
            isOneToOne: false
            referencedRelation: "visitors"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      scan_overstays: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role:
        | "admin"
        | "receptionist"
        | "host"
        | "security"
        | "register_guest"
        | "pre_register_guest"
        | "manage_staff"
        | "manage_branches"
        | "manage_blacklist"
        | "view_all_branches"
        | "view_reports"
        | "approve_own_visits"
        | "reject_own_visits"
        | "extend_own_visits"
        | "register_contractor"
        | "register_delivery"
        | "checkout_visitor"
        | "manage_badges"
        | "pre_register_contractor"
        | "pre_register_delivery"
        | "school_admin"
        | "teacher"
        | "gate_officer"
        | "guardian"
        | "manage_students"
        | "check_in_student"
        | "approve_pickup"
        | "view_student_reports"
      approval_status:
        | "not_required"
        | "pending"
        | "approved"
        | "not_approved"
        | "confirmed"
      asset_kind: "laptop" | "device" | "other"
      badge_status: "available" | "issued" | "unreturned" | "retired"
      check_in_method: "van" | "parent" | "walking" | "other"
      notification_type:
        | "visit_arrived"
        | "visit_pre_registered"
        | "visit_checked_out"
        | "visit_approved"
        | "visit_rejected"
        | "overstay"
        | "visit_response"
        | "staff_credentials"
        | "student_arrival"
        | "pickup_approval_request"
        | "pickup_approved"
        | "pickup_rejected"
      pickup_status: "pending" | "approved" | "rejected" | "expired"
      site_type: "corporate" | "school"
      visit_mode: "walk_in" | "drive_in"
      visit_status: "pending" | "checked_in" | "checked_out" | "overstayed"
      visit_type: "supplier" | "contractor" | "guest" | "delivery"
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
      app_role: [
        "admin",
        "receptionist",
        "host",
        "security",
        "register_guest",
        "pre_register_guest",
        "manage_staff",
        "manage_branches",
        "manage_blacklist",
        "view_all_branches",
        "view_reports",
        "approve_own_visits",
        "reject_own_visits",
        "extend_own_visits",
        "register_contractor",
        "register_delivery",
        "checkout_visitor",
        "manage_badges",
        "pre_register_contractor",
        "pre_register_delivery",
        "school_admin",
        "teacher",
        "gate_officer",
        "guardian",
        "manage_students",
        "check_in_student",
        "approve_pickup",
        "view_student_reports",
      ],
      approval_status: [
        "not_required",
        "pending",
        "approved",
        "not_approved",
        "confirmed",
      ],
      asset_kind: ["laptop", "device", "other"],
      badge_status: ["available", "issued", "unreturned", "retired"],
      check_in_method: ["van", "parent", "walking", "other"],
      notification_type: [
        "visit_arrived",
        "visit_pre_registered",
        "visit_checked_out",
        "visit_approved",
        "visit_rejected",
        "overstay",
        "visit_response",
        "staff_credentials",
        "student_arrival",
        "pickup_approval_request",
        "pickup_approved",
        "pickup_rejected",
      ],
      pickup_status: ["pending", "approved", "rejected", "expired"],
      site_type: ["corporate", "school"],
      visit_mode: ["walk_in", "drive_in"],
      visit_status: ["pending", "checked_in", "checked_out", "overstayed"],
      visit_type: ["supplier", "contractor", "guest", "delivery"],
    },
  },
} as const
