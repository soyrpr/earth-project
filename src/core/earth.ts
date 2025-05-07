import { Camera, Color, Mesh, MeshStandardMaterial, Scene, SphereGeometry, TextureLoader } from "three";

export class Earth {
  private earthMesh!: Mesh;

  constructor(private readonly scene: Scene, private readonly camera: Camera) {
    this.createEarth();
  }

  private createEarth(): void {
    const textureLoader = new TextureLoader();
    const earthGeometry = new SphereGeometry(3, 64, 64);
    const earthTexture = textureLoader.load('assets/textures/earthmap1k.jpg');
    const bumpMap = textureLoader.load('assets/textures/earthbump1k.jpg'); // o normal map

    const earthMaterial = new MeshStandardMaterial({
      map: earthTexture,
      bumpMap: bumpMap,
      bumpScale: 0.05,
    });

    this.earthMesh = new Mesh(earthGeometry, earthMaterial);
    this.earthMesh.castShadow = true;
    this.earthMesh.receiveShadow = true;
    this.scene.add(this.earthMesh);
  }

  public update(): void {
    this.earthMesh.rotation.y += 0.001;
  }
}
