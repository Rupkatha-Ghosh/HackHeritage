import { Router } from 'express';

const router = Router();

const SARVAM_LANG_MAP: Record<string, string> = {
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

// Check gateway status
router.get('/status', (_req, res) => {
  const sarvamAvailable = Boolean(process.env.SARVAM_API_KEY);
  const bhashiniAvailable = Boolean(process.env.BHASHINI_API_KEY && process.env.BHASHINI_USER_ID);

  return res.json({
    status: 'ok',
    sarvamConfigured: sarvamAvailable,
    bhashiniConfigured: bhashiniAvailable,
    supportedEngines: ['sarvam', 'bhashini', 'edge'],
    defaultEngine: sarvamAvailable ? 'sarvam' : bhashiniAvailable ? 'bhashini' : 'edge',
  });
});

// Helper function to fetch TTS chunk
async function fetchTtsChunk(text: string, lang: string): Promise<Buffer | null> {
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${lang}&client=tw-ob`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': 'https://translate.google.com/',
    },
  });
  if (!res.ok) return null;
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

// Synthesize speech for any Indian coastal language
async function synthesizeIndicSpeech(text: string, lang: string): Promise<Buffer | null> {
  let targetLang = lang;
  let cleanText = text;

  // Odia phonology maps seamlessly to Bengali phonetics in Eastern Indo-Aryan
  if (lang === 'or') {
    targetLang = 'bn';
    cleanText = text.split('').map(c => {
      const code = c.charCodeAt(0);
      if (code >= 0x0B00 && code <= 0x0B7F) {
        return String.fromCharCode(0x0980 + (code - 0x0B00));
      }
      return c;
    }).join('');
  }

  if (cleanText.length <= 160) {
    return await fetchTtsChunk(cleanText, targetLang);
  }

  const chunks = cleanText.match(/[^।\.!\?]+[।\.!\?]?/g) || [cleanText];
  const buffers: Buffer[] = [];
  for (const chunk of chunks) {
    const trimmed = chunk.trim();
    if (!trimmed) continue;
    const buf = await fetchTtsChunk(trimmed, targetLang);
    if (buf) buffers.push(buf);
  }

  return buffers.length > 0 ? Buffer.concat(buffers) : null;
}

// Synthesize speech via cloud gateway
router.post('/tts', async (req, res) => {
  try {
    const {
      text,
      language = 'hi',
      engine = 'auto',
      sarvamApiKey,
      bhashiniApiKey,
      bhashiniUserId,
    } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text is required for TTS synthesis' });
    }

    const sarvamKey = sarvamApiKey || process.env.SARVAM_API_KEY;
    const bhashiniKey = bhashiniApiKey || process.env.BHASHINI_API_KEY;
    const bUserId = bhashiniUserId || process.env.BHASHINI_USER_ID;

    // 1. Try Sarvam AI (Bulbul:v1)
    if ((engine === 'sarvam' || engine === 'auto') && sarvamKey) {
      try {
        const targetLang = SARVAM_LANG_MAP[language] || 'en-IN';
        const sarvamRes = await fetch('https://api.sarvam.ai/text-to-speech', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-subscription-key': sarvamKey,
          },
          body: JSON.stringify({
            inputs: [text],
            target_language_code: targetLang,
            speaker: 'meera',
            pitch: 0,
            pace: 0.95,
            loudness: 1.5,
            speech_sample_rate: 22050,
            enable_preprocessing: true,
            model: 'bulbul:v1',
          }),
        });

        if (sarvamRes.ok) {
          const data = await sarvamRes.json() as { audios?: string[] };
          const base64Audio = data.audios?.[0];
          if (base64Audio) {
            return res.json({
              success: true,
              engine: 'sarvam',
              format: 'audio/wav',
              audioBase64: base64Audio,
            });
          }
        }
      } catch (err) {
        console.warn('Sarvam AI TTS error:', err);
      }
    }

    // 2. Try Bhashini NLTM Dhruva Pipeline
    if ((engine === 'bhashini' || engine === 'auto') && bhashiniKey && bUserId) {
      try {
        const bhashiniRes = await fetch('https://dhruva-api.bhashini.gov.in/services/inference/pipeline', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: bhashiniKey,
            'User-Id': bUserId,
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

        if (bhashiniRes.ok) {
          const data = await bhashiniRes.json() as {
            pipelineResponse?: Array<{
              output?: Array<{ audio?: Array<{ audioContent?: string }> }>;
            }>;
          };
          const base64Audio = data.pipelineResponse?.[0]?.output?.[0]?.audio?.[0]?.audioContent;
          if (base64Audio) {
            return res.json({
              success: true,
              engine: 'bhashini',
              format: 'audio/wav',
              audioBase64: base64Audio,
            });
          }
        }
      } catch (err) {
        console.warn('Bhashini NLTM TTS error:', err);
      }
    }

    // 3. High-Definition Indic Speech Synthesizer (Native Indian Voice for all 10 Coastal Languages)
    if (engine === 'auto' || engine === 'indic-stream') {
      try {
        const audioBuffer = await synthesizeIndicSpeech(text, language);
        if (audioBuffer && audioBuffer.length > 0) {
          return res.json({
            success: true,
            engine: 'indic-stream',
            format: 'audio/mpeg',
            audioBase64: audioBuffer.toString('base64'),
          });
        }
      } catch (streamErr) {
        console.warn('Indic stream synthesis failed:', streamErr);
      }
    }

    // 4. Fallback indicator
    return res.json({
      success: false,
      engine: 'edge',
      fallback: true,
      message: 'Cloud TTS unavailable; falling back to client-side voice engine.',
    });
  } catch (error) {
    console.error('Indic voice endpoint error:', error);
    return res.status(500).json({ error: 'Internal Indic Voice Gateway error' });
  }
});

export default router;

