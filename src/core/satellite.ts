import { Mesh, Line, BufferGeometry, Float32BufferAttribute, LineBasicMaterial, Vector3 } from 'three';
import * as satellite from 'satellite.js';

import { loadAndMergeSatelliteData } from "../assets/data/data-loader";
import { Earth } from './earth';
import { SceneManager } from './scene.manager';

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

  private loadedSatelliteIds: Set<string> = new Set();

  constructor(private readonly earth: Earth) {}

  public addSatellite(id: string, tleLine1: string, tleLine2: string, name: string, orbitalParams?: any ): void {
    if (this.markers.has(id) || this.loadedSatelliteIds.has(id)) return;
    this.loadedSatelliteIds.add(id);

    const satrec = satellite.twoline2satrec(tleLine1, tleLine2);
    const now = new Date();
    const posVel = satellite.propagate(satrec, now);

    if (!posVel?.position) return;

    const earthRadiusKm = 6371;
    const earthSceneRadius = this.earth.getRadius();
    const scaleFactor = earthSceneRadius / earthRadiusKm;

    const posScaled = new Vector3(
      posVel.position.x * scaleFactor,
      posVel.position.z * scaleFactor,
      posVel.position.y * scaleFactor
    );

    if (!SceneManager.isPOV(posScaled, this.earth.getCamera())) return;

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

    this.startDynamicLoading(filteredData);
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
    this.loadedSatelliteIds.delete(id);

    if (this.markers.size === 0 && this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  public updateSatellites(allSatellitesData?: any[]): void {
    const now = new Date();
    const camera = this.earth.getCamera();
    camera.updateMatrixWorld(true);

    const earthRadiusKm = 6371;
    const earthSceneRadius = this.earth.getRadius();
    const scaleFactor = earthSceneRadius / earthRadiusKm;

    // 1. Actualiza posiciones de satélites ya cargados y elimina los fuera del POV
    for (const [id, marker] of this.markers.entries()) {
      const data = this.satData.get(id);
      if (!data) continue;

      const posVel = satellite.propagate(data.satrec, now);
      if (!posVel?.position) continue;

      const posScaled = new Vector3(
        posVel.position.x * scaleFactor,
        posVel.position.z * scaleFactor,
        posVel.position.y * scaleFactor
      );

      // Actualiza posición del marcador
      marker.position.copy(posScaled);

      // Si ya no está visible, lo eliminamos
      if (!SceneManager.isPOV(posScaled, camera)) {
        this.removeSatellite(id);
      }
    }

    // 2. Si se pasó el arreglo con todos los satélites, intentar cargar los nuevos visibles
    if (allSatellitesData && allSatellitesData.length > 0) {
      for (const sat of allSatellitesData) {
        const id = sat.norad_cat_id;
        if (this.loadedSatelliteIds.has(id)) continue; // Ya cargado

        try {
          const satrec = satellite.twoline2satrec(sat.tle_line_1, sat.tle_line_2);
          const posVel = satellite.propagate(satrec, now);
          if (!posVel?.position) continue;

          const posScaled = new Vector3(
            posVel.position.x * scaleFactor,
            posVel.position.z * scaleFactor,
            posVel.position.y * scaleFactor
          );

          if (SceneManager.isPOV(posScaled, camera)) {
            const name = sat.info?.satname ?? 'Unknown';
            this.addSatellite(id, sat.tle_line_1, sat.tle_line_2, name, sat.orbital);
          }
        } catch (err) {
          console.warn(`Error procesando satélite ${id}`, err);
        }
      }
    }

    // 3. Si no hay satélites y el intervalo está activo, limpia el intervalo
    if (this.markers.size === 0 && this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
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
    const orbitalPeriodMinutes = (2 * Math.PI) / satrec.no;
    const stepMinutes = 2;
    const steps = Math.ceil(orbitalPeriodMinutes / stepMinutes);

    const positions: number[] = [];

    for (let i = 0; i <= steps; i++) {
      const time = new Date(now.getTime() + i * stepMinutes * 60 * 1000);
      const eci = satellite.propagate(satrec, time)?.position;
      if (!eci) continue;

      // CORRECTED COORDINATES: x, z, y
      const x = eci.x * scaleFactor;
      const y = eci.y * scaleFactor;
      const z = eci.z * scaleFactor;

      positions.push(x, z, y); // ← z como Y, y como Z
    }

    // Añadir el primer punto al final para cerrar la órbita
    positions.push(positions[0], positions[1], positions[2]);

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
    this.loadedSatelliteIds.clear();
  }

  private cleanupSatellites(): void {
    const camera = this.earth.getCamera();
    for (const [id, marker] of this.markers.entries()) {
      if (!SceneManager.isPOV(marker.position, camera)) {
        this.removeSatellite(id);
      }
    }
  }

  public startDynamicLoading(allSatellitesData: any[]): void {
    setInterval(() => {
      const now = new Date();
      const camera = this.earth.getCamera();
      camera.updateMatrixWorld(true);

      const earthRadiusKm = 6371;
      const earthSceneRadius = this.earth.getRadius();
      const scaleFactor = earthSceneRadius / earthRadiusKm;

      for (const sat of allSatellitesData) {
        const id = sat.norad_cat_id;
        if (this.loadedSatelliteIds.has(id)) continue;

        try {
          const satrec = satellite.twoline2satrec(sat.tle_line_1, sat.tle_line_2);
          const posVel = satellite.propagate(satrec, now);
          if (!posVel?.position) continue;

          const posScaled = new Vector3(
            posVel.position.x * scaleFactor,
            posVel.position.z * scaleFactor,
            posVel.position.y * scaleFactor
          );

          if (SceneManager.isPOV(posScaled, camera)) {
            const name = sat.info?.satname ?? 'Unknown';
            this.addSatellite(id, sat.tle_line_1, sat.tle_line_2, name, sat.orbital);
          }
        } catch (err) {
          console.warn(`Error con el satélite ${id}`, err);
        }
      }

      // Limpia satélites fuera del POV
      this.cleanupSatellites();

    }, 3000);
  }
}
