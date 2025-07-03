import type { Database } from '@/app/reference/supabase.types';

// Type helpers
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];
export type Enums<T extends keyof Database['public']['Enums']> =
  Database['public']['Enums'][T];

// Specific table types for convenience
export type Event = Tables<'events'>;
export type EventGuest = Tables<'event_guests'>;
export type Message = Tables<'messages'>;
export type Media = Tables<'media'>;
export type User = Tables<'users'>;
export type PublicUserProfile =
  Database['public']['Tables']['users']['Row'];

// Insert types
export type EventInsert = TablesInsert<'events'>;
export type EventGuestInsert = TablesInsert<'event_guests'>;
export type MessageInsert = TablesInsert<'messages'>;
export type MediaInsert = TablesInsert<'media'>;
export type UserInsert = TablesInsert<'users'>;

// Update types
export type EventUpdate = TablesUpdate<'events'>;
export type EventGuestUpdate = TablesUpdate<'event_guests'>;
export type MessageUpdate = TablesUpdate<'messages'>;
export type MediaUpdate = TablesUpdate<'media'>;
export type UserUpdate = TablesUpdate<'users'>;

// Enum types
export type MessageType = Enums<'message_type_enum'>;
export type MediaType = Enums<'media_type_enum'>;
export type UserRole = Enums<'user_role_enum'>;

// Extended types with relations
export interface EventWithHost extends Event {
  host: PublicUserProfile | null;
}

export interface EventGuestWithUser extends EventGuest {
  users: PublicUserProfile | null;
}

export interface EventGuestWithEvent extends EventGuest {
  events: Event | null;
}

export interface MessageWithSender extends Message {
  sender: PublicUserProfile | null;
}

// Message with delivery info - consolidated from messaging services
export interface MessageWithDelivery extends Message {
  delivery?: Tables<'message_deliveries'>;
  scheduled_message?: Pick<Tables<'scheduled_messages'>, 'id' | 'send_at' | 'status'>;
}

export interface MediaWithUploader extends Media {
  uploader: PublicUserProfile | null;
}

// Utility types for consistent service responses
export type ServiceResponse<T> = {
  data: T | null;
  error: Error | null;
};

export type ServiceResponseArray<T> = {
  data: T[] | null;
  error: Error | null;
};

// Unified service result type following the union pattern from refactor plan
export type ServiceResult<T> = 
  | { data: T; error: null }
  | { data: null; error: Error };

// Enhanced types for better type safety
export type EventGuestWithUserProfile = EventGuestWithUser & {
  user: {
    id: string;
    phone: string;
    full_name: string | null;
    email: string | null;
    avatar_url: string | null;
  } | null;
};

export type MediaWithUploaderProfile = MediaWithUploader & {
  uploader: {
    id: string;
    phone: string;
    full_name: string | null;
    email: string | null;
    avatar_url: string | null;
  } | null;
};

export type MessageWithSenderProfile = MessageWithSender & {
  sender: {
    id: string;
    phone: string;
    full_name: string | null;
    email: string | null;
    avatar_url: string | null;
  } | null;
};

// Common error types for service responses
export class ServiceError extends Error {
  constructor(message: string, public code?: string, public details?: unknown) {
    super(message);
    this.name = 'ServiceError';
  }
}

// Event guest types have replaced participant types. 
// All references should now use EventGuest* types from the unified guest system.
