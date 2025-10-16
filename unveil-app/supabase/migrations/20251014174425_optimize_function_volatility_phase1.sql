-- Optimize function volatility for better query planning
-- Phase 1: High-impact read-only functions (RLS and lookup functions)
-- These functions are frequently called and will benefit most from STABLE optimization

-- Core permission functions (called by RLS policies)
-- These are deterministic within a transaction and don't modify data

ALTER FUNCTION public.can_access_event(uuid) STABLE;
ALTER FUNCTION public.can_read_event(uuid) STABLE;  
ALTER FUNCTION public.can_write_event(uuid) STABLE;
ALTER FUNCTION public.is_event_host(uuid) STABLE;
ALTER FUNCTION public.is_event_guest(uuid) STABLE;

-- Overloaded is_event_guest function (2-parameter version)
ALTER FUNCTION public.is_event_guest(uuid, uuid) STABLE;

-- Core lookup functions (called frequently by application)
ALTER FUNCTION public.event_id_from_message(uuid) STABLE;
ALTER FUNCTION public.event_id_from_scheduled_message(uuid) STABLE;
ALTER FUNCTION public.lookup_user_by_phone(text) STABLE;

-- Message delivery access functions (called by RLS policies)
ALTER FUNCTION public.can_access_delivery_v2(uuid, uuid) STABLE;
ALTER FUNCTION public.can_manage_deliveries_v2(uuid) STABLE;
ALTER FUNCTION public.can_manage_message_delivery(uuid, uuid) STABLE;
ALTER FUNCTION public.resolve_event_from_message_v2(uuid) STABLE;

-- Validation and utility functions
ALTER FUNCTION public.is_valid_auth_session(uuid) STABLE;
ALTER FUNCTION public.validate_guest_phone_not_host(uuid, text) STABLE;

-- Tag comparison functions (pure functions)
ALTER FUNCTION public.guest_has_all_tags(uuid, text[]) STABLE;
ALTER FUNCTION public.guest_has_any_tags(uuid, text[]) STABLE;
-- Note: There are two guest_has_any_tags functions with different signatures
ALTER FUNCTION public.guest_has_any_tags(uuid, uuid, text[]) STABLE;

-- Guest status functions
ALTER FUNCTION public.is_guest_attending_rsvp_lite(uuid, uuid) STABLE;

-- Link analysis function
ALTER FUNCTION public.link_user_by_phone(uuid, text) STABLE;
