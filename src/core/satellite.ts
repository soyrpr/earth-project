import { Mesh, Line, BufferGeometry, Float32BufferAttribute, LineBasicMaterial, Vector3 } from 'three';
import * as satellite from 'satellite.js';

import { loadAndMergeSatelliteData } from "../assets/data/data-loader";
import { Earth } from './earth';

interface SatelliteData {
  tleLine1: string;
  tleLine2: string;
  name: string;
  satrec: satellite.SatRec;
  orbitalParams?: any; // Nuevo parámetro opcional
}

export class SatelliteManager {
  private markers: Map<string, Mesh> = new Map();
  private satData: Map<string, SatelliteData> = new Map();
  private updateInterval: ReturnType<typeof setInterval> | null = null;
  private orbits: Map<string, Line> = new Map();

  constructor(private readonly earth: Earth) {}

  public addSatellite(
    id: string,
    tleLine1: string,
    tleLine2: string,
    name: string,
    orbitalParams?: any // Nuevo parámetro
  ): void {
    if (this.markers.has(id)) return;

    const satrec = satellite.twoline2satrec(tleLine1, tleLine2);
    const now = new Date();
    const posVel = satellite.propagate(satrec, now);

    if (!posVel?.position) return;

    const marker = this.earth.addMarkerFromEci(posVel.position);
    // Guardamos orbitalParams en userData para mostrar info después
    marker.userData = { tleLine1, tleLine2, name, id, orbitalParams };
    marker.name = name;

    this.markers.set(id, marker);
    this.satData.set(id, { tleLine1, tleLine2, name, satrec, orbitalParams });

    if (!this.updateInterval) {
      this.updateInterval = setInterval(() => this.updateSatellites(), 1000);
    }
  }

  public async loadSatellites(filterStarlinkOnly: boolean = true): Promise<void> {
    const satellitesData = await loadAndMergeSatelliteData();

    const filteredData = filterStarlinkOnly
      ? satellitesData.filter(sat => {
          const name = sat.info?.satname?.toLowerCase() ?? '';
          return name.startsWith('starlink') || name.includes('starlink ');
        })
      : satellitesData;

    console.log(`Total de satélites cargados: ${satellitesData.length}`);
    console.log(`Satélites visibles (filtrados): ${filteredData.length}`);

    filteredData.forEach((sat) => {
      const satname = sat.info?.satname ?? 'Unknown';
      // Pasamos el objeto orbital completo como orbitalParams
      this.addSatellite(
        sat.norad_cat_id,
        sat.tle_line_1,
        sat.tle_line_2,
        satname,
        sat.orbital // Aquí se pasa la info orbital completa
      );
    });
  }

  public removeSatellite(id: string): void {
    const marker = this.markers.get(id);
    if (marker) {
      this.earth.removeMarker(marker);
      this.markers.delete(id);
    }

    const orbit = this.orbits.get(id);
    if (orbit) {
      this.earth.removeFromScene(orbit);
      this.orbits.delete(id);
    }

    this.satData.delete(id);

    if (this.markers.size === 0 && this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  public updateSatellites(): void {
    const now = new Date();
    const gmst = satellite.gstime(now);  // Greenwich Mean Sidereal Time

    const earthRadiusKm = 6371;
    const earthSceneRadius = this.earth.getRadius();
    const scaleFactor = earthSceneRadius / earthRadiusKm;

    for (const [id, marker] of this.markers.entries()) {
      const data = this.satData.get(id);
      if (!data) continue;

      const posVel = satellite.propagate(data.satrec, now);
      if (!posVel?.position) continue;

      // Convertir ECI a ECEF
      const ecefPos = satellite.eciToEcf(posVel.position, gmst);

      // Actualizar la posición del marcador en el sistema de tu escena
      // Usar coordenadas ECI directamente
      marker.position.set(
        ecefPos.x * scaleFactor,
        ecefPos.z * scaleFactor,  // ← esto será el eje Y en Three.js
        ecefPos.y * scaleFactor   // ← esto será el eje Z en Three.js
      );
    }
  }

  private updateOrbitLine(id: string, satPosition: { x: number; y: number; z: number }, scaleFactor: number): void {
    const orbitLine = this.orbits.get(id);
    if (!orbitLine) return;

    const positions = orbitLine.geometry.attributes['position'].array as Float32Array;

    const x = satPosition.x * scaleFactor;
    const y = satPosition.y * scaleFactor;
    const z = satPosition.z * scaleFactor;

    positions[0] = x;
    positions[1] = y;
    positions[2] = z;

    const len = positions.length;
    positions[len - 3] = x;
    positions[len - 2] = y;
    positions[len - 1] = z;

    orbitLine.geometry.attributes['position'].needsUpdate = true;
  }

  public drawOrbit(id: string, tleLine1: string, tleLine2: string): Line | null {
    const previousOrbit = this.orbits.get(id);
    if (previousOrbit) {
      this.earth.removeFromScene(previousOrbit);
    }

    const satrec = satellite.twoline2satrec(tleLine1, tleLine2);
    if (!satrec.no || satrec.no === 0) return null;

    const earthRadiusKm = 6371;
    const scaleFactor = this.earth.getRadius() / earthRadiusKm;

    const now = new Date();
    const eciNow = satellite.propagate(satrec, now)?.position;
    if (!eciNow) return null;

    const x0 = eciNow.x * scaleFactor;
    const y0 = eciNow.y * scaleFactor;
    const z0 = eciNow.z * scaleFactor;

    const positions: number[] = [x0, y0, z0];

    const orbitalPeriodMinutes = (2 * Math.PI) / satrec.no;
    const stepMinutes = 2;
    const steps = Math.ceil(orbitalPeriodMinutes / stepMinutes);

    for (let i = 1; i <= steps; i++) {
      const time = new Date(now.getTime() + i * stepMinutes * 60 * 1000);
      const eci = satellite.propagate(satrec, time)?.position;
      if (!eci) continue;

      const x = eci.x * scaleFactor;
      const y = eci.y * scaleFactor;
      const z = eci.z * scaleFactor;

      positions.push(x, y, z);
    }

    // Añadir el punto inicial otra vez para cerrar el bucle
    positions.push(x0, y0, z0);

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    const material = new LineBasicMaterial({ color: 0xffaa00 });
    const orbitLine = new Line(geometry, material);

    this.earth.addToScene(orbitLine);
    this.orbits.set(id, orbitLine);

    return orbitLine;
  }

  public dispose(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    this.markers.forEach(marker => this.earth.removeMarker(marker));
    this.orbits.forEach(orbit => this.earth.removeFromScene(orbit));
    this.markers.clear();
    this.orbits.clear();
    this.satData.clear();
  }
}
