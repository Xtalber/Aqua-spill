/**
 * SpillScan - Maritime GIS Map
 * Zero API Key Requirement: Uses Leaflet with OpenStreetMap as Default Basemap
 * Supports:
 * - OpenStreetMap Default (No API Key Required)
 * - Satellite Imagery (Esri World Imagery)
 * - Ocean Basemap (Esri Ocean)
 * - Topographic Basemap (OpenTopoMap)
 * - Offline / Dataset Canvas Mode (Zero External Network Requests)
 * - Automatic Data-Driven Bound Auto-Fitting (Slick, AIS, Swath Footprint, Drift Corridor)
 * - Graceful Tile Offline Fallback: "Basemap unavailable — analysis layers remain available"
 * - All Local Analysis Layers (SAR Raster, Slick Polygon, Boundary, Origin, Uncertainty, Hindcast, Forecast, AIS Tracks, CPA Lines, Metocean)
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import {
  SpillCase,
  AISVessel,
  GeoCoordinate,
} from '../types';
import {
  Layers,
  MapPin,
  Maximize2,
  Minimize2,
  Copy,
  Check,
  Globe,
  HardDrive,
  Focus,
  Eye,
  AlertTriangle,
} from 'lucide-react';

interface GisMapProps {
  activeCase: SpillCase;
  selectedVesselMmsi?: number | null;
  onSelectVessel?: (mmsi: number) => void;
  playbackHour?: number;
}

type BasemapStyle = 'osm' | 'g_hybrid' | 'g_satellite' | 'g_roadmap' | 'satellite' | 'ocean' | 'topo' | 'offline';

const GOOGLE_MAPS_KEY = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyCRavViyBuVrhk4YUiT-cMnGaYzm7NMQl0';

export const GisMap: React.FC<GisMapProps> = ({
  activeCase,
  selectedVesselMmsi,
  onSelectVessel,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const currentTileLayerRef = useRef<L.TileLayer | null>(null);

  // Basemap style state - OpenStreetMap as clean default with zero external key requirement
  const [baseMapType, setBaseMapType] = useState<BasemapStyle>('osm');
  const [tileError, setTileError] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState(false);


  // 14 Configurable GIS Layer Toggles
  const [layers, setLayers] = useState({
    sarRaster: true,
    footprint: true,
    oilSlick: true,
    slickBoundary: true,
    slickCentroid: true,
    spillOrigin: true,
    originUncertainty: true,
    hindcast: true,
    forecast: true,
    aisVessels: true,
    aisTracks: true,
    cpaLines: true,
    windVector: true,
    currentVector: true,
  });

  // Coordinate inspector state
  const [inspectedCoord, setInspectedCoord] = useState<GeoCoordinate | null>(null);
  const [copied, setCopied] = useState(false);

  // Auto-fit bounds calculation
  const fitBoundsToAnalysis = useCallback((animate = true) => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const latLngs: L.LatLngExpression[] = [];

    // 1. Slick Polygon Points
    if (activeCase.detection?.polygon?.coordinates?.[0]) {
      activeCase.detection.polygon.coordinates[0].forEach(([lng, lat]) => {
        if (!isNaN(lat) && !isNaN(lng)) latLngs.push([lat, lng]);
      });
    }

    // 2. Slick Centroid
    if (activeCase.detection?.centroid) {
      const { lat, lng } = activeCase.detection.centroid;
      if (!isNaN(lat) && !isNaN(lng)) latLngs.push([lat, lng]);
    }

    // 3. Observation Footprint
    if (activeCase.observation?.footprint?.coordinates?.[0]) {
      activeCase.observation.footprint.coordinates[0].forEach(([lng, lat]) => {
        if (!isNaN(lat) && !isNaN(lng)) latLngs.push([lat, lng]);
      });
    }

    // 4. Drift Origin & Waypoints
    if (activeCase.drift?.probableOrigin?.position) {
      const { lat, lng } = activeCase.drift.probableOrigin.position;
      if (!isNaN(lat) && !isNaN(lng)) latLngs.push([lat, lng]);
    }

    if (activeCase.drift?.hindcast) {
      activeCase.drift.hindcast.forEach((step) => {
        if (!isNaN(step.position.lat) && !isNaN(step.position.lng)) {
          latLngs.push([step.position.lat, step.position.lng]);
        }
      });
    }

    if (activeCase.drift?.forecast) {
      activeCase.drift.forecast.forEach((step) => {
        if (!isNaN(step.position.lat) && !isNaN(step.position.lng)) {
          latLngs.push([step.position.lat, step.position.lng]);
        }
      });
    }

    // 5. AIS Vessels & Track Points
    if (activeCase.aisVessels) {
      activeCase.aisVessels.forEach((v) => {
        if (v.track) {
          v.track.forEach((pt) => {
            if (!isNaN(pt.lat) && !isNaN(pt.lng)) latLngs.push([pt.lat, pt.lng]);
          });
        }
      });
    }

    if (latLngs.length > 0) {
      const bounds = L.latLngBounds(latLngs);
      if (bounds.isValid()) {
        map.fitBounds(bounds, {
          padding: [45, 45],
          maxZoom: 13,
          animate,
        });
      }
    } else if (activeCase.observation?.centroid) {
      const { lat, lng } = activeCase.observation.centroid;
      if (!isNaN(lat) && !isNaN(lng)) {
        map.setView([lat, lng], 11, { animate });
      }
    }
  }, [activeCase]);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const initialCentroid = activeCase.observation?.centroid || activeCase.detection?.centroid || { lat: 2.450, lng: 101.880 };

    const map = L.map(mapContainerRef.current, {
      center: [initialCentroid.lat, initialCentroid.lng],
      zoom: 11,
      zoomControl: false,
      attributionControl: true,
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    const layerGroup = L.layerGroup().addTo(map);
    layerGroupRef.current = layerGroup;
    mapInstanceRef.current = map;

    // Click handler for coordinate inspection
    map.on('click', (e: L.LeafletMouseEvent) => {
      setInspectedCoord({ lat: e.latlng.lat, lng: e.latlng.lng });
    });

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Basemap Tiles (OpenStreetMap default, Esri, Topo, Offline)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    setTileError(false);

    // Remove previous tile layer
    if (currentTileLayerRef.current) {
      map.removeLayer(currentTileLayerRef.current);
      currentTileLayerRef.current = null;
    }

    if (baseMapType === 'offline') {
      // Offline mode: Pure local analytical grid, no tile requests
      return;
    }

    let tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    let attribution = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors';
    let maxZoom = 19;
    let subdomains: string | string[] = 'abc';

    if (baseMapType === 'g_hybrid') {
      tileUrl = `https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}&key=${GOOGLE_MAPS_KEY}`;
      attribution = '&copy; Google Maps Platform (Satellite + Marine)';
      maxZoom = 20;
      subdomains = ['0', '1', '2', '3'];
    } else if (baseMapType === 'g_satellite') {
      tileUrl = `https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}&key=${GOOGLE_MAPS_KEY}`;
      attribution = '&copy; Google Maps Platform (Satellite)';
      maxZoom = 20;
      subdomains = ['0', '1', '2', '3'];
    } else if (baseMapType === 'g_roadmap') {
      tileUrl = `https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&key=${GOOGLE_MAPS_KEY}`;
      attribution = '&copy; Google Maps Platform (Nautical)';
      maxZoom = 20;
      subdomains = ['0', '1', '2', '3'];
    } else if (baseMapType === 'satellite') {
      tileUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      attribution = '&copy; Esri, Maxar, Earthstar Geographics';
      maxZoom = 18;
      subdomains = [];
    } else if (baseMapType === 'ocean') {
      tileUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}';
      attribution = '&copy; Esri, GEBCO, NOAA, National Geographic';
      maxZoom = 16;
      subdomains = [];
    } else if (baseMapType === 'topo') {
      tileUrl = 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png';
      attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, SRTM | &copy; OpenTopoMap';
      maxZoom = 17;
      subdomains = 'abc';
    }

    const tileLayer = L.tileLayer(tileUrl, {
      maxZoom,
      subdomains,
      attribution,
      crossOrigin: true,
    });

    tileLayer.on('tileerror', () => {
      setTileError(true);
    });

    tileLayer.addTo(map);
    currentTileLayerRef.current = tileLayer;
  }, [baseMapType]);

  // Recenter / Auto-Fit when Case Data changes
  useEffect(() => {
    fitBoundsToAnalysis(false);
  }, [activeCase.id, activeCase.observation?.id, fitBoundsToAnalysis]);

  // Render all active GIS Vector Layers & SAR Image Overlay
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layerGroup = layerGroupRef.current;
    if (!map || !layerGroup) return;

    layerGroup.clearLayers();

    const { observation, detection, drift, aisVessels, attributionResults, metocean } = activeCase;

    // 0. Georeferenced SAR Raster Image Overlay
    if (layers.sarRaster && observation?.imageUrl && observation?.footprint) {
      const coords = observation.footprint.coordinates[0];
      if (coords && coords.length >= 4) {
        const lats = coords.map(c => c[1]);
        const lngs = coords.map(c => c[0]);
        const bounds: L.LatLngBoundsExpression = [
          [Math.min(...lats), Math.min(...lngs)],
          [Math.max(...lats), Math.max(...lngs)],
        ];

        const sarOverlay = L.imageOverlay(observation.imageUrl, bounds, {
          opacity: 0.8,
          interactive: false,
        });
        layerGroup.addLayer(sarOverlay);
      }
    }

    // 1. Satellite Observation Footprint
    if (layers.footprint && observation?.footprint) {
      const footprintCoords = observation.footprint.coordinates[0].map(([lng, lat]) => [lat, lng] as [number, number]);
      const footprintPoly = L.polygon(footprintCoords, {
        color: '#0284c7',
        weight: 1.5,
        dashArray: '4, 4',
        fillColor: '#38bdf8',
        fillOpacity: 0.05,
      }).bindTooltip(`<b>SAR Swath:</b> ${observation.satellite}<br/>Mode: ${observation.sensorMode}`, { sticky: true });
      layerGroup.addLayer(footprintPoly);
    }

    // 2. Detected Oil Slick Polygons & Boundaries (Multi-Object Support)
    if (layers.oilSlick) {
      const currentCase = activeCase.currentCase;
      const oilObjects = currentCase?.oilObjects;

      if (oilObjects && oilObjects.length > 0) {
        // Render every ground-truth oil object independently
        oilObjects.forEach((obj, i) => {
          const idx = i + 1;
          const coords = obj.geoPolygon.coordinates[0].map(([lng, lat]) => [lat, lng] as [number, number]);
          const poly = L.polygon(coords, {
            color: layers.slickBoundary ? '#0284c7' : 'transparent',
            weight: layers.slickBoundary ? 2.5 : 0,
            fillColor: '#38bdf8',
            fillOpacity: 0.45,
          }).bindTooltip(
            `<div class="p-1.5 text-xs font-mono">
              <div class="font-bold text-sky-700">OIL OBJECT #${idx}</div>
              <div>Area: <b>${obj.physicalAreaKm2.toFixed(3)} km²</b></div>
              <div>Perimeter: <b>${obj.physicalPerimeterKm.toFixed(2)} km</b></div>
              <div>Centroid: <b>${obj.latitude.toFixed(4)}°N, ${obj.longitude.toFixed(4)}°E</b></div>
            </div>`,
            { sticky: true }
          );
          layerGroup.addLayer(poly);
        });
      } else if (detection?.polygon && (detection.morphometry?.areaKm2 || 0) > 0) {
        const slickCoords = detection.polygon.coordinates[0].map(([lng, lat]) => [lat, lng] as [number, number]);
        const areaLabel = detection.morphometry?.areaKm2
          ? `${detection.morphometry.areaKm2.toFixed(2)} km²`
          : 'Pixel-space estimate';

        const slickPoly = L.polygon(slickCoords, {
          color: layers.slickBoundary ? '#0284c7' : 'transparent',
          weight: layers.slickBoundary ? 2.5 : 0,
          fillColor: '#38bdf8',
          fillOpacity: 0.45,
        }).bindTooltip(
          `<div class="p-1.5 text-xs font-mono">
            <div class="font-bold text-sky-700">DETECTED OIL SLICK</div>
            <div>Area: <b>${areaLabel}</b></div>
            <div>Damping: <b>-${detection.morphometry?.backscatterDampingDb || 6.2} dB</b></div>
            <div>Confidence: <b>${detection.confidence} (${detection.confidenceScore}%)</b></div>
          </div>`,
          { sticky: true }
        );
        layerGroup.addLayer(slickPoly);
      }
    }

    // 3. Slick Centroid Marker
    if (layers.slickCentroid && detection?.centroid) {
      const centroidIcon = L.divIcon({
        className: 'custom-centroid-marker',
        html: `
          <div class="relative flex items-center justify-center w-6 h-6">
            <span class="absolute w-5 h-5 bg-sky-500 rounded-full animate-ping opacity-60"></span>
            <span class="relative w-3 h-3 bg-sky-600 border-2 border-white rounded-full shadow-lg"></span>
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      const centroidMarker = L.marker([detection.centroid.lat, detection.centroid.lng], { icon: centroidIcon })
        .bindTooltip(`<b>Slick Centroid (Observation T0):</b><br/>${detection.centroid.lat.toFixed(4)}°N, ${detection.centroid.lng.toFixed(4)}°E`, { permanent: false });
      layerGroup.addLayer(centroidMarker);
    }

    // 4. Hydrodynamic Hindcast Trajectory (Backtrack to Probable Origin)
    if (layers.hindcast && drift?.hindcast && drift.hindcast.length > 0) {
      const hindcastCoords = drift.hindcast.map(step => [step.position.lat, step.position.lng] as [number, number]);
      const hindcastLine = L.polyline(hindcastCoords, {
        color: '#ea580c',
        weight: 3,
        dashArray: '6, 6',
        opacity: 0.9,
      }).bindTooltip('<b>Hindcast Backtrack Trajectory</b> (Lagrangian Leeway Model)', { sticky: true });
      layerGroup.addLayer(hindcastLine);

      // Waypoint markers along hindcast
      drift.hindcast.forEach((step) => {
        if (step.hoursOffset === 0) return;
        const stepIcon = L.divIcon({
          className: 'hindcast-step-dot',
          html: `<div class="w-2.5 h-2.5 bg-amber-500 rounded-full border border-slate-900 shadow"></div>`,
          iconSize: [10, 10],
          iconAnchor: [5, 5],
        });
        const stepMarker = L.marker([step.position.lat, step.position.lng], { icon: stepIcon })
          .bindTooltip(`<b>T${step.hoursOffset}h Hindcast:</b><br/>Time: ${new Date(step.timestamp).toLocaleTimeString()}<br/>Uncertainty: ±${step.uncertaintyRadiusKm} km`, { sticky: true });
        layerGroup.addLayer(stepMarker);
      });
    }

    // 5. Probable Origin Region Uncertainty Ellipse
    if (layers.originUncertainty && drift?.probableOrigin) {
      const origin = drift.probableOrigin;
      const originCircle = L.circle([origin.position.lat, origin.position.lng], {
        radius: (origin.uncertaintyKm || 2.0) * 1000,
        color: '#d97706',
        weight: 2,
        dashArray: '5, 5',
        fillColor: '#f59e0b',
        fillOpacity: 0.2,
      }).bindTooltip(
        `<div class="p-1.5 text-xs font-mono">
          <div class="font-bold text-amber-700 uppercase">Probable Origin Window</div>
          <div>Estimated: ${new Date(origin.estimatedTime).toLocaleTimeString()} UTC</div>
          <div>Uncertainty: ±${origin.uncertaintyKm} km</div>
          <div>Confidence: <b>${origin.confidence}</b></div>
        </div>`,
        { sticky: true }
      );
      layerGroup.addLayer(originCircle);
    }

    // Spill Origin Pin Marker
    if (layers.spillOrigin && drift?.probableOrigin) {
      const origin = drift.probableOrigin;
      const originPinIcon = L.divIcon({
        className: 'origin-pin',
        html: `
          <div class="px-1.5 py-0.5 bg-amber-500 rounded border border-white text-white shadow-md text-[9px] font-mono font-bold flex items-center space-x-1">
            <span>ORIGIN</span>
          </div>
        `,
        iconSize: [50, 20],
        iconAnchor: [25, 10],
      });
      const originMarker = L.marker([origin.position.lat, origin.position.lng], { icon: originPinIcon });
      layerGroup.addLayer(originMarker);
    }

    // 6. Hydrodynamic Forecast Trajectory (48h Forward)
    if (layers.forecast && drift?.forecast && drift.forecast.length > 0) {
      const forecastCoords = drift.forecast.map(step => [step.position.lat, step.position.lng] as [number, number]);
      const forecastLine = L.polyline(forecastCoords, {
        color: '#2563eb',
        weight: 2.5,
        dashArray: '4, 4',
        opacity: 0.8,
      }).bindTooltip('<b>48h Forecast Drift Trajectory</b>', { sticky: true });
      layerGroup.addLayer(forecastLine);
    }

    // 7. AIS Vessels & Trajectory Tracks
    if (aisVessels && aisVessels.length > 0) {
      aisVessels.forEach((vessel) => {
        const isSelected = selectedVesselMmsi === vessel.mmsi;
        const attribution = attributionResults?.find(r => r.mmsi === vessel.mmsi);
        const isPrimary = attribution?.category === 'PRIMARY SOURCE CANDIDATE';
        const isCandidate = attribution?.category === 'SOURCE CANDIDATE' || isPrimary;

        // Draw vessel track line
        if (layers.aisTracks && vessel.track && vessel.track.length > 1) {
          const trackCoords = vessel.track.map(pt => [pt.lat, pt.lng] as [number, number]);
          const trackLine = L.polyline(trackCoords, {
            color: isPrimary ? '#e11d48' : isCandidate ? '#f59e0b' : isSelected ? '#3b82f6' : '#64748b',
            weight: isSelected ? 3.5 : isPrimary ? 3 : 1.5,
            opacity: isSelected ? 0.95 : 0.6,
          });

          trackLine.on('click', () => {
            if (onSelectVessel) onSelectVessel(vessel.mmsi);
          });
          layerGroup.addLayer(trackLine);
        }

        // Draw Vessel Current Position Icon
        if (layers.aisVessels && vessel.track && vessel.track.length > 0) {
          const lastPoint = vessel.track[vessel.track.length - 1];
          const heading = lastPoint.headingDeg || lastPoint.cogDeg || 0;

          const vesselIcon = L.divIcon({
            className: 'custom-vessel-marker',
            html: `
              <div class="relative cursor-pointer group" style="transform: rotate(${heading}deg);">
                <div class="w-5 h-5 rounded-full flex items-center justify-center ${
                  isPrimary
                    ? 'bg-rose-600 ring-4 ring-rose-400/40 text-white animate-pulse'
                    : isCandidate
                    ? 'bg-amber-500 ring-2 ring-amber-300 text-white'
                    : isSelected
                    ? 'bg-blue-600 ring-2 ring-blue-300 text-white'
                    : 'bg-slate-700 text-slate-200'
                } shadow-md">
                  <svg class="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="12 2 22 22 12 18 2 22 12 2"/>
                  </svg>
                </div>
              </div>
            `,
            iconSize: [20, 20],
            iconAnchor: [10, 10],
          });

          const vesselMarker = L.marker([lastPoint.lat, lastPoint.lng], { icon: vesselIcon });

          vesselMarker.bindTooltip(
            `<div class="p-1.5 text-xs font-mono">
              <div class="font-bold text-slate-900">${vessel.name}</div>
              <div class="text-[10px] text-slate-500">MMSI: ${vessel.mmsi} | ${vessel.flag}</div>
              <div>Type: <b>${vessel.vesselType}</b></div>
              <div>SOG: <b>${lastPoint.sogKts} kts</b> | COG: <b>${lastPoint.cogDeg}°</b></div>
              ${attribution ? `<div class="mt-1 pt-1 border-t border-slate-200 font-bold ${isPrimary ? 'text-rose-600' : 'text-amber-600'}">Status: ${attribution.category} (${attribution.attributionScore}/100)</div>` : ''}
            </div>`,
            { sticky: true }
          );

          vesselMarker.on('click', () => {
            if (onSelectVessel) onSelectVessel(vessel.mmsi);
          });

          layerGroup.addLayer(vesselMarker);
        }
      });
    }

    // 8. Closest Point of Approach (CPA) Vectors
    if (layers.cpaLines && attributionResults && drift?.probableOrigin) {
      attributionResults.slice(0, 3).forEach((attr) => {
        if (attr.cpa?.cpaPosition) {
          const originPos = drift.probableOrigin.position;
          const cpaPos = attr.cpa.cpaPosition;

          const cpaLine = L.polyline(
            [
              [originPos.lat, originPos.lng],
              [cpaPos.lat, cpaPos.lng],
            ],
            {
              color: attr.category === 'PRIMARY SOURCE CANDIDATE' ? '#e11d48' : '#d97706',
              weight: 1.5,
              dashArray: '3, 3',
              opacity: 0.85,
            }
          ).bindTooltip(
            `<div class="p-1 text-xs font-mono">
              <b>CPA Vector to ${attr.vesselName}:</b><br/>
              Distance: ${attr.cpa.cpaDistanceKm.toFixed(2)} km<br/>
              Time Delta: ${attr.cpa.timeDifferenceMinutes} min
            </div>`,
            { sticky: true }
          );
          layerGroup.addLayer(cpaLine);
        }
      });
    }

    // 9. Metocean Wind & Current Vector Arrows
    if (metocean?.location) {
      const { location, windSpeedKts, windDirectionDeg, currentSpeedKts, currentDirectionDeg } = metocean;

      if (layers.windVector) {
        const windRad = ((windDirectionDeg + 180) * Math.PI) / 180;
        const windEndLat = location.lat + Math.cos(windRad) * 0.035;
        const windEndLng = location.lng + (Math.sin(windRad) * 0.035) / Math.cos((location.lat * Math.PI) / 180);

        const windLine = L.polyline(
          [
            [location.lat, location.lng],
            [windEndLat, windEndLng],
          ],
          { color: '#0284c7', weight: 2.5, opacity: 0.8 }
        ).bindTooltip(`<b>Wind Vector:</b> ${windSpeedKts} kts from ${windDirectionDeg}°`, { sticky: true });
        layerGroup.addLayer(windLine);
      }

      if (layers.currentVector) {
        const currRad = (currentDirectionDeg * Math.PI) / 180;
        const currEndLat = location.lat + Math.cos(currRad) * 0.025;
        const currEndLng = location.lng + (Math.sin(currRad) * 0.025) / Math.cos((location.lat * Math.PI) / 180);

        const currLine = L.polyline(
          [
            [location.lat, location.lng],
            [currEndLat, currEndLng],
          ],
          { color: '#10b981', weight: 2.5, opacity: 0.8 }
        ).bindTooltip(`<b>Surface Current Vector:</b> ${currentSpeedKts} kts toward ${currentDirectionDeg}°`, { sticky: true });
        layerGroup.addLayer(currLine);
      }
    }
  }, [activeCase, layers, selectedVesselMmsi, baseMapType]);

  const copyCoordinates = () => {
    if (!inspectedCoord) return;
    navigator.clipboard.writeText(`${inspectedCoord.lat.toFixed(6)}, ${inspectedCoord.lng.toFixed(6)}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const centerOnSlick = () => {
    const map = mapInstanceRef.current;
    if (!map || !activeCase.detection?.centroid) return;
    map.setView([activeCase.detection.centroid.lat, activeCase.detection.centroid.lng], 12);
  };

  const centerOnOrigin = () => {
    const map = mapInstanceRef.current;
    if (!map || !activeCase.drift?.probableOrigin?.position) return;
    map.setView([activeCase.drift.probableOrigin.position.lat, activeCase.drift.probableOrigin.position.lng], 13);
  };

  return (
    <div className={`relative rounded-lg overflow-hidden border border-slate-200 bg-white shadow-sm font-mono flex flex-col ${isExpanded ? 'fixed inset-4 z-50 h-[calc(100vh-2rem)]' : 'h-[540px]'}`}>
      
      {/* Map Header Status & Controls */}
      <div className="p-3 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 z-10 select-none">
        
        {/* Left: Basemap Mode & Coordinate Tag */}
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1 px-2 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-700 text-[11px] font-bold">
            <Globe className="w-3.5 h-3.5" />
            <span>BASEMAP: {baseMapType === 'osm' ? 'OPENSTREETMAP' : baseMapType.toUpperCase()}</span>
          </div>

          <div className="hidden sm:flex items-center space-x-1 px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700 text-[11px]">
            <MapPin className="w-3 h-3 text-slate-500" />
            <span>
              {inspectedCoord
                ? `${inspectedCoord.lat.toFixed(4)}°N, ${inspectedCoord.lng.toFixed(4)}°E`
                : 'Click map to inspect coordinates'}
            </span>
            {inspectedCoord && (
              <button
                onClick={copyCoordinates}
                className="ml-1 p-0.5 hover:text-blue-600 transition"
                title="Copy coordinates"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
              </button>
            )}
          </div>
        </div>

        {/* Right: Basemap Switcher & Quick Navigation */}
        <div className="flex items-center space-x-2 text-xs">
          
          {/* Basemap Selection */}
          <div className="flex bg-slate-100 p-0.5 rounded border border-slate-200 text-[10px] font-bold overflow-x-auto max-w-[460px]">
            <button
              onClick={() => setBaseMapType('osm')}
              className={`px-2 py-0.5 rounded transition ${baseMapType === 'osm' ? 'bg-blue-600 text-white shadow-sm font-bold' : 'text-slate-600 hover:text-slate-900'}`}
              title="OpenStreetMap Standard (Zero API Key)"
            >
              OpenStreetMap
            </button>
            <button
              onClick={() => setBaseMapType('satellite')}
              className={`px-2 py-0.5 rounded transition ${baseMapType === 'satellite' ? 'bg-blue-600 text-white shadow-sm font-bold' : 'text-slate-600 hover:text-slate-900'}`}
              title="Esri World Imagery (Satellite)"
            >
              Satellite
            </button>
            <button
              onClick={() => setBaseMapType('ocean')}
              className={`px-2 py-0.5 rounded transition ${baseMapType === 'ocean' ? 'bg-blue-600 text-white shadow-sm font-bold' : 'text-slate-600 hover:text-slate-900'}`}
              title="Esri Bathymetric Ocean Basemap"
            >
              Ocean
            </button>
            <button
              onClick={() => setBaseMapType('topo')}
              className={`px-2 py-0.5 rounded transition ${baseMapType === 'topo' ? 'bg-blue-600 text-white shadow-sm font-bold' : 'text-slate-600 hover:text-slate-900'}`}
              title="Topographic Basemap"
            >
              Topo
            </button>
            <button
              onClick={() => setBaseMapType('g_hybrid')}
              className={`px-2 py-0.5 rounded transition ${baseMapType === 'g_hybrid' ? 'bg-blue-600 text-white shadow-sm font-bold' : 'text-slate-600 hover:text-slate-900'}`}
              title="Google Maps Hybrid"
            >
              Google Hybrid
            </button>
            <button
              onClick={() => setBaseMapType('offline')}
              className={`px-2 py-0.5 rounded transition flex items-center space-x-1 ${baseMapType === 'offline' ? 'bg-emerald-600 text-white shadow-sm font-bold' : 'text-slate-600 hover:text-slate-900'}`}
              title="Dataset-First Offline Grid (No external network tiles required)"
            >
              <HardDrive className="w-2.5 h-2.5" />
              <span>Offline</span>
            </button>
          </div>

          {/* Quick Focus Buttons */}
          <button
            onClick={() => fitBoundsToAnalysis(true)}
            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded border border-slate-200 text-[10px] font-bold transition flex items-center space-x-1"
            title="Auto-Fit Map to All Analysis Geometries"
          >
            <Focus className="w-3 h-3" />
            <span>Fit Data</span>
          </button>
          <button
            onClick={centerOnSlick}
            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded border border-slate-200 text-[10px] font-bold transition"
            title="Recenter on Detected Slick"
          >
            Slick
          </button>
          <button
            onClick={centerOnOrigin}
            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded border border-slate-200 text-[10px] font-bold transition"
            title="Recenter on Probable Origin"
          >
            Origin
          </button>

          {/* Expand Fullscreen */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition"
            title={isExpanded ? 'Collapse view' : 'Expand view'}
          >
            {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Graceful Basemap Offline Banner if network error occurs */}
      {tileError && baseMapType !== 'offline' && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-800 px-3 py-1 text-xs flex items-center justify-between font-sans z-10">
          <div className="flex items-center space-x-1.5 font-medium">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>Basemap unavailable — analysis layers remain available</span>
          </div>
          <button
            onClick={() => setBaseMapType('offline')}
            className="text-[11px] underline font-bold hover:text-amber-900"
          >
            Switch to Offline Grid
          </button>
        </div>
      )}

      {/* Map Canvas Container */}
      <div
        ref={mapContainerRef}
        className={`w-full flex-1 relative ${baseMapType === 'offline' ? 'bg-[#f1f5f9]' : 'bg-slate-100'}`}
        style={baseMapType === 'offline' ? {
          backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        } : undefined}
      />

      {/* Floating Layer Controls Badge on Map */}
      <div className="absolute top-14 left-3 z-[400] bg-white/95 backdrop-blur border border-slate-200 rounded-lg p-2.5 shadow-md text-[10px] font-mono space-y-1.5 max-w-[210px]">
        <div className="flex items-center space-x-1.5 font-bold text-slate-800 border-b border-slate-100 pb-1">
          <Layers className="w-3.5 h-3.5 text-blue-600" />
          <span className="uppercase">GIS Vector Layers</span>
        </div>

        <div className="space-y-1 text-slate-700">
          <label className="flex items-center space-x-1.5 cursor-pointer hover:text-slate-900">
            <input
              type="checkbox"
              checked={layers.sarRaster}
              onChange={(e) => setLayers({ ...layers, sarRaster: e.target.checked })}
              className="accent-blue-600 rounded"
            />
            <span>SAR Raster</span>
          </label>
          <label className="flex items-center space-x-1.5 cursor-pointer hover:text-slate-900">
            <input
              type="checkbox"
              checked={layers.oilSlick}
              onChange={(e) => setLayers({ ...layers, oilSlick: e.target.checked })}
              className="accent-sky-600 rounded"
            />
            <span className="text-sky-700 font-bold">Oil Slick Polygon</span>
          </label>
          <label className="flex items-center space-x-1.5 cursor-pointer hover:text-slate-900">
            <input
              type="checkbox"
              checked={layers.slickBoundary}
              onChange={(e) => setLayers({ ...layers, slickBoundary: e.target.checked })}
              className="accent-sky-600 rounded"
            />
            <span>Slick Boundary</span>
          </label>
          <label className="flex items-center space-x-1.5 cursor-pointer hover:text-slate-900">
            <input
              type="checkbox"
              checked={layers.spillOrigin}
              onChange={(e) => setLayers({ ...layers, spillOrigin: e.target.checked })}
              className="accent-amber-500 rounded"
            />
            <span>Spill Origin</span>
          </label>
          <label className="flex items-center space-x-1.5 cursor-pointer hover:text-slate-900">
            <input
              type="checkbox"
              checked={layers.originUncertainty}
              onChange={(e) => setLayers({ ...layers, originUncertainty: e.target.checked })}
              className="accent-amber-600 rounded"
            />
            <span>Origin Uncertainty</span>
          </label>
          <label className="flex items-center space-x-1.5 cursor-pointer hover:text-slate-900">
            <input
              type="checkbox"
              checked={layers.hindcast}
              onChange={(e) => setLayers({ ...layers, hindcast: e.target.checked })}
              className="accent-amber-500 rounded"
            />
            <span>Hindcast Path</span>
          </label>
          <label className="flex items-center space-x-1.5 cursor-pointer hover:text-slate-900">
            <input
              type="checkbox"
              checked={layers.forecast}
              onChange={(e) => setLayers({ ...layers, forecast: e.target.checked })}
              className="accent-blue-600 rounded"
            />
            <span>Forecast Path</span>
          </label>
          <label className="flex items-center space-x-1.5 cursor-pointer hover:text-slate-900">
            <input
              type="checkbox"
              checked={layers.aisVessels}
              onChange={(e) => setLayers({ ...layers, aisVessels: e.target.checked })}
              className="accent-blue-600 rounded"
            />
            <span>AIS Vessels ({activeCase.aisVessels?.length || 0})</span>
          </label>
          <label className="flex items-center space-x-1.5 cursor-pointer hover:text-slate-900">
            <input
              type="checkbox"
              checked={layers.aisTracks}
              onChange={(e) => setLayers({ ...layers, aisTracks: e.target.checked })}
              className="accent-blue-600 rounded"
            />
            <span>Vessel Tracks</span>
          </label>
          <label className="flex items-center space-x-1.5 cursor-pointer hover:text-slate-900">
            <input
              type="checkbox"
              checked={layers.cpaLines}
              onChange={(e) => setLayers({ ...layers, cpaLines: e.target.checked })}
              className="accent-rose-600 rounded"
            />
            <span>CPA Approach Lines</span>
          </label>
          <label className="flex items-center space-x-1.5 cursor-pointer hover:text-slate-900">
            <input
              type="checkbox"
              checked={layers.windVector}
              onChange={(e) => setLayers({ ...layers, windVector: e.target.checked })}
              className="accent-sky-600 rounded"
            />
            <span>Wind Vector</span>
          </label>
          <label className="flex items-center space-x-1.5 cursor-pointer hover:text-slate-900">
            <input
              type="checkbox"
              checked={layers.currentVector}
              onChange={(e) => setLayers({ ...layers, currentVector: e.target.checked })}
              className="accent-emerald-600 rounded"
            />
            <span>Ocean Current</span>
          </label>
          <label className="flex items-center space-x-1.5 cursor-pointer hover:text-slate-900">
            <input
              type="checkbox"
              checked={layers.footprint}
              onChange={(e) => setLayers({ ...layers, footprint: e.target.checked })}
              className="accent-blue-600 rounded"
            />
            <span>Analysis Footprint</span>
          </label>
        </div>
      </div>
    </div>
  );
};
