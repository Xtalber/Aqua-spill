import { useState, useEffect } from 'react';
import { subscribeToAnalysisEvents } from '../lib/supabase';

export interface AnalysisProgressState {
  stage: string;
  progress: number;
  message: string;
  payload?: any;
}

export function useAnalysisProgress(analysisId: string | null) {
  const [progressState, setProgressState] = useState<AnalysisProgressState>({
    stage: 'IDLE',
    progress: 0,
    message: '',
  });

  useEffect(() => {
    if (!analysisId) return;

    const subscription = subscribeToAnalysisEvents(analysisId, (event) => {
      setProgressState({
        stage: event.stage,
        progress: event.progress,
        message: event.message,
        payload: event.payload,
      });
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [analysisId]);

  return progressState;
}
