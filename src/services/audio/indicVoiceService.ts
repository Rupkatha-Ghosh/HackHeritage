/**
 * Indic AI Voice & Translation Gateway (Sarvam AI & Bhashini NLTM / IndicTrans2)
 * 
 * Provides unified Text-to-Speech (TTS) and translation integration for Indian languages:
 * 1. Sarvam AI (Bulbul TTS) - ultra-natural Indian regional voices.
 * 2. Bhashini (MeitY National Language Translation Mission / IndicTTS).
 * 3. Phonetic Regional Transliteration Bridge - 100% offline edge fallback for browsers
 *    lacking native regional TTS packs (e.g. Odia, Bengali, Tamil on Windows).
 */

import { LanguageCode } from '../../types';

export interface IndicVoiceConfig {
  sarvamApiKey?: string;
  bhashiniApiKey?: string;
  bhashiniUserId?: string;
  preferredEngine: 'auto' | 'sarvam' | 'bhashini' | 'edge';
}

export interface PhoneticBridgePhrases {
  critical: (boundary: string, dist: string) => string;
  proximity: (boundary: string, dist: string) => string;
  weather: (riskLevel: string) => string;
  test: string;
}

/**
 * Phonetically tuned phonetic phrases that standard English/Hindi TTS voices
 * can pronounce clearly and accurately for native listeners when regional OS packs are absent.
 */
export const PHONETIC_REGIONAL_BRIDGES: Record<LanguageCode, PhoneticBridgePhrases> = {
  en: {
    critical: (boundary, dist) => `Emergency alert! Vessel is ${dist} nautical miles from ${boundary}. Turn back immediately.`,
    proximity: (boundary, dist) => `Navigation advisory: Approaching ${boundary}. Distance: ${dist} nautical miles.`,
    weather: (riskLevel) => `Severe weather alert! Marine risk level is ${riskLevel}. Return to harbor immediately.`,
    test: 'This is an audio test of the ORCA-X multi-lingual marine siren and voice warning system.',
  },
  hi: {
    critical: (boundary, dist) => `चेतावनी! पोत अंतर्राष्ट्रीय सीमा ${boundary} से केवल ${dist} नॉटिकल मील दूरी पर है। तुरंत सुरक्षित जलक्षेत्र में वापस लौटें।`,
    proximity: (boundary, dist) => `सूचना: पोत समुद्री सीमा ${boundary} के निकट है। दूरी ${dist} नॉटिकल मील है।`,
    weather: (riskLevel) => `गंभीर मौसम चेतावनी! समुद्र में जोखिम स्तर ${riskLevel} है। अत्यधिक ऊंची लहरें हैं। बंदरगाह पर लौटें।`,
    test: 'यह ओरका एक्स बहुभाषी समुद्री सायरन और चेतावनी प्रणाली का ऑडियो परीक्षण है।',
  },
  bn: {
    critical: (boundary, dist) => `Joruri sotorkota! Boatti antorjatik seemanto ${boundary} theke matro ${dist} nautical mile doore. Obilombey niraapode phire jaan.`,
    proximity: (boundary, dist) => `Sotorkota: Samudrik seema ${boundary} er shonnikaate. Doorotto ${dist} nautical mile.`,
    weather: (riskLevel) => `Protikool aabohawa sotorkota! Sagore jhookir matra ${riskLevel}. Uttal dheu o jhoro batash. Teere phire jaan.`,
    test: 'Aeti ORCA-X bohubhashik samudrik siren ebong voice sotorkota byabosthar audio test.',
  },
  ta: {
    critical: (boundary, dist) => `Avasara eccharikkai! Padagu sarvadesa ellai ${boundary} lirundhu ${dist} kadal mail thoorathil ulladhu. Udane thirumbi sellungal.`,
    proximity: (boundary, dist) => `Eccharikkai: Kadal ellai ${boundary} arugil ulladhu. Thooram ${dist} kadal mail.`,
    weather: (riskLevel) => `Mosamaana vaanilai eccharikkai! Kadalil aabathu alavu ${riskLevel}. Kuraaindha aazhamulla thuraaimugathirku thirumbavum.`,
    test: 'Idhu ORCA-X pala-mozhi kadal-saar siren matrum kural eccharikkai amaippin sodhanaai.',
  },
  te: {
    critical: (boundary, dist) => `Athyavasara hecharika! Padava antharjaatheeya sarihaddu ${boundary} ki ${dist} nautical maila dooramlo undhi. Ventane venakki thiragandi.`,
    proximity: (boundary, dist) => `Hecharika: Samudra sarihaddu ${boundary} sameepamlo undhi. Dooram ${dist} nautical mailu.`,
    weather: (riskLevel) => `Theevra vaathavarana hecharika! Samudramlo pramaada sthaayi ${riskLevel}. Ventane theeraaniki cherukondi.`,
    test: 'Idhi ORCA-X bahu-bhaashaa samudra siren mariyu voice hecharika vyavastha yokka audio pareeksha.',
  },
  or: {
    critical: (boundary, dist) => `Jaruri satarkata! Danga antarjatia seema ${boundary} tharu matro ${dist} nautical mile doorare. Turanta koolaku pheri aasantu.`,
    proximity: (boundary, dist) => `Soochanaa: Samudrika seema ${boundary} nikatatara. Doorata ${dist} nautical mile.`,
    weather: (riskLevel) => `Pratikoola panipaga satarkata! Samudrare bipada stara ${riskLevel}. Turanta pheri aasantu.`,
    test: 'Eha ORCA-X bahubhashi samudrika siren ebam voice satarkata pranaleera audio parikshana.',
  },
  ml: {
    critical: (boundary, dist) => `Aadiyanthara munnariyippu! Boat antharaashtra aathirthi ${boundary} yil ninnu ${dist} nautical mile doorathilaanu. Udan thirike povuka.`,
    proximity: (boundary, dist) => `Munnariyippu: Samudra aathirthi ${boundary} kku aduthaanu. Dooram ${dist} nautical mile.`,
    weather: (riskLevel) => `Mosham aabohawa munnariyippu! Kadalil aabathu ${riskLevel}. Thuraamugathilekku thirike povuka.`,
    test: 'Ithu ORCA-X bahubhasha samudra siren matrum voice munnariyippu vyavasthayude audio test aanu.',
  },
  gu: {
    critical: (boundary, dist) => `Chetavni! Vahan aantar-rashtriya seema ${boundary} thi matra ${dist} nautical mile door chhe. Tarat ja pachha pharo.`,
    proximity: (boundary, dist) => `Soochana: Dariyai sarhad ${boundary} najik chhe. Antar ${dist} nautical mile.`,
    weather: (riskLevel) => `Gambhira vatavaran chetavni! Dariyamam jokham level ${riskLevel} chhe. Bandar par pachha pharo.`,
    test: 'Aa ORCA-X bahubhashi marine siren ane voice chetavni systemnu audio test chhe.',
  },
  mr: {
    critical: (boundary, dist) => `Tatadicha ishara! Bot aantar-rashtriya seema ${boundary} pasun phakta ${dist} nautical mail antaravar aahe. Twarit mage phira.`,
    proximity: (boundary, dist) => `Soochana: Sagari seema ${boundary} javal aahe. Antar ${dist} nautical mail.`,
    weather: (riskLevel) => `Gambhira havaman ishara! Samudrat dhoka patali ${riskLevel} aahe. Bandaravar parat ya.`,
    test: 'He ORCA-X bahubhashik sagari siren aani voice ishara pranaleece audio parikshan aahe.',
  },
  kn: {
    critical: (boundary, dist) => `Thurtu eccharike! Doni anthar-rashtriya gadi ${boundary} yinda kevala ${dist} nautical maili dooradallide. Thaksave hinthirugi.`,
    proximity: (boundary, dist) => `Eccharike: Kadala gadi ${boundary} hathiradallide. Doora ${dist} nautical maili.`,
    weather: (riskLevel) => `Theevra havamana eccharike! Samudradalli aapaaya matta ${riskLevel}. Bandarige hinthirugi.`,
    test: 'Idu ORCA-X bahubhasha kadala siren mattu dhwani eccharike vyavastheya audio pareekshe.',
  },
};

class IndicVoiceGateway {
  private config: IndicVoiceConfig = {
    preferredEngine: 'auto',
  };

  public setConfig(config: Partial<IndicVoiceConfig>) {
    this.config = { ...this.config, ...config };
  }

  public getConfig(): IndicVoiceConfig {
    return this.config;
  }

  /**
   * Synthesize natural speech via Sarvam AI Bulbul TTS API if API key is provided.
   */
  public async synthesizeSarvamTts(text: string, language: LanguageCode): Promise<HTMLAudioElement | null> {
    const apiKey = this.config.sarvamApiKey || (typeof process !== 'undefined' ? process.env?.SARVAM_API_KEY : undefined);
    if (!apiKey) return null;

    const languageCodeMap: Record<LanguageCode, string> = {
      en: 'en-IN',
      hi: 'hi-IN',
      bn: 'bn-IN',
      ta: 'ta-IN',
      te: 'te-IN',
      or: 'od-IN',
      ml: 'ml-IN',
      gu: 'gu-IN',
      mr: 'mr-IN',
      kn: 'kn-IN',
    };

    try {
      const response = await fetch('https://api.sarvam.ai/text-to-speech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-subscription-key': apiKey,
        },
        body: JSON.stringify({
          inputs: [text],
          target_language_code: languageCodeMap[language] || 'en-IN',
          speaker: 'meera',
          pitch: 0,
          pace: 0.95,
          loudness: 1.5,
          speech_sample_rate: 22050,
          enable_preprocessing: true,
          model: 'bulbul:v1',
        }),
      });

      if (!response.ok) return null;
      const data = await response.json();
      const base64Audio = data.audios?.[0];
      if (!base64Audio) return null;

      const audio = new Audio(`data:audio/wav;base64,${base64Audio}`);
      return audio;
    } catch {
      return null;
    }
  }

  /**
   * Synthesize natural speech via Bhashini NLTM / IndicTTS if API key is provided.
   */
  public async synthesizeBhashiniTts(text: string, language: LanguageCode): Promise<HTMLAudioElement | null> {
    const apiKey = this.config.bhashiniApiKey || (typeof process !== 'undefined' ? process.env?.BHASHINI_API_KEY : undefined);
    const userId = this.config.bhashiniUserId || (typeof process !== 'undefined' ? process.env?.BHASHINI_USER_ID : undefined);
    if (!apiKey || !userId) return null;

    try {
      const response = await fetch('https://dhruva-api.bhashini.gov.in/services/inference/pipeline', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: apiKey,
          'User-Id': userId,
        },
        body: JSON.stringify({
          pipelineTasks: [
            {
              taskType: 'tts',
              config: {
                language: { sourceLanguage: language },
                gender: 'female',
              },
            },
          ],
          inputData: {
            input: [{ source: text }],
          },
        }),
      });

      if (!response.ok) return null;
      const data = await response.json();
      const base64Audio = data.pipelineResponse?.[0]?.output?.[0]?.audio?.[0]?.audioContent;
      if (!base64Audio) return null;

      const audio = new Audio(`data:audio/wav;base64,${base64Audio}`);
      return audio;
    } catch {
      return null;
    }
  }
}

export const indicVoiceGateway = new IndicVoiceGateway();
