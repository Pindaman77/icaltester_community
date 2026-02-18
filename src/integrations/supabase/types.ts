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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action: string
          actor_user_id: string
          created_at: string
          id: string
          meta: Json
          target_user_id: string | null
        }
        Insert: {
          action: string
          actor_user_id: string
          created_at?: string
          id?: string
          meta?: Json
          target_user_id?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string
          created_at?: string
          id?: string
          meta?: Json
          target_user_id?: string | null
        }
        Relationships: []
      }
      bookings: {
        Row: {
          calendar_id: string
          created_at: string
          end_date: string
          id: string
          source: string
          start_date: string
          status: string
          summary: string
          uid: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          calendar_id: string
          created_at?: string
          end_date: string
          id?: string
          source?: string
          start_date: string
          status?: string
          summary: string
          uid: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          calendar_id?: string
          created_at?: string
          end_date?: string
          id?: string
          source?: string
          start_date?: string
          status?: string
          summary?: string
          uid?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_calendar_id_fkey"
            columns: ["calendar_id"]
            isOneToOne: false
            referencedRelation: "calendars"
            referencedColumns: ["id"]
          },
        ]
      }
      calendars: {
        Row: {
          created_at: string
          default_booking_status: string
          feed_token: string
          feed_token_hash: string
          id: string
          include_imported_in_export: boolean
          name: string
          poll_interval_minutes: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          default_booking_status?: string
          feed_token?: string
          feed_token_hash: string
          id?: string
          include_imported_in_export?: boolean
          name: string
          poll_interval_minutes?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          default_booking_status?: string
          feed_token?: string
          feed_token_hash?: string
          id?: string
          include_imported_in_export?: boolean
          name?: string
          poll_interval_minutes?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      feed_access_audit: {
        Row: {
          accessed_at: string
          id: string
          ip: string | null
          is_rate_limited: boolean
          status_code: number | null
          token_hash_prefix: string | null
        }
        Insert: {
          accessed_at?: string
          id?: string
          ip?: string | null
          is_rate_limited?: boolean
          status_code?: number | null
          token_hash_prefix?: string | null
        }
        Update: {
          accessed_at?: string
          id?: string
          ip?: string | null
          is_rate_limited?: boolean
          status_code?: number | null
          token_hash_prefix?: string | null
        }
        Relationships: []
      }
      feed_rate_limits: {
        Row: {
          count: number
          token_hash: string
          window_start: string
        }
        Insert: {
          count?: number
          token_hash: string
          window_start: string
        }
        Update: {
          count?: number
          token_hash?: string
          window_start?: string
        }
        Relationships: []
      }
      ics_cron_settings: {
        Row: {
          cron_secret: string
          id: number
          updated_at: string
        }
        Insert: {
          cron_secret: string
          id?: number
          updated_at?: string
        }
        Update: {
          cron_secret?: string
          id?: number
          updated_at?: string
        }
        Relationships: []
      }
      imported_events: {
        Row: {
          calendar_id: string
          end_date: string
          id: string
          source_uid: string
          start_date: string
          status: string
          subscription_id: string
          summary: string
          updated_at: string
          user_id: string
        }
        Insert: {
          calendar_id: string
          end_date: string
          id?: string
          source_uid: string
          start_date: string
          status?: string
          subscription_id: string
          summary?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          calendar_id?: string
          end_date?: string
          id?: string
          source_uid?: string
          start_date?: string
          status?: string
          subscription_id?: string
          summary?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "imported_events_calendar_id_fkey"
            columns: ["calendar_id"]
            isOneToOne: false
            referencedRelation: "calendars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "imported_events_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          calendar_id: string
          created_at: string
          enabled: boolean
          ical_url: string
          id: string
          last_error: string | null
          last_status: number | null
          last_synced_at: string | null
          name: string
          next_due_at: string
          poll_interval_sec: number
          user_id: string | null
        }
        Insert: {
          calendar_id: string
          created_at?: string
          enabled?: boolean
          ical_url: string
          id?: string
          last_error?: string | null
          last_status?: number | null
          last_synced_at?: string | null
          name: string
          next_due_at?: string
          poll_interval_sec?: number
          user_id?: string | null
        }
        Update: {
          calendar_id?: string
          created_at?: string
          enabled?: boolean
          ical_url?: string
          id?: string
          last_error?: string | null
          last_status?: number | null
          last_synced_at?: string | null
          name?: string
          next_due_at?: string
          poll_interval_sec?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_calendar_id_fkey"
            columns: ["calendar_id"]
            isOneToOne: false
            referencedRelation: "calendars"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_logs: {
        Row: {
          bytes: number | null
          calendar_id: string
          created_at: string
          direction: string
          events_added: number
          events_removed: number
          events_updated: number
          http_status: number | null
          id: string
          message: string | null
          ran_at: string
          status: string
          subscription_id: string | null
          user_id: string | null
          vevent_count: number | null
        }
        Insert: {
          bytes?: number | null
          calendar_id: string
          created_at?: string
          direction: string
          events_added?: number
          events_removed?: number
          events_updated?: number
          http_status?: number | null
          id?: string
          message?: string | null
          ran_at?: string
          status: string
          subscription_id?: string | null
          user_id?: string | null
          vevent_count?: number | null
        }
        Update: {
          bytes?: number | null
          calendar_id?: string
          created_at?: string
          direction?: string
          events_added?: number
          events_removed?: number
          events_updated?: number
          http_status?: number | null
          id?: string
          message?: string | null
          ran_at?: string
          status?: string
          subscription_id?: string | null
          user_id?: string | null
          vevent_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sync_logs_calendar_id_fkey"
            columns: ["calendar_id"]
            isOneToOne: false
            referencedRelation: "calendars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sync_logs_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_audit: {
        Args: { p_action: string; p_meta?: Json; p_target_user_id?: string }
        Returns: undefined
      }
      cleanup_old_feed_rate_limits: { Args: never; Returns: undefined }
      generate_feed_token: { Args: never; Returns: string }
      increment_feed_rate_limit: {
        Args: { p_token_hash: string; p_window_start: string }
        Returns: number
      }
      is_admin: { Args: { p_uid?: string }; Returns: boolean }
      rotate_ics_cron_secret: {
        Args: { p_cron_secret: string; p_function_url: string }
        Returns: undefined
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      app_role: "admin" | "tester"
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
      app_role: ["admin", "tester"],
    },
  },
} as const
