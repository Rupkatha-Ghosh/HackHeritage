import { Router } from 'express';
import {
  evidenceSearch,
  health,
  marineConditions,
  marineForecast,
  marineRisk,
  orcaQuery,
  satelliteAnalysis,
} from '../controllers/apiController.ts';

const router = Router();

router.post('/orca/query', orcaQuery);
router.get('/marine/conditions', marineConditions);
router.get('/marine/forecast', marineForecast);
router.post('/marine/risk', marineRisk);
router.post('/satellite/analysis', satelliteAnalysis);
router.post('/evidence/search', evidenceSearch);
router.get('/health', health);

export default router;
