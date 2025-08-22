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
          guest_email: string | null
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
          guest_email?: string | null
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
          guest_email?: string | null
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
          email: string | null
          email_provider_id: string | null
          email_status: string | null
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
          email?: string | null
          email_provider_id?: string | null
          email_status?: string | null
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
          email?: string | null
          email_provider_id?: string | null
          email_status?: string | null
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
      scheduled_messages: {
        Row: {
          content: string
          created_at: string | null
          event_id: string
          failure_count: number | null
          id: string
          idempotency_key: string | null
          message_type: Database["public"]["Enums"]["message_type_enum"] | null
          recipient_count: number | null
          recipient_snapshot: Json | null
          scheduled_local: string | null
          scheduled_tz: string | null
          send_at: string
          send_via_email: boolean | null
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
          updated_at: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          event_id: string
          failure_count?: number | null
          id?: string
          idempotency_key?: string | null
          message_type?: Database["public"]["Enums"]["message_type_enum"] | null
          recipient_count?: number | null
          recipient_snapshot?: Json | null
          scheduled_local?: string | null
          scheduled_tz?: string | null
          send_at: string
          send_via_email?: boolean | null
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
          updated_at?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          event_id?: string
          failure_count?: number | null
          id?: string
          idempotency_key?: string | null
          message_type?: Database["public"]["Enums"]["message_type_enum"] | null
          recipient_count?: number | null
          recipient_snapshot?: Json | null
          scheduled_local?: string | null
          scheduled_tz?: string | null
          send_at?: string
          send_via_email?: boolean | null
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
          updated_at?: string | null
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
          email: string | null
          full_name: string | null
          id: string
          intended_redirect: string | null
          onboarding_completed: boolean
          phone: string
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          intended_redirect?: string | null
          onboarding_completed?: boolean
          phone: string
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          intended_redirect?: string | null
          onboarding_completed?: boolean
          phone?: string
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_or_restore_guest: {
        Args: {
          p_email?: string
          p_event_id: string
          p_name?: string
          p_phone: string
          p_role?: string
        }
        Returns: Json
      }
      backfill_guest_deliveries: {
        Args: { p_guest_id: string; p_user_id: string }
        Returns: number
      }
      backfill_user_id_from_phone: {
        Args: Record<PropertyKey, never>
        Returns: {
          details: string
          total_eligible_count: number
          updated_count: number
        }[]
      }
      backfill_user_links: {
        Args: {
          p_batch_size?: number
          p_dry_run?: boolean
          p_table_name?: string
        }
        Returns: {
          ambiguous_count: number
          linked_count: number
          no_match_count: number
          processed_count: number
          sample_results: Json
          skipped_count: number
        }[]
      }
      bulk_guest_auto_join: {
        Args: { p_phone?: string }
        Returns: Json
      }
      bulk_guest_auto_join_from_auth: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      can_access_event: {
        Args: { p_event_id: string }
        Returns: boolean
      }
      can_access_message: {
        Args: { p_message_id: string }
        Returns: boolean
      }
      check_phone_exists_for_event: {
        Args: { p_event_id: string; p_phone: string }
        Returns: boolean
      }
      create_event_with_host_atomic: {
        Args: { event_data: Json }
        Returns: {
          created_at: string
          error_message: string
          event_id: string
          operation: string
          success: boolean
        }[]
      }
      detect_duplicate_events: {
        Args: Record<PropertyKey, never>
        Returns: {
          created_at_range: string
          duplicate_count: number
          event_date: string
          event_ids: string[]
          host_name: string
          host_user_id: string
          title: string
        }[]
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
      get_event_guests_with_display_names: {
        Args: { p_event_id: string; p_limit?: number; p_offset?: number }
        Returns: {
          created_at: string
          decline_reason: string
          declined_at: string
          event_id: string
          first_invited_at: string
          guest_display_name: string
          guest_email: string
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
          user_email: string
          user_full_name: string
          user_id: string
          user_intended_redirect: string
          user_onboarding_completed: boolean
          user_phone: string
          user_updated_at: string
        }[]
      }
      get_feature_flag: {
        Args: { flag_name: string }
        Returns: boolean
      }
      get_guest_display_name: {
        Args: { p_guest_name: string; p_user_full_name: string }
        Returns: string
      }
      get_guest_event_messages: {
        Args: { p_before?: string; p_event_id: string; p_limit?: number }
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
      get_guest_event_messages_legacy: {
        Args: { p_before?: string; p_event_id: string; p_limit?: number }
        Returns: {
          content: string
          created_at: string
          delivery_status: string
          is_own_message: boolean
          message_id: string
          message_type: string
          sender_avatar_url: string
          sender_name: string
        }[]
      }
      get_guest_invitation_status: {
        Args: {
          p_declined_at: string
          p_invited_at: string
          p_joined_at: string
        }
        Returns: string
      }
      get_guest_join_timestamp: {
        Args: { p_event_id: string }
        Returns: string
      }
      get_messaging_recipients: {
        Args: { p_event_id: string; p_include_hosts?: boolean }
        Returns: {
          declined_at: string
          event_guest_id: string
          guest_display_name: string
          guest_email: string
          guest_name: string
          guest_tags: string[]
          has_valid_phone: boolean
          invited_at: string
          phone: string
          role: string
          sms_opt_out: boolean
          user_email: string
          user_full_name: string
          user_phone: string
        }[]
      }
      get_scheduled_messages_for_processing: {
        Args: { p_current_time?: string; p_limit?: number }
        Returns: {
          content: string
          created_at: string | null
          event_id: string
          failure_count: number | null
          id: string
          idempotency_key: string | null
          message_type: Database["public"]["Enums"]["message_type_enum"] | null
          recipient_count: number | null
          recipient_snapshot: Json | null
          scheduled_local: string | null
          scheduled_tz: string | null
          send_at: string
          send_via_email: boolean | null
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
          updated_at: string | null
        }[]
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
      guest_auto_join: {
        Args: { p_event_id: string; p_phone: string }
        Returns: Json
      }
      guest_decline_event: {
        Args: { p_decline_reason?: string; p_event_id: string }
        Returns: Json
      }
      guest_exists_for_phone: {
        Args: { p_event_id: string; p_phone: string }
        Returns: boolean
      }
      guest_has_all_tags: {
        Args: { guest_id: string; target_tags: string[] }
        Returns: boolean
      }
      guest_has_any_tags: {
        Args: { guest_id: string; target_tags: string[] }
        Returns: boolean
      }
      guest_rejoin_event: {
        Args: { p_event_id: string }
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
      host_clear_guest_decline: {
        Args: { p_event_id: string; p_guest_user_id: string }
        Returns: Json
      }
      insert_event_guest: {
        Args: {
          p_event_id: string
          p_guest_name: string
          p_phone: string
          p_rsvp_status?: string
        }
        Returns: string
      }
      is_event_guest: {
        Args: { p_event_id: string }
        Returns: boolean
      }
      is_event_host: {
        Args: { p_event_id: string }
        Returns: boolean
      }
      is_guest_attending_rsvp_lite: {
        Args: { guest_event_id: string; guest_user_id: string }
        Returns: boolean
      }
      is_valid_auth_session: {
        Args: { auth_user_id: string }
        Returns: boolean
      }
      is_valid_phone_for_messaging: {
        Args: { phone_number: string }
        Returns: boolean
      }
      link_user_by_phone: {
        Args: { p_event_id: string; p_normalized_phone: string }
        Returns: {
          guest_id: string
          outcome: Database["public"]["Enums"]["user_link_outcome_enum"]
          user_id: string
        }[]
      }
      lookup_user_by_phone: {
        Args: { user_phone: string }
        Returns: {
          created_at: string
          email: string
          full_name: string
          id: string
          onboarding_completed: boolean
          phone: string
        }[]
      }
      mark_a2p_notice_sent: {
        Args: { _event_id: string; _guest_id: string }
        Returns: undefined
      }
      normalize_phone: {
        Args: { phone_input: string }
        Returns: string
      }
      normalize_phone_number: {
        Args: { input_phone: string }
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
      restore_guest: {
        Args: { p_guest_id: string }
        Returns: Json
      }
      rollback_user_links: {
        Args: {
          p_dry_run?: boolean
          p_since_timestamp: string
          p_table_name?: string
        }
        Returns: {
          rolled_back_count: number
          sample_records: Json
        }[]
      }
      soft_delete_guest: {
        Args: { p_guest_id: string }
        Returns: Json
      }
      update_guest_invitation_tracking: {
        Args: { p_event_id: string; p_guest_ids: string[] }
        Returns: Json
      }
      update_guest_invitation_tracking_strict: {
        Args: { p_event_id: string; p_guest_ids: string[] }
        Returns: Json
      }
      update_guest_messaging_activity: {
        Args: { p_event_id: string; p_guest_ids: string[] }
        Returns: Json
      }
      upsert_message_delivery: {
        Args: {
          p_email_provider_id?: string
          p_email_status?: string
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
