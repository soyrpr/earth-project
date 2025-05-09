import * as satellite from "satellite.js";
import { Earth } from "./earth";
import { Mesh, Vector3 } from "three";

export class SatelliteManager {
  private markers: Map<string, Mesh> = new Map();

  constructor(private readonly earth: Earth) {}

  public addSatellite(id: string, tleLine1: string, tleLine2: string): void {
    const satrec = satellite.twoline2satrec(tleLine1, tleLine2);

    // Obtener posición inicial
    const now = new Date();
    const posVel = satellite.propagate(satrec, now);
    if (!posVel || !posVel.position) {
      console.warn(`Satélite ${id}: no se pudo calcular la posición inicial.`);
      return;
    }

    const gmst = satellite.gstime(now);
    const geo = satellite.eciToGeodetic(posVel.position, gmst);
    const lat = satellite.degreesLat(geo.latitude);
    const lon = satellite.degreesLong(geo.longitude);

    const marker = this.earth.addMovingMarker(lat, lon, 0x00ffff);
    this.markers.set(id, marker);

    // Actualización periódica
    setInterval(() => {
      const now = new Date();
      const newPos = satellite.propagate(satrec, now);
      if (!newPos || !newPos.position) return;

      const gmstNow = satellite.gstime(now);
      const geoPos = satellite.eciToGeodetic(newPos.position, gmstNow);
      const newLat = satellite.degreesLat(geoPos.latitude);
      const newLon = satellite.degreesLong(geoPos.longitude);

      const [x, y, z] = this.earth['calcPosFromLatLonRad'](newLat, newLon, 33);
      marker.position.set(x, y, z);
    }, 1000);
  }

  public loadSatellitesFromArray(data: { id: string, tle_line_1: string, tle_line_2: string }[]): void {
    for (const sat of data) {
      this.addSatellite(sat.id, sat.tle_line_1, sat.tle_line_2);
    }
  }
}
