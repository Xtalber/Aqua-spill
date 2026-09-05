/**
 * Aqua Spill - Core Domain Types & Data Contracts
 * Maritime Intelligence, SAR Oil Spill Detection, Hydrodynamic Drift & AIS Attribution
 */

export type AttributionCategory =
  | 'PRIMARY SOURCE CANDIDATE'
  | 'SOURCE CANDIDATE'
  | 'POTENTIAL SOURCE VESSEL'
  | 'AIS-CORRELATED VESSEL'
  | 'LOW-CORRELATION VESSEL'
  | 'INSUFFICIENT EVIDENCE'
  | 'POTENTIAL CANDIDATE'
  | 'PASSING'
  | 'LOW RELEVANCE';

export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';

export type ProviderStatusType = 'Active' | 'Connected' | 'Data unavailable' | 'Degraded' | 'Offline' | 'Not Configured';

export interface GeoCoordinate {
  lat: number;
  lng: number;
}

export interface GeoPolygon {
  type: 'Polygon';
  coordinates: [number, number][][]; // [lng, lat]
}

export interface SlickMorphometry {
  areaKm2: number;
  perimeterKm: number;
  lengthKm: number;
  widthKm: number;
  orientationDeg: number; // Major axis angle
  compactness: number; // Isoperimetric quotient (4*pi*Area/P^2)
  estimatedAgeHoursMin: number;
  estimatedAgeHoursMax: number;
  backscatterDampingDb: number; // dB drop compared to background sea
  backgroundSeaSigma0Db: number;
  slickSigma0Db: number;
  lookalikeRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  lookalikeReasons: string[];
}

export interface SatelliteObservation {
  id: string;
  satellite: 'Sentinel-1A SAR' | 'Sentinel-1B SAR' | 'Sentinel-2A Optical' | 'Sentinel-2B Optical' | 'User Upload' | 'RADARSAT-2' | 'TerraSAR-X';
  sensorMode: string;
  polarization: 'VV' | 'VH' | 'HH' | 'HV' | 'Optical RGB';
  acquisitionTime: string; // ISO UTC
  centroid: GeoCoordinate;
  footprint: GeoPolygon;
  resolutionMeters: number;
  orbitDirection: 'ASCENDING' | 'DESCENDING';
  orbitNumber?: number;
  imageUrl?: string;
  processedImageUrl?: string;
  maskImageUrl?: string;
  sourceType: 'LIVE' | 'DEMO' | 'UPLOAD';
}

export interface OilSpillDetection {
  id: string;
  caseId: string;
  observationId: string;
  detectionTime: string;
  centroid: GeoCoordinate;
  boundingBox: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  };
  polygon: GeoPolygon;
  morphometry: SlickMorphometry;
  confidence: ConfidenceLevel;
  confidenceScore: number; // 0-100%
  detectionMethod: 'SAR CFAR + Adaptive Thresholding + Deep CNN' | 'Optical Spectral Index (NDWI/OCI)' | 'Baseline Morphological Segmentation';
  isSynthetic: boolean;
}

export interface MetoceanData {
  timestamp: string;
  location: GeoCoordinate;
  windSpeedKts: number;
  windDirectionDeg: number; // Direction wind is coming from (meteorological standard)
  windU: number; // m/s eastward
  windV: number; // m/s northward
  currentSpeedKts: number;
  currentDirectionDeg: number; // Direction current is flowing to (oceanographic standard)
  currentU: number; // m/s
  currentV: number; // m/s
  significantWaveHeightM: number;
  wavePeriodSec: number;
  seaSurfaceTempC: number;
  sourceWind: string; // e.g. "Copernicus ERA5 Reanalysis"
  sourceCurrent: string; // e.g. "Copernicus Marine CMEMS Global"
  status: 'LIVE' | 'DEMO' | 'INTERPOLATED';
}

export interface DriftTimeStep {
  hoursOffset: number; // negative for hindcast, positive for forecast
  timestamp: string;
  position: GeoCoordinate;
  uncertaintyRadiusKm: number;
  windVectorKts: { speed: number; dirDeg: number };
  currentVectorKts: { speed: number; dirDeg: number };
  netDriftSpeedKts: number;
  netDriftDirectionDeg: number;
  // Weathering parameters
  evaporationPercent?: number;
  emulsificationWaterPercent?: number;
  estimatedAreaKm2?: number;
}

export interface DriftSimulation {
  caseId: string;
  observedTime: string;
  observedPosition: GeoCoordinate;
  parameters: {
    windLeewayFactor: number; // Typically 0.03 (3% of wind speed)
    windDeflectionDeg: number; // Typically 10 deg right in NH due to Coriolis
    currentWeight: number; // Typically 1.0 (100% of surface current)
    stokesDriftWeight: number; // Typically 0.015
    diffusionCoeffM2s: number; // Horizontal eddy diffusivity
  };
  hindcast: DriftTimeStep[]; // Ordered backwards in time (T-0 to T-origin)
  probableOrigin: {
    position: GeoCoordinate;
    timeWindowStart: string;
    timeWindowEnd: string;
    estimatedTime: string;
    uncertaintyKm: number;
    confidence: ConfidenceLevel;
  };
  forecast: DriftTimeStep[]; // Ordered forward in time (T+0 to T+48h)
  generatedAt: string;
}

export interface AISTrackPoint {
  timestamp: string;
  lat: number;
  lng: number;
  sogKts: number; // Speed Over Ground
  cogDeg: number; // Course Over Ground
  headingDeg: number;
  navStatus?: string;
  distanceToOriginKm?: number;
}

export interface AISVessel {
  mmsi: number;
  imo?: number;
  name: string;
  callsign?: string;
  flag: string;
  flagCode: string;
  vesselType: 'Crude Oil Tanker' | 'Chemical Tanker' | 'Bulk Carrier' | 'Container Ship' | 'General Cargo' | 'Tug / Supply' | 'Fishing' | 'Other';
  lengthM: number;
  beamM: number;
  draughtM: number;
  destination?: string;
  eta?: string;
  track: AISTrackPoint[];
  dataQuality: {
    completenessRating: 'EXCELLENT' | 'GOOD' | 'MODERATE' | 'POOR';
    gapCount: number;
    maxGapMinutes: number;
    totalPoints: number;
  };
}

export interface CPAAnalysisResult {
  mmsi: number;
  vesselName: string;
  cpaDistanceKm: number;
  cpaTime: string;
  timeDifferenceMinutes: number; // |cpaTime - estimatedOriginTime|
  vesselPositionAtCPA: GeoCoordinate;
  slickPositionAtCPA: GeoCoordinate;
  vesselSpeedAtCPA: number;
  vesselCourseAtCPA: number;
  insideOriginCorridor: boolean;
  trajectoryAlignmentScore: number; // 0-100
}

export interface BehaviorAnomalyIndicator {
  type: 'COURSE_ALTERATION' | 'SPEED_REDUCTION' | 'LOITERING' | 'AIS_TRANSMISSION_GAP' | 'ROUTE_DEVIATION' | 'NORMAL';
  severity: 'INFO' | 'WARNING' | 'HIGH';
  description: string;
  timestamp: string;
  coordinate?: GeoCoordinate;
}

export interface VesselAttributionScore {
  mmsi: number;
  vesselName: string;
  imo?: number;
  vesselType: string;
  flag: string;
  flagCode: string;
  category: AttributionCategory;
  attributionScore: number; // 0-100 normalized score
  confidenceLevel: ConfidenceLevel;
  subScores: {
    spatialProximity: number; // weight ~ 25%
    temporalCorrelation: number; // weight ~ 20%
    trajectoryAlignment: number; // weight ~ 15%
    originCorridorOverlap: number; // weight ~ 15%
    speedConsistency: number; // weight ~ 10%
    courseConsistency: number; // weight ~ 5%
    behavioralAnomaly: number; // weight ~ 5%
    aisDataQuality: number; // weight ~ 5%
  };
  cpa: CPAAnalysisResult;
  behaviorIndicators: BehaviorAnomalyIndicator[];
  evidenceList: string[];
  counterEvidenceList: string[];
  disclaimer: string;
}

export type AttributionResult = VesselAttributionScore;
export type VesselAttributionResult = VesselAttributionScore;

export interface CurrentCaseOilObject {
  objectId: string;
  objectIndex: number;
  label: string;
  pixelBbox: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
  pixelCenter: {
    x: number;
    y: number;
  };
  pixelWidth: number;
  pixelHeight: number;
  pixelArea: number;
  publishedLabelSizePx?: number | null;
  latitude: number;
  longitude: number;
  geoPolygon?: GeoPolygon | null;
  // Morphometrics (Mathematical calculations)
  aspectRatio: number;
  perimeterPx: number;
  majorAxisPx: number;
  minorAxisPx: number;
  orientationDeg: number;
  circularity: number; // 4*pi*A / P^2
  compactness: number;
  elongation: number; // 1 - minor/major
  solidity: number;
  extent: number;
  // Physical units (10m ground resolution)
  groundSampleDistanceM: number;
  physicalAreaM2: number;
  physicalAreaKm2: number;
  physicalPerimeterKm: number;
  physicalMajorAxisM: number;
  physicalMinorAxisM: number;
  physicalWidthM: number;
  physicalHeightM: number;
  confidence: number;
  provenance: {
    area: string;
    bbox: string;
    morphometrics: string;
  };
}

export interface CurrentCaseTransectPoint {
  distanceKm: number;
  relativeIntensityDn: number;
  relativeIntensityDb: number;
  region: 'ambient_sea' | 'boundary' | 'oil_slick';
}

export interface CurrentCaseVesselDistancePoint {
  time: string;
  distanceKm: number;
  insideCorridor: boolean;
}

export interface CurrentCaseWeatheringCurvePoint {
  timeHours: number;
  evaporativeFractionPercent: number;
  remainingOilPercent: number;
  waterContentPercent: number;
  viscosityCp: number;
  spreadAreaKm2: number;
}

export interface CurrentCase {
  id: string;
  filename: string;
  recordId: string;
  image: {
    url: string;
    enhancedUrl?: string;
    width: number;
    height: number;
    format: string;
    sha256?: string;
    bytes?: number;
    enhancementParams?: {
      method: string;
      lowerPercentile: number;
      upperPercentile: number;
      normalization: string;
      processingStatus: string;
    };
  };
  metadata: {
    recordId: string;
    patchId: string;
    patchName?: string;
    imageSet: string;
    class: 'oil' | 'no_oil';
    sceneType: 'water' | 'coast';
    oilPresent: boolean;
    objectCount: number;
    satellite: string;
    sensorMode: string;
    polarization: string;
    orbitNumber?: number;
    dataTakeId?: string;
    acquisitionStartTime: string;
    acquisitionEndTime?: string;
    resolutionMeters: number;
    sentinelProductId?: string;
    copernicusHubQuery?: string;
    xmlAnnotationFilename?: string;
    source: any;
  };
  geometry: {
    center: GeoCoordinate;
    corners: {
      topLeft: [number, number];
      topRight: [number, number];
      bottomRight: [number, number];
      bottomLeft: [number, number];
    };
    bbox: {
      minLat: number;
      maxLat: number;
      minLng: number;
      maxLng: number;
    };
    footprintPolygon: GeoPolygon;
  };
  oilObjects: CurrentCaseOilObject[];
  selectedObjectIndex: number; // 0 for all, or 1-based index
  morphometricsSummary: {
    totalObjects: number;
    totalAreaKm2: number;
    totalAreaPx: number;
    publishedAreaPx?: number;
    scaleResolutionMeters: number;
  };
  sarBackscatter: {
    isCalibrated: boolean;
    statusLabel: string;
    unit: string;
    ambientSeaMeanDn: number;
    slickMeanDn: number;
    minDn: number;
    maxDn: number;
    stdDevDn: number;
    deltaRelativeDn: number;
    deltaRelativeDb: number;
    transect: CurrentCaseTransectPoint[];
    provenance: string;
    disclaimer: string;
  };
  aisCandidates: AISVessel[];
  attributionScores: VesselAttributionScore[];
  vesselDistanceTimeSeries: {
    mmsi: number;
    vesselName: string;
    cpaPoint: {
      distanceKm: number;
      time: string;
    };
    releaseWindow: {
      start: string;
      end: string;
    };
    timeSeries: CurrentCaseVesselDistancePoint[];
  };
  weathering: {
    modelName: string;
    timeSinceReleaseHours: number;
    evaporativeFractionPercent: number;
    remainingOilPercent: number;
    waterContentPercent: number;
    viscosityCp: number;
    spreadAreaKm2: number;
    curves: CurrentCaseWeatheringCurvePoint[];
    provenance: string;
  };
  metocean: MetoceanData;
  drift: DriftSimulation;
  provenance: {
    sarObservation: string;
    annotations: string;
    morphometrics: string;
    sarBackscatter: string;
    metocean: string;
    drift: string;
    aisCandidates: string;
    weathering: string;
  };
}

export interface SpillCase {
  id: string; // e.g. "SPILL-2026-001"
  title: string;
  locationName: string;
  status: 'Detection Complete' | 'Drift Reconstructed' | 'Attribution Complete' | 'Report Generated' | 'Under Investigation';
  createdAt: string;
  updatedAt: string;
  observation: SatelliteObservation;
  detection: OilSpillDetection;
  metocean: MetoceanData;
  drift: DriftSimulation;
  aisVessels: AISVessel[];
  attributionResults: VesselAttributionScore[];
  notes?: string;
  currentCase?: CurrentCase; // Authoritative central state for DARTIS 2019 master dataset
}

export interface DatasetItem {
  id: string;
  name: string;
  dataType: 'AIS Traffic' | 'SAR Imagery' | 'Metocean Winds' | 'CMEMS Currents' | 'GeoJSON Slicks';
  source: string;
  recordCount: number;
  coverage: string;
  status: 'Ready' | 'Ingesting' | 'Error';
  lastUpdate: string;
  apiStatus: 'Connected' | 'Standby' | 'Rate Limited' | 'Not Configured';
  isDemo: boolean;
}

export interface MARPOLReportData {
  caseId: string;
  reportReference: string;
  generatedAt: string;
  preparedBy: string;
  executiveSummary: string;
  satelliteMetadata: SatelliteObservation;
  slickCharacteristics: SlickMorphometry;
  metoceanSummary: MetoceanData;
  driftSummary: {
    observedTime: string;
    probableOriginTime: string;
    probableOriginCoord: GeoCoordinate;
    uncertaintyKm: number;
    driftVectorSummary: string;
  };
  aisSummary: {
    totalVesselsInWindow: number;
    searchRadiusKm: number;
    temporalWindowHours: number;
  };
  topCandidates: VesselAttributionScore[];
  scientificUncertaintyNotes: string;
  legalDisclaimer: string;
  dataProvenanceList: {
    domain: string;
    source: string;
    latency: string;
    mode: 'LIVE' | 'DEMO' | 'CACHED';
  }[];
}

export interface SystemHealthStatus {
  sentinel: ProviderStatusType;
  era5: ProviderStatusType;
  oceanCurrent: ProviderStatusType;
  ais: ProviderStatusType;
  backend: 'Healthy' | 'Degraded' | 'Offline';
  database: 'Connected (Firestore/Store)' | 'Connected (Supabase PostgreSQL + Storage)' | 'Connected (Local Engine & Store)' | 'Standby' | 'Offline' | string;
  gemini: 'Connected' | 'Not Configured';
  leafletTiles: 'Connected' | 'Offline';
  googleMaps?: ProviderStatusType;
  cds?: ProviderStatusType;
  mode: 'DEMO' | 'LIVE';
  lastSyncTime: string;
  processingLatencyMs: number;
}


export type AppTab =
  | 'overview'
  | 'detection'
  | 'drift'
  | 'attribution'
  | 'analytics'
  | 'datasets'
  | 'marpol_report';

export interface MapLayerVisibility {
  slickPolygon: boolean;
  sarSwath: boolean;
  hindcastTrack: boolean;
  forecastTrack: boolean;
  uncertaintyEllipse: boolean;
  aisVessels: boolean;
  candidateTracks: boolean;
  originCorridor: boolean;
  windVectors: boolean;
  currentVectors: boolean;
  shippingLanes: boolean;
  bathymetry: boolean;
}

export interface DriftParameters {
  windLeewayFactor: number;
  windDeflectionDeg: number;
  currentWeight: number;
  stokesDriftWeight: number;
  diffusionCoeffM2s: number;
}

export interface DartisOilObject {
  id: string;
  imageId: string;
  objectIndex: number;
  pixelBbox?: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  } | null;
  geoCoordinates?: [number, number][] | null; // Array of [lng, lat]
  geoPolygon?: GeoPolygon | null;
  areaKm2: number;
  pixelCount?: number;
  confidence?: number;
  label?: string;
  metadata?: Record<string, any>;
}

export interface DartisDatasetImage {
  id: string;
  importId?: string;
  datasetId?: string;
  fileName: string;
  normalizedFileName: string;
  relativePath: string;
  patchId: string;
  sentinelPatchName?: string;
  sentinelProductId?: string;
  satellite: string;
  acquisitionMode: string;
  polarization: string;
  orbitNumber?: number;
  dataTakeId?: string;
  acquisitionStartTime: string;
  acquisitionEndTime?: string;
  width: number;
  height: number;
  center: GeoCoordinate;
  corners?: {
    topLeft?: [number, number];
    topRight?: [number, number];
    bottomRight?: [number, number];
    bottomLeft?: [number, number];
  } | null;
  geoPolygon?: GeoPolygon | null;
  oilPresent: boolean;
  objectCount: number;
  oilObjects: DartisOilObject[];
  storagePath?: string;
  thumbnailUrl?: string;
  imageUrl?: string;
  metadata?: Record<string, any>;
}

export interface DartisMasterDataset {
  id: string;
  name: string;
  isImported?: boolean;
  zipFileName?: string;
  metadataSource?: string;
  originalFileName: string;
  fileSize: number;
  status: 'READY' | 'UPLOADING' | 'EXTRACTING' | 'INDEXING' | 'FAILED';
  stage?: string;
  progress: number;
  totalImages: number;
  oilSpillImages: number;
  cleanImages: number;
  totalOilObjects: number;
  storageStatus: 'Stored in Supabase' | 'Stored in Local Storage' | 'Synced';
  indexStatus: 'Ready' | 'Indexing' | 'Failed' | 'Empty';
  geographicBounds?: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  } | null;
  importedAt: string;
  updatedAt: string;
  images?: DartisDatasetImage[];
}

export interface DartisUploadProgress {
  stage: 'IDLE' | 'UPLOADING' | 'EXTRACTING' | 'INDEXING' | 'COMPLETED' | 'FAILED';
  percent: number;
  message: string;
  bytesUploaded?: number;
  totalBytes?: number;
  currentChunk?: number;
  totalChunks?: number;
  processedItems?: number;
  totalItems?: number;
  error?: string;
}
