/**
 * Transparent Probabilistic AIS Attribution Scoring Engine
 * Evaluates spatial, temporal, kinematic, and behavioral correlation.
 * Strictly adheres to scientific & MARPOL forensic terminology.
 */

import {
  AISVessel,
  DriftSimulation,
  VesselAttributionScore,
  AttributionCategory,
  ConfidenceLevel,
  BehaviorAnomalyIndicator,
} from '../../src/types';
import { calculateCPA } from './cpaEngine';

export function detectBehavioralAnomalies(vessel: AISVessel): BehaviorAnomalyIndicator[] {
  const indicators: BehaviorAnomalyIndicator[] = [];
  const track = vessel.track;

  if (!track || track.length < 2) {
    return indicators;
  }

  // 1. Check AIS Transmission Gaps (> 45 minutes without transmission in coastal/SLOC waters)
  for (let i = 0; i < track.length - 1; i++) {
    const tA = new Date(track[i].timestamp).getTime();
    const tB = new Date(track[i + 1].timestamp).getTime();
    const gapMins = (tB - tA) / (60 * 1000);

    if (gapMins > 45) {
      indicators.push({
        type: 'AIS_TRANSMISSION_GAP',
        severity: gapMins > 120 ? 'HIGH' : 'WARNING',
        description: `AIS signal blackout of ${Math.round(gapMins)} minutes detected between waypoints.`,
        timestamp: track[i].timestamp,
        coordinate: { lat: track[i].lat, lng: track[i].lng },
      });
    }
  }

  // 2. Check Speed Reduction / Slowing down
  const speeds = track.map(p => p.sogKts);
  const maxSpeed = Math.max(...speeds);
  const minSpeed = Math.min(...speeds);

  if (maxSpeed > 10 && minSpeed < maxSpeed * 0.45 && minSpeed < 4.0) {
    const minPoint = track.find(p => p.sogKts === minSpeed);
    indicators.push({
      type: 'SPEED_REDUCTION',
      severity: 'WARNING',
      description: `Notable speed reduction from ${maxSpeed.toFixed(1)} kts to ${minSpeed.toFixed(1)} kts observed.`,
      timestamp: minPoint?.timestamp || track[0].timestamp,
      coordinate: minPoint ? { lat: minPoint.lat, lng: minPoint.lng } : undefined,
    });
  }

  // 3. Check Course Alteration / Zigzag
  for (let i = 0; i < track.length - 1; i++) {
    let diff = Math.abs(track[i + 1].cogDeg - track[i].cogDeg);
    if (diff > 180) diff = 360 - diff;
    if (diff > 45) {
      indicators.push({
        type: 'COURSE_ALTERATION',
        severity: 'INFO',
        description: `Heading alteration of ${Math.round(diff)}° observed during transit.`,
        timestamp: track[i + 1].timestamp,
        coordinate: { lat: track[i + 1].lat, lng: track[i + 1].lng },
      });
      break; // report once
    }
  }

  return indicators;
}

export function computeVesselAttribution(
  vessel: AISVessel,
  drift: DriftSimulation,
  allVessels: AISVessel[]
): VesselAttributionScore {
  const cpa = calculateCPA(vessel, drift);
  const behaviorIndicators = detectBehavioralAnomalies(vessel);

  // 1. Spatial Proximity Subscore (0 - 100)
  // Distance under 0.5km => 100, drops off with distance
  let spatialProximity = Math.max(0, 100 - cpa.cpaDistanceKm * 15);
  if (cpa.cpaDistanceKm <= 0.2) spatialProximity = 100;

  // 2. Temporal Correlation Subscore (0 - 100)
  // Time difference in minutes from estimated origin window
  let temporalCorrelation = Math.max(0, 100 - (cpa.timeDifferenceMinutes / 180) * 100);

  // 3. Trajectory Alignment Subscore (0 - 100)
  const trajectoryAlignment = cpa.trajectoryAlignmentScore;

  // 4. Origin Corridor Overlap Subscore (0 - 100)
  const originCorridorOverlap = cpa.insideOriginCorridor ? 95 : Math.max(0, 80 - cpa.cpaDistanceKm * 20);

  // 5. Speed Consistency Subscore (0 - 100)
  // Normal cargo/tanker cruise (8-16 kts) vs stationary or erratic
  let speedConsistency = 70;
  if (cpa.vesselSpeedAtCPA >= 8 && cpa.vesselSpeedAtCPA <= 16) {
    speedConsistency = 90;
  } else if (cpa.vesselSpeedAtCPA < 2) {
    speedConsistency = 60;
  }

  // 6. Course Consistency Subscore (0 - 100)
  const courseConsistency = 85;

  // 7. Behavioral Anomaly Subscore (0 - 100)
  // Anomaly adds weight to investigation interest
  let behavioralAnomaly = 50;
  if (behaviorIndicators.some(b => b.severity === 'HIGH')) {
    behavioralAnomaly = 90;
  } else if (behaviorIndicators.some(b => b.severity === 'WARNING')) {
    behavioralAnomaly = 75;
  }

  // 8. AIS Data Quality Subscore (0 - 100)
  let aisDataQuality = 80;
  if (vessel.dataQuality.completenessRating === 'EXCELLENT') aisDataQuality = 95;
  else if (vessel.dataQuality.completenessRating === 'GOOD') aisDataQuality = 85;
  else if (vessel.dataQuality.completenessRating === 'MODERATE') aisDataQuality = 60;
  else aisDataQuality = 35;

  // Configurable Weights:
  const weights = {
    spatial: 0.25,
    temporal: 0.20,
    trajectory: 0.15,
    corridor: 0.15,
    speed: 0.10,
    course: 0.05,
    behavior: 0.05,
    aisQuality: 0.05,
  };

  const totalScore = Math.round(
    spatialProximity * weights.spatial +
    temporalCorrelation * weights.temporal +
    trajectoryAlignment * weights.trajectory +
    originCorridorOverlap * weights.corridor +
    speedConsistency * weights.speed +
    courseConsistency * weights.course +
    behavioralAnomaly * weights.behavior +
    aisDataQuality * weights.aisQuality
  );

  // Determine Categorization
  let category: AttributionCategory = 'LOW RELEVANCE';
  let confidenceLevel: ConfidenceLevel = 'LOW';

  if (totalScore >= 75 && cpa.cpaDistanceKm <= 2.5 && cpa.timeDifferenceMinutes <= 90) {
    category = 'PRIMARY SOURCE CANDIDATE';
    confidenceLevel = totalScore >= 85 ? 'HIGH' : 'MEDIUM';
  } else if (totalScore >= 55 && cpa.cpaDistanceKm <= 5.0) {
    category = 'SOURCE CANDIDATE';
    confidenceLevel = 'MEDIUM';
  } else if (totalScore >= 35 && cpa.cpaDistanceKm <= 10.0) {
    category = 'POTENTIAL CANDIDATE';
    confidenceLevel = 'LOW';
  } else if (cpa.cpaDistanceKm <= 20.0) {
    category = 'PASSING';
    confidenceLevel = 'LOW';
  } else {
    category = 'LOW RELEVANCE';
    confidenceLevel = 'LOW';
  }

  // Generate Evidence Points
  const evidenceList: string[] = [];
  const counterEvidenceList: string[] = [];

  if (cpa.cpaDistanceKm <= 0.5) {
    evidenceList.push(`Exceptional spatial proximity: CPA distance of ${cpa.cpaDistanceKm} km.`);
  } else if (cpa.cpaDistanceKm <= 2.0) {
    evidenceList.push(`Close spatial proximity: CPA distance of ${cpa.cpaDistanceKm} km.`);
  } else {
    counterEvidenceList.push(`Spatial offset: CPA distance of ${cpa.cpaDistanceKm} km is outside tight core.`);
  }

  if (cpa.timeDifferenceMinutes <= 35) {
    evidenceList.push(`Passed reconstructed origin corridor ${cpa.timeDifferenceMinutes} min from estimated origin time.`);
  } else if (cpa.timeDifferenceMinutes <= 90) {
    evidenceList.push(`Temporal window match: Transit occurred within ${cpa.timeDifferenceMinutes} min of estimated origin.`);
  } else {
    counterEvidenceList.push(`Temporal offset: Transit occurred ${cpa.timeDifferenceMinutes} min from estimated origin.`);
  }

  if (cpa.insideOriginCorridor) {
    evidenceList.push('Vessel track intersected the reconstructed hydrodynamic origin uncertainty ellipse.');
  } else {
    counterEvidenceList.push('Vessel track remained outside the reconstructed hydrodynamic origin 95% confidence corridor.');
  }

  if (cpa.trajectoryAlignmentScore >= 75) {
    evidenceList.push(`High trajectory alignment: vessel course (${cpa.vesselCourseAtCPA}°) aligns with slick elongation.`);
  }

  if (vessel.vesselType === 'Crude Oil Tanker' || vessel.vesselType === 'Chemical Tanker' || vessel.vesselType === 'Bulk Carrier') {
    evidenceList.push(`Vessel type is ${vessel.vesselType} with heavy fuel oil / cargo payload capacity.`);
  }

  for (const anomaly of behaviorIndicators) {
    evidenceList.push(`Behavioral indicator: ${anomaly.description}`);
  }

  if (vessel.dataQuality.completenessRating === 'EXCELLENT' || vessel.dataQuality.completenessRating === 'GOOD') {
    evidenceList.push(`AIS transmission record completeness is ${vessel.dataQuality.completenessRating} (${vessel.dataQuality.totalPoints} waypoints).`);
  } else {
    counterEvidenceList.push(`Sparse or intermittent AIS telemetry (${vessel.dataQuality.completenessRating}).`);
  }

  // Alternative vessel comparison
  const otherVesselsWithin2Km = allVessels.filter(v => v.mmsi !== vessel.mmsi && calculateCPA(v, drift).cpaDistanceKm <= 2.0);
  if (otherVesselsWithin2Km.length === 0) {
    evidenceList.push('Alternative vessels: No other vessels identified within 2.0 km of origin corridor in same time window.');
  } else {
    counterEvidenceList.push(`Alternative traffic: ${otherVesselsWithin2Km.length} other vessel(s) transited within 2.0 km.`);
  }

  const disclaimer = 'Attribution is probabilistic. AIS trajectory correlation and spatial proximity do not independently prove that a vessel caused the spill.';

  return {
    mmsi: vessel.mmsi,
    vesselName: vessel.name,
    imo: vessel.imo,
    vesselType: vessel.vesselType,
    flag: vessel.flag,
    flagCode: vessel.flagCode,
    category,
    attributionScore: totalScore,
    confidenceLevel,
    subScores: {
      spatialProximity: Math.round(spatialProximity),
      temporalCorrelation: Math.round(temporalCorrelation),
      trajectoryAlignment: Math.round(trajectoryAlignment),
      originCorridorOverlap: Math.round(originCorridorOverlap),
      speedConsistency: Math.round(speedConsistency),
      courseConsistency: Math.round(courseConsistency),
      behavioralAnomaly: Math.round(behavioralAnomaly),
      aisDataQuality: Math.round(aisDataQuality),
    },
    cpa,
    behaviorIndicators,
    evidenceList,
    counterEvidenceList,
    disclaimer,
  };
}

export function rankAllVessels(
  vessels: AISVessel[],
  drift: DriftSimulation
): VesselAttributionScore[] {
  const scores = vessels.map(v => computeVesselAttribution(v, drift, vessels));
  
  // Sort descending by attribution score
  scores.sort((a, b) => b.attributionScore - a.attributionScore);

  // Ensure only top candidate with high score is designated as PRIMARY SOURCE CANDIDATE
  if (scores.length > 0 && scores[0].attributionScore >= 70) {
    scores[0].category = 'PRIMARY SOURCE CANDIDATE';
    for (let i = 1; i < scores.length; i++) {
      if (scores[i].category === 'PRIMARY SOURCE CANDIDATE') {
        scores[i].category = 'SOURCE CANDIDATE';
      }
    }
  }

  return scores;
}
