import { Camera, Color, Mesh, MeshStandardMaterial, Scene, SphereGeometry, TextureLoader } from "three";

export class Earth {
  private earthMesh!: Mesh;

  constructor(private readonly scene: Scene, private readonly camera: Camera) {
    this.createEarth();
  }

  private createEarth(): void {
    const textureLoader = new TextureLoader();
    const earthGeometry = new SphereGeometry(3, 64, 64);
  
    earthGeometry.setAttribute('uv2', earthGeometry.attributes['uv']);
  
    const dayTexture = textureLoader.load('assets/textures/earthmap1k.jpg');
    const nightTexture = textureLoader.load('assets/textures/earthlights1k.jpg');
  
    const earthMaterial = new MeshStandardMaterial({
      map: dayTexture,
      lightMap: nightTexture,
      lightMapIntensity: 1.5
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
