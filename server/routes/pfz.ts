import { Router } from 'express';
import { COASTAL_LOCATIONS } from '../../src/data/coastalData.ts';
import { analyzePfz } from '../services/pfzService.ts';
import { resolveLocation } from '../services/marineService.ts';

const router = Router();

router.post('/analyze', async (req, res) => {
  try {
    const locationKey = typeof req.body?.locationKey === 'string' ? req.body.locationKey : undefined;
    const query = typeof req.body?.query === 'string' ? req.body.query : '';
    const lat = Number(req.body?.latitude);
    const lon = Number(req.body?.longitude);

    const location = locationKey && COASTAL_LOCATIONS[locationKey]
      ? COASTAL_LOCATIONS[locationKey]
      : Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180
        ? { name: 'Custom Coastal Point', country: 'India', latitude: lat, longitude: lon, regionType: 'open_sea' as const }
        : resolveLocation(query || 'Goa');

    res.json(await analyzePfz(location));
  } catch (error) {
    console.error('PFZ analysis error:', error);
    res.status(502).json({ error: error instanceof Error ? error.message : 'PFZ analysis failed.' });
  }
});

export default router;
