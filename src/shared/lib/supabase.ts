import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const SUPABASE_READY = Boolean(supabaseUrl && supabaseAnonKey);

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
          coffee_stamps: number;
          wine_stamps: number;
          beer_stamps: number;
          coffee_rewards: number;
          wine_rewards: number;
          beer_rewards: number;
          coffee_claimed: number;
          wine_claimed: number;
          beer_claimed: number;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['customers']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['customers']['Insert']>;
      };
    };
  };
};
