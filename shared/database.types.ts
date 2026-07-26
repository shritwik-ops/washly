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
      admin_action_log: {
        Row: {
          action: string
          admin_id: string | null
          created_at: string
          detail: Json | null
          id: number
          role: string
          target_id: string | null
          target_table: string | null
        }
        Insert: {
          action: string
          admin_id?: string | null
          created_at?: string
          detail?: Json | null
          id?: never
          role: string
          target_id?: string | null
          target_table?: string | null
        }
        Update: {
          action?: string
          admin_id?: string | null
          created_at?: string
          detail?: Json | null
          id?: never
          role?: string
          target_id?: string | null
          target_table?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_action_log_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_users: {
        Row: {
          college_id: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          is_active: boolean
          role: string
        }
        Insert: {
          college_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          is_active?: boolean
          role: string
        }
        Update: {
          college_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
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
      college_data_visibility: {
        Row: {
          college_id: string
          created_at: string
          id: string
          machine_status_visible: boolean
          revenue_visible: boolean
          student_roster_visible: boolean
          support_tickets_visible: boolean
          updated_at: string
          wash_volume_visible: boolean
        }
        Insert: {
          college_id: string
          created_at?: string
          id?: string
          machine_status_visible?: boolean
          revenue_visible?: boolean
          student_roster_visible?: boolean
          support_tickets_visible?: boolean
          updated_at?: string
          wash_volume_visible?: boolean
        }
        Update: {
          college_id?: string
          created_at?: string
          id?: string
          machine_status_visible?: boolean
          revenue_visible?: boolean
          student_roster_visible?: boolean
          support_tickets_visible?: boolean
          updated_at?: string
          wash_volume_visible?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "college_data_visibility_college_id_fkey"
            columns: ["college_id"]
            isOneToOne: true
            referencedRelation: "colleges"
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
          simulate_relay_failure: boolean
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
          simulate_relay_failure?: boolean
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
          simulate_relay_failure?: boolean
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
      notifications_log: {
        Row: {
          body: string
          created_at: string
          id: string
          read_at: string | null
          related_booking_id: string | null
          student_id: string
          title: string
          type: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          read_at?: string | null
          related_booking_id?: string | null
          student_id: string
          title: string
          type: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          read_at?: string | null
          related_booking_id?: string | null
          student_id?: string
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_log_related_booking_id_fkey"
            columns: ["related_booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_log_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
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
      referrals: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          referred_id: string
          referrer_id: string
          reward_credited_at: string | null
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          referred_id: string
          referrer_id: string
          reward_credited_at?: string | null
          status?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          referred_id?: string
          referrer_id?: string
          reward_credited_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_referred_id_fkey"
            columns: ["referred_id"]
            isOneToOne: true
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
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
          notify_flash_slots: boolean
          phone: string
          prewash_checklist_count: number
          referral_code: string | null
          referred_by: string | null
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
          notify_flash_slots?: boolean
          phone: string
          prewash_checklist_count?: number
          referral_code?: string | null
          referred_by?: string | null
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
          notify_flash_slots?: boolean
          phone?: string
          prewash_checklist_count?: number
          referral_code?: string | null
          referred_by?: string | null
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
          {
            foreignKeyName: "students_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string
          id: string
          renews_at: string
          starts_at: string
          status: string
          student_id: string
          tier: string
          wash_allowance: number
          washes_used: number
        }
        Insert: {
          created_at?: string
          id?: string
          renews_at: string
          starts_at?: string
          status?: string
          student_id: string
          tier: string
          wash_allowance: number
          washes_used?: number
        }
        Update: {
          created_at?: string
          id?: string
          renews_at?: string
          starts_at?: string
          status?: string
          student_id?: string
          tier?: string
          wash_allowance?: number
          washes_used?: number
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          category: string
          college_id: string
          created_at: string
          description: string
          escalated_to_super_admin: boolean
          id: string
          photo_path: string | null
          routed_to: string
          status: string
          student_id: string
          updated_at: string
        }
        Insert: {
          category: string
          college_id: string
          created_at?: string
          description: string
          escalated_to_super_admin?: boolean
          id?: string
          photo_path?: string | null
          routed_to: string
          status?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          category?: string
          college_id?: string
          created_at?: string
          description?: string
          escalated_to_super_admin?: boolean
          id?: string
          photo_path?: string | null
          routed_to?: string
          status?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_college_id_fkey"
            columns: ["college_id"]
            isOneToOne: false
            referencedRelation: "colleges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_replies: {
        Row: {
          author_id: string
          author_type: string
          body: string
          created_at: string
          id: string
          ticket_id: string
        }
        Insert: {
          author_id: string
          author_type: string
          body: string
          created_at?: string
          id?: string
          ticket_id: string
        }
        Update: {
          author_id?: string
          author_type?: string
          body?: string
          created_at?: string
          id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_replies_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
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
          total_amount: number | null
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
          total_amount?: number | null
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
          total_amount?: number | null
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
      add_ticket_reply: {
        Args: { p_body: string; p_ticket_id: string }
        Returns: {
          author_id: string
          author_type: string
          body: string
          created_at: string
          id: string
          ticket_id: string
        }
        SetofOptions: {
          from: "*"
          to: "ticket_replies"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_college_id: { Args: never; Returns: string }
      admin_role: { Args: never; Returns: string }
      charge_wallet_and_gateway: {
        Args: {
          p_amount: number
          p_booking_id: string
          p_description: string
          p_payment_method: string
          p_student_id: string
          p_type: string
          p_wallet_portion: number
        }
        Returns: undefined
      }
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
      college_data_visible: {
        Args: { p_category: string; p_college_id: string }
        Returns: boolean
      }
      complete_finished_washes: { Args: never; Returns: undefined }
      create_booking: {
        Args: {
          p_machine_id: string
          p_payment_method: string
          p_slot_start: string
          p_wallet_portion?: number
        }
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
      create_support_ticket: {
        Args: {
          p_category: string
          p_description: string
          p_photo_path?: string
        }
        Returns: {
          category: string
          college_id: string
          created_at: string
          description: string
          escalated_to_super_admin: boolean
          id: string
          photo_path: string | null
          routed_to: string
          status: string
          student_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "support_tickets"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      expire_overdue_bookings: { Args: never; Returns: undefined }
      generate_referral_code: { Args: never; Returns: string }
      is_finance_admin: { Args: never; Returns: boolean }
      is_operations_admin: { Args: never; Returns: boolean }
      is_platform_admin: { Args: never; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      is_support_admin: { Args: never; Returns: boolean }
      log_admin_action: {
        Args: {
          p_action: string
          p_detail?: Json
          p_target_id?: string
          p_target_table?: string
        }
        Returns: undefined
      }
      notify_student: {
        Args: {
          p_body: string
          p_related_booking_id?: string
          p_student_id: string
          p_title: string
          p_type: string
        }
        Returns: undefined
      }
      recharge_wallet: {
        Args: { p_amount: number; p_payment_method: string }
        Returns: {
          amount: number
          booking_id: string | null
          created_at: string
          description: string | null
          gateway_reference: string | null
          id: string
          payment_method: string | null
          student_id: string
          total_amount: number | null
          type: string
          wallet_portion: number | null
        }
        SetofOptions: {
          from: "*"
          to: "wallet_transactions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      resolve_referral_code: { Args: { p_code: string }; Returns: string }
      revert_expired_flash_slots: { Args: never; Returns: undefined }
      run_booking_scheduler: { Args: never; Returns: undefined }
      start_booking: {
        Args: {
          p_booking_id: string
          p_payment_method?: string
          p_wallet_portion?: number
        }
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
      start_instant_wash: {
        Args: {
          p_machine_id: string
          p_payment_method: string
          p_wallet_portion?: number
        }
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

