import { useState, useCallback } from 'react';
import { MARPOLReportData } from '../types';
import { generateMarpolReport } from '../services/api';

export function useReports() {
  const [report, setReport] = useState<MARPOLReportData | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createReport = useCallback(async (caseId: string) => {
    setGenerating(true);
    setError(null);
    try {
      const rep = await generateMarpolReport(caseId);
      setReport(rep);
      return rep;
    } catch (err: any) {
      setError(err?.message || 'Report generation failed');
      throw err;
    } finally {
      setGenerating(false);
    }
  }, []);

  return {
    report,
    generating,
    error,
    createReport,
    setReport,
  };
}
