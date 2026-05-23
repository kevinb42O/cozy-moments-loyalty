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
          birthday_day: number | null;
          birthday_month: number | null;
          birthday_year: number | null;
          must_reset_password: boolean;
          created_by_admin_email: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['customers']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['customers']['Insert']>;
      };
      customer_push_preferences: {
        Row: {
          customer_id: string;
          push_enabled: boolean;
          promo_opt_in: boolean;
          reward_opt_in: boolean;
          reminder_opt_in: boolean;
          quiet_hours_start: string;
          quiet_hours_end: string;
          muted_until: string | null;
          consent_source: string | null;
          consent_updated_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['customer_push_preferences']['Row']> & { customer_id: string };
        Update: Partial<Database['public']['Tables']['customer_push_preferences']['Row']>;
      };
      customer_push_subscriptions: {
        Row: {
          id: string;
          customer_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          platform: string | null;
          user_agent: string | null;
          installed_mode: string;
          is_active: boolean;
          last_seen_at: string | null;
          last_error_at: string | null;
          last_error_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['customer_push_subscriptions']['Row']> & {
          customer_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
        };
        Update: Partial<Database['public']['Tables']['customer_push_subscriptions']['Row']>;
      };
      push_campaigns: {
        Row: {
          id: string;
          campaign_type: string;
          delivery_category: string;
          template_key: string | null;
          title: string;
          body: string;
          deeplink: string;
          audience_mode: string;
          audience_filters: Record<string, unknown>;
          estimated_recipients: number;
          actual_recipients: number;
          sent_count: number;
          failure_count: number;
          click_count: number;
          status: string;
          created_by_admin_email: string | null;
          scheduled_for: string | null;
          sent_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['push_campaigns']['Row']> & {
          campaign_type: string;
          delivery_category: string;
          title: string;
          body: string;
        };
        Update: Partial<Database['public']['Tables']['push_campaigns']['Row']>;
      };
      push_delivery_events: {
        Row: {
          id: number;
          campaign_id: string | null;
          customer_id: string | null;
          subscription_id: string | null;
          status: string;
          provider_message_id: string | null;
          opened_path: string | null;
          error_code: string | null;
          error_message: string | null;
          clicked_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['push_delivery_events']['Row']> & { status: string };
        Update: Partial<Database['public']['Tables']['push_delivery_events']['Row']>;
      };
      site_settings: {
        Row: {
          id: string;
          promo_message: string;
          push_settings: Record<string, unknown>;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['site_settings']['Row']>;
        Update: Partial<Database['public']['Tables']['site_settings']['Row']>;
      };
    };
  };
};
