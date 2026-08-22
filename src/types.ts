export type RiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'EXTREME';

export type LanguageCode = 'en' | 'bn' | 'hi' | 'ta' | 'or' | 'te';

export interface LocationInfo {
  name: string;
  state?: string;
  country: string;
  latitude: number;
  longitude: number;
  regionType: 'coastal_harbor' | 'open_sea' | 'estuary' | 'island' | 'bay';
  depthMeters?: number;
  nearestPort?: string;
}

export interface TimeWindow {
  requestedText: string;
  resolvedStartTime: string; // ISO UTC
  resolvedEndTime: string;   // ISO UTC
  localDisplayTime: string;
  isForecast: boolean;
}

export interface WeatherData {
  airTemperatureC: number;
  windSpeedKts: number;
  windGustKts: number;
  windDirectionDeg: number;
  windDirectionCompass: string;
  precipitationMm: number;
  cloudCoverPct: number;
  visibilityKm: number;
  pressureHpa: number;
  weatherCode: number;
  weatherDescription: string;
  source: string;
  observedAt: string;
}

export interface OceanData {
  waveHeightMeters: number;
  maxWaveHeightMeters: number;
  wavePeriodSec: number;
  waveDirectionDeg: number;
  swellHeightMeters: number;
  swellPeriodSec: number;
  swellDirectionDeg: number;
  seaSurfaceTemperatureC: number;
  currentSpeedKts: number;
  currentDirectionDeg: number;
  salinityPsu: number;
  seaStateIndex: number; // 0-9 Douglas Sea Scale
  seaStateDescription: string;
  tidePhase: 'High Tide' | 'Low Tide' | 'Flood Tide' | 'Ebb Tide';
  tideHeightMeters: number;
  source: string;
  observedAt: string;
}

export type SatelliteStatus = 'LIVE' | 'DEGRADED' | 'UNAVAILABLE' | 'SIMULATED';

export interface SatelliteObservation {
  collectionId: string;
  collectionTitle: string;
  productId: string;
  productUrl?: string;
  platform?: string;
  instrument?: string;
  acquisitionTime?: string;
  cloudCoverPct?: number;
  distanceKm?: number;
}

export interface SatelliteData {
  status: SatelliteStatus;
  satelliteName: string;
  platform?: string;
  productId?: string;
  productUrl?: string;
  acquisitionTime?: string;
  processingTime: string;
  latitude: number;
  longitude: number;
  chlorophyllConcentrationMgM3?: number;
  sstC?: number;
  sstAnomalyC?: number;
  turbidityNTU?: number;
  totalSuspendedSolidsMgL?: number;
  sarRoughnessIndex?: number;
  cloudCoverPct?: number;
  algalBloomDetected?: boolean;
  thermalFrontDetected?: boolean;
  surfaceSlickAnomalies?: boolean;
  confidenceScore?: number;
  source: string;
  sourceUrl: string;
  observationType: 'OBSERVATION' | 'NO_OBSERVATION';
  observationAgeHours?: number;
  warnings: string[];
  observations: SatelliteObservation[];
}

export interface FeatureContribution {
  featureName: string;
  featureValue: string | number;
  unit: string;
  riskWeight: number; // -1.0 to 1.0 (positive increases risk, negative decreases risk)
  impactLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
}

export interface RiskPrediction {
  riskScore: number; // 0 - 100
  riskLevel: RiskLevel;
  confidenceScore: number; // 0 - 100
  modelVersion: string; // e.g. "v2.4-rule-based-marine-scoring"
  predictionTarget: string; // "Small-craft vessel fishing & navigation safety"
  primaryRecommendation: string;
  safetySummary: string;
  actionableAdvisories: string[];
  restrictedCraftTypes: string[];
  safeCraftTypes: string[];
  featureContributions: FeatureContribution[];
  validUntil: string;
  generatedAt: string;
}

export interface GisGeoJsonFeature {
  type: 'Feature';
  geometry: {
    type: 'Polygon' | 'Point' | 'LineString';
    coordinates: any;
  };
  properties: {
    name: string;
    category: 'hazard_zone' | 'precaution_zone' | 'safe_corridor' | 'port_shelter' | 'buoy_station' | 'bathymetry';
    riskLevel?: RiskLevel;
    description: string;
    color: string;
    details?: Record<string, any>;
  };
}

export interface GisLayerData {
  type: 'FeatureCollection';
  features: GisGeoJsonFeature[];
}

export interface EvidenceItem {
  id: string;
  title: string;
  sourceAuthority: string; // e.g. "INCOIS", "IMD", "CMFRI", "Indian Coast Guard", "IMO SOLAS"
  documentType: 'Fisheries Advisory' | 'Ocean State Forecast' | 'Cyclone Bulletin' | 'Maritime Regulation' | 'Scientific Protocol';
  publicationDate: string;
  excerpt: string;
  relevanceScore: number; // 0.0 - 1.0 (BGE-reranker score)
  officialUrl?: string;
  complianceRule?: string;
}

export interface AgentStepTrace {
  agentName: 'Planner' | 'LocationTimeResolver' | 'WeatherAgent' | 'OceanAgent' | 'SatelliteAgent' | 'RiskEngine' | 'GisAgent' | 'EvidenceRetrieval' | 'ResponseGrounding';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  inputSummary: string;
  outputSummary: string;
  logs: string[];
  error?: string;
}

export interface OrcaAnalysisResponse {
  queryId: string;
  originalQuery: string;
  language: LanguageCode;
  detectedIntent: string;
  location: LocationInfo;
  timeWindow: TimeWindow;
  weather: WeatherData;
  ocean: OceanData;
  satellite: SatelliteData;
  risk: RiskPrediction;
  gisLayers: GisLayerData;
  evidence: EvidenceItem[];
  agentTraces: AgentStepTrace[];
  groundedSummary: string;
  translatedSummary?: Record<string, string>;
  isDataDegraded?: boolean;
  warnings?: string[];
  freshnessTimestamp: string;
  officialDisclaimer: string;
}

export interface QueryRequest {
  query: string;
  locationOverride?: string;
  timeOverride?: string;
  language?: LanguageCode;
  includeSatellite?: boolean;
}
