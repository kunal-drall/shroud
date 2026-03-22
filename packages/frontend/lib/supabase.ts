import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const supabase = url && key ? createClient(url, key) : null;

export interface CircleRow {
  address:             string;
  circle_id:           string;
  member_count:        number;
  contribution_amount: string;
  state:               number;
  joined:              number;
}
