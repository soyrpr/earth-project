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


  public addMarkerFromEci(eciPos: satellite.EciVec3<number>): Mesh {
    const scaleFactor = this.radius / 6371; // convierte km a unidades de escena
    const x = eciPos.x * scaleFactor;
    const y = eciPos.y * scaleFactor;
    const z = eciPos.z * scaleFactor;

    const geometry = new SphereGeometry(0.2, 4, 4);
    const material = new MeshBasicMaterial({ color: 0xffffff });
    const marker = new Mesh(geometry, material);
    marker.position.set(x, y, z);

    this.scene.add(marker);
    return marker;
  }

  public updateMarkerFromEci(marker: Mesh, eciPos: satellite.EciVec3<number>): void {
    const scaleFactor = this.radius / 6371;
    marker.position.set(
      eciPos.x * scaleFactor,
      eciPos.y * scaleFactor,
      eciPos.z * scaleFactor
    );
  }

  public showSatellites(tleData: string[], intervalTime: number = 1000): void {
    tleData.forEach(tle => {
      const satrec = satellite.twoline2satrec(tle[1], tle[2]);
      const now = new Date();
      const positionAndVelocity = satellite.propagate(satrec, now);

      if (positionAndVelocity && positionAndVelocity.position) {
        const positionEci = positionAndVelocity.position;

        // Crear marcador directamente desde ECI
        const marker = this.addMarkerFromEci(positionEci);

        // Actualización periódica de la posición en ECI
        setInterval(() => {
          const updatedTime = new Date();
          const updatedPos = satellite.propagate(satrec, updatedTime);

          if (updatedPos && updatedPos.position) {
            this.updateMarkerFromEci(marker, updatedPos.position);
          }
        }, intervalTime);
      }
    });
  }

  getRadius() {
    return this.radius;
  }

  public update(): void {
    // this.earthMesh.rotation.y += 0.0001;
  }
}
