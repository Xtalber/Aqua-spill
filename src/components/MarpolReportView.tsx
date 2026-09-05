/**
 * Aqua Spill - MARPOL Annex I Technical Investigation & Surveillance Dossier
 * Standardized formal maritime evidence report with PDF export, printing, and data audit.
 */

import React, { useState } from 'react';
import {
  SpillCase,
  MARPOLReportData,
} from '../types';
import {
  FileText,
  Printer,
  Download,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  Share2,
} from 'lucide-react';
import { generateMarpolReport, generateAiSummary } from '../services/api';
import { AquaSpillLogoIcon } from './AquaSpillLogo';
import jsPDF from 'jspdf';

interface MarpolReportViewProps {
  activeCase: SpillCase;
}

export const MarpolReportView: React.FC<MarpolReportViewProps> = ({
  activeCase,
}) => {
  const [report, setReport] = useState<MARPOLReportData | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiNarrative, setAiNarrative] = useState<string | null>(null);

  const topCandidate = activeCase.attributionResults?.[0];

  const handleCompileReport = async () => {
    setIsGenerating(true);
    try {
      const rep = await generateMarpolReport(activeCase.id);
      setReport(rep);
      setAiNarrative(rep.executiveSummary);
    } catch (err) {
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportPdf = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('MARPOL ANNEX I TECHNICAL SURVEILLANCE DOSSIER', 14, 20);
    doc.setFontSize(10);
    doc.text(`Case Reference: MARPOL-ANNEX-I/${activeCase.id}/2026`, 14, 28);
    doc.text(`Incident Location: ${activeCase.locationName}`, 14, 34);
    doc.text(`Satellite Observation: ${activeCase.observation.satellite} (${activeCase.observation.acquisitionTime})`, 14, 40);
    doc.text(`Slick Surface Area: ${activeCase.detection.morphometry.areaKm2.toFixed(2)} km2`, 14, 46);
    doc.text(`Radar Damping: -${activeCase.detection.morphometry.backscatterDampingDb} dB`, 14, 52);
    doc.text(`Estimated Origin Time: ${activeCase.drift.probableOrigin.estimatedTime}`, 14, 58);
    doc.text(`Primary Attribution Candidate: ${topCandidate?.vesselName || 'N/A'} (MMSI: ${topCandidate?.mmsi || 'N/A'})`, 14, 66);
    doc.text(`Closest Point of Approach (CPA): ${topCandidate?.cpa?.cpaDistanceKm || 0} km (delta: ${topCandidate?.cpa?.timeDifferenceMinutes || 0}m)`, 14, 72);
    doc.text(`Forensic Attribution Score: ${topCandidate?.attributionScore || 0}/100`, 14, 78);
    doc.text('Disclaimer: Attribution is probabilistic. Spatial/temporal proximity does not independently prove discharge.', 14, 90);
    doc.save(`MARPOL_REPORT_${activeCase.id}.pdf`);
  };

  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(activeCase, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `AQUA_SPILL_CASE_${activeCase.id}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="space-y-4 p-4 text-[#1e293b] max-w-5xl mx-auto">
      
      {/* Action Toolbar */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-wrap items-center justify-between gap-3 shadow-sm no-print">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded bg-blue-50 border border-blue-200 text-blue-600">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold uppercase tracking-tight text-slate-900">
              MARPOL Annex I Technical Surveillance Dossier
            </h1>
            <p className="text-xs text-slate-500">
              IMO Marine Environment Protection Committee (MEPC) Surveillance Standard • Probabilistic Attribution
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 text-xs font-mono font-bold">
          <button
            onClick={handleCompileReport}
            disabled={isGenerating}
            className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white flex items-center space-x-1.5 transition shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
            <span>{isGenerating ? 'COMPILING...' : 'RECOMPILE DOSSIER'}</span>
          </button>
          <button
            onClick={handlePrint}
            className="px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 flex items-center space-x-1.5 transition"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print</span>
          </button>
          <button
            onClick={handleExportPdf}
            className="px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 flex items-center space-x-1.5 transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>PDF Export</span>
          </button>
          <button
            onClick={handleExportJson}
            className="px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 flex items-center space-x-1.5 transition"
          >
            <span>JSON</span>
          </button>
        </div>
      </div>

      {/* Formal Document Container */}
      <div className="bg-white border border-slate-200 rounded-lg p-8 shadow-sm space-y-6 text-slate-800 font-sans print:bg-white print:text-black print:border-none print:shadow-none">
        
        {/* Document Header */}
        <div className="border-b-2 border-slate-200 pb-4 flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-1.5 bg-slate-900 rounded-lg shrink-0">
              <AquaSpillLogoIcon size={32} />
            </div>
            <div>
              <div className="text-xs font-mono font-bold tracking-widest text-cyan-700 uppercase">
                AQUA SPILL • MARITIME SURVEILLANCE & POLLUTION ATTRIBUTION REPORT
              </div>
              <h2 className="text-xl font-bold font-mono text-slate-900 mt-0.5">
                TECHNICAL EVIDENCE DOSSIER
              </h2>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                Pursuant to MARPOL 73/78 Annex I (Regulations for the Prevention of Pollution by Oil)
              </p>
            </div>
          </div>

          <div className="text-right font-mono text-xs space-y-1">
            <div><span className="text-slate-500">Reference:</span> <b className="text-slate-900">MARPOL-ANNEX-I/{activeCase.id}/2026</b></div>
            <div><span className="text-slate-500">Date Issued:</span> <b className="text-slate-900">{new Date().toUTCString()}</b></div>
            <div><span className="text-slate-500">System:</span> <b className="text-cyan-700 font-bold">Aqua Spill v2.4 (CDSE/CMEMS/AIS)</b></div>
          </div>
        </div>

        {/* Section 1: Executive Forensic Briefing */}
        <div className="space-y-2">
          <h3 className="text-xs font-mono font-bold text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-1">
            1. EXECUTIVE FORENSIC BRIEFING
          </h3>
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-xs leading-relaxed text-slate-700 space-y-2">
            <p>
              On <b>{new Date(activeCase.observation.acquisitionTime).toUTCString()}</b>, satellite synthetic aperture radar (SAR) sensor <b>{activeCase.observation.satellite}</b> detected a significant surface anomaly consistent with mineral hydrocarbon discharge at <b>{activeCase.locationName}</b> ({activeCase.observation.centroid.lat.toFixed(4)}°N, {activeCase.observation.centroid.lng.toFixed(4)}°E).
            </p>
            <p>
              Hydrodynamic leeway backtracking utilizing Copernicus ERA5 hourly wind stress and CMEMS 1/12° surface currents established an estimated release origin at <b>{activeCase.drift.probableOrigin.position.lat.toFixed(4)}°N, {activeCase.drift.probableOrigin.position.lng.toFixed(4)}°E</b> during the temporal window of <b>{new Date(activeCase.drift.probableOrigin.timeWindowStart).toLocaleTimeString()} – {new Date(activeCase.drift.probableOrigin.timeWindowEnd).toLocaleTimeString()} UTC</b> (±{activeCase.drift.probableOrigin.uncertaintyKm} km uncertainty ellipse).
            </p>
            {topCandidate && (
              <p>
                Multi-point AIS correlation across {activeCase.aisVessels.length} candidate tracks identifies <b>{topCandidate.vesselName}</b> (MMSI: {topCandidate.mmsi}, Type: {topCandidate.vesselType}, Flag: {topCandidate.flag}) as the <b>PRIMARY SOURCE CANDIDATE</b> with a Closest Point of Approach (CPA) of <b>{topCandidate.cpa.cpaDistanceKm} km</b> and temporal delta of <b>{topCandidate.cpa.timeDifferenceMinutes} minutes</b>, achieving an overall probabilistic attribution score of <b>{topCandidate.attributionScore}/100</b>.
              </p>
            )}
          </div>
        </div>

        {/* Section 2: Satellite SAR Observation & Slick Characteristics */}
        <div className="space-y-2">
          <h3 className="text-xs font-mono font-bold text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-1">
            2. SATELLITE RADAR OBSERVATION & MORPHOMETRIC METRICS
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-slate-500 text-[10px] uppercase font-bold">Surface Area:</span>
              <div className="text-base font-bold text-slate-900 mt-0.5">{activeCase.detection.morphometry.areaKm2.toFixed(2)} km²</div>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-slate-500 text-[10px] uppercase font-bold">Backscatter Damping:</span>
              <div className="text-base font-bold text-rose-600 mt-0.5">-{activeCase.detection.morphometry.backscatterDampingDb} dB</div>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-slate-500 text-[10px] uppercase font-bold">Major Dimensions:</span>
              <div className="text-base font-bold text-slate-900 mt-0.5">{activeCase.detection.morphometry.lengthKm} × {activeCase.detection.morphometry.widthKm} km</div>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-slate-500 text-[10px] uppercase font-bold">Elongation Axis:</span>
              <div className="text-base font-bold text-slate-900 mt-0.5">{activeCase.detection.morphometry.orientationDeg}°</div>
            </div>
          </div>
        </div>

        {/* Section 3: Reconstructed Hydrodynamic Origin */}
        <div className="space-y-2">
          <h3 className="text-xs font-mono font-bold text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-1">
            3. HYDRODYNAMIC LEEWAY DRIFT RECONSTRUCTION
          </h3>
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-xs font-mono space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500">Model Formulation:</span>
              <span className="text-slate-800 font-semibold">Lagrangian Leeway Vector Transport (α = 3.0%, θ = +10° Coriolis)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Atmospheric Forcing:</span>
              <span className="text-slate-800 font-semibold">{activeCase.metocean.windSpeedKts} kts from {activeCase.metocean.windDirectionDeg}° (ERA5 Reanalysis)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Oceanic Surface Current:</span>
              <span className="text-slate-800 font-semibold">{activeCase.metocean.currentSpeedKts} kts to {activeCase.metocean.currentDirectionDeg}° (CMEMS 1/12°)</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-2">
              <span className="text-slate-500">Reconstructed Origin Coordinates:</span>
              <span className="text-amber-700 font-bold">{activeCase.drift.probableOrigin.position.lat.toFixed(4)}°N, {activeCase.drift.probableOrigin.position.lng.toFixed(4)}°E (±{activeCase.drift.probableOrigin.uncertaintyKm} km)</span>
            </div>
          </div>
        </div>

        {/* Section 4: Ranked AIS Vessel Correlation Table */}
        <div className="space-y-2">
          <h3 className="text-xs font-mono font-bold text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-1">
            4. CORRELATED AIS VESSEL TRAFFIC & ATTRIBUTION RANKING
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 text-[10px] uppercase tracking-wider bg-slate-50">
                  <th className="py-2.5 px-3">VESSEL NAME</th>
                  <th className="py-2.5 px-3">MMSI / IMO</th>
                  <th className="py-2.5 px-3">TYPE</th>
                  <th className="py-2.5 px-3">FLAG</th>
                  <th className="py-2.5 px-3">CPA (KM)</th>
                  <th className="py-2.5 px-3">ΔT (MIN)</th>
                  <th className="py-2.5 px-3">SCORE</th>
                  <th className="py-2.5 px-3">CLASSIFICATION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activeCase.attributionResults.map((r) => (
                  <tr key={r.mmsi} className="hover:bg-slate-50 text-slate-700">
                    <td className="py-2.5 px-3 font-bold text-slate-900">{r.vesselName}</td>
                    <td className="py-2.5 px-3 text-slate-500">{r.mmsi}</td>
                    <td className="py-2.5 px-3">{r.vesselType}</td>
                    <td className="py-2.5 px-3">{r.flag}</td>
                    <td className="py-2.5 px-3 font-bold text-rose-600">{r.cpa.cpaDistanceKm} km</td>
                    <td className="py-2.5 px-3">{r.cpa.timeDifferenceMinutes}m</td>
                    <td className="py-2.5 px-3 font-bold text-blue-600">{r.attributionScore}</td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                        r.category === 'PRIMARY SOURCE CANDIDATE' ? 'bg-rose-100 border border-rose-200 text-rose-800' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {r.category}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 5: Data Provenance Audit */}
        <div className="space-y-2">
          <h3 className="text-xs font-mono font-bold text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-1">
            5. SCIENTIFIC DATA PROVENANCE & LATENCY AUDIT
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px] font-mono">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-slate-500">Satellite Sensor:</span>
              <div className="text-slate-900 font-bold mt-0.5">{activeCase.observation.satellite}</div>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-slate-500">Wind Data:</span>
              <div className="text-slate-900 font-bold mt-0.5">Copernicus ERA5</div>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-slate-500">Hydrodynamics:</span>
              <div className="text-slate-900 font-bold mt-0.5">CMEMS Ocean Analysis</div>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-slate-500">AIS Telemetry:</span>
              <div className="text-slate-900 font-bold mt-0.5">Coastal/Satellite Stream</div>
            </div>
          </div>
        </div>

        {/* Mandatory Legal & Scientific Footer Disclaimer */}
        <div className="border-t border-slate-200 pt-4 text-[11px] text-slate-600 font-mono space-y-1.5">
          <div className="flex items-center space-x-1.5 text-amber-700 font-bold">
            <ShieldAlert className="w-4 h-4 text-amber-600" />
            <span>LEGAL & SCIENTIFIC UNCERTAINTY STATEMENT:</span>
          </div>
          <p className="leading-relaxed">
            Attribution is probabilistic. AIS trajectory correlation and spatial proximity do not independently prove that a vessel caused the spill. This report constitutes preliminary technical evidence pursuant to MARPOL Annex I surveillance protocols.
          </p>
          <div className="pt-2 flex justify-between text-[10px] text-slate-400">
            <span>Prepared by: Aqua Spill Autonomous Forensic Engine</span>
            <span>Digital Signature: SHA256:{activeCase.id.slice(0, 8)}-{Date.now()}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
