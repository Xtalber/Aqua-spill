/**
 * Aqua Spill - Dataset Manager & Indexing Store
 * - Stores imported comprehensive datasets, sidecars, satellite scenes, and AIS catalogs
 * - Provides search and cross-file correlation
 * - Automatic matching between uploaded SAR images and dataset metadata records
 */

import { AISVessel, GeoCoordinate } from '../types';
import { SarMetadata } from './sarImageProcessor';
import { ComprehensiveDataset, IndexedDatasetFile } from './datasetZipProcessor';

export interface DatasetEntry {
  id: string;
  name: string;
  type: 'SAR_METADATA' | 'AIS_TELEMETRY' | 'SATELLITE_SCENE' | 'COMPLETE_PACKAGE';
  fileName: string;
  recordCount: number;
  importedAt: string;
  metadata?: Partial<SarMetadata>;
  vessels?: AISVessel[];
  rawText?: string;
  comprehensiveDataset?: ComprehensiveDataset;
}

export interface ImageDatasetMatchResult {
  matchedEntry: DatasetEntry | null;
  matchedFile: IndexedDatasetFile | null;
  metadata: Partial<SarMetadata> | null;
  matchReason: string | null;
  groundTruthLabel?: 'OIL_SLICK' | 'LOOKALIKE' | 'NON_OIL' | 'UNKNOWN';
}

class DatasetManager {
  private datasets: DatasetEntry[] = [];
  private activeDatasetId: string | null = null;
  private activeDatasetName: string | null = null;
  private activeAisVessels: AISVessel[] = [];
  private activeComprehensiveDataset: ComprehensiveDataset | null = null;

  constructor() {
    this.initDefaultDemoDataset();
  }

  private initDefaultDemoDataset() {
    // Initial Standard Sample Dataset reference
    const sampleEntry: DatasetEntry = {
      id: 'DS-DEMO-001',
      name: 'Malacca Strait Tanker Corridor Dataset (Sample)',
      type: 'COMPLETE_PACKAGE',
      fileName: 'malacca_strait_s1a_ais.zip',
      recordCount: 1420,
      importedAt: new Date().toISOString(),
      metadata: {
        satellite: 'Sentinel-1A SAR',
        sensor: 'C-Band Radar',
        polarization: 'VV',
        centroid: { lat: 2.450, lng: 101.880 },
        boundingBox: { minLat: 2.200, maxLat: 2.700, minLng: 101.630, maxLng: 102.130 },
        acquisitionDate: '2026-08-26',
        acquisitionTime: '2026-08-26T06:19:23.000Z',
        resolutionMeters: 10.0,
      },
    };
    this.datasets.push(sampleEntry);
    this.activeDatasetId = sampleEntry.id;
    this.activeDatasetName = sampleEntry.name;
  }

  public getAllDatasets(): DatasetEntry[] {
    return this.datasets;
  }

  public getActiveDatasetId(): string | null {
    return this.activeDatasetId;
  }

  public getActiveDatasetName(): string | null {
    return this.activeDatasetName;
  }

  public setActiveDataset(id: string) {
    const found = this.datasets.find((d) => d.id === id);
    if (found) {
      this.activeDatasetId = found.id;
      this.activeDatasetName = found.name;
      if (found.vessels) {
        this.activeAisVessels = found.vessels;
      }
      if (found.comprehensiveDataset) {
        this.activeComprehensiveDataset = found.comprehensiveDataset;
      }
    }
  }

  public getActiveComprehensiveDataset(): ComprehensiveDataset | null {
    return this.activeComprehensiveDataset;
  }

  public getActiveAisVessels(): AISVessel[] {
    return this.activeAisVessels;
  }

  public setActiveAisVessels(vessels: AISVessel[]) {
    this.activeAisVessels = vessels;
  }

  public addComprehensiveDataset(dataset: ComprehensiveDataset, replaceActive = false) {
    const entry: DatasetEntry = {
      id: dataset.id,
      name: dataset.name,
      type: 'COMPLETE_PACKAGE',
      fileName: dataset.name,
      recordCount: dataset.totalFiles,
      importedAt: dataset.importedAt,
      vessels: dataset.vessels,
      comprehensiveDataset: dataset,
    };

    if (replaceActive) {
      this.datasets = [entry, ...this.datasets.filter((d) => d.id !== dataset.id)];
    } else {
      this.datasets.unshift(entry);
    }

    this.activeDatasetId = entry.id;
    this.activeDatasetName = entry.name;
    this.activeComprehensiveDataset = dataset;
    if (dataset.vessels.length > 0) {
      this.activeAisVessels = dataset.vessels;
    }
  }

  public addDataset(entry: DatasetEntry) {
    this.datasets.unshift(entry);
    this.activeDatasetId = entry.id;
    this.activeDatasetName = entry.name;
    if (entry.vessels && entry.vessels.length > 0) {
      this.activeAisVessels = entry.vessels;
    }
  }

  /**
   * Search imported datasets for metadata matching an uploaded SAR image
   * Matches by:
   * 1. Exact filename in indexed archive
   * 2. Filename without extension
   * 3. Scene ID / Product ID
   * 4. Annotation labels
   */
  public findMatchingMetadata(imageFileName: string): ImageDatasetMatchResult {
    const cleanImgName = imageFileName.replace(/\.[^/.]+$/, '').toLowerCase();
    const rawImgName = imageFileName.toLowerCase();

    // 1. Search in active comprehensive dataset first
    if (this.activeComprehensiveDataset) {
      const cd = this.activeComprehensiveDataset;

      // Exact match among image files
      const matchedImg = cd.imageFiles.find(
        (f) => f.fileName.toLowerCase() === rawImgName || f.fileName.replace(/\.[^/.]+$/, '').toLowerCase() === cleanImgName
      );

      if (matchedImg) {
        const meta: Partial<SarMetadata> = {
          satellite: matchedImg.satellite,
          sensor: matchedImg.sensor,
          sceneId: matchedImg.sceneId,
          productId: matchedImg.productId,
          acquisitionTime: matchedImg.timestamp || undefined,
          centroid: matchedImg.centroid || undefined,
          boundingBox: matchedImg.boundingBox || undefined,
          hasGeoreferencing: matchedImg.hasGeoreferencing,
          matchedDatasetName: cd.name,
          matchedSidecarFile: matchedImg.linkedMetadataPath,
        };

        return {
          matchedEntry: this.datasets.find((d) => d.id === cd.id) || null,
          matchedFile: matchedImg,
          metadata: meta,
          matchReason: `Matched in active dataset archive (${matchedImg.path})`,
          groundTruthLabel: matchedImg.groundTruthLabel,
        };
      }

      // Match among metadata sidecars
      const matchedMetaFile = cd.metadataFiles.find((f) => {
        const metaBase = f.fileName.replace(/\.[^/.]+$/, '').toLowerCase();
        return metaBase === cleanImgName || cleanImgName.includes(metaBase) || metaBase.includes(cleanImgName);
      });

      if (matchedMetaFile) {
        const meta: Partial<SarMetadata> = {
          satellite: matchedMetaFile.satellite,
          sensor: matchedMetaFile.sensor,
          sceneId: matchedMetaFile.sceneId,
          productId: matchedMetaFile.productId,
          acquisitionTime: matchedMetaFile.timestamp || undefined,
          centroid: matchedMetaFile.centroid || undefined,
          boundingBox: matchedMetaFile.boundingBox || undefined,
          hasGeoreferencing: matchedMetaFile.hasGeoreferencing,
          matchedDatasetName: cd.name,
          matchedSidecarFile: matchedMetaFile.path,
        };

        return {
          matchedEntry: this.datasets.find((d) => d.id === cd.id) || null,
          matchedFile: matchedMetaFile,
          metadata: meta,
          matchReason: `Matched sidecar metadata manifest (${matchedMetaFile.path})`,
        };
      }
    }

    // 2. Search other legacy dataset entries
    for (const ds of this.datasets) {
      const dsClean = ds.fileName.replace(/\.[^/.]+$/, '').toLowerCase();
      const dsNameClean = ds.name.toLowerCase();

      // Exact base name match
      if (dsClean === cleanImgName || dsNameClean.includes(cleanImgName)) {
        return {
          matchedEntry: ds,
          matchedFile: null,
          metadata: ds.metadata || null,
          matchReason: `Filename correlation (${ds.fileName})`,
        };
      }

      // Metadata product/scene ID match
      if (ds.metadata?.productId && cleanImgName.includes(ds.metadata.productId.toLowerCase())) {
        return {
          matchedEntry: ds,
          matchedFile: null,
          metadata: ds.metadata,
          matchReason: `Matched Product ID (${ds.metadata.productId})`,
        };
      }

      if (ds.metadata?.sceneId && cleanImgName.includes(ds.metadata.sceneId.toLowerCase())) {
        return {
          matchedEntry: ds,
          matchedFile: null,
          metadata: ds.metadata,
          matchReason: `Matched Scene ID (${ds.metadata.sceneId})`,
        };
      }
    }

    return {
      matchedEntry: null,
      matchedFile: null,
      metadata: null,
      matchReason: null,
    };
  }

  /**
   * Alias method to match an uploaded image against active or specified dataset
   */
  public matchUploadedImage(imageFileName: string, dataset?: ComprehensiveDataset): ImageDatasetMatchResult {
    if (dataset && dataset !== this.activeComprehensiveDataset) {
      // Temporarily or specifically search inside dataset
      const cleanImgName = imageFileName.replace(/\.[^/.]+$/, '').toLowerCase();
      const rawImgName = imageFileName.toLowerCase();

      const matchedImg = dataset.imageFiles.find(
        (f) => f.fileName.toLowerCase() === rawImgName || f.fileName.replace(/\.[^/.]+$/, '').toLowerCase() === cleanImgName
      );

      if (matchedImg) {
        const meta: Partial<SarMetadata> = {
          satellite: matchedImg.satellite,
          sensor: matchedImg.sensor,
          sceneId: matchedImg.sceneId,
          productId: matchedImg.productId,
          acquisitionTime: matchedImg.timestamp || undefined,
          centroid: matchedImg.centroid || undefined,
          boundingBox: matchedImg.boundingBox || undefined,
          hasGeoreferencing: matchedImg.hasGeoreferencing,
          matchedDatasetName: dataset.name,
          matchedSidecarFile: matchedImg.linkedMetadataPath,
        };

        return {
          matchedEntry: this.datasets.find((d) => d.id === dataset.id) || null,
          matchedFile: matchedImg,
          metadata: meta,
          matchReason: `Matched in dataset archive (${matchedImg.path})`,
          groundTruthLabel: matchedImg.groundTruthLabel,
        };
      }
    }
    return this.findMatchingMetadata(imageFileName);
  }

  /**
   * Search across all indexed files in the active dataset
   */
  public searchFiles(query: string): IndexedDatasetFile[] {
    if (!this.activeComprehensiveDataset) return [];
    if (!query.trim()) return this.activeComprehensiveDataset.files;

    const q = query.toLowerCase().trim();
    return this.activeComprehensiveDataset.files.filter(
      (f) =>
        f.fileName.toLowerCase().includes(q) ||
        f.path.toLowerCase().includes(q) ||
        f.category.toLowerCase().includes(q) ||
        (f.satellite && f.satellite.toLowerCase().includes(q)) ||
        (f.sceneId && f.sceneId.toLowerCase().includes(q)) ||
        (f.groundTruthLabel && f.groundTruthLabel.toLowerCase().includes(q))
    );
  }
}

export const datasetManager = new DatasetManager();
