export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      admin_users: {
        Row: {
          college_id: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          role: string
        }
        Insert: {
          college_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          role: string
        }
        Update: {
          college_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_users_college_id_fkey"
            columns: ["college_id"]
            isOneToOne: false
            referencedRelation: "colleges"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          booking_fee: number
          booking_type: string
          created_at: string
          expired_at: string | null
          fee_applied_to_wash: boolean
          id: string
          machine_id: string
          no_show: boolean
          slot_end: string
          slot_start: string
          start_deadline: string
          started_at: string | null
          status: string
          student_id: string
          updated_at: string
        }
        Insert: {
          booking_fee: number
          booking_type?: string
          created_at?: string
          expired_at?: string | null
          fee_applied_to_wash?: boolean
          id?: string
          machine_id: string
          no_show?: boolean
          slot_end: string
          slot_start: string
          start_deadline: string
          started_at?: string | null
          status?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          booking_fee?: number
          booking_type?: string
          created_at?: string
          expired_at?: string | null
          fee_applied_to_wash?: boolean
          id?: string
          machine_id?: string
          no_show?: boolean
          slot_end?: string
          slot_start?: string
          start_deadline?: string
          started_at?: string | null
          status?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      college_leads: {
        Row: {
          city: string | null
          college_name: string
          contact_phone: string
          created_at: string
          id: string
        }
        Insert: {
          city?: string | null
          college_name: string
          contact_phone: string
          created_at?: string
          id?: string
        }
        Update: {
          city?: string | null
          college_name?: string
          contact_phone?: string
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      colleges: {
        Row: {
          city: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          city?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          city?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      flash_slots: {
        Row: {
          claimed_booking_id: string | null
          created_at: string
          expires_at: string
          id: string
          machine_id: string
          opens_at: string
          original_booking_id: string
          price: number
          status: string
          updated_at: string
        }
        Insert: {
          claimed_booking_id?: string | null
          created_at?: string
          expires_at: string
          id?: string
          machine_id: string
          opens_at?: string
          original_booking_id: string
          price: number
          status?: string
          updated_at?: string
        }
        Update: {
          claimed_booking_id?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          machine_id?: string
          opens_at?: string
          original_booking_id?: string
          price?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "flash_slots_claimed_booking_id_fkey"
            columns: ["claimed_booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flash_slots_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flash_slots_original_booking_id_fkey"
            columns: ["original_booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      hostels: {
        Row: {
          college_id: string
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          college_id: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          college_id?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hostels_college_id_fkey"
            columns: ["college_id"]
            isOneToOne: false
            referencedRelation: "colleges"
            referencedColumns: ["id"]
          },
        ]
      }
      machines: {
        Row: {
          busy_until: string | null
          created_at: string
          hostel_id: string
          id: string
          label: string
          status: string
          status_updated_at: string
          updated_at: string
        }
        Insert: {
          busy_until?: string | null
          created_at?: string
          hostel_id: string
          id?: string
          label: string
          status?: string
          status_updated_at?: string
          updated_at?: string
        }
        Update: {
          busy_until?: string | null
          created_at?: string
          hostel_id?: string
          id?: string
          label?: string
          status?: string
          status_updated_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "machines_hostel_id_fkey"
            columns: ["hostel_id"]
            isOneToOne: false
            referencedRelation: "hostels"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_config: {
        Row: {
          created_at: string
          created_by: string | null
          effective_from: string
          effective_to: string | null
          id: string
          key: string
          value: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          key: string
          value: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          key?: string
          value?: number
        }
        Relationships: []
      }
      students: {
        Row: {
          account_status: string
          college_id: string
          created_at: string
          full_name: string | null
          hostel_id: string
          id: string
          id_image_url: string | null
          id_rejection_reason: string | null
          id_verification_status: string
          no_show_count: number
          phone: string
          roll_number: string | null
          updated_at: string
        }
        Insert: {
          account_status?: string
          college_id: string
          created_at?: string
          full_name?: string | null
          hostel_id: string
          id: string
          id_image_url?: string | null
          id_rejection_reason?: string | null
          id_verification_status?: string
          no_show_count?: number
          phone: string
          roll_number?: string | null
          updated_at?: string
        }
        Update: {
          account_status?: string
          college_id?: string
          created_at?: string
          full_name?: string | null
          hostel_id?: string
          id?: string
          id_image_url?: string | null
          id_rejection_reason?: string | null
          id_verification_status?: string
          no_show_count?: number
          phone?: string
          roll_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_college_id_fkey"
            columns: ["college_id"]
            isOneToOne: false
            referencedRelation: "colleges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_hostel_id_fkey"
            columns: ["hostel_id"]
            isOneToOne: false
            referencedRelation: "hostels"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_transactions: {
        Row: {
          amount: number
          booking_id: string | null
          created_at: string
          description: string | null
          gateway_reference: string | null
          id: string
          payment_method: string | null
          student_id: string
          type: string
          wallet_portion: number | null
        }
        Insert: {
          amount: number
          booking_id?: string | null
          created_at?: string
          description?: string | null
          gateway_reference?: string | null
          id?: string
          payment_method?: string | null
          student_id: string
          type: string
          wallet_portion?: number | null
        }
        Update: {
          amount?: number
          booking_id?: string | null
          created_at?: string
          description?: string | null
          gateway_reference?: string | null
          id?: string
          payment_method?: string | null
          student_id?: string
          type?: string
          wallet_portion?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_transactions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      wallet_balances: {
        Row: {
          balance: number | null
          student_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      admin_college_id: { Args: never; Returns: string }
      claim_flash_slot: {
        Args: { p_flash_slot_id: string }
        Returns: {
          booking_fee: number
          booking_type: string
          created_at: string
          expired_at: string | null
          fee_applied_to_wash: boolean
          id: string
          machine_id: string
          no_show: boolean
          slot_end: string
          slot_start: string
          start_deadline: string
          started_at: string | null
          status: string
          student_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_booking: {
        Args: { p_machine_id: string; p_slot_start: string }
        Returns: {
          booking_fee: number
          booking_type: string
          created_at: string
          expired_at: string | null
          fee_applied_to_wash: boolean
          id: string
          machine_id: string
          no_show: boolean
          slot_end: string
          slot_start: string
          start_deadline: string
          started_at: string | null
          status: string
          student_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      expire_overdue_bookings: { Args: never; Returns: undefined }
      is_super_admin: { Args: never; Returns: boolean }
      revert_expired_flash_slots: { Args: never; Returns: undefined }
      run_booking_scheduler: { Args: never; Returns: undefined }
      start_booking: {
        Args: { p_booking_id: string }
        Returns: {
          booking_fee: number
          booking_type: string
          created_at: string
          expired_at: string | null
          fee_applied_to_wash: boolean
          id: string
          machine_id: string
          no_show: boolean
          slot_end: string
          slot_start: string
          start_deadline: string
          started_at: string | null
          status: string
          student_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      [_ in never]: never
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

