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
  Info
} from 'lucide-react';
import { LocationInfo, GisLayerData, RiskLevel, OceanData, LanguageCode } from '../types';
import { COASTAL_LOCATIONS, MULTILINGUAL_DICTIONARY } from '../data/coastalData';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';

interface InteractiveMapProps {
  location: LocationInfo;
  gisLayers: GisLayerData;
  ocean: OceanData;
  riskLevel: RiskLevel;
  onSelectLocation: (locKey: string) => void;
  onCoordinateClick?: (lat: number, lon: number) => void;
  language: LanguageCode;
}

export const InteractiveMap: React.FC<InteractiveMapProps> = ({
  location,
  gisLayers,
  ocean,
  riskLevel,
  onSelectLocation,
  onCoordinateClick,
  language
}) => {
  const dict = MULTILINGUAL_DICTIONARY[language] || MULTILINGUAL_DICTIONARY.en;
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const geojsonLayerRef = useRef<L.GeoJSON | null>(null);
  const targetMarkerRef = useRef<L.Marker | null>(null);
  /* Leaflet drives its camera in JS, so no CSS media query can quiet it. */
  const reducedMotion = usePrefersReducedMotion();

  // Layer toggles state
  const [showHazardZones, setShowHazardZones] = useState<boolean>(true);
  const [showSafeCorridors, setShowSafeCorridors] = useState<boolean>(true);
  const [showBuoys, setShowBuoys] = useState<boolean>(true);
  const [showSstOverlay, setShowSstOverlay] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

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

      // Add clean dark nautical tiles. CARTO's basemaps are licensed on the
      // condition that CARTO and OpenStreetMap are credited, so the attribution
      // control stays on — styled down to 9px in index.css to keep it discreet.
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        subdomains: 'abcd',
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
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
          return true;
        },
        style: (feature) => {
          const cat = feature?.properties?.category;
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
          layer.bindPopup(`
            <div class="p-2 space-y-1.5">
              <div class="font-bold text-slate-100 text-xs border-b border-slate-700 pb-1">
                ${p.name}
              </div>
              <p class="text-xs text-slate-300 leading-relaxed">${p.description}</p>
              ${p.details ? `
                <div class="text-[11px] font-mono text-cyan-300 bg-slate-800/80 p-1.5 rounded">
                  ${Object.entries(p.details).map(([k, v]) => `<div>${k}: <span class="text-slate-100">${v}</span></div>`).join('')}
                </div>
              ` : ''}
            </div>
          `);
        }
      });

      geoLayer.addTo(map);
      geojsonLayerRef.current = geoLayer;
    }
  }, [gisLayers, location, riskLevel, ocean, showHazardZones, showSafeCorridors, showBuoys]);

  return (
    <div className={`relative bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 shadow-xl transition-all ${isFullscreen ? 'fixed inset-4 z-[100]' : 'h-[440px] sm:h-[480px] lg:h-[540px]'}`}>
      
      {/* Map Header & Controls Overlay */}
      <div className="absolute top-3 left-3 z-[400] flex flex-wrap items-center gap-2 max-w-[92%]">
        
        {/* Quick Coastal Hub Jump Menu */}
        <div className="bg-slate-950/90 backdrop-blur-md border border-slate-700/80 rounded-xl p-1 shadow-lg flex items-center space-x-1.5 overflow-x-auto max-w-[280px] sm:max-w-md">
          <span className="text-[10px] font-mono uppercase text-slate-400 pl-1.5 flex items-center gap-1">
            <Compass className="h-3 w-3 text-cyan-400" />
            <span className="hidden sm:inline">{dict.coastalHubs}:</span>
          </span>
          {['digha', 'puri', 'paradeep', 'visakhapatnam', 'kochi', 'chennai', 'mumbai'].map((key) => {
            const loc = COASTAL_LOCATIONS[key];
            if (!loc) return null;
            const isSelected = loc.name.toLowerCase() === location.name.toLowerCase() || location.name.toLowerCase().includes(key);
            return (
              <button
                key={key}
                id={`map-loc-${key}`}
                onClick={() => onSelectLocation(key)}
                className={`px-2 py-0.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  isSelected
                    ? 'bg-cyan-500 text-slate-950 shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                {loc.name.split(' ')[0]}
              </button>
            );
          })}
        </div>

        {/* Layer Toggles Popover */}
        <div className="bg-slate-950/90 backdrop-blur-md border border-slate-700/80 rounded-xl p-1 shadow-lg flex items-center space-x-1">
          <button
            onClick={() => setShowHazardZones(!showHazardZones)}
            title="Toggle Hazard Polygons"
            className={`px-2 py-1 rounded-lg text-[11px] font-medium flex items-center gap-1 transition-all ${
              showHazardZones ? 'bg-red-950/80 text-red-300 border border-red-800/60' : 'text-slate-400 hover:bg-slate-800'
            }`}
          >
            <Waves className="h-3 w-3 text-red-400" />
            <span className="hidden md:inline">{dict.hazardZones}</span>
          </button>

          <button
            onClick={() => setShowSafeCorridors(!showSafeCorridors)}
            title="Toggle Safe Navigation Corridors"
            className={`px-2 py-1 rounded-lg text-[11px] font-medium flex items-center gap-1 transition-all ${
              showSafeCorridors ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/60' : 'text-slate-400 hover:bg-slate-800'
            }`}
          >
            <Navigation className="h-3 w-3 text-emerald-400" />
            <span className="hidden md:inline">{dict.safeChannels}</span>
          </button>

          <button
            onClick={() => setShowBuoys(!showBuoys)}
            title="Toggle Ocean Buoys"
            className={`px-2 py-1 rounded-lg text-[11px] font-medium flex items-center gap-1 transition-all ${
              showBuoys ? 'bg-purple-950/80 text-purple-300 border border-purple-800/60' : 'text-slate-400 hover:bg-slate-800'
            }`}
          >
            <Radio className="h-3 w-3 text-purple-400" />
            <span className="hidden md:inline">{dict.buoys}</span>
          </button>
        </div>

      </div>

      {/* Fullscreen Toggle */}
      <button
        onClick={() => setIsFullscreen(!isFullscreen)}
        className="absolute top-3 right-3 z-[400] bg-slate-950/90 hover:bg-slate-800 text-slate-300 p-2 rounded-xl border border-slate-700/80 shadow-lg transition-all"
        title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Map'}
      >
        {isFullscreen ? <Minimize2 className="h-4 w-4 text-cyan-400" /> : <Maximize2 className="h-4 w-4 text-cyan-400" />}
      </button>

      {/* Map Floating Legend (Bottom Left) */}
      <div className="absolute bottom-3 left-3 z-[400] bg-slate-950/90 backdrop-blur-md border border-slate-800 rounded-xl p-2.5 shadow-xl text-xs space-y-1.5 max-w-[210px] hidden sm:block">
        <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 uppercase border-b border-slate-800 pb-1">
          <span className="flex items-center gap-1">
            <Layers className="h-3 w-3 text-cyan-400" />
            <span>{dict.gisLegend}</span>
          </span>
          <span className="text-[10px] text-cyan-400">{dict.active}</span>
        </div>
        <div className="space-y-1 text-[11px]">
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

      {/* Actual Leaflet Container */}
      <div ref={mapContainerRef} className="w-full h-full" />

    </div>
  );
};
