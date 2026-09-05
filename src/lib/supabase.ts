/**
 * SpillScan - Supabase Browser Client & Realtime Manager
 * Safe for client-side execution (uses anon key).
 * Works offline/with or without configured remote credentials.
 */

import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { Database } from '../types/database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = (): boolean => {
  return Boolean(
    supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl.startsWith('https://') &&
    !supabaseUrl.includes('placeholder')
  );
};

// Create client instance if env vars provided, else a null-safe client
export const supabase: SupabaseClient<Database> | null = isSupabaseConfigured()
  ? createClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    })
  : null;

/**
 * Storage Bucket Constants
 */
export const STORAGE_BUCKETS = {
  DATASETS: 'spillscan-datasets',
  SAR_IMAGES: 'spillscan-sar',
  RESULTS: 'spillscan-results',
  REPORTS: 'spillscan-reports',
} as const;

/**
 * Realtime subscription helper for analysis progress events
 */
export function subscribeToAnalysisEvents(
  analysisId: string,
  onEvent: (event: { stage: string; progress: number; message: string; payload?: any }) => void
): { unsubscribe: () => void } {
  if (!supabase || !isSupabaseConfigured()) {
    // Return no-op unsubscriber if Supabase Realtime is not active
    return { unsubscribe: () => {} };
  }

  const channel: RealtimeChannel = supabase
    .channel(`analysis-${analysisId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'analysis_events',
        filter: `analysis_id=eq.${analysisId}`,
      },
      (payload) => {
        if (payload.new) {
          onEvent({
            stage: payload.new.stage,
            progress: payload.new.progress,
            message: payload.new.message,
            payload: payload.new.payload,
          });
        }
      }
    )
    .subscribe();

  return {
    unsubscribe: () => {
      supabase?.removeChannel(channel);
    },
  };
}
