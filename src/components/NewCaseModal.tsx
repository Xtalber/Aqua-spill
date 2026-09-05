/**
 * Aqua Spill - New Case Creation Modal
 */

import React, { useState } from 'react';
import {
  X,
  PlusCircle,
  MapPin,
  Satellite,
  Calendar,
} from 'lucide-react';
import { createCase } from '../services/api';
import { SpillCase } from '../types';

interface NewCaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCaseCreated: (newCase: SpillCase) => void;
}

export const NewCaseModal: React.FC<NewCaseModalProps> = ({
  isOpen,
  onClose,
  onCaseCreated,
}) => {
  const [title, setTitle] = useState('');
  const [locationName, setLocationName] = useState('Arabian Sea Off Gujarat');
  const [lat, setLat] = useState('21.850');
  const [lng, setLng] = useState('69.450');
  const [satellite, setSatellite] = useState('Sentinel-1A SAR');
  const [isCreating, setIsCreating] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    try {
      const created = await createCase({
        title: title || `Incident Investigation - ${locationName}`,
        locationName,
        centroid: { lat: parseFloat(lat), lng: parseFloat(lng) },
        satellite,
      });
      onCaseCreated(created);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full p-6 space-y-4 shadow-xl text-slate-800 text-xs font-mono">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 rounded bg-blue-50 border border-blue-200 text-blue-600">
              <PlusCircle className="w-4 h-4" />
            </div>
            <span className="text-sm font-bold text-slate-900 uppercase">Create New Oil Spill Case</span>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="space-y-1">
            <label className="text-slate-600 font-bold uppercase text-[10px]">Incident Title / Identifier:</label>
            <input
              type="text"
              placeholder="e.g. Arabian Sea Tanker Corridor Discharge"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none transition"
            />
          </div>

          <div className="space-y-1">
            <label className="text-slate-600 font-bold uppercase text-[10px]">Location Description:</label>
            <input
              type="text"
              required
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none transition"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-slate-600 font-bold uppercase text-[10px]">Centroid Latitude (°N):</label>
              <input
                type="number"
                step="0.0001"
                required
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none transition"
              />
            </div>
            <div className="space-y-1">
              <label className="text-slate-600 font-bold uppercase text-[10px]">Centroid Longitude (°E):</label>
              <input
                type="number"
                step="0.0001"
                required
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none transition"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-slate-600 font-bold uppercase text-[10px]">Satellite Sensor Product:</label>
            <select
              value={satellite}
              onChange={(e) => setSatellite(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none transition"
            >
              <option value="Sentinel-1A SAR">Sentinel-1A SAR (C-Band Radar)</option>
              <option value="Sentinel-1B SAR">Sentinel-1B SAR (C-Band Radar)</option>
              <option value="Sentinel-2 MSI">Sentinel-2 MSI (Multispectral Optical)</option>
              <option value="TerraSAR-X">TerraSAR-X (X-Band High-Resolution)</option>
            </select>
          </div>

          {/* Quick presets */}
          <div className="pt-2">
            <span className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Quick Geographic Presets:</span>
            <div className="flex flex-wrap gap-1.5 text-[10px]">
              <button
                type="button"
                onClick={() => { setLocationName('Malacca Strait'); setLat('2.450'); setLng('101.880'); }}
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded font-semibold text-slate-700 transition"
              >
                Malacca Strait (2.45°N, 101.88°E)
              </button>
              <button
                type="button"
                onClick={() => { setLocationName('Persian Gulf'); setLat('25.820'); setLng('55.240'); }}
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded font-semibold text-slate-700 transition"
              >
                Persian Gulf (25.82°N, 55.24°E)
              </button>
              <button
                type="button"
                onClick={() => { setLocationName('North Sea Forties Field'); setLat('57.750'); setLng('0.920'); }}
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded font-semibold text-slate-700 transition"
              >
                North Sea (57.75°N, 0.92°E)
              </button>
            </div>
          </div>

          {/* Submit */}
          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold border border-slate-200 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreating}
              className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold transition flex items-center space-x-1.5 shadow-sm"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>{isCreating ? 'INITIALIZING...' : 'INITIALIZE CASE'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
