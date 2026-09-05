/**
 * Aqua Spill - Image-Specific Synthetic AIS Demonstration Service
 * 
 * Generates calibrated, deterministic synthetic AIS vessel candidates dynamically keyed
 * to the active SAR Image ID or scene centroid.
 *
 * Rules:
 * - Exactly 4-5 candidate vessels per image.
 * - Always exactly ONE primary candidate classified as "PRIMARY SOURCE CANDIDATE" (score 82-95).
 * - 3-4 secondary candidates classified as "POTENTIAL SOURCE VESSEL" or "AIS-CORRELATED VESSEL".
 * - Deterministic: same Image ID always yields the exact same vessels, scores, and trajectories.
 * - Different Image IDs yield completely different vessels, names, MMSIs, courses, and scores.
 * - Synthetic disclaimer: Attribution is probabilistic and for demonstration only.
 */

import {
  AISVessel,
  AttributionResult,
  AttributionCategory,
  ConfidenceLevel,
  AISTrackPoint,
} from '../types';

export interface SyntheticAisResult {
  vessels: AISVessel[];
  attributionResults: AttributionResult[];
  primaryCandidate: AttributionResult;
  isSynthetic: boolean;
  disclaimer: string;
}

// Deterministic string hash
function stringToHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

// Pseudo-random generator seeded with a number
function pseudoRandom(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return function () {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const FIRST_NAMES = [
  'PACIFIC', 'NORDIC', 'ATLANTIC', 'OCEANIC', 'ORIENTAL', 'BALTIC', 'MARITIME',
  'GLOBAL', 'STAR', 'BLUE', 'GOLDEN', 'SILVER', 'CORAL', 'CAPITAL', 'EVER',
  'APL', 'MAERSK', 'COSCO', 'MSC', 'CMA CGM', 'HAPAG', 'ONE', 'VALE',
  'SEASPAN', 'BERGE', 'STOLT', 'EURONAV', 'FRONTLINE', 'TEEKAY', 'SCORPIO'
];

const LAST_NAMES = [
  'VOYAGER', 'PIONEER', 'HARMONY', 'LEADER', 'EXPLORER', 'CHALLENGER', 'FORTUNE',
  'ENTERPRISE', 'NAVIGATOR', 'RESOLUTE', 'ENDEAVOUR', 'MERCHANT', 'GLORY',
  'HORIZON', 'TRADER', 'CARRIER', 'PROSPERITY', 'SOVEREIGN', 'INTEGRITY',
  'CENTURY', 'PRIDE', 'VALOUR', 'PROGRESS', 'BREEZE', 'DYNAMIC', 'TITAN'
];

const SHIP_TYPES: Array<'Crude Oil Tanker' | 'Chemical Tanker' | 'Bulk Carrier' | 'Container Ship' | 'General Cargo'> = [
  'Crude Oil Tanker',
  'Chemical Tanker',
  'Bulk Carrier',
  'Container Ship',
  'General Cargo',
];

const FLAGS: Array<{ flag: string; flagCode: string }> = [
  { flag: 'Panama', flagCode: 'PA' },
  { flag: 'Liberia', flagCode: 'LR' },
  { flag: 'Marshall Islands', flagCode: 'MH' },
  { flag: 'Singapore', flagCode: 'SG' },
  { flag: 'Malta', flagCode: 'MT' },
  { flag: 'Bahamas', flagCode: 'BS' },
  { flag: 'Cyprus', flagCode: 'CY' },
  { flag: 'Hong Kong', flagCode: 'HK' },
  { flag: 'Greece', flagCode: 'GR' },
  { flag: 'Norway', flagCode: 'NO' },
];

export function generateImageSpecificSyntheticAis(options: {
  imageId: string;
  centroid: { lat: number; lng: number };
  imageTimestamp?: string;
}): SyntheticAisResult {
  const { imageId, centroid, imageTimestamp } = options;
  const hash = stringToHash(imageId || 'SAR_DEFAULT_SCENE');
  const rng = pseudoRandom(hash);

  const baseTime = imageTimestamp ? new Date(imageTimestamp).getTime() : Date.now();
  const vesselCount = 4 + Math.floor(rng() * 2); // 4 to 5 vessels

  const vessels: AISVessel[] = [];
  const attributionResults: AttributionResult[] = [];

  const usedMmsi = new Set<number>();

  for (let i = 0; i < vesselCount; i++) {
    const isPrimary = (i === 0);

    // Generate unique MMSI starting with 2..6
    let mmsi = 200000000 + Math.floor(rng() * 490000000);
    while (usedMmsi.has(mmsi)) {
      mmsi++;
    }
    usedMmsi.add(mmsi);

    const firstName = FIRST_NAMES[Math.floor(rng() * FIRST_NAMES.length)];
    const lastName = LAST_NAMES[Math.floor(rng() * LAST_NAMES.length)];
    const vesselName = `${firstName} ${lastName}`;

    const vesselType = isPrimary
      ? (rng() > 0.35 ? 'Crude Oil Tanker' : 'Chemical Tanker')
      : SHIP_TYPES[Math.floor(rng() * SHIP_TYPES.length)];

    const flagEntry = FLAGS[Math.floor(rng() * FLAGS.length)];
    const speedKnots = +(10 + rng() * 6).toFixed(1);
    const courseDeg = Math.round(rng() * 360);

    // Vessel position relative to spill centroid
    let cpaDistanceKm: number;
    let timeDiffMins: number;
    let attributionScore: number;
    let category: AttributionCategory;
    let confidenceLevel: ConfidenceLevel;

    if (isPrimary) {
      cpaDistanceKm = +(0.3 + rng() * 1.5).toFixed(2);
      timeDiffMins = Math.round(8 + rng() * 35);
      attributionScore = Math.round(82 + rng() * 13); // 82 to 95
      category = 'PRIMARY SOURCE CANDIDATE';
      confidenceLevel = 'HIGH';
    } else if (i === 1) {
      cpaDistanceKm = +(2.0 + rng() * 3.5).toFixed(2);
      timeDiffMins = Math.round(45 + rng() * 60);
      attributionScore = Math.round(60 + rng() * 15); // 60 to 75
      category = 'POTENTIAL SOURCE VESSEL';
      confidenceLevel = 'MEDIUM';
    } else if (i === 2) {
      cpaDistanceKm = +(4.0 + rng() * 5.0).toFixed(2);
      timeDiffMins = Math.round(75 + rng() * 90);
      attributionScore = Math.round(42 + rng() * 18); // 42 to 60
      category = 'POTENTIAL SOURCE VESSEL';
      confidenceLevel = 'MEDIUM';
    } else {
      cpaDistanceKm = +(8.0 + rng() * 8.0).toFixed(2);
      timeDiffMins = Math.round(110 + rng() * 120);
      attributionScore = Math.round(25 + rng() * 20); // 25 to 45
      category = 'AIS-CORRELATED VESSEL';
      confidenceLevel = 'LOW';
    }

    // Offset in coordinates roughly matching CPA distance
    const latOffset = ((rng() - 0.5) * 2 * (cpaDistanceKm / 111));
    const lngOffset = ((rng() - 0.5) * 2 * (cpaDistanceKm / (111 * Math.cos(centroid.lat * Math.PI / 180))));
    const vesselLat = +(centroid.lat + latOffset).toFixed(5);
    const vesselLng = +(centroid.lng + lngOffset).toFixed(5);

    // Build realistic AISTrackPoint[] points leading up to and past CPA
    const courseRad = (courseDeg * Math.PI) / 180;
    const dx = Math.sin(courseRad) * 0.008;
    const dy = Math.cos(courseRad) * 0.008;
    const passageTimestamp = new Date(baseTime - timeDiffMins * 60 * 1000).toISOString();

    const track: AISTrackPoint[] = [];
    for (let step = -5; step <= 5; step++) {
      const pointTime = new Date(baseTime - (timeDiffMins - step * 10) * 60 * 1000).toISOString();
      track.push({
        timestamp: pointTime,
        lat: +(vesselLat + step * dy + (rng() - 0.5) * 0.0005).toFixed(5),
        lng: +(vesselLng + step * dx + (rng() - 0.5) * 0.0005).toFixed(5),
        sogKts: speedKnots,
        cogDeg: courseDeg,
        headingDeg: courseDeg,
        navStatus: 'Under way using engine',
        distanceToOriginKm: +(Math.abs(step * 1.5) + cpaDistanceKm).toFixed(2),
      });
    }

    const vessel: AISVessel = {
      mmsi,
      imo: 9000000 + Math.floor(rng() * 999999),
      name: vesselName,
      callsign: `${String.fromCharCode(65 + Math.floor(rng() * 26))}${String.fromCharCode(65 + Math.floor(rng() * 26))}${Math.floor(1000 + rng() * 8999)}`,
      flag: flagEntry.flag,
      flagCode: flagEntry.flagCode,
      vesselType,
      lengthM: Math.round(180 + rng() * 150),
      beamM: Math.round(28 + rng() * 22),
      draughtM: +(8.5 + rng() * 6).toFixed(1),
      destination: isPrimary ? 'SINGAPORE ANCHORAGE' : 'PORT KLANG',
      eta: new Date(baseTime + 36 * 3600 * 1000).toISOString(),
      track,
      dataQuality: {
        completenessRating: isPrimary ? 'EXCELLENT' : 'GOOD',
        gapCount: isPrimary ? 0 : 1,
        maxGapMinutes: isPrimary ? 3 : 15,
        totalPoints: track.length,
      },
    };

    vessels.push(vessel);

    attributionResults.push({
      mmsi,
      vesselName,
      vesselType,
      flag: flagEntry.flag,
      flagCode: flagEntry.flagCode,
      category,
      attributionScore,
      confidenceLevel,
      subScores: {
        spatialProximity: isPrimary ? 95 : Math.max(20, Math.round(100 - cpaDistanceKm * 7)),
        temporalCorrelation: isPrimary ? 90 : Math.max(15, Math.round(100 - timeDiffMins * 0.6)),
        trajectoryAlignment: isPrimary ? 88 : Math.round(35 + rng() * 45),
        originCorridorOverlap: isPrimary ? 92 : Math.round(25 + rng() * 55),
        speedConsistency: Math.round(85 + rng() * 12),
        courseConsistency: Math.round(85 + rng() * 10),
        behavioralAnomaly: isPrimary ? 80 : 30,
        aisDataQuality: 95,
      },
      cpa: {
        mmsi,
        vesselName,
        cpaDistanceKm,
        cpaTime: passageTimestamp,
        timeDifferenceMinutes: timeDiffMins,
        vesselPositionAtCPA: { lat: vesselLat, lng: vesselLng },
        slickPositionAtCPA: centroid,
        vesselSpeedAtCPA: speedKnots,
        vesselCourseAtCPA: courseDeg,
        insideOriginCorridor: isPrimary || cpaDistanceKm < 3.0,
        trajectoryAlignmentScore: isPrimary ? 92 : Math.round(35 + rng() * 50),
      },
      behaviorIndicators: isPrimary
        ? [
            {
              type: 'NORMAL',
              severity: 'INFO',
              description: 'Consistent transit speed along corridor at closest point of approach.',
              timestamp: passageTimestamp,
            },
          ]
        : [],
      evidenceList: isPrimary
        ? [
            `Closest point of approach: ${cpaDistanceKm} km at ${passageTimestamp}`,
            `Course intersects backwards drift trajectory within ${timeDiffMins} minutes of estimated release`,
            `Vessel class (${vesselType}) carries persistent oil/hydrocarbon cargo`,
          ]
        : [
            `Passage within ${cpaDistanceKm} km of reconstructed centroid`,
          ],
      counterEvidenceList: isPrimary
        ? []
        : [
            `Temporal delta of ${timeDiffMins}m indicates vessel cleared zone well outside primary release window`,
          ],
      disclaimer: 'Synthetic AIS Demonstration Data. Attribution is probabilistic and for demonstration only.',
    });
  }

  // Sort attributionResults by score descending
  attributionResults.sort((a, b) => b.attributionScore - a.attributionScore);

  return {
    vessels,
    attributionResults,
    primaryCandidate: attributionResults[0],
    isSynthetic: true,
    disclaimer: 'Synthetic AIS Demonstration Data. Attribution is probabilistic and for demonstration only.',
  };
}
