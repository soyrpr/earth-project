import { Mesh, Camera, Texture, SphereGeometry, ShaderMaterial, Vector3, MeshBasicMaterial, Scene, Object3D, PerspectiveCamera } from "three";
import fragmentShader from "../assets/shaders/fragmentShader";
import vertexShader from "../assets/shaders/vertexShader";
import * as satellite from "satellite.js";

export class Earth {
  private earthMesh!: Mesh;
  private readonly radius = 30;
  private readonly markerGeometry: SphereGeometry;
  private readonly markerMaterial: MeshBasicMaterial;

  constructor(
    private readonly camera: PerspectiveCamera,
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

  removeMarker(marker: Object3D) {
    this.scene.remove(marker);
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

  public addMalagaMarker(earth: Earth) {
  const lat = 36.7213028;
  const lon = -4.4216366;
  const altitudeKm = 0.5; // 500 metros sobre la superficie terrestre

  // Radio de la Tierra + altitud
  const radius = earth.getRadius() + altitudeKm;

  // Obtener coordenadas cartesianas
  const [x, y, z] = earth.calcPosFromLatLonRad(lat, lon, radius);

  // Crear geometría y material para el marcador
  const markerGeometry = new SphereGeometry(0.3, 16, 16);
  const markerMaterial = new MeshBasicMaterial({ color: 0xff0000 }); // rojo para que destaque

  // Crear y posicionar marcador
  const marker = new Mesh(markerGeometry, markerMaterial);
  marker.position.set(x, y, z);

  // Añadir el marcador a la escena
  earth.addToScene(marker);

  // Opcional: retornar el marcador para manipularlo si quieres
  return marker;
}

  getCamera(): PerspectiveCamera {
    return this.camera;
  }
}
