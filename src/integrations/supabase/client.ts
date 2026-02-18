import { createClient } from '@supabase/supabase-js';
import { AppRole } from '@/rbac/types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    "Missing Supabase env: set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env (see .env.example)"
  );
}

export { SUPABASE_URL, SUPABASE_ANON_KEY };
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Database types
export type Calendar = {
  id: string;
  user_id: string;
  name: string;
  feed_token: string;
  include_imported_in_export?: boolean;
  default_booking_status?: "pending" | "tentative" | "confirmed";
  poll_interval_minutes: number;
  created_at: string;
  updated_at: string;
  // Computed field: canonical feed URL (backend returns this)
  public_feed_url?: string;
  // Computed field: relative feed URL for UI display
  public_feed_path?: string;
};

export type Booking = {
  id: string;
  calendar_id: string;
  uid: string;
  summary: string;
  start_date: string;
  end_date: string;
  status: 'confirmed' | 'cancelled' | 'tentative' | 'pending';
  source: 'manual' | 'imported';
  created_at: string;
  updated_at: string;
};

export type Subscription = {
  id: string;
  calendar_id: string;
  name: string;
  ical_url: string;
  enabled?: boolean;
  poll_interval_sec?: number;
  next_due_at?: string;
  last_synced_at: string | null;
  last_status?: number | null;
  last_error?: string | null;
  created_at: string;
};

export type ImportedEvent = {
  id: string;
  subscription_id: string;
  calendar_id: string;
  source_uid: string;
  start_date: string;
  end_date: string;
  summary: string;
  status: 'confirmed' | 'cancelled';
  updated_at: string;
};

export type SyncLog = {
  id: string;
  calendar_id: string;
  subscription_id: string | null;
  direction: 'import' | 'export';
  status: 'success' | 'error';
  message: string | null;
  events_added: number | null;
  events_updated: number | null;
  events_removed: number | null;
  ran_at?: string | null;
  http_status?: number | null;
  bytes?: number | null;
  vevent_count?: number | null;
  created_at?: string;
};

export type UserRole = {
  user_id: string;
  role: AppRole;
};
