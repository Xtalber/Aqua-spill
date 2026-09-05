/**
 * Aqua Spill - Full-Stack AI-Assisted Satellite Oil Spill Detection, Drift Reconstruction & Vessel Attribution
 */

import React, { useState, useEffect } from 'react';
import {
  SpillCase,
  MapLayerVisibility,
  SystemHealthStatus,
  AISVessel,
} from './types';
import {
  fetchCases,
  fetchCaseById,
  fetchSystemHealth,
} from './services/api';
import { Navbar } from './components/Navbar';
import { GisMap } from './components/GisMap';
import { OverviewView } from './components/OverviewView';
import { DetectionView } from './components/DetectionView';
import { DriftView } from './components/DriftView';
import { AisAttributionView } from './components/AisAttributionView';
import { ForensicAnalyticsView } from './components/ForensicAnalyticsView';
import { DatasetsView } from './components/DatasetsView';
import { MarpolReportView } from './components/MarpolReportView';
import { DiagnosticsModal } from './components/DiagnosticsModal';
import { NewCaseModal } from './components/NewCaseModal';
import { VesselModal } from './components/VesselModal';
import { AquaSpillLogo } from './components/AquaSpillLogo';
import { RefreshCw, AlertCircle } from 'lucide-react';

export default function App() {
  const [cases, setCases] = useState<SpillCase[]>([]);
  const [activeCaseId, setActiveCaseId] = useState<string>('');
  const [activeCase, setActiveCase] = useState<SpillCase | null>(null);
  const [activeTab, setActiveTab] = useState<
    'overview' | 'detection' | 'drift' | 'attribution' | 'analytics' | 'datasets' | 'marpol_report'
  >('overview');

  const [isLiveMode, setIsLiveMode] = useState<boolean>(true);
  const [selectedVesselMmsi, setSelectedVesselMmsi] = useState<number | null>(null);
  const [inspectedVessel, setInspectedVessel] = useState<AISVessel | null>(null);

  const [layers, setLayers] = useState<MapLayerVisibility>({
    slickPolygon: true,
    sarSwath: true,
    hindcastTrack: true,
    forecastTrack: true,
    uncertaintyEllipse: true,
    aisVessels: true,
    candidateTracks: true,
    originCorridor: true,
    windVectors: true,
    currentVectors: true,
    shippingLanes: true,
    bathymetry: false,
  });

  const [health, setHealth] = useState<SystemHealthStatus | null>(null);
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);
  const [isNewCaseOpen, setIsNewCaseOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initial Load
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [fetchedCases, healthStatus] = await Promise.all([
        fetchCases(),
        fetchSystemHealth(),
      ]);

      setCases(fetchedCases);
      setHealth(healthStatus);

      if (fetchedCases.length > 0) {
        setActiveCaseId(fetchedCases[0].id);
        setActiveCase(fetchedCases[0]);
        if (fetchedCases[0].attributionResults?.length > 0) {
          setSelectedVesselMmsi(fetchedCases[0].attributionResults[0].mmsi);
        }
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to load initial case data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectCase = async (id: string) => {
    setActiveCaseId(id);
    const existing = cases.find(c => c.id === id);
    if (existing) {
      setActiveCase(existing);
      if (existing.attributionResults?.length > 0) {
        setSelectedVesselMmsi(existing.attributionResults[0].mmsi);
      }
    } else {
      try {
        const fullCase = await fetchCaseById(id);
        setActiveCase(fullCase);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleUpdateCase = (updated: SpillCase) => {
    setActiveCase(updated);
    setCases(prev => prev.map(c => c.id === updated.id ? updated : c));
  };

  const handleToggleLayer = (layerKey: keyof MapLayerVisibility) => {
    setLayers(prev => ({
      ...prev,
      [layerKey]: !prev[layerKey],
    }));
  };

  const handleSelectVessel = (mmsi: number) => {
    setSelectedVesselMmsi(mmsi);
    const v = activeCase?.aisVessels.find(vessel => vessel.mmsi === mmsi);
    if (v && activeTab === 'attribution') {
      // Keep selected
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center text-slate-200 font-mono space-y-4">
        <AquaSpillLogo size="lg" badgeText="v2.4" subtitle="INITIALIZING SENTINEL-1 & AIS ENGINES" />
        <div className="flex items-center gap-2 text-xs text-cyan-400 mt-2">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          <span>Synchronizing maritime datasets and reverse drift physics...</span>
        </div>
      </div>
    );
  }

  if (error || !activeCase) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center text-slate-200 font-mono space-y-4 p-4">
        <AlertCircle className="w-10 h-10 text-rose-400" />
        <div className="text-center space-y-2">
          <div className="text-base font-bold text-slate-100">INITIALIZATION ERROR</div>
          <div className="text-xs text-slate-400 max-w-md">{error || 'No active cases available.'}</div>
          <button
            onClick={loadInitialData}
            className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded border border-blue-500 text-xs font-bold"
          >
            Retry Initialization
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#1e293b] font-sans flex flex-col selection:bg-blue-500 selection:text-white">
      
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab)}
        activeCaseId={activeCaseId}
        allCases={cases}
        onCaseSelect={handleSelectCase}
        isLiveMode={isLiveMode}
        onToggleLiveMode={() => setIsLiveMode(!isLiveMode)}
        onOpenNewCase={() => setIsNewCaseOpen(true)}
        onOpenDiagnostics={() => setIsDiagnosticsOpen(true)}
        health={health}
      />

      {/* Main View Router */}
      <main className="flex-1 pb-6 min-w-0">
        {activeTab === 'overview' && (
          <OverviewView
            activeCase={activeCase}
            onUpdateCase={handleUpdateCase}
            layers={layers}
            onToggleLayer={handleToggleLayer}
            selectedVesselMmsi={selectedVesselMmsi}
            onSelectVessel={handleSelectVessel}
            onOpenVesselModal={(v) => setInspectedVessel(v)}
            onNavigateToTab={(tab) => setActiveTab(tab)}
            isLiveMode={isLiveMode}
          />
        )}

        {activeTab === 'detection' && (
          <DetectionView
            activeCase={activeCase}
            onUpdateCase={handleUpdateCase}
          />
        )}

        {activeTab === 'drift' && (
          <DriftView
            activeCase={activeCase}
            onUpdateCase={handleUpdateCase}
          />
        )}

        {activeTab === 'attribution' && (
          <AisAttributionView
            activeCase={activeCase}
            selectedVesselMmsi={selectedVesselMmsi}
            onSelectVessel={handleSelectVessel}
            onOpenVesselModal={(v) => setInspectedVessel(v)}
            onUpdateCase={handleUpdateCase}
            onNavigateToTab={(t) => setActiveTab(t as any)}
          />
        )}

        {activeTab === 'analytics' && (
          <ForensicAnalyticsView
            activeCase={activeCase}
          />
        )}

        {activeTab === 'datasets' && (
          <DatasetsView
            health={health}
          />
        )}

        {activeTab === 'marpol_report' && (
          <MarpolReportView
            activeCase={activeCase}
          />
        )}
      </main>

      {/* Bento Grid Bottom Status Footer */}
      <footer className="h-11 bg-white border-t border-slate-200 px-6 flex items-center justify-between shrink-0 text-[11px] font-medium text-slate-500 z-20">
        <div className="flex gap-6 items-center">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
            <span className="font-mono text-slate-700 font-semibold">SYSTEM STATUS: NOMINAL</span>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-slate-600">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
            <span className="font-mono text-[10px]">PIPELINE ACTIVE [JOB-{activeCase.id}]</span>
          </div>
        </div>
        <div className="flex gap-4 items-center font-mono">
          <div className="uppercase tracking-wider text-slate-600 font-bold text-[10px]">
            CASE: <span className="text-blue-600">{activeCase.id}</span>
          </div>
          <div className="h-3.5 w-px bg-slate-200 hidden sm:block"></div>
          <div className="flex gap-3 uppercase text-[10px]">
            <button
              onClick={() => setActiveTab('marpol_report')}
              className="text-blue-600 hover:text-blue-700 font-bold transition"
            >
              Export Report
            </button>
            <button
              onClick={() => setActiveTab('datasets')}
              className="text-blue-600 hover:text-blue-700 font-bold transition hidden sm:inline"
            >
              JSON Data
            </button>
            <button
              onClick={() => setActiveTab('marpol_report')}
              className="text-blue-600 hover:text-blue-700 font-bold transition hidden md:inline"
            >
              MARPOL Evidence
            </button>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <DiagnosticsModal
        isOpen={isDiagnosticsOpen}
        onClose={() => setIsDiagnosticsOpen(false)}
      />

      <NewCaseModal
        isOpen={isNewCaseOpen}
        onClose={() => setIsNewCaseOpen(false)}
        onCaseCreated={(newCase) => {
          setCases(prev => [newCase, ...prev]);
          setActiveCaseId(newCase.id);
          setActiveCase(newCase);
        }}
      />

      <VesselModal
        vessel={inspectedVessel}
        activeCase={activeCase}
        isOpen={!!inspectedVessel}
        onClose={() => setInspectedVessel(null)}
      />
    </div>
  );
}
