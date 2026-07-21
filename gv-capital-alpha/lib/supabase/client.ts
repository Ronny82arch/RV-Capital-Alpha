import { createClient } from '@supabase/supabase-js';

// TODO: Sostituire con i tipi generati da Supabase CLI (es. `npx supabase gen types typescript --project-id abcdef > types/supabase.ts`)
export type Database = {
  public: {
    Tables: {
      trading_signals: {
        Row: {
          id: string;
          portfolio_id: string;
          ticker: string;
          state: string;
          requested_price: number | null;
          executed_price: number | null;
          kelly_allocation: number | null;
          created_at: string;
        };
        Insert: any;
        Update: any;
      };
      execution_logs: {
        Row: {
          id: string;
          signal_id: string;
          slippage: number;
          executed_at: string;
        };
        Insert: any;
        Update: any;
      };
      goal_trajectory_logs: {
        Row: {
          id: string;
          portfolio_id: string;
          p10: number;
          p50: number;
          p90: number;
          actual_value: number;
          logged_at: string;
        };
        Insert: any;
        Update: any;
      };
      portfolios: {
        Row: {
          id: string;
          user_id: string;
          active_assets: string[];
        };
        Insert: any;
        Update: any;
      }
    }
  }
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/**
 * Client Supabase standard per il Frontend. 
 * Rispetta la Row Level Security (RLS). 
 * Se usato server-side, va passata la sessione dell'utente.
 */
export const supabase = createClient<any>(supabaseUrl, supabaseAnonKey);

/**
 * Client Supabase con privilegi di amministratore (Bypassa RLS).
 * Da usare ESCLUSIVAMENTE nei background workers e API CRON server-side.
 */
export const supabaseAdmin = createClient<any>(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

/**
 * Crea un client Supabase server-side autenticato per conto di uno specifico utente.
 * Rispetta la RLS limitata a quell'utente.
 * @param userAccessToken Il token JWT dell'utente
 */
export function createAuthenticatedClient(userAccessToken: string) {
  return createClient<any>(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${userAccessToken}`
      }
    }
  });
}
