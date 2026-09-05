import { useState } from 'react';
import { supabaseService } from '../services/supabaseService';
import { datasetManager } from '../services/datasetManager';
import { parseSarImageFile } from '../services/sarImageProcessor';

export function useSarUpload() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const uploadSarImage = async (file: File) => {
    setUploading(true);
    setProgress(10);
    setError(null);

    try {
      // 1. Upload to Supabase Storage
      const storageResult = await supabaseService.uploadSarImageFile(file, (pct) => {
        setProgress(pct);
      });

      // 2. Parse SAR metadata & GeoTIFF
      setProgress(70);
      const parsedImage = await parseSarImageFile(file);

      // 3. Match against dataset index
      setProgress(90);
      const activeComprehensive = datasetManager.getActiveComprehensiveDataset();
      const matchResult = datasetManager.matchUploadedImage(file.name, activeComprehensive || undefined);

      setProgress(100);
      setUploading(false);

      return {
        parsedImage,
        matchResult,
        storageResult,
      };
    } catch (err: any) {
      setError(err?.message || 'Failed to upload and parse SAR raster');
      setUploading(false);
      throw err;
    }
  };

  return {
    uploading,
    progress,
    error,
    uploadSarImage,
  };
}
