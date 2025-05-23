
import { Mesh, Line, BufferGeometry, Float32BufferAttribute, LineBasicMaterial, Vector3, Object3D, MeshBasicMaterial } from 'three';
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
  orbital?: any;
}

export class SatelliteManager {
  private markers: Map<string, Object3D> = new Map();
  private satData: Map<string, SatelliteData> = new Map();
  private updateInterval: ReturnType<typeof setInterval> | null = null;
  private dynamicLoadingInterval: ReturnType<typeof setInterval> | null = null;
  private orbits: Map<string, Line> = new Map();
  private loadedSatelliteIds: Set<string> = new Set();
  private onSatelliteClickCallback?: (data: SatelliteData) => void;
  private allSatellitesData: any[] = [];

  constructor(private readonly earth: Earth) {}

  public addSatelliteClickListener(callback: (data: SatelliteData) => void) {
    this.onSatelliteClickCallback = callback;
  }

  public handleSatelliteClick(id: string): void {
    const data = this.satData.get(id);
    if (data && this.onSatelliteClickCallback) {
      // Protegemos por si hay TLEs inválidos
      if (!data.tleLine1 || !data.tleLine2) {
        console.warn(`Satélite ${id} no tiene TLE válido`, data);
        return;
      }
      this.onSatelliteClickCallback(data);
    }
  }

public addSatellite(id: string, tleLine1: string, tleLine2: string, name: string, orbital?: any): void {
  if (this.markers.has(id) || this.loadedSatelliteIds.has(id)) return;

  const satrec = satellite.twoline2satrec(tleLine1, tleLine2);
  const now = new Date();
  const posVel = satellite.propagate(satrec, now);
  if (!posVel?.position) return;

  // Escalar posición ECI a unidades de la escena
  const scaleFactor = this.earth.getRadius() / EARTH_RADIUS_KM;
  const posScaled = new Vector3(
    posVel.position.x * scaleFactor,
    posVel.position.y * scaleFactor,
    posVel.position.z * scaleFactor
  );

  if (!SceneManager.isPOV(posScaled, this.earth.getCamera())) return;

  // Calcular tipo de órbita y color SOLO una vez
  const { color, orbitType } = this.getOrbitTypeAndColor(posVel.position);

  let marker: Object3D;
  const model = SceneManager.modelsByName.get(name.toLowerCase()) || SceneManager.starlinkModel;

  if (model) {
    marker = model.clone();
    marker.position.copy(posScaled);

    if (marker instanceof Mesh) {
      this.setColorOnMesh(marker, color, orbitType);
    }

    marker.name = name;
    this.earth.addToScene(marker);
  } else {
    marker = this.earth.addMarkerFromEci(posVel.position);
  }

  // Guardar también el tipo de órbita y color calculado
  this.applyUserDataToHierarchy(marker, {
    tleLine1,
    tleLine2,
    name,
    id,
    orbital,
    orbitType,
    color
  });

  this.markers.set(id, marker);
  this.satData.set(id, { tleLine1, tleLine2, name, satrec, orbital });
  this.loadedSatelliteIds.add(id);
  this.startUpdating();
}

  private applyUserDataToHierarchy(obj: Object3D, userData: any): void {
    obj.userData = userData;
    obj.traverse(child => {
      child.userData = userData;
    });
  }

  public async loadSatellites(filterStarlinkOnly: boolean = true): Promise<void> {
    const satellitesData = await loadAndMergeSatelliteData();

    this.allSatellitesData = filterStarlinkOnly
      ? satellitesData.filter(sat => (sat.info?.satname?.toLowerCase() ?? '').includes('starlink'))
      : satellitesData;

    this.startDynamicLoading();
  }

public async loadSatelliteById(id: string): Promise<Object3D | undefined> {
  if (this.markers.has(id)) {
    return this.markers.get(id);
  }

  const sat = this.allSatellitesData.find(s => s.norad_cat_id === id);
  if (!sat) {
    console.warn(`No se encontró satélite con ID ${id} en datos cargados.`);
    return undefined;  // <-- Cambia null por undefined
  }

  try {
    const name = sat.info?.satname ?? 'Unknown';
    const orbital = sat.orbital ?? {};
    this.addSatellite(id, sat.tle_line_1, sat.tle_line_2, name, orbital);

    await new Promise(r => setTimeout(r, 50));

    return this.markers.get(id);  // Puede ser undefined, no null
  } catch (e) {
    console.error(`Error al cargar satélite ${id}:`, e);
    return undefined;  // <-- Cambia null por undefined
  }
}

  public getSatelliteMeshes(): Object3D[] {
  return Array.from(this.markers.values());
}

  private tryAddVisibleSatellites(): void {
    const now = new Date();
    const camera = this.earth.getCamera();
    const scaleFactor = this.earth.getRadius() / EARTH_RADIUS_KM;

    for (const sat of this.allSatellitesData) {
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
        // console.log('Datos satélite:', sat);

        if (SceneManager.isPOV(posScaled, camera)) {
          const name = sat.info?.satname ?? 'Unknown';
          const orbital = sat.orbital ?? {};
          this.addSatellite(id, sat.tle_line_1, sat.tle_line_2, name, orbital);
        }
      } catch {}
    }
  }

  public updateSatellites(): void {
    const now = new Date();
    const camera = this.earth.getCamera();
    const scaleFactor = this.earth.getRadius() / EARTH_RADIUS_KM;

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

    if (this.allSatellitesData.length > 0) {
      this.tryAddVisibleSatellites();
    }
  }

  public drawOrbit(id: string, tleLine1: string, tleLine2: string): Line | null {
    const existing = this.orbits.get(id);
    if (existing) this.earth.removeFromScene(existing);

    if (!tleLine1 || !tleLine2) {
      console.warn(`TLE inválido para el satélite ${id}`, tleLine1, tleLine2);
      return null;
    }

    const satrec = satellite.twoline2satrec(tleLine1, tleLine2);
    if (!satrec.no || satrec.no === 0) return null;

    const positions: number[] = [];
    const now = new Date();
    const scaleFactor = this.earth.getRadius() / EARTH_RADIUS_KM;
    const periodMinutes = (2 * Math.PI) / satrec.no;
    const stepMinutes = 2;
    const steps = Math.ceil(periodMinutes / stepMinutes);

    for (let i = 0; i <= steps; i++) {
      const time = new Date(now.getTime() + i * stepMinutes * 60 * 1000);
      const pos = satellite.propagate(satrec, time)?.position;
      if (!pos) continue;

      positions.push(pos.x * scaleFactor, pos.z * scaleFactor, pos.y * scaleFactor);
    }

    if (positions.length >= 3) {
      positions.push(positions[0], positions[1], positions[2]);
      const geometry = new BufferGeometry();
      geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
      const line = new Line(geometry, new LineBasicMaterial({ color: 0xffaa00 }));
      this.earth.addToScene(line);
      this.orbits.set(id, line);
      return line;
    }

    return null;
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

    if (this.markers.size === 0) {
      this.stopUpdating();
      this.stopDynamicLoading();
    }
  }

  public dispose(): void {
    this.stopUpdating();
    this.stopDynamicLoading();
    this.markers.forEach(m => this.earth.removeMarker(m));
    this.orbits.forEach(o => this.earth.removeFromScene(o));
    this.markers.clear();
    this.orbits.clear();
    this.satData.clear();
    this.loadedSatelliteIds.clear();
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

  public startDynamicLoading(): void {
    this.stopDynamicLoading();
    this.dynamicLoadingInterval = setInterval(() => {
      this.tryAddVisibleSatellites();
      this.cleanupSatellites();
    }, 3000);
  }

  public stopDynamicLoading(): void {
    if (this.dynamicLoadingInterval) {
      clearInterval(this.dynamicLoadingInterval);
      this.dynamicLoadingInterval = null;
    }
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

  public searchAndDisplaySatelliteByName(nameQuery: string): SatelliteData[] {
  const results: SatelliteData[] = [];

  const matched = this.allSatellitesData.filter(sat => {
    const name = sat.info?.satname ?? '';
    return name.toLowerCase().includes(nameQuery.toLowerCase());
  });

  for (const sat of matched) {
    const id = sat.norad_cat_id;
    if (this.loadedSatelliteIds.has(id)) {
      const existing = this.satData.get(id);
      if (existing) results.push(existing);
      continue;
    }

    try {
      const satrec = satellite.twoline2satrec(sat.tle_line_1, sat.tle_line_2);
      const posVel = satellite.propagate(satrec, new Date());
      if (!posVel?.position) continue;

      const name = sat.info?.satname ?? 'Unknown';
      const orbital = sat.orbital ?? {};
      this.addSatellite(id, sat.tle_line_1, sat.tle_line_2, name, orbital);

      const satData: SatelliteData = { tleLine1: sat.tle_line_1, tleLine2: sat.tle_line_2, name, satrec, orbital };
      results.push(satData);
    } catch {
      continue;
    }
  }

  return results;
}

private getOrbitTypeAndColor(positionEci: { x: number; y: number; z: number }): { orbitType: string; color: number } {
  const r = Math.sqrt(positionEci.x ** 2 + positionEci.y ** 2 + positionEci.z ** 2);
  const altitude = r - EARTH_RADIUS_KM;
  // console.log(`Altitud: ${altitude.toFixed(2)} km`);

  if (altitude >= 160 && altitude <= 2000) {
    return { orbitType: 'LEO', color: 0x00ff00 };  // verde
  } else if (altitude > 2000 && altitude < 35786) {
    return { orbitType: 'MEO', color: 0xffff00 };  // amarillo
  } else if (altitude >= 35686 && altitude <= 35886) {
    return { orbitType: 'GEO', color: 0xff0000 };  // rojo
  } else {
    return { orbitType: 'Other', color: 0x888888 }; // gris
  }
}

  private setColorOnMesh(obj: Object3D, color: number, orbitType: string) {
    obj.traverse(child => {
      if (child instanceof Mesh) {
        if (Array.isArray(child.material)) {
          child.material.forEach(mat => {
            (mat as MeshBasicMaterial).color.setHex(color);
          });
        } else {
          (child.material as MeshBasicMaterial).color.setHex(color);
        }
        child.userData['orbitType'] = orbitType;
      }
    });
  }
}
