import * as satellite from 'satellite.js';
import { Mesh, SphereGeometry, MeshBasicMaterial, Scene, Camera, Vector3, ShaderMaterial, TextureLoader, MathUtils, Spherical } from 'three';
import fragmentShader from '../assets/shaders/fragmentShader';
import vertexShader from '../assets/shaders/vertexShader';

export class Earth {
  private earthMesh!: Mesh;
  private readonly radius = 30;

  constructor(public readonly scene: Scene, private readonly camera: Camera) {
    this.createEarth();
  }

  private createEarth(): void {
    const loader = new TextureLoader();
    const dayTexture = loader.load('assets/textures/earthmap1k.jpg');
    const nightTexture = loader.load('assets/textures/earthlights1k.jpg');

    const geometry = new SphereGeometry(this.radius, 64, 64);

    const shaderMaterial = new ShaderMaterial({
      uniforms: {
        dayTexture: { value: dayTexture },
        nightTexture: { value: nightTexture },
        lightDirection: { value: new Vector3(1, 0, 1).normalize() },
      },
      vertexShader,
      fragmentShader,
    });

    this.earthMesh = new Mesh(geometry, shaderMaterial);
    this.scene.add(this.earthMesh);
  }

  public calcPosFromLatLonRad(lat: number, lon: number, radius: number): [number, number, number] {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);

    const x = -(radius * Math.sin(phi) * Math.cos(theta));
    const z = radius * Math.sin(phi) * Math.sin(theta);
    const y = radius * Math.cos(phi);

    return [x, y, z];
  }


  // Método para agregar un marcador que se moverá con el satélite
  public addMovingMarker(lat: number, lon: number, color: number): Mesh {
    const [x, y, z] = this.calcPosFromLatLonRad(lat, lon, this.radius + 3); // Marcador alejado de la superficie de la Tierra

    const geometry = new SphereGeometry(0.2, 1, 1); // Tamaño del satélite
    const material = new MeshBasicMaterial({ color });

    const marker = new Mesh(geometry, material);
    marker.position.set(x, y, z);
    this.scene.add(marker);

    console.log(`Adding marker at lat: ${lat}, lon: ${lon}`);

    return marker;
  }

  // Método para actualizar la posición de los satélites
  public updateSatelliteMarker(marker: Mesh, lat: number, lon: number): void {
    const [x, y, z] = this.calcPosFromLatLonRad(lat, lon, this.radius + 3); // Actualizamos la posición
    marker.position.set(x, y, z);
  }

  // Mostrar satélites desde los TLEs
  public showSatellites(tleData: string[], intervalTime: number = 1000): void {
    tleData.forEach(tle => {
      const satrec = satellite.twoline2satrec(tle[1], tle[2]);
      const positionAndVelocity = satellite.propagate(satrec, new Date());

      if (positionAndVelocity && positionAndVelocity.position) {
        const positionEci = positionAndVelocity.position;
        const gmst = satellite.gstime(new Date());
        const positionGd = satellite.eciToGeodetic(positionEci, gmst);

        const lat = positionGd.latitude * (180 / Math.PI);
        const lon = positionGd.longitude * (180 / Math.PI);

        // Crear marcador para el satélite
        const marker = this.addMovingMarker(lat, lon, 0x00ffff);

        // Actualización periódica de la posición del satélite
        setInterval(() => {
          const updatedPos = satellite.propagate(satrec, new Date());
          if (updatedPos && updatedPos.position) {
            const updatedEci = updatedPos.position;
            const updatedGmst = satellite.gstime(new Date());
            const updatedPositionGd = satellite.eciToGeodetic(updatedEci, updatedGmst);

            const updatedLat = updatedPositionGd.latitude * (180 / Math.PI);
            const updatedLon = updatedPositionGd.longitude * (180 / Math.PI);

            // Actualizar la posición del marcador
            this.updateSatelliteMarker(marker, updatedLat, updatedLon);
          }
        }, intervalTime);
      }
    });
  }

    getRadius() {
    return this.radius;
  }

  public update(): void {
    // Si deseas rotar la Tierra, por ejemplo:
    // this.earthMesh.rotation.y += 0.0001;
  }
}
