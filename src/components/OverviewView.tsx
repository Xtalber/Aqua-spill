/**
 * Aqua Spill - Incident Overview Dashboard
 * Features:
 * - Top SATELLITE SAR ANALYSIS ingestion & upload control
 * - High-level incident metadata bar
 * - 4 Multi-domain KPI Bento Metric cards
 * - 8-col Interactive GIS Map (Zero API Key, Offline/Dataset mode supported)
 * - 4-col AIS Attribution Candidates & Investigation Pipeline
 */

import React from 'react';
import {
  SpillCase,
  AppTab,
  MapLayerVisibility,
  AISVessel,
} from '../types';
import { GisMap } from './GisMap';
import { SarAnalysisUpload } from './SarAnalysisUpload';
import {
  Satellite,
  Compass,
  Wind,
  Waves,
  Ship,
  FileCheck,
  AlertOctagon,
  ArrowRight,
  ShieldCheck,
  Info,
  Clock,
  MapPin,
  TrendingUp,
  Sliders,
} from 'lucide-react';

interface OverviewViewProps {
  activeCase: SpillCase;
  onUpdateCase?: (updatedCase: SpillCase) => void;
  layers?: MapLayerVisibility;
  onToggleLayer?: (layerKey: keyof MapLayerVisibility) => void;
  selectedVesselMmsi?: number | null;
  onSelectVessel?: (mmsi: number) => void;
  onOpenVesselModal?: (vessel: AISVessel) => void;
  onNavigateToTab?: (tab: AppTab) => void;
  isLiveMode?: boolean;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  activeCase,
  onUpdateCase,
  layers,
  onToggleLayer,
  selectedVesselMmsi,
  onSelectVessel,
  onOpenVesselModal,
  onNavigateToTab,
  isLiveMode,
}) => {
  const topCandidate = activeCase.attributionResults?.[0];
  const { observation, detection, metocean, drift } = activeCase;

  const navigate = (tab: AppTab) => {
    if (onNavigateToTab) onNavigateToTab(tab);
  };

  return (
    <div className="space-y-4 p-4 text-[#1e293b] max-w-7xl mx-auto">
      
      {/* 1. SATELLITE SAR ANALYSIS - First-Class Upload & Processing Module */}
      {onUpdateCase && (
        <SarAnalysisUpload
          activeCase={activeCase}
          onUpdateCase={onUpdateCase}
          onSelectTab={(tab) => navigate(tab as AppTab)}
        />
      )}

      {/* 2. Incident Header Status Bento Bar */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-wrap items-center justify-between gap-4 shadow-sm">
        <div>
          <div className="flex items-center space-x-3 mb-1.5">
            <span className="px-2 py-0.5 rounded bg-rose-50 border border-rose-200 text-xs font-mono text-rose-700 font-bold flex items-center space-x-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
              <span>{activeCase.status.toUpperCase()}</span>
            </span>
            <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
              ID: {activeCase.id}
            </span>
            <span className="text-slate-300 hidden sm:inline">|</span>
            <span className="text-sm font-bold text-slate-900">{activeCase.title}</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
            <div className="flex items-center space-x-1.5">
              <MapPin className="w-3.5 h-3.5 text-blue-600" />
              <span>
                Location: <b className="text-slate-700">{activeCase.locationName}</b>{' '}
                {observation?.centroid ? `(${observation.centroid.lat.toFixed(4)}°N, ${observation.centroid.lng.toFixed(4)}°E)` : '(Location not available)'}
              </span>
            </div>
            <div className="flex items-center space-x-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              <span>Acquisition: <b className="text-slate-700">{observation?.acquisitionTime ? new Date(observation.acquisitionTime).toUTCString() : 'Time not available'}</b></span>
            </div>
            <div className="flex items-center space-x-1.5">
              <Satellite className="w-3.5 h-3.5 text-blue-500" />
              <span>Sensor: <b className="text-slate-700">{observation?.satellite || 'SAR Sensor'}</b> ({observation?.sensorMode || 'IW'})</span>
            </div>
          </div>
        </div>

        {/* Action Shortcuts */}
        <div className="flex items-center space-x-2 text-xs font-mono">
          <button
            onClick={() => navigate('detection')}
            className="px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-bold transition shadow-sm"
          >
            SAR Mask
          </button>
          <button
            onClick={() => navigate('drift')}
            className="px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-bold transition shadow-sm"
          >
            Drift Physics
          </button>
          <button
            onClick={() => navigate('marpol_report')}
            className="px-3.5 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold transition flex items-center space-x-1.5 shadow-sm"
          >
            <span>MARPOL Dossier</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* 3. 4 Multi-Domain KPI Bento Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: SAR Slick Metrics */}
        <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[10px] uppercase font-bold text-slate-500 tracking-wider flex items-center gap-1.5">
                <AlertOctagon className="w-3.5 h-3.5 text-rose-500" />
                <span>SAR SLICK MORPHOMETRY</span>
              </h3>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-50 border border-rose-200 text-rose-700 font-bold">
                {detection?.confidence || 'N/A'}
              </span>
            </div>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-mono font-bold text-slate-900">
                {detection?.morphometry?.areaKm2 ? detection.morphometry.areaKm2.toFixed(2) : '0.00'}
              </span>
              <span className="text-xs text-slate-500 font-medium">km² area</span>
            </div>
          </div>
          <div className="text-xs text-slate-600 space-y-1 pt-2.5 mt-2 border-t border-slate-100">
            <div className="flex justify-between">
              <span className="text-slate-500">Backscatter Damping:</span>
              <span className="font-mono font-semibold text-slate-800">
                -{detection?.morphometry?.backscatterDampingDb || 6.2} dB
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Dimensions (L × W):</span>
              <span className="font-mono font-semibold text-slate-800">
                {detection?.morphometry?.lengthKm || 0} × {detection?.morphometry?.widthKm || 0} km
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Major Axis Heading:</span>
              <span className="font-mono font-semibold text-slate-800">
                {detection?.morphometry?.orientationDeg || 0}°
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Hydrodynamic Origin Reconstruction */}
        <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[10px] uppercase font-bold text-slate-500 tracking-wider flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-amber-500" />
                <span>HYDRODYNAMIC ORIGIN</span>
              </h3>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-700 font-bold">
                {drift?.probableOrigin?.confidence || 'MEDIUM'}
              </span>
            </div>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-lg font-mono font-bold text-slate-900">
                {drift?.probableOrigin?.estimatedTime ? new Date(drift.probableOrigin.estimatedTime).toLocaleTimeString() : 'N/A'} UTC
              </span>
              <span className="text-xs text-amber-600 font-medium font-mono">Backtracked</span>
            </div>
          </div>
          <div className="text-xs text-slate-600 space-y-1 pt-2.5 mt-2 border-t border-slate-100">
            <div className="flex justify-between">
              <span className="text-slate-500">Coordinates:</span>
              <span className="font-mono font-semibold text-slate-800">
                {drift?.probableOrigin?.position ? `${drift.probableOrigin.position.lat.toFixed(3)}°N, ${drift.probableOrigin.position.lng.toFixed(3)}°E` : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Uncertainty Radius:</span>
              <span className="font-mono font-semibold text-slate-800">
                ±{drift?.probableOrigin?.uncertaintyKm || 2.0} km (95% CI)
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Net Drift Velocity:</span>
              <span className="font-mono font-semibold text-slate-800">
                {drift?.hindcast?.[0]?.netDriftSpeedKts || 0.8} kts @ {drift?.hindcast?.[0]?.netDriftDirectionDeg || 140}°
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Metocean Atmospheric & Ocean Forcing */}
        <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[10px] uppercase font-bold text-slate-500 tracking-wider flex items-center gap-1.5">
                <Wind className="w-3.5 h-3.5 text-blue-500" />
                <span>METOCEAN FORCING</span>
              </h3>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-700 font-bold">
                {metocean?.status || 'Active'}
              </span>
            </div>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-mono font-bold text-slate-900">
                {metocean?.windSpeedKts || 14.5} kts
              </span>
              <span className="text-xs text-slate-500 font-medium font-mono">
                from {metocean?.windDirectionDeg || 225}°
              </span>
            </div>
          </div>
          <div className="text-xs text-slate-600 space-y-1 pt-2.5 mt-2 border-t border-slate-100">
            <div className="flex justify-between">
              <span className="text-slate-500">Ocean Current:</span>
              <span className="font-mono font-semibold text-slate-800">
                {metocean?.currentSpeedKts || 0.65} kts @ {metocean?.currentDirectionDeg || 120}°
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Significant Wave (Hs):</span>
              <span className="font-mono font-semibold text-slate-800">
                {metocean?.significantWaveHeightM || 1.4} m ({metocean?.wavePeriodSec || 5.8}s)
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Sea Surface Temp:</span>
              <span className="font-mono font-semibold text-slate-800">
                {metocean?.seaSurfaceTempC || 28.5}°C
              </span>
            </div>
          </div>
        </div>

        {/* Card 4: AIS Primary Attribution Candidate */}
        <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[10px] uppercase font-bold text-slate-500 tracking-wider flex items-center gap-1.5">
                <Ship className="w-3.5 h-3.5 text-indigo-500" />
                <span>TOP AIS CANDIDATE</span>
              </h3>
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-indigo-700 font-mono font-semibold">
                  Synthetic AIS
                </span>
                {topCandidate && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-50 border border-rose-200 text-rose-700 font-bold">
                    {topCandidate.attributionScore}/100
                  </span>
                )}
              </div>
            </div>
            {topCandidate ? (
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-base font-mono font-bold text-slate-900 truncate">{topCandidate.vesselName}</span>
                <span className="text-xs text-slate-500 font-medium">{topCandidate.flag}</span>
              </div>
            ) : (
              <div className="text-xs text-slate-400 py-2">No candidate identified</div>
            )}
          </div>
          {topCandidate && (
            <div className="text-xs text-slate-600 space-y-1 pt-2.5 mt-2 border-t border-slate-100">
              <div className="flex justify-between">
                <span className="text-slate-500">MMSI / Type:</span>
                <span className="font-mono font-semibold text-slate-800">{topCandidate.mmsi} ({topCandidate.vesselType})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Closest Approach:</span>
                <span className="font-mono text-rose-600 font-bold">{topCandidate.cpa.cpaDistanceKm} km ({topCandidate.cpa.timeDifferenceMinutes}m)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Classification:</span>
                <span className={`font-mono text-xs font-bold ${
                  topCandidate.category === 'PRIMARY SOURCE CANDIDATE' ? 'text-rose-700' : 'text-amber-700'
                }`}>{topCandidate.category}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 4. Main Operational Bento Section: Map + Attribution Candidates */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* Left 8 Cols: GIS Interactive Map */}
        <div className="lg:col-span-8 min-h-[520px]">
          <GisMap
            activeCase={activeCase}
            selectedVesselMmsi={selectedVesselMmsi}
            onSelectVessel={onSelectVessel}
          />
        </div>

        {/* Right 4 Cols: Attribution Candidates & Bento Workflow Steps */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          
          {/* AIS Correlation Candidate Bento List */}
          <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100 shrink-0">
              <div className="flex items-center space-x-2">
                <Ship className="w-4 h-4 text-blue-600" />
                <h3 className="text-[10px] uppercase font-bold text-slate-700 tracking-wider">
                  AIS Candidate Vessels (Synthetic Demonstration)
                </h3>
              </div>
              <span className="text-[10px] text-blue-600 font-bold px-1.5 py-0.5 bg-blue-50 rounded border border-blue-100 font-mono">
                {activeCase.attributionResults?.length || 0} Vessels
              </span>
            </div>

            <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[340px] pr-1 font-mono">
              {activeCase.attributionResults && activeCase.attributionResults.length > 0 ? (
                activeCase.attributionResults.map((candidate) => {
                  const isSelected = selectedVesselMmsi === candidate.mmsi;
                  const isPrimary = candidate.category === 'PRIMARY SOURCE CANDIDATE';
                  const isPotential = candidate.category === 'POTENTIAL SOURCE VESSEL' || candidate.category === 'SOURCE CANDIDATE';
                  return (
                    <div
                      key={candidate.mmsi}
                      onClick={() => onSelectVessel?.(candidate.mmsi)}
                      className={`p-3 rounded border text-xs cursor-pointer transition ${
                        isSelected
                          ? 'border-l-4 border-l-blue-600 bg-blue-50 border-blue-200 shadow-sm'
                          : isPrimary
                          ? 'border-l-4 border-l-rose-500 bg-rose-50/40 border-slate-200 hover:bg-rose-50/70'
                          : isPotential
                          ? 'border-l-4 border-l-amber-400 bg-amber-50/30 border-slate-200 hover:bg-amber-50/60'
                          : 'border-l-4 border-l-slate-300 bg-slate-50/70 border-slate-200 opacity-75 hover:opacity-100'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-1.5">
                        <div>
                          <h4 className={`text-xs font-bold ${isPrimary ? 'text-rose-800 font-bold' : 'text-slate-900'}`}>{candidate.vesselName}</h4>
                          <p className="text-[10px] text-slate-500 uppercase font-medium">
                            {candidate.vesselType} | {candidate.flag}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className={`text-[10px] font-bold font-mono px-1.5 py-0.5 rounded ${
                            isPrimary
                              ? 'bg-rose-100 text-rose-800'
                              : isPotential
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}>
                            {candidate.category}
                          </div>
                          <div className="text-[9px] font-mono text-slate-500 uppercase mt-0.5">
                            Score: <b className="text-slate-800">{candidate.attributionScore}/100</b>
                          </div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-y-1 text-[9px] font-mono text-slate-600 pt-1 border-t border-slate-100">
                        <span>CPA: <b className="text-rose-600 font-bold">{candidate.cpa.cpaDistanceKm} km</b></span>
                        <span>ΔT: <b className="text-slate-800">{candidate.cpa.timeDifferenceMinutes}m</b></span>
                        <span>MMSI: <b className="text-slate-800">{candidate.mmsi}</b></span>
                        <span>Corridor: <b className="text-slate-800">{candidate.subScores?.originCorridorOverlap || 85}%</b></span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-xs text-slate-400 text-center py-6">No synthetic vessels available for this scene.</div>
              )}
            </div>

            {/* Scientific & Synthetic Demonstration Disclaimer Note */}
            <div className="mt-3 p-3 bg-slate-900 text-white rounded-lg shrink-0 shadow-sm">
              <h4 className="text-[9px] uppercase font-bold text-blue-400 mb-1 font-mono flex items-center gap-1">
                <Info className="w-3 h-3 text-blue-400" />
                Synthetic AIS Demonstration Data
              </h4>
              <p className="text-[9px] leading-relaxed opacity-75 italic font-mono">
                Attribution is probabilistic and for demonstration only. Synthetic AIS candidate records are dynamically keyed to the active SAR Image ID. Trajectory correlation does not independently establish legal liability.
              </p>
            </div>
          </div>

          {/* Investigation Pipeline Bento Progress */}
          <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm shrink-0">
            <h3 className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-2.5 pb-1.5 border-b border-slate-100">
              Forensic Investigation Pipeline
            </h3>
            <div className="space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between text-slate-700">
                <span className="flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span className="text-[11px] font-sans text-slate-700 font-medium">1. SAR Radar Observation Ingested</span>
                </span>
                <span className="text-emerald-600 font-bold text-[10px]">100%</span>
              </div>
              <div className="flex items-center justify-between text-slate-700">
                <span className="flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span className="text-[11px] font-sans text-slate-700 font-medium">2. Slick Morphometry & CFAR Mask</span>
                </span>
                <span className="text-emerald-600 font-bold text-[10px]">100%</span>
              </div>
              <div className="flex items-center justify-between text-slate-700">
                <span className="flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span className="text-[11px] font-sans text-slate-700 font-medium">3. Hydrodynamic Leeway Backtrack</span>
                </span>
                <span className="text-emerald-600 font-bold text-[10px]">100%</span>
              </div>
              <div className="flex items-center justify-between text-slate-700">
                <span className="flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span className="text-[11px] font-sans text-slate-700 font-medium">4. Multi-Point AIS CPA Matching</span>
                </span>
                <span className="text-emerald-600 font-bold text-[10px]">100%</span>
              </div>
              <div className="flex items-center justify-between text-slate-700">
                <span className="flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                  <span className="text-[11px] font-sans text-slate-900 font-bold">5. MARPOL Evidence Dossier</span>
                </span>
                <span className="text-blue-600 font-bold text-[10px]">Ready</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
