import { useState, useEffect, useCallback } from 'react';
import { supabaseService, DatasetRecord } from '../services/supabaseService';
import { datasetManager } from '../services/datasetManager';

export function useDatasets(projectId?: string) {
  const [datasets, setDatasets] = useState<DatasetRecord[]>([]);
  const [activeDataset, setActiveDataset] = useState<DatasetRecord | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadDatasets = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await supabaseService.getDatasets(projectId);
      setDatasets(data);
      if (data.length > 0 && !activeDataset) {
        setActiveDataset(data[0]);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch datasets');
    } finally {
      setLoading(false);
    }
  }, [projectId, activeDataset]);

  useEffect(() => {
    loadDatasets();
  }, [loadDatasets]);

  return {
    datasets,
    activeDataset,
    setActiveDataset,
    loading,
    error,
    refreshDatasets: loadDatasets,
  };
}
