import { Mesh, Line, BufferGeometry, Float32BufferAttribute, LineBasicMaterial, Vector3, Object3D } from 'three';
import * as satellite from 'satellite.js';

import { loadAndMergeSatelliteData } from "../assets/data/data-loader";
import { Earth } from './earth';
import { SceneManager } from './scene.manager';

const EARTH_RADIUS_KM = 6371;

interface SatelliteData {
  tleLine1: string;
  tleLine2: string;
  name: string;
  satrec: satellite.SatRec;
  orbitalParams?: any;
}

export class SatelliteManager {
  private markers: Map<string, Object3D> = new Map();
  private satData: Map<string, SatelliteData> = new Map();
  private updateInterval: ReturnType<typeof setInterval> | null = null;
  private dynamicLoadingInterval: ReturnType<typeof setInterval> | null = null;
  private orbits: Map<string, Line> = new Map();

  private loadedSatelliteIds: Set<string> = new Set();

  private onSatelliteClickCallback?: (data: SatelliteData) => void;

  constructor(private readonly earth: Earth) {}

  public addSatelliteClickListener(callback: (data: SatelliteData) => void) {
    this.onSatelliteClickCallback = callback;
  }

  public handleSatelliteClick(id: string): void {
    const data = this.satData.get(id);
    if (data && this.onSatelliteClickCallback) {
      this.onSatelliteClickCallback(data);
    }
  }

public addSatellite(id: string, tleLine1: string, tleLine2: string, name: string, orbitalParams?: any ): void {
  if (this.markers.has(id) || this.loadedSatelliteIds.has(id)) return;
  this.loadedSatelliteIds.add(id);

  const satrec = satellite.twoline2satrec(tleLine1, tleLine2);
  const now = new Date();
  const posVel = satellite.propagate(satrec, now);

  if (!posVel?.position) {
    console.warn(`No se pudo obtener posición para satélite ${id}`);
    return;
  }

  const earthSceneRadius = this.earth.getRadius();
  const scaleFactor = earthSceneRadius / EARTH_RADIUS_KM;

  const posScaled = new Vector3(
    posVel.position.x * scaleFactor,
    posVel.position.z * scaleFactor,
    posVel.position.y * scaleFactor
  );

  if (!SceneManager.isPOV(posScaled, this.earth.getCamera())) return;

  let marker: Object3D;

  // Buscar modelo específico por nombre
  const modelByName = SceneManager.modelsByName.get(name.toLowerCase());

  if (modelByName) {
    marker = modelByName.clone();
    marker.position.copy(posScaled);
    marker.name = name;
    this.earth.addToScene(marker);
  } else if (SceneManager.starlinkModel) {
    marker = SceneManager.starlinkModel.clone();
    marker.position.copy(posScaled);
    marker.name = name;
    this.earth.addToScene(marker);
  } else {
    // marcador básico de fallback
    marker = this.earth.addMarkerFromEci(posVel.position);
  }

  marker.userData = { tleLine1, tleLine2, name, id, orbitalParams };

  this.markers.set(id, marker);
  this.satData.set(id, { tleLine1, tleLine2, name, satrec, orbitalParams });

  this.startUpdating();
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
      this.addSatellite(
        sat.norad_cat_id,
        sat.tle_line_1,
        sat.tle_line_2,
        satname,
        sat.orbital
      );
    });

    this.startDynamicLoading(filteredData);

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
    this.loadedSatelliteIds.delete(id);

    if (this.markers.size === 0) {
      this.stopUpdating();
      this.stopDynamicLoading();
    }
  }

  public updateSatellites(allSatellitesData?: any[]): void {
  public updateSatellites(allSatellitesData?: any[]): void {
    const now = new Date();
    const camera = this.earth.getCamera();
    camera.updateMatrixWorld(true);
    const camera = this.earth.getCamera();
    camera.updateMatrixWorld(true);

    const earthSceneRadius = this.earth.getRadius();
    const scaleFactor = earthSceneRadius / EARTH_RADIUS_KM;

    // Actualiza posiciones y elimina satélites fuera del POV
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

      marker.position.copy(posScaled);

      if (!SceneManager.isPOV(posScaled, camera)) {
        this.removeSatellite(id);
      }
    }

    // Carga satélites nuevos visibles si se pasa el arreglo
    if (allSatellitesData && allSatellitesData.length > 0) {
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
          console.warn(`Error procesando satélite ${id}`, err);
        }
      }
    }

    if (this.markers.size === 0) {
      this.stopUpdating();
    }
  }

  public drawOrbit(id: string, tleLine1: string, tleLine2: string): Line | null {
    const previousOrbit = this.orbits.get(id);
    if (previousOrbit) {
      this.earth.removeFromScene(previousOrbit);
    }

    const satrec = satellite.twoline2satrec(tleLine1, tleLine2);
    if (!satrec.no || satrec.no === 0) return null;

    const earthSceneRadius = this.earth.getRadius();
    const scaleFactor = earthSceneRadius / EARTH_RADIUS_KM;

    const now = new Date();
    const orbitalPeriodMinutes = (2 * Math.PI) / satrec.no;
    const stepMinutes = 2;
    const steps = Math.ceil(orbitalPeriodMinutes / stepMinutes);

    const positions: number[] = [];

    for (let i = 0; i <= steps; i++) {
    const positions: number[] = [];

    for (let i = 0; i <= steps; i++) {
      const time = new Date(now.getTime() + i * stepMinutes * 60 * 1000);
      const eci = satellite.propagate(satrec, time)?.position;
      if (!eci) continue;

      // Consistente con el resto: x, z, y
      positions.push(
        eci.x * scaleFactor,
        eci.z * scaleFactor,
        eci.y * scaleFactor
      );
    }

    // Cerrar órbita añadiendo primer punto al final
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
    this.stopUpdating();
    this.stopDynamicLoading();

    this.markers.forEach(marker => this.earth.removeMarker(marker));
    this.orbits.forEach(orbit => this.earth.removeFromScene(orbit));
    this.markers.clear();
    this.orbits.clear();
    this.satData.clear();
    this.loadedSatelliteIds.clear();
  }

  private cleanupSatellites(): void {
    const camera = this.earth.getCamera();
    const toRemove: string[] = [];

    for (const [id, marker] of this.markers.entries()) {
      if (!SceneManager.isPOV(marker.position, camera)) {
        toRemove.push(id);
      }
    }

    toRemove.forEach(id => this.removeSatellite(id));
  }

  public startUpdating(): void {
    if (!this.updateInterval) {
      this.updateInterval = setInterval(() => this.updateSatellites(), 1000);
    }
  }

  public stopUpdating(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  public startDynamicLoading(allSatellitesData: any[]): void {
    this.stopDynamicLoading();

    this.dynamicLoadingInterval = setInterval(() => {
      const now = new Date();
      const camera = this.earth.getCamera();
      camera.updateMatrixWorld(true);

      const earthSceneRadius = this.earth.getRadius();
      const scaleFactor = earthSceneRadius / EARTH_RADIUS_KM;

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

      this.cleanupSatellites();
    }, 3000);
  }

  public stopDynamicLoading(): void {
    if (this.dynamicLoadingInterval) {
      clearInterval(this.dynamicLoadingInterval);
      this.dynamicLoadingInterval = null;
    }
  }
}
