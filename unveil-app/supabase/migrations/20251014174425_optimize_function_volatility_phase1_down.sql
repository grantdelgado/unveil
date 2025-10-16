-- Rollback function volatility optimizations
-- Reverts Phase 1 functions back to VOLATILE if needed

-- Core permission functions
ALTER FUNCTION public.can_access_event(uuid) VOLATILE;
ALTER FUNCTION public.can_read_event(uuid) VOLATILE;  
ALTER FUNCTION public.can_write_event(uuid) VOLATILE;
ALTER FUNCTION public.is_event_host(uuid) VOLATILE;
ALTER FUNCTION public.is_event_guest(uuid) VOLATILE;
ALTER FUNCTION public.is_event_guest(uuid, uuid) VOLATILE;

-- Core lookup functions
ALTER FUNCTION public.event_id_from_message(uuid) VOLATILE;
ALTER FUNCTION public.event_id_from_scheduled_message(uuid) VOLATILE;
ALTER FUNCTION public.lookup_user_by_phone(text) VOLATILE;

-- Message delivery access functions
ALTER FUNCTION public.can_access_delivery_v2(uuid, uuid) VOLATILE;
ALTER FUNCTION public.can_manage_deliveries_v2(uuid) VOLATILE;
ALTER FUNCTION public.can_manage_message_delivery(uuid, uuid) VOLATILE;
ALTER FUNCTION public.resolve_event_from_message_v2(uuid) VOLATILE;

-- Validation and utility functions
ALTER FUNCTION public.is_valid_auth_session(uuid) VOLATILE;
ALTER FUNCTION public.validate_guest_phone_not_host(uuid, text) VOLATILE;

-- Tag comparison functions
ALTER FUNCTION public.guest_has_all_tags(uuid, text[]) VOLATILE;
ALTER FUNCTION public.guest_has_any_tags(uuid, text[]) VOLATILE;
ALTER FUNCTION public.guest_has_any_tags(uuid, uuid, text[]) VOLATILE;

-- Guest status functions
ALTER FUNCTION public.is_guest_attending_rsvp_lite(uuid, uuid) VOLATILE;

-- Link analysis function
ALTER FUNCTION public.link_user_by_phone(uuid, text) VOLATILE;
