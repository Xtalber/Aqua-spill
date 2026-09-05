/**
 * Aqua Spill - Hydrodynamic Drift Physics & Trajectory Engine
 */

import React, { useState } from 'react';
import {
  SpillCase,
  DriftSimulation,
  DriftParameters,
} from '../types';
import {
  Wind,
  Waves,
  Compass,
  Sliders,
  RotateCcw,
  Play,
  ArrowRight,
  TrendingDown,
  Droplets,
  Layers,
  Sparkles,
} from 'lucide-react';
import { runDriftHindcast } from '../services/api';

interface DriftViewProps {
  activeCase: SpillCase;
  onUpdateCase: (updatedCase: SpillCase) => void;
}

export const DriftView: React.FC<DriftViewProps> = ({
  activeCase,
  onUpdateCase,
}) => {
  const { metocean, drift } = activeCase;

  // Editable parameters
  const [params, setParams] = useState<DriftParameters>({
    windLeewayFactor: drift.parameters?.windLeewayFactor ?? 0.03,
    windDeflectionDeg: drift.parameters?.windDeflectionDeg ?? 10,
    currentWeight: drift.parameters?.currentWeight ?? 1.0,
    stokesDriftWeight: drift.parameters?.stokesDriftWeight ?? 0.015,
    diffusionCoeffM2s: drift.parameters?.diffusionCoeffM2s ?? 15.0,
  });

  const [isSimulating, setIsSimulating] = useState(false);
  const [activeTab, setActiveTab] = useState<'hindcast' | 'forecast' | 'weathering'>('hindcast');

  const handleRunSimulation = async () => {
    setIsSimulating(true);
    try {
      const newDrift = await runDriftHindcast({
        caseId: activeCase.id,
        observedPosition: activeCase.observation.centroid,
        observedTime: activeCase.observation.acquisitionTime,
        metocean: activeCase.metocean,
        initialAreaKm2: activeCase.detection.morphometry.areaKm2,
        parameters: params,
      });

      onUpdateCase({
        ...activeCase,
        drift: newDrift,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsSimulating(false);
    }
  };

  const handleResetDefaults = () => {
    setParams({
      windLeewayFactor: 0.03,
      windDeflectionDeg: 10,
      currentWeight: 1.0,
      stokesDriftWeight: 0.015,
      diffusionCoeffM2s: 15.0,
    });
  };

  return (
    <div className="space-y-4 p-4 text-[#1e293b] max-w-7xl mx-auto">
      
      {/* Title Bento Header */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-wrap items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded bg-amber-50 border border-amber-200 text-amber-600">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold uppercase tracking-tight text-slate-900">
              Hydrodynamic Drift Physics & Trajectory
            </h1>
            <p className="text-xs text-slate-500">
              Lagrangian Vector Transport Equation • Coriolis Leeway Deflection • ADIOS/Mackay Weathering Dynamics
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 font-mono">
          <button
            onClick={handleResetDefaults}
            className="px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs flex items-center space-x-1.5 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
          <button
            onClick={handleRunSimulation}
            disabled={isSimulating}
            className="px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center space-x-1.5 transition shadow-sm"
          >
            <Play className="w-3.5 h-3.5" />
            <span>{isSimulating ? 'SIMULATING...' : 'RECALCULATE DRIFT'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* Left 4 Cols: Hydrodynamic Equations & Parameter Tuners */}
        <div className="lg:col-span-4 space-y-4">
          
          {/* Vector Equation Explainer Card */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
            <h3 className="text-[10px] uppercase font-bold text-slate-700 tracking-wider mb-2 border-b border-slate-100 pb-1.5">
              Hydrodynamic Transport Model
            </h3>
            <div className="bg-slate-900 p-3 rounded font-mono text-[11px] text-blue-300 font-bold border border-slate-800">
              V_drift = (1.0 × V_current) + (α × R(θ) V_wind) + V_stokes
            </div>
            <p className="text-[11px] text-slate-500 mt-2.5 leading-relaxed">
              Total surface transport combines 100% surface ocean current vector with empirical leeway windage (typically 3.0% with +10° Coriolis deflection in the Northern Hemisphere).
            </p>
          </div>

          {/* Real-time Parameter Tuners */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm space-y-4">
            <div className="border-b border-slate-100 pb-1.5 flex items-center justify-between">
              <h3 className="text-[10px] uppercase font-bold text-slate-700 tracking-wider">
                Physics Parameters
              </h3>
              <Sliders className="w-3.5 h-3.5 text-blue-600" />
            </div>

            {/* Leeway factor slider */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Wind Leeway Factor (α):</span>
                <span className="font-mono text-blue-600 font-bold">{(params.windLeewayFactor * 100).toFixed(1)}%</span>
              </div>
              <input
                type="range"
                min="0.01"
                max="0.05"
                step="0.002"
                value={params.windLeewayFactor}
                onChange={(e) => setParams({ ...params, windLeewayFactor: parseFloat(e.target.value) })}
                className="w-full accent-blue-600 cursor-pointer"
              />
              <span className="text-[10px] text-slate-400">Standard range for medium crude: 2.8% – 3.4%</span>
            </div>

            {/* Coriolis Deflection Angle */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Coriolis Deflection (θ):</span>
                <span className="font-mono text-blue-600 font-bold">+{params.windDeflectionDeg}°</span>
              </div>
              <input
                type="range"
                min="-20"
                max="25"
                step="1"
                value={params.windDeflectionDeg}
                onChange={(e) => setParams({ ...params, windDeflectionDeg: parseInt(e.target.value, 10) })}
                className="w-full accent-blue-600 cursor-pointer"
              />
              <span className="text-[10px] text-slate-400">+10° to right in Northern Hemisphere</span>
            </div>

            {/* Current Weight */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Current Vector Weight:</span>
                <span className="font-mono text-blue-600 font-bold">{params.currentWeight.toFixed(2)}x</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="1.5"
                step="0.05"
                value={params.currentWeight}
                onChange={(e) => setParams({ ...params, currentWeight: parseFloat(e.target.value) })}
                className="w-full accent-blue-600 cursor-pointer"
              />
            </div>

            {/* Stokes Drift */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Stokes Wave Drift Weight:</span>
                <span className="font-mono text-blue-600 font-bold">{(params.stokesDriftWeight * 100).toFixed(1)}%</span>
              </div>
              <input
                type="range"
                min="0.005"
                max="0.03"
                step="0.002"
                value={params.stokesDriftWeight}
                onChange={(e) => setParams({ ...params, stokesDriftWeight: parseFloat(e.target.value) })}
                className="w-full accent-blue-600 cursor-pointer"
              />
            </div>
          </div>

          {/* Probable Origin Card */}
          <div className="bg-amber-50/70 border border-amber-200 rounded-lg p-4 shadow-sm">
            <div className="mb-2 border-b border-amber-200 pb-1.5 flex items-center justify-between">
              <h3 className="text-[10px] uppercase font-bold text-amber-900 tracking-wider">
                Reconstructed Origin Estimate
              </h3>
              <span className="px-2 py-0.5 rounded bg-amber-200 text-amber-900 text-[9px] font-bold font-mono">
                {drift.probableOrigin.confidence}
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-600">Estimated Discharge:</span>
                <span className="font-mono font-bold text-slate-900">
                  {new Date(drift.probableOrigin.estimatedTime).toUTCString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Search Window:</span>
                <span className="font-mono text-amber-900 font-semibold text-[11px]">
                  {new Date(drift.probableOrigin.timeWindowStart).toLocaleTimeString()} – {new Date(drift.probableOrigin.timeWindowEnd).toLocaleTimeString()} UTC
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Reconstructed Point:</span>
                <span className="font-mono font-bold text-slate-900">
                  {drift.probableOrigin.position.lat.toFixed(4)}°N, {drift.probableOrigin.position.lng.toFixed(4)}°E
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Uncertainty (95% CI):</span>
                <span className="font-mono text-amber-700 font-bold">±{drift.probableOrigin.uncertaintyKm} km</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right 8 Cols: Hindcast & Forecast Trajectory Tables */}
        <div className="lg:col-span-8 space-y-4">
          
          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
            
            {/* Tab switchers */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
              <div className="flex space-x-2 text-xs font-mono font-bold">
                <button
                  onClick={() => setActiveTab('hindcast')}
                  className={`px-3 py-1.5 rounded transition ${activeTab === 'hindcast' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900 bg-slate-100'}`}
                >
                  Hindcast (T-0 to T-24h)
                </button>
                <button
                  onClick={() => setActiveTab('forecast')}
                  className={`px-3 py-1.5 rounded transition ${activeTab === 'forecast' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900 bg-slate-100'}`}
                >
                  Forecast (T+0 to T+48h)
                </button>
                <button
                  onClick={() => setActiveTab('weathering')}
                  className={`px-3 py-1.5 rounded transition ${activeTab === 'weathering' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900 bg-slate-100'}`}
                >
                  Weathering & Emulsion
                </button>
              </div>

              <span className="text-xs font-mono text-slate-500 font-bold">
                {activeTab === 'hindcast' ? `${drift.hindcast.length} Steps` : activeTab === 'forecast' ? `${drift.forecast.length} Steps` : 'Mackay Model'}
              </span>
            </div>

            {/* Tab 1: Hindcast Table */}
            {activeTab === 'hindcast' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 text-[10px] uppercase tracking-wider bg-slate-50">
                      <th className="py-2.5 px-3">STEP</th>
                      <th className="py-2.5 px-3">TIMESTAMP</th>
                      <th className="py-2.5 px-3">COORDINATES</th>
                      <th className="py-2.5 px-3">DRIFT VELOCITY</th>
                      <th className="py-2.5 px-3">UNCERTAINTY</th>
                      <th className="py-2.5 px-3">EVAPORATION</th>
                      <th className="py-2.5 px-3">EMULSIFICATION</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {drift.hindcast.map((step) => {
                      const isOrigin = step.hoursOffset === -4 || step.hoursOffset === -6;
                      return (
                        <tr
                          key={step.hoursOffset}
                          className={`hover:bg-slate-50 transition ${isOrigin ? 'bg-amber-50/60 font-semibold' : 'text-slate-700'}`}
                        >
                          <td className="py-2 px-3 font-bold text-slate-900">
                            T{step.hoursOffset}h
                          </td>
                          <td className="py-2 px-3 text-slate-500">
                            {new Date(step.timestamp).toLocaleTimeString()}
                          </td>
                          <td className="py-2 px-3 text-slate-900">
                            {step.position.lat.toFixed(3)}°N, {step.position.lng.toFixed(3)}°E
                          </td>
                          <td className="py-2 px-3 text-blue-600 font-semibold">
                            {step.netDriftSpeedKts} kts @ {step.netDriftDirectionDeg}°
                          </td>
                          <td className="py-2 px-3 text-amber-700 font-semibold">
                            ±{step.uncertaintyRadiusKm} km
                          </td>
                          <td className="py-2 px-3 text-slate-600">
                            {step.evaporationPercent}%
                          </td>
                          <td className="py-2 px-3 text-slate-600">
                            {step.emulsificationWaterPercent}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Tab 2: Forecast Table */}
            {activeTab === 'forecast' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 text-[10px] uppercase tracking-wider bg-slate-50">
                      <th className="py-2.5 px-3">STEP</th>
                      <th className="py-2.5 px-3">TIMESTAMP</th>
                      <th className="py-2.5 px-3">ESTIMATED COORD</th>
                      <th className="py-2.5 px-3">DRIFT VELOCITY</th>
                      <th className="py-2.5 px-3">DISPERSION</th>
                      <th className="py-2.5 px-3">SPREAD AREA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {drift.forecast.map((step) => (
                      <tr key={step.hoursOffset} className="hover:bg-slate-50 text-slate-700">
                        <td className="py-2 px-3 font-bold text-blue-600">
                          T+{step.hoursOffset}h
                        </td>
                        <td className="py-2 px-3 text-slate-500">
                          {new Date(step.timestamp).toLocaleTimeString()}
                        </td>
                        <td className="py-2 px-3 text-slate-900">
                          {step.position.lat.toFixed(3)}°N, {step.position.lng.toFixed(3)}°E
                        </td>
                        <td className="py-2 px-3 text-blue-600 font-semibold">
                          {step.netDriftSpeedKts} kts @ {step.netDriftDirectionDeg}°
                        </td>
                        <td className="py-2 px-3 text-amber-700 font-semibold">
                          ±{step.uncertaintyRadiusKm} km
                        </td>
                        <td className="py-2 px-3 font-bold text-slate-900">
                          {step.estimatedAreaKm2?.toFixed(1)} km²
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Tab 3: Weathering Breakdown */}
            {activeTab === 'weathering' && (
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-slate-500 font-mono uppercase text-[10px] font-bold">Volatile Fraction Loss:</span>
                    <div className="text-2xl font-mono font-bold text-rose-600 mt-1">
                      {drift.hindcast[0]?.evaporationPercent || 28.5}%
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">Light alkanes & aromatics evaporated within first 6h.</p>
                  </div>
                  <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-slate-500 font-mono uppercase text-[10px] font-bold">Emulsion Water Fraction:</span>
                    <div className="text-2xl font-mono font-bold text-amber-600 mt-1">
                      {drift.hindcast[0]?.emulsificationWaterPercent || 42.0}%
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">Chocolate mousse emulsion formed due to wave action.</p>
                  </div>
                  <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-slate-500 font-mono uppercase text-[10px] font-bold">Spreading Area Growth:</span>
                    <div className="text-2xl font-mono font-bold text-blue-600 mt-1">
                      {drift.forecast[drift.forecast.length - 1]?.estimatedAreaKm2?.toFixed(1) || 32.5} km²
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">Fay gravity-viscous expansion over 48 hours.</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
