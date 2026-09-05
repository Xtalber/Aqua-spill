/**
 * Aqua Spill - DARTIS 2019 Master Dataset Importer & Catalog
 * Features:
 * - Chunked / Resumable server-side ingestion for ~511 MB ZIP
 * - Real multi-stage progress (Uploading, Extracting, Indexing, Completed, Failed)
 * - Persistent status across page reloads (Supabase + Local Disk backed)
 * - Master status card with exact required metrics:
 *   * Dataset Name: DARTIS 2019
 *   * Total Images
 *   * Oil Spill Images
 *   * Clean / Lookalike Images
 *   * Total Oil Objects Indexed
 *   * Storage Status: Stored in Supabase
 *   * Index Status: Ready
 * - Scene Explorer table with instant "Analyze in SAR Pipeline" action
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Database,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Search,
  FolderOpen,
  Satellite,
  ShieldCheck,
  FileCheck,
  Tag,
  MapPin,
  Clock,
  Play,
  Layers,
  HardDrive,
  Info,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import {
  DartisMasterDataset,
  DartisDatasetImage,
  SpillCase,
} from '../types';
import {
  fetchMasterDatasetStatus,
  uploadMasterDatasetChunked,
  fetchMasterDatasetList,
  matchSarImageCase,
  clearMasterDataset,
  ChunkUploadProgress,
} from '../services/masterDatasetClient';

interface MasterDatasetImporterProps {
  onUpdateCase?: (updatedCase: SpillCase) => void;
  activeCase?: SpillCase;
  onSelectTab?: (tab: string) => void;
}

export const MasterDatasetImporter: React.FC<MasterDatasetImporterProps> = ({
  onUpdateCase,
  activeCase,
  onSelectTab,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [datasetStatus, setDatasetStatus] = useState<DartisMasterDataset | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);

  // Upload & processing state
  const [uploadProgress, setUploadProgress] = useState<ChunkUploadProgress | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFileForRetry, setSelectedFileForRetry] = useState<File | null>(null);

  // Scene catalog state
  const [scenes, setScenes] = useState<DartisDatasetImage[]>([]);
  const [totalScenes, setTotalScenes] = useState(0);
  const [page, setPage] = useState(1);
  const [filterType, setFilterType] = useState<'ALL' | 'OIL' | 'CLEAN'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCatalogLoading, setIsCatalogLoading] = useState(false);
  const [actionLoadingScene, setActionLoadingScene] = useState<string | null>(null);

  // Initial load: check whether master dataset is already imported
  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    setIsLoadingStatus(true);
    try {
      const status = await fetchMasterDatasetStatus();
      setDatasetStatus(status);
      if (status.isImported) {
        loadScenes(1, filterType, searchQuery);
      }
    } catch (err) {
      console.warn('[MasterDatasetImporter] Could not load status:', err);
    } finally {
      setIsLoadingStatus(false);
    }
  };

  const loadScenes = async (targetPage: number, fType: 'ALL' | 'OIL' | 'CLEAN', q: string) => {
    setIsCatalogLoading(true);
    try {
      const res = await fetchMasterDatasetList({
        page: targetPage,
        limit: 15,
        oilOnly: fType === 'OIL',
        cleanOnly: fType === 'CLEAN',
        search: q.trim() || undefined,
      });
      setScenes(res.images);
      setTotalScenes(res.total);
      setPage(res.page);
    } catch (err) {
      console.warn('[MasterDatasetImporter] Could not load scenes:', err);
    } finally {
      setIsCatalogLoading(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFileForRetry(file);
    await startUpload(file);
  };

  const startUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const result = await uploadMasterDatasetChunked(file, (prog) => {
        setUploadProgress(prog);
      });
      setDatasetStatus(result);
      setIsUploading(false);
      loadScenes(1, 'ALL', '');
    } catch (err: any) {
      setIsUploading(false);
      console.error('[MasterDatasetImporter] Upload failed:', err);
    }
  };

  const handleRetry = () => {
    if (selectedFileForRetry) {
      startUpload(selectedFileForRetry);
    } else if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFilterChange = (type: 'ALL' | 'OIL' | 'CLEAN') => {
    setFilterType(type);
    loadScenes(1, type, searchQuery);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadScenes(1, filterType, searchQuery);
  };

  const handleLoadSceneIntoPipeline = async (scene: DartisDatasetImage) => {
    setActionLoadingScene(scene.normalizedFileName);
    try {
      const res = await matchSarImageCase(scene.normalizedFileName, activeCase?.id);
      if (res.matched && res.case && onUpdateCase) {
        onUpdateCase(res.case);
        if (onSelectTab) {
          onSelectTab('detection');
        }
      }
    } catch (err) {
      console.error('Failed loading scene into pipeline:', err);
    } finally {
      setActionLoadingScene(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Master Dataset Header & Import Trigger Card */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-bold uppercase tracking-tight text-slate-900">
                  DARTIS 2019 Master Dataset Engine
                </h3>
                <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-mono font-bold">
                  SENTINEL-1 SAR ARCHIVE
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Authoritative ground-truth repository (~511 MB) containing SAR rasters, spatial contours, and metocean telemetry.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="file"
              ref={fileInputRef}
              accept=".zip"
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white text-xs font-mono font-bold flex items-center space-x-2 shadow-sm transition"
            >
              <UploadCloud className="w-4 h-4" />
              <span>{datasetStatus?.isImported ? 'Re-import / Update Dataset' : 'Import Dataset'}</span>
            </button>
            <button
              onClick={loadStatus}
              disabled={isLoadingStatus}
              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs transition"
              title="Refresh status"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingStatus ? 'animate-spin text-blue-600' : ''}`} />
            </button>
          </div>
        </div>

        {/* Upload & Ingestion Progress Banner */}
        {uploadProgress && (
          <div
            className={`p-4 rounded-lg border ${
              uploadProgress.stage === 'FAILED'
                ? 'bg-rose-50 border-rose-200 text-rose-900'
                : uploadProgress.stage === 'COMPLETED'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-blue-50 border-blue-200 text-blue-900'
            } space-y-3 font-mono text-xs`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {uploadProgress.stage === 'FAILED' ? (
                  <AlertCircle className="w-4 h-4 text-rose-600" />
                ) : uploadProgress.stage === 'COMPLETED' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : (
                  <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />
                )}
                <span className="font-bold uppercase tracking-wider">
                  {uploadProgress.stage === 'UPLOADING' && 'Step 1: Uploading ZIP Archive'}
                  {uploadProgress.stage === 'EXTRACTING' && 'Step 2: Server-Side ZIP Extraction'}
                  {uploadProgress.stage === 'INDEXING' && 'Step 3: Indexing DARTIS_2019.tab Metadata'}
                  {uploadProgress.stage === 'COMPLETED' && 'Ingestion Completed'}
                  {uploadProgress.stage === 'FAILED' && 'Ingestion Failed'}
                </span>
              </div>
              <span className="font-bold text-[11px]">{uploadProgress.percent}%</span>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-slate-200/80 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  uploadProgress.stage === 'FAILED'
                    ? 'bg-rose-600'
                    : uploadProgress.stage === 'COMPLETED'
                    ? 'bg-emerald-600'
                    : 'bg-blue-600'
                }`}
                style={{ width: `${Math.max(4, uploadProgress.percent)}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-600">
              <span className="truncate pr-2">{uploadProgress.message}</span>
              {uploadProgress.totalChunks > 1 && (
                <span className="shrink-0">
                  Chunk {uploadProgress.currentChunk} / {uploadProgress.totalChunks}
                </span>
              )}
            </div>

            {uploadProgress.stage === 'FAILED' && (
              <div className="pt-2 flex items-center justify-between border-t border-rose-200">
                <span className="text-rose-700 font-medium">{uploadProgress.error}</span>
                <button
                  onClick={handleRetry}
                  className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-[11px] font-bold transition flex items-center space-x-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Retry Upload</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Master Dataset Status Cards */}
        {datasetStatus && datasetStatus.isImported ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              
              {/* Dataset Name */}
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <div className="text-[10px] font-mono uppercase text-slate-500 font-bold">
                  Dataset Name
                </div>
                <div className="text-sm font-bold text-slate-900 font-mono mt-0.5 truncate">
                  {datasetStatus.name}
                </div>
                <div className="text-[10px] text-slate-500 font-mono">
                  {datasetStatus.zipFileName || 'DARTIS_2019_dataset.zip'}
                </div>
              </div>

              {/* Total Images */}
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <div className="text-[10px] font-mono uppercase text-slate-500 font-bold">
                  Total Images
                </div>
                <div className="text-lg font-bold text-slate-900 font-mono mt-0.5">
                  {datasetStatus.totalImages}
                </div>
                <div className="text-[10px] text-blue-600 font-mono font-medium">
                  {datasetStatus.metadataSource}
                </div>
              </div>

              {/* Oil Spill Images */}
              <div className="p-3 rounded-lg bg-amber-50/60 border border-amber-200/80">
                <div className="text-[10px] font-mono uppercase text-amber-800 font-bold flex items-center justify-between">
                  <span>Oil Spill Images</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
                </div>
                <div className="text-lg font-bold text-amber-900 font-mono mt-0.5">
                  {datasetStatus.oilSpillImages}
                </div>
                <div className="text-[10px] text-amber-700 font-mono">Class 1 Verified</div>
              </div>

              {/* Clean / Lookalike Images */}
              <div className="p-3 rounded-lg bg-emerald-50/60 border border-emerald-200/80">
                <div className="text-[10px] font-mono uppercase text-emerald-800 font-bold flex items-center justify-between">
                  <span>Clean / Lookalikes</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                </div>
                <div className="text-lg font-bold text-emerald-900 font-mono mt-0.5">
                  {datasetStatus.cleanImages}
                </div>
                <div className="text-[10px] text-emerald-700 font-mono">Class 0 Natural</div>
              </div>

              {/* Total Oil Objects Indexed */}
              <div className="p-3 rounded-lg bg-indigo-50/60 border border-indigo-200/80">
                <div className="text-[10px] font-mono uppercase text-indigo-800 font-bold">
                  Total Oil Objects
                </div>
                <div className="text-lg font-bold text-indigo-900 font-mono mt-0.5">
                  {datasetStatus.totalOilObjects}
                </div>
                <div className="text-[10px] text-indigo-700 font-mono">Geo Polygons & Areas</div>
              </div>

              {/* Storage & Index Status */}
              <div className="p-3 rounded-lg bg-emerald-50/60 border border-emerald-200/80">
                <div className="text-[10px] font-mono uppercase text-emerald-800 font-bold">
                  Storage Status
                </div>
                <div className="text-xs font-bold text-emerald-900 font-mono mt-0.5 flex items-center space-x-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="truncate">{datasetStatus.storageStatus}</span>
                </div>
                <div className="text-[10px] text-emerald-700 font-mono flex items-center space-x-1 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  <span>Index Status: <b>{datasetStatus.indexStatus}</b></span>
                </div>
              </div>

            </div>
          </div>
        ) : (
          !isUploading && (
            <div className="p-6 border-2 border-dashed border-slate-300 rounded-lg bg-slate-50 text-center space-y-3">
              <div className="w-12 h-12 mx-auto rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
                <UploadCloud className="w-6 h-6" />
              </div>
              <div className="max-w-md mx-auto">
                <h4 className="text-sm font-bold text-slate-800">
                  Master Dataset Not Yet Imported
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  Upload <code>DARTIS_2019_dataset.zip</code> (~511 MB) using the chunked resumable importer. Once uploaded, the dataset will be permanently stored and automatically available across sessions without re-uploading.
                </p>
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-mono font-bold inline-flex items-center space-x-2 shadow-sm transition"
              >
                <UploadCloud className="w-4 h-4" />
                <span>Select DARTIS_2019_dataset.zip</span>
              </button>
            </div>
          )
        )}
      </div>

      {/* Scene Catalog & Explorer Table */}
      {datasetStatus?.isImported && (
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center space-x-2">
              <h4 className="text-xs font-bold uppercase text-slate-800 tracking-wider flex items-center space-x-1.5">
                <Layers className="w-4 h-4 text-blue-600" />
                <span>Indexed DARTIS 2019 Scenes ({totalScenes})</span>
              </h4>
            </div>

            {/* Filter Tabs & Search */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Filter Tabs */}
              <div className="flex rounded-md bg-slate-100 p-0.5 text-xs font-mono">
                <button
                  onClick={() => handleFilterChange('ALL')}
                  className={`px-2.5 py-1 rounded ${
                    filterType === 'ALL'
                      ? 'bg-white text-slate-900 font-bold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All ({datasetStatus.totalImages})
                </button>
                <button
                  onClick={() => handleFilterChange('OIL')}
                  className={`px-2.5 py-1 rounded flex items-center space-x-1 ${
                    filterType === 'OIL'
                      ? 'bg-amber-100 text-amber-900 font-bold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>Oil Spills ({datasetStatus.oilSpillImages})</span>
                </button>
                <button
                  onClick={() => handleFilterChange('CLEAN')}
                  className={`px-2.5 py-1 rounded flex items-center space-x-1 ${
                    filterType === 'CLEAN'
                      ? 'bg-emerald-100 text-emerald-900 font-bold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>Clean / Lookalikes ({datasetStatus.cleanImages})</span>
                </button>
              </div>

              {/* Search Box */}
              <form onSubmit={handleSearchSubmit} className="relative">
                <input
                  type="text"
                  placeholder="Filter patch ID / Sentinel..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-7 pr-3 py-1 text-xs border border-slate-200 rounded-md focus:outline-none focus:border-blue-500 font-mono w-48"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2" />
              </form>
            </div>
          </div>

          {/* Table of Scenes */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-4">Scene / Patch ID</th>
                  <th className="py-2.5 px-4">Ground Truth</th>
                  <th className="py-2.5 px-4">Objects</th>
                  <th className="py-2.5 px-4">Geographic Coordinates</th>
                  <th className="py-2.5 px-4">Acquisition Time</th>
                  <th className="py-2.5 px-4">Satellite Platform</th>
                  <th className="py-2.5 px-4 text-right">Pipeline Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {isCatalogLoading ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto text-blue-600 mb-1" />
                      <span>Loading indexed scenes...</span>
                    </td>
                  </tr>
                ) : scenes.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      No scenes found matching the current criteria.
                    </td>
                  </tr>
                ) : (
                  scenes.map((scene) => (
                    <tr
                      key={scene.id}
                      className="hover:bg-slate-50/80 transition group"
                    >
                      <td className="py-2.5 px-4 font-bold text-slate-900">
                        <div className="flex items-center space-x-2">
                          <span className="p-1 rounded bg-slate-100 text-slate-700">
                            <Satellite className="w-3.5 h-3.5" />
                          </span>
                          <div>
                            <div>{scene.patchId}</div>
                            <div className="text-[10px] text-slate-400 font-normal truncate max-w-[180px]">
                              {scene.normalizedFileName}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-4">
                        {scene.oilPresent ? (
                          <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-200 text-[10px] font-bold">
                            OIL SPILL (CLASS 1)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-200 text-[10px] font-bold">
                            CLEAN / LOOKALIKE
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 font-bold">
                        {scene.oilPresent ? (
                          <span className="text-amber-800">
                            {scene.objectCount} Object(s)
                            {scene.oilObjects.length > 0 && (
                              <span className="text-[10px] font-normal text-slate-500 block">
                                {(scene.oilObjects.reduce((a, b) => a + b.areaKm2, 0)).toFixed(2)} km² total
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-slate-400">0 Objects</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="flex items-center space-x-1 text-slate-800">
                          <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>
                            {scene.center.lat.toFixed(4)}°N, {scene.center.lng.toFixed(4)}°E
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-slate-600">
                        <div className="flex items-center space-x-1">
                          <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{scene.acquisitionStartTime.replace('T', ' ').substring(0, 19)} UTC</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-slate-600">
                        <div>{scene.satellite}</div>
                        <div className="text-[10px] text-slate-400">{scene.polarization} | {scene.acquisitionMode}</div>
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <button
                          onClick={() => handleLoadSceneIntoPipeline(scene)}
                          disabled={actionLoadingScene === scene.normalizedFileName}
                          className="px-2.5 py-1 rounded bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white border border-blue-200 text-[11px] font-bold inline-flex items-center space-x-1 transition disabled:opacity-50"
                        >
                          {actionLoadingScene === scene.normalizedFileName ? (
                            <RefreshCw className="w-3 h-3 animate-spin" />
                          ) : (
                            <Play className="w-3 h-3 fill-current" />
                          )}
                          <span>Analyze Scene</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          {totalScenes > 15 && (
            <div className="p-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs font-mono text-slate-600">
              <div>
                Showing {(page - 1) * 15 + 1} - {Math.min(page * 15, totalScenes)} of {totalScenes} scenes
              </div>
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => loadScenes(Math.max(1, page - 1), filterType, searchQuery)}
                  disabled={page <= 1 || isCatalogLoading}
                  className="px-2.5 py-1 bg-white border border-slate-200 rounded hover:bg-slate-100 disabled:opacity-50 font-bold"
                >
                  Previous
                </button>
                <span className="px-2 py-1 font-bold text-slate-800">Page {page}</span>
                <button
                  onClick={() => loadScenes(page + 1, filterType, searchQuery)}
                  disabled={page * 15 >= totalScenes || isCatalogLoading}
                  className="px-2.5 py-1 bg-white border border-slate-200 rounded hover:bg-slate-100 disabled:opacity-50 font-bold"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
