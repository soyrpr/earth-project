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
}

export interface MergedSatelliteData {
  id: string;
  tle_line_1: string;
  tle_line_2: string;
  info: SatelliteInfo | undefined;
  orbital: SatelliteOrbitalParam | undefined;
}

export async function loadAndMergeSatelliteData(): Promise<MergedSatelliteData[]> {
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

  const infoMap = new Map<string, SatelliteInfo>();
  infoData.forEach((info) => {
    infoMap.set(info.id, info);
  });

  const orbitalMap = new Map<string, SatelliteOrbitalParam>();
  orbitalData.forEach((orbital) => {
    orbitalMap.set(orbital.id, orbital);
  });

  return tleData.map((tle) => ({
    id: tle.id,
    tle_line_1: tle.tle_line_1,
    tle_line_2: tle.tle_line_2,
    info: infoMap.get(tle.id),
    orbital: orbitalMap.get(tle.id),
  }));
}
