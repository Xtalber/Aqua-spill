/**
 * Aqua Spill - Master Dataset Client Service (DARTIS 2019)
 * Handles chunked resumable upload for large archives (~511 MB),
 * progress tracking, metadata lookup, and authoritative SAR image hydration.
 */

import {
  DartisMasterDataset,
  DartisUploadProgress,
  DartisDatasetImage,
  SpillCase,
} from '../types';

export interface ChunkUploadProgress {
  stage: 'IDLE' | 'UPLOADING' | 'EXTRACTING' | 'INDEXING' | 'COMPLETED' | 'FAILED';
  percent: number;
  uploadedBytes: number;
  totalBytes: number;
  currentChunk: number;
  totalChunks: number;
  message: string;
  error?: string;
}

const CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB chunks

export async function fetchMasterDatasetStatus(): Promise<DartisMasterDataset> {
  const res = await fetch('/api/dataset/master/status');
  if (!res.ok) {
    throw new Error(`Failed to fetch master dataset status: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchMasterDatasetProgress(): Promise<DartisUploadProgress> {
  const res = await fetch('/api/dataset/master/progress');
  if (!res.ok) {
    throw new Error(`Failed to fetch master dataset progress: ${res.statusText}`);
  }
  return res.json();
}

export async function uploadMasterDatasetChunked(
  file: File,
  onProgress?: (progress: ChunkUploadProgress) => void
): Promise<DartisMasterDataset> {
  const uploadId = `dartis-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const totalBytes = file.size;
  const totalChunks = Math.ceil(totalBytes / CHUNK_SIZE);

  let uploadedBytes = 0;

  onProgress?.({
    stage: 'UPLOADING',
    percent: 0,
    uploadedBytes: 0,
    totalBytes,
    currentChunk: 0,
    totalChunks,
    message: `Initializing chunked upload for ${file.name} (${(totalBytes / (1024 * 1024)).toFixed(1)} MB)...`,
  });

  // Upload each chunk sequentially with retry
  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
    const start = chunkIndex * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, totalBytes);
    const chunkBlob = file.slice(start, end);
    const chunkBuffer = await chunkBlob.arrayBuffer();

    let attempt = 0;
    let success = false;
    let lastError: any = null;

    while (attempt < 3 && !success) {
      attempt++;
      try {
        const res = await fetch('/api/dataset/master/upload-chunk', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/octet-stream',
            'x-upload-id': uploadId,
            'x-chunk-index': String(chunkIndex),
            'x-total-chunks': String(totalChunks),
            'x-file-name': file.name,
            'x-file-size': String(totalBytes),
          },
          body: chunkBuffer,
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Server returned ${res.status}`);
        }

        success = true;
      } catch (err) {
        lastError = err;
        console.warn(`[MasterDatasetClient] Chunk ${chunkIndex + 1}/${totalChunks} attempt ${attempt} failed:`, err);
        if (attempt < 3) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
        }
      }
    }

    if (!success) {
      const errMsg = `Chunk upload failed at chunk ${chunkIndex + 1}/${totalChunks}: ${lastError?.message || 'Network error'}`;
      onProgress?.({
        stage: 'FAILED',
        percent: Math.round((uploadedBytes / totalBytes) * 100),
        uploadedBytes,
        totalBytes,
        currentChunk: chunkIndex + 1,
        totalChunks,
        message: errMsg,
        error: errMsg,
      });
      throw new Error(errMsg);
    }

    uploadedBytes += (end - start);
    const uploadPercent = Math.min(99, Math.round((uploadedBytes / totalBytes) * 100));

    onProgress?.({
      stage: 'UPLOADING',
      percent: uploadPercent,
      uploadedBytes,
      totalBytes,
      currentChunk: chunkIndex + 1,
      totalChunks,
      message: `Uploading chunk ${chunkIndex + 1} of ${totalChunks} (${(uploadedBytes / (1024 * 1024)).toFixed(1)} / ${(totalBytes / (1024 * 1024)).toFixed(1)} MB)...`,
    });
  }

  // Chunks uploaded! Now poll server extraction & indexing progress
  onProgress?.({
    stage: 'EXTRACTING',
    percent: 100,
    uploadedBytes: totalBytes,
    totalBytes,
    currentChunk: totalChunks,
    totalChunks,
    message: 'Upload complete. Extracting ZIP package and parsing DARTIS_2019.tab metadata...',
  });

  return new Promise((resolve, reject) => {
    const pollInterval = setInterval(async () => {
      try {
        const prog = await fetchMasterDatasetProgress();

        if (prog.stage === 'EXTRACTING') {
          onProgress?.({
            stage: 'EXTRACTING',
            percent: Math.max(50, prog.percent),
            uploadedBytes: totalBytes,
            totalBytes,
            currentChunk: totalChunks,
            totalChunks,
            message: prog.message || 'Extracting ZIP archive on server...',
          });
        } else if (prog.stage === 'INDEXING') {
          onProgress?.({
            stage: 'INDEXING',
            percent: Math.max(75, prog.percent),
            uploadedBytes: totalBytes,
            totalBytes,
            currentChunk: totalChunks,
            totalChunks,
            message: prog.message || 'Indexing DARTIS metadata and syncing to database...',
          });
        } else if (prog.stage === 'COMPLETED') {
          clearInterval(pollInterval);
          onProgress?.({
            stage: 'COMPLETED',
            percent: 100,
            uploadedBytes: totalBytes,
            totalBytes,
            currentChunk: totalChunks,
            totalChunks,
            message: prog.message || 'DARTIS 2019 Master Dataset indexed successfully!',
          });
          const status = await fetchMasterDatasetStatus();
          resolve(status);
        } else if (prog.stage === 'FAILED') {
          clearInterval(pollInterval);
          const failMsg = prog.error || prog.message || 'Extraction or indexing failed';
          onProgress?.({
            stage: 'FAILED',
            percent: 100,
            uploadedBytes: totalBytes,
            totalBytes,
            currentChunk: totalChunks,
            totalChunks,
            message: failMsg,
            error: failMsg,
          });
          reject(new Error(failMsg));
        }
      } catch (pollErr) {
        console.warn('[MasterDatasetClient] Progress polling error:', pollErr);
      }
    }, 1200);

    // Timeout safety after 10 minutes
    setTimeout(() => {
      clearInterval(pollInterval);
      reject(new Error('Master dataset processing timed out after 10 minutes.'));
    }, 600000);
  });
}

export async function lookupMasterImage(query: string): Promise<{ found: boolean; image?: DartisDatasetImage; message?: string }> {
  const res = await fetch(`/api/dataset/master/lookup?query=${encodeURIComponent(query)}`);
  if (!res.ok) {
    return { found: false, message: `Image '${query}' not found in master dataset index.` };
  }
  return res.json();
}

export async function matchSarImageCase(
  fileName: string,
  caseId?: string
): Promise<{
  matched: boolean;
  isMasterDatasetMatch: boolean;
  case?: SpillCase;
  image?: DartisDatasetImage;
  message?: string;
}> {
  const res = await fetch('/api/cases/match-sar-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileName, caseId }),
  });
  return res.json();
}

export async function fetchMasterDatasetList(params: {
  page?: number;
  limit?: number;
  oilOnly?: boolean;
  cleanOnly?: boolean;
  search?: string;
} = {}): Promise<{
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  images: DartisDatasetImage[];
}> {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  if (params.oilOnly) query.set('oilOnly', 'true');
  if (params.cleanOnly) query.set('cleanOnly', 'true');
  if (params.search) query.set('search', params.search);

  const res = await fetch(`/api/dataset/master/list?${query.toString()}`);
  if (!res.ok) {
    throw new Error('Failed to fetch master dataset list');
  }
  return res.json();
}

export async function clearMasterDataset(): Promise<void> {
  await fetch('/api/dataset/master/clear', { method: 'POST' });
}

export async function fetchDartisCase(identifier: string): Promise<SpillCase> {
  const res = await fetch(`/api/cases/dartis/${encodeURIComponent(identifier)}`);
  if (!res.ok) {
    throw new Error(`Failed to load DARTIS scene ${identifier}`);
  }
  const data = await res.json();
  return data.case;
}

