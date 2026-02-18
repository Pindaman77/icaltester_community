-- Add default_booking_status column to calendars table
ALTER TABLE calendars 
ADD COLUMN default_booking_status text NOT NULL DEFAULT 'tentative'
CHECK (default_booking_status = ANY (ARRAY['pending'::text, 'tentative'::text, 'confirmed'::text]));