/**
 * SpillScan - Top Navigation Bar (Bento Grid Theme)
 * Features executive header, telemetry connectivity pills, UTC clock, case switcher, data mode toggle, and tab bar.
 */

import React, { useState, useEffect } from 'react';
import {
  SpillCase,
  AppTab,
  SystemHealthStatus,
} from '../types';
import {
  ShieldAlert,
  Satellite,
  Wind,
  Waves,
  Ship,
  FileText,
  Activity,
  Plus,
  BarChart3,
  Compass,
  Database,
  CheckCircle2,
  Layers,
} from 'lucide-react';
import { isSupabaseConfigured } from '../lib/supabase';
import { AquaSpillLogo } from './AquaSpillLogo';

interface NavbarProps {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  allCases: SpillCase[];
  activeCaseId: string;
  onCaseSelect: (id: string) => void;
  onOpenNewCase: () => void;
  onOpenDiagnostics: () => void;
  health: SystemHealthStatus | null;
  isLiveMode: boolean;
  onToggleLiveMode: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onTabChange,
  allCases,
  activeCaseId,
  onCaseSelect,
  onOpenNewCase,
  onOpenDiagnostics,
  health,
  isLiveMode,
  onToggleLiveMode,
}) => {
  const activeCase = allCases.find((c) => c.id === activeCaseId) || allCases[0];
  const [utcTime, setUtcTime] = useState<string>('');
  const supabaseActive = isSupabaseConfigured();

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setUtcTime(now.toISOString().replace('T', ' ').slice(0, 19) + ' UTC');
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const tabs: { id: AppTab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'OVERVIEW', icon: <Compass className="w-3.5 h-3.5" /> },
    { id: 'detection', label: 'SAR DETECTION', icon: <Satellite className="w-3.5 h-3.5" /> },
    { id: 'drift', label: 'DRIFT PHYSICS', icon: <Wind className="w-3.5 h-3.5" /> },
    { id: 'attribution', label: 'AIS ATTRIBUTION', icon: <Ship className="w-3.5 h-3.5" /> },
    { id: 'analytics', label: 'FORENSIC ANALYTICS', icon: <BarChart3 className="w-3.5 h-3.5" /> },
    { id: 'datasets', label: 'DATASETS & APIS', icon: <Database className="w-3.5 h-3.5" /> },
    { id: 'marpol_report', label: 'MARPOL REPORT', icon: <FileText className="w-3.5 h-3.5" /> },
  ];

  return (
    <header className="bg-[#0f172a] text-white border-b border-[#1e293b] select-none shrink-0 sticky top-0 z-30 shadow-md">
      {/* Top Executive Header Bar */}
      <div className="px-5 py-2.5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80">
        {/* Brand & Subtitle */}
        <div className="flex items-center gap-3">
          <AquaSpillLogo size="md" badgeText="v2.5" subtitle="SATELLITE SAR & AIS MARITIME FORENSICS" />
        </div>

        {/* Telemetry Status Pills & Live Time & Controls */}
        <div className="flex items-center gap-3">
          {/* Telemetry status indicators */}
          <div className="hidden xl:flex gap-2.5 px-3 py-1 bg-[#1e293b] rounded text-[10px] uppercase font-bold tracking-tight border border-slate-700/50">
            <div className="flex items-center gap-1.5" title="Google Maps Platform High-Res Satellite, Hybrid & Nautical Basemaps">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></div>
              <span className="text-slate-300">GOOGLE MAPS</span>
            </div>
            <div className="flex items-center gap-1.5" title="Gemini AI Forensic Summarization & MARPOL Briefings">
              <div className="w-1.5 h-1.5 rounded-full bg-purple-400"></div>
              <span className="text-slate-300">GEMINI AI</span>
            </div>
            <div className="flex items-center gap-1.5" title="Copernicus Data Space Ecosystem (CDSE) / Sentinel-1 SAR">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
              <span className="text-slate-300">SENTINEL-1 / CDSE</span>
            </div>
            <div className="flex items-center gap-1.5" title="AIS Coastal & Satellite Transponder Stream">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
              <span className="text-slate-300">AIS-NET</span>
            </div>
            <div className="flex items-center gap-1.5" title="Copernicus ERA5 Marine Atmosphere">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
              <span className="text-slate-300">ERA5 MET</span>
            </div>
          </div>

          {/* Live UTC Clock */}
          <div className="text-xs font-mono text-blue-400 bg-slate-900/90 px-2.5 py-1 rounded border border-slate-800 font-semibold hidden sm:block">
            {utcTime || '2026-08-30 18:22:08 UTC'}
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center bg-[#1e293b] border border-slate-700/70 rounded p-0.5 text-[10px] font-mono font-bold">
            <button
              onClick={onToggleLiveMode}
              className={`px-2 py-0.5 rounded transition ${isLiveMode ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
            >
              LIVE APIS
            </button>
            <button
              onClick={onToggleLiveMode}
              className={`px-2 py-0.5 rounded transition ${!isLiveMode ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
            >
              DEMO
            </button>
          </div>

          {/* Active Case Selector */}
          <div className="flex items-center gap-1.5">
            <select
              value={activeCaseId}
              onChange={(e) => onCaseSelect(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-slate-100 text-xs rounded px-2.5 py-1 focus:outline-none focus:border-blue-500 font-mono"
            >
              {allCases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.id} - {c.locationName}
                </option>
              ))}
            </select>

            <button
              onClick={onOpenNewCase}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white border border-blue-500 text-xs font-bold transition shadow-sm"
              title="Create New Investigation Case"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">New Case</span>
            </button>

            <button
              onClick={onOpenDiagnostics}
              className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
              title="Run System Diagnostics"
            >
              <Activity className="w-3.5 h-3.5 text-blue-400" />
            </button>
          </div>
        </div>
      </div>

      {/* Bento Sub-Navbar Tabs */}
      <nav className="px-4 flex items-center gap-1 overflow-x-auto scrollbar-none bg-[#090d16] text-xs font-mono">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2.5 border-b-2 font-medium transition whitespace-nowrap ${
                isActive
                  ? 'border-blue-500 text-blue-400 bg-slate-900/90 font-bold'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </header>
  );
};
