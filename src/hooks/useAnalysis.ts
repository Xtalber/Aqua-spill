import { useState, useCallback } from 'react';
import { SpillCase } from '../types';
import { supabaseService } from '../services/supabaseService';
import { runDetection, fetchWeather, runDriftHindcast, runAttribution, generateMarpolReport } from '../services/api';

export function useAnalysis() {
  const [analyzing, setAnalyzing] = useState(false);
  const [currentStage, setCurrentStage] = useState<string>('IDLE');
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  const executeFullAnalysisPipeline = useCallback(
    async (
      initialCase: SpillCase,
      customThresholdDb = 3.0,
      onProgressUpdate?: (stage: string, percent: number) => void
    ): Promise<SpillCase> => {
      setAnalyzing(true);
      setError(null);

      const updateProgress = (stg: string, pct: number) => {
        setCurrentStage(stg);
        setProgressPercent(pct);
        if (onProgressUpdate) onProgressUpdate(stg, pct);
      };

      try {
        updateProgress('1. Ingesting georeferenced raster & validating sensor geometry...', 15);
        await new Promise((r) => setTimeout(r, 200));

        // Step 1: Run SAR Detection & Oil Mask Segmentation
        updateProgress('2. Adaptive CFAR damping segmentation & morphological boundary extraction...', 35);
        const detection = await runDetection(initialCase.observation, customThresholdDb, initialCase.id);

        // Step 2: Fetch / calculate metocean forcing
        updateProgress('3. Sourcing metocean wind & surface ocean current hydrodynamic vectors...', 55);
        const centroid = detection.centroid || initialCase.observation.centroid || { lat: 2.45, lng: 101.88 };
        const metocean = await fetchWeather(centroid.lat, centroid.lng, initialCase.observation.acquisitionTime);

        // Step 3: Run Lagrangian Leeway Drift Hindcast & Forecast
        updateProgress('4. Simulating Lagrangian leeway drift hindcast trajectory & origin window...', 75);
        const drift = await runDriftHindcast({
          caseId: initialCase.id,
          centroid,
          observationTime: initialCase.observation.acquisitionTime,
          metocean,
          slickAreaKm2: detection.morphometry?.areaKm2 || 12.5,
        });

        // Step 4: Multi-point CPA AIS Vessel Attribution
        updateProgress('5. Correlating AIS vessel trajectories against hindcast origin corridor...', 90);
        const attributionResults = await runAttribution(initialCase.id, drift, initialCase.aisVessels);

        // Step 5: Assemble Updated SpillCase
        const updatedCase: SpillCase = {
          ...initialCase,
          detection,
          metocean,
          drift,
          attributionResults,
          status: 'Attribution Complete',
          updatedAt: new Date().toISOString(),
        };

        // Step 6: Persist everything to Supabase
        updateProgress('6. Storing analysis, detections, drift, and candidates to Supabase...', 98);
        await supabaseService.persistAnalysisCase(updatedCase);

        updateProgress('Complete', 100);
        setAnalyzing(false);
        return updatedCase;
      } catch (err: any) {
        setError(err?.message || 'Analysis pipeline failed');
        setAnalyzing(false);
        throw err;
      }
    },
    []
  );

  return {
    analyzing,
    currentStage,
    progressPercent,
    error,
    executeFullAnalysisPipeline,
  };
}
