/**
 * Aqua Spill - Synthetic AIS Demonstration Service
 * Loads pre-generated synthetic AIS data for all DARTIS SAR images
 * Generates 4-5 unique synthetic vessels per Image ID
 * Ensures exactly ONE vessel is classified as "PRIMARY SOURCE CANDIDATE"
 * Deterministic fallback for custom uploaded images
 */

import fs from 'fs';
import path from 'path';
import {
  AISVessel,
  AISTrackPoint,
  VesselAttributionScore,
  AttributionCategory,
  ConfidenceLevel,
  GeoCoordinate,
  CurrentCaseVesselDistancePoint,
} from '../../src/types.js';

export interface SyntheticVesselRecord {
  vesselName: string;
  country: string;
  flagCode: string;
  mmsi: number;
  imo: number;
  vesselType: string;
  closestApproach: string;
  closestApproachKm: number;
  classification: string;
  primarySourceCandidate: boolean;
  candidateScore: number;
  speedKts: number;
  courseDeg: number;
  timeDifferenceMinutes: number;
  lengthM: number;
  beamM: number;
  draughtM: number;
  destination: string;
}

export interface SyntheticAisDatasetEntry {
  imageId: string;
  patchId: string;
  fileName: string;
  disclaimer: string;
  vessels: SyntheticVesselRecord[];
}

const DATA_FILE = path.join(process.cwd(), 'data', 'syntheticAISData.json');

// In-memory cache
let syntheticCache: Record<string, SyntheticAisDatasetEntry> | null = null;

function loadSyntheticData(): Record<string, SyntheticAisDatasetEntry> {
  if (syntheticCache) return syntheticCache;

  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      syntheticCache = JSON.parse(raw);
      console.log(`[SyntheticAIS] Loaded synthetic AIS dataset from ${DATA_FILE}`);
      return syntheticCache || {};
    }
  } catch (err) {
    console.error('[SyntheticAIS] Error loading syntheticAISData.json:', err);
  }

  syntheticCache = {};
  return syntheticCache;
}

/**
 * Normalizes any image identifier, filename, or query string
 * e.g. "oc-0001.jpg" -> "oc-0001", "DARTIS-OC-0001" -> "oc-0001"
 */
export function normalizeImageId(query: string): string {
  if (!query) return 'oc-0001';
  let norm = path.basename(query).toLowerCase();
  norm = norm.replace(/\.(jpg|jpeg|png|tif|tiff|bmp)$/i, '').trim();
  if (norm.startsWith('dartis-')) {
    norm = norm.replace(/^dartis-/, '');
  }
  if (norm.startsWith('dartis_')) {
    norm = norm.replace(/^dartis_/, '');
  }
  return norm;
}

// Deterministic hash for custom IDs
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function createRng(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const FALLBACK_NAMES = [
  'OCEAN TRADER', 'PACIFIC VOYAGER', 'HELLAS WARRIOR', 'NORDIC GLORY',
  'AEGEAN HARMONY', 'BALTIC MARINER', 'MEDITERRANEAN LEADER', 'CORAL STAR',
  'SEA HORIZON', 'ATLAS SPIRIT', 'OLYMPIC PHOENIX', 'POSEIDON LEADER',
  'LIBERTY PIONEER', 'GLOBAL COURAGE', 'GOLDEN ODYSSEY', 'AQUARIUS EXPRESS',
  'NEPTUNE CHIEF', 'MERIDIAN GLORY', 'PEGASUS VOYAGER', 'ORION TANKER',
  'AURORA BREEZE', 'MERIDIAN WARRIOR', 'OLYMPIC PIONEER', 'MEDITERRANEAN PHOENIX',
  'VOYAGER BREEZE', 'BLUE HORIZON', 'SEA VENTURE', 'MARINE STAR'
];

const FALLBACK_COUNTRIES = [
  { country: 'Greece', flagCode: 'GR', mid: '240' },
  { country: 'Panama', flagCode: 'PA', mid: '355' },
  { country: 'Marshall Islands', flagCode: 'MH', mid: '538' },
  { country: 'Liberia', flagCode: 'LR', mid: '636' },
  { country: 'Malta', flagCode: 'MT', mid: '215' },
  { country: 'Cyprus', flagCode: 'CY', mid: '209' },
  { country: 'Singapore', flagCode: 'SG', mid: '563' },
  { country: 'Bahamas', flagCode: 'BS', mid: '311' },
];

/**
 * Generate synthetic vessels on the fly if an image ID is not in the JSON file
 */
export function generateSyntheticVesselsForId(imageId: string): SyntheticVesselRecord[] {
  const seed = hashString(imageId);
  const rand = createRng(seed);

  const count = 4 + Math.floor(rand() * 2); // 4 or 5
  const vessels: SyntheticVesselRecord[] = [];
  const usedNames = new Set<string>();

  for (let i = 0; i < count; i++) {
    let name = '';
    let attempts = 0;
    while (attempts < 20) {
      attempts++;
      name = FALLBACK_NAMES[Math.floor(rand() * FALLBACK_NAMES.length)];
      if (!usedNames.has(name)) break;
    }
    usedNames.add(name);

    const countryObj = FALLBACK_COUNTRIES[Math.floor(rand() * FALLBACK_COUNTRIES.length)];
    const mmsi = parseInt(`${countryObj.mid}${Math.floor(100000 + rand() * 900000)}`, 10);
    const imo = 9000000 + Math.floor(rand() * 999999);

    const isPrimary = (i === 0);
    let classification = '';
    let candidateScore = 0;
    let closestApproachKm = 0;
    let vesselType = '';

    if (isPrimary) {
      classification = 'PRIMARY SOURCE CANDIDATE';
      candidateScore = Math.floor(86 + rand() * 11);
      closestApproachKm = parseFloat((0.8 + rand() * 1.6).toFixed(1));
      vesselType = 'Crude Oil Tanker';
    } else if (i === 1) {
      classification = 'POTENTIAL SOURCE VESSEL';
      candidateScore = Math.floor(64 + rand() * 13);
      closestApproachKm = parseFloat((3.2 + rand() * 2.8).toFixed(1));
      vesselType = 'Container Ship';
    } else if (i === 2) {
      classification = 'AIS-CORRELATED VESSEL';
      candidateScore = Math.floor(48 + rand() * 13);
      closestApproachKm = parseFloat((6.2 + rand() * 3.4).toFixed(1));
      vesselType = 'Bulk Carrier';
    } else if (i === 3) {
      classification = 'LOW-CORRELATION VESSEL';
      candidateScore = Math.floor(30 + rand() * 15);
      closestApproachKm = parseFloat((9.5 + rand() * 4.5).toFixed(1));
      vesselType = 'Product Tanker';
    } else {
      classification = 'INSUFFICIENT EVIDENCE';
      candidateScore = Math.floor(16 + rand() * 13);
      closestApproachKm = parseFloat((14.0 + rand() * 8.0).toFixed(1));
      vesselType = 'General Cargo';
    }

    vessels.push({
      vesselName: name,
      country: countryObj.country,
      flagCode: countryObj.flagCode,
      mmsi,
      imo,
      vesselType,
      closestApproach: `${closestApproachKm} km`,
      closestApproachKm,
      classification,
      primarySourceCandidate: isPrimary,
      candidateScore,
      speedKts: parseFloat((10.5 + rand() * 5.5).toFixed(1)),
      courseDeg: Math.floor(rand() * 360),
      timeDifferenceMinutes: isPrimary ? Math.floor(15 + rand() * 30) : Math.floor(50 + rand() * 120),
      lengthM: isPrimary ? 260 : 180,
      beamM: isPrimary ? 44 : 32,
      draughtM: isPrimary ? 14.5 : 10.2,
      destination: 'ROTTERDAM',
    });
  }

  return vessels;
}

/**
 * Retrieve synthetic vessels for a given image identifier
 */
export function getSyntheticVesselsForImage(identifier: string): SyntheticVesselRecord[] {
  const store = loadSyntheticData();
  const norm = normalizeImageId(identifier);

  // Try direct lookup
  if (store[identifier]?.vessels) {
    return store[identifier].vessels;
  }
  if (store[norm]?.vessels) {
    return store[norm].vessels;
  }

  // Try uppercase or prefixed
  const upper = norm.toUpperCase();
  if (store[upper]?.vessels) {
    return store[upper].vessels;
  }
  if (store[`DARTIS-${upper}`]?.vessels) {
    return store[`DARTIS-${upper}`].vessels;
  }

  // Fallback: deterministic on-the-fly generation
  return generateSyntheticVesselsForId(identifier);
}

/**
 * Hydrates full domain models (AISVessel[], VesselAttributionScore[], time series)
 * for integration into SpillCase and CurrentCase.
 */
export function buildAttributionDataForImage(
  identifier: string,
  center: GeoCoordinate,
  obsDate: Date,
  probableOrigin: { position: GeoCoordinate; uncertaintyKm: number }
): {
  candidateVessels: AISVessel[];
  attributionScores: VesselAttributionScore[];
  vesselDistanceTimeSeries: {
    mmsi: number;
    vesselName: string;
    cpaPoint: { distanceKm: number; time: string };
    releaseWindow: { start: string; end: string };
    timeSeries: CurrentCaseVesselDistancePoint[];
  };
} {
  const syntheticRecords = getSyntheticVesselsForImage(identifier);
  const candidateVessels: AISVessel[] = [];
  const attributionScores: VesselAttributionScore[] = [];

  let topTimeSeries: any = null;

  syntheticRecords.forEach((rec, idx) => {
    const vTracks: AISTrackPoint[] = [];
    const distSeries: CurrentCaseVesselDistancePoint[] = [];

    // Course in radians for trajectory simulation
    const courseRad = (rec.courseDeg * Math.PI) / 180;
    const dx = Math.sin(courseRad) * 0.008;
    const dy = Math.cos(courseRad) * 0.008;

    for (let h = -24; h <= 12; h += 2) {
      const ptTime = new Date(obsDate.getTime() + h * 3600 * 1000).toISOString();
      const distKm = parseFloat(
        Math.sqrt(
          Math.pow(rec.closestApproachKm, 2) + Math.pow(h * (rec.speedKts * 1.852) * 0.8, 2)
        ).toFixed(2)
      );
      const inside = distKm <= probableOrigin.uncertaintyKm * 2;

      distSeries.push({
        time: ptTime,
        distanceKm: distKm,
        insideCorridor: inside,
      });

      vTracks.push({
        timestamp: ptTime,
        lat: center.lat + h * dy + (idx * 0.015),
        lng: center.lng + h * dx + (idx * 0.015),
        sogKts: rec.speedKts,
        cogDeg: rec.courseDeg,
        headingDeg: rec.courseDeg,
        distanceToOriginKm: distKm,
      });
    }

    const candidateVessel: AISVessel = {
      mmsi: rec.mmsi,
      imo: rec.imo,
      name: rec.vesselName,
      callsign: `SV${rec.mmsi.toString().slice(-4)}`,
      flag: rec.country,
      flagCode: rec.flagCode,
      vesselType: rec.vesselType as any,
      lengthM: rec.lengthM,
      beamM: rec.beamM,
      draughtM: rec.draughtM,
      destination: rec.destination,
      eta: new Date(obsDate.getTime() + 18 * 3600 * 1000).toISOString(),
      track: vTracks,
      dataQuality: {
        completenessRating: 'EXCELLENT',
        gapCount: 0,
        maxGapMinutes: 12,
        totalPoints: vTracks.length,
      },
    };

    candidateVessels.push(candidateVessel);

    const isPrimary = rec.primarySourceCandidate || idx === 0;

    const attrScore: VesselAttributionScore = {
      mmsi: rec.mmsi,
      vesselName: rec.vesselName,
      imo: rec.imo,
      vesselType: rec.vesselType,
      flag: rec.country,
      flagCode: rec.flagCode,
      category: rec.classification as AttributionCategory,
      attributionScore: rec.candidateScore,
      confidenceLevel: (isPrimary ? 'HIGH' : rec.candidateScore > 50 ? 'MEDIUM' : 'LOW') as ConfidenceLevel,
      subScores: {
        spatialProximity: Math.round(Math.max(10, 95 - rec.closestApproachKm * 5)),
        temporalCorrelation: Math.round(Math.max(10, 90 - rec.timeDifferenceMinutes * 0.4)),
        trajectoryAlignment: isPrimary ? 89 : Math.round(40 + (rec.candidateScore * 0.4)),
        originCorridorOverlap: isPrimary ? 92 : Math.round(30 + (rec.candidateScore * 0.4)),
        speedConsistency: isPrimary ? 91 : 78,
        courseConsistency: isPrimary ? 86 : 74,
        behavioralAnomaly: isPrimary ? 78 : 35,
        aisDataQuality: 95,
      },
      cpa: {
        mmsi: rec.mmsi,
        vesselName: rec.vesselName,
        cpaDistanceKm: rec.closestApproachKm,
        cpaTime: new Date(obsDate.getTime() - rec.timeDifferenceMinutes * 60 * 1000).toISOString(),
        timeDifferenceMinutes: rec.timeDifferenceMinutes,
        vesselPositionAtCPA: {
          lat: center.lat - (idx * 0.008),
          lng: center.lng - (idx * 0.008),
        },
        slickPositionAtCPA: probableOrigin.position,
        vesselSpeedAtCPA: rec.speedKts,
        vesselCourseAtCPA: rec.courseDeg,
        insideOriginCorridor: isPrimary,
        trajectoryAlignmentScore: isPrimary ? 91 : 55,
      },
      behaviorIndicators: isPrimary
        ? [
            {
              type: 'SPEED_REDUCTION',
              severity: 'WARNING',
              description: `Observed speed reduction from 14.2 to ${rec.speedKts} kts near the reconstructed origin area.`,
              timestamp: new Date(obsDate.getTime() - 40 * 60 * 1000).toISOString(),
            },
            {
              type: 'COURSE_ALTERATION',
              severity: 'INFO',
              description: 'Minor heading alteration consistent with hydrodynamic drift vector.',
              timestamp: new Date(obsDate.getTime() - 25 * 60 * 1000).toISOString(),
            },
          ]
        : [
            {
              type: 'NORMAL',
              severity: 'INFO',
              description: 'Steady transit speed and course maintained through the maritime corridor.',
              timestamp: obsDate.toISOString(),
            },
          ],
      evidenceList: [
        `Closest Point of Approach (CPA) of ${rec.closestApproachKm} km at T-${rec.timeDifferenceMinutes}m before SAR acquisition.`,
        isPrimary
          ? `Vessel track intersects the Lagrangian drift origin corridor (±${probableOrigin.uncertaintyKm} km).`
          : `Passing vessel at ${rec.closestApproachKm} km outside primary corridor.`,
        `Vessel type '${rec.vesselType}' documented in regional AIS transponder registers.`,
      ],
      counterEvidenceList: [
        'Demonstration data: Derived from synthetic AIS simulation linked to Image ID.',
        'No direct optical corroboration of oil discharge at moment of transit.',
      ],
      disclaimer: 'Synthetic AIS Demonstration Data. Attribution is probabilistic and for demonstration only.',
    };

    attributionScores.push(attrScore);

    if (isPrimary && !topTimeSeries) {
      topTimeSeries = {
        mmsi: rec.mmsi,
        vesselName: rec.vesselName,
        cpaPoint: {
          distanceKm: rec.closestApproachKm,
          time: new Date(obsDate.getTime() - rec.timeDifferenceMinutes * 60 * 1000).toISOString(),
        },
        releaseWindow: {
          start: new Date(obsDate.getTime() - (rec.timeDifferenceMinutes + 30) * 60 * 1000).toISOString(),
          end: new Date(obsDate.getTime() - Math.max(0, rec.timeDifferenceMinutes - 30) * 60 * 1000).toISOString(),
        },
        timeSeries: distSeries,
      };
    }
  });

  return {
    candidateVessels,
    attributionScores,
    vesselDistanceTimeSeries: topTimeSeries || {
      mmsi: 0,
      vesselName: 'No Vessel',
      cpaPoint: { distanceKm: 0, time: obsDate.toISOString() },
      releaseWindow: { start: obsDate.toISOString(), end: obsDate.toISOString() },
      timeSeries: [],
    },
  };
}
