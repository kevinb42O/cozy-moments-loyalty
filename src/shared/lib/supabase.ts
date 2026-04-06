import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const SUPABASE_READY = Boolean(supabaseUrl && supabaseAnonKey);
export const SUPABASE_URL = supabaseUrl ?? '';
export const SUPABASE_ANON_KEY = supabaseAnonKey ?? '';

// Supabase client — only created when env vars are present.
// If not configured yet, the app falls back to localStorage (dev mode).
export const supabase = SUPABASE_READY
  ? createClient(supabaseUrl!, supabaseAnonKey!)
  : null;

export type Database = {
  public: {
    Tables: {
      customers: {
        Row: {
          id: string;
          name: string;
          email: string;
          login_email: string;
          login_alias: string | null;
          coffee_stamps: number;
          wine_stamps: number;
          beer_stamps: number;
          soda_stamps: number;
          coffee_rewards: number;
          wine_rewards: number;
          beer_rewards: number;
          soda_rewards: number;
          coffee_claimed: number;
          wine_claimed: number;
          beer_claimed: number;
          soda_claimed: number;
          total_visits: number;
          last_visit_at: string | null;
          welcome_bonus_claimed: boolean;
          bonus_card_type: string | null;
          must_reset_password: boolean;
          created_by_admin_email: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['customers']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['customers']['Insert']>;
      };
    };
  };
};
