-- Drop the old constraint
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check;

-- Add the new constraint with 'pending' included
ALTER TABLE bookings ADD CONSTRAINT bookings_status_check 
  CHECK (status = ANY (ARRAY['confirmed'::text, 'cancelled'::text, 'tentative'::text, 'pending'::text]));