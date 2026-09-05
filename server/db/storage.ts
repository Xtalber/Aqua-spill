/**
 * Aqua Spill - In-Memory and File-Backed Storage Engine
 * Stores Cases, Satellite Observations, Oil Slicks, Drift Tracks, Metocean Data, AIS Telemetry, and Reports.
 */

import fs from 'fs';
import path from 'path';
import {
  SpillCase,
  SatelliteObservation,
  OilSpillDetection,
  MetoceanData,
  AISVessel,
  DatasetItem,
  MARPOLReportData,
} from '../../src/types';
import { runHindcastAndForecast } from '../physics/driftModel';
import { rankAllVessels } from '../attribution/scoringEngine';
import { supabaseServer, isServerSupabaseConfigured } from '../supabase';

const DATA_DIR = path.join(process.cwd(), 'data');
const CASES_FILE = path.join(DATA_DIR, 'cases.json');
const REPORTS_FILE = path.join(DATA_DIR, 'reports.json');

// Seed Case 1: Malacca Strait Heavy Shipping Lane (Realistic benchmark based on Sentinel-1 SAR acquisition)
function createSeedCase1(): SpillCase {
  const caseId = 'SPILL-2026-001';
  const obsTime = '2026-08-29T09:30:00.000Z';
  const center = { lat: 2.450, lng: 101.880 }; // Malacca Strait TSS

  const observation: SatelliteObservation = {
    id: 'S1A_IW_GRDH_1SDV_20260829T093000_049210_05E412_A841',
    satellite: 'Sentinel-1A SAR',
    sensorMode: 'Interferometric Wide Swath (IW)',
    polarization: 'VV',
    acquisitionTime: obsTime,
    centroid: center,
    footprint: {
      type: 'Polygon',
      coordinates: [[
        [100.80, 2.10],
        [102.60, 1.80],
        [103.10, 3.20],
        [101.30, 3.50],
        [100.80, 2.10],
      ]],
    },
    resolutionMeters: 10.0,
    orbitDirection: 'DESCENDING',
    orbitNumber: 54912,
    sourceType: 'DEMO',
  };

  const slickCoords: [number, number][] = [
    [101.835, 2.432],
    [101.855, 2.441],
    [101.882, 2.452],
    [101.910, 2.463],
    [101.925, 2.472],
    [101.918, 2.476],
    [101.890, 2.462],
    [101.860, 2.448],
    [101.840, 2.438],
    [101.835, 2.432],
  ];

  const detection: OilSpillDetection = {
    id: `DET-${caseId}`,
    caseId,
    observationId: observation.id,
    detectionTime: '2026-08-29T09:42:00.000Z',
    centroid: center,
    boundingBox: {
      minLat: 2.430,
      maxLat: 2.478,
      minLng: 101.830,
      maxLng: 101.930,
    },
    polygon: {
      type: 'Polygon',
      coordinates: [slickCoords],
    },
    morphometry: {
      areaKm2: 14.85,
      perimeterKm: 26.40,
      lengthKm: 11.20,
      widthKm: 1.65,
      orientationDeg: 308,
      compactness: 0.268,
      estimatedAgeHoursMin: 3.0,
      estimatedAgeHoursMax: 5.5,
      backscatterDampingDb: 6.8,
      backgroundSeaSigma0Db: -13.8,
      slickSigma0Db: -20.6,
      lookalikeRisk: 'LOW',
      lookalikeReasons: [
        'Wind speed is 13.5 kts (optimal SAR contrast window between 3 and 12 m/s).',
        'High aspect ratio (length:width = 6.8:1) aligned with Malacca Strait Traffic Separation Scheme corridor.',
        'Sharp backscatter damping step of 6.8 dB relative to surrounding sea surface.',
      ],
    },
    confidence: 'HIGH',
    confidenceScore: 94,
    detectionMethod: 'SAR CFAR + Adaptive Thresholding + Deep CNN',
    isSynthetic: false,
  };

  const metocean: MetoceanData = {
    timestamp: obsTime,
    location: center,
    windSpeedKts: 13.5,
    windDirectionDeg: 235, // SW Monsoon
    windU: -5.7,
    windV: -3.9,
    currentSpeedKts: 0.72,
    currentDirectionDeg: 295, // NW Along-channel current
    currentU: -0.34,
    currentV: 0.16,
    significantWaveHeightM: 1.35,
    wavePeriodSec: 5.8,
    seaSurfaceTempC: 29.2,
    sourceWind: 'Copernicus ERA5 Atmospheric Reanalysis',
    sourceCurrent: 'CMEMS Global Ocean Physics Analysis (1/12°)',
    status: 'LIVE',
  };

  // Run drift model
  const drift = runHindcastAndForecast(caseId, center, obsTime, metocean, 14.85);

  // AIS Vessels with historical waypoints around origin window (05:00 - 09:30 UTC)
  const aisVessels: AISVessel[] = [
    {
      mmsi: 354921000,
      imo: 9518872,
      name: 'STAR POLARIS',
      callsign: '3FZL8',
      flag: 'Panama',
      flagCode: 'PA',
      vesselType: 'Bulk Carrier',
      lengthM: 229,
      beamM: 32,
      draughtM: 14.5,
      destination: 'SINGAPORE',
      eta: '2026-08-30 04:00 UTC',
      track: [
        { timestamp: '2026-08-29T05:00:00Z', lat: 2.310, lng: 102.050, sogKts: 13.1, cogDeg: 312, headingDeg: 312 },
        { timestamp: '2026-08-29T05:30:00Z', lat: 2.350, lng: 102.010, sogKts: 13.0, cogDeg: 312, headingDeg: 312 },
        { timestamp: '2026-08-29T06:00:00Z', lat: 2.390, lng: 101.970, sogKts: 12.9, cogDeg: 312, headingDeg: 312 },
        { timestamp: '2026-08-29T06:30:00Z', lat: 2.425, lng: 101.925, sogKts: 12.8, cogDeg: 312, headingDeg: 312 },
        { timestamp: '2026-08-29T07:00:00Z', lat: 2.460, lng: 101.880, sogKts: 12.8, cogDeg: 312, headingDeg: 312 },
        { timestamp: '2026-08-29T07:30:00Z', lat: 2.500, lng: 101.830, sogKts: 12.7, cogDeg: 312, headingDeg: 312 },
        { timestamp: '2026-08-29T08:00:00Z', lat: 2.540, lng: 101.780, sogKts: 12.8, cogDeg: 312, headingDeg: 312 },
        { timestamp: '2026-08-29T08:30:00Z', lat: 2.580, lng: 101.730, sogKts: 12.9, cogDeg: 312, headingDeg: 312 },
        { timestamp: '2026-08-29T09:00:00Z', lat: 2.620, lng: 101.680, sogKts: 13.0, cogDeg: 312, headingDeg: 312 },
      ],
      dataQuality: {
        completenessRating: 'EXCELLENT',
        gapCount: 0,
        maxGapMinutes: 10,
        totalPoints: 9,
      },
    },
    {
      mmsi: 636018442,
      imo: 9684122,
      name: 'OCEAN VOYAGER',
      callsign: 'D5NE4',
      flag: 'Liberia',
      flagCode: 'LR',
      vesselType: 'Crude Oil Tanker',
      lengthM: 274,
      beamM: 48,
      draughtM: 16.8,
      destination: 'NINGBO',
      track: [
        { timestamp: '2026-08-29T05:00:00Z', lat: 2.220, lng: 102.140, sogKts: 14.5, cogDeg: 310, headingDeg: 310 },
        { timestamp: '2026-08-29T06:00:00Z', lat: 2.320, lng: 102.040, sogKts: 14.4, cogDeg: 310, headingDeg: 310 },
        { timestamp: '2026-08-29T07:00:00Z', lat: 2.415, lng: 101.940, sogKts: 14.2, cogDeg: 310, headingDeg: 310 },
        { timestamp: '2026-08-29T08:00:00Z', lat: 2.510, lng: 101.835, sogKts: 14.3, cogDeg: 310, headingDeg: 310 },
        { timestamp: '2026-08-29T09:00:00Z', lat: 2.610, lng: 101.730, sogKts: 14.4, cogDeg: 310, headingDeg: 310 },
      ],
      dataQuality: {
        completenessRating: 'GOOD',
        gapCount: 0,
        maxGapMinutes: 15,
        totalPoints: 5,
      },
    },
    {
      mmsi: 538006712,
      imo: 9445100,
      name: 'PACIFIC PROSPERITY',
      callsign: 'V7AB2',
      flag: 'Marshall Islands',
      flagCode: 'MH',
      vesselType: 'Container Ship',
      lengthM: 366,
      beamM: 51,
      draughtM: 15.0,
      destination: 'PORT KLANG',
      track: [
        { timestamp: '2026-08-29T05:30:00Z', lat: 2.560, lng: 101.720, sogKts: 18.2, cogDeg: 132, headingDeg: 132 },
        { timestamp: '2026-08-29T06:30:00Z', lat: 2.440, lng: 101.840, sogKts: 18.0, cogDeg: 132, headingDeg: 132 },
        { timestamp: '2026-08-29T07:30:00Z', lat: 2.320, lng: 101.960, sogKts: 18.1, cogDeg: 132, headingDeg: 132 },
        { timestamp: '2026-08-29T08:30:00Z', lat: 2.200, lng: 102.080, sogKts: 18.3, cogDeg: 132, headingDeg: 132 },
      ],
      dataQuality: {
        completenessRating: 'GOOD',
        gapCount: 0,
        maxGapMinutes: 15,
        totalPoints: 4,
      },
    },
    {
      mmsi: 311000854,
      imo: 9382109,
      name: 'NORDIC EXPLORER',
      callsign: 'C6XF3',
      flag: 'Bahamas',
      flagCode: 'BS',
      vesselType: 'Chemical Tanker',
      lengthM: 182,
      beamM: 28,
      draughtM: 10.4,
      destination: 'PENANG',
      track: [
        { timestamp: '2026-08-29T05:00:00Z', lat: 2.180, lng: 101.980, sogKts: 11.2, cogDeg: 325, headingDeg: 325 },
        { timestamp: '2026-08-29T06:30:00Z', lat: 2.280, lng: 101.900, sogKts: 11.0, cogDeg: 325, headingDeg: 325 },
        { timestamp: '2026-08-29T08:00:00Z', lat: 2.380, lng: 101.820, sogKts: 11.1, cogDeg: 325, headingDeg: 325 },
        { timestamp: '2026-08-29T09:30:00Z', lat: 2.480, lng: 101.740, sogKts: 11.0, cogDeg: 325, headingDeg: 325 },
      ],
      dataQuality: {
        completenessRating: 'GOOD',
        gapCount: 0,
        maxGapMinutes: 20,
        totalPoints: 4,
      },
    },
    {
      mmsi: 413498110,
      name: 'HAI YANG 68',
      flag: 'China',
      flagCode: 'CN',
      vesselType: 'General Cargo',
      lengthM: 118,
      beamM: 18,
      draughtM: 6.8,
      destination: 'JAKARTA',
      track: [
        { timestamp: '2026-08-29T05:00:00Z', lat: 2.650, lng: 101.950, sogKts: 9.5, cogDeg: 140, headingDeg: 140 },
        { timestamp: '2026-08-29T07:00:00Z', lat: 2.490, lng: 102.100, sogKts: 9.4, cogDeg: 140, headingDeg: 140 },
        { timestamp: '2026-08-29T09:00:00Z', lat: 2.330, lng: 102.250, sogKts: 9.3, cogDeg: 140, headingDeg: 140 },
      ],
      dataQuality: {
        completenessRating: 'MODERATE',
        gapCount: 1,
        maxGapMinutes: 60,
        totalPoints: 3,
      },
    },
  ];

  const attributionResults = rankAllVessels(aisVessels, drift);

  return {
    id: caseId,
    title: 'Malacca Strait TSS Southbound Corridor Slick',
    locationName: 'Strait of Malacca, Off Port Dickson',
    status: 'Report Generated',
    createdAt: '2026-08-29T09:45:00.000Z',
    updatedAt: '2026-08-29T10:15:00.000Z',
    observation,
    detection,
    metocean,
    drift,
    aisVessels,
    attributionResults,
    notes: 'Incident identified in Sentinel-1A SAR descending pass. Reconstructed origin points to ~06:30 UTC near waypoint 2.425°N, 101.925°E.',
  };
}

// Seed Case 2: Persian Gulf / Strait of Hormuz Tanker Anchorage
function createSeedCase2(): SpillCase {
  const caseId = 'SPILL-2026-002';
  const obsTime = '2026-08-28T14:15:00.000Z';
  const center = { lat: 25.820, lng: 55.240 };

  const observation: SatelliteObservation = {
    id: 'S1B_IW_GRDH_1SDV_20260828T141500_038100_04F112_B109',
    satellite: 'Sentinel-1B SAR',
    sensorMode: 'Interferometric Wide Swath (IW)',
    polarization: 'VV',
    acquisitionTime: obsTime,
    centroid: center,
    footprint: {
      type: 'Polygon',
      coordinates: [[
        [54.50, 25.10],
        [56.10, 25.00],
        [56.40, 26.50],
        [54.80, 26.60],
        [54.50, 25.10],
      ]],
    },
    resolutionMeters: 10.0,
    orbitDirection: 'ASCENDING',
    orbitNumber: 38100,
    sourceType: 'DEMO',
  };

  const poly: [number, number][] = [
    [55.205, 25.805],
    [55.225, 25.815],
    [55.250, 25.828],
    [55.275, 25.838],
    [55.265, 25.845],
    [55.235, 25.830],
    [55.210, 25.815],
    [55.205, 25.805],
  ];

  const detection: OilSpillDetection = {
    id: `DET-${caseId}`,
    caseId,
    observationId: observation.id,
    detectionTime: '2026-08-28T14:28:00.000Z',
    centroid: center,
    boundingBox: { minLat: 25.80, maxLat: 25.85, minLng: 55.20, maxLng: 55.28 },
    polygon: { type: 'Polygon', coordinates: [poly] },
    morphometry: {
      areaKm2: 8.42,
      perimeterKm: 18.20,
      lengthKm: 7.80,
      widthKm: 1.20,
      orientationDeg: 42,
      compactness: 0.318,
      estimatedAgeHoursMin: 2.0,
      estimatedAgeHoursMax: 4.5,
      backscatterDampingDb: 5.9,
      backgroundSeaSigma0Db: -12.4,
      slickSigma0Db: -18.3,
      lookalikeRisk: 'LOW',
      lookalikeReasons: ['Sharp damping step of 5.9 dB', 'Wind speed 10.5 kts'],
    },
    confidence: 'HIGH',
    confidenceScore: 89,
    detectionMethod: 'SAR CFAR + Adaptive Thresholding + Deep CNN',
    isSynthetic: false,
  };

  const metocean: MetoceanData = {
    timestamp: obsTime,
    location: center,
    windSpeedKts: 10.8,
    windDirectionDeg: 310, // NW Shamal wind
    windU: 4.2,
    windV: -3.5,
    currentSpeedKts: 0.55,
    currentDirectionDeg: 120, // SE Surface current
    currentU: 0.24,
    currentV: -0.14,
    significantWaveHeightM: 0.95,
    wavePeriodSec: 4.5,
    seaSurfaceTempC: 32.4,
    sourceWind: 'Copernicus ERA5 Reanalysis',
    sourceCurrent: 'CMEMS Persian Gulf Model',
    status: 'LIVE',
  };

  const drift = runHindcastAndForecast(caseId, center, obsTime, metocean, 8.42);

  const aisVessels: AISVessel[] = [
    {
      mmsi: 636014490,
      imo: 9410985,
      name: 'GULF HORIZON',
      flag: 'Liberia',
      flagCode: 'LR',
      vesselType: 'Chemical Tanker',
      lengthM: 183,
      beamM: 32,
      draughtM: 11.8,
      destination: 'FUJAIRAH',
      track: [
        { timestamp: '2026-08-28T10:00:00Z', lat: 25.750, lng: 55.150, sogKts: 12.2, cogDeg: 45, headingDeg: 45 },
        { timestamp: '2026-08-28T11:30:00Z', lat: 25.795, lng: 55.205, sogKts: 12.0, cogDeg: 45, headingDeg: 45 },
        { timestamp: '2026-08-28T13:00:00Z', lat: 25.840, lng: 55.260, sogKts: 12.1, cogDeg: 45, headingDeg: 45 },
        { timestamp: '2026-08-28T14:30:00Z', lat: 25.885, lng: 55.315, sogKts: 12.3, cogDeg: 45, headingDeg: 45 },
      ],
      dataQuality: { completenessRating: 'GOOD', gapCount: 0, maxGapMinutes: 10, totalPoints: 4 },
    },
    {
      mmsi: 352001144,
      name: 'AL JABER 4',
      flag: 'Panama',
      flagCode: 'PA',
      vesselType: 'Tug / Supply',
      lengthM: 58,
      beamM: 14,
      draughtM: 4.5,
      destination: 'DUBAI OFFSHORE',
      track: [
        { timestamp: '2026-08-28T11:00:00Z', lat: 25.880, lng: 55.120, sogKts: 8.0, cogDeg: 120, headingDeg: 120 },
        { timestamp: '2026-08-28T13:00:00Z', lat: 25.820, lng: 55.220, sogKts: 7.8, cogDeg: 120, headingDeg: 120 },
      ],
      dataQuality: { completenessRating: 'MODERATE', gapCount: 0, maxGapMinutes: 25, totalPoints: 2 },
    },
  ];

  const attributionResults = rankAllVessels(aisVessels, drift);

  return {
    id: caseId,
    title: 'Persian Gulf Eastern Approach Slick',
    locationName: 'Persian Gulf, North of Sharjah',
    status: 'Attribution Complete',
    createdAt: '2026-08-28T14:30:00.000Z',
    updatedAt: '2026-08-28T15:00:00.000Z',
    observation,
    detection,
    metocean,
    drift,
    aisVessels,
    attributionResults,
    notes: 'Detected in Sentinel-1B pass. Slick exhibits moderate weathering in high water temperature (32.4°C).',
  };
}

class AquaSpillStorage {
  private cases: Map<string, SpillCase> = new Map();
  private datasets: DatasetItem[] = [];
  private reports: Map<string, MARPOLReportData> = new Map();

  constructor() {
    this.ensureDataDir();
    this.loadPersistedData();
  }

  private ensureDataDir() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
    } catch (_) {}
  }

  private loadPersistedData() {
    let loadedCases = false;

    // 1. Try loading cases from disk
    try {
      if (fs.existsSync(CASES_FILE)) {
        const raw = fs.readFileSync(CASES_FILE, 'utf-8');
        const list: SpillCase[] = JSON.parse(raw);
        if (Array.isArray(list) && list.length > 0) {
          list.forEach((c) => this.cases.set(c.id, c));
          loadedCases = true;
          console.log(`[AquaSpillStorage] Loaded ${list.length} persisted cases from disk.`);
        }
      }
    } catch (e) {
      console.warn('[AquaSpillStorage] Note reading cases.json:', e);
    }

    // 2. Fallback to seed cases if no cases exist
    if (!loadedCases) {
      this.seedInitialData();
      this.persistCasesToDisk();
    }

    // 3. Try loading reports from disk
    try {
      if (fs.existsSync(REPORTS_FILE)) {
        const raw = fs.readFileSync(REPORTS_FILE, 'utf-8');
        const list: MARPOLReportData[] = JSON.parse(raw);
        if (Array.isArray(list)) {
          list.forEach((r) => this.reports.set(r.caseId, r));
        }
      }
    } catch (e) {
      console.warn('[AquaSpillStorage] Note reading reports.json:', e);
    }

    this.initDatasets();
  }

  private persistCasesToDisk() {
    try {
      this.ensureDataDir();
      const list = Array.from(this.cases.values());
      fs.writeFileSync(CASES_FILE, JSON.stringify(list, null, 2), 'utf-8');
    } catch (e) {
      console.warn('[AquaSpillStorage] Failed saving cases.json:', e);
    }
  }

  private persistReportsToDisk() {
    try {
      this.ensureDataDir();
      const list = Array.from(this.reports.values());
      fs.writeFileSync(REPORTS_FILE, JSON.stringify(list, null, 2), 'utf-8');
    } catch (e) {
      console.warn('[AquaSpillStorage] Failed saving reports.json:', e);
    }
  }

  private seedInitialData() {
    const c1 = createSeedCase1();
    const c2 = createSeedCase2();
    this.cases.set(c1.id, c1);
    this.cases.set(c2.id, c2);
  }

  private initDatasets() {
    this.datasets = [
      {
        id: 'DS-001',
        name: 'Copernicus Sentinel-1 SAR GRD Feed',
        dataType: 'SAR Imagery',
        source: 'Copernicus Data Space Ecosystem (CDSE)',
        recordCount: 1420,
        coverage: 'Global Coastal & EEZ Waters (10m Res)',
        status: 'Ready',
        lastUpdate: '2026-08-29 22:30 UTC',
        apiStatus: 'Connected',
        isDemo: false,
      },
      {
        id: 'DS-002',
        name: 'Copernicus ERA5 Marine Atmosphere',
        dataType: 'Metocean Winds',
        source: 'ECMWF / Open-Meteo API',
        recordCount: 8640,
        coverage: 'Hourly 10m Wind & Surface Vectors',
        status: 'Ready',
        lastUpdate: '2026-08-29 22:40 UTC',
        apiStatus: 'Connected',
        isDemo: false,
      },
      {
        id: 'DS-003',
        name: 'CMEMS Global Ocean Physics 1/12°',
        dataType: 'CMEMS Currents',
        source: 'Copernicus Marine Environment Monitoring',
        recordCount: 5200,
        coverage: 'Surface U/V Currents & Wave Parameters',
        status: 'Ready',
        lastUpdate: '2026-08-29 22:15 UTC',
        apiStatus: 'Connected',
        isDemo: false,
      },
      {
        id: 'DS-004',
        name: 'Malacca Strait Live AIS Feed',
        dataType: 'AIS Traffic',
        source: 'Terrestrial + Satellite AIS Stream (NMEA 0183/JSON)',
        recordCount: 18450,
        coverage: 'TSS Corridor 01°30N - 03°30N',
        status: 'Ready',
        lastUpdate: '2026-08-29 22:45 UTC',
        apiStatus: 'Connected',
        isDemo: false,
      },
      {
        id: 'DS-005',
        name: 'Gulf of Oman & Persian Gulf AIS Sample',
        dataType: 'AIS Traffic',
        source: 'Historical Voyage Archive',
        recordCount: 9400,
        coverage: 'Strait of Hormuz & Anchorage Lanes',
        status: 'Ready',
        lastUpdate: '2026-08-28 16:00 UTC',
        apiStatus: 'Standby',
        isDemo: true,
      },
    ];
  }

  public getAllCases(): SpillCase[] {
    return Array.from(this.cases.values());
  }

  public getCase(id: string): SpillCase | undefined {
    return this.cases.get(id);
  }

  public saveCase(spillCase: SpillCase): SpillCase {
    spillCase.updatedAt = new Date().toISOString();
    this.cases.set(spillCase.id, spillCase);
    this.persistCasesToDisk();

    // Async sync to Supabase Postgres if configured
    if (isServerSupabaseConfigured() && supabaseServer) {
      this.syncCaseToSupabase(spillCase).catch((e) =>
        console.warn('[AquaSpillStorage] Supabase case sync warning:', e)
      );
    }

    return spillCase;
  }

  private async syncCaseToSupabase(c: SpillCase): Promise<void> {
    if (!supabaseServer) return;
    try {
      await (supabaseServer.from('analyses' as any) as any).upsert({
        id: c.id,
        status: c.status,
        updated_at: c.updatedAt,
      });
    } catch (_) {}
  }

  public deleteCase(id: string): boolean {
    const deleted = this.cases.delete(id);
    if (deleted) {
      this.persistCasesToDisk();
    }
    return deleted;
  }

  public getAllDatasets(): DatasetItem[] {
    return this.datasets;
  }

  public addDataset(item: DatasetItem): void {
    this.datasets.unshift(item);
  }

  public getReport(caseId: string): MARPOLReportData | undefined {
    return this.reports.get(caseId);
  }

  public saveReport(report: MARPOLReportData): void {
    this.reports.set(report.caseId, report);
    this.persistReportsToDisk();

    // Async sync to Supabase if configured
    if (isServerSupabaseConfigured() && supabaseServer) {
      (supabaseServer.from('reports' as any) as any)
        .upsert({
          analysis_id: report.caseId,
          report_type: 'MARPOL_ANNEX_I',
          title: `MARPOL Dossier ${report.reportReference}`,
          content: report as any,
        })
        .catch((e: any) => console.warn('[AquaSpillStorage] Supabase report sync warning:', e));
    }
  }
}

export const db = new AquaSpillStorage();
