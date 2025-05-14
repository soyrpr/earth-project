import * as satellite from "satellite.js";
import {
  BufferGeometry,
  Float32BufferAttribute,
  Line,
  LineBasicMaterial,
  Mesh,
  Sprite,
} from "three";
import { Earth } from "./earth";
import { SceneManager } from "./scene.manager";

interface SatelliteData {
  tleLine1: string;
  tleLine2: string;
  name: string;
  satrec: satellite.SatRec;
}

export class SatelliteManager {
  private markers: Map<string, Mesh> = new Map();
  private satData: Map<string, SatelliteData> = new Map();
  private updateInterval: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly earth: Earth) {}

  public addSatellite(id: string, tleLine1: string, tleLine2: string, name: string): void {
    if (this.markers.has(id)) return;

    const satrec = satellite.twoline2satrec(tleLine1, tleLine2);
    const now = new Date();
    const posVel = satellite.propagate(satrec, now);

    if (!posVel?.position) return;

    const gmst = satellite.gstime(now);
    const geo = satellite.eciToGeodetic(posVel.position, gmst);
    const lat = satellite.degreesLat(geo.latitude);
    const lon = satellite.degreesLong(geo.longitude);

    const marker = this.earth.addMovingMarker(lat, lon, 0x00ffff);
    marker.userData = { tleLine1, tleLine2, name };
    marker.name = name;

    this.markers.set(id, marker);
    this.satData.set(id, { tleLine1, tleLine2, name, satrec });

    if (!this.updateInterval) {
      this.updateInterval = setInterval(this.updateSatellites.bind(this), 1000);
    }
  }

  private updateSatellites(): void {
    const now = new Date();
    const gmst = satellite.gstime(now);
    const earthRadiusKm = 6371;
    const earthSceneRadius = this.earth.getRadius();
    const scaleFactor = earthSceneRadius / earthRadiusKm;

    for (const [id, marker] of this.markers.entries()) {
      const data = this.satData.get(id);
      if (!data) continue;

      const posVel = satellite.propagate(data.satrec, now);
      if (!posVel?.position) continue;

      const geo = satellite.eciToGeodetic(posVel.position, gmst);
      const lat = satellite.degreesLat(geo.latitude);
      const lon = satellite.degreesLong(geo.longitude);
      const alt = geo.height;
      const radius = earthSceneRadius + alt * scaleFactor;

      const [x, y, z] = this.earth.calcPosFromLatLonRad(lat, lon, radius);
      marker.position.set(x, y, z);

      marker.children.forEach((child) => {
        if (child instanceof Sprite) {
          child.lookAt(SceneManager.camera.position);
        }
      });
    }
  }

  public loadSatellitesFromArray(data: { id: string, tle_line_1: string, tle_line_2: string, name: string }[]): void {
    for (const sat of data) {
      this.addSatellite(sat.id, sat.tle_line_1, sat.tle_line_2, sat.name);
    }
  }

  public drawOrbit(tleLine1: string, tleLine2: string): Line {
    const satrec = satellite.twoline2satrec(tleLine1, tleLine2);
    const positions: number[] = [];

    const now = new Date();
    const earthRadiusKm = 6371;
    const earthSceneRadius = this.earth.getRadius();
    const scaleFactor = earthSceneRadius / earthRadiusKm;

    for (let i = 0; i <= 90; i++) {
      const time = new Date(now.getTime() + i * 60 * 1000);
      const eci = satellite.propagate(satrec, time);
      if (!eci?.position) continue;

      const gmst = satellite.gstime(time);
      const geo = satellite.eciToGeodetic(eci.position, gmst);
      const lat = satellite.degreesLat(geo.latitude);
      const lon = satellite.degreesLong(geo.longitude);
      const alt = geo.height;

      const radius = earthSceneRadius + alt * scaleFactor;
      const [x, y, z] = this.earth.calcPosFromLatLonRad(lat, lon, radius);
      positions.push(x, y, z);
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
    const material = new LineBasicMaterial({ color: 0xff00ff });
    return new Line(geometry, material);
  }
}
