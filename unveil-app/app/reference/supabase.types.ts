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
          rsvp_status: string | null
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
          rsvp_status?: string | null
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
          rsvp_status?: string | null
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
      backfill_user_id_from_phone: {
        Args: Record<PropertyKey, never>
        Returns: {
          details: string
          total_eligible_count: number
          updated_count: number
        }[]
      }
      is_event_host: {
        Args: { p_event_id: string }
        Returns: boolean
      }
      get_invitable_guest_ids: {
        Args: { p_event_id: string }
        Returns: {
          guest_id: string
        }[]
      }
      get_scheduled_messages_for_processing: {
        Args: { p_current_time?: string; p_limit?: number }
        Returns: {
          content: string
          created_at: string
          event_id: string
          event_sms_tag: string
          event_title: string
          failure_count: number
          id: string
          idempotency_key: string
          message_type: Database["public"]["Enums"]["message_type_enum"]
          modification_count: number
          modified_at: string
          recipient_count: number
          recipient_snapshot: Json
          scheduled_local: string
          scheduled_tz: string
          send_at: string
          send_via_push: boolean
          send_via_sms: boolean
          sender_user_id: string
          sent_at: string
          status: string
          subject: string
          success_count: number
          target_all_guests: boolean
          target_guest_ids: string[]
          target_guest_tags: string[]
          target_sub_event_ids: string[]
          updated_at: string
          version: number
        }[]
      }
      upsert_message_delivery: {
        Args: {
          p_guest_id: string
          p_message_id: string
          p_phone_number?: string
          p_push_provider_id?: string
          p_push_status?: string
          p_sms_provider_id?: string
          p_sms_status?: string
          p_user_id?: string
        }
        Returns: string
      }
      resolve_message_recipients: {
        Args: {
          include_declined?: boolean
          msg_event_id: string
          require_all_tags?: boolean
          target_guest_ids?: string[]
          target_rsvp_statuses?: string[]
          target_tags?: string[]
        }
        Returns: {
          can_receive_sms: boolean
          display_name: string
          guest_id: string
          guest_name: string
          phone: string
          recipient_type: string
          sms_opt_out: boolean
        }[]
      }
      update_guest_invitation_tracking_strict: {
        Args: { p_event_id: string; p_guest_ids: string[] }
        Returns: Json
      }
      update_guest_messaging_activity: {
        Args: { p_event_id: string; p_guest_ids: string[] }
        Returns: Json
      }
      handle_sms_delivery_error: {
        Args: {
          p_error_code: string
          p_error_message?: string
          p_phone: string
        }
        Returns: Json
      }
      handle_sms_delivery_success: {
        Args: { p_phone: string }
        Returns: Json
      }
      get_user_events: {
        Args: { user_id_param?: string }
        Returns: {
          event_date: string
          id: string
          is_host: boolean
          location: string
          role: string
          rsvp_status: string
          title: string
        }[]
      }
      get_event_guests_with_display_names: {
        Args: { p_event_id: string; p_limit?: number; p_offset?: number }
        Returns: {
          created_at: string
          decline_reason: string
          declined_at: string
          event_id: string
          first_invited_at: string
          guest_display_name: string
          guest_name: string
          guest_tags: string[]
          id: string
          invite_attempts: number
          invited_at: string
          joined_at: string
          last_invited_at: string
          last_messaged_at: string
          notes: string
          phone: string
          phone_number_verified: boolean
          preferred_communication: string
          removed_at: string
          role: string
          rsvp_status: string
          sms_opt_out: boolean
          updated_at: string
          user_avatar_url: string
          user_created_at: string
          user_full_name: string
          user_id: string
          user_intended_redirect: string
          user_onboarding_completed: boolean
          user_phone: string
          user_updated_at: string
          user_sms_consent_given_at: string | null
          user_sms_consent_ip_address: string | null
          user_sms_consent_user_agent: string | null
        }[]
      }
      soft_delete_guest: {
        Args: { p_guest_id: string }
        Returns: Json
      }
      guest_decline_event: {
        Args: { p_decline_reason?: string; p_event_id: string }
        Returns: Json
      }
      guest_rejoin_event: {
        Args: { p_event_id: string }
        Returns: Json
      }
      host_clear_guest_decline: {
        Args: { p_event_id: string; p_guest_user_id: string }
        Returns: Json
      }
      check_phone_exists_for_event: {
        Args: { p_event_id: string; p_phone: string }
        Returns: boolean
      }
      get_event_guest_counts: {
        Args: { p_event_id: string }
        Returns: {
          attending: number
          declined: number
          not_invited: number
          total_guests: number
          total_invited: number
        }[]
      }
      current_announcement_audience_count: {
        Args: { p_scheduled_message_id: string }
        Returns: number
      }
      get_guest_event_messages: {
        Args: {
          p_before?: string
          p_cursor_created_at?: string
          p_cursor_id?: string
          p_event_id: string
          p_limit?: number
        }
        Returns: {
          channel_tags: string[]
          content: string
          created_at: string
          delivery_status: string
          is_catchup: boolean
          is_own_message: boolean
          message_id: string
          message_type: string
          sender_avatar_url: string
          sender_name: string
          source: string
        }[]
      }
      get_messaging_recipients: {
        Args: { p_event_id: string; p_include_hosts?: boolean }
        Returns: {
          declined_at: string
          event_guest_id: string
          guest_display_name: string
          guest_name: string
          guest_tags: string[]
          has_valid_phone: boolean
          invited_at: string
          phone: string
          role: string
          sms_opt_out: boolean
          user_full_name: string
          user_phone: string
        }[]
      }
      add_or_restore_guest: {
        Args: {
          p_event_id: string
          p_name?: string
          p_phone: string
          p_role?: string
        }
        Returns: Json
      }
      validate_guest_phone_not_host: {
        Args: { p_event_id: string; p_phone: string }
        Returns: boolean
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