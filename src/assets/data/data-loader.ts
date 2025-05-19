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
  norad_cat_id: string;
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
  norad_cat_id?: string; // opcional si no está directamente en el JSON
}

export interface MergedSatelliteData {
  norad_cat_id: string;
  tle_line_1: string;
  tle_line_2: string;
  info?: SatelliteInfo;
  orbital?: SatelliteOrbitalParam;
}

export async function loadAndMergeSatelliteData(): Promise<MergedSatelliteData[]> {
  try {
    // Cargar todos los archivos en paralelo
    const [infoResponse, orbitalResponse, tleResponse] = await Promise.all([
      fetch('/assets/data/satellite_info.json'),
      fetch('/assets/data/satellite_orbital_param.json'),
      fetch('/assets/data/satellite_tle.json'),
    ]);

    // Parsear las respuestas en formato JSON
    const [infoData, orbitalData, tleData]: [SatelliteInfo[], SatelliteOrbitalParam[], SatelliteTLE[]] = await Promise.all([
      infoResponse.json(),
      orbitalResponse.json(),
      tleResponse.json(),
    ]);

    // Crear un mapa de los datos de información y orbital por norad_cat_id
    const infoMap = new Map<string, SatelliteInfo>();
    infoData.forEach(info => infoMap.set(info.norad_cat_id, info));

    const orbitalMap = new Map<string, SatelliteOrbitalParam>();
orbitalData.forEach(orbital => {
  const noradId = orbital.id; // Asumimos que 'id' es realmente 'norad_cat_id'
  if (noradId) {
    orbitalMap.set(noradId, {
      ...orbital,
      norad_cat_id: noradId // Añadimos el campo esperado
    });
  } else {
    console.warn('norad_cat_id no definido para:', orbital);
  }
});

    // Función para extraer el norad_cat_id desde el TLE (si no se encuentra, devuelve un valor por defecto)
    function extractNoradId(tleLine1: string): string {
      return tleLine1.substring(2, 7).trim();
    }

    // Crear los datos fusionados
    const mergedData: MergedSatelliteData[] = tleData.map((tle) => {
      const noradId = extractNoradId(tle.tle_line_1);
      return {
        norad_cat_id: noradId,
        tle_line_1: tle.tle_line_1,
        tle_line_2: tle.tle_line_2,
        info: infoMap.get(noradId), // Buscar en el mapa de información
        orbital: orbitalMap.get(noradId), // Buscar en el mapa orbital
      };
    });

    return mergedData;
  } catch (error) {
    console.error('Error al cargar o fusionar los datos de los satélites:', error);
    return [];
  }
}
