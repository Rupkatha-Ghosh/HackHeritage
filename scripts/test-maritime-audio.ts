import { voiceWarning } from '../src/services/audio/voiceWarningService.ts';
import { GeofenceAlert, LanguageCode, RiskPrediction } from '../src/types.ts';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${message}`);
    process.exit(1);
  }
}

async function runTests() {
  console.log('🧪 Starting Maritime Audio & Multi-lingual Warning Voice Tests...\n');

  const sampleAlert: GeofenceAlert = {
    boundaryId: 'imbl-india-srilanka',
    boundaryName: 'India-Sri Lanka IMBL (Palk Strait)',
    type: 'IMBL',
    distanceNm: 2.1,
    distanceKm: 3.89,
    severity: 'CRITICAL_BREACH',
    warningMessage: 'Critical breach alert',
    treatyOrAuthority: 'UNCLOS 1974 Treaty',
  };

  const sampleWarningAlert: GeofenceAlert = {
    boundaryId: 'mpa-gahirmatha',
    boundaryName: 'Gahirmatha Marine Sanctuary',
    type: 'MPA',
    distanceNm: 5.4,
    distanceKm: 10.0,
    severity: 'PROXIMITY_WARNING',
    warningMessage: 'Approaching sanctuary',
    treatyOrAuthority: 'Odisha Wildlife Dept',
  };

  const sampleRisk: RiskPrediction = {
    riskScore: 88,
    riskLevel: 'EXTREME',
    confidenceScore: 90,
    modelVersion: 'orca-xgb-2.5',
    predictionTarget: 'forward_6h',
    primaryRecommendation: 'Do not proceed',
    safetySummary: 'Dangerous gale and swell',
    actionableAdvisories: ['Return to port immediately'],
    restrictedCraftTypes: ['all'],
    safeCraftTypes: [],
    featureContributions: [],
    validUntil: new Date().toISOString(),
    generatedAt: new Date().toISOString(),
  };

  const languages: LanguageCode[] = ['en', 'hi', 'bn', 'ta', 'te', 'or', 'ml', 'gu', 'mr', 'kn'];

  console.log('1. Verifying localized phrase generation for all 10 languages:');
  for (const lang of languages) {
    const criticalPhrase = voiceWarning.generateGeofencePhrase(sampleAlert, lang);
    const proximityPhrase = voiceWarning.generateGeofencePhrase(sampleWarningAlert, lang);
    const testPhrase = voiceWarning.generateTestPhrase(lang);
    const weatherPhrase = voiceWarning.generateWeatherPhrase(sampleRisk, lang);

    assert(criticalPhrase.length > 10, `Critical phrase for ${lang} is too short`);
    assert(proximityPhrase.length > 10, `Proximity phrase for ${lang} is too short`);
    assert(testPhrase.length > 10, `Test phrase for ${lang} is too short`);
    assert(weatherPhrase.length > 10, `Weather phrase for ${lang} is too short`);

    console.log(`   ✓ [${lang.toUpperCase()}]:`);
    console.log(`      Critical: "${criticalPhrase.slice(0, 60)}..."`);
    console.log(`      Test:     "${testPhrase.slice(0, 60)}..."`);
  }

  console.log('\n2. Verifying nautical distance formatting inside phrases:');
  const enPhrase = voiceWarning.generateGeofencePhrase(sampleAlert, 'en');
  assert(enPhrase.includes('2.1 nautical miles'), 'English phrase should contain 2.1 nautical miles');
  assert(enPhrase.includes('India-Sri Lanka IMBL'), 'English phrase should name the boundary');

  const hiPhrase = voiceWarning.generateGeofencePhrase(sampleAlert, 'hi');
  assert(hiPhrase.includes('2.1'), 'Hindi phrase should contain distance number 2.1');

  const bnPhrase = voiceWarning.generateGeofencePhrase(sampleAlert, 'bn');
  assert(bnPhrase.includes('2.1'), 'Bengali phrase should contain distance number 2.1');

  console.log('   ✓ Nautical miles and boundary names correctly embedded in alert text');

  console.log('\n3. Verifying mute control states:');
  voiceWarning.setMuted(true);
  assert(voiceWarning.getIsMuted() === true, 'Voice warning should be muted');
  voiceWarning.setMuted(false);
  assert(voiceWarning.getIsMuted() === false, 'Voice warning should be unmuted');
  console.log('   ✓ Mute toggles operate smoothly');

  console.log('\n🎉 ALL MARITIME AUDIO & MULTI-LINGUAL VOICE TESTS PASSED (100% GREEN)!\n');
}

runTests().catch((err) => {
  console.error('Fatal error in tests:', err);
  process.exit(1);
});
