import { Mesh, Camera, Texture, SphereGeometry, ShaderMaterial, Vector3, MeshBasicMaterial, Scene, Object3D } from "three";
import fragmentShader from "../assets/shaders/fragmentShader";
import vertexShader from "../assets/shaders/vertexShader";
import * as satellite from "satellite.js";

export class Earth {
  private earthMesh!: Mesh;
  private readonly radius = 30;
  private readonly markerGeometry: SphereGeometry;
  private readonly markerMaterial: MeshBasicMaterial;

  constructor(
    private readonly camera: Camera,
    private readonly scene: Scene  // <-- necesitas pasar el Scene aquí
  ) {
    this.markerGeometry = new SphereGeometry(0.2, 8, 8);  // reutilizables
    this.markerMaterial = new MeshBasicMaterial({ color: 0xffffff });
  }

  public createEarth(dayTexture: Texture, nightTexture: Texture): Mesh {
    const geometry = new SphereGeometry(this.radius, 32, 32);

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
    this.scene.add(this.earthMesh);  // añadir la Tierra a la escena
    return this.earthMesh;
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

    const marker = new Mesh(this.markerGeometry, this.markerMaterial);
    marker.position.set(x, y, z);

    this.scene.add(marker); // aquí añades el marcador a la escena
    return marker;
  }

  public removeMarker(marker: Mesh): void {
    this.scene.remove(marker);  // eliminar marcador de la escena
  }

  public updateMarkerFromEci(marker: Mesh, eciPos: satellite.EciVec3<number>): void {
    const scaleFactor = this.radius / 6371;
    marker.position.set(
      eciPos.x * scaleFactor,
      eciPos.y * scaleFactor,
      eciPos.z * scaleFactor
    );
  }

  public addToScene(object: Object3D): void {
    this.scene.add(object);
  }

  public removeFromScene(object: Object3D): void {
    this.scene.remove(object);
  }

  public getRadius(): number {
    return this.radius;
  }
}
