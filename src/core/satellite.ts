import * as satellite from "satellite.js";
import { Earth } from "./earth";
import { Mesh, Sprite, Vector3 } from "three";
import { SceneManager } from "./scene.manager";

export class SatelliteManager {
  private markers: Map<string, Mesh> = new Map();
  private updateInterval: any;

  constructor(private readonly earth: Earth) {}

public addSatellite(id: string, tleLine1: string, tleLine2: string, name: string): void {
  if (this.markers.has(id)) {
    console.log(`El satélite con ID ${id} ya ha sido agregado.`);
    return;
  }

  const satrec = satellite.twoline2satrec(tleLine1, tleLine2);

  const now = new Date();
  const positionAndVelocity  = satellite.propagate(satrec, now);
  if (!positionAndVelocity  || !positionAndVelocity .position) {
    console.warn(`Satélite ${id}: no se pudo calcular la posición inicial.`);
    return;
  }

  const gmst = satellite.gstime(now);
  const geo = satellite.eciToGeodetic(positionAndVelocity .position, gmst);
  const lat = satellite.degreesLat(geo.latitude);
  const lon = satellite.degreesLong(geo.longitude);

  const marker = this.earth.addMovingMarker(lat, lon, 0x00ffff);
  this.markers.set(id, marker);

  marker.userData = {
    tleLine1,
    tleLine2,
    name,
  };
  marker.name = name;

  if (!this.updateInterval) {
    this.updateInterval = setInterval(this.updateSatellites.bind(this), 1000);
  }
}

  private updateSatellites(): void {
    const now = new Date();
    this.markers.forEach((marker, id) => {
      const { tleLine1, tleLine2 } = marker.userData;
      const satrec = satellite.twoline2satrec(tleLine1, tleLine2);
      const newPos = satellite.propagate(satrec, now);
      if (!newPos || !newPos.position) return;

      const gmstNow = satellite.gstime(now);
      const geoPos = satellite.eciToGeodetic(newPos.position, gmstNow);

      const newLat = satellite.degreesLat(geoPos.latitude);
      const newLon = satellite.degreesLong(geoPos.longitude);

      const earthRadiusKm = 6371;
      const earthSceneRadius = this.earth.getRadius();

      const altitudeKm = geoPos.height;
      const scaledRadius = earthSceneRadius + (altitudeKm * (earthSceneRadius / earthRadiusKm));


      const [x, y, z] = this.earth.calcPosFromLatLonRad(newLat, newLon, scaledRadius);
      marker.position.set(x, y, z);

      marker.children.forEach(child => {
        if (child instanceof Sprite) {
          child.lookAt(SceneManager.camera.position);
        }
      });
    });
  }


  public loadSatellitesFromArray(data: { id: string, tle_line_1: string, tle_line_2: string, name: string }[]): void {
    for (const sat of data) {
      this.addSatellite(sat.id, sat.tle_line_1, sat.tle_line_2, sat.name);
    }
  }
}
