export interface SatelliteInfo {
  id: string;
  satname: string;
  norad_cat_id: string;
  decay: string;
  intldes: string;
  current: string;
  types: string;
  rcs_types: string;
  files: string;
  country: number;
  launch: number;
}

export interface SatelliteOrbitalParam {
  id: string;
  norad_cat_id?: string; // puede ser opcional
  period: string;
  inclination: string;
  apogee: string;
  perigee: string;
  semimajor_aix: string;
  ra_of_asc_node: string;
  space_object: number;
}

export interface SatelliteTLE {
  id: string;
  tle_line_1: string;
  tle_line_2: string;
  space_object: number;
  norad_cat_id?: string; // se añadirá
}

export interface MergedSatelliteData {
  norad_cat_id: string;
  tle_line_1: string;
  tle_line_2: string;
  info?: SatelliteInfo;
  orbital?: SatelliteOrbitalParam;
}

function normalizeId(id: string | number | undefined | null): string | null {
  return id != null ? String(id).trim() : null;
}

function extractNoradCatIdFromTleLine1(tleLine1: string): string | null {
  if (!tleLine1 || tleLine1.length < 7) return null;
  // Extrae substring posiciones 2 a 6 (5 caracteres)
  return tleLine1.substring(2, 7).trim() || null;
}

export async function loadAndMergeSatelliteData(): Promise<MergedSatelliteData[]> {
  try {
    const [infoResponse, orbitalResponse, tleResponse] = await Promise.all([
      fetch('/assets/data/satellite_info.json'),
      fetch('/assets/data/satellite_orbital_param.json'),
      fetch('/assets/data/satellite_tle.json'),
    ]);

    const [infoData, orbitalData, tleData]: [SatelliteInfo[], SatelliteOrbitalParam[], SatelliteTLE[]] = await Promise.all([
      infoResponse.json(),
      orbitalResponse.json(),
      tleResponse.json(),
    ]);

    // Map info por norad_cat_id (normalizado)
    const infoMap = new Map<string, SatelliteInfo>();
    for (const info of infoData) {
      const id = normalizeId(info.norad_cat_id);
      if (id) infoMap.set(id, info);
    }

    // Map orbital por norad_cat_id o id (normalizado)
    const orbitalMap = new Map<string, SatelliteOrbitalParam>();
    for (const orbital of orbitalData) {
      // Usamos norad_cat_id si existe, sino id
      const id = normalizeId(orbital.norad_cat_id ?? orbital.id);
      if (id) orbitalMap.set(id, orbital);
    }

    // Map tle por norad_cat_id extraído de tle_line_1
    const tleMap = new Map<string, SatelliteTLE>();
    for (const tle of tleData) {
      const noradId = extractNoradCatIdFromTleLine1(tle.tle_line_1);
      if (noradId) {
        tle.norad_cat_id = noradId; // opcional, guardar el id extraído
        tleMap.set(noradId, tle);
      }
    }

    // Crear conjunto con todos los norad_cat_id únicos de los 3 datasets
    const allNoradIds = new Set<string>();
    for (const info of infoData) {
      const id = normalizeId(info.norad_cat_id);
      if (id) allNoradIds.add(id);
    }
    for (const orbital of orbitalData) {
      const id = normalizeId(orbital.norad_cat_id ?? orbital.id);
      if (id) allNoradIds.add(id);
    }
    for (const id of tleMap.keys()) allNoradIds.add(id);

    // Construir arreglo fusionado
    const mergedData: MergedSatelliteData[] = [];

    for (const noradId of allNoradIds) {
      const tle = tleMap.get(noradId);
      if (!tle) continue; // si no hay TLE, saltar

      mergedData.push({
        norad_cat_id: noradId,
        tle_line_1: tle.tle_line_1,
        tle_line_2: tle.tle_line_2,
        info: infoMap.get(noradId),
        orbital: orbitalMap.get(noradId),
      });
    }

    return mergedData;
  } catch (error) {
    console.error('Error al cargar o fusionar los datos de los satélites:', error);
    return [];
  }
}
