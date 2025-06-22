export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      event_participants: {
        Row: {
          created_at: string | null;
          event_id: string;
          id: string;
          invited_at: string | null;
          notes: string | null;
          role: string;
          rsvp_status: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          event_id: string;
          id?: string;
          invited_at?: string | null;
          notes?: string | null;
          role?: string;
          rsvp_status?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          event_id?: string;
          id?: string;
          invited_at?: string | null;
          notes?: string | null;
          role?: string;
          rsvp_status?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'event_participants_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: false;
            referencedRelation: 'events';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'event_participants_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'public_user_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'event_participants_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      events: {
        Row: {
          created_at: string | null;
          description: string | null;
          event_date: string;
          header_image_url: string | null;
          host_user_id: string;
          id: string;
          is_public: boolean | null;
          location: string | null;
          title: string;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          description?: string | null;
          event_date: string;
          header_image_url?: string | null;
          host_user_id: string;
          id?: string;
          is_public?: boolean | null;
          location?: string | null;
          title: string;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          description?: string | null;
          event_date?: string;
          header_image_url?: string | null;
          host_user_id?: string;
          id?: string;
          is_public?: boolean | null;
          location?: string | null;
          title?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'events_host_user_id_fkey';
            columns: ['host_user_id'];
            isOneToOne: false;
            referencedRelation: 'public_user_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'events_host_user_id_fkey';
            columns: ['host_user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      media: {
        Row: {
          caption: string | null;
          created_at: string | null;
          event_id: string;
          id: string;
          media_type: string;
          storage_path: string;
          uploader_user_id: string | null;
        };
        Insert: {
          caption?: string | null;
          created_at?: string | null;
          event_id: string;
          id?: string;
          media_type: string;
          storage_path: string;
          uploader_user_id?: string | null;
        };
        Update: {
          caption?: string | null;
          created_at?: string | null;
          event_id?: string;
          id?: string;
          media_type?: string;
          storage_path?: string;
          uploader_user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'media_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: false;
            referencedRelation: 'events';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'media_uploader_user_id_fkey';
            columns: ['uploader_user_id'];
            isOneToOne: false;
            referencedRelation: 'public_user_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'media_uploader_user_id_fkey';
            columns: ['uploader_user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      messages: {
        Row: {
          content: string;
          created_at: string | null;
          event_id: string;
          id: string;
          message_type: string | null;
          sender_user_id: string | null;
        };
        Insert: {
          content: string;
          created_at?: string | null;
          event_id: string;
          id?: string;
          message_type?: string | null;
          sender_user_id?: string | null;
        };
        Update: {
          content?: string;
          created_at?: string | null;
          event_id?: string;
          id?: string;
          message_type?: string | null;
          sender_user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'messages_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: false;
            referencedRelation: 'events';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'messages_sender_user_id_fkey';
            columns: ['sender_user_id'];
            isOneToOne: false;
            referencedRelation: 'public_user_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'messages_sender_user_id_fkey';
            columns: ['sender_user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      users: {
        Row: {
          avatar_url: string | null;
          created_at: string | null;
          email: string | null;
          full_name: string | null;
          id: string;
          phone: string;
          updated_at: string | null;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string | null;
          email?: string | null;
          full_name?: string | null;
          id?: string;
          phone: string;
          updated_at?: string | null;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string | null;
          email?: string | null;
          full_name?: string | null;
          id?: string;
          phone?: string;
          updated_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      public_user_profiles: {
        Row: {
          avatar_url: string | null;
          full_name: string | null;
          id: string | null;
        };
        Insert: {
          avatar_url?: string | null;
          full_name?: string | null;
          id?: string | null;
        };
        Update: {
          avatar_url?: string | null;
          full_name?: string | null;
          id?: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      can_access_event: {
        Args: { p_event_id: string };
        Returns: boolean;
      };
      get_user_events: {
        Args: Record<PropertyKey, never>;
        Returns: {
          event_id: string;
          title: string;
          event_date: string;
          location: string;
          user_role: string;
          rsvp_status: string;
          is_primary_host: boolean;
        }[];
      };
      is_event_host: {
        Args: { p_event_id: string };
        Returns: boolean;
      };
    };
    Enums: {
      media_type_enum: 'image' | 'video';
      message_type_enum: 'direct' | 'announcement' | 'channel';
      user_role_enum: 'guest' | 'host' | 'admin';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DefaultSchema = Database[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        Database[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      Database[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] &
        DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] &
        DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      media_type_enum: ['image', 'video'],
      message_type_enum: ['direct', 'announcement', 'channel'],
      user_role_enum: ['guest', 'host', 'admin'],
    },
  },
} as const;
