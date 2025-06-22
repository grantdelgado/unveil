create extension if not exists "moddatetime" with schema "public" version '1.0';

drop trigger if exists "event_guests_updated_at" on "public"."event_guests";

drop trigger if exists "events_updated_at" on "public"."events";

drop trigger if exists "media_updated_at" on "public"."media";

drop trigger if exists "messages_updated_at" on "public"."messages";

drop trigger if exists "users_updated_at" on "public"."users";

drop policy "Only event hosts can manage guest list" on "public"."event_guests";

drop policy "Users can view guests for events they're involved in" on "public"."event_guests";

drop policy "participants_manage_as_host" on "public"."event_participants";

drop policy "participants_select_event_related" on "public"."event_participants";

drop policy "Authenticated users can create events" on "public"."events";

drop policy "Only hosts can delete their events" on "public"."events";

drop policy "Only hosts can update their events" on "public"."events";

drop policy "events_manage_own" on "public"."events_new";

drop policy "events_select_accessible" on "public"."events_new";

drop policy "Users can delete their own media" on "public"."media";

drop policy "media_insert_event_participant" on "public"."media_new";

drop policy "media_select_event_accessible" on "public"."media_new";

drop policy "media_update_own" on "public"."media_new";

drop policy "messages_insert_event_participant" on "public"."messages_new";

drop policy "messages_select_event_accessible" on "public"."messages_new";

drop policy "Event participants can view related profiles" on "public"."users";

drop policy "Users can update their own profile" on "public"."users";

drop policy "Users can view their own profile" on "public"."users";

drop policy "users_select_event_related" on "public"."users_new";

drop policy "users_select_own" on "public"."users_new";

drop policy "users_update_own" on "public"."users_new";

revoke delete on table "public"."event_guests" from "anon";

revoke insert on table "public"."event_guests" from "anon";

revoke references on table "public"."event_guests" from "anon";

revoke select on table "public"."event_guests" from "anon";

revoke trigger on table "public"."event_guests" from "anon";

revoke truncate on table "public"."event_guests" from "anon";

revoke update on table "public"."event_guests" from "anon";

revoke delete on table "public"."event_guests" from "authenticated";

revoke insert on table "public"."event_guests" from "authenticated";

revoke references on table "public"."event_guests" from "authenticated";

revoke select on table "public"."event_guests" from "authenticated";

revoke trigger on table "public"."event_guests" from "authenticated";

revoke truncate on table "public"."event_guests" from "authenticated";

revoke update on table "public"."event_guests" from "authenticated";

revoke delete on table "public"."event_guests" from "service_role";

revoke insert on table "public"."event_guests" from "service_role";

revoke references on table "public"."event_guests" from "service_role";

revoke select on table "public"."event_guests" from "service_role";

revoke trigger on table "public"."event_guests" from "service_role";

revoke truncate on table "public"."event_guests" from "service_role";

revoke update on table "public"."event_guests" from "service_role";

revoke delete on table "public"."event_participants" from "anon";

revoke insert on table "public"."event_participants" from "anon";

revoke references on table "public"."event_participants" from "anon";

revoke select on table "public"."event_participants" from "anon";

revoke trigger on table "public"."event_participants" from "anon";

revoke truncate on table "public"."event_participants" from "anon";

revoke update on table "public"."event_participants" from "anon";

revoke delete on table "public"."event_participants" from "authenticated";

revoke insert on table "public"."event_participants" from "authenticated";

revoke references on table "public"."event_participants" from "authenticated";

revoke select on table "public"."event_participants" from "authenticated";

revoke trigger on table "public"."event_participants" from "authenticated";

revoke truncate on table "public"."event_participants" from "authenticated";

revoke update on table "public"."event_participants" from "authenticated";

revoke delete on table "public"."event_participants" from "service_role";

revoke insert on table "public"."event_participants" from "service_role";

revoke references on table "public"."event_participants" from "service_role";

revoke select on table "public"."event_participants" from "service_role";

revoke trigger on table "public"."event_participants" from "service_role";

revoke truncate on table "public"."event_participants" from "service_role";

revoke update on table "public"."event_participants" from "service_role";

revoke delete on table "public"."events" from "anon";

revoke insert on table "public"."events" from "anon";

revoke references on table "public"."events" from "anon";

revoke select on table "public"."events" from "anon";

revoke trigger on table "public"."events" from "anon";

revoke truncate on table "public"."events" from "anon";

revoke update on table "public"."events" from "anon";

revoke delete on table "public"."events" from "authenticated";

revoke insert on table "public"."events" from "authenticated";

revoke references on table "public"."events" from "authenticated";

revoke select on table "public"."events" from "authenticated";

revoke trigger on table "public"."events" from "authenticated";

revoke truncate on table "public"."events" from "authenticated";

revoke update on table "public"."events" from "authenticated";

revoke delete on table "public"."events" from "service_role";

revoke insert on table "public"."events" from "service_role";

revoke references on table "public"."events" from "service_role";

revoke select on table "public"."events" from "service_role";

revoke trigger on table "public"."events" from "service_role";

revoke truncate on table "public"."events" from "service_role";

revoke update on table "public"."events" from "service_role";

revoke delete on table "public"."events_new" from "anon";

revoke insert on table "public"."events_new" from "anon";

revoke references on table "public"."events_new" from "anon";

revoke select on table "public"."events_new" from "anon";

revoke trigger on table "public"."events_new" from "anon";

revoke truncate on table "public"."events_new" from "anon";

revoke update on table "public"."events_new" from "anon";

revoke delete on table "public"."events_new" from "authenticated";

revoke insert on table "public"."events_new" from "authenticated";

revoke references on table "public"."events_new" from "authenticated";

revoke select on table "public"."events_new" from "authenticated";

revoke trigger on table "public"."events_new" from "authenticated";

revoke truncate on table "public"."events_new" from "authenticated";

revoke update on table "public"."events_new" from "authenticated";

revoke delete on table "public"."events_new" from "service_role";

revoke insert on table "public"."events_new" from "service_role";

revoke references on table "public"."events_new" from "service_role";

revoke select on table "public"."events_new" from "service_role";

revoke trigger on table "public"."events_new" from "service_role";

revoke truncate on table "public"."events_new" from "service_role";

revoke update on table "public"."events_new" from "service_role";

revoke delete on table "public"."media" from "anon";

revoke insert on table "public"."media" from "anon";

revoke references on table "public"."media" from "anon";

revoke select on table "public"."media" from "anon";

revoke trigger on table "public"."media" from "anon";

revoke truncate on table "public"."media" from "anon";

revoke update on table "public"."media" from "anon";

revoke delete on table "public"."media" from "authenticated";

revoke insert on table "public"."media" from "authenticated";

revoke references on table "public"."media" from "authenticated";

revoke select on table "public"."media" from "authenticated";

revoke trigger on table "public"."media" from "authenticated";

revoke truncate on table "public"."media" from "authenticated";

revoke update on table "public"."media" from "authenticated";

revoke delete on table "public"."media" from "service_role";

revoke insert on table "public"."media" from "service_role";

revoke references on table "public"."media" from "service_role";

revoke select on table "public"."media" from "service_role";

revoke trigger on table "public"."media" from "service_role";

revoke truncate on table "public"."media" from "service_role";

revoke update on table "public"."media" from "service_role";

revoke delete on table "public"."media_new" from "anon";

revoke insert on table "public"."media_new" from "anon";

revoke references on table "public"."media_new" from "anon";

revoke select on table "public"."media_new" from "anon";

revoke trigger on table "public"."media_new" from "anon";

revoke truncate on table "public"."media_new" from "anon";

revoke update on table "public"."media_new" from "anon";

revoke delete on table "public"."media_new" from "authenticated";

revoke insert on table "public"."media_new" from "authenticated";

revoke references on table "public"."media_new" from "authenticated";

revoke select on table "public"."media_new" from "authenticated";

revoke trigger on table "public"."media_new" from "authenticated";

revoke truncate on table "public"."media_new" from "authenticated";

revoke update on table "public"."media_new" from "authenticated";

revoke delete on table "public"."media_new" from "service_role";

revoke insert on table "public"."media_new" from "service_role";

revoke references on table "public"."media_new" from "service_role";

revoke select on table "public"."media_new" from "service_role";

revoke trigger on table "public"."media_new" from "service_role";

revoke truncate on table "public"."media_new" from "service_role";

revoke update on table "public"."media_new" from "service_role";

revoke delete on table "public"."messages" from "anon";

revoke insert on table "public"."messages" from "anon";

revoke references on table "public"."messages" from "anon";

revoke select on table "public"."messages" from "anon";

revoke trigger on table "public"."messages" from "anon";

revoke truncate on table "public"."messages" from "anon";

revoke update on table "public"."messages" from "anon";

revoke delete on table "public"."messages" from "authenticated";

revoke insert on table "public"."messages" from "authenticated";

revoke references on table "public"."messages" from "authenticated";

revoke select on table "public"."messages" from "authenticated";

revoke trigger on table "public"."messages" from "authenticated";

revoke truncate on table "public"."messages" from "authenticated";

revoke update on table "public"."messages" from "authenticated";

revoke delete on table "public"."messages" from "service_role";

revoke insert on table "public"."messages" from "service_role";

revoke references on table "public"."messages" from "service_role";

revoke select on table "public"."messages" from "service_role";

revoke trigger on table "public"."messages" from "service_role";

revoke truncate on table "public"."messages" from "service_role";

revoke update on table "public"."messages" from "service_role";

revoke delete on table "public"."messages_new" from "anon";

revoke insert on table "public"."messages_new" from "anon";

revoke references on table "public"."messages_new" from "anon";

revoke select on table "public"."messages_new" from "anon";

revoke trigger on table "public"."messages_new" from "anon";

revoke truncate on table "public"."messages_new" from "anon";

revoke update on table "public"."messages_new" from "anon";

revoke delete on table "public"."messages_new" from "authenticated";

revoke insert on table "public"."messages_new" from "authenticated";

revoke references on table "public"."messages_new" from "authenticated";

revoke select on table "public"."messages_new" from "authenticated";

revoke trigger on table "public"."messages_new" from "authenticated";

revoke truncate on table "public"."messages_new" from "authenticated";

revoke update on table "public"."messages_new" from "authenticated";

revoke delete on table "public"."messages_new" from "service_role";

revoke insert on table "public"."messages_new" from "service_role";

revoke references on table "public"."messages_new" from "service_role";

revoke select on table "public"."messages_new" from "service_role";

revoke trigger on table "public"."messages_new" from "service_role";

revoke truncate on table "public"."messages_new" from "service_role";

revoke update on table "public"."messages_new" from "service_role";

revoke delete on table "public"."users_new" from "anon";

revoke insert on table "public"."users_new" from "anon";

revoke references on table "public"."users_new" from "anon";

revoke select on table "public"."users_new" from "anon";

revoke trigger on table "public"."users_new" from "anon";

revoke truncate on table "public"."users_new" from "anon";

revoke update on table "public"."users_new" from "anon";

revoke delete on table "public"."users_new" from "authenticated";

revoke insert on table "public"."users_new" from "authenticated";

revoke references on table "public"."users_new" from "authenticated";

revoke select on table "public"."users_new" from "authenticated";

revoke trigger on table "public"."users_new" from "authenticated";

revoke truncate on table "public"."users_new" from "authenticated";

revoke update on table "public"."users_new" from "authenticated";

revoke delete on table "public"."users_new" from "service_role";

revoke insert on table "public"."users_new" from "service_role";

revoke references on table "public"."users_new" from "service_role";

revoke select on table "public"."users_new" from "service_role";

revoke trigger on table "public"."users_new" from "service_role";

revoke truncate on table "public"."users_new" from "service_role";

revoke update on table "public"."users_new" from "service_role";

alter table "public"."event_guests" drop constraint "event_guests_event_id_fkey";

alter table "public"."event_guests" drop constraint "event_guests_event_id_phone_key";

alter table "public"."event_guests" drop constraint "event_guests_role_check";

alter table "public"."event_guests" drop constraint "event_guests_rsvp_status_check";

alter table "public"."event_guests" drop constraint "event_guests_user_id_fkey";

alter table "public"."event_guests" drop constraint "phone_format";

alter table "public"."event_participants" drop constraint "event_participants_event_id_fkey";

alter table "public"."event_participants" drop constraint "event_participants_event_id_user_id_key";

alter table "public"."event_participants" drop constraint "event_participants_role_check";

alter table "public"."event_participants" drop constraint "event_participants_rsvp_status_check";

alter table "public"."event_participants" drop constraint "event_participants_user_id_fkey";

alter table "public"."events" drop constraint "events_host_user_id_fkey";

alter table "public"."events_new" drop constraint "events_new_host_user_id_fkey";

alter table "public"."media" drop constraint "media_event_id_fkey";

alter table "public"."media" drop constraint "media_media_type_check";

alter table "public"."media" drop constraint "media_uploader_user_id_fkey";

alter table "public"."media_new" drop constraint "media_new_event_id_fkey";

alter table "public"."media_new" drop constraint "media_new_media_type_check";

alter table "public"."media_new" drop constraint "media_new_uploader_user_id_fkey";

alter table "public"."messages" drop constraint "messages_event_id_fkey";

alter table "public"."messages" drop constraint "messages_message_type_check";

alter table "public"."messages" drop constraint "messages_parent_message_id_fkey";

alter table "public"."messages" drop constraint "messages_recipient_user_id_fkey";

alter table "public"."messages" drop constraint "messages_sender_user_id_fkey";

alter table "public"."messages_new" drop constraint "messages_new_event_id_fkey";

alter table "public"."messages_new" drop constraint "messages_new_message_type_check";

alter table "public"."messages_new" drop constraint "messages_new_sender_user_id_fkey";

alter table "public"."users" drop constraint "unique_user_phone";

alter table "public"."users" drop constraint "users_phone_format";

alter table "public"."users_new" drop constraint "users_new_phone_format";

alter table "public"."users_new" drop constraint "users_new_phone_key";

drop function if exists "public"."can_access_event"(p_event_id uuid);

drop function if exists "public"."get_user_event_role"(p_event_id uuid);

drop function if exists "public"."get_user_events"();

drop function if exists "public"."handle_updated_at"();

drop function if exists "public"."is_development_phone"(p_phone text);

drop view if exists "public"."public_user_profiles";

alter table "public"."event_guests" drop constraint "event_guests_pkey";

alter table "public"."event_participants" drop constraint "event_participants_pkey";

alter table "public"."events" drop constraint "events_pkey";

alter table "public"."events_new" drop constraint "events_new_pkey";

alter table "public"."media" drop constraint "media_pkey";

alter table "public"."media_new" drop constraint "media_new_pkey";

alter table "public"."messages" drop constraint "messages_pkey";

alter table "public"."messages_new" drop constraint "messages_new_pkey";

alter table "public"."users_new" drop constraint "users_new_pkey";

drop index if exists "public"."event_guests_event_id_phone_key";

drop index if exists "public"."event_guests_pkey";

drop index if exists "public"."event_participants_event_id_user_id_key";

drop index if exists "public"."event_participants_pkey";

drop index if exists "public"."events_new_pkey";

drop index if exists "public"."events_pkey";

drop index if exists "public"."idx_event_guests_event_id";

drop index if exists "public"."idx_event_guests_event_role";

drop index if exists "public"."idx_event_guests_phone";

drop index if exists "public"."idx_event_guests_role";

drop index if exists "public"."idx_event_guests_rsvp_status";

drop index if exists "public"."idx_event_guests_user_id";

drop index if exists "public"."idx_event_guests_user_role";

drop index if exists "public"."idx_event_participants_event";

drop index if exists "public"."idx_event_participants_role";

drop index if exists "public"."idx_event_participants_user";

drop index if exists "public"."idx_events_event_date";

drop index if exists "public"."idx_events_host_user_id";

drop index if exists "public"."idx_events_is_public";

drop index if exists "public"."idx_events_new_date";

drop index if exists "public"."idx_events_new_host";

drop index if exists "public"."idx_media_event_id";

drop index if exists "public"."idx_media_media_type";

drop index if exists "public"."idx_media_new_event";

drop index if exists "public"."idx_media_uploader_user_id";

drop index if exists "public"."idx_messages_created_at";

drop index if exists "public"."idx_messages_event_id";

drop index if exists "public"."idx_messages_new_event";

drop index if exists "public"."idx_messages_recipient_user_id";

drop index if exists "public"."idx_messages_sender_user_id";

drop index if exists "public"."idx_users_email";

drop index if exists "public"."idx_users_new_phone";

drop index if exists "public"."idx_users_phone";

drop index if exists "public"."media_new_pkey";

drop index if exists "public"."media_pkey";

drop index if exists "public"."messages_new_pkey";

drop index if exists "public"."messages_pkey";

drop index if exists "public"."unique_user_phone";

drop index if exists "public"."users_new_phone_key";

drop index if exists "public"."users_new_pkey";

drop table "public"."event_guests";

drop table "public"."event_participants";

drop table "public"."events";

drop table "public"."events_new";

drop table "public"."media";

drop table "public"."media_new";

drop table "public"."messages";

drop table "public"."messages_new";

drop table "public"."users_new";

alter table "public"."users" disable row level security;

drop type "public"."rsvp_status_enum";

CREATE UNIQUE INDEX users_phone_key ON public.users USING btree (phone);

alter table "public"."users" add constraint "users_phone_key" UNIQUE using index "users_phone_key";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.can_view_user_profile(target_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN (
    -- Users can view their own profile
    target_user_id = auth.uid()
    OR
    -- Event guests can view host profiles
    EXISTS (
      SELECT 1 FROM public.events
      WHERE host_user_id = target_user_id 
      AND (public.is_event_guest(events.id) OR public.is_event_host(events.id))
    )
    OR
    -- Event hosts can view guest profiles
    EXISTS (
      SELECT 1 FROM public.event_guests eg
      JOIN public.events e ON eg.event_id = e.id
      WHERE eg.user_id = target_user_id 
      AND public.is_event_host(e.id)
    )
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.current_user_guest_has_tags(p_event_id uuid, p_tags_to_check text[])
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  IF p_tags_to_check IS NULL OR array_length(p_tags_to_check, 1) IS NULL THEN
    RETURN TRUE;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.event_guests
    WHERE event_id = p_event_id
      AND user_id = auth.uid()
      AND guest_tags && p_tags_to_check
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.find_user_by_phone(phone_number text)
 RETURNS TABLE(id uuid, email text, phone text, full_name text, avatar_url text, role text, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
  SELECT 
    u.id,
    u.email,
    u.phone,
    u.full_name,
    u.avatar_url,
    u.role,
    u.created_at,
    u.updated_at
  FROM public.users u
  WHERE u.phone = phone_number;
$function$
;

CREATE OR REPLACE FUNCTION public.get_event_details_for_user(event_id uuid, user_id uuid)
 RETURNS TABLE(id uuid, created_at timestamp with time zone, updated_at timestamp with time zone, host_user_id uuid, title text, event_date date, location text, header_image_url text, description text, is_public boolean, user_role text, guest_id uuid, guest_rsvp_status text, guest_tags text[], guest_phone text, guest_notes text, guest_name text, guest_email text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    e.id,
    e.created_at,
    e.updated_at,
    e.host_user_id,
    e.title,
    e.event_date,
    e.location,
    e.header_image_url,
    e.description,
    e.is_public,
    CASE 
      WHEN e.host_user_id = get_event_details_for_user.user_id THEN 'host'::TEXT
      WHEN eg.user_id IS NOT NULL THEN 'guest'::TEXT
      ELSE 'none'::TEXT
    END as user_role,
    eg.id as guest_id,
    eg.rsvp_status as guest_rsvp_status,
    eg.guest_tags,
    eg.phone as guest_phone,
    eg.notes as guest_notes,
    eg.guest_name,
    eg.guest_email
  FROM public.events e
  LEFT JOIN public.event_guests eg ON e.id = eg.event_id AND eg.user_id = get_event_details_for_user.user_id
  WHERE e.id = get_event_details_for_user.event_id
  AND (
    e.host_user_id = get_event_details_for_user.user_id OR 
    eg.user_id IS NOT NULL OR
    e.is_public = true
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_events_for_user(user_id uuid, role_type text)
 RETURNS TABLE(id uuid, created_at timestamp with time zone, updated_at timestamp with time zone, host_user_id uuid, title text, event_date date, location text, header_image_url text, description text, is_public boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  IF role_type = 'host' THEN
    -- Return events where user is the host
    RETURN QUERY
    SELECT 
      e.id,
      e.created_at,
      e.updated_at,
      e.host_user_id,
      e.title,
      e.event_date,
      e.location,
      e.header_image_url,
      e.description,
      e.is_public
    FROM public.events e
    WHERE e.host_user_id = get_events_for_user.user_id
    ORDER BY e.event_date ASC;
  ELSIF role_type = 'guest' THEN
    -- Return events where user is a guest
    RETURN QUERY
    SELECT 
      e.id,
      e.created_at,
      e.updated_at,
      e.host_user_id,
      e.title,
      e.event_date,
      e.location,
      e.header_image_url,
      e.description,
      e.is_public
    FROM public.events e
    INNER JOIN public.event_guests eg ON e.id = eg.event_id
    WHERE eg.user_id = get_events_for_user.user_id
    ORDER BY e.event_date ASC;
  ELSE
    -- Invalid role type, return empty result
    RETURN;
  END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_ready_scheduled_messages()
 RETURNS TABLE(id uuid, event_id uuid, content text, target_guest_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    sm.id,
    sm.event_id,
    sm.content,
    CASE 
      WHEN sm.target_all_guests THEN (
        SELECT COUNT(*) FROM public.event_guests eg WHERE eg.event_id = sm.event_id
      )
      ELSE (
        SELECT COUNT(DISTINCT eg.id) 
        FROM public.event_guests eg
        LEFT JOIN public.guest_sub_event_assignments gsea ON eg.id = gsea.guest_id
        LEFT JOIN public.sub_events se ON gsea.sub_event_id = se.id
        WHERE eg.event_id = sm.event_id
        AND (
          sm.target_guest_ids IS NULL OR eg.id = ANY(sm.target_guest_ids) OR
          sm.target_guest_tags IS NULL OR sm.target_guest_tags && eg.guest_tags OR
          sm.target_sub_event_ids IS NULL OR se.id = ANY(sm.target_sub_event_ids)
        )
      )
    END as target_guest_count
  FROM public.scheduled_messages sm
  WHERE sm.status = 'scheduled'
  AND sm.send_at <= NOW();
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_sub_event_guests(p_sub_event_id uuid)
 RETURNS TABLE(guest_id uuid, guest_name text, guest_email text, phone_number text, rsvp_status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    eg.id,
    eg.guest_name,
    eg.guest_email,
    eg.phone,
    gsea.rsvp_status
  FROM public.event_guests eg
  INNER JOIN public.guest_sub_event_assignments gsea ON eg.id = gsea.guest_id
  WHERE gsea.sub_event_id = p_sub_event_id
  AND gsea.is_invited = true;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_user_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  UPDATE public.users
  SET email = NEW.email
  WHERE id = NEW.id;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.is_event_guest(p_event_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.event_guests
    WHERE event_id = p_event_id AND user_id = auth.uid()
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.is_going_guest(eid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM event_guests
    WHERE event_id = eid
      AND user_id = auth.uid()
      AND rsvp_status = 'going'
  );
$function$
;

CREATE OR REPLACE FUNCTION public.is_user_guest_of_event(p_event_id uuid, p_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.event_guests eg
    WHERE eg.event_id = p_event_id AND eg.user_id = p_user_id
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.user_can_view_profile(target_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- Check if the current user can view the target user's profile
  RETURN (
    -- Own profile
    target_user_id = auth.uid()
    OR
    -- Target is host of events where current user is guest
    EXISTS (
      SELECT 1 FROM public.events e
      JOIN public.event_guests eg ON eg.event_id = e.id
      WHERE e.host_user_id = target_user_id AND eg.user_id = auth.uid()
    )
    OR
    -- Current user is host of events where target is guest
    EXISTS (
      SELECT 1 FROM public.events e
      JOIN public.event_guests eg ON eg.event_id = e.id
      WHERE e.host_user_id = auth.uid() AND eg.user_id = target_user_id
    )
    OR
    -- Both users are guests in the same event
    EXISTS (
      SELECT 1 FROM public.event_guests eg1
      JOIN public.event_guests eg2 ON eg1.event_id = eg2.event_id
      WHERE eg1.user_id = auth.uid() AND eg2.user_id = target_user_id
    )
    OR
    -- Target is sender of messages in events where current user participates
    EXISTS (
      SELECT 1 FROM public.messages m
      JOIN public.events e ON m.event_id = e.id
      LEFT JOIN public.event_guests eg ON eg.event_id = e.id AND eg.user_id = auth.uid()
      WHERE m.sender_user_id = target_user_id 
      AND (e.host_user_id = auth.uid() OR eg.user_id IS NOT NULL)
    )
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.users (
    id, 
    email, 
    phone, 
    full_name, 
    role,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'phone', NEW.phone),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    'guest',
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.is_event_host(p_event_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.events
    WHERE id = p_event_id AND host_user_id = auth.uid()
  );
END;
$function$
;


