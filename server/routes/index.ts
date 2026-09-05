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
  gisSpatialAnalysis,
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
router.get('/gis/spatial-analysis', gisSpatialAnalysis);
router.post('/gis/spatial-analysis', gisSpatialAnalysis);
router.get('/health', health);

export default router;
