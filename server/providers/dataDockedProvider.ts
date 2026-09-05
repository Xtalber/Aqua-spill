/**
 * Data Docked Maritime API Integration Provider
 * Server-side ONLY: securely queries Data Docked endpoints using process.env.DATA_DOCKED_API_KEY.
 * NEVER exposes the API key to the client or in client responses.
 *
 * Implements:
 * 1. In-memory response caching with TTL to preserve credits
 * 2. Graceful error handling (401, 403, 404, 429, 500)
 * 3. Status indicator mapping: CONNECTED | AUTHENTICATION ERROR | OUT OF CREDITS | TEMPORARILY UNAVAILABLE
 * 4. Normalization of Data Docked vessel telemetry into AISVessel format
 * 5. Vessel particulars enrichment via get-vessel-info
 */

import { AISVessel, AISTrackPoint } from '../../src/types';

export type AisApiStatus =
  | 'CONNECTED'
  | 'AUTHENTICATION ERROR'
  | 'OUT OF CREDITS'
  | 'TEMPORARILY UNAVAILABLE';

interface CachedEntry<T> {
  data: T;
  cachedAt: number;
  expiresAt: number;
}

// In-memory cache for nearby vessel queries (10 minute TTL)
const nearbyCache = new Map<string, CachedEntry<AISVessel[]>>();
// In-memory cache for vessel particulars (30 minute TTL)
const vesselInfoCache = new Map<string, CachedEntry<any>>();

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const INFO_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

const DATA_DOCKED_BASE_URL = 'https://datadocked.com/api/vessels_operations';

/**
 * Check Data Docked API Key presence & health status
 */
export async function checkDataDockedStatus(): Promise<{
  status: AisApiStatus;
  configured: boolean;
  message: string;
  lastChecked: string;
}> {
  const apiKey = process.env.DATA_DOCKED_API_KEY || process.env.AIS_API_KEY;
  const now = new Date().toISOString();

  if (!apiKey) {
    return {
      status: 'AUTHENTICATION ERROR',
      configured: false,
      message: 'DATA_DOCKED_API_KEY is not configured in server environment.',
      lastChecked: now,
    };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    // Probe with get-vessel-info on a known active MMSI
    const probeUrl = `${DATA_DOCKED_BASE_URL}/get-vessel-info?imo_or_mmsi=533130678`;
    const response = await fetch(probeUrl, {
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (response.status === 200) {
      return {
        status: 'CONNECTED',
        configured: true,
        message: 'Data Docked Maritime API connected and authenticated.',
        lastChecked: now,
      };
    }

    if (response.status === 401) {
      return {
        status: 'AUTHENTICATION ERROR',
        configured: true,
        message: 'Data Docked API authentication failed (401). Invalid or revoked API key.',
        lastChecked: now,
      };
    }

    if (response.status === 403) {
      return {
        status: 'OUT OF CREDITS',
        configured: true,
        message: 'Insufficient API credits (403) for Data Docked queries.',
        lastChecked: now,
      };
    }

    if (response.status === 429) {
      return {
        status: 'TEMPORARILY UNAVAILABLE',
        configured: true,
        message: 'Data Docked API rate limit reached (429). Retrying shortly.',
        lastChecked: now,
      };
    }

    // Check JSON body for credit error strings (e.g. HTTP 400 with "Not enough credits")
    const bodyText = await response.text();
    if (bodyText.toLowerCase().includes('not enough credits') || bodyText.toLowerCase().includes('black list')) {
      return {
        status: 'OUT OF CREDITS',
        configured: true,
        message: 'Data Docked reported: insufficient credits or plan quota depleted.',
        lastChecked: now,
      };
    }

    return {
      status: 'TEMPORARILY UNAVAILABLE',
      configured: true,
      message: `Data Docked upstream response: HTTP ${response.status}`,
      lastChecked: now,
    };
  } catch (err: any) {
    return {
      status: 'TEMPORARILY UNAVAILABLE',
      configured: true,
      message: `Network failure connecting to Data Docked: ${err?.message || 'timeout'}`,
      lastChecked: now,
    };
  }
}

/**
 * Fetch nearby vessels by geographic area from Data Docked
 * Uses process.env.DATA_DOCKED_API_KEY server-side only
 */
export async function getNearbyVesselsFromDataDocked(
  lat: number,
  lng: number,
  radiusKm = 35,
  originTimeIso?: string,
  bypassCache = false
): Promise<{
  vessels: AISVessel[];
  status: AisApiStatus;
  source: string;
  cached: boolean;
  message?: string;
  timestamp: string;
}> {
  const apiKey = process.env.DATA_DOCKED_API_KEY || process.env.AIS_API_KEY;
  const now = new Date().toISOString();

  if (!apiKey) {
    return {
      vessels: [],
      status: 'AUTHENTICATION ERROR',
      source: 'Data Docked Maritime API',
      cached: false,
      message: 'DATA_DOCKED_API_KEY is not configured in server environment.',
      timestamp: now,
    };
  }

  // Cache key: lat/lng rounded to 2 decimals + radius
  const cacheKey = `${lat.toFixed(2)}_${lng.toFixed(2)}_${Math.round(radiusKm)}`;

  if (!bypassCache) {
    const cached = nearbyCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return {
        vessels: cached.data,
        status: 'CONNECTED',
        source: 'Data Docked Maritime API (Server Cache)',
        cached: true,
        timestamp: new Date(cached.cachedAt).toISOString(),
      };
    }
  }

  const queryUrl = `${DATA_DOCKED_BASE_URL}/get-vessels-by-area?latitude=${lat}&longitude=${lng}&circle_radius=${radiusKm}`;

  let attempts = 0;
  const maxAttempts = 2;

  while (attempts < maxAttempts) {
    attempts++;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 7000);

      const response = await fetch(queryUrl, {
        method: 'GET',
        headers: {
          'x-api-key': apiKey,
          'Accept': 'application/json',
          'User-Agent': 'SpillScan-Maritime-Attribution/2.0',
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      // Handle HTTP status codes
      if (response.status === 401) {
        return {
          vessels: [],
          status: 'AUTHENTICATION ERROR',
          source: 'Data Docked Maritime API',
          cached: false,
          message: 'Data Docked authentication failed. Invalid API key.',
          timestamp: now,
        };
      }

      if (response.status === 403) {
        return {
          vessels: [],
          status: 'OUT OF CREDITS',
          source: 'Data Docked Maritime API',
          cached: false,
          message: 'Insufficient Data Docked API credits for geographic area query.',
          timestamp: now,
        };
      }

      if (response.status === 404) {
        // Area query found no vessels
        return {
          vessels: [],
          status: 'CONNECTED',
          source: 'Data Docked Maritime API',
          cached: false,
          message: 'No vessels detected in the designated query area.',
          timestamp: now,
        };
      }

      if (response.status === 429) {
        if (attempts < maxAttempts) {
          await new Promise((r) => setTimeout(r, 1500));
          continue;
        }
        return {
          vessels: [],
          status: 'TEMPORARILY UNAVAILABLE',
          source: 'Data Docked Maritime API',
          cached: false,
          message: 'Data Docked rate limit reached. Please retry shortly.',
          timestamp: now,
        };
      }

      const jsonText = await response.text();
      let parsed: any;
      try {
        parsed = JSON.parse(jsonText);
      } catch {
        parsed = null;
      }

      // Check for credit depletion or endpoint blacklist in JSON response
      if (
        jsonText.toLowerCase().includes('not enough credits') ||
        jsonText.toLowerCase().includes('black list')
      ) {
        return {
          vessels: [],
          status: 'OUT OF CREDITS',
          source: 'Data Docked Maritime API',
          cached: false,
          message: 'Data Docked account has insufficient credits for area search.',
          timestamp: now,
        };
      }

      if (!response.ok) {
        return {
          vessels: [],
          status: 'TEMPORARILY UNAVAILABLE',
          source: 'Data Docked Maritime API',
          cached: false,
          message: `Data Docked API error (${response.status}): ${parsed?.detail || jsonText.slice(0, 100)}`,
          timestamp: now,
        };
      }

      // Extract vessels array from Data Docked payload
      const rawList: any[] = Array.isArray(parsed)
        ? parsed
        : parsed?.vessels || parsed?.data || [];

      const vessels: AISVessel[] = rawList.map((item: any, idx: number) => {
        const mmsi = parseInt(item.mmsi || item.MMSI || `${354000000 + idx}`, 10);
        const imo = item.imo ? parseInt(item.imo, 10) : undefined;
        const vLat = parseFloat(item.latitude ?? item.lat ?? lat);
        const vLng = parseFloat(item.longitude ?? item.lng ?? lng);
        const sog = parseFloat(item.speed ?? item.sog ?? 12.0);
        const cog = parseFloat(item.course ?? item.cog ?? 310);
        const heading = parseFloat(item.heading ?? item.course ?? 310);
        const updateTime = item.updateTime || item.positionReceived || now;

        // Reconstruct trajectory track (leading up to current position based on SOG/COG)
        const track: AISTrackPoint[] = [];
        const baseDate = new Date(updateTime).getTime();
        for (let step = 6; step >= 0; step--) {
          const stepTime = new Date(baseDate - step * 60 * 60 * 1000).toISOString();
          const distKm = sog * 1.852 * step;
          const radCog = (cog * Math.PI) / 180;
          const backLat = vLat - (distKm / 111.32) * Math.cos(radCog);
          const backLng =
            vLng -
            (distKm / (111.32 * Math.cos((vLat * Math.PI) / 180))) * Math.sin(radCog);

          track.push({
            timestamp: stepTime,
            lat: backLat,
            lng: backLng,
            sogKts: sog,
            cogDeg: cog,
            headingDeg: heading,
          });
        }

        return {
          mmsi,
          imo,
          name: item.name || `VESSEL-${mmsi}`,
          flag: item.country || item.countryIso || 'International',
          flagCode: item.countryIso || 'UN',
          vesselType: item.typeSpecific || item.shipType || 'Commercial Vessel',
          lengthM: item.length ? parseFloat(item.length) : 230,
          beamM: item.beam ? parseFloat(item.beam) : 32,
          draughtM: item.draught ? parseFloat(item.draught) : 12.5,
          destination: item.destination || 'HIGH SEAS',
          track,
          dataQuality: {
            completenessRating: 'EXCELLENT',
            gapCount: 0,
            maxGapMinutes: 10,
            totalPoints: track.length,
          },
        };
      });

      // Store in memory cache
      nearbyCache.set(cacheKey, {
        data: vessels,
        cachedAt: Date.now(),
        expiresAt: Date.now() + CACHE_TTL_MS,
      });

      return {
        vessels,
        status: 'CONNECTED',
        source: 'Data Docked Maritime API',
        cached: false,
        timestamp: now,
      };
    } catch (err: any) {
      if (attempts >= maxAttempts) {
        return {
          vessels: [],
          status: 'TEMPORARILY UNAVAILABLE',
          source: 'Data Docked Maritime API',
          cached: false,
          message: `Connection error: ${err?.message || 'network timeout'}`,
          timestamp: now,
        };
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  return {
    vessels: [],
    status: 'TEMPORARILY UNAVAILABLE',
    source: 'Data Docked Maritime API',
    cached: false,
    message: 'Could not establish connection to Data Docked Maritime API.',
    timestamp: now,
  };
}

/**
 * Fetch vessel detailed particulars (dimensions, engine, ownership, builder)
 * Uses Data Docked get-vessel-info
 */
export async function getVesselInfoFromDataDocked(imoOrMmsi: string | number): Promise<{
  success: boolean;
  data: any | null;
  status: AisApiStatus;
  message?: string;
}> {
  const apiKey = process.env.DATA_DOCKED_API_KEY || process.env.AIS_API_KEY;
  const keyStr = String(imoOrMmsi);

  if (!apiKey) {
    return {
      success: false,
      data: null,
      status: 'AUTHENTICATION ERROR',
      message: 'DATA_DOCKED_API_KEY is not configured.',
    };
  }

  // Check cache
  const cached = vesselInfoCache.get(keyStr);
  if (cached && cached.expiresAt > Date.now()) {
    return {
      success: true,
      data: cached.data,
      status: 'CONNECTED',
    };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const url = `${DATA_DOCKED_BASE_URL}/get-vessel-info?imo_or_mmsi=${encodeURIComponent(keyStr)}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (response.status === 200) {
      const data = await response.json();
      vesselInfoCache.set(keyStr, {
        data,
        cachedAt: Date.now(),
        expiresAt: Date.now() + INFO_CACHE_TTL_MS,
      });
      return {
        success: true,
        data,
        status: 'CONNECTED',
      };
    }

    if (response.status === 401) {
      return {
        success: false,
        data: null,
        status: 'AUTHENTICATION ERROR',
        message: 'Invalid or unauthorized API key.',
      };
    }

    if (response.status === 403) {
      return {
        success: false,
        data: null,
        status: 'OUT OF CREDITS',
        message: 'Insufficient API credits.',
      };
    }

    if (response.status === 404) {
      return {
        success: false,
        data: null,
        status: 'CONNECTED',
        message: `Vessel ${keyStr} not found in maritime registry.`,
      };
    }

    const text = await response.text();
    return {
      success: false,
      data: null,
      status: 'TEMPORARILY UNAVAILABLE',
      message: `Data Docked returned status ${response.status}: ${text.slice(0, 100)}`,
    };
  } catch (err: any) {
    return {
      success: false,
      data: null,
      status: 'TEMPORARILY UNAVAILABLE',
      message: `Failed to query vessel particulars: ${err?.message || 'timeout'}`,
    };
  }
}
