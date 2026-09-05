/**
 * Aqua Spill - Datasets & API Integration Hub
 * Features:
 * - Comprehensive Ingested Archive Explorer with full-text search
 * - Instant "Analyze / Ingest in Pipeline" action for any indexed satellite raster
 * - Large Dataset Archive (ZIP) & AIS Stream Multi-File Ingestor
 * - Schema recognition & provenance metrics
 * - Clear Zero-API-Key Local Mode confirmation
 */

import React, { useState, useEffect } from 'react';
import {
  DatasetItem,
  SystemHealthStatus,
  SpillCase,
} from '../types';
import {
  Database,
  UploadCloud,
  FileCheck,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Shield,
  Key,
  Server,
  RefreshCw,
  Search,
  FolderOpen,
  Satellite,
  Ship,
  Wind,
  Layers,
  Play,
  FileText,
  Clock,
  MapPin,
  Tag,
} from 'lucide-react';
import { fetchDatasets, importDataset } from '../services/api';
import { datasetManager } from '../services/datasetManager';
import { processLargeDatasetZip, IndexedDatasetFile, ComprehensiveDataset } from '../services/datasetZipProcessor';
import { readGeoTiffFile, readStandardImage, executeSarDetectionPipeline } from '../services/sarImageProcessor';
import { MasterDatasetImporter } from './MasterDatasetImporter';

interface DatasetsViewProps {
  health: SystemHealthStatus | null;
  onUpdateCase?: (updatedCase: SpillCase) => void;
  activeCase?: SpillCase;
  onSelectTab?: (tab: string) => void;
}

export const DatasetsView: React.FC<DatasetsViewProps> = ({
  health,
  onUpdateCase,
  activeCase,
  onSelectTab,
}) => {
  const [datasets, setDatasets] = useState<DatasetItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [zipProgress, setZipProgress] = useState<string | null>(null);
  const [activeDataset, setActiveDataset] = useState<ComprehensiveDataset | null>(
    datasetManager.getActiveComprehensiveDataset()
  );

  useEffect(() => {
    loadDatasets();
    setActiveDataset(datasetManager.getActiveComprehensiveDataset());
  }, []);

  const loadDatasets = async () => {
    try {
      const data = await fetchDatasets();
      setDatasets(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleZipUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setUploadError(null);
    setZipProgress(`Extracting and indexing ${file.name}...`);

    try {
      const comprehensive = await processLargeDatasetZip(file, (p) => {
        setZipProgress(`[${p.stage}] ${p.message}`);
      });

      datasetManager.addComprehensiveDataset(comprehensive, true);
      setActiveDataset(comprehensive);
      setZipProgress(`Successfully indexed ${comprehensive.totalFiles} files in ${file.name}`);
    } catch (err: any) {
      setUploadError(err.message || 'Failed to extract and index dataset package');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAisOrJsonUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setUploadError(null);
    setUploadResult(null);

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const content = reader.result as string;
        const fileType = file.name.endsWith('.json') || file.name.endsWith('.geojson') ? 'json' : 'csv';
        const res = await importDataset(content, fileType, file.name);
        setUploadResult(res);
        loadDatasets();
      } catch (err: any) {
        setUploadError(err.message || 'Failed to import dataset');
      } finally {
        setIsLoading(false);
      }
    };
    reader.readAsText(file);
  };

  // Open an indexed image in the analysis pipeline
  const handleOpenImageInPipeline = async (file: IndexedDatasetFile) => {
    if (!file.blob || !onUpdateCase || !activeCase) return;

    try {
      setIsLoading(true);
      const imgFile = new File([file.blob], file.fileName, { type: file.mimeType });
      let canvas: HTMLCanvasElement;
      let rasterWidth = 0;
      let rasterHeight = 0;

      if (file.extension === 'TIF' || file.extension === 'TIFF') {
        const buf = await file.blob.arrayBuffer();
        const res = await readGeoTiffFile(buf, file.fileName);
        canvas = res.canvas;
        rasterWidth = res.rasterWidth;
        rasterHeight = res.rasterHeight;
      } else {
        const res = await readStandardImage(imgFile);
        canvas = res.canvas;
        rasterWidth = res.rasterWidth;
        rasterHeight = res.rasterHeight;
      }

      const meta = {
        fileName: file.fileName,
        fileSize: file.sizeBytes,
        format: file.mimeType,
        imageDimensions: { width: rasterWidth, height: rasterHeight },
        satellite: file.satellite || 'Indexed SAR Scene',
        sensor: file.sensor || 'Synthetic Aperture Radar',
        mission: 'Maritime Remote Sensing',
        polarization: (file.polarization as any) || 'VV',
        orbitDirection: 'DESCENDING' as const,
        acquisitionDate: file.timestamp?.split('T')[0] || new Date().toISOString().split('T')[0],
        acquisitionTime: file.timestamp || new Date().toISOString(),
        productId: file.productId || file.fileName,
        sceneId: file.sceneId || file.fileName,
        resolutionMeters: 10.0,
        pixelSize: null,
        crs: file.hasGeoreferencing ? 'WGS 84 (EPSG:4326)' : 'Unreferenced Raster',
        projection: file.hasGeoreferencing ? 'Geographic Lat/Lon' : 'Raster Space',
        acquisitionMode: 'Wide Swath',
        boundingBox: file.boundingBox || null,
        centroid: file.centroid || null,
        hasGeoreferencing: file.hasGeoreferencing,
        matchedDatasetName: activeDataset?.name,
      };

      const result = executeSarDetectionPipeline(canvas, meta);

      const detected = result.detectedSlick;
      const fallbackCentroid = file.centroid || activeCase.observation.centroid || activeCase.detection.centroid;

      const updated: SpillCase = {
        ...activeCase,
        locationName: file.hasGeoreferencing && file.centroid
          ? `Lat ${file.centroid.lat.toFixed(3)}°, Lng ${file.centroid.lng.toFixed(3)}° (${file.satellite || 'SAR'})`
          : `Local Scene (${file.fileName})`,
        sourceType: 'LOCAL_UPLOAD',
        confidenceScore: detected ? detected.confidenceScore : 50,
        confidenceLevel: detected ? detected.confidenceLevel : 'MEDIUM',
        observation: {
          ...activeCase.observation,
          id: `OBS-${file.fileName.replace(/[^a-zA-Z0-9]/g, '_')}`,
          satellite: file.satellite || 'Sentinel-1A SAR',
          centroid: fallbackCentroid,
          acquisitionTime: file.timestamp || new Date().toISOString(),
          imageUrl: result.overlayImageUrl,
        },
        detection: detected
          ? {
              ...activeCase.detection,
              status: result.overallDetectionStatus === 'SLICK_DETECTED' ? 'DETECTED' : 'UNCONFIRMED',
              confidence: detected.confidenceLevel,
              confidenceScore: detected.confidenceScore,
              centroid: detected.centroidGeo || fallbackCentroid,
              morphometry: {
                areaKm2: detected.geographicAreaKm2 || (detected.pixelArea * 0.0001),
                perimeterKm: detected.perimeterKm || (detected.perimeterPx * 0.01),
                lengthKm: detected.lengthPx * 0.01,
                widthKm: detected.widthPx * 0.01,
                aspectRatio: detected.aspectRatio,
                orientationDeg: detected.orientationDeg,
                compactness: detected.compactness,
                backscatterDampingDb: detected.dampingDb,
              },
            }
          : activeCase.detection,
      };

      onUpdateCase(updated);
      if (onSelectTab) {
        onSelectTab('detection');
      }
    } catch (err) {
      console.error('Failed opening image in pipeline:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredIndexedFiles = activeDataset
    ? activeDataset.files.filter((f) => {
        const matchesQuery =
          !searchQuery.trim() ||
          f.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          f.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (f.satellite && f.satellite.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (f.groundTruthLabel && f.groundTruthLabel.toLowerCase().includes(searchQuery.toLowerCase()));

        const matchesCat = categoryFilter === 'ALL' || f.category === categoryFilter;

        return matchesQuery && matchesCat;
      })
    : [];

  return (
    <div className="space-y-4 p-4 text-[#1e293b] max-w-7xl mx-auto font-sans">
      
      {/* Title Header */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-wrap items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded bg-blue-50 border border-blue-200 text-blue-600">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-base font-bold uppercase tracking-tight text-slate-900">
                Dataset Management & Telemetry Repositories
              </h1>
              <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-mono font-bold">
                100% LOCAL & OFFLINE CAPABLE
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Client-side indexing for ZIP packages, GeoTIFF imagery, sidecar manifests, and AIS telemetry.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={loadDatasets}
            className="px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-mono font-bold flex items-center space-x-1.5 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh Index</span>
          </button>
        </div>
      </div>

      {/* DARTIS 2019 Master Dataset Engine & Importer */}
      <MasterDatasetImporter
        onUpdateCase={onUpdateCase}
        activeCase={activeCase}
        onSelectTab={onSelectTab}
      />

      {/* Grid: Upload Controls & API Status */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* Left 6 Cols: Multi-File Ingestion Hub */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm space-y-3">
            <div className="border-b border-slate-100 pb-2 flex items-center justify-between">
              <h3 className="text-[11px] uppercase font-bold text-slate-800 tracking-wider flex items-center space-x-1.5">
                <FolderOpen className="w-4 h-4 text-blue-600" />
                <span>Ingest Complete Dataset Archive (ZIP)</span>
              </h3>
              <span className="text-[10px] text-blue-600 font-mono font-bold">MULTI-FILE ARCHIVE</span>
            </div>

            <label className="border-2 border-dashed border-slate-300 hover:border-blue-500 bg-slate-50 rounded-lg p-5 flex flex-col items-center justify-center cursor-pointer transition text-center space-y-2">
              <UploadCloud className="w-7 h-7 text-blue-600" />
              <div>
                <span className="text-xs font-mono font-bold text-slate-900">
                  Select or drop dataset archive package (.zip)
                </span>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Preserves directory structure: satellite/, metadata/, ais/, weather/, labels/
                </p>
              </div>
              <input type="file" accept=".zip" onChange={handleZipUpload} className="hidden" />
            </label>

            {zipProgress && (
              <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-xs font-mono text-blue-800 flex items-center space-x-2">
                <RefreshCw className="w-4 h-4 animate-spin text-blue-600 shrink-0" />
                <span className="truncate">{zipProgress}</span>
              </div>
            )}

            {/* AIS / CSV Single Ingestion */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs font-mono text-slate-600">Or import standalone AIS / Telemetry:</span>
              <label className="px-3 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 text-xs font-mono font-bold cursor-pointer transition">
                <span>+ Browse CSV / JSON</span>
                <input type="file" accept=".csv,.json,.geojson" onChange={handleAisOrJsonUpload} className="hidden" />
              </label>
            </div>

            {/* Schema detection output */}
            {uploadResult && (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 space-y-1 text-xs font-mono">
                <div className="flex items-center justify-between text-emerald-800 font-bold">
                  <span className="flex items-center space-x-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>SCHEMA RECOGNIZED & INGESTED</span>
                  </span>
                  <span>{uploadResult.validRows} Records</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-emerald-900 pt-1">
                  <div>Vessels Extracted: <b>{uploadResult.vesselsExtracted}</b></div>
                  <div>Invalid Rows: <b>{uploadResult.invalidRows}</b></div>
                </div>
              </div>
            )}

            {uploadError && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs font-mono text-rose-800 flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right 6 Cols: Capability & API Independence Monitor */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm space-y-3">
            <div className="border-b border-slate-100 pb-2 flex items-center justify-between">
              <h3 className="text-[11px] uppercase font-bold text-slate-800 tracking-wider flex items-center space-x-1.5">
                <Shield className="w-4 h-4 text-emerald-600" />
                <span>System Capability & Architecture Status</span>
              </h3>
              <span className="text-[10px] text-emerald-700 font-mono font-bold">ZERO REQUIRED KEYS</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
                <div className="text-[10px] text-slate-500 uppercase">Local SAR Processing</div>
                <div className="font-bold text-emerald-700 flex items-center space-x-1 mt-0.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>READY (CLIENT-SIDE)</span>
                </div>
              </div>

              <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
                <div className="text-[10px] text-slate-500 uppercase">Dataset Ingestion</div>
                <div className="font-bold text-emerald-700 flex items-center space-x-1 mt-0.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>READY (STREAMING ZIP)</span>
                </div>
              </div>

              <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
                <div className="text-[10px] text-slate-500 uppercase">AIS Attribution Engine</div>
                <div className="font-bold text-emerald-700 flex items-center space-x-1 mt-0.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>READY (CPA / HAVERSINE)</span>
                </div>
              </div>

              <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
                <div className="text-[10px] text-slate-500 uppercase">GIS Map Canvas</div>
                <div className="font-bold text-emerald-700 flex items-center space-x-1 mt-0.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>READY (LEAFLET / OPENSTREETMAP)</span>
                </div>
              </div>
            </div>

            <div className="p-2.5 rounded bg-blue-50 border border-blue-200 text-xs font-mono text-blue-900 space-y-1">
              <div className="font-bold">OPTIONAL LIVE ENRICHMENT APIS:</div>
              <p className="text-[11px] text-blue-700">
                External services (Copernicus CDSE, Open-Meteo ERA5, CMEMS Currents, Gemini AI) enhance live streaming telemetry when keys are present, but the core analysis pipeline operates completely independently.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Active Ingested Archive Explorer */}
      {activeDataset && (
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-bold uppercase tracking-tight text-slate-900">
                  Active Ingested Dataset Archive: {activeDataset.name}
                </h3>
                <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-mono font-bold">
                  {activeDataset.totalFiles} Indexed Files
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {activeDataset.imageFiles.length} Imagery Rasters • {activeDataset.vessels.length} AIS Vessels • {activeDataset.metadataFiles.length} Sidecar Manifests
              </p>
            </div>

            {/* Filter & Search Bar */}
            <div className="flex items-center space-x-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search file, scene ID, label..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs font-mono text-slate-800 w-56 focus:outline-none focus:border-blue-500"
                />
              </div>

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs font-mono text-slate-800 focus:outline-none focus:border-blue-500"
              >
                <option value="ALL">All Categories</option>
                <option value="SATELLITE_IMAGE">Images Only</option>
                <option value="METADATA">Metadata Only</option>
                <option value="AIS_TELEMETRY">AIS Only</option>
                <option value="LABELS">Labels Only</option>
              </select>
            </div>
          </div>

          {/* Files Table */}
          <div className="overflow-x-auto max-h-80 overflow-y-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-[10px] uppercase text-slate-500">
                <tr>
                  <th className="py-2 px-3">FILE PATH</th>
                  <th className="py-2 px-3">CATEGORY</th>
                  <th className="py-2 px-3">SIZE</th>
                  <th className="py-2 px-3">LOCATION / CENTROID</th>
                  <th className="py-2 px-3">TIMESTAMP</th>
                  <th className="py-2 px-3">GROUND TRUTH</th>
                  <th className="py-2 px-3 text-right">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredIndexedFiles.map((file) => (
                  <tr key={file.id} className="hover:bg-slate-50 text-slate-700">
                    <td className="py-2 px-3 font-semibold text-slate-900 max-w-xs truncate" title={file.path}>
                      {file.fileName}
                      <div className="text-[10px] text-slate-400 truncate">{file.path}</div>
                    </td>
                    <td className="py-2 px-3">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                        file.category === 'SATELLITE_IMAGE' ? 'bg-blue-100 text-blue-800' :
                        file.category === 'AIS_TELEMETRY' ? 'bg-amber-100 text-amber-800' :
                        file.category === 'LABELS' ? 'bg-purple-100 text-purple-800' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {file.category}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-500">
                      {(file.sizeBytes / 1024).toFixed(1)} KB
                    </td>
                    <td className="py-2 px-3">
                      {file.centroid ? (
                        <span className="text-emerald-700 font-semibold">
                          {file.centroid.lat.toFixed(3)}°, {file.centroid.lng.toFixed(3)}°
                        </span>
                      ) : (
                        <span className="text-slate-400">Not Available</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-slate-500">
                      {file.timestamp ? file.timestamp.slice(0, 16).replace('T', ' ') : '—'}
                    </td>
                    <td className="py-2 px-3">
                      {file.groundTruthLabel ? (
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                          file.groundTruthLabel === 'OIL_SLICK' ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-700'
                        }`}>
                          {file.groundTruthLabel}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right">
                      {file.category === 'SATELLITE_IMAGE' && file.blob && (
                        <button
                          onClick={() => handleOpenImageInPipeline(file)}
                          className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold transition shadow-xs"
                        >
                          Analyze in Pipeline
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Dataset Catalog Table */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm space-y-3">
        <div className="border-b border-slate-100 pb-2 flex items-center justify-between">
          <h3 className="text-[11px] uppercase font-bold text-slate-800 tracking-wider">
            Sample Reference Repositories ({datasets.length})
          </h3>
          <span className="text-[10px] text-slate-500 font-mono font-bold">Standard Benchmarks</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 text-[10px] uppercase tracking-wider bg-slate-50">
                <th className="py-2.5 px-3">ID / NAME</th>
                <th className="py-2.5 px-3">TYPE</th>
                <th className="py-2.5 px-3">SOURCE</th>
                <th className="py-2.5 px-3">RECORDS</th>
                <th className="py-2.5 px-3">COVERAGE</th>
                <th className="py-2.5 px-3">STATUS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {datasets.map((ds) => (
                <tr key={ds.id} className="hover:bg-slate-50 text-slate-700">
                  <td className="py-2.5 px-3">
                    <div className="font-bold text-slate-900">{ds.name}</div>
                    <div className="text-[10px] text-slate-400">{ds.id}</div>
                  </td>
                  <td className="py-2.5 px-3 text-blue-600 font-semibold">{ds.dataType}</td>
                  <td className="py-2.5 px-3 text-slate-500">{ds.source}</td>
                  <td className="py-2.5 px-3 font-bold text-slate-900">{ds.recordCount.toLocaleString()}</td>
                  <td className="py-2.5 px-3 text-slate-600">{ds.coverage}</td>
                  <td className="py-2.5 px-3">
                    <span className="px-2 py-0.5 rounded bg-emerald-100 border border-emerald-200 text-emerald-800 text-[9px] font-bold">
                      READY
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
