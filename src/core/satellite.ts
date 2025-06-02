import { Line, BufferGeometry, Float32BufferAttribute, LineBasicMaterial, Vector3, Object3D, MeshBasicMaterial, InstancedMesh, Color, SphereGeometry, DynamicDrawUsage, Matrix4, Quaternion } from 'three';
import * as satellite from 'satellite.js';

import { loadAndMergeSatelliteData } from '../assets/data/data-loader';
import { Earth } from './earth';

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

const ORBIT_RANGES = {
  'LEO': {
    min: 160,
    max: 2000,
    description: 'Órbita Terrestre Baja (160-2000 km)',
    color: 0x00ff00,
    characteristics: [
      'Órbita más cercana a la Tierra',
      'Período orbital: 90-120 minutos',
      'Ideal para observación terrestre y comunicaciones de baja latencia',
      'Usado por la mayoría de satélites de observación y Starlink'
    ] as string[]
  },
  'MEO': {
    min: 2000,
    max: 35786,
    description: 'Órbita Terrestre Media (2000-35786 km)',
    color: 0xffff00,
    characteristics: [
      'Órbita intermedia',
      'Período orbital: 2-24 horas',
      'Usado principalmente por satélites de navegación (GPS, Galileo)',
      'Cobertura más amplia que LEO'
    ] as string[]
  },
  'GEO': {
    min: 35786,
    max: 35886,
    description: 'Órbita Geosíncrona (35786 km)',
    color: 0xff0000,
    characteristics: [
      'Órbita más alta comúnmente usada',
      'Período orbital: 24 horas (sincronizado con la rotación terrestre)',
      'Ideal para comunicaciones y meteorología',
      'Satélite permanece fijo sobre un punto de la Tierra'
    ] as string[]
  }
} as const;

type OrbitType = keyof typeof ORBIT_RANGES;
type OrbitRange = typeof ORBIT_RANGES[OrbitType];

function isValidOrbitType(type: string): type is OrbitType {
  return type in ORBIT_RANGES;
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
  private propagatedPositions = new Map<string, Vector3>();
  private visibleSatelliteIds = new Set<string>();
  private hiddenSatelliteIds = new Set<string>();
  private satelliteDataArray: SatelliteData[] = [];
  private filteredSatellites: SatelliteData[] = [];
  private instanceIdToSatelliteDataIndex: number[] = [];
  private currentDate = new Date();

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

  private readonly ORBIT_RANGES = ORBIT_RANGES;

  constructor(private readonly earth: Earth) {}

  public addSatelliteClickListener(callback: (data: SatelliteData) => void) {
    this.onSatelliteClickCallback = callback;
  }

  public getInstancedMesh(): InstancedMesh | null {
    const meshes = Array.from(this.instancedMeshes.values());
    if (meshes.length === 0) {
      return null;
    }

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
              userData: originalData
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

    for (let i = 0; i < instanceCount; i++) {
      instancedMesh.getMatrixAt(i, matrix);
      matrix.decompose(position, quaternion, scale);

      const distance = raycaster.ray.distanceToPoint(position);

      const threshold = 0.3;

      if (distance < threshold) {
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
      if (!data.tleLine1 || !data.tleLine2) {
        console.warn(`Satélite ${id} no tiene TLE válido`, data);
        return;
      }
      this.onSatelliteClickCallback(data);
    }
  }

public addSatellite(
  id: string,
  tleLine1: string,
  tleLine2: string,
  name: string,
  orbital?: any,
  position?: Vector3
): void {
  if (this.markers.has(id) || this.loadedSatelliteIds.has(id)) return;

  // Verificar si el satélite debe ser visible según los filtros actuales
  const shouldBeVisible = !this.hiddenSatelliteIds.has(id);
  if (!shouldBeVisible) return;

  const satrec = satellite.twoline2satrec(tleLine1, tleLine2);
  const now = new Date();
  const posVel = satellite.propagate(satrec, now);
  if (!posVel?.position) {
    // console.warn(`No se pudo propagar posición para satélite ${id}`);
    return;
  }

  const scaleFactor = this.earth.getRadius() / EARTH_RADIUS_KM;
  const posScaled = position || new Vector3(
    posVel.position.x * scaleFactor,
    posVel.position.z * scaleFactor,
    posVel.position.y * scaleFactor
  );

  const { color, orbitType } = this.getOrbitTypeAndColor(posVel.position);
  if (!this.instancedMeshes.has(orbitType)) {
    this.createInstancedMesh(orbitType, color);
  }

  const instancedMesh = this.instancedMeshes.get(orbitType);
  const index = this.instanceIndexCounter.get(orbitType)!;

  this.instanceLookup.set(id, { orbitType, index });

  const dummy = new Object3D();
  dummy.position.copy(posScaled);
  dummy.updateMatrix();

  dummy.userData = {
    id,
    tleLine1,
    tleLine2,
    name,
    satrec,
    orbital,
    position: posScaled,
    altitude: Math.abs(
      Math.sqrt(
        posVel.position.x ** 2 +
        posVel.position.y ** 2 +
        posVel.position.z ** 2
      ) - EARTH_RADIUS_KM
    ),
    orbitType
  };

  instancedMesh!.setMatrixAt(index, dummy.matrix);
  instancedMesh!.instanceMatrix.needsUpdate = true;

  const altitude = dummy.userData['altitude'];

  const satData: SatelliteData = {
    tleLine1,
    tleLine2,
    name,
    satrec,
    orbital,
    position: posScaled,
    id,
    altitude
  };

  satData.orbital.orbitType = orbitType;
  this.satData.set(id, satData);
  this.satelliteDataArray[index] = satData;
  this.loadedSatelliteIds.add(id);
  this.visibleSatelliteIds.add(id);
  this.hiddenSatelliteIds.delete(id);
  this.instanceIndexCounter.set(orbitType, index + 1);
  this.markers.set(id, dummy);
}

  public async loadSatellites(showAll: boolean = true): Promise<void> {
    const satellitesData = await loadAndMergeSatelliteData();

    // Filtrar basura espacial por defecto
    this.allSatellitesData = satellitesData.filter(sat => {
      const name = sat.info?.satname?.toLowerCase() ?? '';
      return !name.includes('deb');
    });

    // Inicializar todos los satélites como visibles
    this.visibleSatelliteIds.clear();
    this.hiddenSatelliteIds.clear();
    this.allSatellitesData.forEach(sat => {
      const id = sat.norad_cat_id?.toString();
      if (id) {
        this.visibleSatelliteIds.add(id);
      }
    });

    await this.loadSatellitesFiltered(this.allSatellitesData, new Date());
  }

public async loadSatellitesFiltered(visibleSatellitesData: any[], currentDate: Date) {
  this.clearSatellitesFromScene();

  this.satData.clear();
  this.loadedSatelliteIds.clear();
  this.instanceLookup.clear();
  this.satelliteDataArray = [];
  this.propagatedPositions.clear();

  console.log(`Total satélites a filtrar: ${visibleSatellitesData.length}`);

  const groupedByOrbit: Record<string, { color: number, sats: any[] }> = {};

  let noTleCount = 0;
  let noPropagationCount = 0;

  for (const sat of visibleSatellitesData) {
    if (!sat.tle_line_1 || !sat.tle_line_2) {
      noTleCount++;
      continue;
    }

    sat.satrec = satellite.twoline2satrec(sat.tle_line_1, sat.tle_line_2);

    const propagation = satellite.propagate(sat.satrec, currentDate);
    if (!propagation || !propagation.position) {
      noPropagationCount++;
      continue;
    }

    const pos = propagation.position;
    const positionEci = new Vector3(pos.x, pos.y, pos.z);
    sat.__positionEci = positionEci;

    const { orbitType, color } = this.getOrbitTypeAndColor(positionEci);

    if (!groupedByOrbit[orbitType]) {
      groupedByOrbit[orbitType] = { color, sats: [] };
    }

    groupedByOrbit[orbitType].sats.push(sat);
  }

  for (const [orbitType, { color, sats }] of Object.entries(groupedByOrbit)) {
    this.createInstancedMesh(orbitType, color, sats.length);

    const instancedMesh = this.instancedMeshes.get(orbitType);
    if (!instancedMesh) continue;

    const matrix = new Matrix4();
    let index = 0;

    for (const sat of sats) {
      const pos = sat.__positionEci;
      const scaleFactor = this.earth.getRadius() / EARTH_RADIUS_KM;
      const posScaled = new Vector3(
        pos.x * scaleFactor,
        pos.z * scaleFactor,
        pos.y * scaleFactor
      );

      matrix.makeTranslation(posScaled.x, posScaled.y, posScaled.z);
      instancedMesh.setMatrixAt(index, matrix);

      const satData: SatelliteData = {
        tleLine1: sat.tle_line_1,
        tleLine2: sat.tle_line_2,
        name: sat.info?.satname || '',
        satrec: sat.satrec,
        orbital: sat.orbital,
        position: posScaled,
        id: sat.norad_cat_id,
        altitude: Math.sqrt(pos.x * pos.x + pos.y * pos.y + pos.z * pos.z) - EARTH_RADIUS_KM
      };

      this.satData.set(sat.norad_cat_id, satData);
      this.satelliteDataArray[index] = satData;
      this.loadedSatelliteIds.add(sat.norad_cat_id);
      this.instanceLookup.set(sat.norad_cat_id, { orbitType, index });
      this.propagatedPositions.set(sat.norad_cat_id, posScaled);

      // Guardar referencia para raycast
      if (!instancedMesh.userData) instancedMesh.userData = {};
      if (!instancedMesh.userData['ids']) instancedMesh.userData['ids'] = [];
      instancedMesh.userData['ids'][index] = sat.norad_cat_id;

      index++;
    }

    instancedMesh.count = index;
    instancedMesh.instanceMatrix.needsUpdate = true;
    this.instanceIndexCounter.set(orbitType, index);
  }

  const starlinkCount = this.allSatellitesData.filter(sat => {
    const name = sat.info?.satname?.toLowerCase() || '';
    return name.includes('starlink');
  }).length;

  const galileoCount = this.allSatellitesData.filter(sat => {
    const name = sat.info?.satname?.toLowerCase() || '';
    return name.includes('galileo');
  }).length;

  console.log(`Total de satélites: ${this.allSatellitesData.length}`);
  console.log(`Satélites renderizados: ${this.loadedSatelliteIds.size}`);
}


  clearSatellitesFromScene() {
    for (const mesh of this.instancedMeshes.values()) {
      this.earth.removeFromScene(mesh);
      mesh.geometry.dispose();

      if (Array.isArray(mesh.material)) {
        mesh.material.forEach(mat => mat.dispose());
      } else {
        mesh.material.dispose();
      }
    }
    this.instancedMeshes.clear();
    this.instanceIndexCounter.clear();
    this.instanceIdToSatelliteDataIndex = [];
  }

  public async loadSatelliteById(id: string, force = false): Promise<Object3D | undefined> {
    if (this.markers.has(id)) {
      return this.markers.get(id);
    }

    const sat = this.allSatellitesData.find(s => s.norad_cat_id?.toString() === id.toString());
    if (!sat) {
      console.warn(`No se encontró satélite con ID ${id} en datos cargados.`);
      return undefined;
    }

    if (!sat.tle_line_1 || !sat.tle_line_2) {
      console.warn(`El satélite7 ${id} no tiene datos de órbita (TLE).`);
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

    this.updateClusters();

    // Primero, ocultar todos los satélites que deben estar ocultos
    for (const [id, position] of this.propagatedPositions) {
      const meshData = this.instanceLookup.get(id);
      if (meshData) {
        const { orbitType, index } = meshData;
        const instancedMesh = this.instancedMeshes.get(orbitType);
        if (instancedMesh) {
          dummy.position.copy(position);
          // Si el satélite está oculto, establecer su escala a 0
          dummy.scale.setScalar(this.hiddenSatelliteIds.has(id) ? 0 : 1);
          dummy.updateMatrix();
          instancedMesh.setMatrixAt(index, dummy.matrix);
        }
      }
    }

    // Luego, actualizar los satélites visibles
    for (const [id, position] of this.propagatedPositions) {
      if (this.hiddenSatelliteIds.has(id)) continue;

      const distance = position.distanceTo(cameraPosition);
      const lodLevel = this.getLODLevel(distance);

      if (lodLevel < 0.5) {
        const clusterId = Array.from(this.clusters.entries())
          .find(([_, satellites]) => satellites.has(id))?.[0];

        if (clusterId) {
          const clusterPos = this.clusterPositions.get(clusterId)!;
          dummy.position.copy(clusterPos);
          dummy.scale.setScalar(lodLevel * 2);
        }
      } else {
        dummy.position.copy(position);
        dummy.scale.setScalar(lodLevel);
      }

      dummy.updateMatrix();

      const meshData = this.instanceLookup.get(id);
      if (meshData) {
        const { orbitType, index } = meshData;
        const instancedMesh = this.instancedMeshes.get(orbitType);
        if (instancedMesh) {
          instancedMesh.setMatrixAt(index, dummy.matrix);
        }
      }
    }

    // Actualizar todas las matrices de instancia
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

    // Si no hay satélites visibles definidos, considerar todos como visibles
    const shouldLoadAll = this.visibleSatelliteIds.size === 0 && this.hiddenSatelliteIds.size === 0;

    for (const sat of this.allSatellitesData) {
      if (loadedCount >= batchSize) break;

      const id = sat.norad_cat_id?.toString();
      if (!id || this.loadedSatelliteIds.has(id)) continue;

      // Verificar si el satélite debe ser visible según los filtros actuales
      const shouldBeVisible = shouldLoadAll || !this.hiddenSatelliteIds.has(id);
      if (!shouldBeVisible) continue;

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

  public renderSatellitesFromData(satellites: any[]): void {
    this.dispose();

    for (const sat of satellites) {
      this.loadSatellites(sat);
    }

    this.startUpdating();
    this.startDynamicLoading();
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

    this.instancedMeshes.forEach((mesh) => {
      this.earth.removeFromScene(mesh);
      mesh.geometry.dispose();
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach(mat => mat.dispose());
      } else {
        mesh.material.dispose();
      }
    });

    this.instancedMeshes.clear();
    this.instanceIndexCounter.clear();

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
      // Solo intentar cargar satélites si hay satélites visibles
      if (this.visibleSatelliteIds.size > 0) {
        this.tryAddVisibleSatellites();
      }
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

  public getOrbitTypeAndColor(positionEci: { x: number; y: number; z: number }): { orbitType: string; color: number; description: string; characteristics: string[] } {
    const r = Math.sqrt(positionEci.x ** 2 + positionEci.y ** 2 + positionEci.z ** 2);
    const altitude = Math.abs(r - EARTH_RADIUS_KM);

    for (const [type, range] of Object.entries(this.ORBIT_RANGES)) {
      if (altitude >= range.min && altitude <= range.max) {
        return {
          orbitType: type,
          color: range.color,
          description: range.description,
          characteristics: range.characteristics
        };
      }
    }

    return {
      orbitType: 'Desconocido',
      color: 0x888888,
      description: 'Órbita no clasificada',
      characteristics: ['Altitud fuera de los rangos conocidos']
    };
  }

  public calculateAltitude(positionEci: { x: number; y: number; z: number }): number {
    const r = Math.sqrt(positionEci.x ** 2 + positionEci.y ** 2 + positionEci.z ** 2);
    return r - EARTH_RADIUS_KM;
  }

  public simulateSatellitesAtTime(simTime: Date): void {
    const dummy = new Object3D();

    this.satelliteDataArray.forEach(sat => {
      const position = this.calculatePositionAtTime(sat, simTime);
      this.propagatedPositions.set(sat.id, position);

      const meshData = this.instanceLookup.get(sat.id);
      if (meshData) {
        const { orbitType, index } = meshData;
        const instancedMesh = this.instancedMeshes.get(orbitType);
        if (instancedMesh) {
          dummy.position.copy(position);
          dummy.updateMatrix();
          instancedMesh.setMatrixAt(index, dummy.matrix);
        }
      }
    });

    for (const mesh of this.instancedMeshes.values()) {
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  private calculatePositionAtTime(sat: SatelliteData, time: Date): Vector3 {
    const satrec = satellite.twoline2satrec(sat.tleLine1, sat.tleLine2);
    const gmst = satellite.gstime(time);

    const eci = satellite.propagate(satrec, time);
    if (!eci || !eci.position) {
      return new Vector3(0, 0, 0);
    }
    const positionEci = eci.position;

    if (!positionEci) {
      return new Vector3();
    }

    return new Vector3(
      positionEci.x * (this.earth.getRadius() / EARTH_RADIUS_KM),
      positionEci.z * (this.earth.getRadius() / EARTH_RADIUS_KM),
      positionEci.y * (this.earth.getRadius() / EARTH_RADIUS_KM)
    );
  }

  public calculateSatellitePositionEci(sat: any, date: Date = new Date()): { x: number, y: number, z: number } {
    try {
      if (!sat.tleLine1 || !sat.tleLine2) {
        throw new Error(`TLE data missing for satellite ${sat.norad_cat_id}`);
      }

      const satrec = satellite.twoline2satrec(sat.tleLine1, sat.tleLine2);
      const posVel = satellite.propagate(satrec, date);

      if (!posVel || !posVel.position) {
        throw new Error(`Failed to propagate satellite ${sat.norad_cat_id}`);
      }

      const scaleFactor = this.earth.getRadius() / EARTH_RADIUS_KM;

      return {
        x: posVel.position.x * scaleFactor,
        y: posVel.position.z * scaleFactor,
        z: posVel.position.y * scaleFactor
      };
    } catch (error) {

      return { x: 0, y: 0, z: 0 };
    }
  }

  public setFilteredSatellites(satellites: SatelliteData[]) {
    this.filteredSatellites = satellites;
  }

  public getAllInstancedMeshes(): InstancedMesh[] {
    return Array.from(this.instancedMeshes.values());
  }

  public showSatellitesByOrbitType(orbitType: string): void {
    if (!isValidOrbitType(orbitType)) {
      console.error(`Tipo de órbita no válido: ${orbitType}`);
      return;
    }

    this.clearSatellitesFromScene();

    const orbitRange = this.ORBIT_RANGES[orbitType];

    const filteredSatellites = this.allSatellitesData.filter(sat => {
      try {
        const satrec = satellite.twoline2satrec(sat.tle_line_1, sat.tle_line_2);
        const posVel = satellite.propagate(satrec, new Date());
        if (!posVel?.position) return false;

        const r = Math.sqrt(
          posVel.position.x ** 2 +
          posVel.position.y ** 2 +
          posVel.position.z ** 2
        );
        const altitude = Math.abs(r - EARTH_RADIUS_KM);
        return altitude >= orbitRange.min && altitude <= orbitRange.max;
      } catch (error) {
        console.error(`Error al calcular la altitud del satélite ${sat.norad_cat_id}:`, error);
        return false;
      }
    });

    this.loadSatellitesFiltered(filteredSatellites, this.currentDate );
  }

  public showAllSatellites(): void {

    this.clearSatellitesFromScene();

    this.loadSatellitesFiltered(this.allSatellitesData, this.currentDate );
  }

  public showSatellitesByPattern(pattern: RegExp): void {
    this.clearSatellitesFromScene();

    const filteredSatellites = this.allSatellitesData.filter(sat => {
      const name = sat.info?.satname || '';
      return pattern.test(name);
    });

    // Log específico para Galileo
    if (pattern.toString().includes('galileo')) {
      filteredSatellites.forEach(sat => {

        try {
          const satrec = satellite.twoline2satrec(sat.tle_line_1, sat.tle_line_2);

          // Calcular fecha de época
          const epochYear = satrec.epochyr;
          const epochDay = satrec.epochdays;
          const epochDate = new Date(epochYear, 0, epochDay);

          const now = new Date();

          const propagation = satellite.propagate(satrec, now);
          if (propagation && propagation.position) {

            const epochPropagation = satellite.propagate(satrec, epochDate);

          }
        } catch (error: any) {
          console.log(`- Error en procesamiento:`);
          console.log(`  * Tipo: ${error.name}`);
          console.log(`  * Mensaje: ${error.message}`);
          if (error.stack) {
            console.log(`  * Stack: ${error.stack.split('\n')[0]}`);
          }
        }
      });
    }

    this.loadSatellitesFiltered(filteredSatellites, this.currentDate);
  }

  public showSatellitesByCategory(category: string): void {
    this.clearSatellitesFromScene();

    const filteredSatellites = this.allSatellitesData.filter(sat => {
      const satCategory = sat.info?.category?.toLowerCase() || 'satellite';
      return satCategory === category.toLowerCase();
    });

    this.loadSatellitesFiltered(filteredSatellites, this.currentDate );
  }
}
