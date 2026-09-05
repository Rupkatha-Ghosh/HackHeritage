import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { 
  Layers, 
  MapPin, 
  Eye, 
  EyeOff, 
  Compass, 
  Waves, 
  Navigation, 
  Anchor, 
  Radio, 
  Maximize2,
  Minimize2,
  Info,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';
import { LocationInfo, GisLayerData, RiskLevel, OceanData, LanguageCode, GeofenceSpatialAnalysis } from '../types';
import { COASTAL_LOCATIONS, MULTILINGUAL_DICTIONARY } from '../data/coastalData';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';

interface InteractiveMapProps {
  location: LocationInfo;
  gisLayers: GisLayerData;
  geofenceAnalysis?: GeofenceSpatialAnalysis;
  ocean: OceanData;
  riskLevel: RiskLevel;
  onSelectLocation: (locKey: string) => void;
  onCoordinateClick?: (lat: number, lon: number) => void;
  language: LanguageCode;
}

export const InteractiveMap: React.FC<InteractiveMapProps> = ({
  location,
  gisLayers,
  geofenceAnalysis,
  ocean,
  riskLevel,
  onSelectLocation,
  onCoordinateClick,
  language
}) => {
  const outerWrapperRef = useRef<HTMLDivElement>(null);
  const dict = MULTILINGUAL_DICTIONARY[language] || MULTILINGUAL_DICTIONARY.en;
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const geojsonLayerRef = useRef<L.GeoJSON | null>(null);
  const targetMarkerRef = useRef<L.Marker | null>(null);
  /* Leaflet drives its camera in JS, so no CSS media query can quiet it. */
  const reducedMotion = usePrefersReducedMotion();

  // Layer toggles state
  const [showHazardZones, setShowHazardZones] = useState<boolean>(true);
  const [showSafeCorridors, setShowSafeCorridors] = useState<boolean>(true);
  const [showBuoys, setShowBuoys] = useState<boolean>(true);
  const [showImbl, setShowImbl] = useState<boolean>(true);
  const [showMpas, setShowMpas] = useState<boolean>(true);
  const [showSstOverlay, setShowSstOverlay] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Native Fullscreen API Handler
  const toggleFullscreen = () => {
    const container = outerWrapperRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      if (container.requestFullscreen) {
        container.requestFullscreen().catch(() => setIsFullscreen(true));
      } else {
        setIsFullscreen(true);
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => setIsFullscreen(false));
      } else {
        setIsFullscreen(false);
      }
    }
  };

  // Fullscreen Change Event Listener
  useEffect(() => {
    const handleFSChange = () => {
      const isFS = Boolean(document.fullscreenElement);
      setIsFullscreen(isFS);
      const map = mapInstanceRef.current;
      if (map) {
        setTimeout(() => map.invalidateSize(), 50);
        setTimeout(() => map.invalidateSize(), 200);
      }
    };

    document.addEventListener('fullscreenchange', handleFSChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFSChange);
    };
  }, []);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [location.latitude, location.longitude],
        zoom: 11,
        zoomControl: false,
        attributionControl: true
      });

      // OpenStreetMap Detailed Map Engine (Google Maps-level details: cities, towns, villages, beaches, ports, roads)
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(map);

      // Custom Zoom control in bottom right
      L.control.zoom({ position: 'bottomright' }).addTo(map);

      // Click event for custom coordinate selection
      map.on('click', (e: L.LeafletMouseEvent) => {
        if (onCoordinateClick) {
          onCoordinateClick(Number(e.latlng.lat.toFixed(4)), Number(e.latlng.lng.toFixed(4)));
        }
      });

      mapInstanceRef.current = map;
    }

    return () => {
      // The console now unmounts whenever the operator returns to the brief, so
      // this teardown is load-bearing: without it every visit leaks a live map,
      // its tile layer and its DOM listeners.
      mapInstanceRef.current?.remove();
      mapInstanceRef.current = null;
      geojsonLayerRef.current = null;
      targetMarkerRef.current = null;
    };
  }, []);

  // Update map view when location changes
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    if (reducedMotion) {
      mapInstanceRef.current.setView([location.latitude, location.longitude], 11, {
        animate: false
      });
      return;
    }
    mapInstanceRef.current.flyTo([location.latitude, location.longitude], 11, {
      duration: 1.2,
      easeLinearity: 0.25
    });
  }, [location.latitude, location.longitude, reducedMotion]);

  // Handle container resize & visibility changes (e.g., tab switches or fullscreen)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Immediately invalidate size to prevent tile vanishing
    map.invalidateSize();

    // Staggered invalidations to account for CSS transition animations
    const t1 = setTimeout(() => map.invalidateSize(), 50);
    const t2 = setTimeout(() => map.invalidateSize(), 150);
    const t3 = setTimeout(() => map.invalidateSize(), 350);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [isFullscreen, location]);

  // Render GeoJSON layers & markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Remove previous geojson layers
    if (geojsonLayerRef.current) {
      map.removeLayer(geojsonLayerRef.current);
    }
    if (targetMarkerRef.current) {
      map.removeLayer(targetMarkerRef.current);
    }

    // Add main location focal marker
    const mainIcon = L.divIcon({
      className: 'custom-anchor-marker',
      html: `
        <div class="relative flex items-center justify-center">
          <div class="absolute w-8 h-8 rounded-full ${riskLevel === 'EXTREME' || riskLevel === 'HIGH' ? 'bg-red-500/30 animate-ping' : 'bg-cyan-500/30 animate-ping'}"></div>
          <div class="w-7 h-7 rounded-full ${riskLevel === 'EXTREME' ? 'bg-red-600' : riskLevel === 'HIGH' ? 'bg-rose-600' : riskLevel === 'MODERATE' ? 'bg-amber-500' : 'bg-cyan-500'} flex items-center justify-center shadow-lg border-2 border-white text-white font-bold text-xs">
            ⚓
          </div>
        </div>
      `,
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });

    targetMarkerRef.current = L.marker([location.latitude, location.longitude], { icon: mainIcon })
      .addTo(map)
      .bindPopup(`
        <div class="p-2 space-y-1">
          <div class="font-bold text-slate-100 text-sm flex items-center gap-1.5">
            <span>⚓ ${location.name}</span>
          </div>
          <p class="text-xs text-slate-300">${location.nearestPort || 'Harbor Point'} • ${location.regionType}</p>
          <div class="pt-1 flex items-center justify-between text-[11px] border-t border-slate-700 font-mono">
            <span class="text-cyan-400">Hs: ${ocean.waveHeightMeters}m</span>
            <span class="text-amber-400">Risk: ${riskLevel}</span>
          </div>
        </div>
      `);

    // Render GIS GeoJSON Features
    if (gisLayers && gisLayers.features) {
      const geoLayer = L.geoJSON(gisLayers as any, {
        filter: (feature) => {
          const cat = feature.properties.category;
          if (cat === 'hazard_zone' && !showHazardZones) return false;
          if (cat === 'precaution_zone' && !showHazardZones) return false;
          if (cat === 'safe_corridor' && !showSafeCorridors) return false;
          if (cat === 'buoy_station' && !showBuoys) return false;
          if (cat === 'international_boundary' && !showImbl) return false;
          if (cat === 'marine_protected_area' && !showMpas) return false;
          return true;
        },
        style: (feature) => {
          const cat = feature?.properties?.category;
          if (cat === 'international_boundary') {
            return {
              color: '#f43f5e',
              weight: 3.5,
              opacity: 0.95,
              dashArray: '8, 6'
            };
          }
          if (cat === 'marine_protected_area') {
            return {
              color: '#10b981',
              weight: 2,
              opacity: 0.9,
              fillColor: '#059669',
              fillOpacity: 0.22,
              dashArray: '5, 5'
            };
          }
          if (cat === 'hazard_zone') {
            const isHighRisk = feature.properties.riskLevel === 'HIGH' || feature.properties.riskLevel === 'EXTREME';
            return {
              color: isHighRisk ? '#d6453d' : '#f2b33d',
              weight: 2,
              opacity: 0.85,
              fillColor: isHighRisk ? '#a52a24' : '#de9a1f',
              fillOpacity: 0.25,
              dashArray: '5, 5'
            };
          }
          if (cat === 'precaution_zone') {
            return {
              color: '#2c7a97',
              weight: 1.5,
              opacity: 0.7,
              fillColor: '#1e5f7a',
              fillOpacity: 0.15
            };
          }
          if (cat === 'safe_corridor') {
            return {
              color: '#45bb90',
              weight: 3.5,
              opacity: 0.9,
              dashArray: '2, 6'
            };
          }
          return { color: '#4a7189', weight: 1 };
        },
        pointToLayer: (feature, latlng) => {
          const cat = feature.properties.category;
          if (cat === 'international_boundary') {
            const borderIcon = L.divIcon({
              className: 'imbl-marker-icon',
              html: `
                <div class="relative flex items-center justify-center">
                  <div class="w-6 h-6 rounded-full bg-rose-600 border-2 border-white shadow-lg flex items-center justify-center text-[10px] text-white font-bold animate-pulse">
                    ⚓
                  </div>
                </div>
              `,
              iconSize: [22, 22],
              iconAnchor: [11, 11]
            });
            return L.marker(latlng, { icon: borderIcon });
          }
          if (cat === 'buoy_station') {
            const buoyIcon = L.divIcon({
              className: 'buoy-icon',
              html: `
                <div class="relative flex items-center justify-center">
                  <div class="w-5 h-5 rounded-full bg-purple-500/80 border border-white shadow-md flex items-center justify-center text-[10px] text-white font-mono">
                    📡
                  </div>
                </div>
              `,
              iconSize: [20, 20],
              iconAnchor: [10, 10]
            });
            return L.marker(latlng, { icon: buoyIcon });
          }
          return L.circleMarker(latlng, { radius: 6, color: '#7fd4c1' });
        },
        onEachFeature: (feature, layer) => {
          const p = feature.properties;
          const isBorder = p.category === 'international_boundary';
          const isMpa = p.category === 'marine_protected_area';
          layer.bindPopup(`
            <div class="p-2.5 space-y-2 max-w-[290px]">
              <div class="font-bold ${isBorder ? 'text-rose-400' : isMpa ? 'text-emerald-400' : 'text-slate-100'} text-xs border-b border-slate-700 pb-1 flex items-center gap-1.5">
                <span>${isBorder ? '🛡️' : isMpa ? '🌿' : '⚓'}</span>
                <span>${p.name}</span>
              </div>
              <p class="text-xs text-slate-300 leading-relaxed">${p.description}</p>
              ${p.details ? `
                <div class="text-[11px] font-mono ${isBorder ? 'text-rose-300 bg-rose-950/50 border border-rose-800/60' : isMpa ? 'text-emerald-300 bg-emerald-950/50 border border-emerald-800/60' : 'text-cyan-300 bg-slate-800/80'} p-2 rounded space-y-1">
                  ${Object.entries(p.details).map(([k, v]) => `<div><span class="opacity-75">${k}:</span> <span class="text-slate-100 font-semibold">${Array.isArray(v) ? v.join('; ') : v}</span></div>`).join('')}
                </div>
              ` : ''}
            </div>
          `);
        }
      });

      geoLayer.addTo(map);
      geojsonLayerRef.current = geoLayer;
    }
  }, [gisLayers, location, riskLevel, ocean, showHazardZones, showSafeCorridors, showBuoys, showImbl, showMpas]);

  return (
    <div 
      ref={outerWrapperRef} 
      className={`orca-map-frame relative bg-slate-900 rounded-2xl overflow-hidden shadow-2xl transition-all ${
        isFullscreen ? 'fixed inset-0 z-[9999] w-screen h-screen rounded-none' : 'h-[440px] sm:h-[480px] lg:h-[540px]'
      }`}
    >
      {/* Decorative glowing border frame — purely cosmetic, non-interactive */}
      <div className="orca-frame-glow pointer-events-none absolute inset-0 z-[350] rounded-2xl" />
      <div className="orca-corner orca-corner-tl pointer-events-none" />
      <div className="orca-corner orca-corner-tr pointer-events-none" />
      <div className="orca-corner orca-corner-bl pointer-events-none" />
      <div className="orca-corner orca-corner-br pointer-events-none" />

      {/* Decorative scanline sweep — purely cosmetic, non-interactive */}
      <div className="orca-scanline pointer-events-none absolute inset-0 z-[340] rounded-2xl overflow-hidden" />

      {/* Map Header & Controls Overlay — Stacked layout prevents UI collision */}
      <div className="absolute top-3 left-3 z-[400] flex flex-col items-start gap-2 max-w-[82%] sm:max-w-[88%] lg:max-w-2xl">
        
        {/* Quick Coastal Hub Jump Menu — All 17 Indian Coastal Hubs */}
        <div className="orca-glass-panel p-1.5 flex items-center space-x-1.5 overflow-x-auto max-w-full scrollbar-thin">
          <span className="text-[10px] font-mono uppercase text-slate-400 pl-1.5 flex items-center gap-1 shrink-0">
            <Compass className="h-3 w-3 text-cyan-400" />
            <span className="hidden sm:inline">{dict.coastalHubs}:</span>
          </span>
          {Object.keys(COASTAL_LOCATIONS).map((key) => {
            const loc = COASTAL_LOCATIONS[key];
            if (!loc) return null;
            const isSelected = loc.name.toLowerCase() === location.name.toLowerCase() || location.name.toLowerCase().includes(key);
            const shortName = loc.name.split(' ')[0].replace('/', '');
            return (
              <button
                key={key}
                id={`map-loc-${key}`}
                onClick={() => onSelectLocation(key)}
                className={`px-2 py-0.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all shrink-0 ${
                  isSelected
                    ? 'bg-cyan-500 text-slate-950 shadow-[0_0_12px_rgba(34,211,238,0.6)]'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                {shortName}
              </button>
            );
          })}
        </div>

        {/* Layer Toggles Popover */}
        <div className="orca-glass-panel p-1 flex items-center space-x-1 overflow-x-auto max-w-full scrollbar-thin">
          <button
            onClick={() => setShowHazardZones(!showHazardZones)}
            title="Toggle Hazard Polygons"
            className={`px-2 py-1 rounded-lg text-[11px] font-medium flex items-center gap-1 transition-all whitespace-nowrap ${
              showHazardZones ? 'bg-red-950/70 text-red-300 border border-red-700/50 shadow-[0_0_10px_rgba(239,68,68,0.25)]' : 'text-slate-400 hover:bg-slate-800/60'
            }`}
          >
            <Waves className="h-3 w-3 text-red-400" />
            <span className="hidden md:inline">{dict.hazardZones}</span>
          </button>

          <button
            onClick={() => setShowSafeCorridors(!showSafeCorridors)}
            title="Toggle Safe Navigation Corridors"
            className={`px-2 py-1 rounded-lg text-[11px] font-medium flex items-center gap-1 transition-all whitespace-nowrap ${
              showSafeCorridors ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-700/50 shadow-[0_0_10px_rgba(16,185,129,0.25)]' : 'text-slate-400 hover:bg-slate-800/60'
            }`}
          >
            <Navigation className="h-3 w-3 text-emerald-400" />
            <span className="hidden md:inline">{dict.safeChannels}</span>
          </button>

          <button
            onClick={() => setShowBuoys(!showBuoys)}
            title="Toggle Ocean Buoys"
            className={`px-2 py-1 rounded-lg text-[11px] font-medium flex items-center gap-1 transition-all whitespace-nowrap ${
              showBuoys ? 'bg-purple-950/70 text-purple-300 border border-purple-700/50 shadow-[0_0_10px_rgba(168,85,247,0.25)]' : 'text-slate-400 hover:bg-slate-800/60'
            }`}
          >
            <Radio className="h-3 w-3 text-purple-400" />
            <span className="hidden md:inline">{dict.buoys}</span>
          </button>

          <button
            onClick={() => setShowImbl(!showImbl)}
            title="Toggle International Maritime Boundary Lines (IMBL)"
            className={`px-2 py-1 rounded-lg text-[11px] font-medium flex items-center gap-1 transition-all whitespace-nowrap ${
              showImbl ? 'bg-rose-950/70 text-rose-300 border border-rose-700/50 shadow-[0_0_10px_rgba(244,63,94,0.25)] font-bold' : 'text-slate-400 hover:bg-slate-800/60'
            }`}
          >
            <ShieldAlert className="h-3 w-3 text-rose-400" />
            <span className="hidden sm:inline">IMBL Border</span>
          </button>

          <button
            onClick={() => setShowMpas(!showMpas)}
            title="Toggle Marine Protected Areas (MPAs)"
            className={`px-2 py-1 rounded-lg text-[11px] font-medium flex items-center gap-1 transition-all whitespace-nowrap ${
              showMpas ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-700/50 shadow-[0_0_10px_rgba(16,185,129,0.25)] font-bold' : 'text-slate-400 hover:bg-slate-800/60'
            }`}
          >
            <ShieldCheck className="h-3 w-3 text-emerald-400" />
            <span className="hidden sm:inline">MPA Reserves</span>
          </button>
        </div>

      </div>

      {/* Fullscreen Toggle */}
      <button
        onClick={toggleFullscreen}
        className="orca-glass-panel absolute top-3 right-3 z-[400] p-2 text-slate-300 hover:bg-slate-800/60 transition-all"
        title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Map'}
      >
        {isFullscreen ? <Minimize2 className="h-4 w-4 text-cyan-400" /> : <Maximize2 className="h-4 w-4 text-cyan-400" />}
      </button>

      {/* Real-Time Geofence & Border Proximity HUD (Top Right Under Fullscreen) */}
      {(geofenceAnalysis || (gisLayers as any)?.geofenceAnalysis) && (
        <div className="orca-glass-panel absolute top-14 right-3 z-[400] p-2.5 max-w-[270px] text-xs space-y-1.5 shadow-2xl border border-slate-700/80 hidden sm:block">
          {(() => {
            const geo = geofenceAnalysis || (gisLayers as any).geofenceAnalysis;
            const isBreach = geo.status === 'RESTRICTED_BREACH';
            const isCaution = geo.status === 'CAUTION';
            return (
              <>
                <div className="flex items-center justify-between border-b border-slate-700/60 pb-1">
                  <span className="font-mono text-[10px] uppercase font-bold text-slate-300 flex items-center gap-1">
                    <ShieldAlert className="h-3.5 w-3.5 text-cyan-400" />
                    <span>Geofence Status</span>
                  </span>
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-black uppercase ${
                    isBreach ? 'bg-red-600 text-white animate-pulse' :
                    isCaution ? 'bg-amber-500 text-slate-950' :
                    'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  }`}>
                    {geo.status}
                  </span>
                </div>

                {geo.nearestImbl && (
                  <div className="space-y-0.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-300 truncate max-w-[170px]" title={geo.nearestImbl.boundaryName}>
                        {geo.nearestImbl.boundaryName.split('(')[0].replace('International Maritime Boundary Line', 'IMBL')}
                      </span>
                      <span className={`font-mono font-bold ${
                        geo.nearestImbl.distanceNm <= 3.0 ? 'text-red-400 font-black animate-pulse' :
                        geo.nearestImbl.distanceNm <= 8.0 ? 'text-amber-400' : 'text-slate-300'
                      }`}>
                        {geo.nearestImbl.distanceNm} NM
                      </span>
                    </div>
                    {geo.nearestImbl.bearingDeg !== undefined && (
                      <div className="text-[10px] text-slate-400 font-mono">
                        Bearing: {geo.nearestImbl.bearingDeg}° • ({geo.nearestImbl.severity.replace('_', ' ')})
                      </div>
                    )}
                  </div>
                )}

                {geo.nearestMpa && (
                  <div className="pt-1 border-t border-slate-800 space-y-0.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-300 truncate max-w-[170px]" title={geo.nearestMpa.boundaryName}>
                        {geo.nearestMpa.boundaryName.split(' ')[0]} Sanctuary
                      </span>
                      <span className={`font-mono font-bold ${
                        geo.nearestMpa.distanceNm === 0 ? 'text-red-400 font-black animate-pulse' :
                        geo.nearestMpa.distanceNm <= 3.0 ? 'text-amber-400' : 'text-emerald-400'
                      }`}>
                        {geo.nearestMpa.distanceNm === 0 ? 'INSIDE' : `${geo.nearestMpa.distanceNm} NM`}
                      </span>
                    </div>
                  </div>
                )}

                {geo.activeAlerts?.length > 0 && (
                  <div className="pt-1 border-t border-red-500/30 text-[10px] text-amber-300 flex items-start gap-1 leading-tight">
                    <AlertTriangle className="h-3 w-3 shrink-0 text-amber-400 mt-0.5" />
                    <span>{geo.activeAlerts[0].warningMessage}</span>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* Map Floating Legend (Bottom Left) */}
      <div className="orca-glass-panel absolute bottom-3 left-3 z-[400] p-2.5 text-xs space-y-1.5 max-w-[230px] hidden sm:block">
        <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 uppercase border-b border-slate-700/60 pb-1">
          <span className="flex items-center gap-1">
            <Layers className="h-3 w-3 text-cyan-400" />
            <span>{dict.gisLegend}</span>
          </span>
          <span className="flex items-center gap-1 text-[10px] text-cyan-400">
            <span className="orca-live-dot" />
            Active
          </span>
        </div>
        <div className="space-y-1 text-[11px]">
          <div className="flex items-center space-x-2">
            <span className="w-3.5 h-0.5 bg-rose-500 border border-rose-500 border-dashed"></span>
            <span className="text-slate-300 font-semibold">IMBL Border (1974/PCA)</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-3 h-3 rounded bg-emerald-500/30 border border-emerald-500"></span>
            <span className="text-slate-300 font-semibold">Marine Protected Area</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-3 h-3 rounded bg-red-500/40 border border-red-500"></span>
            <span className="text-slate-300">{dict.offshoreHazard}</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-3 h-3 rounded bg-blue-500/30 border border-blue-400"></span>
            <span className="text-slate-300">{dict.inshoreBuffer}</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-3 h-0.5 bg-emerald-400 border border-emerald-400 border-dashed"></span>
            <span className="text-slate-300">{dict.fairwayChannel}</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500 border border-white"></span>
            <span className="text-slate-300">{dict.buoyStation}</span>
          </div>
        </div>
        <div className="text-[10px] text-slate-500 pt-0.5 font-mono">
          Click any ocean point to analyze
        </div>
      </div>

      {/* Actual Leaflet Container — untouched */}
      <div ref={mapContainerRef} className="w-full h-full" />

    </div>
  );
};
