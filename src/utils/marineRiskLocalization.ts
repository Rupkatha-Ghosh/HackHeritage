  language: LanguageCode,
  provider: string,
  retrievedAt: string,
): string {
  const labels: Partial<Record<LanguageCode, { live: string; wave: string; wind: string; swell: string; current: string; sea: string; retrieved: string; advisories: string; evidence: string }>> = {
    en: { live: 'LIVE DATA', wave: 'Significant Wave Height', wind: 'Wind', swell: 'Swell Period', current: 'Current', sea: 'Sea State', retrieved: 'Retrieved', advisories: 'Safety Advisories', evidence: 'Evidence' },
    bn: { live: 'লাইভ তথ্য', wave: 'উল্লেখযোগ্য ঢেউয়ের উচ্চতা', wind: 'বাতাস', swell: 'সোয়েল পর্যায়', current: 'স্রোত', sea: 'সমুদ্র অবস্থা', retrieved: 'সংগ্রহের সময়', advisories: 'নিরাপত্তা নির্দেশিকা', evidence: 'প্রমাণ' },
    hi: { live: 'लाइव डेटा', wave: 'महत्वपूर्ण लहर ऊंचाई', wind: 'हवा', swell: 'स्वेल अवधि', current: 'धारा', sea: 'समुद्री स्थिति', retrieved: 'प्राप्त समय', advisories: 'सुरक्षा सलाह', evidence: 'साक्ष्य' },
    ta: { live: 'நேரடி தரவு', wave: 'குறிப்பிடத்தக்க அலை உயரம்', wind: 'காற்று', swell: 'ஸ்வெல் காலம்', current: 'நீரோட்டம்', sea: 'கடல் நிலை', retrieved: 'பெற்ற நேரம்', advisories: 'பாதுகாப்பு ஆலோசனைகள்', evidence: 'ஆதாரங்கள்' },
    or: { live: 'ଲାଇଭ୍ ତଥ୍ୟ', wave: 'ଗୁରୁତ୍ୱପୂର୍ଣ୍ଣ ଢେଉ ଉଚ୍ଚତା', wind: 'ପବନ', swell: 'ସ୍ୱେଲ୍ ଅବଧି', current: 'ସ୍ରୋତ', sea: 'ସମୁଦ୍ର ଅବସ୍ଥା', retrieved: 'ସଂଗ୍ରହ ସମୟ', advisories: 'ସୁରକ୍ଷା ପରାମର୍ଶ', evidence: 'ପ୍ରମାଣ' },
    te: { live: 'లైవ్ డేటా', wave: 'ముఖ్యమైన అల ఎత్తు', wind: 'గాలి', swell: 'స్వెల్ కాలం', current: 'ప్రవాహం', sea: 'సముద్ర స్థితి', retrieved: 'సేకరించిన సమయం', advisories: 'భద్రతా సూచనలు', evidence: 'ఆధారాలు' }
  };
  const label = labels[language] ?? labels.en ?? {
    live: 'LIVE DATA', wave: 'Significant Wave Height', wind: 'Wind', swell: 'Swell Period', current: 'Current', sea: 'Sea State', retrieved: 'Retrieved', advisories: 'Safety Advisories', evidence: 'Evidence'
  };
  return `${risk.primaryRecommendation}\n\n${risk.safetySummary}\n\n${label.live} (${weather.source} / ${ocean.source}):\n• ${label.wave}: ${ocean.waveHeightMeters}m\n• ${label.wind}: ${weather.windSpeedKts} kts (gusts ${weather.windGustKts} kts)\n• ${label.swell}: ${ocean.swellPeriodSec}s\n• ${label.current}: ${ocean.currentSpeedKts} kts\n• ${label.sea}: ${ocean.seaStateIndex} (${ocean.seaStateDescription})\n• ${label.retrieved}: ${retrievedAt}\n\n${label.advisories}:\n${risk.actionableAdvisories.map((advisory, index) => `${index + 1}. ${advisory}`).join('\n')}\n\n${label.evidence} (${provider}):\n${risk.riskLevel}`;
}