export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      event_guests: {
        Row: {
          created_at: string | null
          event_id: string
          guest_email: string | null
          guest_name: string | null
          guest_tags: string[] | null
          id: string
          invited_at: string | null
          notes: string | null
          phone: string
          phone_number_verified: boolean | null
          preferred_communication: string | null
          role: string
          rsvp_status: string | null
          sms_opt_out: boolean | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          event_id: string
          guest_email?: string | null
          guest_name?: string | null
          guest_tags?: string[] | null
          id?: string
          invited_at?: string | null
          notes?: string | null
          phone: string
          phone_number_verified?: boolean | null
          preferred_communication?: string | null
          role?: string
          rsvp_status?: string | null
          sms_opt_out?: boolean | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          event_id?: string
          guest_email?: string | null
          guest_name?: string | null
          guest_tags?: string[] | null
          id?: string
          invited_at?: string | null
          notes?: string | null
          phone?: string
          phone_number_verified?: boolean | null
          preferred_communication?: string | null
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
      events: {
        Row: {
          allow_open_signup: boolean
          created_at: string | null
          description: string | null
          event_date: string
          header_image_url: string | null
          host_user_id: string
          id: string
          is_public: boolean | null
          location: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          allow_open_signup?: boolean
          created_at?: string | null
          description?: string | null
          event_date: string
          header_image_url?: string | null
          host_user_id: string
          id?: string
          is_public?: boolean | null
          location?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          allow_open_signup?: boolean
          created_at?: string | null
          description?: string | null
          event_date?: string
          header_image_url?: string | null
          host_user_id?: string
          id?: string
          is_public?: boolean | null
          location?: string | null
          title?: string
          updated_at?: string | null
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
          message_id: string | null
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
          message_id?: string | null
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
          message_id?: string | null
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
          event_id: string
          id: string
          message_type: Database["public"]["Enums"]["message_type_enum"] | null
          sender_user_id: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          event_id: string
          id?: string
          message_type?: Database["public"]["Enums"]["message_type_enum"] | null
          sender_user_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          event_id?: string
          id?: string
          message_type?: Database["public"]["Enums"]["message_type_enum"] | null
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
          message_type: Database["public"]["Enums"]["message_type_enum"] | null
          recipient_count: number | null
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
          message_type?: Database["public"]["Enums"]["message_type_enum"] | null
          recipient_count?: number | null
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
          message_type?: Database["public"]["Enums"]["message_type_enum"] | null
          recipient_count?: number | null
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
      can_access_event: {
        Args: { p_event_id: string }
        Returns: boolean
      }
      can_access_message: {
        Args: { p_message_id: string }
        Returns: boolean
      }
      get_user_events: {
        Args: { user_id_param?: string }
        Returns: {
          id: string
          title: string
          event_date: string
          location: string
          role: string
          rsvp_status: string
          is_host: boolean
        }[]
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
      is_valid_auth_session: {
        Args: { auth_user_id: string }
        Returns: boolean
      }
      lookup_user_by_phone: {
        Args: { user_phone: string }
        Returns: {
          id: string
          phone: string
          full_name: string
          email: string
          created_at: string
          onboarding_completed: boolean
        }[]
      }
      normalize_phone_number: {
        Args: { input_phone: string }
        Returns: string
      }
      resolve_message_recipients: {
        Args: {
          msg_event_id: string
          target_guest_ids?: string[]
          target_tags?: string[]
          require_all_tags?: boolean
          target_rsvp_statuses?: string[]
        }
        Returns: {
          guest_id: string
          guest_phone: string
          guest_name: string
        }[]
      }
    }
    Enums: {
      media_type_enum: "image" | "video"
      message_type_enum: "direct" | "announcement" | "channel"
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
      user_role_enum: ["guest", "host", "admin"],
    },
  },
} as const

// Additional type exports for better developer experience
export type User = Tables<'users'>
export type Event = Tables<'events'>
export type EventGuest = Tables<'event_guests'>
export type Message = Tables<'messages'>
export type ScheduledMessage = Tables<'scheduled_messages'>
export type Media = Tables<'media'>
export type MessageDelivery = Tables<'message_deliveries'>
