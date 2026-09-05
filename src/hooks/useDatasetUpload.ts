import { useState } from 'react';
import { supabaseService } from '../services/supabaseService';
import { processLargeDatasetZip, ComprehensiveDataset } from '../services/datasetZipProcessor';
import { datasetManager } from '../services/datasetManager';

export interface DatasetUploadState {
  uploading: boolean;
  progress: number;
  stage: string;
  error: string | null;
  resultDataset: ComprehensiveDataset | null;
}

export function useDatasetUpload() {
  const [state, setState] = useState<DatasetUploadState>({
    uploading: false,
    progress: 0,
    stage: 'IDLE',
    error: null,
    resultDataset: null,
  });

  const uploadAndProcessZip = async (file: File) => {
    setState({
      uploading: true,
      progress: 5,
      stage: 'Uploading dataset archive to Supabase Storage...',
      error: null,
      resultDataset: null,
    });

    try {
      // 1. Upload to Supabase Storage
      await supabaseService.uploadDatasetFile(file, (pct, stg) => {
        setState((prev) => ({ ...prev, progress: Math.max(prev.progress, pct), stage: stg }));
      });

      // 2. Client & Backend ZIP Processing
      setState((prev) => ({ ...prev, progress: 40, stage: 'Extracting and parsing dataset archive...' }));

      const parsedDataset = await processLargeDatasetZip(file, (progressObj) => {
        setState((prev) => ({
          ...prev,
          progress: 40 + Math.floor((progressObj.percent || 0) * 0.55),
          stage: `[${progressObj.stage}] ${progressObj.message}`,
        }));
      });

      // 3. Register in DatasetManager
      datasetManager.addComprehensiveDataset(parsedDataset, true);

      setState({
        uploading: false,
        progress: 100,
        stage: 'Dataset ready and indexed successfully',
        error: null,
        resultDataset: parsedDataset,
      });

      return parsedDataset;
    } catch (err: any) {
      setState({
        uploading: false,
        progress: 0,
        stage: 'FAILED',
        error: err?.message || 'Failed to process dataset archive',
        resultDataset: null,
      });
      throw err;
    }
  };

  const resetUpload = () => {
    setState({
      uploading: false,
      progress: 0,
      stage: 'IDLE',
      error: null,
      resultDataset: null,
    });
  };

  return {
    ...state,
    uploadAndProcessZip,
    resetUpload,
  };
}
