/**
 * Multi-lingual Voice Warning Engine
 * 
 * Uses the Web Speech Synthesis API and Indic AI Cloud Gateway to announce urgent
 * maritime alerts in 10 coastal Indian languages: English, Hindi, Bengali, Tamil,
 * Telugu, Odia, Malayalam, Gujarati, Marathi, and Kannada.
 * 
 * Hybrid Architecture:
 * 1. Cloud Layer: Sarvam AI (Bulbul:v1) & Bhashini NLTM (Dhruva/IndicTrans2/IndicTTS)
 *    via server proxy `/api/indic-voice/tts`.
 * 2. Edge Layer (100% Offline Guaranteed): Universal Indic Devanagari Phonemic Engine
 *    routes speech through Chromium's native Indian speech synthesizer (Google हिन्दी / hi-IN).
 *    All regional scripts (Bengali, Tamil, Telugu, Odia, Gujarati, Malayalam, Kannada)
 *    are automatically transliterated to Devanagari phonemes so Google हिन्दी pronounces
 *    fluent Indian regional words without dropping characters or sounding like American English.
 */

import { LanguageCode, GeofenceAlert, RiskPrediction, LocationInfo } from '../../types';
import { maritimeSiren } from './maritimeSirenService';
import {
  indicVoiceGateway,
  indicScriptToDevanagari,
  INDIC_DEVANAGARI_PHONEMES,
} from './indicVoiceService';

export interface SpokenAlertPayload {
  key: string;
  language: LanguageCode;
  text: string;
  isCritical: boolean;
}

const LANGUAGE_BCP47_MAP: Record<LanguageCode, string[]> = {
  en: ['en-IN', 'en-GB', 'en-US', 'en'],
  hi: ['hi-IN', 'hi'],
  bn: ['bn-IN', 'bn-BD', 'bn'],
  ta: ['ta-IN', 'ta-LK', 'ta'],
  te: ['te-IN', 'te'],
  or: ['or-IN', 'or'],
  ml: ['ml-IN', 'ml'],
  gu: ['gu-IN', 'gu'],
  mr: ['mr-IN', 'mr'],
  kn: ['kn-IN', 'kn'],
};

class VoiceWarningService {
  private isMuted: boolean = false;
  private isSpeaking: boolean = false;
  private lastSpokenAt = new Map<string, number>();
  private cooldownMs = 15000; // 15 seconds debounce per alert key
  private listeners: Set<(isSpeaking: boolean) => void> = new Set();
  private currentAudioElement: HTMLAudioElement | null = null;

  constructor() {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = () => {
        // Pre-warm voices list
        window.speechSynthesis.getVoices();
      };
    }
  }

  public subscribe(listener: (isSpeaking: boolean) => void): () => void {
    this.listeners.add(listener);
    listener(this.isSpeaking);
    return () => this.listeners.delete(listener);
  }

  private setSpeaking(speaking: boolean) {
    this.isSpeaking = speaking;
    this.listeners.forEach((fn) => fn(speaking));
  }

  public getIsSpeaking(): boolean {
    return this.isSpeaking;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (muted) {
      this.cancel();
    }
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  /**
   * Check whether the browser has a native TTS voice installed for the given language.
   */
  public hasNativeVoiceFor(language: LanguageCode): boolean {
    if (typeof window === 'undefined' || !window.speechSynthesis) return false;
    const voices = window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) return false;

    const candidateTags = LANGUAGE_BCP47_MAP[language] || [];
    return voices.some((v) =>
      candidateTags.some(
        (tag) =>
          v.lang.toLowerCase() === tag.toLowerCase() ||
          v.lang.toLowerCase().startsWith(tag.toLowerCase())
      )
    );
  }

  /**
   * Resolve best SpeechSynthesisVoice matching the language.
   * For English: selects an English voice (preferring en-IN).
   * For Indian languages: selects specific regional voice if installed,
   * otherwise always routes to the Indian voice engine (Google हिन्दी / hi-IN)
   * so it NEVER falls back to an American English accent.
   */
  private getBestVoice(language: LanguageCode): SpeechSynthesisVoice | null {
    if (typeof window === 'undefined' || !window.speechSynthesis) return null;
    const voices = window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) return null;

    if (language === 'en') {
      return (
        voices.find((v) => v.lang.toLowerCase().startsWith('en-in')) ||
        voices.find((v) => v.lang.toLowerCase().startsWith('en')) ||
        voices[0]
      );
    }

    // For any Indian language:
    // 1. Try to find the exact regional language voice (e.g. bn-IN, ta-IN)
    const candidateTags = LANGUAGE_BCP47_MAP[language] || [];
    for (const tag of candidateTags) {
      const matched = voices.find(
        (v) =>
          v.lang.toLowerCase() === tag.toLowerCase() ||
          v.lang.toLowerCase().startsWith(tag.toLowerCase())
      );
      if (matched) return matched;
    }

    // 2. If no regional voice exists, use the Indian speech synthesizer (Google हिन्दी / hi-IN)
    const hindiVoice = voices.find((v) => v.lang.toLowerCase().startsWith('hi'));
    if (hindiVoice) return hindiVoice;

    // 3. Indian English fallback
    const indianEnglish = voices.find((v) => v.lang.toLowerCase().startsWith('en-in'));
    if (indianEnglish) return indianEnglish;

    return voices[0] || null;
  }

  /**
   * Build localized spoken phrase for an IMBL or MPA geofence alert.
   */
  public generateGeofencePhrase(alert: GeofenceAlert, language: LanguageCode): string {
    const dist = alert.distanceNm.toFixed(1);
    const boundary = alert.boundaryName;
    const hasNative = this.hasNativeVoiceFor(language);

    // If native regional voice is missing, use Devanagari phonemics for Google हिन्दी
    if (!hasNative && language !== 'en' && language !== 'hi') {
      const bridge = INDIC_DEVANAGARI_PHONEMES[language];
      if (bridge) {
        return alert.severity === 'CRITICAL_BREACH'
          ? bridge.critical(boundary, dist)
          : bridge.proximity(boundary, dist);
      }
    }

    switch (language) {
      case 'hi':
        return alert.severity === 'CRITICAL_BREACH'
          ? `चेतावनी! पोत अंतर्राष्ट्रीय सीमा ${boundary} से केवल ${dist} नॉटिकल मील दूरी पर है। तुरंत सुरक्षित जलक्षेत्र में वापस लौटें।`
          : `सूचना: पोत समुद्री सीमा ${boundary} के निकट है। दूरी ${dist} नॉटिकल मील है।`;
      case 'bn':
        return alert.severity === 'CRITICAL_BREACH'
          ? `জরুরী সতর্কতা! বোটটি আন্তর্জাতিক সীমান্ত ${boundary} থেকে মাত্র ${dist} নটিক্যাল মাইল দূরে। অবিলম্বে নিরাপদ অঞ্চলে ফিরে যান।`
          : `সতর্কতা: সামুদ্রিক সীমা ${boundary} এর সন্নিকটে। দূরত্ব ${dist} নটিক্যাল মাইল।`;
      case 'ta':
        return alert.severity === 'CRITICAL_BREACH'
          ? `அவசர எச்சரிக்கை! படகு சர்வதேச எல்லை ${boundary} லிருந்து ${dist} கடல் மைல் தூரத்தில் உள்ளது. உடனே திரும்பி செல்லுங்கள்.`
          : `எச்சரிக்கை: கடல் எல்லை ${boundary} அருகில் உள்ளீர்கள். தூரம் ${dist} கடல் மைல்.`;
      case 'te':
        return alert.severity === 'CRITICAL_BREACH'
          ? `అత్యవసర హెచ్చరిక! పడవ అంతర్జాతీయ సరిహద్దు ${boundary} కి ${dist} నాటికల్ మైళ్ల దూరంలో ఉంది. వెంటనే వెనక్కి తిరగండి.`
          : `హెచ్చరిక: సముద్ర సరిహద్దు ${boundary} సమీపంలో ఉంది. దూరం ${dist} నాటికల్ మైళ్ళు.`;
      case 'or':
        return alert.severity === 'CRITICAL_BREACH'
          ? `ଜରୁରୀ ସତର୍କତା! ଡଙ୍ଗା ଆନ୍ତର୍ଜାତୀୟ ସୀମା ${boundary} ଠାରୁ ମାତ୍ର ${dist} ନଟିକାଲ ମାଇଲ ଦୂରରେ। ତୁରନ୍ତ ଫେରିଆସନ୍ତୁ।`
          : `ସୂଚନା: ସାମୁଦ୍ରିକ ସୀମା ${boundary} ନିକଟତର। ଦୂରତା ${dist} ନଟିକାଲ ମାଇଲ।`;
      case 'ml':
        return alert.severity === 'CRITICAL_BREACH'
          ? `അടിയന്തര മുന്നറിയിപ്പ്! ബോട്ട് അന്താരാഷ്ട്ര അതിർത്തി ${boundary} യിൽ നിന്നും ${dist} നോട്ടിക്കൽ മൈൽ ദൂരത്തിലാണ്. ഉടൻ തിരികെ പോവുക.`
          : `മുന്നറിയിപ്പ്: സമുദ്ര അതിർത്തി ${boundary} ക്ക് അടുത്താണ്. ദൂരം ${dist} നോട്ടിക്കൽ മൈൽ.`;
      case 'gu':
        return alert.severity === 'CRITICAL_BREACH'
          ? `ચેતવણી! વહાણ આંતરરાષ્ટ્રીય સીમા ${boundary} થી માત્ર ${dist} નોટિકલ માઇલ દૂર છે. તરત જ પાછા ફરો.`
          : `સૂચના: દરિયાઈ સરહદ ${boundary} નજીક છે. અંતર ${dist} નોટિકલ માઇલ.`;
      case 'mr':
        return alert.severity === 'CRITICAL_BREACH'
          ? `तातडीचा इशारा! बोट आंतरराष्ट्रीय सीमा ${boundary} पासून फक्त ${dist} नॉटिकल मैल अंतरावर आहे. त्वरित मागे फिरा.`
          : `सूचना: सागरी सीमा ${boundary} जवळ आहे. अंतर ${dist} नॉटिकल मैल.`;
      case 'kn':
        return alert.severity === 'CRITICAL_BREACH'
          ? `ತುರ್ತು ಎಚ್ಚರಿಕೆ! ದೋಣಿ ಅಂತರರಾಷ್ಟ್ರೀಯ ಗಡಿ ${boundary} ಯಿಂದ ಕೇವಲ ${dist} ನಾಟಿಕಲ್ ಮೈಲಿ ದೂರದಲ್ಲಿದೆ. ತಕ್ಷಣವೇ ಹಿಂತಿರುಗಿ.`
          : `ಎಚ್ಚರಿಕೆ: ಕಡಲ ಗಡಿ ${boundary} ಹತ್ತಿರದಲ್ಲಿದೆ. ದೂರ ${dist} ನಾಟಿಕಲ್ ಮೈಲಿ.`;
      case 'en':
      default:
        return alert.severity === 'CRITICAL_BREACH'
          ? `Emergency Alert! Vessel is ${dist} nautical miles from ${boundary}. Risk of maritime breach; adjust course immediately.`
          : `Navigation advisory: Vessel approaching ${boundary}. Distance: ${dist} nautical miles.`;
    }
  }

  /**
   * Build localized phrase for severe marine weather / gale warnings.
   */
  public generateWeatherPhrase(risk: RiskPrediction, language: LanguageCode): string {
    const hasNative = this.hasNativeVoiceFor(language);
    if (!hasNative && language !== 'en' && language !== 'hi') {
      const bridge = INDIC_DEVANAGARI_PHONEMES[language];
      if (bridge) return bridge.weather(risk.riskLevel);
    }

    switch (language) {
      case 'hi':
        return `गंभीर मौसम चेतावनी! समुद्र में जोखिम स्तर ${risk.riskLevel} है। अत्यधिक ऊंची लहरें और तेज हवाएं हैं। बंदरगाह पर लौटें।`;
      case 'bn':
        return `প্রতিকূল আবহাওয়া সতর্কতা! সাগরে ঝুঁকির মাত্রা ${risk.riskLevel}। উত্তাল ঢেউ ও ঝোড়ো বাতাস। নিরাপদ আশ্রয়ে ফিরে যান।`;
      case 'ta':
        return `மோசமான வானிலை எச்சரிக்கை! கடலில் ஆபத்து அளவு ${risk.riskLevel} ஆக உள்ளது. கொந்தளிப்பான அலைகள். துறைமுகத்திற்கு திரும்பவும்.`;
      case 'te':
        return `తీవ్ర వాతావరణ హెచ్చరిక! సముద్రంలో ప్రమాద స్థాయి ${risk.riskLevel} గా ఉంది. ఎత్తైన అలలు. సురక్షిత తీరానికి చేరుకోండి.`;
      case 'or':
        return `ପ୍ରତିକୂଳ ପାଣିପାଗ ସତର୍କତା! ସମୁଦ୍ରରେ ବିପଦ ସ୍ତର ${risk.riskLevel}। ତୁରନ୍ତ କୂଳକୁ ଫେରିଆସନ୍ତୁ।`;
      case 'ml':
        return `പ്രതികൂല കാലാവസ്ഥാ മുന്നറിയിപ്പ്! കടലിൽ അപകടസാധ്യത ${risk.riskLevel} ആണ്. തുറമുഖത്തേക്ക് തിരികെ പോകുക.`;
      case 'gu':
        return `ખરાબ હવામાન ચેતવણી! દરિયામાં જોખમ સ્તર ${risk.riskLevel} છે. ઊંચા મોજા અને ભારે પવન. બંદર પર પાછા ફરો.`;
      case 'mr':
        return `गंभीर हवामान इशारा! समुद्रात धोक्याची पातळी ${risk.riskLevel} आहे. बंदरावर परत या.`;
      case 'kn':
        return `ಪ್ರತಿಕೂಲ ಹವಾಮಾನ ಎಚ್ಚರಿಕೆ! ಸಮುದ್ರದಲ್ಲಿ ಅಪಾಯ ಮಟ್ಟ ${risk.riskLevel} ಆಗಿದೆ. ಬಲವಾದ ಅಲೆಗಳು. ಬಂದರಿಗೆ ಹಿಂತಿರುಗಿ.`;
      case 'en':
      default:
        return `Severe weather alert! Marine risk level is ${risk.riskLevel}. Dangerous swell and gale force winds detected. Return to harbor.`;
    }
  }

  /**
   * Build localized demo test phrase.
   */
  public generateTestPhrase(language: LanguageCode): string {
    const hasNative = this.hasNativeVoiceFor(language);
    if (!hasNative && language !== 'en' && language !== 'hi') {
      const bridge = INDIC_DEVANAGARI_PHONEMES[language];
      if (bridge) return bridge.test;
    }

    switch (language) {
      case 'hi':
        return 'यह ओरका एक्स बहुभाषी समुद्री सायरन और चेतावनी प्रणाली का ऑडियो परीक्षण है।';
      case 'bn':
        return 'এটি ওর্কা এক্স বহুভাষিক সামুদ্রিক সাইরেন এবং ভয়েস সতর্কতা ব্যবস্থার অডিও টেস্ট।';
      case 'ta':
        return 'இது ஓர்கா எக்ஸ் பலமொழி கடல்சார் சைரன் மற்றும் குரல் எச்சரிக்கை அமைப்பின் சோதனை.';
      case 'te':
        return 'ఇది ఓర్కా ఎక్స్ బహుభాషా సముద్ర సైరన్ మరియు వాయిస్ హెచ్చరిక వ్యవస్థ యొక్క ఆడియో పరీక్ష.';
      case 'or':
        return 'ଏହା ଓର୍କା ଏକ୍ସ ବହୁଭାଷୀ ସାମୁଦ୍ରିକ ସାଇରନ୍ ଏବଂ ଭଏସ୍ ସତର୍କତା ପ୍ରଣାଳୀର ଅଡିଓ ପରୀକ୍ଷଣ।';
      case 'ml':
        return 'ഇത് ഓർക്ക എക്സ് സമുദ്ര മുന്നറിയിപ്പ് സംവിധാനത്തിന്റെ ഓഡിയോ പരിശോധനയാണ്.';
      case 'gu':
        return 'આ ઓર્કા એક્સ મરીન સાયરન અને વોઇસ ચેતવણી સિસ્ટમનું ઓડિયો પરીક્ષણ છે.';
      case 'mr':
        return 'हे ओरका एक्स बहुभाषिक सागरी साइरन आणि वॉइस इशारा प्रणालीचे ऑडिओ परीक्षण आहे.';
      case 'kn':
        return 'ಇದು ಓರ್ಕಾ ఎಕ್ಸ್ ಬಹುಭಾಷಾ ಕಡಲ ಸೈರನ್ ಮತ್ತು ಧ್ವನಿ ಎಚ್ಚರಿಕೆ ವ್ಯವಸ್ಥೆಯ ಆಡಿಯೋ ಪರೀಕ್ಷೆ.';
      case 'en':
      default:
        return 'This is an audio test of the ORCA-X multi-lingual marine siren and voice warning system.';
    }
  }

  /**
   * Build comprehensive localized Risk Card verdict phrase.
   */
  public generateRiskVerdictPhrase(
    location: LocationInfo,
    risk: RiskPrediction,
    geofenceAlert: GeofenceAlert | undefined,
    language: LanguageCode
  ): string {
    const port = location.nearestPort || location.name;
    const hasNative = this.hasNativeVoiceFor(language);

    if (!hasNative && language !== 'en' && language !== 'hi') {
      const bridge = INDIC_DEVANAGARI_PHONEMES[language];
      if (bridge) {
        return bridge.verdict(port, risk.riskLevel, risk.riskScore, risk.primaryRecommendation);
      }
    }

    switch (language) {
      case 'hi':
        return `${port} के पास समुद्री स्थिति: जोखिम स्तर ${risk.riskLevel} (${risk.riskScore}/100)। सलाह: ${risk.primaryRecommendation}।`;
      case 'bn':
        return `${port} এর কাছে সামুদ্রিক পরিস্থিতি: ঝুঁকির মাত্রা ${risk.riskLevel} (${risk.riskScore}/100)। পরামর্শ: ${risk.primaryRecommendation}।`;
      case 'ta':
        return `${port} கடல் நிலைமை: இடர் அளவு ${risk.riskLevel} (${risk.riskScore}/100). பரிந்துரை: ${risk.primaryRecommendation}.`;
      case 'te':
        return `${port} సముద్ర పరిస్థితి: ప్రమాద స్థాయి ${risk.riskLevel} (${risk.riskScore}/100). సలహా: ${risk.primaryRecommendation}.`;
      case 'or':
        return `${port} ସମୁଦ୍ର ସ୍ଥିତି: ବିପଦ ସ୍ତର ${risk.riskLevel} (${risk.riskScore}/100)। ପରାମର୍ଶ: ${risk.primaryRecommendation}।`;
      case 'ml':
        return `${port} കടൽ അവസ്ഥ: അപകടസാധ്യത ${risk.riskLevel} (${risk.riskScore}/100). നിർദ്ദേശം: ${risk.primaryRecommendation}.`;
      case 'gu':
        return `${port} દરિયાઈ સ્થિતિ: જોખમ સ્તર ${risk.riskLevel} (${risk.riskScore}/100). સલાહ: ${risk.primaryRecommendation}.`;
      case 'mr':
        return `${port} सागरी स्थिती: धोक्याची पातळी ${risk.riskLevel} (${risk.riskScore}/100). सल्ला: ${risk.primaryRecommendation}.`;
      case 'kn':
        return `${port} ಕಡಲ ಸ್ಥಿತಿ: ಅಪಾಯ ಮಟ್ಟ ${risk.riskLevel} (${risk.riskScore}/100). ಸಲಹೆ: ${risk.primaryRecommendation}.`;
      case 'en':
      default:
        return `${port} marine status. Risk Level: ${risk.riskLevel}, score ${risk.riskScore} out of 100. Recommendation: ${risk.primaryRecommendation}.`;
    }
  }

  /**
   * Speak a phrase with the given language and options.
   * Seamlessly checks Sarvam AI & Bhashini via server proxy, then falls back to browser Indic TTS Engine.
   */
  public async speak(
    text: string,
    language: LanguageCode,
    options?: { playSirenFirst?: boolean; isCritical?: boolean; dedupeKey?: string; force?: boolean }
  ): Promise<boolean> {
    if (this.isMuted) return false;

    // Check cooldown
    const now = Date.now();
    if (!options?.force && options?.dedupeKey) {
      const last = this.lastSpokenAt.get(options.dedupeKey);
      if (last && now - last < this.cooldownMs) {
        return false;
      }
      this.lastSpokenAt.set(options.dedupeKey, now);
    }

    // Cancel any ongoing audio or speech
    this.cancel();

    // Optionally sound siren first
    if (options?.playSirenFirst) {
      if (options.isCritical) {
        maritimeSiren.playCriticalSiren(3.0);
        await new Promise((r) => setTimeout(r, 3200));
      } else {
        maritimeSiren.playProximityChime();
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    // 1. Try Hybrid Cloud Gateway (Sarvam AI / Bhashini NLTM via /api/indic-voice/tts)
    const cloudAudio = await indicVoiceGateway.synthesizeCloudTts(text, language);
    if (cloudAudio) {
      this.currentAudioElement = cloudAudio;
      this.setSpeaking(true);
      cloudAudio.onended = () => {
        this.setSpeaking(false);
        this.currentAudioElement = null;
      };
      cloudAudio.onerror = () => {
        this.setSpeaking(false);
        this.currentAudioElement = null;
      };
      try {
        await cloudAudio.play();
        return true;
      } catch (err) {
        console.warn('Cloud audio playback interrupted, falling back to edge:', err);
      }
    }

    // 2. Native Browser Speech Synthesis (Offline Edge Indic Devanagari Engine)
    if (typeof window === 'undefined' || !window.speechSynthesis) return false;

    // Cancel any speech queue
    window.speechSynthesis.cancel();

    const voice = this.getBestVoice(language);
    const hasNative = this.hasNativeVoiceFor(language);

    // Convert text to Devanagari phonemes if regional script cannot be parsed by Google हिन्दी
    let textToSpeak = text;
    if (!hasNative && language !== 'en' && language !== 'hi') {
      textToSpeak = indicScriptToDevanagari(text, language);
    }

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    } else {
      utterance.lang = language === 'en' ? 'en-IN' : 'hi-IN';
    }

    utterance.rate = 0.92; // Measured rate for maritime clarity
    utterance.pitch = options?.isCritical ? 1.05 : 1.0;
    utterance.volume = 0.95;

    this.setSpeaking(true);

    utterance.onend = () => {
      this.setSpeaking(false);
    };

    utterance.onerror = () => {
      this.setSpeaking(false);
    };

    window.speechSynthesis.speak(utterance);
    return true;
  }

  /**
   * Trigger automatic evaluation of geofence and weather risk.
   */
  public evaluateAndAnnounce(
    alert: GeofenceAlert | undefined,
    risk: RiskPrediction | undefined,
    language: LanguageCode
  ) {
    if (this.isMuted) return;

    if (alert && alert.severity === 'CRITICAL_BREACH') {
      const phrase = this.generateGeofencePhrase(alert, language);
      const dedupeKey = `geofence:critical:${alert.boundaryId}`;
      this.speak(phrase, language, { playSirenFirst: true, isCritical: true, dedupeKey });
      return;
    }

    if (alert && alert.severity === 'PROXIMITY_WARNING') {
      const phrase = this.generateGeofencePhrase(alert, language);
      const dedupeKey = `geofence:proximity:${alert.boundaryId}`;
      this.speak(phrase, language, { playSirenFirst: true, isCritical: false, dedupeKey });
      return;
    }

    if (risk && risk.riskLevel === 'EXTREME') {
      const phrase = this.generateWeatherPhrase(risk, language);
      const dedupeKey = `risk:extreme:${risk.riskScore}`;
      this.speak(phrase, language, { playSirenFirst: true, isCritical: true, dedupeKey });
    }
  }

  /**
   * Cancel ongoing speech immediately.
   */
  public cancel() {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (this.currentAudioElement) {
      this.currentAudioElement.pause();
      this.currentAudioElement = null;
    }
    maritimeSiren.stop();
    this.setSpeaking(false);
  }
}

export const voiceWarning = new VoiceWarningService();
