import { createClient } from '@supabase/supabase-js';

// The anon key is public by design; RLS restricts it to reading published content
// (verified in supabase/migrations — anon has SELECT-only grants).
const SUPABASE_URL = 'https://gjffozmcbdtafdsxifyq.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqZmZvem1jYmR0YWZkc3hpZnlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3MTI1NTcsImV4cCI6MjA5OTI4ODU1N30.A-0IuKpQGyz8ZxlXtkr1CbfDA1YhySOqeXU_FqCcZQc';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false }, // no end-user accounts in v1
});
