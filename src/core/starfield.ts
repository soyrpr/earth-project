import { BufferGeometry, Float32BufferAttribute, Points, PointsMaterial, Scene } from "three";


export class Starfield {
  private declare starfield: Points;

  constructor(
    private readonly scene: Scene,
    private readonly starQty: number= 20000,
    private readonly range: number = 1000
  ) {
    this.createStarfield();
}

  private createStarfield() {
    const positions = new Float32Array(this.starQty * 3);

    for(let i = 0; i< this.starQty; i++) {
      positions[i * 3] = (Math.random() - 0.5) * this.range;
      positions[i * 3 + 1] = (Math.random() - 0.5) * this.range;
      positions[i * 3 + 2] = (Math.random() - 0.5) * this.range;
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));

    const material = new PointsMaterial({
      color: 0xCCCCCC,
      size: 1,
      transparent: true,
      opacity: 0.7,
      depthTest: true
    })

    this.starfield = new Points(geometry, material);
    this.scene.add(this.starfield);
  }
}
