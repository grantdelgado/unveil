#!/bin/bash

# Batch 1 Execution Commands
# Execute these commands in order, monitoring each step

set -e

PROJECT_ID="wvhtbqvnamerdkkjknuv"
BATCH_DIR="_artifacts/20250925"

echo "🚀 Starting Batch 1: Message Delivery Index Cleanup"
echo "📅 $(date)"
echo ""

# Record current database state
echo "📊 Recording current database stats..."
echo "-- Batch 1 Pre-Drop Stats - $(date)" > "$BATCH_DIR/batch_1_pre_stats.sql"
echo ""

# Sample IDs for testing (replace these with actual IDs from your data)
export SAMPLE_EVENT_ID="41191573-7726-4b98-a7c9-a27d139af93a"
export SAMPLE_MESSAGE_ID="ebecdc5f-7944-46aa-83b3-42fda599648d" 
export SAMPLE_USER_ID="7a4ce708-0555-4db2-b181-b7404857f118"

echo "🔍 Using sample IDs for testing:"
echo "Event ID: $SAMPLE_EVENT_ID"
echo "Message ID: $SAMPLE_MESSAGE_ID"  
echo "User ID: $SAMPLE_USER_ID"
echo ""

echo "📋 Batch 1 will drop 5 unused indexes:"
echo "  - idx_deliveries_message_user (0.06 MB)"
echo "  - idx_message_deliveries_phone_user_null (0.02 MB)"
echo "  - idx_message_deliveries_sms_provider (0.01 MB)"
echo "  - idx_deliveries_scheduled_message (0.01 MB)"
echo "  - idx_messages_delivery_tracking (0.02 MB)"
echo ""
echo "💾 Expected storage savings: ~0.12 MB"
echo ""

echo "⚠️  EXECUTE THESE COMMANDS MANUALLY:"
echo ""
echo "# 1) Record stats window"
echo 'echo "SELECT now() AS timestamp, (SELECT now() - stats_reset FROM pg_stat_database WHERE datname = current_database()) AS stats_window;" | psql [YOUR_DB_CONNECTION]'
echo ""
echo "# 2) Execute Batch 1 drops"  
echo "psql [YOUR_DB_CONNECTION] -v ON_ERROR_STOP=1 -f _artifacts/20250925/drop_batch_1.sql"
echo ""
echo "# 3) Run performance verification"
echo "psql [YOUR_DB_CONNECTION] -v ON_ERROR_STOP=1 -c \""
echo "-- Performance verification queries with actual IDs"
echo "-- Test 1: Last 50 messages by event"
echo "EXPLAIN (ANALYZE, BUFFERS) SELECT id, content, created_at, sender_user_id, message_type FROM messages WHERE event_id = '$SAMPLE_EVENT_ID' ORDER BY created_at DESC, id DESC LIMIT 50;"
echo ""
echo "-- Test 2: Message deliveries by message_id"
echo "EXPLAIN (ANALYZE, BUFFERS) SELECT md.id, md.guest_id, md.user_id, md.status, md.delivered_at FROM message_deliveries md WHERE md.message_id = '$SAMPLE_MESSAGE_ID' ORDER BY md.created_at DESC;"
echo ""
echo "-- Test 3: Message delivery user lookup (should still work without dropped index)"
echo "EXPLAIN (ANALYZE, BUFFERS) SELECT md.id, md.message_id, md.status FROM message_deliveries md WHERE md.user_id = '$SAMPLE_USER_ID' ORDER BY md.created_at DESC LIMIT 20;"
echo "\" | tee _artifacts/20250925/after_batch_1_plans.txt"
echo ""

echo "✅ After execution, check _artifacts/20250925/after_batch_1_plans.txt"
echo "🔄 If any performance regression, use rollback commands:"
echo ""
echo "# Rollback individual indexes if needed:"
echo "grep -A 3 'idx_deliveries_message_user' _artifacts/20250925/recreate_dropped_indexes.sql"
echo "# Then execute the CREATE INDEX CONCURRENTLY command manually"
echo ""

echo "🎯 Success criteria:"
echo "  ✓ All 5 indexes dropped successfully"
echo "  ✓ Query plans still use appropriate indexes"
echo "  ✓ No sequential scans on large tables"
echo "  ✓ Execution times stable or improved"
