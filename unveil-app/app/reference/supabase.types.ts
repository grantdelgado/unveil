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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      event_guests: {
        Row: {
          a2p_notice_sent_at: string | null
          carrier_opted_out_at: string | null
          created_at: string | null
          decline_reason: string | null
          declined_at: string | null
          display_name: string | null
          event_id: string
          first_invited_at: string | null
          guest_name: string | null
          guest_tags: string[] | null
          id: string
          invite_attempts: number | null
          invited_at: string | null
          joined_at: string | null
          last_invited_at: string | null
          last_messaged_at: string | null
          notes: string | null
          phone: string | null
          phone_number_verified: boolean | null
          preferred_communication: string | null
          removed_at: string | null
          role: string
          sms_opt_out: boolean | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          a2p_notice_sent_at?: string | null
          carrier_opted_out_at?: string | null
          created_at?: string | null
          decline_reason?: string | null
          declined_at?: string | null
          display_name?: string | null
          event_id: string
          first_invited_at?: string | null
          guest_name?: string | null
          guest_tags?: string[] | null
          id?: string
          invite_attempts?: number | null
          invited_at?: string | null
          joined_at?: string | null
          last_invited_at?: string | null
          last_messaged_at?: string | null
          notes?: string | null
          phone?: string | null
          phone_number_verified?: boolean | null
          preferred_communication?: string | null
          removed_at?: string | null
          role?: string
          sms_opt_out?: boolean | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          a2p_notice_sent_at?: string | null
          carrier_opted_out_at?: string | null
          created_at?: string | null
          decline_reason?: string | null
          declined_at?: string | null
          display_name?: string | null
          event_id?: string
          first_invited_at?: string | null
          guest_name?: string | null
          guest_tags?: string[] | null
          id?: string
          invite_attempts?: number | null
          invited_at?: string | null
          joined_at?: string | null
          last_invited_at?: string | null
          last_messaged_at?: string | null
          notes?: string | null
          phone?: string | null
          phone_number_verified?: boolean | null
          preferred_communication?: string | null
          removed_at?: string | null
          role?: string
          sms_opt_out?: boolean | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_guests_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_guests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      event_schedule_items: {
        Row: {
          attire: string | null
          created_at: string | null
          end_at: string | null
          event_id: string
          id: string
          location: string | null
          start_at: string
          title: string
          updated_at: string | null
        }
        Insert: {
          attire?: string | null
          created_at?: string | null
          end_at?: string | null
          event_id: string
          id?: string
          location?: string | null
          start_at: string
          title: string
          updated_at?: string | null
        }
        Update: {
          attire?: string | null
          created_at?: string | null
          end_at?: string | null
          event_id?: string
          id?: string
          location?: string | null
          start_at?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_schedule_items_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          allow_open_signup: boolean
          created_at: string | null
          creation_key: string | null
          description: string | null
          event_date: string
          header_image_url: string | null
          host_user_id: string
          id: string
          is_public: boolean | null
          location: string | null
          photo_album_url: string | null
          sms_tag: string | null
          start_time: string | null
          time_zone: string | null
          title: string
          updated_at: string | null
          website_url: string | null
        }
        Insert: {
          allow_open_signup?: boolean
          created_at?: string | null
          creation_key?: string | null
          description?: string | null
          event_date: string
          header_image_url?: string | null
          host_user_id: string
          id?: string
          is_public?: boolean | null
          location?: string | null
          photo_album_url?: string | null
          sms_tag?: string | null
          start_time?: string | null
          time_zone?: string | null
          title: string
          updated_at?: string | null
          website_url?: string | null
        }
        Update: {
          allow_open_signup?: boolean
          created_at?: string | null
          creation_key?: string | null
          description?: string | null
          event_date?: string
          header_image_url?: string | null
          host_user_id?: string
          id?: string
          is_public?: boolean | null
          location?: string | null
          photo_album_url?: string | null
          sms_tag?: string | null
          start_time?: string | null
          time_zone?: string | null
          title?: string
          updated_at?: string | null
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_host_user_id_fkey"
            columns: ["host_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      media: {
        Row: {
          caption: string | null
          created_at: string | null
          event_id: string
          id: string
          media_type: string
          storage_path: string
          uploader_user_id: string | null
        }
        Insert: {
          caption?: string | null
          created_at?: string | null
          event_id: string
          id?: string
          media_type: string
          storage_path: string
          uploader_user_id?: string | null
        }
        Update: {
          caption?: string | null
          created_at?: string | null
          event_id?: string
          id?: string
          media_type?: string
          storage_path?: string
          uploader_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "media_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_uploader_user_id_fkey"
            columns: ["uploader_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      message_deliveries: {
        Row: {
          created_at: string | null
          guest_id: string | null
          has_responded: boolean | null
          id: string
          message_id: string
          phone_number: string | null
          push_provider_id: string | null
          push_status: string | null
          response_message_id: string | null
          scheduled_message_id: string | null
          sms_provider_id: string | null
          sms_status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          guest_id?: string | null
          has_responded?: boolean | null
          id?: string
          message_id: string
          phone_number?: string | null
          push_provider_id?: string | null
          push_status?: string | null
          response_message_id?: string | null
          scheduled_message_id?: string | null
          sms_provider_id?: string | null
          sms_status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          guest_id?: string | null
          has_responded?: boolean | null
          id?: string
          message_id?: string
          phone_number?: string | null
          push_provider_id?: string | null
          push_status?: string | null
          response_message_id?: string | null
          scheduled_message_id?: string | null
          sms_provider_id?: string | null
          sms_status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_deliveries_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "event_guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_deliveries_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_deliveries_response_message_id_fkey"
            columns: ["response_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_deliveries_scheduled_message_id_fkey"
            columns: ["scheduled_message_id"]
            isOneToOne: false
            referencedRelation: "scheduled_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_deliveries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          created_at: string | null
          delivered_at: string | null
          delivered_count: number | null
          event_id: string
          failed_count: number | null
          id: string
          message_type: Database["public"]["Enums"]["message_type_enum"] | null
          scheduled_message_id: string | null
          sender_user_id: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          delivered_at?: string | null
          delivered_count?: number | null
          event_id: string
          failed_count?: number | null
          id?: string
          message_type?: Database["public"]["Enums"]["message_type_enum"] | null
          scheduled_message_id?: string | null
          sender_user_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          delivered_at?: string | null
          delivered_count?: number | null
          event_id?: string
          failed_count?: number | null
          id?: string
          message_type?: Database["public"]["Enums"]["message_type_enum"] | null
          scheduled_message_id?: string | null
          sender_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_scheduled_message_id_fkey"
            columns: ["scheduled_message_id"]
            isOneToOne: false
            referencedRelation: "scheduled_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_user_id_fkey"
            columns: ["sender_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      rum_events: {
        Row: {
          build_id: string | null
          device: string
          id: number
          metric: string
          route: string
          ts: string
          value: number
        }
        Insert: {
          build_id?: string | null
          device: string
          id?: number
          metric: string
          route: string
          ts?: string
          value: number
        }
        Update: {
          build_id?: string | null
          device?: string
          id?: number
          metric?: string
          route?: string
          ts?: string
          value?: number
        }
        Relationships: []
      }
      scheduled_messages: {
        Row: {
          content: string
          created_at: string | null
          event_id: string
          failure_count: number | null
          id: string
          idempotency_key: string | null
          message_type: Database["public"]["Enums"]["message_type_enum"] | null
          modification_count: number | null
          modified_at: string | null
          recipient_count: number | null
          recipient_snapshot: Json | null
          scheduled_local: string | null
          scheduled_tz: string | null
          send_at: string
          send_via_push: boolean | null
          send_via_sms: boolean | null
          sender_user_id: string
          sent_at: string | null
          status: string | null
          subject: string | null
          success_count: number | null
          target_all_guests: boolean | null
          target_guest_ids: string[] | null
          target_guest_tags: string[] | null
          target_sub_event_ids: string[] | null
          trigger_ref_id: string | null
          trigger_source: string | null
          updated_at: string | null
          version: number | null
        }
        Insert: {
          content: string
          created_at?: string | null
          event_id: string
          failure_count?: number | null
          id?: string
          idempotency_key?: string | null
          message_type?: Database["public"]["Enums"]["message_type_enum"] | null
          modification_count?: number | null
          modified_at?: string | null
          recipient_count?: number | null
          recipient_snapshot?: Json | null
          scheduled_local?: string | null
          scheduled_tz?: string | null
          send_at: string
          send_via_push?: boolean | null
          send_via_sms?: boolean | null
          sender_user_id: string
          sent_at?: string | null
          status?: string | null
          subject?: string | null
          success_count?: number | null
          target_all_guests?: boolean | null
          target_guest_ids?: string[] | null
          target_guest_tags?: string[] | null
          target_sub_event_ids?: string[] | null
          trigger_ref_id?: string | null
          trigger_source?: string | null
          updated_at?: string | null
          version?: number | null
        }
        Update: {
          content?: string
          created_at?: string | null
          event_id?: string
          failure_count?: number | null
          id?: string
          idempotency_key?: string | null
          message_type?: Database["public"]["Enums"]["message_type_enum"] | null
          modification_count?: number | null
          modified_at?: string | null
          recipient_count?: number | null
          recipient_snapshot?: Json | null
          scheduled_local?: string | null
          scheduled_tz?: string | null
          send_at?: string
          send_via_push?: boolean | null
          send_via_sms?: boolean | null
          sender_user_id?: string
          sent_at?: string | null
          status?: string | null
          subject?: string | null
          success_count?: number | null
          target_all_guests?: boolean | null
          target_guest_ids?: string[] | null
          target_guest_tags?: string[] | null
          target_sub_event_ids?: string[] | null
          trigger_ref_id?: string | null
          trigger_source?: string | null
          updated_at?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_messages_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_messages_sender_user_id_fkey"
            columns: ["sender_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_link_audit: {
        Row: {
          created_at: string | null
          event_id: string
          id: string
          linked_user_id: string | null
          matched_guest_id: string | null
          normalized_phone: string
          outcome: Database["public"]["Enums"]["user_link_outcome_enum"]
          record_id: string
          table_name: string
        }
        Insert: {
          created_at?: string | null
          event_id: string
          id?: string
          linked_user_id?: string | null
          matched_guest_id?: string | null
          normalized_phone: string
          outcome: Database["public"]["Enums"]["user_link_outcome_enum"]
          record_id: string
          table_name: string
        }
        Update: {
          created_at?: string | null
          event_id?: string
          id?: string
          linked_user_id?: string | null
          matched_guest_id?: string | null
          normalized_phone?: string
          outcome?: Database["public"]["Enums"]["user_link_outcome_enum"]
          record_id?: string
          table_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_link_audit_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_link_audit_linked_user_id_fkey"
            columns: ["linked_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_link_audit_matched_guest_id_fkey"
            columns: ["matched_guest_id"]
            isOneToOne: false
            referencedRelation: "event_guests"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          full_name: string | null
          id: string
          intended_redirect: string | null
          onboarding_completed: boolean
          phone: string
          sms_consent_given_at: string | null
          sms_consent_ip_address: string | null
          sms_consent_user_agent: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          intended_redirect?: string | null
          onboarding_completed?: boolean
          phone: string
          sms_consent_given_at?: string | null
          sms_consent_ip_address?: string | null
          sms_consent_user_agent?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          intended_redirect?: string | null
          onboarding_completed?: boolean
          phone?: string
          sms_consent_given_at?: string | null
          sms_consent_ip_address?: string | null
          sms_consent_user_agent?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      low_usage_indexes_30d: {
        Row: {
          index_name: string | null
          last_snapshot: string | null
          max_scans_30d: number | null
          recommendation: string | null
          snapshot_count_30d: number | null
          table_name: string | null
        }
        Relationships: []
      }
      rum_p75_7d: {
        Row: {
          avg_value: number | null
          max_value: number | null
          metric: string | null
          min_value: number | null
          n: number | null
          p75: number | null
          route: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      [key: string]: {
        Args: Record<string, unknown>
        Returns: unknown
      }
    }
    Enums: {
      media_type_enum: "image" | "video"
      message_type_enum: "direct" | "announcement" | "channel"
      user_link_outcome_enum: "linked" | "no_match" | "ambiguous" | "skipped"
      user_role_enum: "guest" | "host" | "admin"
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
      media_type_enum: ["image", "video"],
      message_type_enum: ["direct", "announcement", "channel"],
      user_link_outcome_enum: ["linked", "no_match", "ambiguous", "skipped"],
      user_role_enum: ["guest", "host", "admin"],
    },
  },
} as const
