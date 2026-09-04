import { LanguageCode, OceanData, RiskPrediction, WeatherData } from '../types';
import { localizeFeatureName } from './presentationLocalization';

type RiskCopy = {
  primary: string;
  summary: (ocean: OceanData, weather: WeatherData) => string;
  advisories: string[];
  restricted: string[];
  safe: string[];
};

const copy: Record<LanguageCode, Record<RiskPrediction['riskLevel'], RiskCopy>> = {
  en: {
    LOW: { primary: 'Favorable conditions. Safe for routine fishing operations.', summary: (o, w) => `Normal sea state (Douglas Scale ${o.seaStateIndex}). Wave height is ${o.waveHeightMeters.toFixed(1)}m and wind is ${w.windSpeedKts.toFixed(0)} kts.`, advisories: ['Carry lifejackets and verify VHF Marine Channel 16.', 'Observe routine tidal timings near harbor sandbars.'], restricted: [], safe: ['Traditional non-motorized boats', 'Motorized FRP crafts', 'Mechanized trawlers and gillnetters', 'Commercial vessels'] },
    MODERATE: { primary: 'Proceed with elevated caution. Small crafts should remain vigilant near breakers.', summary: (o, w) => `Moderate sea state (Douglas Scale ${o.seaStateIndex}). Waves are ${o.waveHeightMeters.toFixed(1)}m with gusts up to ${w.windGustKts.toFixed(0)} kts.`, advisories: ['Keep small non-motorized boats close to shore.', 'Check anchor lines, bilges, and fuel before departure.', 'Monitor VHF Marine Channel 16 for official updates.'], restricted: ['Small unstabilized canoes and rafts'], safe: ['Experienced motorized FRP crews', 'Deep-sea mechanized trawlers', 'Coast Guard patrol vessels'] },
    HIGH: { primary: 'High risk. Small crafts and artisanal boats should not enter open sea.', summary: (o, w) => `Rough sea state (Douglas Scale ${o.seaStateIndex}). Waves of ${o.waveHeightMeters.toFixed(1)}m and gusts of ${w.windGustKts.toFixed(0)} kts create serious hazards.`, advisories: ['Do not enter deep sea or exposed coastal waters.', 'Vessels already at sea should return to the nearest harbour.', 'Secure moored crafts and strengthen harbor moorings.'], restricted: ['All non-motorized crafts', 'Small motorized FRP crafts', 'Recreational water-sport vessels'], safe: ['Large all-weather trawlers with caution', 'Coast Guard and naval vessels'] },
    EXTREME: { primary: 'Extreme hazard. Suspend all marine and fishing activities.', summary: (o, w) => `Very rough sea state (Douglas Scale ${o.seaStateIndex}). Waves of ${o.waveHeightMeters.toFixed(1)}m and gusts of ${w.windGustKts.toFixed(0)} kts threaten life and vessel integrity.`, advisories: ['No fishing vessel departures are permitted.', 'Evacuate low-lying beach landing areas.', 'Maintain continuous radio watch for disaster instructions.'], restricted: ['All fishing crafts', 'Artisanal boats', 'Small and medium trawlers', 'Tugs and barges'], safe: ['Emergency rescue vessels only'] }
  },
  bn: {
    LOW: { primary: 'অনুকূল পরিস্থিতি। নিয়মিত মাছ ধরার কাজের জন্য নিরাপদ।', summary: (o, w) => `স্বাভাবিক সমুদ্র অবস্থা (ডগলাস স্কেল ${o.seaStateIndex})। ঢেউ ${o.waveHeightMeters.toFixed(1)} মিটার এবং বাতাস ${w.windSpeedKts.toFixed(0)} নট।`, advisories: ['লাইফজ্যাকেট সঙ্গে রাখুন এবং VHF মেরিন চ্যানেল ১৬ পরীক্ষা করুন।', 'বন্দরের বালুচরের কাছে জোয়ারের সময় মেনে চলুন।'], restricted: [], safe: ['ঐতিহ্যবাহী ছোট নৌকা', 'মোটরচালিত FRP নৌকা', 'যান্ত্রিক ট্রলার ও গিলনেট নৌকা', 'বাণিজ্যিক নৌযান'] },
    MODERATE: { primary: 'বাড়তি সতর্কতার সঙ্গে চলুন। ভাঙা ঢেউয়ের কাছে ছোট নৌকাকে সতর্ক থাকতে হবে।', summary: (o, w) => `মাঝারি সমুদ্র অবস্থা (ডগলাস স্কেল ${o.seaStateIndex})। ঢেউ ${o.waveHeightMeters.toFixed(1)} মিটার, ঝোড়ো হাওয়া ${w.windGustKts.toFixed(0)} নট পর্যন্ত।`, advisories: ['ছোট নৌকা উপকূলের কাছাকাছি রাখুন।', 'যাত্রার আগে নোঙর, বিলজ ও জ্বালানি পরীক্ষা করুন।', 'সরকারি তথ্যের জন্য VHF মেরিন চ্যানেল ১৬ নজরে রাখুন।'], restricted: ['ছোট অস্থিতিশীল ডিঙি ও ভেলা'], safe: ['অভিজ্ঞ মোটরচালিত FRP নৌকা', 'গভীর সমুদ্রের যান্ত্রিক ট্রলার', 'কোস্ট গার্ড টহল নৌকা'] },
    HIGH: { primary: 'উচ্চ ঝুঁকি। ছোট নৌকা ও কারিগরি মাছ ধরার নৌযান সমুদ্রে যাবেন না।', summary: (o, w) => `রুক্ষ সমুদ্র অবস্থা (ডগলাস স্কেল ${o.seaStateIndex})। ${o.waveHeightMeters.toFixed(1)} মিটার ঢেউ ও ${w.windGustKts.toFixed(0)} নট ঝোড়ো হাওয়া গুরুতর বিপদ তৈরি করছে।`, advisories: ['গভীর সমুদ্র বা উন্মুক্ত উপকূলে যাবেন না।', 'সমুদ্রে থাকা নৌযান নিকটতম বন্দরে ফিরে আসুন।', 'নোঙর করা নৌকা সুরক্ষিত করুন এবং দড়ি শক্ত করুন।'], restricted: ['সব অ-মোটরচালিত নৌকা', 'ছোট মোটরচালিত FRP নৌকা', 'জলক্রীড়ার নৌযান'], safe: ['সতর্কতার সঙ্গে বড় ট্রলার', 'কোস্ট গার্ড ও নৌবাহিনীর নৌযান'] },
    EXTREME: { primary: 'চরম বিপদ। সব সামুদ্রিক ও মাছ ধরার কাজ বন্ধ রাখুন।', summary: (o, w) => `অত্যন্ত রুক্ষ সমুদ্র অবস্থা (ডগলাস স্কেল ${o.seaStateIndex})। ${o.waveHeightMeters.toFixed(1)} মিটার ঢেউ ও ${w.windGustKts.toFixed(0)} নট ঝোড়ো হাওয়া প্রাণঘাতী।`, advisories: ['কোনো মাছ ধরার নৌযান সমুদ্রে ছাড়বেন না।', 'নিচু সৈকত ও মাছ নামানোর স্থান থেকে সরে যান।', 'দুর্যোগ ব্যবস্থাপনার নির্দেশের জন্য রেডিও চালু রাখুন।'], restricted: ['সব মাছ ধরার নৌযান', 'ছোট নৌকা', 'ছোট ও মাঝারি ট্রলার', 'টাগ ও বার্জ'], safe: ['শুধু জরুরি উদ্ধার নৌযান'] }
  },
  hi: {
    LOW: { primary: 'अनुकूल परिस्थितियां। नियमित मछली पकड़ने के लिए सुरक्षित।', summary: (o, w) => `सामान्य समुद्री स्थिति (डगलस स्केल ${o.seaStateIndex})। लहर ${o.waveHeightMeters.toFixed(1)} मीटर और हवा ${w.windSpeedKts.toFixed(0)} नॉट।`, advisories: ['लाइफ जैकेट रखें और VHF मरीन चैनल 16 जांचें।', 'बंदरगाह के पास ज्वार का समय ध्यान में रखें।'], restricted: [], safe: ['पारंपरिक छोटी नावें', 'मोटर चालित FRP नावें', 'यांत्रिक ट्रॉलर और गिलनेट नावें', 'व्यावसायिक पोत'] },
    MODERATE: { primary: 'अतिरिक्त सावधानी बरतें। छोटी नावें टूटती लहरों के पास सतर्क रहें।', summary: (o, w) => `मध्यम समुद्री स्थिति (डगलस स्केल ${o.seaStateIndex})। लहर ${o.waveHeightMeters.toFixed(1)} मीटर और झोंके ${w.windGustKts.toFixed(0)} नॉट तक।`, advisories: ['छोटी नावों को तट के पास रखें।', 'प्रस्थान से पहले एंकर, बिल्ज और ईंधन जांचें।', 'आधिकारिक सूचना के लिए VHF चैनल 16 सुनें।'], restricted: ['छोटी अस्थिर डोंगी और राफ्ट'], safe: ['अनुभवी मोटर चालित FRP दल', 'गहरे समुद्र के यांत्रिक ट्रॉलर', 'कोस्ट गार्ड गश्ती पोत'] },
    HIGH: { primary: 'उच्च जोखिम। छोटी नावें और मछुआरे खुले समुद्र में न जाएं।', summary: (o, w) => `रough समुद्री स्थिति (डगलस स्केल ${o.seaStateIndex})। ${o.waveHeightMeters.toFixed(1)} मीटर लहर और ${w.windGustKts.toFixed(0)} नॉट झोंके गंभीर खतरा पैदा करते हैं।`, advisories: ['गहरे समुद्र या खुले तट में न जाएं।', 'समुद्र में मौजूद नावें निकटतम बंदरगाह लौटें।', 'बांधी गई नावों और मूरिंग रस्सियों को सुरक्षित करें।'], restricted: ['सभी गैर-मोटर चालित नावें', 'छोटी FRP नावें', 'जल-क्रीड़ा पोत'], safe: ['सावधानी के साथ बड़े ट्रॉलर', 'कोस्ट गार्ड और नौसेना पोत'] },
    EXTREME: { primary: 'अत्यधिक खतरा। सभी समुद्री और मछली पकड़ने की गतिविधियां रोकें।', summary: (o, w) => `बहुत खराब समुद्री स्थिति (डगलस स्केल ${o.seaStateIndex})। ${o.waveHeightMeters.toFixed(1)} मीटर लहर और ${w.windGustKts.toFixed(0)} नॉट झोंके जीवन के लिए खतरा हैं।`, advisories: ['किसी भी मछली पकड़ने वाले पोत को रवाना न करें।', 'निचले समुद्र तट और लैंडिंग क्षेत्रों से हटें।', 'आपदा निर्देशों के लिए रेडियो निगरानी रखें।'], restricted: ['सभी मछली पकड़ने वाले पोत', 'छोटी नावें', 'छोटे और मध्यम ट्रॉलर', 'टग और बार्ज'], safe: ['केवल आपातकालीन बचाव पोत'] }
  },
  ta: {
    LOW: { primary: 'சாதகமான நிலை. வழக்கமான மீன்பிடிப்புக்கு பாதுகாப்பானது.', summary: (o, w) => `சாதாரண கடல் நிலை (டக்ளஸ் அளவு ${o.seaStateIndex}). அலை ${o.waveHeightMeters.toFixed(1)} மீட்டர், காற்று ${w.windSpeedKts.toFixed(0)} நாட்ஸ்.`, advisories: ['உயிர்காக்கும் உடை அணிந்து VHF கடல் சேனல் 16-ஐ சரிபார்க்கவும்.', 'துறைமுக மணற்பரப்பில் அலைநேரத்தை கவனிக்கவும்.'], restricted: [], safe: ['பாரம்பரிய சிறு படகுகள்', 'மோட்டார் FRP படகுகள்', 'இயந்திர டிராலர்கள்', 'வணிகக் கப்பல்கள்'] },
    MODERATE: { primary: 'கூடுதல் எச்சரிக்கையுடன் செல்லுங்கள். உடையும் அலைகளுக்கு அருகில் சிறு படகுகள் கவனமாக இருக்க வேண்டும்.', summary: (o, w) => `மிதமான கடல் நிலை (டக்ளஸ் அளவு ${o.seaStateIndex}). அலை ${o.waveHeightMeters.toFixed(1)} மீட்டர், காற்றுத்தாக்கம் ${w.windGustKts.toFixed(0)} நாட்ஸ் வரை.`, advisories: ['சிறு படகுகளை கரைக்கு அருகில் வைத்திருங்கள்.', 'புறப்படும் முன் நங்கூரம், பில்ஜ் மற்றும் எரிபொருளை சரிபார்க்கவும்.', 'அதிகாரப்பூர்வ தகவலுக்கு VHF சேனல் 16-ஐ கண்காணிக்கவும்.'], restricted: ['நிலையற்ற சிறு தோணிகள் மற்றும் மிதவைகள்'], safe: ['அனுபவமுள்ள FRP குழுக்கள்', 'ஆழ்கடல் டிராலர்கள்', 'கடலோர காவல் படகுகள்'] },
    HIGH: { primary: 'அதிக இடர். சிறு படகுகள் மற்றும் மீனவர்கள் திறந்த கடலுக்குச் செல்ல வேண்டாம்.', summary: (o, w) => `கரடுமுரடான கடல் நிலை (டக்ளஸ் அளவு ${o.seaStateIndex}). ${o.waveHeightMeters.toFixed(1)} மீட்டர் அலை மற்றும் ${w.windGustKts.toFixed(0)} நாட்ஸ் காற்றுத்தாக்கம் ஆபத்தானது.`, advisories: ['ஆழ்கடல் அல்லது வெளிப்பட்ட கரைக்குச் செல்ல வேண்டாம்.', 'கடலில் உள்ள படகுகள் அருகிலுள்ள துறைமுகத்திற்குத் திரும்ப வேண்டும்.', 'கட்டப்பட்ட படகுகள் மற்றும் நங்கூரக் கயிறுகளைப் பாதுகாக்கவும்.'], restricted: ['அனைத்து மோட்டார் இல்லாத படகுகள்', 'சிறு FRP படகுகள்', 'நீர்விளையாட்டு படகுகள்'], safe: ['எச்சரிக்கையுடன் பெரிய டிராலர்கள்', 'கடலோர காவல் மற்றும் கடற்படை கப்பல்கள்'] },
    EXTREME: { primary: 'தீவிர ஆபத்து. அனைத்து கடல் மற்றும் மீன்பிடி நடவடிக்கைகளையும் நிறுத்துங்கள்.', summary: (o, w) => `மிகவும் மோசமான கடல் நிலை (டக்ளஸ் அளவு ${o.seaStateIndex}). ${o.waveHeightMeters.toFixed(1)} மீட்டர் அலை மற்றும் ${w.windGustKts.toFixed(0)} நாட்ஸ் காற்று உயிருக்கு ஆபத்தானது.`, advisories: ['மீன்பிடி படகுகள் எதையும் புறப்பட விட வேண்டாம்.', 'தாழ்வான கடற்கரை இறங்கும் பகுதிகளை விட்டு வெளியேறுங்கள்.', 'பேரிடர் அறிவுறுத்தல்களுக்கு வானொலியை கண்காணிக்கவும்.'], restricted: ['அனைத்து மீன்பிடி படகுகள்', 'சிறு படகுகள்', 'சிறு மற்றும் நடுத்தர டிராலர்கள்', 'டக் மற்றும் பார்ஜ்கள்'], safe: ['அவசர மீட்பு படகுகள் மட்டும்'] }
  },
  or: {
    LOW: { primary: 'ଅନୁକୂଳ ପରିସ୍ଥିତି। ନିୟମିତ ମାଛଧରା ପାଇଁ ସୁରକ୍ଷିତ।', summary: (o, w) => `ସାଧାରଣ ସମୁଦ୍ର ଅବସ୍ଥା (ଡଗ୍ଲାସ୍ ସ୍କେଲ୍ ${o.seaStateIndex})। ଢେଉ ${o.waveHeightMeters.toFixed(1)} ମିଟର ଏବଂ ପବନ ${w.windSpeedKts.toFixed(0)} ନଟ୍।`, advisories: ['ଲାଇଫଜ୍ୟାକେଟ୍ ରଖନ୍ତୁ ଏବଂ VHF ସାମୁଦ୍ରିକ ଚ୍ୟାନେଲ୍ 16 ଯାଞ୍ଚ କରନ୍ତୁ।', 'ବନ୍ଦର ନିକଟରେ ଜୁଆର ସମୟ ମାନନ୍ତୁ।'], restricted: [], safe: ['ପାରମ୍ପରିକ ଛୋଟ ନୌକା', 'ମୋଟରଚାଳିତ FRP ନୌକା', 'ଯାନ୍ତ୍ରିକ ଟ୍ରଲର୍', 'ବାଣିଜ୍ୟିକ ଜାହାଜ'] },
    MODERATE: { primary: 'ଅଧିକ ସତର୍କତାର ସହିତ ଚାଲନ୍ତୁ। ଭଙ୍ଗା ଢେଉ ନିକଟରେ ଛୋଟ ନୌକା ସାବଧାନ ରହନ୍ତୁ।', summary: (o, w) => `ମଧ୍ୟମ ସମୁଦ୍ର ଅବସ୍ଥା (ଡଗ୍ଲାସ୍ ସ୍କେଲ୍ ${o.seaStateIndex})। ଢେଉ ${o.waveHeightMeters.toFixed(1)} ମିଟର ଏବଂ ଝଟକା ପବନ ${w.windGustKts.toFixed(0)} ନଟ୍ ପର୍ଯ୍ୟନ୍ତ।`, advisories: ['ଛୋଟ ନୌକାକୁ ଉପକୂଳ ନିକଟରେ ରଖନ୍ତୁ।', 'ଯିବା ପୂର୍ବରୁ ନଙ୍ଗର, ବିଲ୍ଜ୍ ଓ ଇନ୍ଧନ ଯାଞ୍ଚ କରନ୍ତୁ।', 'ସରକାରୀ ସୂଚନା ପାଇଁ VHF ଚ୍ୟାନେଲ୍ 16 ଶୁଣନ୍ତୁ।'], restricted: ['ଛୋଟ ଅସ୍ଥିର ଡଙ୍ଗା ଓ ଭେଳା'], safe: ['ଅଭିଜ୍ଞ FRP ଦଳ', 'ଗଭୀର ସମୁଦ୍ର ଟ୍ରଲର୍', 'କୋଷ୍ଟ ଗାର୍ଡ ଟହଲ ନୌକା'] },
    HIGH: { primary: 'ଉଚ୍ଚ ବିପଦ। ଛୋଟ ନୌକା ଓ ମାଛଧରାଳି ଖୋଲା ସମୁଦ୍ରକୁ ଯାଆନ୍ତୁ ନାହିଁ।', summary: (o, w) => `ରୁକ୍ଷ ସମୁଦ୍ର ଅବସ୍ଥା (ଡଗ୍ଲାସ୍ ସ୍କେଲ୍ ${o.seaStateIndex})। ${o.waveHeightMeters.toFixed(1)} ମିଟର ଢେଉ ଓ ${w.windGustKts.toFixed(0)} ନଟ୍ ପବନ ଗୁରୁତର ବିପଦ ସୃଷ୍ଟି କରୁଛି।`, advisories: ['ଗଭୀର ସମୁଦ୍ର କିମ୍ବା ଖୋଲା ଉପକୂଳକୁ ଯାଆନ୍ତୁ ନାହିଁ।', 'ସମୁଦ୍ରରେ ଥିବା ନୌକା ନିକଟତମ ବନ୍ଦରକୁ ଫେରନ୍ତୁ।', 'ବନ୍ଧା ନୌକା ଓ ମୁରିଂ ଦଉଡ଼ି ସୁରକ୍ଷିତ କରନ୍ତୁ।'], restricted: ['ସମସ୍ତ ମୋଟର ନଥିବା ନୌକା', 'ଛୋଟ FRP ନୌକା', 'ଜଳକ୍ରୀଡ଼ା ନୌକା'], safe: ['ସତର୍କତା ସହ ବଡ଼ ଟ୍ରଲର୍', 'କୋଷ୍ଟ ଗାର୍ଡ ଓ ନୌସେନା ଜାହାଜ'] },
    EXTREME: { primary: 'ଅତ୍ୟଧିକ ବିପଦ। ସମସ୍ତ ସାମୁଦ୍ରିକ ଓ ମାଛଧରା କାର୍ଯ୍ୟ ବନ୍ଦ କରନ୍ତୁ।', summary: (o, w) => `ଅତ୍ୟନ୍ତ ଖରାପ ସମୁଦ୍ର ଅବସ୍ଥା (ଡଗ୍ଲାସ୍ ସ୍କେଲ୍ ${o.seaStateIndex})। ${o.waveHeightMeters.toFixed(1)} ମିଟର ଢେଉ ଓ ${w.windGustKts.toFixed(0)} ନଟ୍ ପବନ ଜୀବନ ପାଇଁ ବିପଦପୂର୍ଣ୍ଣ।`, advisories: ['କୌଣସି ମାଛଧରା ନୌକାକୁ ଛାଡ଼ନ୍ତୁ ନାହିଁ।', 'ନିମ୍ନ ସମୁଦ୍ରତଟ ଅବତରଣ ସ୍ଥାନରୁ ସରିଯାଆନ୍ତୁ।', 'ବିପର୍ଯ୍ୟୟ ନିର୍ଦ୍ଦେଶ ପାଇଁ ରେଡିଓ ଶୁଣନ୍ତୁ।'], restricted: ['ସମସ୍ତ ମାଛଧରା ନୌକା', 'ଛୋଟ ନୌକା', 'ଛୋଟ ଓ ମଧ୍ୟମ ଟ୍ରଲର୍', 'ଟଗ୍ ଓ ବାର୍ଜ୍'], safe: ['କେବଳ ଜରୁରୀ ଉଦ୍ଧାର ନୌକା'] }
  },
  te: {
    LOW: { primary: 'అనుకూల పరిస్థితులు. సాధారణ చేపల వేటకు సురక్షితం.', summary: (o, w) => `సాధారణ సముద్ర స్థితి (డగ్లస్ స్కేల్ ${o.seaStateIndex}). అల ${o.waveHeightMeters.toFixed(1)} మీటర్లు, గాలి ${w.windSpeedKts.toFixed(0)} నాట్లు.`, advisories: ['లైఫ్ జాకెట్లు ఉంచి VHF మెరైన్ ఛానల్ 16 తనిఖీ చేయండి.', 'నౌకాశ్రయం దగ్గర ఆటుపోట్ల సమయాన్ని గమనించండి.'], restricted: [], safe: ['సాంప్రదాయ చిన్న పడవలు', 'మోటారు FRP పడవలు', 'మెకనైజ్డ్ ట్రాలర్లు', 'వాణిజ్య నౌకలు'] },
    MODERATE: { primary: 'అదనపు జాగ్రత్తతో వెళ్లండి. విరిగే అలల దగ్గర చిన్న పడవలు అప్రమత్తంగా ఉండాలి.', summary: (o, w) => `మధ్యస్థ సముద్ర స్థితి (డగ్లస్ స్కేల్ ${o.seaStateIndex}). అల ${o.waveHeightMeters.toFixed(1)} మీటర్లు, ఈదురుగాలులు ${w.windGustKts.toFixed(0)} నాట్ల వరకు.`, advisories: ['చిన్న పడవలను తీరానికి దగ్గరగా ఉంచండి.', 'బయలుదేరే ముందు యాంకర్, బిల్జ్ మరియు ఇంధనం తనిఖీ చేయండి.', 'అధికారిక సమాచారం కోసం VHF ఛానల్ 16 వినండి.'], restricted: ['చిన్న అస్థిర పడవలు మరియు తెప్పలు'], safe: ['అనుభవజ్ఞులైన FRP సిబ్బంది', 'డీప్-సీ ట్రాలర్లు', 'కోస్ట్ గార్డ్ పెట్రోల్ పడవలు'] },
    HIGH: { primary: 'అధిక ప్రమాదం. చిన్న పడవలు మరియు మత్స్యకారులు బహిరంగ సముద్రంలోకి వెళ్లకూడదు.', summary: (o, w) => `అల్లకల్లోల సముద్ర స్థితి (డగ్లస్ స్కేల్ ${o.seaStateIndex}). ${o.waveHeightMeters.toFixed(1)} మీటర్ల అలలు మరియు ${w.windGustKts.toFixed(0)} నాట్ల గాలులు తీవ్రమైన ప్రమాదం కలిగిస్తున్నాయి.`, advisories: ['డీప్ సీ లేదా బహిరంగ తీర జలాల్లోకి వెళ్లవద్దు.', 'సముద్రంలోని పడవలు సమీప నౌకాశ్రయానికి తిరిగి రావాలి.', 'కట్టిన పడవలు మరియు మూరింగ్ తాళ్లను భద్రపరచండి.'], restricted: ['అన్ని మోటారు లేని పడవలు', 'చిన్న FRP పడవలు', 'వాటర్ స్పోర్ట్స్ పడవలు'], safe: ['జాగ్రత్తతో పెద్ద ట్రాలర్లు', 'కోస్ట్ గార్డ్ మరియు నేవీ నౌకలు'] },
    EXTREME: { primary: 'తీవ్ర ప్రమాదం. అన్ని సముద్ర మరియు చేపల వేట కార్యకలాపాలను నిలిపివేయండి.', summary: (o, w) => `చాలా చెడ్డ సముద్ర స్థితి (డగ్లస్ స్కేల్ ${o.seaStateIndex}). ${o.waveHeightMeters.toFixed(1)} మీటర్ల అలలు మరియు ${w.windGustKts.toFixed(0)} నాట్ల గాలులు ప్రాణాలకు ముప్పు.`, advisories: ['ఏ చేపల వేట పడవను బయలుదేరనివ్వవద్దు.', 'తక్కువ ఎత్తు తీర ప్రాంతాల నుంచి వెళ్లిపోండి.', 'విపత్తు సూచనల కోసం రేడియో వినండి.'], restricted: ['అన్ని చేపల వేట పడవలు', 'చిన్న పడవలు', 'చిన్న మరియు మధ్యస్థ ట్రాలర్లు', 'టగ్‌లు మరియు బార్జ్‌లు'], safe: ['అత్యవసర రక్షణ నౌకలు మాత్రమే'] }
  }
};

export function localizeRiskPrediction(risk: RiskPrediction, weather: WeatherData, ocean: OceanData, language: LanguageCode): RiskPrediction {
  const selected = copy[language][risk.riskLevel] || copy.en[risk.riskLevel];
  return {
    ...risk,
    primaryRecommendation: selected.primary,
    safetySummary: selected.summary(ocean, weather),
    actionableAdvisories: selected.advisories,
    restrictedCraftTypes: selected.restricted,
    safeCraftTypes: selected.safe,
    featureContributions: risk.featureContributions.map(feature => ({ ...feature, description: localizeFeatureDescription(feature.description, feature.featureName, language) }))
  };
}

function localizeFeatureDescription(description: string, featureName: string, language: LanguageCode): string {
  if (language === 'en') return description;
  const translated: Record<string, string> = {
    bn: 'এই পরিবেশগত উপাদানটি সামুদ্রিক ঝুঁকির সম্ভাবনাকে প্রভাবিত করছে।',
    hi: 'यह पर्यावरणीय कारक समुद्री जोखिम की संभावना को प्रभावित कर रहा है।',
    ta: 'இந்த சுற்றுச்சூழல் காரணி கடல் இடர் சாத்தியத்தை பாதிக்கிறது.',
    or: 'ଏହି ପରିବେଶୀୟ ଉପାଦାନ ସାମୁଦ୍ରିକ ବିପଦର ସମ୍ଭାବନାକୁ ପ୍ରଭାବିତ କରୁଛି।',
    te: 'ఈ పర్యావరణ అంశం సముద్ర ప్రమాద సంభావ్యతను ప్రభావితం చేస్తోంది.'
  };
  return `${translated[language]} (${localizeFeatureName(featureName, language)})`;
}

export function buildLocalizedGroundedSummary(
  risk: RiskPrediction,
  weather: WeatherData,
  ocean: OceanData,
  language: LanguageCode,
  provider: string,
  retrievedAt: string,
): string {
  const labels: Record<LanguageCode, { live: string; wave: string; wind: string; swell: string; current: string; sea: string; retrieved: string; advisories: string; evidence: string }> = {
    en: { live: 'LIVE DATA', wave: 'Significant Wave Height', wind: 'Wind', swell: 'Swell Period', current: 'Current', sea: 'Sea State', retrieved: 'Retrieved', advisories: 'Safety Advisories', evidence: 'Evidence' },
    bn: { live: 'লাইভ তথ্য', wave: 'উল্লেখযোগ্য ঢেউয়ের উচ্চতা', wind: 'বাতাস', swell: 'সোয়েল পর্যায়', current: 'স্রোত', sea: 'সমুদ্র অবস্থা', retrieved: 'সংগ্রহের সময়', advisories: 'নিরাপত্তা নির্দেশিকা', evidence: 'প্রমাণ' },
    hi: { live: 'लाइव डेटा', wave: 'महत्वपूर्ण लहर ऊंचाई', wind: 'हवा', swell: 'स्वेल अवधि', current: 'धारा', sea: 'समुद्री स्थिति', retrieved: 'प्राप्त समय', advisories: 'सुरक्षा सलाह', evidence: 'साक्ष्य' },
    ta: { live: 'நேரடி தரவு', wave: 'குறிப்பிடத்தக்க அலை உயரம்', wind: 'காற்று', swell: 'ஸ்வெல் காலம்', current: 'நீரோட்டம்', sea: 'கடல் நிலை', retrieved: 'பெற்ற நேரம்', advisories: 'பாதுகாப்பு ஆலோசனைகள்', evidence: 'ஆதாரங்கள்' },
    or: { live: 'ଲାଇଭ୍ ତଥ୍ୟ', wave: 'ଗୁରୁତ୍ୱପୂର୍ଣ୍ଣ ଢେଉ ଉଚ୍ଚତା', wind: 'ପବନ', swell: 'ସ୍ୱେଲ୍ ଅବଧି', current: 'ସ୍ରୋତ', sea: 'ସମୁଦ୍ର ଅବସ୍ଥା', retrieved: 'ସଂଗ୍ରହ ସମୟ', advisories: 'ସୁରକ୍ଷା ପରାମର୍ଶ', evidence: 'ପ୍ରମାଣ' },
    te: { live: 'లైవ్ డేటా', wave: 'ముఖ్యమైన అల ఎత్తు', wind: 'గాలి', swell: 'స్వెల్ కాలం', current: 'ప్రవాహం', sea: 'సముద్ర స్థితి', retrieved: 'సేకరించిన సమయం', advisories: 'భద్రతా సూచనలు', evidence: 'ఆధారాలు' }
  };
  const label = labels[language] || labels.en;
  return `${risk.primaryRecommendation}\n\n${risk.safetySummary}\n\n${label.live} (${weather.source} / ${ocean.source}):\n• ${label.wave}: ${ocean.waveHeightMeters}m\n• ${label.wind}: ${weather.windSpeedKts} kts (gusts ${weather.windGustKts} kts)\n• ${label.swell}: ${ocean.swellPeriodSec}s\n• ${label.current}: ${ocean.currentSpeedKts} kts\n• ${label.sea}: ${ocean.seaStateIndex} (${ocean.seaStateDescription})\n• ${label.retrieved}: ${retrievedAt}\n\n${label.advisories}:\n${risk.actionableAdvisories.map((advisory, index) => `${index + 1}. ${advisory}`).join('\n')}\n\n${label.evidence} (${provider}):\n${risk.riskLevel}`;
}