import { Mesh, Scene, Camera, SphereGeometry, Vector3, Color, MeshStandardMaterial } from "three";

export class Sun {
  private sunMesh!: Mesh;
  private readonly sunRadius = 30;

  constructor(private readonly scene: Scene, private readonly camera: Camera) {
    this.createSun();
  }

  private createSun(): void {

    const sunGeometry = new SphereGeometry(this.sunRadius, 64, 64);

    const sunMaterial = new MeshStandardMaterial({
      color: new Color('#FDB813'),
      emissive: new Color('#FDB813'),
      emissiveIntensity: 1
    });

    this.sunMesh = new Mesh(sunGeometry, sunMaterial);
    this.sunMesh.position.set(1000, 0, 0);

    this.scene.add(this.sunMesh);
  }

  public getLightDirection(): Vector3 {
    const earthPosition = new Vector3(0, 0, 0);
    return new Vector3().subVectors(earthPosition, this.sunMesh.position).normalize();
  }

  public getPosition(): Vector3 {
    return this.sunMesh.position;
  }
}
