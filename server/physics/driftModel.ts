/**
 * Marine Hydrodynamic Drift Physics Engine
 * Implements leeway transport model:
 * Vector_drift = 1.0 * Vector_current + LeewayFactor * Rotated(Vector_wind) + Stokes_drift
 */

import { GeoCoordinate, MetoceanData, DriftSimulation, DriftTimeStep, ConfidenceLevel } from '../../src/types';

// Earth geometry helpers
const EARTH_RADIUS_KM = 6371.0088;
const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

export function haversineDistanceKm(p1: GeoCoordinate, p2: GeoCoordinate): number {
  const dLat = (p2.lat - p1.lat) * DEG_TO_RAD;
  const dLng = (p2.lng - p1.lng) * DEG_TO_RAD;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(p1.lat * DEG_TO_RAD) * Math.cos(p2.lat * DEG_TO_RAD) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

export function destinationPoint(
  start: GeoCoordinate,
  distanceKm: number,
  bearingDeg: number
): GeoCoordinate {
  const δ = distanceKm / EARTH_RADIUS_KM;
  const θ = bearingDeg * DEG_TO_RAD;
  const φ1 = start.lat * DEG_TO_RAD;
  const λ1 = start.lng * DEG_TO_RAD;

  const sinφ2 = Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ);
  const φ2 = Math.asin(sinφ2);
  const y = Math.sin(θ) * Math.sin(δ) * Math.cos(φ1);
  const x = Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2);
  const λ2 = λ1 + Math.atan2(y, x);

  return {
    lat: φ2 * RAD_TO_DEG,
    lng: ((λ2 * RAD_TO_DEG + 540) % 360) - 180,
  };
}

export function computeDriftVector(
  metocean: MetoceanData,
  params = {
    windLeewayFactor: 0.03, // 3%
    windDeflectionDeg: 10,  // Northern hemisphere Coriolis deflection to right
    currentWeight: 1.0,
    stokesDriftWeight: 0.015,
  }
): { speedKts: number; dirDeg: number; uKts: number; vKts: number } {
  // Current velocity vector (direction it flows TO)
  const currentRad = metocean.currentDirectionDeg * DEG_TO_RAD;
  const currU = params.currentWeight * metocean.currentSpeedKts * Math.sin(currentRad);
  const currV = params.currentWeight * metocean.currentSpeedKts * Math.cos(currentRad);

  // Wind velocity vector (meteorological direction is FROM, so add 180 to get flow direction)
  const windFlowDirDeg = (metocean.windDirectionDeg + 180 + params.windDeflectionDeg) % 360;
  const windRad = windFlowDirDeg * DEG_TO_RAD;
  const effectiveWindFactor = params.windLeewayFactor + params.stokesDriftWeight;
  const windU = effectiveWindFactor * metocean.windSpeedKts * Math.sin(windRad);
  const windV = effectiveWindFactor * metocean.windSpeedKts * Math.cos(windRad);

  const totalU = currU + windU;
  const totalV = currV + windV;

  const speedKts = Math.hypot(totalU, totalV);
  let dirDeg = Math.atan2(totalU, totalV) * RAD_TO_DEG;
  if (dirDeg < 0) dirDeg += 360;

  return { speedKts, dirDeg, uKts: totalU, vKts: totalV };
}

/**
 * Calculates Mackay/ADIOS evaporation and emulsification for crude/fuel oil weathering.
 */
export function calculateWeathering(hoursSinceSpill: number, windSpeedKts: number, initialAreaKm2 = 12.0) {
  // Evaporation follows logarithmic decay F_evap = a * ln(1 + b * t)
  const windFactor = 1 + (windSpeedKts / 20) * 0.4;
  const t = Math.max(0.01, hoursSinceSpill);
  const evaporationPercent = Math.min(68, 12 * Math.log(1 + 0.8 * t * windFactor));
  
  // Emulsification (water uptake) follows asymptotic curve Y_w = Y_max * (1 - exp(-k * t))
  const emulsificationWaterPercent = Math.min(75, 75 * (1 - Math.exp(-0.15 * t * (windSpeedKts / 10))));

  // Fay's gravity-viscous spreading: Area(t) = A0 * (1 + 0.35 * t^0.75)
  const estimatedAreaKm2 = initialAreaKm2 * (1 + 0.28 * Math.pow(t, 0.72));

  return {
    evaporationPercent: Number(evaporationPercent.toFixed(1)),
    emulsificationWaterPercent: Number(emulsificationWaterPercent.toFixed(1)),
    estimatedAreaKm2: Number(estimatedAreaKm2.toFixed(2)),
  };
}

export function runHindcastAndForecast(
  caseId: string,
  observedPosition: GeoCoordinate,
  observedTimeIso: string,
  metocean: MetoceanData,
  initialAreaKm2 = 14.5,
  customParams?: any
): DriftSimulation {
  const params = {
    windLeewayFactor: customParams?.windLeewayFactor ?? 0.03,
    windDeflectionDeg: customParams?.windDeflectionDeg ?? (observedPosition.lat >= 0 ? 10 : -10),
    currentWeight: customParams?.currentWeight ?? 1.0,
    stokesDriftWeight: customParams?.stokesDriftWeight ?? 0.015,
    diffusionCoeffM2s: customParams?.diffusionCoeffM2s ?? 15.0,
  };

  const driftVector = computeDriftVector(metocean, params);
  const observedDate = new Date(observedTimeIso);

  // Hindcast: backtrack from T-0 to T-24h
  // Reverse direction of drift to find where slick came from
  const reverseDirDeg = (driftVector.dirDeg + 180) % 360;
  const hindcastHours = [0, -1, -2, -3, -4, -6, -8, -10, -12, -16, -20, -24];
  const hindcast: DriftTimeStep[] = [];

  for (const h of hindcastHours) {
    const hoursBack = Math.abs(h);
    const distanceKm = driftVector.speedKts * 1.852 * hoursBack; // 1 knot = 1.852 km/h
    const pos = destinationPoint(observedPosition, distanceKm, reverseDirDeg);
    const stepTime = new Date(observedDate.getTime() + h * 3600 * 1000).toISOString();
    
    // Expanding circular uncertainty: base 0.5km + 0.25km per hour back
    const uncertaintyRadiusKm = Number((0.5 + hoursBack * 0.35).toFixed(2));
    const weathering = calculateWeathering(hoursBack, metocean.windSpeedKts, initialAreaKm2);

    hindcast.push({
      hoursOffset: h,
      timestamp: stepTime,
      position: pos,
      uncertaintyRadiusKm,
      windVectorKts: { speed: metocean.windSpeedKts, dirDeg: metocean.windDirectionDeg },
      currentVectorKts: { speed: metocean.currentSpeedKts, dirDeg: metocean.currentDirectionDeg },
      netDriftSpeedKts: Number(driftVector.speedKts.toFixed(2)),
      netDriftDirectionDeg: Number(driftVector.dirDeg.toFixed(1)),
      evaporationPercent: weathering.evaporationPercent,
      emulsificationWaterPercent: weathering.emulsificationWaterPercent,
      estimatedAreaKm2: weathering.estimatedAreaKm2,
    });
  }

  // Probable origin estimate (typically 4-8 hours before observation based on slick dispersion & weathering)
  const originStepIndex = 4; // T-4h or T-6h
  const probableOriginStep = hindcast[originStepIndex] || hindcast[3];
  const probableOrigin = {
    position: probableOriginStep.position,
    timeWindowStart: hindcast[5].timestamp, // T-6h
    timeWindowEnd: hindcast[2].timestamp,   // T-2h
    estimatedTime: probableOriginStep.timestamp,
    uncertaintyKm: probableOriginStep.uncertaintyRadiusKm,
    confidence: (probableOriginStep.uncertaintyRadiusKm < 2.5 ? 'HIGH' : 'MEDIUM') as ConfidenceLevel,
  };

  // Forecast: forward propagation from T+0 to T+48h
  const forecastHours = [0, 1, 2, 3, 6, 9, 12, 18, 24, 36, 48];
  const forecast: DriftTimeStep[] = [];

  for (const h of forecastHours) {
    const distanceKm = driftVector.speedKts * 1.852 * h;
    const pos = destinationPoint(observedPosition, distanceKm, driftVector.dirDeg);
    const stepTime = new Date(observedDate.getTime() + h * 3600 * 1000).toISOString();
    const uncertaintyRadiusKm = Number((0.5 + h * 0.45).toFixed(2));
    const weathering = calculateWeathering(h + 6, metocean.windSpeedKts, initialAreaKm2);

    forecast.push({
      hoursOffset: h,
      timestamp: stepTime,
      position: pos,
      uncertaintyRadiusKm,
      windVectorKts: { speed: metocean.windSpeedKts, dirDeg: metocean.windDirectionDeg },
      currentVectorKts: { speed: metocean.currentSpeedKts, dirDeg: metocean.currentDirectionDeg },
      netDriftSpeedKts: Number(driftVector.speedKts.toFixed(2)),
      netDriftDirectionDeg: Number(driftVector.dirDeg.toFixed(1)),
      evaporationPercent: weathering.evaporationPercent,
      emulsificationWaterPercent: weathering.emulsificationWaterPercent,
      estimatedAreaKm2: weathering.estimatedAreaKm2,
    });
  }

  return {
    caseId,
    observedTime: observedTimeIso,
    observedPosition,
    parameters: params,
    hindcast,
    probableOrigin,
    forecast,
    generatedAt: new Date().toISOString(),
  };
}
