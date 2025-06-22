-- Add test guests with phone numbers for SMS testing
-- Replace 'your-event-id' with your actual event ID

INSERT INTO event_guests (
  event_id,
  guest_name,
  guest_email,
  phone,
  rsvp_status,
  sms_opt_out
) VALUES 
  -- Replace with your actual event ID
  ('your-event-id', 'Test Guest 1', 'test1@example.com', '+1234567890', 'Pending', false),
  ('your-event-id', 'Test Guest 2', 'test2@example.com', '+1234567891', null, false),
  ('your-event-id', 'Test Guest 3', 'test3@example.com', '+1234567892', 'Attending', false);

-- Note: For Twilio trial accounts, you can only send SMS to verified phone numbers
-- Add your own phone number to test:
-- ('your-event-id', 'Your Name', 'your@email.com', '+your-real-number', 'Pending', false); 