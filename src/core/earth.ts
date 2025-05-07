import {
  Camera,
  Mesh,
  Scene,
  SphereGeometry,
  TextureLoader,
  Vector3,
  ShaderMaterial
} from "three";

export class Earth {
  private earthMesh!: Mesh;

  constructor(private readonly scene: Scene, private readonly camera: Camera) {
    this.createEarth();
  }

  private createEarth(): void {
    const loader = new TextureLoader();

    const dayTexture = loader.load('assets/textures/earthmap1k.jpg');
    const nightTexture = loader.load('assets/textures/earthlights1k.jpg');

    const geometry = new SphereGeometry(3, 64, 64);

    const shaderMaterial = new ShaderMaterial({
      uniforms: {
        dayTexture: { value: dayTexture },
        nightTexture: { value: nightTexture },
        lightDirection: { value: new Vector3(1, 0, 1).normalize() }
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vPosition;

        void main() {
          vUv = uv;
          vNormal = normalize(normalMatrix * normal);
          vPosition = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D dayTexture;
        uniform sampler2D nightTexture;
        uniform vec3 lightDirection;

        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vPosition;

        void main() {
          float dotProduct = dot(normalize(vNormal), normalize(lightDirection));
          float mixAmount = clamp(dotProduct * 2.0, 0.0, 1.0);

          vec4 dayColor = texture2D(dayTexture, vUv);
          vec4 nightColor = texture2D(nightTexture, vUv);

          gl_FragColor = mix(nightColor, dayColor, mixAmount);
        }
      `,
    });

    this.earthMesh = new Mesh(geometry, shaderMaterial);
    this.scene.add(this.earthMesh);
  }

  public update(): void {
    this.earthMesh.rotation.y += 0.001;
  }
}
