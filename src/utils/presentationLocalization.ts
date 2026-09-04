import { AgentStepTrace, EvidenceItem, FeatureContribution, LanguageCode } from '../types';

const featureNames: Record<LanguageCode, Record<string, string>> = {
  en: {},
  bn: {
    'Significant Wave Height (Hs)': 'উল্লেখযোগ্য ঢেউয়ের উচ্চতা (Hs)',
    'Short Swell Period (Low Surge)': 'ছোট সোয়েল পর্যায় (কম ঢেউ)',
    'Light to Gentle Breeze': 'হালকা থেকে মৃদু বাতাস',
    'Moderate Swell Period': 'মাঝারি সোয়েল পর্যায়',
    'Long-Period Swell Surge': 'দীর্ঘ-পর্যায়ের সোয়েল ঢেউ',
    'Breezy / Fresh Wind': 'বাতাসযুক্ত / তাজা বাতাস',
    'Squally Wind & Strong Gusts': 'ঝোড়ো বাতাস ও শক্তিশালী ঝটকা',
    'Strong Tidal Current Velocity': 'শক্তিশালী জোয়ারের স্রোত',
    'Restricted Visibility / Squall Rain': 'কম দৃশ্যমানতা / ঝোড়ো বৃষ্টি',
    'Satellite Remote-Sensing Anomaly': 'স্যাটেলাইট রিমোট সেন্সিং অস্বাভাবিকতা'
  },
  hi: {
    'Significant Wave Height (Hs)': 'महत्वपूर्ण लहर ऊंचाई (Hs)',
    'Short Swell Period (Low Surge)': 'छोटी स्वेल अवधि (कम लहर)',
    'Light to Gentle Breeze': 'हल्की से मध्यम हवा',
    'Moderate Swell Period': 'मध्यम स्वेल अवधि',
    'Long-Period Swell Surge': 'लंबी अवधि की स्वेल लहर',
    'Breezy / Fresh Wind': 'तेज़ / ताज़ी हवा',
    'Squally Wind & Strong Gusts': 'झोंकेदार हवा और तेज़ झोंके',
    'Strong Tidal Current Velocity': 'तेज़ ज्वारीय धारा',
    'Restricted Visibility / Squall Rain': 'कम दृश्यता / झोंकेदार बारिश',
    'Satellite Remote-Sensing Anomaly': 'उपग्रह रिमोट-सेंसिंग असामान्यता'
  },
  ta: {
    'Significant Wave Height (Hs)': 'குறிப்பிடத்தக்க அலை உயரம் (Hs)',
    'Short Swell Period (Low Surge)': 'குறுகிய ஸ்வெல் காலம் (குறைந்த அலை)',
    'Light to Gentle Breeze': 'மிதமான காற்று',
    'Moderate Swell Period': 'மிதமான ஸ்வெல் காலம்',
    'Long-Period Swell Surge': 'நீண்ட கால ஸ்வெல் அலை',
    'Breezy / Fresh Wind': 'வேகமான காற்று',
    'Squally Wind & Strong Gusts': 'புயல் காற்று மற்றும் வலுவான தாக்கம்',
    'Strong Tidal Current Velocity': 'வலுவான அலைநீரோட்டம்',
    'Restricted Visibility / Squall Rain': 'குறைந்த பார்வை / புயல் மழை',
    'Satellite Remote-Sensing Anomaly': 'செயற்கைக்கோள் உணர்வு மாறுபாடு'
  },
  or: {
    'Significant Wave Height (Hs)': 'ଗୁରୁତ୍ୱପୂର୍ଣ୍ଣ ଢେଉ ଉଚ୍ଚତା (Hs)',
    'Short Swell Period (Low Surge)': 'ଛୋଟ ସ୍ୱେଲ୍ ଅବଧି (କମ୍ ଢେଉ)',
    'Light to Gentle Breeze': 'ହାଲୁକା ପବନ',
    'Moderate Swell Period': 'ମଧ୍ୟମ ସ୍ୱେଲ୍ ଅବଧି',
    'Long-Period Swell Surge': 'ଦୀର୍ଘ ଅବଧିର ସ୍ୱେଲ୍ ଢେଉ',
    'Breezy / Fresh Wind': 'ତୀବ୍ର ପବନ',
    'Squally Wind & Strong Gusts': 'ଝଟକା ପବନ ଓ ଶକ୍ତିଶାଳୀ ଝଟକା',
    'Strong Tidal Current Velocity': 'ଶକ୍ତିଶାଳୀ ଜୁଆର ସ୍ରୋତ',
    'Restricted Visibility / Squall Rain': 'କମ୍ ଦୃଶ୍ୟତା / ଝଡ଼ ବର୍ଷା',
    'Satellite Remote-Sensing Anomaly': 'ସାଟେଲାଇଟ୍ ରିମୋଟ୍ ସେନ୍ସିଂ ଅସ୍ୱାଭାବିକତା'
  },
  te: {
    'Significant Wave Height (Hs)': 'ముఖ్యమైన అల ఎత్తు (Hs)',
    'Short Swell Period (Low Surge)': 'చిన్న స్వెల్ కాలం (తక్కువ అల)',
    'Light to Gentle Breeze': 'తేలికపాటి గాలి',
    'Moderate Swell Period': 'మధ్యస్థ స్వెల్ కాలం',
    'Long-Period Swell Surge': 'దీర్ఘకాల స్వెల్ అల',
    'Breezy / Fresh Wind': 'వేగమైన గాలి',
    'Squally Wind & Strong Gusts': 'ఈదురుగాలి మరియు బలమైన గాలులు',
    'Strong Tidal Current Velocity': 'బలమైన ఆటుపోట్ల ప్రవాహం',
    'Restricted Visibility / Squall Rain': 'తక్కువ దృశ్యమానం / గాలివాన వర్షం',
    'Satellite Remote-Sensing Anomaly': 'ఉపగ్రహ రిమోట్ సెన్సింగ్ మార్పు'
  }
};

const impactLabels: Record<LanguageCode, Record<string, string>> = {
  en: {}, bn: { CRITICAL: 'অতি গুরুতর', HIGH: 'উচ্চ', MEDIUM: 'মাঝারি', LOW: 'কম' },
  hi: { CRITICAL: 'अत्यंत गंभीर', HIGH: 'उच्च', MEDIUM: 'मध्यम', LOW: 'कम' },
  ta: { CRITICAL: 'மிகவும் தீவிரம்', HIGH: 'அதிகம்', MEDIUM: 'மிதம்', LOW: 'குறைவு' },
  or: { CRITICAL: 'ଅତି ଗୁରୁତର', HIGH: 'ଉଚ୍ଚ', MEDIUM: 'ମଧ୍ୟମ', LOW: 'କମ୍' },
  te: { CRITICAL: 'క్లిష్టం', HIGH: 'అధికం', MEDIUM: 'మధ్యస్థం', LOW: 'తక్కువ' }
};

const traceLabels: Record<LanguageCode, Record<string, string>> = {
  en: {},
  bn: { 'Workflow execution graph created.': 'ওয়ার্কফ্লো কার্যসম্পাদন গ্রাফ তৈরি হয়েছে।', 'All Nodes Validated': 'সব নোড যাচাই করা হয়েছে', 'In progress...': 'চলছে...', 'Target:': 'লক্ষ্য:', 'LIVE': 'লাইভ', 'DEGRADED': 'সীমিত', 'UNAVAILABLE': 'অনুপলব্ধ', 'observations': 'পর্যবেক্ষণ', 'features generated.': 'ফিচার তৈরি হয়েছে।', 'evidence items retrieved via': 'প্রমাণ আইটেম সংগ্রহের মাধ্যম:', 'Grounded marine briefing generated from live environmental data plus retrieved authoritative evidence.': 'লাইভ পরিবেশগত তথ্য ও যাচাইকৃত প্রমাণ থেকে সামুদ্রিক briefing তৈরি হয়েছে।' },
  hi: { 'Workflow execution graph created.': 'वर्कफ़्लो निष्पादन ग्राफ बनाया गया।', 'All Nodes Validated': 'सभी नोड सत्यापित', 'In progress...': 'प्रगति में...', 'Target:': 'लक्ष्य:', 'LIVE': 'लाइव', 'DEGRADED': 'सीमित', 'UNAVAILABLE': 'अनुपलब्ध', 'observations': 'अवलोकन', 'features generated.': 'फीचर बनाए गए।', 'evidence items retrieved via': 'साक्ष्य प्राप्त माध्यम:', 'Grounded marine briefing generated from live environmental data plus retrieved authoritative evidence.': 'लाइव पर्यावरणीय डेटा और सत्यापित साक्ष्य से समुद्री सारांश बनाया गया।' },
  ta: { 'Workflow execution graph created.': 'செயல்முறை நிறைவேற்ற வரைபடம் உருவாக்கப்பட்டது.', 'All Nodes Validated': 'அனைத்து முனைகளும் சரிபார்க்கப்பட்டன', 'In progress...': 'நடைபெறுகிறது...', 'Target:': 'இலக்கு:', 'LIVE': 'நேரடி', 'DEGRADED': 'குறைந்த', 'UNAVAILABLE': 'கிடைக்கவில்லை', 'observations': 'கண்காணிப்புகள்', 'features generated.': 'அம்சங்கள் உருவாக்கப்பட்டன.', 'evidence items retrieved via': 'ஆதாரங்கள் பெறப்பட்ட மூலம்:', 'Grounded marine briefing generated from live environmental data plus retrieved authoritative evidence.': 'நேரடி தரவு மற்றும் சரிபார்க்கப்பட்ட ஆதாரங்களிலிருந்து சுருக்கம் உருவாக்கப்பட்டது.' },
  or: { 'Workflow execution graph created.': 'ୱାର୍କଫ୍ଲୋ ଗ୍ରାଫ୍ ତିଆରି ହୋଇଛି।', 'All Nodes Validated': 'ସମସ୍ତ ନୋଡ୍ ଯାଞ୍ଚ ହୋଇଛି', 'In progress...': 'ଚାଲିଛି...', 'Target:': 'ଲକ୍ଷ୍ୟ:', 'LIVE': 'ଲାଇଭ୍', 'DEGRADED': 'ସୀମିତ', 'UNAVAILABLE': 'ଉପଲବ୍ଧ ନୁହେଁ', 'observations': 'ପର୍ଯ୍ୟବେକ୍ଷଣ', 'features generated.': 'ଫିଚର୍ ତିଆରି ହୋଇଛି।', 'evidence items retrieved via': 'ପ୍ରମାଣ ପ୍ରାପ୍ତି ମାଧ୍ୟମ:', 'Grounded marine briefing generated from live environmental data plus retrieved authoritative evidence.': 'ଲାଇଭ୍ ତଥ୍ୟ ଓ ଯାଞ୍ଚିତ ପ୍ରମାଣରୁ ସାରାଂଶ ତିଆରି ହୋଇଛି।' },
  te: { 'Workflow execution graph created.': 'వర్క్‌ఫ్లో గ్రాఫ్ రూపొందించబడింది.', 'All Nodes Validated': 'అన్ని నోడ్‌లు ధృవీకరించబడ్డాయి', 'In progress...': 'పురోగతిలో ఉంది...', 'Target:': 'లక్ష్యం:', 'LIVE': 'లైవ్', 'DEGRADED': 'పరిమితం', 'UNAVAILABLE': 'అందుబాటులో లేదు', 'observations': 'పరిశీలనలు', 'features generated.': 'ఫీచర్లు రూపొందించబడ్డాయి.', 'evidence items retrieved via': 'ఆధారాల పొందిన విధానం:', 'Grounded marine briefing generated from live environmental data plus retrieved authoritative evidence.': 'లైవ్ డేటా మరియు ధృవీకరించిన ఆధారాలతో సముద్ర సారాంశం రూపొందించబడింది.' }
};

export function localizeFeatureName(name: string, language: LanguageCode): string {
  return featureNames[language]?.[name] || name;
}

export function localizeImpactLabel(label: string, language: LanguageCode): string {
  return impactLabels[language]?.[label] || label;
}

export function localizeTraceText(text: string, language: LanguageCode): string {
  let output = text;
  for (const [source, target] of Object.entries(traceLabels[language] || {})) output = output.replaceAll(source, target);
  return output;
}

export function localizeSeaState(value: string, language: LanguageCode): string {
  const values: Record<LanguageCode, Record<string, string>> = {
    en: {}, bn: { Slight: 'মৃদু', Unknown: 'অজানা' }, hi: { Slight: 'हल्की', Unknown: 'अज्ञात' }, ta: { Slight: 'மிதமான', Unknown: 'தெரியவில்லை' }, or: { Slight: 'ହାଲୁକା', Unknown: 'ଅଜଣା' }, te: { Slight: 'స్వల్పం', Unknown: 'తెలియదు' }
  };
  return values[language]?.[value] || value;
}

export function localizeFeature(feature: FeatureContribution, language: LanguageCode): FeatureContribution {
  return { ...feature, featureName: localizeFeatureName(feature.featureName, language), impactLevel: feature.impactLevel };
}

type EvidenceDisplay = Pick<EvidenceItem, 'title' | 'excerpt' | 'complianceRule'>;

const evidenceDisplay: Record<LanguageCode, Record<string, EvidenceDisplay>> = {
  en: {},
  bn: {
    'INCOIS-OSF-2026-041': { title: 'INCOIS সমুদ্র অবস্থা পূর্বাভাস: কারিগরি মাছ ধরার জন্য ঢেউ ও সোয়েল সীমা', excerpt: 'অ-মোটরচালিত ও মোটরচালিত ঐতিহ্যবাহী নৌকার জন্য Hs ১.৮ মিটারের বেশি বা সোয়েল পর্যায় ১৪ সেকেন্ডের বেশি হলে উপকূলীয় ভাঙা ঢেউয়ে উল্টে যাওয়ার ঝুঁকি বাড়ে।', complianceRule: 'নিরাপত্তা নির্দেশনা: Hs ১.৮ মিটার বা সোয়েল পর্যায় ১৪ সেকেন্ড ছাড়ালে কাজ বন্ধ রাখুন।' },
    'IMD-MAR-SQ-89': { title: 'IMD ঘূর্ণিঝড় সতর্কতা ও ঝোড়ো আবহাওয়ার নিয়ম', excerpt: '২৪–৩০ নট বাতাস এবং ৬৫ কিমি/ঘণ্টা পর্যন্ত ঝটকা রুক্ষ সমুদ্র তৈরি করতে পারে। ছোট ট্রলারকে আশ্রয় নিতে হবে।', complianceRule: 'IMD সতর্কতা: ঝটকা ৩০ নট ছাড়ালে গভীর সমুদ্রে যাবেন না।' },
    'CMFRI-PFZ-GUIDE-12': { title: 'CMFRI সম্ভাব্য মাছ ধরার অঞ্চল ও ক্লোরোফিল ফ্রন্ট নিরাপত্তা নির্দেশিকা', excerpt: 'স্যাটেলাইট SST граডিয়েন্ট ও ক্লোরোফিল-এ সম্ভাব্য মাছের জমায়েত নির্দেশ করতে পারে। তবে আবহাওয়া ও সমুদ্রের নিরাপত্তা PFZ ব্যবহারের আগে বিবেচনা করতে হবে।', complianceRule: 'নিরাপত্তা নীতি: PFZ-এর বাণিজ্যিক উপযোগের চেয়ে আবহাওয়া ও সমুদ্রের অবস্থা অগ্রাধিকার পাবে।' },
    'ICG-SOP-VHF-CH16': { title: 'ভারতীয় কোস্ট গার্ড: বাধ্যতামূলক নিরাপত্তা সরঞ্জাম ও বিপদ সংকেত নিয়ম', excerpt: '৩ নটিক্যাল মাইলের বাইরে চলা মাছ ধরার নৌযানে লাইফজ্যাকেট, লাইফবয়, VHF চ্যানেল ১৬, GPS ট্রান্সপন্ডার ও জরুরি ফ্লেয়ার থাকতে হবে।', complianceRule: 'বাধ্যতামূলক: VHF চ্যানেল ১৬, প্রত্যয়িত লাইফজ্যাকেট ও বিপদ সংকেত রাখুন।' },
    'IMO-SOLAS-V-REG34': { title: 'IMO SOLAS অধ্যায় V: নিরাপদ নৌযাত্রা পরিকল্পনা', excerpt: 'সমুদ্রে যাওয়ার আগে নৌযাত্রা পরিকল্পনায় নটিক্যাল চার্ট, আবহাওয়া, সমুদ্রের অবস্থা, জোয়ারের সময় ও বিকল্প আশ্রয় বিবেচনা করতে হবে।', complianceRule: 'নৌযাত্রা নিয়ম: জোয়ার, বাতাস ও স্রোত যাচাই করে যাত্রা পরিকল্পনা করুন।' }
  },
  hi: {
    'INCOIS-OSF-2026-041': { title: 'INCOIS समुद्री पूर्वानुमान: लहर और स्वेल सीमा', excerpt: 'Hs 1.8 मीटर से अधिक या स्वेल अवधि 14 सेकंड से अधिक होने पर छोटी नावों के लिए पलटने का जोखिम बढ़ता है।', complianceRule: 'सुरक्षा निर्देश: Hs 1.8 मीटर या स्वेल अवधि 14 सेकंड से अधिक होने पर संचालन रोकें।' },
    'IMD-MAR-SQ-89': { title: 'IMD चक्रवात चेतावनी और झोंकेदार मौसम नियम', excerpt: '24–30 नॉट हवा और तेज़ झोंके खतरनाक समुद्री स्थिति बना सकते हैं। छोटे ट्रॉलर को आश्रय लेना चाहिए।', complianceRule: 'IMD चेतावनी: झोंके 30 नॉट से अधिक हों तो गहरे समुद्र में न जाएं।' },
    'CMFRI-PFZ-GUIDE-12': { title: 'CMFRI संभावित मछली क्षेत्र और क्लोरोफिल फ्रंट सुरक्षा', excerpt: 'उपग्रह SST और क्लोरोफिल संकेत मछली समूहों की संभावना दिखा सकते हैं। सुरक्षा हमेशा PFZ उपयोग से पहले है।', complianceRule: 'सुरक्षा नीति: PFZ उपयोग से पहले मौसम और समुद्री स्थिति को प्राथमिकता दें।' },
    'ICG-SOP-VHF-CH16': { title: 'भारतीय कोस्ट गार्ड: अनिवार्य सुरक्षा उपकरण नियम', excerpt: '3 समुद्री मील से आगे जाने वाले पोतों में लाइफ जैकेट, लाइफबॉय, VHF चैनल 16, GPS ट्रांसपोंडर और फ्लेयर होने चाहिए।', complianceRule: 'अनिवार्य: VHF चैनल 16, प्रमाणित लाइफ जैकेट और आपात संकेत रखें।' },
    'IMO-SOLAS-V-REG34': { title: 'IMO SOLAS अध्याय V: सुरक्षित यात्रा योजना', excerpt: 'समुद्र में जाने से पहले चार्ट, मौसम, समुद्री स्थिति, ज्वार और वैकल्पिक आश्रय को यात्रा योजना में शामिल करें।', complianceRule: 'यात्रा नियम: ज्वार, हवा और धारा की जांच करके योजना बनाएं।' }
  },
  ta: {
    'INCOIS-OSF-2026-041': { title: 'INCOIS கடல் முன்னறிவிப்பு: அலை மற்றும் ஸ்வெல் வரம்புகள்', excerpt: 'Hs 1.8 மீட்டருக்கு மேல் அல்லது ஸ்வெல் காலம் 14 விநாடிகளுக்கு மேல் இருந்தால் சிறு படகுகள் கவிழும் ஆபத்து அதிகரிக்கும்.', complianceRule: 'பாதுகாப்பு: Hs 1.8 மீட்டர் அல்லது ஸ்வெல் 14 விநாடிகளை கடந்தால் செயல்பாட்டை நிறுத்தவும்.' },
    'IMD-MAR-SQ-89': { title: 'IMD புயல் எச்சரிக்கை மற்றும் காற்றுத்தாக்க விதிமுறை', excerpt: '24–30 நாட்ஸ் காற்று மற்றும் வலுவான தாக்கம் ஆபத்தான கடல் நிலையை உருவாக்கலாம். சிறு டிராலர்கள் அடைக்கலம் தேட வேண்டும்.', complianceRule: 'IMD எச்சரிக்கை: தாக்கம் 30 நாட்ஸை கடந்தால் ஆழ்கடலுக்குச் செல்ல வேண்டாம்.' },
    'CMFRI-PFZ-GUIDE-12': { title: 'CMFRI சாத்தியமான மீன்பிடி பகுதி மற்றும் குளோரோபில் பாதுகாப்பு', excerpt: 'செயற்கைக்கோள் SST மற்றும் குளோரோபில் மீன் கூட்டங்களைச் சுட்டிக்காட்டலாம். கடல் பாதுகாப்பே முதன்மை.', complianceRule: 'பாதுகாப்பு: PFZ பயன்பாட்டிற்கு முன் வானிலை மற்றும் கடல் நிலையை மதிப்பிடவும்.' },
    'ICG-SOP-VHF-CH16': { title: 'இந்திய கடலோர காவல்: கட்டாய பாதுகாப்பு உபகரணங்கள்', excerpt: '3 கடல் மைல்களுக்கு அப்பால் செல்லும் படகுகளில் உயிர்காக்கும் உடை, VHF சேனல் 16, GPS மற்றும் அவசர சிக்னல்கள் இருக்க வேண்டும்.', complianceRule: 'கட்டாயம்: VHF சேனல் 16, சான்றளிக்கப்பட்ட உயிர்காக்கும் உடை மற்றும் அவசர சிக்னல்கள்.' },
    'IMO-SOLAS-V-REG34': { title: 'IMO SOLAS அத்தியாயம் V: பாதுகாப்பான பயணத் திட்டம்', excerpt: 'புறப்படும் முன் கடல் வரைபடம், வானிலை, கடல் நிலை, அலைநேரம் மற்றும் மாற்று அடைக்கலங்களை திட்டமிடவும்.', complianceRule: 'பயண விதி: அலை, காற்று மற்றும் நீரோட்டத்தை சரிபார்க்கவும்.' }
  },
  or: {
    'INCOIS-OSF-2026-041': { title: 'INCOIS ସମୁଦ୍ର ପୂର୍ବାନୁମାନ: ଢେଉ ଓ ସ୍ୱେଲ୍ ସୀମା', excerpt: 'Hs ୧.୮ ମିଟରରୁ ଅଧିକ କିମ୍ବା ସ୍ୱେଲ୍ ୧୪ ସେକେଣ୍ଡରୁ ଅଧିକ ହେଲେ ଛୋଟ ନୌକା ପାଇଁ ବିପଦ ବଢ଼େ।', complianceRule: 'ସୁରକ୍ଷା: Hs ୧.୮ ମିଟର କିମ୍ବା ସ୍ୱେଲ୍ ୧୪ ସେକେଣ୍ଡ ଅତିକ୍ରମ କଲେ କାର୍ଯ୍ୟ ବନ୍ଦ କରନ୍ତୁ।' },
    'IMD-MAR-SQ-89': { title: 'IMD ବାତ୍ୟା ସତର୍କତା ଓ ଝଟକା ପବନ ନିୟମ', excerpt: '୨୪–୩୦ ନଟ୍ ପବନ ଓ ଶକ୍ତିଶାଳୀ ଝଟକା ବିପଦପୂର୍ଣ୍ଣ ସମୁଦ୍ର ଅବସ୍ଥା କରିପାରେ।', complianceRule: 'IMD ସତର୍କତା: ଝଟକା ୩୦ ନଟ୍ ଅତିକ୍ରମ କଲେ ଗଭୀର ସମୁଦ୍ରକୁ ଯାଆନ୍ତୁ ନାହିଁ।' },
    'CMFRI-PFZ-GUIDE-12': { title: 'CMFRI ସମ୍ଭାବ୍ୟ ମାଛଧରା ଅଞ୍ଚଳ ଓ କ୍ଲୋରୋଫିଲ୍ ସୁରକ୍ଷା', excerpt: 'ସାଟେଲାଇଟ୍ SST ଓ କ୍ଲୋରୋଫିଲ୍ ମାଛ ଜମା ହେବାର ସଙ୍କେତ ଦେଇପାରେ। ସୁରକ୍ଷା ସର୍ବପ୍ରଥମ।', complianceRule: 'ସୁରକ୍ଷା: PFZ ପୂର୍ବରୁ ପାଣିପାଗ ଓ ସମୁଦ୍ର ଅବସ୍ଥା ଯାଞ୍ଚ କରନ୍ତୁ।' },
    'ICG-SOP-VHF-CH16': { title: 'ଭାରତୀୟ କୋଷ୍ଟ ଗାର୍ଡ: ବାଧ୍ୟତାମୂଳକ ସୁରକ୍ଷା ଉପକରଣ', excerpt: '୩ ସାମୁଦ୍ରିକ ମାଇଲ୍ ବାହାରେ ଯାଉଥିବା ନୌକାରେ ଲାଇଫଜ୍ୟାକେଟ୍, VHF ଚ୍ୟାନେଲ୍ ୧୬, GPS ଓ ଜରୁରୀ ସଙ୍କେତ ରହିବା ଦରକାର।', complianceRule: 'ବାଧ୍ୟତାମୂଳକ: VHF ୧୬, ପ୍ରମାଣିତ ଲାଇଫଜ୍ୟାକେଟ୍ ଓ ଜରୁରୀ ସଙ୍କେତ।' },
    'IMO-SOLAS-V-REG34': { title: 'IMO SOLAS ଅଧ୍ୟାୟ V: ନିରାପଦ ଯାତ୍ରା ଯୋଜନା', excerpt: 'ଯିବା ପୂର୍ବରୁ ନୌଚାଳନା ଚାର୍ଟ, ପାଣିପାଗ, ସମୁଦ୍ର ଅବସ୍ଥା, ଜୁଆର ଓ ବିକଳ୍ପ ଆଶ୍ରୟ ଯୋଜନା କରନ୍ତୁ।', complianceRule: 'ଯାତ୍ରା ନିୟମ: ଜୁଆର, ପବନ ଓ ସ୍ରୋତ ଯାଞ୍ଚ କରନ୍ତୁ।' }
  },
  te: {
    'INCOIS-OSF-2026-041': { title: 'INCOIS సముద్ర అంచనా: అలలు మరియు స్వెల్ పరిమితులు', excerpt: 'Hs 1.8 మీటర్లకు లేదా స్వెల్ కాలం 14 సెకన్లకు మించి ఉంటే చిన్న పడవలు బోల్తా పడే ప్రమాదం పెరుగుతుంది.', complianceRule: 'భద్రత: Hs 1.8 మీటర్లు లేదా స్వెల్ 14 సెకన్లు దాటితే కార్యకలాపాలు ఆపండి.' },
    'IMD-MAR-SQ-89': { title: 'IMD తుఫాను హెచ్చరిక మరియు ఈదురుగాలి నియమం', excerpt: '24–30 నాట్ల గాలి మరియు బలమైన గాలులు ప్రమాదకర సముద్ర స్థితిని సృష్టించవచ్చు.', complianceRule: 'IMD హెచ్చరిక: గాలులు 30 నాట్లు దాటితే డీప్ సీకి వెళ్లవద్దు.' },
    'CMFRI-PFZ-GUIDE-12': { title: 'CMFRI సంభావ్య చేపల వేట ప్రాంతం మరియు క్లోరోఫిల్ భద్రత', excerpt: 'ఉపగ్రహ SST మరియు క్లోరోఫిల్ చేపల సమూహాలను సూచించవచ్చు. సముద్ర భద్రతకు ప్రాధాన్యత ఇవ్వాలి.', complianceRule: 'భద్రత: PFZ ముందు వాతావరణం మరియు సముద్ర పరిస్థితిని తనిఖీ చేయండి.' },
    'ICG-SOP-VHF-CH16': { title: 'భారత కోస్ట్ గార్డ్: తప్పనిసరి భద్రతా పరికరాలు', excerpt: '3 నాటికల్ మైళ్లకు మించి వెళ్లే పడవల్లో లైఫ్ జాకెట్లు, VHF ఛానల్ 16, GPS మరియు అత్యవసర సంకేతాలు ఉండాలి.', complianceRule: 'తప్పనిసరి: VHF 16, ధృవీకరించిన లైఫ్ జాకెట్ మరియు అత్యవసర సంకేతాలు.' },
    'IMO-SOLAS-V-REG34': { title: 'IMO SOLAS అధ్యాయం V: సురక్షిత ప్రయాణ ప్రణాళిక', excerpt: 'బయలుదేరే ముందు నాటికల్ చార్టులు, వాతావరణం, సముద్ర స్థితి, ఆటుపోట్లు మరియు ప్రత్యామ్నాయ ఆశ్రయాలను ప్రణాళిక చేయండి.', complianceRule: 'ప్రయాణ నియమం: ఆటుపోట్లు, గాలి మరియు ప్రవాహాన్ని తనిఖీ చేయండి.' }
  }
};

export function localizeEvidence(item: EvidenceItem, language: LanguageCode): EvidenceDisplay {
  return evidenceDisplay[language]?.[item.id] || { title: item.title, excerpt: item.excerpt, complianceRule: item.complianceRule || '' };
}

export function localizeSatelliteText(text: string, language: LanguageCode): string {
  if (language === 'en') return text;
  const labels: Record<LanguageCode, Record<string, string>> = {
    en: {}, bn: { 'Not derived from available observations': 'উপলব্ধ পর্যবেক্ষণ থেকে নির্ণয় করা যায়নি', 'Detected by satellite processing': 'স্যাটেলাইট প্রক্রিয়ায় শনাক্ত', 'No anomaly detected': 'কোনো অস্বাভাবিকতা নেই', 'No Sentinel-3 water-surface-temperature product was found; SST metrics are unavailable.': 'কোনো Sentinel-3 জল-পৃষ্ঠ তাপমাত্রা পণ্য পাওয়া যায়নি; SST তথ্য অনুপলব্ধ।', 'Best matching optical observation has high cloud cover': 'সেরা অপটিক্যাল পর্যবেক্ষণে মেঘের আচ্ছাদন বেশি' },
    hi: { 'Not derived from available observations': 'उपलब्ध अवलोकनों से निर्धारित नहीं', 'Detected by satellite processing': 'उपग्रह प्रसंस्करण से पता चला', 'No anomaly detected': 'कोई असामान्यता नहीं', 'No Sentinel-3 water-surface-temperature product was found; SST metrics are unavailable.': 'Sentinel-3 जल-सतह तापमान उत्पाद नहीं मिला; SST जानकारी उपलब्ध नहीं।', 'Best matching optical observation has high cloud cover': 'सर्वश्रेष्ठ ऑप्टिकल अवलोकन में बादल अधिक हैं' },
    ta: { 'Not derived from available observations': 'கிடைத்த கண்காணிப்புகளில் இருந்து கணிக்கப்படவில்லை', 'Detected by satellite processing': 'செயற்கைக்கோள் செயலாக்கத்தில் கண்டறியப்பட்டது', 'No anomaly detected': 'மாறுபாடு இல்லை', 'No Sentinel-3 water-surface-temperature product was found; SST metrics are unavailable.': 'Sentinel-3 நீர் மேற்பரப்பு வெப்பநிலை தயாரிப்பு இல்லை; SST தகவல் கிடைக்கவில்லை.', 'Best matching optical observation has high cloud cover': 'சிறந்த ஒளியியல் கண்காணிப்பில் மேக மூடல் அதிகம்' },
    or: { 'Not derived from available observations': 'ଉପଲବ୍ଧ ପର୍ଯ୍ୟବେକ୍ଷଣରୁ ନିର୍ଣ୍ଣୟ ହୋଇନାହିଁ', 'Detected by satellite processing': 'ସାଟେଲାଇଟ୍ ପ୍ରକ୍ରିୟାରେ ଚିହ୍ନଟ', 'No anomaly detected': 'କୌଣସି ଅସ୍ୱାଭାବିକତା ନାହିଁ', 'No Sentinel-3 water-surface-temperature product was found; SST metrics are unavailable.': 'Sentinel-3 ଜଳ ପୃଷ୍ଠ ତାପମାତ୍ରା ଉତ୍ପାଦ ମିଳିଲା ନାହିଁ; SST ତଥ୍ୟ ଉପଲବ୍ଧ ନୁହେଁ।', 'Best matching optical observation has high cloud cover': 'ସର୍ବୋତ୍ତମ ଅପ୍ଟିକାଲ୍ ପର୍ଯ୍ୟବେକ୍ଷଣରେ ମେଘ ଅଧିକ' },
    te: { 'Not derived from available observations': 'అందుబాటులో ఉన్న పరిశీలనలతో నిర్ణయించలేదు', 'Detected by satellite processing': 'ఉపగ్రహ ప్రక్రియలో గుర్తించబడింది', 'No anomaly detected': 'అసాధారణత లేదు', 'No Sentinel-3 water-surface-temperature product was found; SST metrics are unavailable.': 'Sentinel-3 నీటి ఉపరితల ఉష్ణోగ్రత ఉత్పత్తి లేదు; SST సమాచారం అందుబాటులో లేదు.', 'Best matching optical observation has high cloud cover': 'ఉత్తమ ఆప్టికల్ పరిశీలనలో మేఘాల కవరేజ్ ఎక్కువగా ఉంది' }
  };
  let output = text;
  for (const [source, target] of Object.entries(labels[language] || {})) output = output.replace(source, target);
  return output;
}