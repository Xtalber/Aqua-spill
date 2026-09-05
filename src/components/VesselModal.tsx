/**
 * Aqua Spill - Vessel Track & Kinematics Inspector Modal
 */

import React, { useState } from 'react';
import {
  AISVessel,
  SpillCase,
} from '../types';
import {
  X,
  Ship,
  Navigation,
  Clock,
  Activity,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

interface VesselModalProps {
  vessel: AISVessel | null;
  activeCase: SpillCase;
  isOpen: boolean;
  onClose: () => void;
}

export const VesselModal: React.FC<VesselModalProps> = ({
  vessel,
  activeCase,
  isOpen,
  onClose,
}) => {
  const [selectedWaypointIndex, setSelectedWaypointIndex] = useState<number>(0);

  if (!isOpen || !vessel) return null;

  const scoreInfo = activeCase.attributionResults?.find(r => r.mmsi === vessel.mmsi);
  const selectedWaypoint = vessel.track[selectedWaypointIndex] || vessel.track[0];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-xl max-w-3xl w-full p-6 space-y-4 shadow-xl text-slate-800 text-xs font-mono">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded bg-blue-50 border border-blue-200 text-blue-600">
              <Ship className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-base font-bold text-slate-900">{vessel.vesselName}</span>
                <span className="text-xs text-slate-500 font-semibold">({vessel.flag})</span>
              </div>
              <p className="text-[11px] text-slate-500">
                MMSI: <span className="font-bold text-slate-800">{vessel.mmsi}</span> {vessel.imo ? `| IMO: ${vessel.imo}` : ''} | Callsign: {vessel.callsign || 'N/A'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Vessel Particulars Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-slate-500 text-[10px] uppercase font-bold">Vessel Type:</span>
            <div className="font-bold text-slate-900 mt-0.5">{vessel.vesselType}</div>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-slate-500 text-[10px] uppercase font-bold">Dimensions (L × B):</span>
            <div className="font-bold text-slate-900 mt-0.5">{vessel.lengthMeters || 228}m × {vessel.beamMeters || 32}m</div>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-slate-500 text-[10px] uppercase font-bold">Draught:</span>
            <div className="font-bold text-slate-900 mt-0.5">{vessel.draughtMeters || 12.4} m</div>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-slate-500 text-[10px] uppercase font-bold">Destination / ETA:</span>
            <div className="font-bold text-blue-600 mt-0.5 truncate">{vessel.destination || 'SINGAPORE'} ({vessel.eta || '08-30 18:00'})</div>
          </div>
        </div>

        {/* Forensic Summary Badge */}
        {scoreInfo && (
          <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-500 uppercase font-bold block">MARPOL Surveillance Status:</span>
              <span className={`font-bold ${scoreInfo.category === 'PRIMARY SOURCE CANDIDATE' ? 'text-rose-600' : 'text-amber-700'}`}>
                {scoreInfo.category} ({scoreInfo.attributionScore}/100)
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-500 uppercase font-bold block">Closest Approach (CPA):</span>
              <span className="font-bold text-rose-600">{scoreInfo.cpa.cpaDistanceKm} km at {scoreInfo.cpa.cpaTime ? new Date(scoreInfo.cpa.cpaTime).toLocaleTimeString() : '06:30'} UTC</span>
            </div>
          </div>
        )}

        {/* Waypoint Track Timeline Scrubber */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-slate-800 font-bold">
            <span className="text-[11px] uppercase tracking-wider text-slate-600">AIS Waypoint Trajectory Scrubber ({vessel.track.length} Waypoints)</span>
            <span className="text-blue-600 text-[11px] font-bold">Selected: Waypoint #{selectedWaypointIndex + 1}</span>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-3">
            <input
              type="range"
              min="0"
              max={vessel.track.length - 1}
              value={selectedWaypointIndex}
              onChange={(e) => setSelectedWaypointIndex(parseInt(e.target.value, 10))}
              className="w-full accent-blue-600 cursor-pointer"
            />

            {selectedWaypoint && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px] pt-1">
                <div>Time: <b className="text-slate-900">{new Date(selectedWaypoint.timestamp).toUTCString()}</b></div>
                <div>Position: <b className="text-slate-900">{selectedWaypoint.lat.toFixed(4)}°N, {selectedWaypoint.lng.toFixed(4)}°E</b></div>
                <div>Speed Over Ground: <b className="text-blue-600">{selectedWaypoint.sogKts} kts</b></div>
                <div>Course Over Ground: <b className="text-blue-600">{selectedWaypoint.cogDeg}°</b></div>
              </div>
            )}
          </div>
        </div>

        {/* Waypoints Table */}
        <div className="max-h-44 overflow-y-auto border border-slate-200 rounded-lg">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-wider sticky top-0 border-b border-slate-200">
              <tr>
                <th className="py-2 px-2.5">#</th>
                <th className="py-2 px-2.5">TIMESTAMP (UTC)</th>
                <th className="py-2 px-2.5">LAT / LNG</th>
                <th className="py-2 px-2.5">SOG</th>
                <th className="py-2 px-2.5">COG</th>
                <th className="py-2 px-2.5">NAV STATUS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[11px]">
              {vessel.track.map((pt, idx) => (
                <tr
                  key={idx}
                  onClick={() => setSelectedWaypointIndex(idx)}
                  className={`cursor-pointer hover:bg-slate-50 ${
                    idx === selectedWaypointIndex ? 'bg-blue-50/80 text-blue-900 font-semibold' : 'text-slate-700'
                  }`}
                >
                  <td className="py-1.5 px-2.5 font-bold">{idx + 1}</td>
                  <td className="py-1.5 px-2.5">{new Date(pt.timestamp).toLocaleTimeString()}</td>
                  <td className="py-1.5 px-2.5">{pt.lat.toFixed(3)}°N, {pt.lng.toFixed(3)}°E</td>
                  <td className="py-1.5 px-2.5">{pt.sogKts} kts</td>
                  <td className="py-1.5 px-2.5">{pt.cogDeg}°</td>
                  <td className="py-1.5 px-2.5 text-slate-500">{pt.navStatus || 'Under way using engine'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-slate-100">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded border border-slate-200 transition"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
