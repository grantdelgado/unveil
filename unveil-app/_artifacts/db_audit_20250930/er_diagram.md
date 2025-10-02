# Entity Relationship Diagram

**Generated:** September 30, 2025  
**Focus:** Core application tables in public schema  

## Mermaid ER Diagram

```mermaid
erDiagram
    %% Core User Management
    users {
        uuid id PK "auth.uid()"
        text phone UK "E.164 format"
        text full_name
        text avatar_url
        boolean onboarding_completed
        text intended_redirect
        timestamp_with_time_zone sms_consent_given_at
        text sms_consent_ip_address
        text sms_consent_user_agent
        timestamp_with_time_zone created_at
        timestamp_with_time_zone updated_at
    }

    %% Event Management
    events {
        uuid id PK "gen_random_uuid()"
        text title
        date event_date
        text location
        text description
        uuid host_user_id FK
        text header_image_url
        boolean is_public
        boolean allow_open_signup
        text website_url
        text time_zone "IANA timezone"
        text photo_album_url
        uuid creation_key
        text sms_tag "SMS header tag"
        timestamp_with_time_zone created_at
        timestamp_with_time_zone updated_at
    }

    event_schedule_items {
        uuid id PK "gen_random_uuid()"
        uuid event_id FK
        text title
        timestamp_with_time_zone start_at
        timestamp_with_time_zone end_at
        text attire
        text location
        timestamp_with_time_zone created_at
        timestamp_with_time_zone updated_at
    }

    %% Guest Management
    event_guests {
        uuid id PK "gen_random_uuid()"
        uuid event_id FK
        uuid user_id FK "nullable"
        text guest_name
        text phone "E.164 format"
        text notes
        text[] guest_tags
        text role "guest|host|admin"
        timestamp_with_time_zone invited_at
        timestamp_with_time_zone last_invited_at
        timestamp_with_time_zone first_invited_at
        integer invite_attempts
        timestamp_with_time_zone joined_at
        timestamp_with_time_zone declined_at "RSVP-Lite"
        text decline_reason
        timestamp_with_time_zone removed_at
        timestamp_with_time_zone last_messaged_at
        boolean phone_number_verified
        boolean sms_opt_out
        varchar preferred_communication
        text display_name "computed"
        timestamp_with_time_zone created_at
        timestamp_with_time_zone updated_at
    }

    %% Messaging System
    messages {
        uuid id PK "gen_random_uuid()"
        uuid event_id FK
        uuid sender_user_id FK "nullable"
        text content
        message_type_enum message_type "direct|announcement|channel"
        integer delivered_count "DEPRECATED"
        integer failed_count "DEPRECATED"
        timestamp_with_time_zone delivered_at
        uuid scheduled_message_id FK "nullable"
        timestamp_with_time_zone created_at
    }

    scheduled_messages {
        uuid id PK "gen_random_uuid()"
        uuid event_id FK
        uuid sender_user_id FK
        varchar subject "500 chars"
        text content
        message_type_enum message_type
        timestamp_with_time_zone send_at
        boolean target_all_guests
        uuid[] target_sub_event_ids
        text[] target_guest_tags
        uuid[] target_guest_ids
        boolean send_via_sms
        boolean send_via_push
        varchar status "scheduled|sending|sent|failed|cancelled"
        timestamp_with_time_zone sent_at
        integer recipient_count
        integer success_count
        integer failure_count
        text scheduled_tz "IANA timezone"
        text scheduled_local
        text idempotency_key "SHA256 hash"
        jsonb recipient_snapshot
        integer version
        timestamp_with_time_zone modified_at
        integer modification_count
        text trigger_source "manual|event_reminder"
        uuid trigger_ref_id "schedule item reference"
        timestamp_with_time_zone created_at
        timestamp_with_time_zone updated_at
    }

    message_deliveries {
        uuid id PK "gen_random_uuid()"
        uuid scheduled_message_id FK "nullable"
        uuid message_id FK
        uuid guest_id FK "nullable"
        varchar phone_number "E.164"
        uuid user_id FK "nullable"
        varchar sms_status "pending|sent|delivered|failed|undelivered"
        varchar push_status "pending|sent|delivered|failed|not_applicable"
        varchar sms_provider_id "Twilio SID"
        varchar push_provider_id
        boolean has_responded
        uuid response_message_id FK "nullable"
        timestamp_with_time_zone created_at
        timestamp_with_time_zone updated_at
    }

    %% Media Management
    media {
        uuid id PK "gen_random_uuid()"
        uuid event_id FK
        uuid uploader_user_id FK "nullable"
        text storage_path "Supabase Storage path"
        text media_type "image|video"
        text caption "nullable"
        timestamp_with_time_zone created_at
    }

    %% Audit & Monitoring
    user_link_audit {
        uuid id PK "gen_random_uuid()"
        text table_name
        uuid record_id
        uuid event_id FK
        text normalized_phone
        uuid matched_guest_id FK "nullable"
        uuid linked_user_id FK "nullable"
        user_link_outcome_enum outcome "linked|no_match|ambiguous|skipped"
        timestamp_with_time_zone created_at
    }

    user_link_audit_purge_runs {
        bigint id PK "IDENTITY"
        timestamp_with_time_zone ran_at
        integer retain_days
        integer rows_deleted
        timestamp_with_time_zone cutoff_date
    }

    %% Performance Monitoring
    rum_events {
        bigint id PK "SEQUENCE"
        timestamp_with_time_zone ts
        text route
        text metric "LCP|INP|CLS"
        numeric value
        text device "mobile|desktop"
        text build_id "nullable"
    }

    index_usage_snapshots {
        bigint id PK "IDENTITY"
        timestamp_with_time_zone captured_at
        text table_name
        text index_name
        bigint idx_scan
        bigint idx_tup_read
        bigint idx_tup_fetch
    }

    %% Relationships - Core Domain
    users ||--o{ events : "hosts"
    users ||--o{ event_guests : "links to"
    users ||--o{ messages : "sends"
    users ||--o{ scheduled_messages : "creates"
    users ||--o{ media : "uploads"

    events ||--o{ event_guests : "has guests"
    events ||--o{ event_schedule_items : "has schedule"
    events ||--o{ messages : "contains"
    events ||--o{ scheduled_messages : "has scheduled"
    events ||--o{ media : "contains"
    events ||--o{ user_link_audit : "audit trail"

    event_guests ||--o{ message_deliveries : "receives"
    event_guests ||--o{ user_link_audit : "audit matches"

    %% Messaging Relationships
    messages ||--o{ message_deliveries : "delivered to"
    messages ||--o{ message_deliveries : "responses" 
    scheduled_messages ||--o{ messages : "generates"
    scheduled_messages ||--o{ message_deliveries : "tracks delivery"

    %% Schedule Integration
    event_schedule_items ||--o{ scheduled_messages : "triggers reminders"

    %% Audit Relationships
    user_link_audit }o--|| events : "event context"
    user_link_audit }o--o| event_guests : "matched guest"
    user_link_audit }o--o| users : "linked user"
```

## Schema Relationships Summary

### Primary Entity Flows

1. **User → Event → Guests**
   - Users create events and become hosts
   - Events have multiple guests (event_guests table)
   - Guests can be linked or unlinked users

2. **Event → Messaging → Deliveries**
   - Events contain messages and scheduled messages
   - Messages generate deliveries to specific guests
   - Delivery tracking per guest per message

3. **Schedule → Reminders → Messages**
   - Schedule items can trigger automatic reminders
   - Reminders create scheduled messages
   - Scheduled messages generate actual messages

### Key Design Patterns

1. **Event-Scoped Data:** All core tables reference events for proper isolation
2. **User-Guest Duality:** Guests can exist without users (phone-only) or be linked to users
3. **Message Delivery Tracking:** Separate delivery records for each recipient
4. **Audit Trail:** Comprehensive linking audit for phone number matching

### Foreign Key Integrity

All foreign key relationships verified with **0 orphan records** detected:
- ✅ event_guests → events (0 orphans)
- ✅ event_guests → users (0 orphans)
- ✅ messages → events (0 orphans)
- ✅ message_deliveries → messages (0 orphans)
- ✅ message_deliveries → event_guests (0 orphans)
- ✅ scheduled_messages → events (0 orphans)

---
*ER diagram generated from live database schema analysis*
