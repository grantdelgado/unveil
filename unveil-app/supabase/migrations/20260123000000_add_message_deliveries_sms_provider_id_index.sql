-- Add index to speed up sms_provider_id lookups
create index if not exists message_deliveries_sms_provider_id_idx
on public.message_deliveries (sms_provider_id);

-- Verification
select indexname, indexdef
from pg_indexes
where tablename = 'message_deliveries'
  and indexname = 'message_deliveries_sms_provider_id_idx';
