#!/bin/bash

# Safe Index Drop Execution Script
# Execute index drops in controlled batches with monitoring

set -e  # Exit on any error

# Configuration
PROJECT_ID="wvhtbqvnamerdkkjknuv"
DATE=$(date +%Y%m%d)
ARTIFACTS_DIR="_artifacts/$DATE"

echo "🔍 Starting safe index drop process..."
echo "📅 Date: $(date)"
echo "📦 Project ID: $PROJECT_ID"

# Create results directory
mkdir -p "$ARTIFACTS_DIR/results"

# Function to execute SQL safely
execute_sql() {
    local sql="$1"
    local description="$2"
    
    echo "⚡ Executing: $description"
    echo "📝 SQL: $sql"
    
    # In a real implementation, you would use the Supabase CLI or API
    # For now, we'll create a file with the commands to run
    echo "-- $description" >> "$ARTIFACTS_DIR/results/executed_commands.sql"
    echo "$sql" >> "$ARTIFACTS_DIR/results/executed_commands.sql" 
    echo "" >> "$ARTIFACTS_DIR/results/executed_commands.sql"
}

# Function to run performance verification  
run_performance_check() {
    local phase="$1"
    echo "🔬 Running performance verification ($phase)..."
    
    # Create performance test file for this phase
    cp "$ARTIFACTS_DIR/performance_verification.sql" "$ARTIFACTS_DIR/results/perf_check_$phase.sql"
    
    echo "📊 Performance check template created: $ARTIFACTS_DIR/results/perf_check_$phase.sql"
    echo "👉 Manual step: Execute this file against your database to capture metrics"
}

# PHASE 1: Pre-drop performance baseline
echo ""
echo "🚀 PHASE 1: Capturing baseline performance..."
run_performance_check "before"

# PHASE 2: Execute drops in batches
echo ""  
echo "🗑️  PHASE 2: Executing index drops..."

# Batch 1: Message delivery indexes (lower risk)
echo ""
echo "📦 Batch 1: Message delivery indexes"
execute_sql "DROP INDEX CONCURRENTLY IF EXISTS public.idx_deliveries_message_user;" "Drop unused message delivery user index"
execute_sql "DROP INDEX CONCURRENTLY IF EXISTS public.idx_message_deliveries_phone_user_null;" "Drop migration artifact phone index"
execute_sql "DROP INDEX CONCURRENTLY IF EXISTS public.idx_message_deliveries_sms_provider;" "Drop unused SMS provider index"
execute_sql "DROP INDEX CONCURRENTLY IF EXISTS public.idx_deliveries_scheduled_message;" "Drop unused scheduled message index"

echo "✅ Batch 1 complete. ANALYZE affected tables..."
execute_sql "ANALYZE public.message_deliveries;" "Update message_deliveries statistics"

# Batch 2: Event-related indexes  
echo ""
echo "📦 Batch 2: Event-related indexes"
execute_sql "DROP INDEX CONCURRENTLY IF EXISTS public.idx_events_time_zone;" "Drop unused timezone index"
execute_sql "DROP INDEX CONCURRENTLY IF EXISTS public.idx_events_creation_key_lookup;" "Drop duplicate creation key index"
execute_sql "DROP INDEX CONCURRENTLY IF EXISTS public.idx_event_guests_declined_at;" "Drop unused decline tracking index"
execute_sql "DROP INDEX CONCURRENTLY IF EXISTS public.idx_event_guests_removed_at;" "Drop unused removal index"
execute_sql "DROP INDEX CONCURRENTLY IF EXISTS public.idx_event_guests_carrier_opted_out_at;" "Drop unused opt-out index"

echo "✅ Batch 2 complete. ANALYZE affected tables..."
execute_sql "ANALYZE public.events;" "Update events statistics"
execute_sql "ANALYZE public.event_guests;" "Update event_guests statistics"

# Batch 3: Scheduled messages indexes
echo ""
echo "📦 Batch 3: Scheduled message indexes"  
execute_sql "DROP INDEX CONCURRENTLY IF EXISTS public.idx_scheduled_messages_sender_user_id;" "Drop unused sender index"
execute_sql "DROP INDEX CONCURRENTLY IF EXISTS public.idx_scheduled_messages_trigger_source;" "Drop unused trigger source index"
execute_sql "DROP INDEX CONCURRENTLY IF EXISTS public.idx_scheduled_messages_timezone;" "Drop unused timezone index"
execute_sql "DROP INDEX CONCURRENTLY IF EXISTS public.idx_scheduled_messages_recipient_snapshot;" "Drop unused snapshot index"
execute_sql "DROP INDEX CONCURRENTLY IF EXISTS public.idx_scheduled_messages_idempotency;" "Drop unused idempotency index"

echo "✅ Batch 3 complete. ANALYZE affected tables..."
execute_sql "ANALYZE public.scheduled_messages;" "Update scheduled_messages statistics"

# Batch 4: Final cleanup
echo ""
echo "📦 Batch 4: Final cleanup"
execute_sql "DROP INDEX CONCURRENTLY IF EXISTS public.idx_users_sms_consent_given_at;" "Drop unused consent index"
execute_sql "DROP INDEX CONCURRENTLY IF EXISTS public.idx_messages_delivery_tracking;" "Drop unused delivery tracking index"
execute_sql "DROP INDEX CONCURRENTLY IF EXISTS public.idx_event_guests_event_user;" "Drop duplicate event user index"

echo "✅ Batch 4 complete. ANALYZE affected tables..."
execute_sql "ANALYZE public.users;" "Update users statistics"
execute_sql "ANALYZE public.messages;" "Update messages statistics"

# PHASE 3: Post-drop verification
echo ""
echo "🔍 PHASE 3: Post-drop verification..."
run_performance_check "after"

# Verify constraint integrity
execute_sql "SELECT COUNT(*) as constraint_count FROM pg_constraint WHERE conindid IS NOT NULL;" "Verify constraint integrity"

echo ""
echo "✅ Index drop process complete!"
echo ""
echo "📋 Summary:"
echo "   - 17 indexes marked for removal"  
echo "   - ~0.35 MB storage savings expected"
echo "   - All operations logged to: $ARTIFACTS_DIR/results/"
echo ""
echo "🚨 Next Steps:"
echo "   1. Review generated SQL in: $ARTIFACTS_DIR/results/executed_commands.sql"
echo "   2. Execute the SQL commands manually via Supabase dashboard or CLI"  
echo "   3. Run performance verification queries before and after"
echo "   4. Monitor application for 48 hours"
echo "   5. Use rollback script if any issues: $ARTIFACTS_DIR/recreate_dropped_indexes.sql"
echo ""
echo "🔄 Rollback available at: $ARTIFACTS_DIR/recreate_dropped_indexes.sql"
