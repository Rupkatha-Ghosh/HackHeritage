import { Router } from 'express';
import {
  evidenceSearch,
  health,
  marineConditions,
  marineForecast,
  marineRisk,
  marineTelemetry,
  marineTelemetryAnalysis,
  orcaQuery,
  satelliteAnalysis,
} from '../controllers/apiController.ts';

const router = Router();

router.post('/orca/query', orcaQuery);
router.get('/marine/conditions', marineConditions);
router.get('/marine/forecast', marineForecast);
router.get('/marine/telemetry', marineTelemetry);
router.get('/marine/telemetry/analysis', marineTelemetryAnalysis);
router.post('/marine/risk', marineRisk);
router.post('/satellite/analysis', satelliteAnalysis);
router.post('/evidence/search', evidenceSearch);
router.get('/health', health);

export default router;
