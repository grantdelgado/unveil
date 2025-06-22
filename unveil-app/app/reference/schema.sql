

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgjwt" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."media_type_enum" AS ENUM (
    'image',
    'video'
);


ALTER TYPE "public"."media_type_enum" OWNER TO "postgres";


CREATE TYPE "public"."message_type_enum" AS ENUM (
    'direct',
    'announcement',
    'channel'
);


ALTER TYPE "public"."message_type_enum" OWNER TO "postgres";


CREATE TYPE "public"."rsvp_status_enum" AS ENUM (
    'attending',
    'declined',
    'maybe',
    'pending'
);


ALTER TYPE "public"."rsvp_status_enum" OWNER TO "postgres";


CREATE TYPE "public"."user_role_enum" AS ENUM (
    'guest',
    'host',
    'admin'
);


ALTER TYPE "public"."user_role_enum" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_access_event"("p_event_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.events_new e
    LEFT JOIN public.event_participants ep ON ep.event_id = e.id
    WHERE e.id = p_event_id 
    AND (e.host_user_id = auth.uid() OR ep.user_id = auth.uid())
  );
END;
$$;


ALTER FUNCTION "public"."can_access_event"("p_event_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_view_user_profile"("target_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."can_view_user_profile"("target_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_ready_scheduled_messages"() RETURNS TABLE("id" "uuid", "event_id" "uuid", "content" "text", "target_guest_count" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."get_ready_scheduled_messages"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_sub_event_guests"("p_sub_event_id" "uuid") RETURNS TABLE("guest_id" "uuid", "guest_name" "text", "guest_email" "text", "phone_number" "text", "rsvp_status" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."get_sub_event_guests"("p_sub_event_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_event_role"("p_event_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Check if user is the primary host
  IF EXISTS (
    SELECT 1 FROM public.events 
    WHERE id = p_event_id AND host_user_id = auth.uid()
  ) THEN
    RETURN 'host';
  END IF;
  
  -- Check role from event_guests table
  RETURN (
    SELECT eg.role FROM public.event_guests eg
    WHERE eg.event_id = p_event_id AND eg.user_id = auth.uid()
  );
END;
$$;


ALTER FUNCTION "public"."get_user_event_role"("p_event_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_user_event_role"("p_event_id" "uuid") IS 'Returns the user''s role for a specific event';



CREATE OR REPLACE FUNCTION "public"."get_user_events"() RETURNS TABLE("event_id" "uuid", "title" "text", "event_date" "date", "location" "text", "user_role" "text", "rsvp_status" "text", "is_primary_host" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id,
    e.title,
    e.event_date,
    e.location,
    CASE 
      WHEN e.host_user_id = auth.uid() THEN 'host'::TEXT
      ELSE COALESCE(ep.role, 'guest'::TEXT)
    END,
    ep.rsvp_status,
    (e.host_user_id = auth.uid())
  FROM public.events_new e
  LEFT JOIN public.event_participants ep ON ep.event_id = e.id AND ep.user_id = auth.uid()
  WHERE e.host_user_id = auth.uid() OR ep.user_id = auth.uid()
  ORDER BY e.event_date DESC;
END;
$$;


ALTER FUNCTION "public"."get_user_events"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.users_new (id, phone, email, full_name)
  VALUES (
    NEW.id, 
    COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone', '+1555000000' || (floor(random() * 9) + 1)::text),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name')
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_development_phone"("p_phone" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $_$
BEGIN
  RETURN p_phone ~ '^\+1555000000[1-9]$';
END;
$_$;


ALTER FUNCTION "public"."is_development_phone"("p_phone" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_event_host"("p_event_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.events_new e
    LEFT JOIN public.event_participants ep ON ep.event_id = e.id AND ep.user_id = auth.uid()
    WHERE e.id = p_event_id 
    AND (e.host_user_id = auth.uid() OR ep.role = 'host')
  );
END;
$$;


ALTER FUNCTION "public"."is_event_host"("p_event_id" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."communication_preferences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "event_id" "uuid" NOT NULL,
    "receive_sms" boolean DEFAULT true,
    "receive_push" boolean DEFAULT true,
    "receive_email" boolean DEFAULT false,
    "quiet_hours_start" time without time zone,
    "quiet_hours_end" time without time zone,
    "timezone" character varying(50) DEFAULT 'America/Los_Angeles'::character varying,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."communication_preferences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_guests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "guest_name" "text",
    "guest_email" "text",
    "phone" "text" NOT NULL,
    "rsvp_status" "text" DEFAULT 'pending'::"text",
    "notes" "text",
    "guest_tags" "text"[] DEFAULT '{}'::"text"[],
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "role" "text" DEFAULT 'guest'::"text" NOT NULL,
    "invited_at" timestamp with time zone DEFAULT "now"(),
    "phone_number_verified" boolean DEFAULT false,
    "sms_opt_out" boolean DEFAULT false,
    "preferred_communication" character varying(20) DEFAULT 'sms'::character varying,
    CONSTRAINT "event_guests_preferred_communication_check" CHECK ((("preferred_communication")::"text" = ANY ((ARRAY['sms'::character varying, 'push'::character varying, 'email'::character varying, 'none'::character varying])::"text"[]))),
    CONSTRAINT "event_guests_role_check" CHECK (("role" = ANY (ARRAY['host'::"text", 'guest'::"text", 'admin'::"text"]))),
    CONSTRAINT "event_guests_rsvp_status_check" CHECK (("rsvp_status" = ANY (ARRAY['attending'::"text", 'declined'::"text", 'maybe'::"text", 'pending'::"text"]))),
    CONSTRAINT "phone_format" CHECK (("phone" ~ '^\+[1-9]\d{1,14}$'::"text"))
);


ALTER TABLE "public"."event_guests" OWNER TO "postgres";


COMMENT ON COLUMN "public"."event_guests"."role" IS 'Per-event role assignment: host, guest, or admin';



CREATE TABLE IF NOT EXISTS "public"."event_participants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'guest'::"text" NOT NULL,
    "rsvp_status" "text" DEFAULT 'pending'::"text",
    "notes" "text",
    "invited_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "event_participants_role_check" CHECK (("role" = ANY (ARRAY['host'::"text", 'guest'::"text"]))),
    CONSTRAINT "event_participants_rsvp_status_check" CHECK (("rsvp_status" = ANY (ARRAY['attending'::"text", 'declined'::"text", 'maybe'::"text", 'pending'::"text"])))
);


ALTER TABLE "public"."event_participants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "host_user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "event_date" "date" NOT NULL,
    "location" "text",
    "description" "text",
    "header_image_url" "text",
    "is_public" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."events_new" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "event_date" "date" NOT NULL,
    "location" "text",
    "description" "text",
    "host_user_id" "uuid" NOT NULL,
    "header_image_url" "text",
    "is_public" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."events_new" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."guest_sub_event_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "guest_id" "uuid" NOT NULL,
    "sub_event_id" "uuid" NOT NULL,
    "is_invited" boolean DEFAULT true,
    "rsvp_status" character varying(20) DEFAULT 'pending'::character varying,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "guest_sub_event_assignments_rsvp_status_check" CHECK ((("rsvp_status")::"text" = ANY ((ARRAY['attending'::character varying, 'declined'::character varying, 'maybe'::character varying, 'pending'::character varying])::"text"[])))
);


ALTER TABLE "public"."guest_sub_event_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."media" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "uploader_user_id" "uuid",
    "storage_path" "text" NOT NULL,
    "media_type" "text" NOT NULL,
    "caption" "text",
    "is_featured" boolean DEFAULT false,
    "media_tags" "text"[] DEFAULT '{}'::"text"[],
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "media_media_type_check" CHECK (("media_type" = ANY (ARRAY['image'::"text", 'video'::"text"])))
);


ALTER TABLE "public"."media" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."media_new" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "uploader_user_id" "uuid",
    "storage_path" "text" NOT NULL,
    "media_type" "text" NOT NULL,
    "caption" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "media_new_media_type_check" CHECK (("media_type" = ANY (ARRAY['image'::"text", 'video'::"text"])))
);


ALTER TABLE "public"."media_new" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."message_deliveries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "scheduled_message_id" "uuid",
    "message_id" "uuid",
    "guest_id" "uuid" NOT NULL,
    "phone_number" character varying(20),
    "email" character varying(255),
    "user_id" "uuid",
    "sms_status" character varying(20) DEFAULT 'pending'::character varying,
    "push_status" character varying(20) DEFAULT 'pending'::character varying,
    "email_status" character varying(20) DEFAULT 'pending'::character varying,
    "sms_provider_id" character varying(255),
    "push_provider_id" character varying(255),
    "email_provider_id" character varying(255),
    "has_responded" boolean DEFAULT false,
    "response_message_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "message_deliveries_email_status_check" CHECK ((("email_status")::"text" = ANY ((ARRAY['pending'::character varying, 'sent'::character varying, 'delivered'::character varying, 'failed'::character varying, 'not_applicable'::character varying])::"text"[]))),
    CONSTRAINT "message_deliveries_push_status_check" CHECK ((("push_status")::"text" = ANY ((ARRAY['pending'::character varying, 'sent'::character varying, 'delivered'::character varying, 'failed'::character varying, 'not_applicable'::character varying])::"text"[]))),
    CONSTRAINT "message_deliveries_sms_status_check" CHECK ((("sms_status")::"text" = ANY ((ARRAY['pending'::character varying, 'sent'::character varying, 'delivered'::character varying, 'failed'::character varying, 'undelivered'::character varying])::"text"[])))
);


ALTER TABLE "public"."message_deliveries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "sender_user_id" "uuid",
    "recipient_user_id" "uuid",
    "content" "text" NOT NULL,
    "message_type" "text" DEFAULT 'direct'::"text",
    "parent_message_id" "uuid",
    "recipient_tags" "text"[] DEFAULT '{}'::"text"[],
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "messages_message_type_check" CHECK (("message_type" = ANY (ARRAY['direct'::"text", 'announcement'::"text", 'channel'::"text"])))
);


ALTER TABLE "public"."messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."messages_new" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "sender_user_id" "uuid",
    "content" "text" NOT NULL,
    "message_type" "text" DEFAULT 'direct'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "messages_new_message_type_check" CHECK (("message_type" = ANY (ARRAY['direct'::"text", 'announcement'::"text"])))
);


ALTER TABLE "public"."messages_new" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users_new" (
    "id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "phone" "text" NOT NULL,
    "full_name" "text",
    "avatar_url" "text",
    "email" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "users_new_phone_format" CHECK (("phone" ~ '^\+[1-9]\d{1,14}$'::"text"))
);


ALTER TABLE "public"."users_new" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."public_user_profiles" AS
 SELECT "u"."id",
    "u"."full_name",
    "u"."avatar_url"
   FROM "public"."users_new" "u"
  WHERE ((EXISTS ( SELECT 1
           FROM (("public"."events_new" "e"
             LEFT JOIN "public"."event_participants" "ep1" ON ((("ep1"."event_id" = "e"."id") AND ("ep1"."user_id" = "auth"."uid"()))))
             LEFT JOIN "public"."event_participants" "ep2" ON ((("ep2"."event_id" = "e"."id") AND ("ep2"."user_id" = "u"."id"))))
          WHERE ((("e"."host_user_id" = "auth"."uid"()) OR ("ep1"."user_id" = "auth"."uid"())) AND (("e"."host_user_id" = "u"."id") OR ("ep2"."user_id" = "u"."id"))))) OR ("u"."id" = "auth"."uid"()));


ALTER TABLE "public"."public_user_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."scheduled_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "sender_user_id" "uuid" NOT NULL,
    "subject" character varying(500),
    "content" "text" NOT NULL,
    "send_at" timestamp with time zone NOT NULL,
    "target_all_guests" boolean DEFAULT false,
    "target_sub_event_ids" "uuid"[],
    "target_guest_tags" "text"[],
    "target_guest_ids" "uuid"[],
    "send_via_sms" boolean DEFAULT true,
    "send_via_push" boolean DEFAULT true,
    "send_via_email" boolean DEFAULT false,
    "status" character varying(20) DEFAULT 'scheduled'::character varying,
    "sent_at" timestamp with time zone,
    "recipient_count" integer DEFAULT 0,
    "success_count" integer DEFAULT 0,
    "failure_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "scheduled_messages_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['scheduled'::character varying, 'sending'::character varying, 'sent'::character varying, 'failed'::character varying, 'cancelled'::character varying])::"text"[])))
);


ALTER TABLE "public"."scheduled_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sub_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "name" character varying(255) NOT NULL,
    "description" "text",
    "event_date" timestamp with time zone,
    "location" "text",
    "is_required" boolean DEFAULT false,
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."sub_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "email" "text",
    "full_name" "text",
    "avatar_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "phone" "text" NOT NULL,
    CONSTRAINT "users_phone_format" CHECK ((("phone" IS NULL) OR ("phone" ~ '^\+[1-9]\d{1,14}$'::"text")))
);


ALTER TABLE "public"."users" OWNER TO "postgres";


COMMENT ON COLUMN "public"."users"."email" IS 'Optional email for notifications only';



COMMENT ON COLUMN "public"."users"."phone" IS 'Primary identity field - international format phone number';



ALTER TABLE ONLY "public"."communication_preferences"
    ADD CONSTRAINT "communication_preferences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."communication_preferences"
    ADD CONSTRAINT "communication_preferences_user_id_event_id_key" UNIQUE ("user_id", "event_id");



ALTER TABLE ONLY "public"."event_guests"
    ADD CONSTRAINT "event_guests_event_id_phone_key" UNIQUE ("event_id", "phone");



ALTER TABLE ONLY "public"."event_guests"
    ADD CONSTRAINT "event_guests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_participants"
    ADD CONSTRAINT "event_participants_event_id_user_id_key" UNIQUE ("event_id", "user_id");



ALTER TABLE ONLY "public"."event_participants"
    ADD CONSTRAINT "event_participants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."events_new"
    ADD CONSTRAINT "events_new_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."guest_sub_event_assignments"
    ADD CONSTRAINT "guest_sub_event_assignments_guest_id_sub_event_id_key" UNIQUE ("guest_id", "sub_event_id");



ALTER TABLE ONLY "public"."guest_sub_event_assignments"
    ADD CONSTRAINT "guest_sub_event_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."media_new"
    ADD CONSTRAINT "media_new_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."media"
    ADD CONSTRAINT "media_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."message_deliveries"
    ADD CONSTRAINT "message_deliveries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."messages_new"
    ADD CONSTRAINT "messages_new_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."scheduled_messages"
    ADD CONSTRAINT "scheduled_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sub_events"
    ADD CONSTRAINT "sub_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "unique_user_phone" UNIQUE ("phone");



ALTER TABLE ONLY "public"."users_new"
    ADD CONSTRAINT "users_new_phone_key" UNIQUE ("phone");



ALTER TABLE ONLY "public"."users_new"
    ADD CONSTRAINT "users_new_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_communication_preferences_user_event" ON "public"."communication_preferences" USING "btree" ("user_id", "event_id");



CREATE INDEX "idx_event_guests_event_id" ON "public"."event_guests" USING "btree" ("event_id");



CREATE INDEX "idx_event_guests_event_role" ON "public"."event_guests" USING "btree" ("event_id", "role");



CREATE INDEX "idx_event_guests_phone" ON "public"."event_guests" USING "btree" ("phone");



CREATE INDEX "idx_event_guests_role" ON "public"."event_guests" USING "btree" ("role");



CREATE INDEX "idx_event_guests_rsvp_status" ON "public"."event_guests" USING "btree" ("rsvp_status");



CREATE INDEX "idx_event_guests_user_id" ON "public"."event_guests" USING "btree" ("user_id");



CREATE INDEX "idx_event_guests_user_role" ON "public"."event_guests" USING "btree" ("user_id", "role");



CREATE INDEX "idx_event_participants_event" ON "public"."event_participants" USING "btree" ("event_id");



CREATE INDEX "idx_event_participants_role" ON "public"."event_participants" USING "btree" ("role");



CREATE INDEX "idx_event_participants_user" ON "public"."event_participants" USING "btree" ("user_id");



CREATE INDEX "idx_events_event_date" ON "public"."events" USING "btree" ("event_date");



CREATE INDEX "idx_events_host_user_id" ON "public"."events" USING "btree" ("host_user_id");



CREATE INDEX "idx_events_is_public" ON "public"."events" USING "btree" ("is_public");



CREATE INDEX "idx_events_new_date" ON "public"."events_new" USING "btree" ("event_date");



CREATE INDEX "idx_events_new_host" ON "public"."events_new" USING "btree" ("host_user_id");



CREATE INDEX "idx_guest_sub_event_assignments_guest_id" ON "public"."guest_sub_event_assignments" USING "btree" ("guest_id");



CREATE INDEX "idx_guest_sub_event_assignments_sub_event_id" ON "public"."guest_sub_event_assignments" USING "btree" ("sub_event_id");



CREATE INDEX "idx_media_event_id" ON "public"."media" USING "btree" ("event_id");



CREATE INDEX "idx_media_media_type" ON "public"."media" USING "btree" ("media_type");



CREATE INDEX "idx_media_new_event" ON "public"."media_new" USING "btree" ("event_id");



CREATE INDEX "idx_media_uploader_user_id" ON "public"."media" USING "btree" ("uploader_user_id");



CREATE INDEX "idx_message_deliveries_guest_id" ON "public"."message_deliveries" USING "btree" ("guest_id");



CREATE INDEX "idx_message_deliveries_scheduled_message_id" ON "public"."message_deliveries" USING "btree" ("scheduled_message_id");



CREATE INDEX "idx_messages_created_at" ON "public"."messages" USING "btree" ("created_at");



CREATE INDEX "idx_messages_event_id" ON "public"."messages" USING "btree" ("event_id");



CREATE INDEX "idx_messages_new_event" ON "public"."messages_new" USING "btree" ("event_id");



CREATE INDEX "idx_messages_recipient_user_id" ON "public"."messages" USING "btree" ("recipient_user_id");



CREATE INDEX "idx_messages_sender_user_id" ON "public"."messages" USING "btree" ("sender_user_id");



CREATE INDEX "idx_scheduled_messages_event_id" ON "public"."scheduled_messages" USING "btree" ("event_id");



CREATE INDEX "idx_scheduled_messages_send_at" ON "public"."scheduled_messages" USING "btree" ("send_at");



CREATE INDEX "idx_scheduled_messages_status" ON "public"."scheduled_messages" USING "btree" ("status");



CREATE INDEX "idx_sub_events_event_id" ON "public"."sub_events" USING "btree" ("event_id");



CREATE INDEX "idx_users_email" ON "public"."users" USING "btree" ("email");



CREATE INDEX "idx_users_new_phone" ON "public"."users_new" USING "btree" ("phone");



CREATE INDEX "idx_users_phone" ON "public"."users" USING "btree" ("phone");



CREATE OR REPLACE TRIGGER "event_guests_updated_at" BEFORE UPDATE ON "public"."event_guests" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "events_updated_at" BEFORE UPDATE ON "public"."events" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "media_updated_at" BEFORE UPDATE ON "public"."media" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "messages_updated_at" BEFORE UPDATE ON "public"."messages" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "users_updated_at" BEFORE UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



ALTER TABLE ONLY "public"."communication_preferences"
    ADD CONSTRAINT "communication_preferences_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."communication_preferences"
    ADD CONSTRAINT "communication_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_guests"
    ADD CONSTRAINT "event_guests_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_guests"
    ADD CONSTRAINT "event_guests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."event_participants"
    ADD CONSTRAINT "event_participants_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events_new"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_participants"
    ADD CONSTRAINT "event_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users_new"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_host_user_id_fkey" FOREIGN KEY ("host_user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."events_new"
    ADD CONSTRAINT "events_new_host_user_id_fkey" FOREIGN KEY ("host_user_id") REFERENCES "public"."users_new"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."guest_sub_event_assignments"
    ADD CONSTRAINT "guest_sub_event_assignments_guest_id_fkey" FOREIGN KEY ("guest_id") REFERENCES "public"."event_guests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."guest_sub_event_assignments"
    ADD CONSTRAINT "guest_sub_event_assignments_sub_event_id_fkey" FOREIGN KEY ("sub_event_id") REFERENCES "public"."sub_events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."media"
    ADD CONSTRAINT "media_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."media_new"
    ADD CONSTRAINT "media_new_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events_new"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."media_new"
    ADD CONSTRAINT "media_new_uploader_user_id_fkey" FOREIGN KEY ("uploader_user_id") REFERENCES "public"."users_new"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."media"
    ADD CONSTRAINT "media_uploader_user_id_fkey" FOREIGN KEY ("uploader_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."message_deliveries"
    ADD CONSTRAINT "message_deliveries_guest_id_fkey" FOREIGN KEY ("guest_id") REFERENCES "public"."event_guests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."message_deliveries"
    ADD CONSTRAINT "message_deliveries_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."message_deliveries"
    ADD CONSTRAINT "message_deliveries_response_message_id_fkey" FOREIGN KEY ("response_message_id") REFERENCES "public"."messages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."message_deliveries"
    ADD CONSTRAINT "message_deliveries_scheduled_message_id_fkey" FOREIGN KEY ("scheduled_message_id") REFERENCES "public"."scheduled_messages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."message_deliveries"
    ADD CONSTRAINT "message_deliveries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages_new"
    ADD CONSTRAINT "messages_new_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events_new"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages_new"
    ADD CONSTRAINT "messages_new_sender_user_id_fkey" FOREIGN KEY ("sender_user_id") REFERENCES "public"."users_new"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_parent_message_id_fkey" FOREIGN KEY ("parent_message_id") REFERENCES "public"."messages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_recipient_user_id_fkey" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_sender_user_id_fkey" FOREIGN KEY ("sender_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."scheduled_messages"
    ADD CONSTRAINT "scheduled_messages_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."scheduled_messages"
    ADD CONSTRAINT "scheduled_messages_sender_user_id_fkey" FOREIGN KEY ("sender_user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sub_events"
    ADD CONSTRAINT "sub_events_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



CREATE POLICY "Authenticated users can create events" ON "public"."events" FOR INSERT TO "authenticated" WITH CHECK (("host_user_id" = "auth"."uid"()));



CREATE POLICY "Event hosts can view guest communication preferences" ON "public"."communication_preferences" FOR SELECT USING ("public"."is_event_host"("event_id"));



CREATE POLICY "Only event hosts can manage guest assignments" ON "public"."guest_sub_event_assignments" USING ((EXISTS ( SELECT 1
   FROM "public"."sub_events" "se"
  WHERE (("se"."id" = "guest_sub_event_assignments"."sub_event_id") AND "public"."is_event_host"("se"."event_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."sub_events" "se"
  WHERE (("se"."id" = "guest_sub_event_assignments"."sub_event_id") AND "public"."is_event_host"("se"."event_id")))));



CREATE POLICY "Only event hosts can manage guest list" ON "public"."event_guests" TO "authenticated" USING ("public"."is_event_host"("event_id")) WITH CHECK ("public"."is_event_host"("event_id"));



CREATE POLICY "Only event hosts can manage message deliveries" ON "public"."message_deliveries" USING ((EXISTS ( SELECT 1
   FROM "public"."scheduled_messages" "sm"
  WHERE (("sm"."id" = "message_deliveries"."scheduled_message_id") AND "public"."is_event_host"("sm"."event_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."scheduled_messages" "sm"
  WHERE (("sm"."id" = "message_deliveries"."scheduled_message_id") AND "public"."is_event_host"("sm"."event_id")))));



CREATE POLICY "Only event hosts can manage scheduled messages" ON "public"."scheduled_messages" USING ("public"."is_event_host"("event_id")) WITH CHECK ("public"."is_event_host"("event_id"));



CREATE POLICY "Only event hosts can manage sub-events" ON "public"."sub_events" USING ("public"."is_event_host"("event_id")) WITH CHECK ("public"."is_event_host"("event_id"));



CREATE POLICY "Only hosts can delete their events" ON "public"."events" FOR DELETE TO "authenticated" USING (("host_user_id" = "auth"."uid"()));



CREATE POLICY "Only hosts can update their events" ON "public"."events" FOR UPDATE TO "authenticated" USING (("host_user_id" = "auth"."uid"())) WITH CHECK (("host_user_id" = "auth"."uid"()));



CREATE POLICY "Users can delete their own media" ON "public"."media" FOR DELETE TO "authenticated" USING (("uploader_user_id" = "auth"."uid"()));



CREATE POLICY "Users can manage their own communication preferences" ON "public"."communication_preferences" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own profile" ON "public"."users" FOR UPDATE TO "authenticated" USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));



CREATE POLICY "Users can view deliveries for events they host" ON "public"."message_deliveries" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."scheduled_messages" "sm"
  WHERE (("sm"."id" = "message_deliveries"."scheduled_message_id") AND "public"."is_event_host"("sm"."event_id")))));



CREATE POLICY "Users can view guests for events they're involved in" ON "public"."event_guests" FOR SELECT TO "authenticated" USING (("public"."is_event_host"("event_id") OR ("user_id" = "auth"."uid"())));



ALTER TABLE "public"."communication_preferences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_guests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_participants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "events_manage_own" ON "public"."events_new" TO "authenticated" USING ("public"."is_event_host"("id"));



ALTER TABLE "public"."events_new" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "events_select_accessible" ON "public"."events_new" FOR SELECT TO "authenticated" USING ((("is_public" = true) OR "public"."can_access_event"("id")));



ALTER TABLE "public"."guest_sub_event_assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."media" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "media_insert_event_participant" ON "public"."media_new" FOR INSERT TO "authenticated" WITH CHECK ("public"."can_access_event"("event_id"));



ALTER TABLE "public"."media_new" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "media_select_event_accessible" ON "public"."media_new" FOR SELECT TO "authenticated" USING ("public"."can_access_event"("event_id"));



CREATE POLICY "media_update_own" ON "public"."media_new" FOR UPDATE TO "authenticated" USING (("uploader_user_id" = "auth"."uid"()));



ALTER TABLE "public"."message_deliveries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "messages_insert_event_participant" ON "public"."messages_new" FOR INSERT TO "authenticated" WITH CHECK ("public"."can_access_event"("event_id"));



ALTER TABLE "public"."messages_new" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "messages_select_event_accessible" ON "public"."messages_new" FOR SELECT TO "authenticated" USING ("public"."can_access_event"("event_id"));



CREATE POLICY "participants_manage_as_host" ON "public"."event_participants" TO "authenticated" USING ("public"."is_event_host"("event_id"));



CREATE POLICY "participants_select_event_related" ON "public"."event_participants" FOR SELECT TO "authenticated" USING ("public"."can_access_event"("event_id"));



ALTER TABLE "public"."scheduled_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sub_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users_new" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users_select_event_related" ON "public"."users_new" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (("public"."events_new" "e"
     LEFT JOIN "public"."event_participants" "ep1" ON ((("ep1"."event_id" = "e"."id") AND ("ep1"."user_id" = "auth"."uid"()))))
     LEFT JOIN "public"."event_participants" "ep2" ON ((("ep2"."event_id" = "e"."id") AND ("ep2"."user_id" = "users_new"."id"))))
  WHERE ((("e"."host_user_id" = "auth"."uid"()) OR ("ep1"."user_id" = "auth"."uid"())) AND (("e"."host_user_id" = "users_new"."id") OR ("ep2"."user_id" = "users_new"."id"))))));



CREATE POLICY "users_select_own" ON "public"."users_new" FOR SELECT TO "authenticated" USING (("id" = "auth"."uid"()));



CREATE POLICY "users_update_own" ON "public"."users_new" FOR UPDATE TO "authenticated" USING (("id" = "auth"."uid"()));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";





GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

















































































































































































GRANT ALL ON FUNCTION "public"."can_access_event"("p_event_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_access_event"("p_event_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_access_event"("p_event_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_view_user_profile"("target_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_view_user_profile"("target_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_view_user_profile"("target_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_ready_scheduled_messages"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_ready_scheduled_messages"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_ready_scheduled_messages"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_sub_event_guests"("p_sub_event_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_sub_event_guests"("p_sub_event_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_sub_event_guests"("p_sub_event_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_event_role"("p_event_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_event_role"("p_event_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_event_role"("p_event_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_events"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_events"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_events"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_development_phone"("p_phone" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."is_development_phone"("p_phone" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_development_phone"("p_phone" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_event_host"("p_event_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_event_host"("p_event_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_event_host"("p_event_id" "uuid") TO "service_role";


















GRANT ALL ON TABLE "public"."communication_preferences" TO "anon";
GRANT ALL ON TABLE "public"."communication_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."communication_preferences" TO "service_role";



GRANT ALL ON TABLE "public"."event_guests" TO "anon";
GRANT ALL ON TABLE "public"."event_guests" TO "authenticated";
GRANT ALL ON TABLE "public"."event_guests" TO "service_role";



GRANT ALL ON TABLE "public"."event_participants" TO "anon";
GRANT ALL ON TABLE "public"."event_participants" TO "authenticated";
GRANT ALL ON TABLE "public"."event_participants" TO "service_role";



GRANT ALL ON TABLE "public"."events" TO "anon";
GRANT ALL ON TABLE "public"."events" TO "authenticated";
GRANT ALL ON TABLE "public"."events" TO "service_role";



GRANT ALL ON TABLE "public"."events_new" TO "anon";
GRANT ALL ON TABLE "public"."events_new" TO "authenticated";
GRANT ALL ON TABLE "public"."events_new" TO "service_role";



GRANT ALL ON TABLE "public"."guest_sub_event_assignments" TO "anon";
GRANT ALL ON TABLE "public"."guest_sub_event_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."guest_sub_event_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."media" TO "anon";
GRANT ALL ON TABLE "public"."media" TO "authenticated";
GRANT ALL ON TABLE "public"."media" TO "service_role";



GRANT ALL ON TABLE "public"."media_new" TO "anon";
GRANT ALL ON TABLE "public"."media_new" TO "authenticated";
GRANT ALL ON TABLE "public"."media_new" TO "service_role";



GRANT ALL ON TABLE "public"."message_deliveries" TO "anon";
GRANT ALL ON TABLE "public"."message_deliveries" TO "authenticated";
GRANT ALL ON TABLE "public"."message_deliveries" TO "service_role";



GRANT ALL ON TABLE "public"."messages" TO "anon";
GRANT ALL ON TABLE "public"."messages" TO "authenticated";
GRANT ALL ON TABLE "public"."messages" TO "service_role";



GRANT ALL ON TABLE "public"."messages_new" TO "anon";
GRANT ALL ON TABLE "public"."messages_new" TO "authenticated";
GRANT ALL ON TABLE "public"."messages_new" TO "service_role";



GRANT ALL ON TABLE "public"."users_new" TO "anon";
GRANT ALL ON TABLE "public"."users_new" TO "authenticated";
GRANT ALL ON TABLE "public"."users_new" TO "service_role";



GRANT ALL ON TABLE "public"."public_user_profiles" TO "anon";
GRANT ALL ON TABLE "public"."public_user_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."public_user_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."scheduled_messages" TO "anon";
GRANT ALL ON TABLE "public"."scheduled_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."scheduled_messages" TO "service_role";



GRANT ALL ON TABLE "public"."sub_events" TO "anon";
GRANT ALL ON TABLE "public"."sub_events" TO "authenticated";
GRANT ALL ON TABLE "public"."sub_events" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";






























RESET ALL;
