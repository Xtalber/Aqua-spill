/**
 * SpillScan Server-Side Supabase Client & Storage Engine
 * Keeps SUPABASE_SERVICE_ROLE_KEY strictly isolated on the server.
 * Handles database operations, storage buckets, and realtime event emissions.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../src/types/database.types';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

export const isServerSupabaseConfigured = (): boolean => {
  return Boolean(
    supabaseUrl &&
    serviceRoleKey &&
    supabaseUrl.startsWith('https://') &&
    !supabaseUrl.includes('placeholder')
  );
};

export const supabaseServer: SupabaseClient<Database> | null = isServerSupabaseConfigured()
  ? createClient<Database>(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  : null;

export const BUCKETS = {
  DATASETS: 'spillscan-datasets',
  SAR: 'spillscan-sar',
  RESULTS: 'spillscan-results',
  REPORTS: 'spillscan-reports',
} as const;

/**
 * Upload a Buffer or text to Supabase Storage
 */
export async function uploadToStorage(
  bucket: keyof typeof BUCKETS | string,
  filePath: string,
  fileData: Buffer | Uint8Array | string,
  contentType = 'application/octet-stream'
): Promise<{ path: string; publicUrl?: string; error?: string }> {
  if (!supabaseServer) {
    return { path: filePath };
  }

  const bucketName = typeof bucket === 'string' && (BUCKETS as any)[bucket] ? (BUCKETS as any)[bucket] : bucket;

  try {
    const { data, error } = await supabaseServer.storage
      .from(bucketName)
      .upload(filePath, fileData, {
        contentType,
        upsert: true,
      });

    if (error) {
      console.warn(`Supabase Storage upload warning [${bucketName}/${filePath}]:`, error.message);
      return { path: filePath, error: error.message };
    }

    const { data: publicUrlData } = supabaseServer.storage
      .from(bucketName)
      .getPublicUrl(data.path);

    return { path: data.path, publicUrl: publicUrlData?.publicUrl };
  } catch (err: any) {
    console.warn(`Storage upload exception [${bucketName}/${filePath}]:`, err?.message || err);
    return { path: filePath, error: err?.message };
  }
}

/**
 * Generate a signed URL for secure private download
 */
export async function getSignedDownloadUrl(
  bucket: string,
  filePath: string,
  expiresInSeconds = 3600
): Promise<string | null> {
  if (!supabaseServer) return null;

  try {
    const { data, error } = await supabaseServer.storage
      .from(bucket)
      .createSignedUrl(filePath, expiresInSeconds);

    if (error || !data?.signedUrl) {
      return null;
    }
    return data.signedUrl;
  } catch {
    return null;
  }
}

/**
 * Emit an analysis progress event to Supabase Realtime & DB
 */
export async function emitAnalysisEvent(
  analysisId: string,
  stage: string,
  progress: number,
  message: string,
  payload: any = {}
): Promise<void> {
  if (!supabaseServer) return;

  try {
    await (supabaseServer.from('analysis_events' as any) as any).insert({
      analysis_id: analysisId,
      stage,
      progress,
      message,
      payload,
    });

    // Also update overall progress on analysis record
    await (supabaseServer.from('analyses' as any) as any)
      .update({
        progress,
        status: progress >= 100 ? 'COMPLETED' : 'PROCESSING',
        completed_at: progress >= 100 ? new Date().toISOString() : null,
      })
      .eq('id', analysisId);
  } catch (err) {
    console.warn('Could not emit analysis event to Supabase:', err);
  }
}

/**
 * Delete orphaned storage files during cleanup
 */
export async function cleanupStoragePaths(bucket: string, paths: string[]): Promise<void> {
  if (!supabaseServer || paths.length === 0) return;
  try {
    await supabaseServer.storage.from(bucket).remove(paths);
  } catch (err) {
    console.warn('Storage cleanup warning:', err);
  }
}
