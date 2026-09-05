/**
 * Client-side Real SAR Image Processing & GeoTIFF Extraction Engine
 * - GeoTIFF / TIFF / PNG / JPEG raster reading
 * - Metadata & geospatial extraction (CRS, model tiepoints, pixel scale, dimensions)
 * - Sidecar metadata matching (.json, .xml, .txt)
 * - Real pixel intensity conversion, normalization, noise reduction, and thresholding
 * - Connected components, contour extraction, and morphometry calculations
 */

import { fromArrayBuffer, GeoTIFF } from 'geotiff';
import { GeoCoordinate, GeoPolygon, OilSpillDetection, SatelliteObservation, SlickMorphometry } from '../types';

export interface SarMetadata {
  fileName: string;
  fileSize: number;
  format: string;
  imageDimensions: { width: number; height: number };
  satellite: string;
  sensor: string;
  mission: string;
  polarization: 'VV' | 'VH' | 'HH' | 'HV' | 'Optical RGB';
  orbitDirection: 'ASCENDING' | 'DESCENDING';
  acquisitionDate: string | null;
  acquisitionTime: string | null;
  productId: string | null;
  sceneId: string | null;
  resolutionMeters: number | null;
  pixelSize: { x: number; y: number } | null;
  crs: string | null;
  projection: string | null;
  acquisitionMode: string;
  boundingBox: { minLat: number; maxLat: number; minLng: number; maxLng: number } | null;
  centroid: GeoCoordinate | null;
  hasGeoreferencing: boolean;
  matchedSidecarFile?: string;
  matchedDatasetName?: string;
}

export interface SarAnalysisProgress {
  stage: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'FAILED' | 'SKIPPED';
  detail?: string;
  percent?: number;
}

export interface LocalSlickCandidate {
  id: string;
  pixelArea: number;
  geographicAreaKm2: number | null;
  perimeterPx: number;
  perimeterKm: number | null;
  lengthPx: number;
  widthPx: number;
  orientationDeg: number;
  compactness: number;
  aspectRatio: number;
  centroidPx: { x: number; y: number };
  centroidGeo: GeoCoordinate | null;
  polygonPx: [number, number][];
  polygonGeo: [number, number][] | null; // [lng, lat]
  dampingDb: number;
  confidenceScore: number;
  confidenceLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  lookalikeRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  lookalikeReasons: string[];
}

export interface SarAnalysisResult {
  metadata: SarMetadata;
  rasterWidth: number;
  rasterHeight: number;
  originalImageUrl: string;
  intensityImageUrl: string;
  enhancedImageUrl: string;
  overlayImageUrl: string;
  maskImageUrl: string;
  candidates: LocalSlickCandidate[];
  detectedSlick: LocalSlickCandidate | null;
  overallDetectionStatus: 'SLICK_DETECTED' | 'NO_HIGH_CONFIDENCE_SLICK' | 'LOW_CONTRAST_ANOMALY';
  backgroundMeanIntensity: number;
  backgroundStdDev: number;
  processingTimeMs: number;
}

/**
 * Parses filename to extract potential Sentinel/SAR metadata tags if standard filename convention is used
 */
export function extractMetadataFromFilename(fileName: string): Partial<SarMetadata> {
  const meta: Partial<SarMetadata> = {
    fileName,
  };

  const upper = fileName.toUpperCase();

  // Sentinel-1 convention: S1A_IW_GRDH_1SDV_20260826T061923_...
  if (upper.startsWith('S1A') || upper.startsWith('S1B') || upper.includes('SENTINEL-1')) {
    meta.satellite = upper.startsWith('S1B') ? 'Sentinel-1B SAR' : 'Sentinel-1A SAR';
    meta.sensor = 'C-Band Synthetic Aperture Radar (SAR)';
    meta.mission = 'Copernicus Sentinel-1';
    meta.acquisitionMode = upper.includes('IW') ? 'Interferometric Wide (IW)' : upper.includes('EW') ? 'Extra-Wide (EW)' : 'Stripmap (SM)';
    meta.polarization = upper.includes('DV') || upper.includes('VV') ? 'VV' : upper.includes('DH') || upper.includes('HH') ? 'HH' : 'VV';
    meta.resolutionMeters = 10.0;
  } else if (upper.startsWith('S2A') || upper.startsWith('S2B') || upper.includes('SENTINEL-2')) {
    meta.satellite = upper.startsWith('S2B') ? 'Sentinel-2B Optical' : 'Sentinel-2A Optical';
    meta.sensor = 'Multi-Spectral Instrument (MSI)';
    meta.mission = 'Copernicus Sentinel-2';
    meta.polarization = 'Optical RGB';
    meta.resolutionMeters = 10.0;
  } else if (upper.includes('RADARSAT') || upper.includes('RS2')) {
    meta.satellite = 'RADARSAT-2';
    meta.sensor = 'C-Band Radar';
    meta.mission = 'RADARSAT-2';
    meta.polarization = 'VV';
    meta.resolutionMeters = 8.0;
  } else if (upper.includes('TSX') || upper.includes('TERRASAR')) {
    meta.satellite = 'TerraSAR-X';
    meta.sensor = 'X-Band Radar';
    meta.mission = 'TerraSAR-X';
    meta.polarization = 'VV';
    meta.resolutionMeters = 3.0;
  } else {
    meta.satellite = 'User Uploaded SAR Product';
    meta.sensor = 'Synthetic Aperture Radar (SAR)';
    meta.mission = 'Maritime Remote Sensing';
    meta.polarization = 'VV';
    meta.acquisitionMode = 'Standard Wide Swath';
  }

  // Attempt timestamp extraction: e.g. 20260826_061923 or 20260826T061923
  const dateMatch = fileName.match(/(\d{4})(\d{2})(\d{2})[T_](\d{2})(\d{2})(\d{2})/);
  if (dateMatch) {
    const [, yr, mo, dy, hr, min, sec] = dateMatch;
    const isoString = `${yr}-${mo}-${dy}T${hr}:${min}:${sec}.000Z`;
    meta.acquisitionDate = `${yr}-${mo}-${dy}`;
    meta.acquisitionTime = isoString;
  }

  const baseName = fileName.replace(/\.[^/.]+$/, '');
  meta.productId = baseName;
  meta.sceneId = baseName;

  return meta;
}

/**
 * Parse sidecar JSON or XML metadata text
 */
export function parseSidecarMetadata(content: string, fileName: string): Partial<SarMetadata> {
  const meta: Partial<SarMetadata> = {};
  
  try {
    if (fileName.endsWith('.json') || content.trim().startsWith('{')) {
      const data = JSON.parse(content);
      if (data.satellite) meta.satellite = data.satellite;
      if (data.sensor) meta.sensor = data.sensor;
      if (data.mission) meta.mission = data.mission;
      if (data.polarization) meta.polarization = data.polarization;
      if (data.acquisitionTime || data.timestamp || data.dateTime) {
        meta.acquisitionTime = data.acquisitionTime || data.timestamp || data.dateTime;
        meta.acquisitionDate = meta.acquisitionTime?.split('T')[0] || null;
      }
      if (data.productId) meta.productId = data.productId;
      if (data.sceneId) meta.sceneId = data.sceneId;
      if (data.resolutionMeters || data.resolution) meta.resolutionMeters = Number(data.resolutionMeters || data.resolution);
      if (data.crs || data.projection) meta.crs = data.crs || data.projection;
      if (data.orbitDirection) meta.orbitDirection = data.orbitDirection;

      if (data.centroid && typeof data.centroid.lat === 'number' && typeof data.centroid.lng === 'number') {
        meta.centroid = { lat: data.centroid.lat, lng: data.centroid.lng };
      } else if (typeof data.latitude === 'number' && typeof data.longitude === 'number') {
        meta.centroid = { lat: data.latitude, lng: data.longitude };
      } else if (typeof data.lat === 'number' && typeof data.lng === 'number') {
        meta.centroid = { lat: data.lat, lng: data.lng };
      }

      if (data.boundingBox) {
        meta.boundingBox = data.boundingBox;
      } else if (data.bbox && Array.isArray(data.bbox) && data.bbox.length === 4) {
        meta.boundingBox = {
          minLng: data.bbox[0],
          minLat: data.bbox[1],
          maxLng: data.bbox[2],
          maxLat: data.bbox[3],
        };
      }

      if (meta.centroid && !meta.boundingBox) {
        const offset = 0.25;
        meta.boundingBox = {
          minLat: meta.centroid.lat - offset,
          maxLat: meta.centroid.lat + offset,
          minLng: meta.centroid.lng - offset,
          maxLng: meta.centroid.lng + offset,
        };
      }
      if (!meta.centroid && meta.boundingBox) {
        meta.centroid = {
          lat: (meta.boundingBox.minLat + meta.boundingBox.maxLat) / 2,
          lng: (meta.boundingBox.minLng + meta.boundingBox.maxLng) / 2,
        };
      }

      meta.hasGeoreferencing = !!(meta.centroid && meta.boundingBox);
      meta.matchedSidecarFile = fileName;
    } else if (fileName.endsWith('.xml') || content.includes('<')) {
      // Basic XML tag extraction for standard Sentinel/SAFE manifests
      const extractTag = (tag: string) => {
        const match = content.match(new RegExp(`<${tag}[^>]*>([^<]+)</${tag}>`, 'i'));
        return match ? match[1].trim() : null;
      };

      const sat = extractTag('satellite') || extractTag('platform') || extractTag('familyName');
      if (sat) meta.satellite = sat.includes('1') ? 'Sentinel-1A SAR' : sat;
      const pol = extractTag('polarization') || extractTag('transmitterReceiverPolarisation');
      if (pol) meta.polarization = pol.toUpperCase().includes('HH') ? 'HH' : 'VV';
      const acqTime = extractTag('startTime') || extractTag('acquisitionTime') || extractTag('sensingStartTime');
      if (acqTime) {
        meta.acquisitionTime = acqTime;
        meta.acquisitionDate = acqTime.split('T')[0];
      }
      const orbitDir = extractTag('pass') || extractTag('orbitDirection');
      if (orbitDir) meta.orbitDirection = orbitDir.toUpperCase().includes('ASC') ? 'ASCENDING' : 'DESCENDING';

      // Look for coordinates in XML
      const latMatch = content.match(/<latitude[^>]*>([-\d.]+)<\/latitude>/i) || content.match(/<lat[^>]*>([-\d.]+)<\/lat>/i);
      const lngMatch = content.match(/<longitude[^>]*>([-\d.]+)<\/longitude>/i) || content.match(/<lon[^>]*>([-\d.]+)<\/lon>/i);
      if (latMatch && lngMatch) {
        const lat = parseFloat(latMatch[1]);
        const lng = parseFloat(lngMatch[1]);
        if (!isNaN(lat) && !isNaN(lng)) {
          meta.centroid = { lat, lng };
          meta.boundingBox = {
            minLat: lat - 0.25,
            maxLat: lat + 0.25,
            minLng: lng - 0.25,
            maxLng: lng + 0.25,
          };
          meta.hasGeoreferencing = true;
        }
      }
      meta.matchedSidecarFile = fileName;
    }
  } catch (err) {
    console.warn('Failed to parse sidecar metadata file:', err);
  }

  return meta;
}

export interface SarDetectionOptions {
  thresholdSensitivity?: number; // multiplier k, default 1.15 (range 0.5 to 2.5)
  windowRadius?: number; // local window radius in px, default 24 (range 8 to 60)
  minAreaPixels?: number; // min blob area in px, default auto
  maxAreaPercent?: number; // max blob area as % of image, default 0.65
  morphologicalRadius?: number; // radius for closing, default 2
}

/**
 * Reads GeoTIFF metadata & raster using geotiff.js
 */
export async function readGeoTiffFile(arrayBuffer: ArrayBuffer, fileName: string): Promise<{
  rasterWidth: number;
  rasterHeight: number;
  canvas: HTMLCanvasElement;
  metadata: Partial<SarMetadata>;
}> {
  const tiff = await fromArrayBuffer(arrayBuffer);
  const image = await tiff.getImage();
  const width = image.getWidth();
  const height = image.getHeight();

  const fileMeta: Partial<SarMetadata> = {
    format: 'GeoTIFF (TIFF / Raster)',
    imageDimensions: { width, height },
    crs: 'WGS 84 (EPSG:4326) / UTM',
    projection: 'Geographic / Transverse Mercator',
    resolutionMeters: 10.0,
    hasGeoreferencing: false,
  };

  // Extract Tiepoints and Bounding Box if available
  try {
    const origin = image.getOrigin();
    const resolution = image.getResolution();
    const bbox = image.getBoundingBox();

    if (bbox && bbox.length === 4 && !bbox.some(isNaN)) {
      let [minX, minY, maxX, maxY] = bbox;
      if (Math.abs(minX) > 180 || Math.abs(minY) > 90) {
        fileMeta.crs = 'Projected CRS (Meters)';
        fileMeta.projection = 'UTM Zone';
      } else {
        fileMeta.boundingBox = {
          minLng: minX,
          minLat: minY,
          maxLng: maxX,
          maxLat: maxY,
        };
        fileMeta.centroid = {
          lat: (minY + maxY) / 2,
          lng: (minX + maxX) / 2,
        };
        fileMeta.hasGeoreferencing = true;
      }
    }

    if (resolution && resolution.length >= 2) {
      fileMeta.pixelSize = {
        x: Math.abs(resolution[0]),
        y: Math.abs(resolution[1]),
      };
    }
  } catch {
    // Standard TIFF without geokeys
  }

  // Render TIFF data to a standard Canvas
  const rawRgb = await image.readRGB();
  const rgbData = Array.isArray(rawRgb) ? rawRgb[0] : rawRgb;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  const imgData = ctx.createImageData(width, height);
  const data = imgData.data;

  // Transfer RGB
  const numPixels = width * height;
  for (let i = 0; i < numPixels; i++) {
    const r = Number(rgbData[i * 3] || 0);
    const g = Number(rgbData[i * 3 + 1] || 0);
    const b = Number(rgbData[i * 3 + 2] || 0);
    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = 255;
  }
  ctx.putImageData(imgData, 0, 0);

  return {
    rasterWidth: width,
    rasterHeight: height,
    canvas,
    metadata: fileMeta,
  };
}

/**
 * Loads standard PNG/JPG into canvas
 */
export async function readStandardImage(file: File): Promise<{
  rasterWidth: number;
  rasterHeight: number;
  canvas: HTMLCanvasElement;
  dataUrl: string;
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context not available'));
          return;
        }
        ctx.drawImage(img, 0, 0);
        resolve({
          rasterWidth: img.width,
          rasterHeight: img.height,
          canvas,
          dataUrl,
        });
      };
      img.onerror = () => reject(new Error('Image decode error'));
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Universal SAR Image & GeoTIFF Loader with sidecar & filename metadata extraction
 */
export async function parseSarImageFile(file: File): Promise<{
  rasterWidth: number;
  rasterHeight: number;
  canvas: HTMLCanvasElement;
  metadata: SarMetadata;
}> {
  const isTiff = file.name.toLowerCase().endsWith('.tif') || file.name.toLowerCase().endsWith('.tiff');
  const buffer = await file.arrayBuffer();
  let result: {
    rasterWidth: number;
    rasterHeight: number;
    canvas: HTMLCanvasElement;
    metadata?: Partial<SarMetadata>;
  };

  if (isTiff) {
    result = await readGeoTiffFile(buffer, file.name);
  } else {
    const std = await readStandardImage(file);
    result = {
      rasterWidth: std.rasterWidth,
      rasterHeight: std.rasterHeight,
      canvas: std.canvas,
      metadata: {
        format: 'Standard Raster (PNG/JPEG)',
        imageDimensions: { width: std.rasterWidth, height: std.rasterHeight },
      },
    };
  }

  const filenameMeta = extractMetadataFromFilename(file.name);
  const fullMeta: SarMetadata = {
    fileName: file.name,
    fileSize: file.size,
    format: result.metadata?.format || (isTiff ? 'GeoTIFF' : 'Standard Image (PNG/JPEG)'),
    imageDimensions: { width: result.rasterWidth, height: result.rasterHeight },
    satellite: filenameMeta.satellite || result.metadata?.satellite || 'Sentinel-1A SAR',
    sensor: filenameMeta.sensor || result.metadata?.sensor || 'C-Band SAR',
    mission: filenameMeta.mission || result.metadata?.mission || 'Copernicus Sentinel',
    polarization: (filenameMeta.polarization || result.metadata?.polarization || 'VV') as any,
    orbitDirection: (filenameMeta.orbitDirection || result.metadata?.orbitDirection || 'DESCENDING') as any,
    acquisitionDate: filenameMeta.acquisitionDate || result.metadata?.acquisitionDate || new Date().toISOString().split('T')[0],
    acquisitionTime: filenameMeta.acquisitionTime || result.metadata?.acquisitionTime || new Date().toISOString(),
    productId: filenameMeta.productId || result.metadata?.productId || null,
    sceneId: filenameMeta.sceneId || result.metadata?.sceneId || null,
    resolutionMeters: result.metadata?.resolutionMeters || 10.0,
    pixelSize: result.metadata?.pixelSize || null,
    crs: result.metadata?.crs || null,
    projection: result.metadata?.projection || null,
    acquisitionMode: filenameMeta.acquisitionMode || 'IW (Interferometric Wide)',
    boundingBox: result.metadata?.boundingBox || null,
    centroid: result.metadata?.centroid || null,
    hasGeoreferencing: result.metadata?.hasGeoreferencing || false,
  };

  return {
    rasterWidth: result.rasterWidth,
    rasterHeight: result.rasterHeight,
    canvas: result.canvas,
    metadata: fullMeta,
  };
}

/**
 * Full Multi-Scale Adaptive Local CFAR SAR Oil Slick Detection Pipeline
 * 1. Grayscale & Backscatter Intensity Grid
 * 2. 2D Integral Image (Sum & Squared Sum) for fast local statistics
 * 3. Multi-scale Adaptive Dark-Patch Thresholding
 * 4. Morphological Closing & Filtering (connect fragmented patches, eliminate noise)
 * 5. Connected Components Labeling (Union-Find)
 * 6. Central Moments & Morphometric Extraction (Area, Perimeter, Orientation, Aspect Ratio, Damping dB)
 * 7. Candidate Classification & Confidence Ranking
 * 8. Real Semi-Transparent Filled Mask & Boundary Vector Contour Generation
 */
export function executeSarDetectionPipeline(
  sourceCanvas: HTMLCanvasElement,
  metadata: SarMetadata,
  options?: SarDetectionOptions,
  onProgress?: (progress: SarAnalysisProgress) => void
): SarAnalysisResult {
  const startTime = performance.now();
  const width = sourceCanvas.width;
  const height = sourceCanvas.height;
  const totalPixels = width * height;

  const sensitivity = options?.thresholdSensitivity ?? 1.15;
  const winR = Math.max(6, Math.min(60, options?.windowRadius ?? 24));
  const morphR = Math.max(1, Math.min(4, options?.morphologicalRadius ?? 2));

  onProgress?.({
    stage: 'Raster Ingestion',
    status: 'IN_PROGRESS',
    detail: `Processing ${width} × ${height} pixels (${totalPixels.toLocaleString()} px)`,
    percent: 10,
  });

  const ctx = sourceCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Unable to get canvas context');

  const srcImageData = ctx.getImageData(0, 0, width, height);
  const srcData = srcImageData.data;

  // 1. Intensity array conversion (Grayscale 0 - 255)
  const intensities = new Float32Array(totalPixels);
  let totalIntensity = 0;
  for (let i = 0; i < totalPixels; i++) {
    const r = srcData[i * 4];
    const g = srcData[i * 4 + 1];
    const b = srcData[i * 4 + 2];
    const val = 0.299 * r + 0.587 * g + 0.114 * b;
    intensities[i] = val;
    totalIntensity += val;
  }

  const globalMean = totalIntensity / totalPixels;
  let varSum = 0;
  for (let i = 0; i < totalPixels; i++) {
    const diff = intensities[i] - globalMean;
    varSum += diff * diff;
  }
  const globalStdDev = Math.sqrt(varSum / totalPixels);

  onProgress?.({
    stage: 'Integral Image & Local CFAR Statistics',
    status: 'IN_PROGRESS',
    detail: `Computing local mean & variance grids (window = ±${winR}px)`,
    percent: 30,
  });

  // 2. Build 2D Integral Images (Sum & Sum of Squares)
  // Integral image size (width + 1) * (height + 1) for safe 1-based indexing
  const stride = width + 1;
  const intSum = new Float64Array((width + 1) * (height + 1));
  const intSqSum = new Float64Array((width + 1) * (height + 1));

  for (let y = 0; y < height; y++) {
    let rowSum = 0;
    let rowSqSum = 0;
    const yOffset = (y + 1) * stride;
    const prevYOffset = y * stride;
    const srcYOffset = y * width;

    for (let x = 0; x < width; x++) {
      const v = intensities[srcYOffset + x];
      rowSum += v;
      rowSqSum += v * v;
      intSum[yOffset + (x + 1)] = intSum[prevYOffset + (x + 1)] + rowSum;
      intSqSum[yOffset + (x + 1)] = intSqSum[prevYOffset + (x + 1)] + rowSqSum;
    }
  }

  // 3. Multi-scale Adaptive Dark-Patch Thresholding
  onProgress?.({
    stage: 'Adaptive Dark-Patch CFAR Detection',
    status: 'IN_PROGRESS',
    detail: `Multi-scale damping thresholding (k = ${sensitivity.toFixed(2)})`,
    percent: 50,
  });

  const rawMask = new Uint8Array(totalPixels);
  const globalDarkThreshold = Math.max(8, globalMean - (sensitivity * 0.85) * globalStdDev);

  for (let y = 0; y < height; y++) {
    const y1 = Math.max(0, y - winR);
    const y2 = Math.min(height - 1, y + winR);
    const yIdx = y * width;

    for (let x = 0; x < width; x++) {
      const x1 = Math.max(0, x - winR);
      const x2 = Math.min(width - 1, x + winR);
      const nPixels = (x2 - x1 + 1) * (y2 - y1 + 1);

      // 2D integral box query
      const sum =
        intSum[(y2 + 1) * stride + (x2 + 1)] -
        intSum[y1 * stride + (x2 + 1)] -
        intSum[(y2 + 1) * stride + x1] +
        intSum[y1 * stride + x1];

      const sqSum =
        intSqSum[(y2 + 1) * stride + (x2 + 1)] -
        intSqSum[y1 * stride + (x2 + 1)] -
        intSqSum[(y2 + 1) * stride + x1] +
        intSqSum[y1 * stride + x1];

      const localMean = sum / nPixels;
      const localVariance = Math.max(0, (sqSum - (sum * sum) / nPixels) / nPixels);
      const localStdDev = Math.sqrt(localVariance);

      const localThreshold = Math.max(6, localMean - sensitivity * localStdDev);
      const val = intensities[yIdx + x];

      // Mark pixel as dark candidate if it falls below local CFAR threshold or strong global threshold
      if (val < localThreshold || (val < globalDarkThreshold && val < localMean - 0.5 * localStdDev)) {
        rawMask[yIdx + x] = 1;
      }
    }
  }

  // 4. Morphological Closing (Dilation followed by Erosion) to unify dark slick body
  onProgress?.({
    stage: 'Morphological Regularization',
    status: 'IN_PROGRESS',
    detail: `Closing gaps & bridging slick segments (radius = ${morphR}px)`,
    percent: 65,
  });

  const dilatedMask = new Uint8Array(totalPixels);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (rawMask[y * width + x] === 1) {
        for (let dy = -morphR; dy <= morphR; dy++) {
          const ny = y + dy;
          if (ny < 0 || ny >= height) continue;
          for (let dx = -morphR; dx <= morphR; dx++) {
            const nx = x + dx;
            if (nx < 0 || nx >= width) continue;
            if (dx * dx + dy * dy <= morphR * morphR) {
              dilatedMask[ny * width + nx] = 1;
            }
          }
        }
      }
    }
  }

  const binaryMask = new Uint8Array(totalPixels);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (dilatedMask[y * width + x] === 1) {
        let keep = true;
        for (let dy = -morphR; dy <= morphR; dy++) {
          const ny = y + dy;
          if (ny < 0 || ny >= height) {
            keep = false;
            break;
          }
          for (let dx = -morphR; dx <= morphR; dx++) {
            const nx = x + dx;
            if (nx < 0 || nx >= width) {
              keep = false;
              break;
            }
            if (dx * dx + dy * dy <= morphR * morphR && dilatedMask[ny * width + nx] === 0) {
              keep = false;
              break;
            }
          }
          if (!keep) break;
        }
        if (keep) binaryMask[y * width + x] = 1;
      }
    }
  }

  // 5. Connected Components Labeling (Two-Pass with Disjoint-Set Union)
  onProgress?.({
    stage: 'Connected Components & Shape Geometry',
    status: 'IN_PROGRESS',
    detail: 'Extracting candidate component geometries & moments',
    percent: 80,
  });

  const labels = new Int32Array(totalPixels);
  let currentLabel = 1;
  const parent: number[] = [0];

  function find(i: number): number {
    let root = i;
    while (parent[root] !== root) root = parent[root];
    let curr = i;
    while (curr !== root) {
      const nxt = parent[curr];
      parent[curr] = root;
      curr = nxt;
    }
    return root;
  }

  function union(i: number, j: number) {
    const rootI = find(i);
    const rootJ = find(j);
    if (rootI !== rootJ) parent[rootI] = rootJ;
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (binaryMask[idx] === 0) continue;

      const neighbors: number[] = [];
      if (x > 0 && binaryMask[idx - 1] === 1) neighbors.push(labels[idx - 1]);
      if (y > 0 && binaryMask[idx - width] === 1) neighbors.push(labels[idx - width]);

      if (neighbors.length === 0) {
        labels[idx] = currentLabel;
        parent[currentLabel] = currentLabel;
        currentLabel++;
      } else {
        const minL = Math.min(...neighbors);
        labels[idx] = minL;
        for (const n of neighbors) union(n, minL);
      }
    }
  }

  // Aggregate blobs
  const blobMap = new Map<number, {
    pixels: [number, number][];
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    intensitySum: number;
  }>();

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (binaryMask[idx] === 0) continue;
      const root = find(labels[idx]);
      labels[idx] = root;

      if (!blobMap.has(root)) {
        blobMap.set(root, {
          pixels: [],
          minX: x,
          maxX: x,
          minY: y,
          maxY: y,
          intensitySum: 0,
        });
      }

      const b = blobMap.get(root)!;
      b.pixels.push([x, y]);
      b.intensitySum += intensities[idx];
      if (x < b.minX) b.minX = x;
      if (x > b.maxX) b.maxX = x;
      if (y < b.minY) b.minY = y;
      if (y > b.maxY) b.maxY = y;
    }
  }

  // 6. Morphometric Feature Extraction & Moments
  const minPixelThreshold = options?.minAreaPixels ?? Math.max(50, Math.floor(totalPixels * 0.0002));
  const maxPixelThreshold = Math.floor(totalPixels * (options?.maxAreaPercent ?? 0.70));

  const rawCandidates: LocalSlickCandidate[] = [];

  for (const [labelId, blob] of blobMap.entries()) {
    const pixelArea = blob.pixels.length;
    if (pixelArea < minPixelThreshold || pixelArea > maxPixelThreshold) continue;

    const bWidth = blob.maxX - blob.minX + 1;
    const bHeight = blob.maxY - blob.minY + 1;

    // Centroid
    let sumX = 0;
    let sumY = 0;
    for (const [px, py] of blob.pixels) {
      sumX += px;
      sumY += py;
    }
    const cX = sumX / pixelArea;
    const cY = sumY / pixelArea;

    // Central Moments (mu20, mu02, mu11) for true principal axis & orientation
    let mu20 = 0;
    let mu02 = 0;
    let mu11 = 0;
    for (const [px, py] of blob.pixels) {
      const dx = px - cX;
      const dy = py - cY;
      mu20 += dx * dx;
      mu02 += dy * dy;
      mu11 += dx * dy;
    }
    mu20 /= pixelArea;
    mu02 /= pixelArea;
    mu11 /= pixelArea;

    // Orientation angle in degrees
    const orientationRad = 0.5 * Math.atan2(2 * mu11, mu20 - mu02);
    let orientationDeg = Math.round((orientationRad * 180) / Math.PI);
    if (orientationDeg < 0) orientationDeg += 180;

    // Major and minor axis lengths from eigenvalues
    const term = Math.sqrt(Math.max(0, (mu20 - mu02) * (mu20 - mu02) + 4 * mu11 * mu11));
    const lambda1 = (mu20 + mu02 + term) / 2;
    const lambda2 = Math.max(0.1, (mu20 + mu02 - term) / 2);
    const majorAxis = 2 * Math.sqrt(Math.max(1, lambda1));
    const minorAxis = 2 * Math.sqrt(Math.max(1, lambda2));
    const aspectRatio = Number((majorAxis / Math.max(1, minorAxis)).toFixed(2));

    // Boundary extraction
    let perimeterPx = 0;
    const pixelSet = new Set(blob.pixels.map(([px, py]) => `${px},${py}`));
    const boundaryPoints: [number, number][] = [];

    for (const [px, py] of blob.pixels) {
      const isBoundary =
        !pixelSet.has(`${px + 1},${py}`) ||
        !pixelSet.has(`${px - 1},${py}`) ||
        !pixelSet.has(`${px},${py + 1}`) ||
        !pixelSet.has(`${px},${py - 1}`);

      if (isBoundary) {
        perimeterPx++;
        boundaryPoints.push([px, py]);
      }
    }

    const polygonPx = sortAndSimplifyContour(boundaryPoints, cX, cY);
    const compactness = Number((Math.min(1.0, (4 * Math.PI * pixelArea) / ((perimeterPx * perimeterPx) || 1))).toFixed(3));

    // Radar Backscatter Damping (dB estimate)
    const blobMeanIntensity = blob.intensitySum / pixelArea;
    const dampingRatio = Math.max(1.1, globalMean / Math.max(1, blobMeanIntensity));
    const dampingDb = Number((10 * Math.log10(dampingRatio)).toFixed(1));

    // Geographic conversions if georeferenced
    let centroidGeo: GeoCoordinate | null = null;
    let polygonGeo: [number, number][] | null = null;
    let geographicAreaKm2: number | null = null;
    let perimeterKm: number | null = null;

    if (metadata.hasGeoreferencing && metadata.boundingBox) {
      const { minLat, maxLat, minLng, maxLng } = metadata.boundingBox;
      const latRange = maxLat - minLat;
      const lngRange = maxLng - minLng;

      const pxToLng = (px: number) => minLng + (px / width) * lngRange;
      const pyToLat = (py: number) => maxLat - (py / height) * latRange;

      centroidGeo = {
        lat: Number(pyToLat(cY).toFixed(5)),
        lng: Number(pxToLng(cX).toFixed(5)),
      };

      polygonGeo = polygonPx.map(([px, py]) => [
        Number(pxToLng(px).toFixed(5)),
        Number(pyToLat(py).toFixed(5)),
      ]);

      let geoAreaM2 = 0;
      let geoPerimM = 0;
      for (let i = 0; i < polygonGeo.length; i++) {
        const j = (i + 1) % polygonGeo.length;
        const [x1, y1] = polygonGeo[i];
        const [x2, y2] = polygonGeo[j];

        const latM = 111320;
        const lngM = 111320 * Math.cos(((y1 + y2) / 2) * (Math.PI / 180));

        const pX1 = x1 * lngM;
        const pY1 = y1 * latM;
        const pX2 = x2 * lngM;
        const pY2 = y2 * latM;

        geoAreaM2 += (pX1 * pY2 - pX2 * pY1);
        geoPerimM += Math.hypot(pX2 - pX1, pY2 - pY1);
      }
      geographicAreaKm2 = Number((Math.abs(geoAreaM2) / 2 / 1_000_000).toFixed(2));
      perimeterKm = Number((geoPerimM / 1000).toFixed(2));
    }

    // Lookalike & Confidence Evaluation
    const lookalikeReasons: string[] = [];
    let lookalikeRisk: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    let confidenceScore = 65;

    if (dampingDb >= 4.0) confidenceScore += 12;
    if (dampingDb >= 6.0) confidenceScore += 12;
    if (aspectRatio > 1.8) {
      confidenceScore += 10;
    } else if (compactness > 0.65) {
      lookalikeRisk = 'MEDIUM';
      lookalikeReasons.push('High circularity: potential biogenic natural film or low-wind shelter zone.');
      confidenceScore -= 12;
    }

    if (pixelArea > 1500) confidenceScore += 8;

    confidenceScore = Math.min(98, Math.max(30, confidenceScore));
    const confidenceLevel = confidenceScore >= 80 ? 'HIGH' : confidenceScore >= 60 ? 'MEDIUM' : 'LOW';

    rawCandidates.push({
      id: `CAND-${labelId}`,
      pixelArea,
      geographicAreaKm2,
      perimeterPx,
      perimeterKm,
      lengthPx: Math.round(majorAxis),
      widthPx: Math.round(minorAxis),
      orientationDeg,
      compactness,
      aspectRatio,
      centroidPx: { x: Math.round(cX), y: Math.round(cY) },
      centroidGeo,
      polygonPx,
      polygonGeo,
      dampingDb,
      confidenceScore,
      confidenceLevel,
      lookalikeRisk,
      lookalikeReasons,
    });
  }

  // Sort candidates by confidence score and size
  rawCandidates.sort((a, b) => (b.confidenceScore * b.pixelArea) - (a.confidenceScore * a.pixelArea));

  const primaryCandidate = rawCandidates.length > 0 && rawCandidates[0].confidenceScore >= 50 ? rawCandidates[0] : null;

  // 7. Render Canvases (Intensity, Enhanced Contrast, Detection Overlay, Mask)
  const intensityCanvas = document.createElement('canvas');
  intensityCanvas.width = width;
  intensityCanvas.height = height;
  const intCtx = intensityCanvas.getContext('2d')!;
  const intImgData = intCtx.createImageData(width, height);

  const enhancedCanvas = document.createElement('canvas');
  enhancedCanvas.width = width;
  enhancedCanvas.height = height;
  const enhCtx = enhancedCanvas.getContext('2d')!;
  const enhImgData = enhCtx.createImageData(width, height);

  const p5 = Math.max(0, globalMean - 2.0 * globalStdDev);
  const p95 = Math.min(255, globalMean + 2.2 * globalStdDev);
  const pRange = Math.max(1, p95 - p5);

  for (let i = 0; i < totalPixels; i++) {
    const val = intensities[i];
    intImgData.data[i * 4] = val;
    intImgData.data[i * 4 + 1] = val;
    intImgData.data[i * 4 + 2] = val;
    intImgData.data[i * 4 + 3] = 255;

    const enhVal = Math.min(255, Math.max(0, ((val - p5) / pRange) * 255));
    enhImgData.data[i * 4] = enhVal;
    enhImgData.data[i * 4 + 1] = enhVal;
    enhImgData.data[i * 4 + 2] = enhVal;
    enhImgData.data[i * 4 + 3] = 255;
  }
  intCtx.putImageData(intImgData, 0, 0);
  enhCtx.putImageData(enhImgData, 0, 0);

  const overlayCanvas = document.createElement('canvas');
  overlayCanvas.width = width;
  overlayCanvas.height = height;
  const oCtx = overlayCanvas.getContext('2d')!;
  oCtx.drawImage(sourceCanvas, 0, 0);

  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = width;
  maskCanvas.height = height;
  const mCtx = maskCanvas.getContext('2d')!;
  mCtx.fillStyle = '#0f172a';
  mCtx.fillRect(0, 0, width, height);

  // Render all candidate overlays
  for (let cIdx = 0; cIdx < rawCandidates.length; cIdx++) {
    const cand = rawCandidates[cIdx];
    const isPrimary = cand === primaryCandidate;

    // Mask Canvas: Semi-transparent filled polygon & stroke
    mCtx.fillStyle = isPrimary ? 'rgba(239, 68, 68, 0.85)' : 'rgba(245, 158, 11, 0.7)';
    mCtx.strokeStyle = isPrimary ? '#ef4444' : '#f59e0b';
    mCtx.lineWidth = isPrimary ? 3 : 2;
    mCtx.beginPath();
    for (let i = 0; i < cand.polygonPx.length; i++) {
      const [px, py] = cand.polygonPx[i];
      if (i === 0) mCtx.moveTo(px, py);
      else mCtx.lineTo(px, py);
    }
    mCtx.closePath();
    mCtx.fill();
    mCtx.stroke();

    // Overlay Canvas: Semi-transparent fill + boundary glow
    oCtx.fillStyle = isPrimary ? 'rgba(244, 63, 94, 0.45)' : 'rgba(245, 158, 11, 0.35)';
    oCtx.strokeStyle = isPrimary ? '#38bdf8' : '#fbbf24';
    oCtx.lineWidth = isPrimary ? 2.5 : 1.5;
    oCtx.beginPath();
    for (let i = 0; i < cand.polygonPx.length; i++) {
      const [px, py] = cand.polygonPx[i];
      if (i === 0) oCtx.moveTo(px, py);
      else oCtx.lineTo(px, py);
    }
    oCtx.closePath();
    oCtx.fill();
    oCtx.stroke();

    // Centroid marker & label
    oCtx.fillStyle = isPrimary ? '#f43f5e' : '#f59e0b';
    oCtx.beginPath();
    oCtx.arc(cand.centroidPx.x, cand.centroidPx.y, isPrimary ? 5 : 3.5, 0, 2 * Math.PI);
    oCtx.fill();
    oCtx.strokeStyle = '#ffffff';
    oCtx.lineWidth = 1.5;
    oCtx.stroke();

    // Candidate text label
    oCtx.font = 'bold 11px monospace';
    oCtx.fillStyle = '#ffffff';
    oCtx.shadowColor = '#000000';
    oCtx.shadowBlur = 4;
    oCtx.fillText(
      `${isPrimary ? 'PRIMARY ' : ''}SLICK (${cand.dampingDb}dB)`,
      cand.centroidPx.x + 8,
      cand.centroidPx.y - 8
    );
    oCtx.shadowBlur = 0;
  }

  const originalImageUrl = sourceCanvas.toDataURL('image/png');
  const intensityImageUrl = intensityCanvas.toDataURL('image/png');
  const enhancedImageUrl = enhancedCanvas.toDataURL('image/png');
  const overlayImageUrl = overlayCanvas.toDataURL('image/png');
  const maskImageUrl = maskCanvas.toDataURL('image/png');

  const processingTimeMs = Math.round(performance.now() - startTime);

  onProgress?.({
    stage: 'Analysis Complete',
    status: 'DONE',
    detail: primaryCandidate
      ? `Detected ${rawCandidates.length} candidate(s); primary slick damping: -${primaryCandidate.dampingDb} dB`
      : 'No high-confidence capillary wave damping slick detected',
    percent: 100,
  });

  return {
    metadata,
    rasterWidth: width,
    rasterHeight: height,
    originalImageUrl,
    intensityImageUrl,
    enhancedImageUrl,
    overlayImageUrl,
    maskImageUrl,
    candidates: rawCandidates,
    detectedSlick: primaryCandidate,
    overallDetectionStatus: primaryCandidate
      ? 'SLICK_DETECTED'
      : rawCandidates.length > 0
      ? 'LOW_CONTRAST_ANOMALY'
      : 'NO_HIGH_CONFIDENCE_SLICK',
    backgroundMeanIntensity: Number(globalMean.toFixed(1)),
    backgroundStdDev: Number(globalStdDev.toFixed(1)),
    processingTimeMs,
  };
}

/**
 * Helper to sort boundary points radially around centroid and simplify
 */
function sortAndSimplifyContour(points: [number, number][], cX: number, cY: number): [number, number][] {
  if (points.length <= 4) return points;

  // Sort by polar angle around centroid
  const sorted = [...points].sort((a, b) => {
    const angleA = Math.atan2(a[1] - cY, a[0] - cX);
    const angleB = Math.atan2(b[1] - cY, b[0] - cX);
    return angleA - angleB;
  });

  // Decimate to max ~40 vertices for clean geometric polygon
  const maxVertices = 36;
  if (sorted.length <= maxVertices) return sorted;

  const step = sorted.length / maxVertices;
  const result: [number, number][] = [];
  for (let i = 0; i < maxVertices; i++) {
    const idx = Math.min(sorted.length - 1, Math.floor(i * step));
    result.push(sorted[idx]);
  }
  return result;
}
