import { LanguageCode, OceanData, RiskPrediction, WeatherData } from '../types';
import { localizeFeatureName } from './presentationLocalization';

type RiskCopy = {
  primary: string;
  summary: (ocean: OceanData, weather: WeatherData) => string;
  advisories: string[];
  restricted: string[];
  safe: string[];
};

const ENGLISH_COPY: Record<RiskPrediction['riskLevel'], RiskCopy> = {
  LOW: {
    primary: 'Favorable conditions. Safe for routine fishing operations.',
    summary: (o, w) => `Normal sea state (Douglas Scale ${o.seaStateIndex}). Wave height is ${o.waveHeightMeters.toFixed(1)}m and wind is ${w.windSpeedKts.toFixed(0)} kts.`,
    advisories: ['Carry lifejackets and verify VHF Marine Channel 16.', 'Observe routine tidal timings near harbor sandbars.'],
    restricted: [],
    safe: ['Traditional non-motorized boats', 'Motorized FRP crafts', 'Mechanized trawlers and gillnetters', 'Commercial vessels'],
  },
  MODERATE: {
    primary: 'Proceed with elevated caution. Small crafts should remain vigilant near breakers.',
    summary: (o, w) => `Moderate sea state (Douglas Scale ${o.seaStateIndex}). Waves are ${o.waveHeightMeters.toFixed(1)}m with gusts up to ${w.windGustKts.toFixed(0)} kts.`,
    advisories: ['Keep small non-motorized boats close to shore.', 'Check anchor lines, bilges, and fuel before departure.', 'Monitor VHF Marine Channel 16 for official updates.'],
    restricted: ['Small unstabilized canoes and rafts'],
    safe: ['Experienced motorized FRP crews', 'Deep-sea mechanized trawlers', 'Coast Guard patrol vessels'],
  },
  HIGH: {
    primary: 'High risk. Small crafts and artisanal boats should not enter open sea.',
    summary: (o, w) => `Rough sea state (Douglas Scale ${o.seaStateIndex}). Waves of ${o.waveHeightMeters.toFixed(1)}m and gusts of ${w.windGustKts.toFixed(0)} kts create serious hazards.`,
    advisories: ['Do not enter deep sea or exposed coastal waters.', 'Vessels already at sea should return to the nearest harbour.', 'Secure moored crafts and strengthen harbor moorings.'],
    restricted: ['All non-motorized crafts', 'Small motorized FRP crafts', 'Recreational water-sport vessels'],
    safe: ['Large all-weather trawlers with caution', 'Coast Guard and naval vessels'],
  },
  EXTREME: {
    primary: 'Extreme hazard. Suspend all marine and fishing activities.',
    summary: (o, w) => `Very rough sea state (Douglas Scale ${o.seaStateIndex}). Waves of ${o.waveHeightMeters.toFixed(1)}m and gusts of ${w.windGustKts.toFixed(0)} kts threaten life and vessel integrity.`,
    advisories: ['No fishing vessel departures are permitted.', 'Evacuate low-lying beach landing areas.', 'Maintain continuous radio watch for disaster instructions.'],
    restricted: ['All fishing crafts', 'Artisanal boats', 'Small and medium trawlers', 'Tugs and barges'],
    safe: ['Emergency rescue vessels only'],
  },
};

const COPY: Partial<Record<LanguageCode, Record<RiskPrediction['riskLevel'], RiskCopy>>> = {
  en: ENGLISH_COPY,
};

const FALLBACK_LABELS = {
  live: 'LIVE DATA', wave: 'Significant Wave Height', wind: 'Wind', swell: 'Swell Period', current: 'Current', sea: 'Sea State', retrieved: 'Retrieved', advisories: 'Safety Advisories', evidence: 'Evidence',
};

const LABELS: Partial<Record<LanguageCode, typeof FALLBACK_LABELS>> = {
  en: FALLBACK_LABELS,
  bn: { live: 'লাইভ তথ্য', wave: 'উল্লেখযোগ্য ঢেউয়ের উচ্চতা', wind: 'বাতাস', swell: 'সোয়েল পর্যায়', current: 'স্রোত', sea: 'সমুদ্র অবস্থা', retrieved: 'সংগ্রহের সময়', advisories: 'নিরাপত্তা নির্দেশিকা', evidence: 'প্রমাণ' },
  hi: { live: 'लाइव डेटा', wave: 'महत्वपूर्ण लहर ऊंचाई', wind: 'हवा', swell: 'स्वेल अवधि', current: 'धारा', sea: 'समुद्री स्थिति', retrieved: 'प्राप्त समय', advisories: 'सुरक्षा सलाह', evidence: 'साक्ष्य' },
  ta: { live: 'நேரடி தரவு', wave: 'குறிப்பிடத்தக்க அலை உயரம்', wind: 'காற்று', swell: 'ஸ்வெல் காலம்', current: 'நீரோட்டம்', sea: 'கடல் நிலை', retrieved: 'பெற்ற நேரம்', advisories: 'பாதுகாப்பு ஆலோசனைகள்', evidence: 'ஆதாரங்கள்' },
  or: { live: 'ଲାଇଭ୍ ତଥ୍ୟ', wave: 'ଗୁରୁତ୍ୱପୂର୍ଣ୍ଣ ଢେଉ ଉଚ୍ଚତା', wind: 'ପବନ', swell: 'ସ୍ୱେଲ୍ ଅବଧି', current: 'ସ୍ରୋତ', sea: 'ସମୁଦ୍ର ଅବସ୍ଥା', retrieved: 'ସଂଗ୍ରହ ସମୟ', advisories: 'ସୁରକ୍ଷା ପରାମର୍ଶ', evidence: 'ପ୍ରମାଣ' },
  te: { live: 'లైవ్ డేటా', wave: 'ముఖ్యమైన అల ఎత్తు', wind: 'గాలి', swell: 'స్వెల్ కాలం', current: 'ప్రవాహం', sea: 'సముద్ర స్థితి', retrieved: 'సేకరించిన సమయం', advisories: 'భద్రతా సూచనలు', evidence: 'ఆధారాలు' },
};

function localizeFeatureDescription(description: string, featureName: string, language: LanguageCode): string {
  if (language === 'en') return description;
  return `${localizeFeatureName(featureName, language)}: ${description}`;
}

export function localizeRiskPrediction(risk: RiskPrediction, weather: WeatherData, ocean: OceanData, language: LanguageCode): RiskPrediction {
  const selected = (COPY[language] ?? COPY.en ?? {})[risk.riskLevel] ?? ENGLISH_COPY[risk.riskLevel];
  return {
    ...risk,
    primaryRecommendation: selected.primary,
    safetySummary: selected.summary(ocean, weather),
    actionableAdvisories: selected.advisories,
    restrictedCraftTypes: selected.restricted,
    safeCraftTypes: selected.safe,
    featureContributions: risk.featureContributions.map(feature => ({
      ...feature,
      description: localizeFeatureDescription(feature.description, feature.featureName, language),
    })),
  };
}

export function buildLocalizedGroundedSummary(
  risk: RiskPrediction,
  weather: WeatherData,
  ocean: OceanData,
  language: LanguageCode,
  provider: string,
  retrievedAt: string,
): string {
  const label = LABELS[language] ?? FALLBACK_LABELS;
  return `${risk.primaryRecommendation}\n\n${risk.safetySummary}\n\n${label.live} (${weather.source} / ${ocean.source}):\n• ${label.wave}: ${ocean.waveHeightMeters}m\n• ${label.wind}: ${weather.windSpeedKts} kts (gusts ${weather.windGustKts} kts)\n• ${label.swell}: ${ocean.swellPeriodSec}s\n• ${label.current}: ${ocean.currentSpeedKts} kts\n• ${label.sea}: ${ocean.seaStateIndex} (${ocean.seaStateDescription})\n• ${label.retrieved}: ${retrievedAt}\n\n${label.advisories}:\n${risk.actionableAdvisories.map((advisory, index) => `${index + 1}. ${advisory}`).join('\n')}\n\n${label.evidence} (${provider}):\n${risk.riskLevel}`;
}
