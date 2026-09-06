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

    // 3. Fallback to Edge Indic Devanagari Engine
    return res.json({
      success: false,
      engine: 'edge',
      fallback: true,
      message: 'Cloud TTS unavailable or unconfigured; falling back to client-side Indic Devanagari voice engine.',
    });
  } catch (error) {
    console.error('Indic voice endpoint error:', error);
    return res.status(500).json({ error: 'Internal Indic Voice Gateway error' });
  }
});

export default router;
