import { useState, useEffect, useCallback } from 'react';
import { AISVessel } from '../types';
import { datasetManager } from '../services/datasetManager';

export function useVessels(datasetId?: string) {
  const [vessels, setVessels] = useState<AISVessel[]>([]);
  const [selectedVessel, setSelectedVessel] = useState<AISVessel | null>(null);
  const [loading, setLoading] = useState(false);

  const loadVessels = useCallback(() => {
    setLoading(true);
    const active = datasetManager.getActiveAisVessels();
    setVessels(active);
    if (active.length > 0 && !selectedVessel) {
      setSelectedVessel(active[0]);
    }
    setLoading(false);
  }, [selectedVessel]);

  useEffect(() => {
    loadVessels();
  }, [loadVessels, datasetId]);

  return {
    vessels,
    selectedVessel,
    setSelectedVessel,
    loading,
    refreshVessels: loadVessels,
  };
}
