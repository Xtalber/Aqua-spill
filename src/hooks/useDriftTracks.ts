import { useState, useCallback } from 'react';
import { DriftSimulation, MetoceanData, GeoCoordinate } from '../types';
import { runDriftHindcast } from '../services/api';

export function useDriftTracks() {
  const [drift, setDrift] = useState<DriftSimulation | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const calculateDrift = useCallback(
    async (
      caseId: string,
      centroid: GeoCoordinate,
      obsTime: string,
      metocean: MetoceanData,
      areaKm2: number
    ) => {
      setSimulating(true);
      setError(null);
      try {
        const result = await runDriftHindcast({
          caseId,
          centroid,
          observationTime: obsTime,
          metocean,
          slickAreaKm2: areaKm2,
        });
        setDrift(result);
        return result;
      } catch (err: any) {
        setError(err?.message || 'Drift simulation failed');
        throw err;
      } finally {
        setSimulating(false);
      }
    },
    []
  );

  return {
    drift,
    simulating,
    error,
    calculateDrift,
    setDrift,
  };
}
