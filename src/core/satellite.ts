import { Line, BufferGeometry, Float32BufferAttribute, LineBasicMaterial, Vector3, Object3D, MeshBasicMaterial, InstancedMesh, Color, SphereGeometry, DynamicDrawUsage, Matrix4, Quaternion } from 'three';
import * as satellite from 'satellite.js';

import { loadAndMergeSatelliteData } from '../assets/data/data-loader';
import { Earth } from './earth';
import { SceneManager } from './scene.manager';

const EARTH_RADIUS_KM = 6371;

interface SatelliteData {
  tleLine1: string;
  tleLine2: string;
  name: string;
  satrec: satellite.SatRec;
  orbital?: any;
  position?: Vector3;
  id: string;
  altitude: number;
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
  private instancedMeshes: Map<string, InstancedMesh> = new Map();
  private instanceIndexCounter: Map<string, number> = new Map();
  private instanceLookup: Map<string, { orbitType: string, index: number }> = new Map();
  private visibleSatellitesIds = new Set<string>();
  private propagatedPositions = new Map<string, Vector3>();
  private visibleSatelliteIds = new Set<string>();
  private hiddenSatelliteIds = new Set<string>();
  private satelliteDataArray: SatelliteData[] = [];

  private lastUpdateTime = 0;
  private readonly UPDATE_THROTTLE = 100;
  private readonly POSITION_CACHE_TIME = 5000;
  private positionCache = new Map<string, { position: Vector3, timestamp: number }>();
  private readonly CLUSTER_RADIUS = 100;
  private readonly MAX_INSTANCES_PER_TYPE = 50000;
  private readonly LOD_DISTANCES = {
    CLOSE: 1000,
    MEDIUM: 5000,
    FAR: 20000
  };

  private clusters: Map<string, Set<string>> = new Map();
  private clusterPositions: Map<string, Vector3> = new Map();

  constructor(private readonly earth: Earth) {}

  public addSatelliteClickListener(callback: (data: SatelliteData) => void) {
    this.onSatelliteClickCallback = callback;
  }

  public getInstancedMesh(): InstancedMesh | null {
    const meshes = Array.from(this.instancedMeshes.values());
    if (meshes.length === 0) {
      console.log('No hay meshes instanciados disponibles');
      return null;
    }

    // Combinamos todos los meshes en uno solo para el raycast
    const combinedMesh = new InstancedMesh(
      new SphereGeometry(0.2),
      new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 }),
      this.MAX_INSTANCES_PER_TYPE
    );

    let totalInstances = 0;
    const matrix = new Matrix4();
    const position = new Vector3();
    const quaternion = new Quaternion();
    const scale = new Vector3();

    const combinedToOriginalMap = new Map<number, { orbitType: string, originalIndex: number }>();

    for (const [orbitType, mesh] of this.instancedMeshes) {
      const instanceCount = this.instanceIndexCounter.get(orbitType) || 0;
      console.log(`Procesando ${instanceCount} instancias de tipo ${orbitType}`);

      for (let i = 0; i < instanceCount; i++) {
        mesh.getMatrixAt(i, matrix);
        matrix.decompose(position, quaternion, scale);
        combinedMesh.setMatrixAt(totalInstances, matrix);
        combinedToOriginalMap.set(totalInstances, { orbitType, originalIndex: i });
        totalInstances++;
      }
    }

    combinedMesh.count = totalInstances;
    combinedMesh.instanceMatrix.needsUpdate = true;
    combinedMesh.frustumCulled = false;

    combinedMesh.raycast = (raycaster: any, intersects: any) => {
      const matrix = new Matrix4();
      const position = new Vector3();
      const quaternion = new Quaternion();
      const scale = new Vector3();

      for (let i = 0; i < totalInstances; i++) {
        combinedMesh.getMatrixAt(i, matrix);
        matrix.decompose(position, quaternion, scale);

        const distance = raycaster.ray.distanceToPoint(position);
        if (distance < 2) {
          const originalData = combinedToOriginalMap.get(i);
          if (originalData) {
            intersects.push({
              distance: distance,
              point: position.clone(),
              instanceId: i,
              object: combinedMesh,
              userData: originalData // Añadimos los datos originales
            });
          }
        }
      }
    };

    return combinedMesh;
  }

  public getSatelliteDataByInstancedId(index: number): SatelliteData | null {
    for (const [orbitType, _] of this.instancedMeshes) {
      const instanceCount = this.instanceIndexCounter.get(orbitType) || 0;
      if (index < instanceCount) {
        return this.satelliteDataArray[index] || null;
      }
      index -= instanceCount;
    }
    return null;
  }

  private createInstancedMesh(orbitType: string, color: number, maxCount = this.MAX_INSTANCES_PER_TYPE) {
    const geometry = new SphereGeometry(0.2);
    const material = new MeshBasicMaterial({
      color: new Color(color),
      transparent: true,
      opacity: 0.8
    });

    const instancedMesh = new InstancedMesh(geometry, material, maxCount);
    instancedMesh.instanceMatrix.setUsage(DynamicDrawUsage);
    instancedMesh.frustumCulled = false;
    instancedMesh.raycast = (raycaster: any, intersects: any) => {
      const matrix = new Matrix4();
      const position = new Vector3();
      const quaternion = new Quaternion();
      const scale = new Vector3();

      const instanceCount = this.instanceIndexCounter.get(orbitType) || 0;
      console.log(`Raycasting ${instanceCount} instances for orbit type ${orbitType}`);

      for (let i = 0; i < instanceCount; i++) {
        instancedMesh.getMatrixAt(i, matrix);
        matrix.decompose(position, quaternion, scale);

        const distance = raycaster.ray.distanceToPoint(position);

        if (distance < 2) { // Aumentamos el radio de detección
          intersects.push({
            distance: distance,
            point: position.clone(),
            instanceId: i,
            object: instancedMesh
          });
        }
      }
    };

    this.earth.addToScene(instancedMesh);
    this.instancedMeshes.set(orbitType, instancedMesh);
    this.instanceIndexCounter.set(orbitType, 0);
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

  public addSatellite(id: string, tleLine1: string, tleLine2: string, name: string, orbital?: any, position?: Vector3): void {
    if (this.markers.has(id) || this.loadedSatelliteIds.has(id)) return;

    const satrec = satellite.twoline2satrec(tleLine1, tleLine2);
    const now = new Date();
    const posVel = satellite.propagate(satrec, now);
    if (!posVel?.position) return;

    const scaleFactor = this.earth.getRadius() / EARTH_RADIUS_KM;
    const posScaled = position || new Vector3(
      posVel.position.x * scaleFactor,
      posVel.position.z * scaleFactor,
      posVel.position.y * scaleFactor
    );

    if (!SceneManager.isPOV(posScaled, this.earth.getCamera())) return;

    const { color, orbitType } = this.getOrbitTypeAndColor(posVel.position);

    if (!this.instancedMeshes.has(orbitType)) {
      this.createInstancedMesh(orbitType, color);
    }

    const instancedMesh = this.instancedMeshes.get(orbitType);
    const index = this.instanceIndexCounter.get(orbitType)!;

    if (index >= this.MAX_INSTANCES_PER_TYPE) {
      console.warn(`Reached instance limit for orbit type ${orbitType}`);
      return;
    }

    this.instanceLookup.set(id, { orbitType, index });

    const dummy = new Object3D();
    dummy.position.copy(posScaled);
    dummy.updateMatrix();
    instancedMesh!.setMatrixAt(index, dummy.matrix);
    instancedMesh!.instanceMatrix.needsUpdate = true;

    const r = Math.sqrt(
      posVel.position.x ** 2 +
      posVel.position.y ** 2 +
      posVel.position.z ** 2
    );
    const altitude = Math.abs(r - EARTH_RADIUS_KM);

    const satData: SatelliteData = {
      tleLine1,
      tleLine2,
      name,
      satrec,
      orbital,
      position: posScaled,
      id: id,
      altitude: altitude
    };
    this.satData.set(id, satData);
    this.satelliteDataArray[index] = satData;
    this.loadedSatelliteIds.add(id);
    this.visibleSatelliteIds.add(id);
    this.hiddenSatelliteIds.delete(id);
    this.instanceIndexCounter.set(orbitType, index + 1);
  }

  public async loadSatellites(showAll: boolean = false): Promise<void> {
    const satellitesData = await loadAndMergeSatelliteData();

    this.allSatellitesData = showAll
      ? satellitesData
      : satellitesData.filter(sat => (sat.info?.satname?.toLowerCase() ?? '').includes('starlink'));

    this.startDynamicLoading();
  }

public async loadSatelliteById(id: string): Promise<Object3D | undefined> {
  if (this.markers.has(id)) {
    return this.markers.get(id);
  }

  const sat = this.allSatellitesData.find(s => s.norad_cat_id?.toString() === id.toString());
  if (!sat) {
    console.warn(`No se encontró satélite con ID ${id} en datos cargados.`);
    return undefined;
  }

  try {
    const name = sat.info?.satname ?? 'Unknown';
    const orbital = sat.orbital ?? {};
    const satrec = satellite.twoline2satrec(sat.tle_line_1, sat.tle_line_2);
    const posVel = satellite.propagate(satrec, new Date());

    if (!posVel?.position) return undefined;

    const scaleFactor = this.earth.getRadius() / EARTH_RADIUS_KM;
    const position = new Vector3(
      posVel.position.x * scaleFactor,
      posVel.position.y * scaleFactor,
      posVel.position.z * scaleFactor
    );

    this.addSatellite(id, sat.tle_line_1, sat.tle_line_2, name, orbital, position);

    // Espera mínimo para que renderice el nuevo objeto
    await new Promise(r => setTimeout(r, 50));

    return this.markers.get(id);
  } catch (e) {
    console.error(`Error al cargar satélite ${id}:`, e);
    return undefined;
  }
}

  public getSatelliteMeshes(): Object3D[] {
    return Array.from(this.markers.values());
  }

  private getCachedPosition(id: string, satrec: satellite.SatRec): Vector3 | null {
    const cached = this.positionCache.get(id);
    const now = Date.now();

    if (cached && (now - cached.timestamp) < this.POSITION_CACHE_TIME) {
      return cached.position;
    }

    const posVel = satellite.propagate(satrec, new Date());
    if (!posVel?.position) return null;

    const scaleFactor = this.earth.getRadius() / EARTH_RADIUS_KM;
    const position = new Vector3(
      posVel.position.x * scaleFactor,
      posVel.position.z * scaleFactor,
      posVel.position.y * scaleFactor
    );

    this.positionCache.set(id, { position, timestamp: now });
    return position;
  }

  private cleanupPositionCache() {
    const now = Date.now();
    for (const [id, data] of this.positionCache.entries()) {
      if (now - data.timestamp > this.POSITION_CACHE_TIME) {
        this.positionCache.delete(id);
      }
    }
  }

  private updateClusters(): void {
    this.clusters.clear();
    this.clusterPositions.clear();

    for (const [id, position] of this.propagatedPositions) {
      let assigned = false;
      for (const [clusterId, clusterPos] of this.clusterPositions) {
        if (position.distanceTo(clusterPos) < this.CLUSTER_RADIUS) {
          this.clusters.get(clusterId)!.add(id);
          assigned = true;
          break;
        }
      }

      if (!assigned) {
        const newClusterId = `cluster_${this.clusters.size}`;
        this.clusters.set(newClusterId, new Set([id]));
        this.clusterPositions.set(newClusterId, position.clone());
      }
    }
  }

  private getLODLevel(distance: number): number {
    if (distance < this.LOD_DISTANCES.CLOSE) return 1;
    if (distance < this.LOD_DISTANCES.MEDIUM) return 0.5;
    if (distance < this.LOD_DISTANCES.FAR) return 0.25;
    return 0.1;
  }

  public updateSatellites(): void {
    const now = Date.now();
    if (now - this.lastUpdateTime < this.UPDATE_THROTTLE) {
      return;
    }

    this.lastUpdateTime = now;

    const camera = this.earth.getCamera();
    const cameraPosition = camera.position.clone();
    const dummy = new Object3D();

    // Actualizar clusters
    this.updateClusters();

    // Actualizar posiciones de satélites
    for (const [id, position] of this.propagatedPositions) {
      const distance = position.distanceTo(cameraPosition);
      const lodLevel = this.getLODLevel(distance);

      // Si está muy lejos, usar el cluster
      if (lodLevel < 0.5) {
        const clusterId = Array.from(this.clusters.entries())
          .find(([_, satellites]) => satellites.has(id))?.[0];

        if (clusterId) {
          const clusterPos = this.clusterPositions.get(clusterId)!;
          dummy.position.copy(clusterPos);
          dummy.scale.setScalar(lodLevel * 2); // Hacer el cluster más visible
        }
      } else {
        dummy.position.copy(position);
        dummy.scale.setScalar(lodLevel);
      }

      dummy.updateMatrix();

      const meshData = this.instanceLookup.get(id);
      if (meshData) {
        const { orbitType, index } = meshData;
        this.instancedMeshes.get(orbitType)!.setMatrixAt(index, dummy.matrix);
      }
    }

    for (const mesh of this.instancedMeshes.values()) {
      mesh.instanceMatrix.needsUpdate = true;
    }

    if (this.loadedSatelliteIds.size < this.allSatellitesData.length) {
      this.tryAddVisibleSatellites();
    }
  }

  private tryAddVisibleSatellites(): void {
    const camera = this.earth.getCamera();
    const cameraPosition = camera.position.clone();
    const batchSize = 1000;
    let loadedCount = 0;

    for (const sat of this.allSatellitesData) {
      if (loadedCount >= batchSize) break;

      const id = sat.norad_cat_id;
      if (this.loadedSatelliteIds.has(id)) continue;

      try {
        const satrec = satellite.twoline2satrec(sat.tle_line_1, sat.tle_line_2);
        const posScaled = this.getCachedPosition(id, satrec);

        if (!posScaled) continue;

        const distance = posScaled.distanceTo(cameraPosition);
        if (distance < this.LOD_DISTANCES.FAR) {
          const name = sat.info?.satname ?? 'Unknown';
          const orbital = sat.orbital ?? {};
          this.addSatellite(id, sat.tle_line_1, sat.tle_line_2, name, orbital, posScaled);
          loadedCount++;
        }
      } catch (error) {
        console.warn(`Error processing satellite ${id}:`, error);
      }
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
      this.updateInterval = setInterval(() => this.updateSatellites(), 100);
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
    }, 500);
  }

  public stopDynamicLoading(): void {
    if (this.dynamicLoadingInterval) {
      clearInterval(this.dynamicLoadingInterval);
      this.dynamicLoadingInterval = null;
    }
  }

  private cleanupSatellites(): void {
    const camera = this.earth.getCamera();
    for (const [id, data] of this.satData.entries()) {
      const pos = this.getCachedPosition(id, data.satrec);
      if (!pos || !SceneManager.isPOV(pos, camera)) {
        this.removeSatellite(id);
      }
    }
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

        const scaleFactor = this.earth.getRadius() / EARTH_RADIUS_KM;
        const position = new Vector3(
          posVel.position.x * scaleFactor,
          posVel.position.z * scaleFactor,
          posVel.position.y * scaleFactor
        );

        const name = sat.info?.satname ?? 'Unknown';
        const orbital = sat.orbital ?? {};
        this.addSatellite(id, sat.tle_line_1, sat.tle_line_2, name, orbital, position);

        const satData: SatelliteData = {
          tleLine1: sat.tle_line_1,
          tleLine2: sat.tle_line_2,
          name,
          satrec,
          orbital,
          position,
          id: id,
          altitude: 0
        };
        results.push(satData);
      } catch {
        continue;
      }
    }

    return results;
  }

  public getOrbitTypeAndColor(positionEci: { x: number; y: number; z: number }): { orbitType: string; color: number } {
    const r = Math.sqrt(positionEci.x ** 2 + positionEci.y ** 2 + positionEci.z ** 2);
    const altitude = Math.abs(r - EARTH_RADIUS_KM);

    if (altitude >= 160 && altitude <= 2000) {
      return { orbitType: 'LEO (Órbita Terrestre Baja)', color: 0x00ff00 };  // verde
    } else if (altitude > 2000 && altitude < 35786) {
      return { orbitType: 'MEO (Órbita Terrestre Media)', color: 0xffff00 };  // amarillo
    } else if (altitude >= 35686 && altitude <= 35886) {
      return { orbitType: 'GEO (Órbita Geosíncrona)', color: 0xff0000 };  // rojo
    } else {
      return { orbitType: 'Desconocido', color: 0x888888 }; // gris
    }
  }

  public calculateAltitude(positionEci: { x: number; y: number; z: number }): number {
    const r = Math.sqrt(positionEci.x ** 2 + positionEci.y ** 2 + positionEci.z ** 2);
    return r - EARTH_RADIUS_KM;
  }
}
