/**
 * Closest Point of Approach (CPA) & Trajectory Alignment Engine
 * Calculates multi-point continuous CPA between dynamic vessel AIS track and hindcast slick origin corridor.
 */

import { AISVessel, AISTrackPoint, GeoCoordinate, DriftSimulation, CPAAnalysisResult } from '../../src/types';
import { haversineDistanceKm } from '../physics/driftModel';

/**
 * Interpolates vessel position at a specific timestamp between known AIS waypoints.
 */
export function interpolateVesselPosition(
  track: AISTrackPoint[],
  targetTimeMs: number
): { position: GeoCoordinate; sogKts: number; cogDeg: number } | null {
  if (!track || track.length === 0) return null;
  
  const sorted = [...track].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  const targetDate = targetTimeMs;

  // Exact boundary or single point
  if (sorted.length === 1) {
    return { position: { lat: sorted[0].lat, lng: sorted[0].lng }, sogKts: sorted[0].sogKts, cogDeg: sorted[0].cogDeg };
  }

  const firstTime = new Date(sorted[0].timestamp).getTime();
  const lastTime = new Date(sorted[sorted.length - 1].timestamp).getTime();

  if (targetDate <= firstTime) {
    return { position: { lat: sorted[0].lat, lng: sorted[0].lng }, sogKts: sorted[0].sogKts, cogDeg: sorted[0].cogDeg };
  }
  if (targetDate >= lastTime) {
    const last = sorted[sorted.length - 1];
    return { position: { lat: last.lat, lng: last.lng }, sogKts: last.sogKts, cogDeg: last.cogDeg };
  }

  // Find surrounding segment
  for (let i = 0; i < sorted.length - 1; i++) {
    const tA = new Date(sorted[i].timestamp).getTime();
    const tB = new Date(sorted[i + 1].timestamp).getTime();

    if (targetDate >= tA && targetDate <= tB) {
      const fraction = (targetDate - tA) / (tB - tA);
      const lat = sorted[i].lat + fraction * (sorted[i + 1].lat - sorted[i].lat);
      const lng = sorted[i].lng + fraction * (sorted[i + 1].lng - sorted[i].lng);
      const sogKts = sorted[i].sogKts + fraction * (sorted[i + 1].sogKts - sorted[i].sogKts);
      const cogDeg = sorted[i].cogDeg; // coarse
      return { position: { lat, lng }, sogKts, cogDeg };
    }
  }

  return { position: { lat: sorted[0].lat, lng: sorted[0].lng }, sogKts: sorted[0].sogKts, cogDeg: sorted[0].cogDeg };
}

/**
 * Gets slick position along the hindcast track at a specific timestamp
 */
export function getSlickHindcastPositionAt(drift: DriftSimulation, targetTimeMs: number): GeoCoordinate {
  const steps = drift.hindcast;
  if (!steps || steps.length === 0) return drift.observedPosition;

  const sorted = [...steps].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  
  if (targetTimeMs <= new Date(sorted[0].timestamp).getTime()) {
    return sorted[0].position;
  }
  if (targetTimeMs >= new Date(sorted[sorted.length - 1].timestamp).getTime()) {
    return sorted[sorted.length - 1].position;
  }

  for (let i = 0; i < sorted.length - 1; i++) {
    const tA = new Date(sorted[i].timestamp).getTime();
    const tB = new Date(sorted[i + 1].timestamp).getTime();
    if (targetTimeMs >= tA && targetTimeMs <= tB) {
      const frac = (targetTimeMs - tA) / (tB - tA);
      return {
        lat: sorted[i].position.lat + frac * (sorted[i + 1].position.lat - sorted[i].position.lat),
        lng: sorted[i].position.lng + frac * (sorted[i + 1].position.lng - sorted[i].position.lng),
      };
    }
  }

  return drift.probableOrigin.position;
}

/**
 * Calculate multi-sample Closest Point of Approach (CPA)
 */
export function calculateCPA(
  vessel: AISVessel,
  drift: DriftSimulation
): CPAAnalysisResult {
  const track = vessel.track;
  const probableOriginTimeMs = new Date(drift.probableOrigin.estimatedTime).getTime();
  const originUncertaintyKm = drift.probableOrigin.uncertaintyKm;

  if (!track || track.length === 0) {
    return {
      mmsi: vessel.mmsi,
      vesselName: vessel.name,
      cpaDistanceKm: 999,
      cpaTime: drift.probableOrigin.estimatedTime,
      timeDifferenceMinutes: 999,
      vesselPositionAtCPA: { lat: 0, lng: 0 },
      slickPositionAtCPA: drift.probableOrigin.position,
      vesselSpeedAtCPA: 0,
      vesselCourseAtCPA: 0,
      insideOriginCorridor: false,
      trajectoryAlignmentScore: 0,
    };
  }

  // Iterate over track waypoints and interpolated sub-points (every 5 minutes)
  const startTimeMs = new Date(track[0].timestamp).getTime();
  const endTimeMs = new Date(track[track.length - 1].timestamp).getTime();
  const stepMs = 5 * 60 * 1000; // 5 min intervals

  let minDistanceKm = Infinity;
  let bestTimeMs = startTimeMs;
  let bestVesselPos: GeoCoordinate = { lat: track[0].lat, lng: track[0].lng };
  let bestSlickPos: GeoCoordinate = drift.probableOrigin.position;
  let bestSpeed = track[0].sogKts;
  let bestCourse = track[0].cogDeg;

  for (let t = startTimeMs; t <= endTimeMs; t += stepMs) {
    const vState = interpolateVesselPosition(track, t);
    if (!vState) continue;

    const sPos = getSlickHindcastPositionAt(drift, t);
    const dist = haversineDistanceKm(vState.position, sPos);

    if (dist < minDistanceKm) {
      minDistanceKm = dist;
      bestTimeMs = t;
      bestVesselPos = vState.position;
      bestSlickPos = sPos;
      bestSpeed = vState.sogKts;
      bestCourse = vState.cogDeg;
    }
  }

  // Check also explicit raw waypoints
  for (const wp of track) {
    const t = new Date(wp.timestamp).getTime();
    const sPos = getSlickHindcastPositionAt(drift, t);
    const dist = haversineDistanceKm({ lat: wp.lat, lng: wp.lng }, sPos);
    if (dist < minDistanceKm) {
      minDistanceKm = dist;
      bestTimeMs = t;
      bestVesselPos = { lat: wp.lat, lng: wp.lng };
      bestSlickPos = sPos;
      bestSpeed = wp.sogKts;
      bestCourse = wp.cogDeg;
    }
  }

  const timeDiffMinutes = Math.abs(bestTimeMs - probableOriginTimeMs) / (60 * 1000);
  const insideOriginCorridor = minDistanceKm <= originUncertaintyKm * 1.5;

  // Trajectory alignment score (how well vessel track heading aligns with slick elongate axis or drift direction)
  const driftDir = drift.hindcast[0]?.netDriftDirectionDeg || 0;
  // Angular difference
  let angleDiff = Math.abs(bestCourse - driftDir) % 180;
  if (angleDiff > 90) angleDiff = 180 - angleDiff;
  const alignmentScore = Math.max(0, Math.min(100, Math.round(100 - (angleDiff / 90) * 60)));

  return {
    mmsi: vessel.mmsi,
    vesselName: vessel.name,
    cpaDistanceKm: Number(minDistanceKm.toFixed(2)),
    cpaTime: new Date(bestTimeMs).toISOString(),
    timeDifferenceMinutes: Math.round(timeDiffMinutes),
    vesselPositionAtCPA: bestVesselPos,
    slickPositionAtCPA: bestSlickPos,
    vesselSpeedAtCPA: Number(bestSpeed.toFixed(1)),
    vesselCourseAtCPA: Math.round(bestCourse),
    insideOriginCorridor,
    trajectoryAlignmentScore: alignmentScore,
  };
}
