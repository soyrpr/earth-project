import * as satellite from "satellite.js";
import { Earth } from "./earth";
import { Mesh, Sprite, Vector3 } from "three";
import { SceneManager } from "./scene.manager";

export class SatelliteManager {
  private markers: Map<string, Mesh> = new Map();
  private updateInterval: any; // Intervalo único para todas las actualizaciones

  constructor(private readonly earth: Earth) {}

public addSatellite(id: string, tleLine1: string, tleLine2: string, name: string): void {
  // Check if the satellite already exists
  if (this.markers.has(id)) {
    console.log(`El satélite con ID ${id} ya ha sido agregado.`);
    return; // If the satellite already exists, skip adding it
  }

  const satrec = satellite.twoline2satrec(tleLine1, tleLine2);

  // Obtener la posición inicial
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

  // Crear el marcador del satélite
  const marker = this.earth.addMovingMarker(lat, lon, 0x00ffff);
  this.markers.set(id, marker); // Store the marker with the satellite ID

  // Crear y añadir el sprite de texto
  const nameSprite = SceneManager.createTextSprite(name);
  console.log(`Texto del sprite: ${name}`); // Verifica el nombre del sprite
  nameSprite.position.set(0, 5, 0);
  nameSprite.renderOrder = 1; // Asegura que el sprite se renderice encima de otros objetos
  marker.add(nameSprite);

  // Guardar las líneas TLE en el marcador como datos personalizados
  marker.userData = { tleLine1, tleLine2 };

  // Actualización de posición cada 1 segundo (solo se establece una vez)
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
