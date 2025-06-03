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

    // Crear mapas por norad_cat_id
    const infoMap = new Map<string, SatelliteInfo>();
    infoData.forEach(info => infoMap.set(info.norad_cat_id, info));

  const orbitalMap = new Map<string, SatelliteOrbitalParam>();
  orbitalData.forEach(orbital => {
    const noradId = orbital.norad_cat_id ?? orbital.id;
    if (noradId) orbitalMap.set(noradId, orbital);
  });

    const tleMap = new Map<string, SatelliteTLE>();
    tleData.forEach(tle => {
      const noradId = tle.id;
      if (noradId) {
        tleMap.set(noradId, {
          ...tle,
          norad_cat_id: noradId,
        });
      } else {
        console.warn('norad_cat_id no definido para TLE:', tle);
      }
    });

    // Fusionar todos los datos
    const mergedSatellites: MergedSatelliteData[] = [];
    let discardedCount = 0;

    for (const norad_cat_id of infoMap.keys()) {
      const info = infoMap.get(norad_cat_id);
      const orbital = orbitalMap.get(norad_cat_id);
      const tle = tleMap.get(norad_cat_id);

      if (info && orbital && tle && tle.tle_line_1 && tle.tle_line_2) {
        mergedSatellites.push({
          norad_cat_id,
          tle_line_1: tle.tle_line_1,
          tle_line_2: tle.tle_line_2,
          info,
          orbital,
        });
      } else {
        discardedCount++;
        // console.warn(`Datos incompletos para el satélite ${norad_cat_id}:`, {
        //   info: !!info,
        //   orbital: !!orbital,
        //   tle: !!tle,
        //   tle_line_1: tle?.tle_line_1 ?? 'no definido',
        //   tle_line_2: tle?.tle_line_2 ?? 'no definido',
        // });
      }
    }

    console.log(`Satélites descartados por datos incompletos: ${discardedCount}`);

    return mergedSatellites;
  } catch (error) {
    console.error('Error al cargar y fusionar datos de satélites:', error);
    return [];
  }
}
