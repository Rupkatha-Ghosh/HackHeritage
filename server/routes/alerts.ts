import { Router } from 'express';
import { evaluateMarineAlerts, type AlertEvaluationInput } from '../services/alertEngine.ts';

const router = Router();

router.post('/evaluate', (req, res) => {
  try {
    const body = req.body as Partial<AlertEvaluationInput>;
    if (!body.weather || !body.ocean || !body.risk) {
      return res.status(400).json({ error: 'weather, ocean and risk inputs are required.' });
    }
    const result = evaluateMarineAlerts(body as AlertEvaluationInput);
    return res.json(result);
  } catch (error) {
    console.error('Marine alert evaluation error:', error);
    return res.status(400).json({ error: error instanceof Error ? error.message : 'Marine alert evaluation failed.' });
  }
});

export default router;
