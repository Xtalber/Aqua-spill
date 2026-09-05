/**
 * Synthetic AIS Demonstration Data Generator
 * Generates 4-5 unique synthetic AIS vessel records for each DARTIS SAR Image ID
 * Ensures exactly one vessel per Image ID is classified as "PRIMARY SOURCE CANDIDATE"
 */

import fs from 'fs';
import path from 'path';

const INDEX_FILE = path.join(process.cwd(), 'data', 'master_dataset', 'dartis_master_index.json');
const OUTPUT_FILE = path.join(process.cwd(), 'data', 'syntheticAISData.json');

// Rich pools of realistic maritime data
const VESSEL_PREFIXES = [
  'OCEAN', 'PACIFIC', 'ATLANTIC', 'AEGEAN', 'MEDITERRANEAN', 'NORDIC',
  'BALTIC', 'HELLAS', 'CORAL', 'ATLAS', 'OLYMPIC', 'POSEIDON',
  'GLOBAL', 'GOLDEN', 'AQUARIUS', 'NEPTUNE', 'MERIDIAN', 'PEGASUS',
  'ORION', 'ARCTIC', 'TITAN', 'AURORA', 'SEA', 'BLUE', 'MARINE',
  'SILVER', 'CRYSTAL', 'DIAMOND', 'CAPITAL', 'STELLAR', 'HERCULES',
  'NAVI', 'COSMIC', 'APOLLO', 'ZEUS', 'HERMES', 'MARITIME', 'LIBERTY',
  'HORIZON', 'VENTURE', 'PIONEER', 'TRADER', 'VOYAGER', 'LEADER'
];

const VESSEL_SUFFIXES = [
  'TRADER', 'VOYAGER', 'LEADER', 'STAR', 'HARMONY', 'GLORY',
  'PIONEER', 'SPIRIT', 'COURAGE', 'HORIZON', 'VENTURE', 'EXPRESS',
  'CHIEF', 'PHOENIX', 'NAVIGATOR', 'SUN', 'JEWEL', 'MARINER',
  'PRIDE', 'VALOUR', 'PROGRESS', 'BREEZE', 'KNIGHT', 'TITAN',
  'PATHFINDER', 'EXPLORER', 'EMPEROR', 'SOVEREIGN', 'COMMANDER', 'WARRIOR'
];

const COUNTRIES = [
  { country: 'Greece', flagCode: 'GR', mid: '240' },
  { country: 'Panama', flagCode: 'PA', mid: '355' },
  { country: 'Marshall Islands', flagCode: 'MH', mid: '538' },
  { country: 'Liberia', flagCode: 'LR', mid: '636' },
  { country: 'Malta', flagCode: 'MT', mid: '215' },
  { country: 'Cyprus', flagCode: 'CY', mid: '209' },
  { country: 'Singapore', flagCode: 'SG', mid: '563' },
  { country: 'Bahamas', flagCode: 'BS', mid: '311' },
  { country: 'Norway', flagCode: 'NO', mid: '257' },
  { country: 'Denmark', flagCode: 'DK', mid: '219' },
  { country: 'Italy', flagCode: 'IT', mid: '247' },
  { country: 'Netherlands', flagCode: 'NL', mid: '244' },
];

const PRIMARY_TYPES = [
  'Crude Oil Tanker',
  'Product Tanker',
  'Chemical Tanker',
  'Oil/Chemical Tanker',
  'LPG Tanker',
];

const SECONDARY_TYPES = [
  'Bulk Carrier',
  'Container Ship',
  'General Cargo',
  'Product Tanker',
  'Chemical Tanker',
  'Tug / Supply',
  'Vehicle Carrier',
];

const DESTINATIONS = [
  'TRIESTE', 'ROTTERDAM', 'PIRAEUS', 'GENOA', 'SUEZ', 'BARCELONA',
  'VALENCIA', 'MARSEILLE', 'ALEXANDRIA', 'MALTA OPL', 'AUGUSTA',
  'TARRAGONA', 'FOS SUR MER', 'ALIAGA', 'PORT SAID', 'LIMASSOL'
];

// Simple deterministic hash function for strings
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

// Deterministic pseudo-random number generator
function createRng(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function generateVesselsForImage(imageId, oilPresent = true) {
  const seed = hashString(imageId);
  const rand = createRng(seed);

  // 4 or 5 vessels
  const vesselCount = 4 + Math.floor(rand() * 2); // 4 or 5
  const vessels = [];

  // Used names set to prevent duplicate vessel names within the same image
  const usedNames = new Set();

  for (let i = 0; i < vesselCount; i++) {
    // Generate unique name
    let vName = '';
    let attempts = 0;
    while (attempts < 20) {
      attempts++;
      const pIdx = Math.floor(rand() * VESSEL_PREFIXES.length);
      const sIdx = Math.floor(rand() * VESSEL_SUFFIXES.length);
      vName = `${VESSEL_PREFIXES[pIdx]} ${VESSEL_SUFFIXES[sIdx]}`;
      if (!usedNames.has(vName)) break;
    }
    usedNames.add(vName);

    const cIdx = Math.floor(rand() * COUNTRIES.length);
    const countryObj = COUNTRIES[cIdx];

    // Generate unique MMSI with proper country MID
    const suffixNum = Math.floor(100000 + rand() * 900000);
    const mmsiNum = parseInt(`${countryObj.mid}${suffixNum}`, 10);
    const imoNum = 9000000 + Math.floor(rand() * 999999);

    const isPrimary = (i === 0);

    let classification = '';
    let candidateScore = 0;
    let closestApproachKm = 0;
    let vesselType = '';

    if (isPrimary) {
      classification = 'PRIMARY SOURCE CANDIDATE';
      // Primary score between 86 and 96
      candidateScore = Math.floor(86 + rand() * 11);
      // Closest approach between 0.8 and 2.4 km
      closestApproachKm = parseFloat((0.8 + rand() * 1.6).toFixed(1));
      vesselType = PRIMARY_TYPES[Math.floor(rand() * PRIMARY_TYPES.length)];
    } else if (i === 1) {
      classification = 'POTENTIAL SOURCE VESSEL';
      // Score between 64 and 76
      candidateScore = Math.floor(64 + rand() * 13);
      closestApproachKm = parseFloat((3.2 + rand() * 2.8).toFixed(1));
      vesselType = SECONDARY_TYPES[Math.floor(rand() * SECONDARY_TYPES.length)];
    } else if (i === 2) {
      classification = 'AIS-CORRELATED VESSEL';
      // Score between 48 and 60
      candidateScore = Math.floor(48 + rand() * 13);
      closestApproachKm = parseFloat((6.2 + rand() * 3.4).toFixed(1));
      vesselType = SECONDARY_TYPES[Math.floor(rand() * SECONDARY_TYPES.length)];
    } else if (i === 3) {
      classification = 'LOW-CORRELATION VESSEL';
      // Score between 30 and 44
      candidateScore = Math.floor(30 + rand() * 15);
      closestApproachKm = parseFloat((9.5 + rand() * 4.5).toFixed(1));
      vesselType = SECONDARY_TYPES[Math.floor(rand() * SECONDARY_TYPES.length)];
    } else {
      classification = 'INSUFFICIENT EVIDENCE';
      // Score between 16 and 28
      candidateScore = Math.floor(16 + rand() * 13);
      closestApproachKm = parseFloat((14.0 + rand() * 8.0).toFixed(1));
      vesselType = SECONDARY_TYPES[Math.floor(rand() * SECONDARY_TYPES.length)];
    }

    const timeDifferenceMinutes = isPrimary
      ? Math.floor(12 + rand() * 35)
      : Math.floor(45 + rand() * 160);

    const speedKts = parseFloat((10.5 + rand() * 5.5).toFixed(1));
    const courseDeg = Math.floor(rand() * 360);
    const lengthM = isPrimary ? Math.floor(220 + rand() * 80) : Math.floor(140 + rand() * 120);
    const beamM = Math.floor(lengthM / 6 + rand() * 6);
    const draughtM = parseFloat((8.0 + rand() * 7.5).toFixed(1));
    const dest = DESTINATIONS[Math.floor(rand() * DESTINATIONS.length)];

    vessels.push({
      vesselName: vName,
      country: countryObj.country,
      flagCode: countryObj.flagCode,
      mmsi: mmsiNum,
      imo: imoNum,
      vesselType,
      closestApproach: `${closestApproachKm} km`,
      closestApproachKm,
      classification,
      primarySourceCandidate: isPrimary,
      candidateScore,
      speedKts,
      courseDeg,
      timeDifferenceMinutes,
      lengthM,
      beamM,
      draughtM,
      destination: dest,
    });
  }

  return vessels;
}

function run() {
  console.log('Reading DARTIS index from:', INDEX_FILE);
  if (!fs.existsSync(INDEX_FILE)) {
    console.error('DARTIS index not found at', INDEX_FILE);
    process.exit(1);
  }

  const rawData = fs.readFileSync(INDEX_FILE, 'utf-8');
  const indexData = JSON.parse(rawData);
  const images = indexData.images || [];

  console.log(`Found ${images.length} images in DARTIS master index.`);

  const syntheticData = {};

  let count = 0;
  for (const img of images) {
    const patchId = img.patchId; // e.g. "oc-0001", "nc-0001-00-000001"
    const normalized = img.normalizedFileName || patchId;
    const vessels = generateVesselsForImage(normalized, img.oilPresent);

    const record = {
      imageId: normalized,
      patchId: patchId,
      fileName: img.fileName,
      disclaimer: 'Synthetic AIS Demonstration Data. Attribution is probabilistic and for demonstration only.',
      vessels,
    };

    // Store by normalized key
    syntheticData[normalized] = record;
    // Also store by patchId if different
    if (patchId && patchId !== normalized) {
      syntheticData[patchId] = record;
    }
    // Also store by uppercase and DARTIS- prefix format
    const upperKey = normalized.toUpperCase();
    if (upperKey !== normalized) {
      syntheticData[upperKey] = record;
    }
    syntheticData[`DARTIS-${upperKey}`] = record;

    count++;
  }

  // Also pre-populate sample general test IDs mentioned in prompt like DARTIS_2019_0001
  const testIds = ['DARTIS_2019_0001', 'DARTIS_2019_0002', 'DARTIS_2019_0003', 'DARTIS_2019_0004', 'DARTIS_2019_0005'];
  for (const tid of testIds) {
    if (!syntheticData[tid]) {
      syntheticData[tid] = {
        imageId: tid,
        patchId: tid,
        fileName: `${tid}.jpg`,
        disclaimer: 'Synthetic AIS Demonstration Data. Attribution is probabilistic and for demonstration only.',
        vessels: generateVesselsForImage(tid, true),
      };
    }
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(syntheticData, null, 2), 'utf-8');
  const stat = fs.statSync(OUTPUT_FILE);
  console.log(`Successfully generated synthetic AIS dataset with ${count} DARTIS scenes.`);
  console.log(`Output file: ${OUTPUT_FILE} (${(stat.size / (1024 * 1024)).toFixed(2)} MB)`);
}

run();
