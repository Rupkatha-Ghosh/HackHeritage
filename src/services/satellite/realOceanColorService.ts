async function fetchRealChlorophyll(lat: number, lon: number): Promise<ValueResult> {
  const probes = getMarineProbes(lat, lon);
  for (const probe of probes) {
    try {
      const url = `https://coastwatch.pfeg.noaa.gov/erddap/griddap/nesdisVHNSQchlaMonthly.json?chlor_a[(last)][(0.0)][(${probe.lat})][(${probe.lon})]`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        signal: AbortSignal.timeout(4000),
      });
      if (res.ok) {
        const json = await res.json() as { table?: { rows?: Array<[string, number, number, number, number | null]> } };
        const row = json?.table?.rows?.[0];
        const val = row?.[4];
        if (row && typeof val === 'number' && Number.isFinite(val) && val >= 0) {
          return { value: parseFloat(val.toFixed(3)), observedAt: row[0], source: 'NOAA-20/S-NPP VIIRS 4km Science Quality Chlorophyll-a' };
        }
      }
    } catch {
      // Continue to next candidate point.
    }
  }
  return {};
}

async function fetchRealTurbidity(lat: number, lon: number): Promise<ValueResult> {
  const probes = getMarineProbes(lat, lon);
  for (const probe of probes) {
    try {
      const url = `https://coastwatch.pfeg.noaa.gov/erddap/griddap/nesdisVHNSQkd490Monthly.json?kd_490[(last)][(0.0)][(${probe.lat})][(${probe.lon})]`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        signal: AbortSignal.timeout(4000),
      });
      if (res.ok) {
        const json = await res.json() as { table?: { rows?: Array<[string, number, number, number, number | null]> } };
        const row = json?.table?.rows?.[0];
        const val = row?.[4];
        if (row && typeof val === 'number' && Number.isFinite(val) && val >= 0) {
          return { value: parseFloat(val.toFixed(3)), observedAt: row[0], source: 'NOAA-20 VIIRS 4km Measured Kd(490) Water Clarity' };
        }
      }
    } catch {
      // Continue.
    }
  }
  return {};
}

async function fetchRealSstAnomaly(lat: number, lon: number): Promise<ValueResult> {
  const probes = getMarineProbes(lat, lon);
  for (const probe of probes) {
    try {
      const url = `https://coastwatch.pfeg.noaa.gov/erddap/griddap/jplMURSST41anom1day.json?sstAnom[(last)][(${probe.lat})][(${probe.lon})]`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        signal: AbortSignal.timeout(4000),
      });
      if (res.ok) {
        const json = await res.json() as { table?: { rows?: Array<[string, number, number, number, number | null]> } };
        const row = json?.table?.rows?.[0];
        const val = row?.[3];
        if (row && typeof val === 'number' && Number.isFinite(val)) {
          return { value: parseFloat(val.toFixed(2)), observedAt: row[0], source: 'NASA JPL MUR 1km Global SST Anomaly' };
        }
      }
    } catch {
      // Continue.
    }
  }
  return {};
}