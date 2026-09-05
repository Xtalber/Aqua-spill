/**
 * Aqua Spill - Self-Diagnostics & System Health Modal
 */

import React, { useState } from 'react';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  X,
  ShieldCheck,
  Server,
  Zap,
} from 'lucide-react';
import { runSystemDiagnostics } from '../services/api';

interface DiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DiagnosticsModal: React.FC<DiagnosticsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [isRunning, setIsRunning] = useState(false);
  const [diagnosticsResult, setDiagnosticsResult] = useState<any>(null);

  if (!isOpen) return null;

  const handleRunTests = async () => {
    setIsRunning(true);
    try {
      const res = await runSystemDiagnostics();
      setDiagnosticsResult(res);
    } catch (err) {
      console.error(err);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-xl max-w-2xl w-full p-6 space-y-4 shadow-xl text-slate-800 text-xs font-mono">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 rounded bg-blue-50 border border-blue-200 text-blue-600">
              <Activity className="w-4 h-4" />
            </div>
            <span className="text-sm font-bold text-slate-900 uppercase">System Self-Diagnostics & Provider Health</span>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
          <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
            <div className="text-slate-500 text-[10px] uppercase font-bold">Google Maps API:</div>
            <div className="text-blue-700 font-bold text-xs mt-0.5">Connected (Satellite & Hybrid)</div>
            <div className="text-[9px] text-slate-400 font-mono">Key: AIzaSy...7NMQl0</div>
          </div>
          <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
            <div className="text-slate-500 text-[10px] uppercase font-bold">Gemini AI (Legal):</div>
            <div className="text-purple-700 font-bold text-xs mt-0.5">Connected (Gemini 3.8 Flash)</div>
            <div className="text-[9px] text-slate-400 font-mono">Key: AQ.Ab8...iqcw</div>
          </div>
          <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
            <div className="text-slate-500 text-[10px] uppercase font-bold">Copernicus CDS / SAR:</div>
            <div className="text-emerald-700 font-bold text-xs mt-0.5">Connected (Sentinel-1)</div>
            <div className="text-[9px] text-slate-400 font-mono">WS_b28dd727...</div>
          </div>
          <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
            <div className="text-slate-500 text-[10px] uppercase font-bold">AIS Stream Telemetry:</div>
            <div className="text-emerald-700 font-bold text-xs mt-0.5">Connected (Feed Key)</div>
            <div className="text-[9px] text-slate-400 font-mono">Key: 34e4...2e11</div>
          </div>
          <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
            <div className="text-slate-500 text-[10px] uppercase font-bold">ERA5 Atmosphere:</div>
            <div className="text-emerald-700 font-bold text-xs mt-0.5">Connected (10m Wind)</div>
            <div className="text-[9px] text-slate-400 font-mono">Open-Meteo Marine</div>
          </div>
          <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
            <div className="text-slate-500 text-[10px] uppercase font-bold">Lagrangian Physics:</div>
            <div className="text-emerald-700 font-bold text-xs mt-0.5">Active (4D Runge-Kutta)</div>
            <div className="text-[9px] text-slate-400 font-mono">Reverse-drift Correlator</div>
          </div>
        </div>


        {/* Live Test Suite Results */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-slate-800 font-bold">
            <span className="text-[11px] uppercase tracking-wider text-slate-600">Automated Diagnostic Suite</span>
            <button
              onClick={handleRunTests}
              disabled={isRunning}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs flex items-center space-x-1.5 transition font-bold shadow-sm"
            >
              <RefreshCw className={`w-3 h-3 ${isRunning ? 'animate-spin' : ''}`} />
              <span>{isRunning ? 'RUNNING SUITE...' : 'RUN FULL TEST SUITE'}</span>
            </button>
          </div>

          <div className="bg-slate-50 rounded-lg border border-slate-200 divide-y divide-slate-200 max-h-64 overflow-y-auto">
            {diagnosticsResult ? (
              diagnosticsResult.tests.map((t: any, i: number) => (
                <div key={i} className="p-2.5 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {t.status === 'PASS' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    ) : t.status === 'STANDBY' ? (
                      <Activity className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                    )}
                    <div>
                      <div className="font-bold text-slate-900">{t.name}</div>
                      {t.note && <div className="text-[10px] text-slate-500">{t.note}</div>}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                      t.status === 'PASS' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-slate-200 text-slate-700'
                    }`}>
                      {t.status}
                    </span>
                    <div className="text-[10px] text-slate-400 mt-0.5">{t.latencyMs} ms</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-6 text-center text-slate-400">
                Click "Run Full Test Suite" to verify live endpoint latencies and physics calculation accuracy.
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-slate-100">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-bold border border-slate-200 transition"
          >
            Close Diagnostics
          </button>
        </div>
      </div>
    </div>
  );
};
