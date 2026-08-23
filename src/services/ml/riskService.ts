import {
  LocationInfo,
  OceanData,
  RiskLevel,
  RiskPrediction,
  SatelliteData,
  WeatherData,
} from '../../types.ts';

const ML_API_URL = (process.env.ORCA_ML_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
const ML_TIMEOUT_MS = Number(process.env.ORCA_ML_API_TIMEOUT_MS || 3500);

type ImpactLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

interface MlRiskResult {
  success: boolean;
  risk_class: number;
  risk_label: RiskLevel;
  confidence: number;
  probabilities: Record<string, number>;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function riskScoreFromProbabilities(probabilities: Record<string, number>): number {
  const weighted =
    (probabilities.LOW || 0) * 10 +
    (probabilities.MODERATE || 0) * 40 +
    (probabilities.HIGH || 0) * 70 +
    (probabilities.EXTREME || 0) * 95;

  return Math.round(clamp(weighted, 8, 98));
}

function buildFeaturePayload(weather: WeatherData, ocean: OceanData, location: LocationInfo) {
  const observed = new Date(weather.observedAt || new Date().toISOString());

  return {
    wind_speed_kts: weather.windSpeedKts,
    wind_gust_kts: weather.windGustKts,
    wave_height_m: ocean.waveHeightMeters,
    wave_period_s: ocean.wavePeriodSec,
    mean_wave_period_s: ocean.swellPeriodSec,
    wind_direction_deg: weather.windDirectionDeg,
    wave_direction_deg: ocean.waveDirectionDeg,
    air_pressure_hpa: weather.pressureHpa,
    air_temperature_c: weather.airTemperatureC,
    water_temperature_c: ocean.seaSurfaceTemperatureC,
    latitude: location.latitude,
    longitude: location.longitude,
    month: observed.getUTCMonth() + 1,
    hour: observed.getUTCHours(),
  };
}

export async function predictMarineRiskWithMl(
  weather: WeatherData,
  ocean: OceanData,
  satellite: SatelliteData,
  location: LocationInfo,
): Promise<RiskPrediction | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ML_TIMEOUT_MS);

  try {
    const response = await fetch(`${ML_API_URL}/predict-risk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildFeaturePayload(weather, ocean, location)),
      signal: controller.signal,
    });

    if (!response.ok) return null;

    const result = (await response.json()) as MlRiskResult;
    if (!result.success || !result.risk_label || !Number.isFinite(result.confidence)) return null;

    const riskScore = riskScoreFromProbabilities(result.probabilities || {});
    const confidenceScore = Math.round(clamp(result.confidence * 100, 0, 100));

    const mlImpact: ImpactLevel = result.risk_label === 'EXTREME'
      ? 'CRITICAL'
      : result.risk_label === 'HIGH'
        ? 'HIGH'
        : result.risk_label === 'MODERATE'
          ? 'MEDIUM'
          : 'LOW';

    const waveImpact: ImpactLevel = ocean.waveHeightMeters > 2.5
      ? 'CRITICAL'
      : ocean.waveHeightMeters > 1.5
        ? 'HIGH'
        : ocean.waveHeightMeters > 0.8
          ? 'MEDIUM'
          : 'LOW';

    const gustImpact: ImpactLevel = weather.windGustKts > 34
      ? 'CRITICAL'
      : weather.windGustKts > 22
        ? 'HIGH'
        : weather.windGustKts > 15
          ? 'MEDIUM'
          : 'LOW';

    const featureContributions = [
      {
        featureName: 'ML Risk Classification',
        featureValue: result.risk_label,
        unit: 'class',
        riskWeight: clamp((riskScore - 50) / 50, -1, 1),
        impactLevel: mlImpact,
        description: `XGBoost classified the current 14-feature marine state as ${result.risk_label} with ${(result.confidence * 100).toFixed(1)}% probability confidence.`,
      },
      {
        featureName: 'Significant Wave Height (Hs)',
        featureValue: ocean.waveHeightMeters.toFixed(2),
        unit: 'm',
        riskWeight: clamp((ocean.waveHeightMeters - 1.0) / 3.0, -1, 1),
        impactLevel: waveImpact,
        description: `Observed significant wave height is ${ocean.waveHeightMeters.toFixed(2)}m.`,
      },
      {
        featureName: 'Wind Gusts',
        featureValue: weather.windGustKts.toFixed(1),
        unit: 'kts',
        riskWeight: clamp((weather.windGustKts - 15) / 25, -1, 1),
        impactLevel: gustImpact,
        description: `Observed wind gusts reach ${weather.windGustKts.toFixed(1)} knots.`,
      },
    ];

    const advisories: string[] = [];
    const restrictedCraftTypes: string[] = [];
    const safeCraftTypes: string[] = [];

    if (result.risk_label === 'LOW') {
      advisories.push("Conditions are within the model's low-risk operating envelope; maintain normal marine safety procedures.");
      safeCraftTypes.push('Traditional Non-motorized Crafts', 'Motorized FRP Crafts', 'Mechanized Fishing Vessels');
    } else if (result.risk_label === 'MODERATE') {
      advisories.push('Exercise increased caution, particularly during surf-zone crossings and harbour approaches.');
      advisories.push('Verify lifejackets, communications, fuel, bilge and mooring readiness before departure.');
      restrictedCraftTypes.push('Small Unstabilized Non-motorized Crafts');
      safeCraftTypes.push('Motorized FRP Boats with Experienced Crew', 'Mechanized Fishing Vessels');
    } else if (result.risk_label === 'HIGH') {
      advisories.push('Small and exposed craft should not enter open sea under the current model classification.');
      advisories.push('Vessels already at sea should move toward the nearest safe harbour when operationally feasible.');
      restrictedCraftTypes.push('Small Non-motorized Crafts', 'Small Motorized FRP Crafts', 'Recreational Water-sport Vessels');
      safeCraftTypes.push('Large All-Weather Mechanized Vessels with Caution', 'Emergency Response Vessels');
    } else {
      advisories.push('Suspend normal fishing and recreational marine activity until authoritative warnings permit operations.');
      advisories.push('Secure moorings and maintain continuous monitoring of official maritime safety advisories.');
      restrictedCraftTypes.push('All Fishing Crafts', 'Small and Medium Commercial Vessels', 'Recreational Vessels');
      safeCraftTypes.push('Emergency Disaster Response Vessels Only');
    }

    if (satellite.status !== 'LIVE') {
      advisories.push('Satellite observations are unavailable or degraded; treat remote-sensing-derived confidence separately from the ML classification.');
    }

    return {
      riskScore,
      riskLevel: result.risk_label,
      confidenceScore,
      modelVersion: 'orca-xgb-risk-v1',
      predictionTarget: 'Marine environmental risk classification for fishing and navigation safety',
      primaryRecommendation:
        result.risk_label === 'LOW'
          ? 'Favorable modeled conditions with normal safety precautions.'
          : result.risk_label === 'MODERATE'
            ? 'Elevated caution is advised, especially for small craft.'
            : result.risk_label === 'HIGH'
              ? 'High modeled risk: restrict small-craft operations and seek safer conditions.'
              : 'Extreme modeled risk: suspend normal marine operations and follow statutory warnings.',
      safetySummary: `XGBoost marine risk model classified the current environmental state as ${result.risk_label}. Probability distribution: ${Object.entries(result.probabilities || {}).map(([label, value]) => `${label} ${(value * 100).toFixed(1)}%`).join(', ')}.`,
      actionableAdvisories: advisories,
      restrictedCraftTypes,
      safeCraftTypes,
      featureContributions,
      validUntil: new Date(Date.now() + 3 * 3600 * 1000).toISOString(),
      generatedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
