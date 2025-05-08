import {
  Camera,
  Mesh,
  Scene,
  SphereGeometry,
  TextureLoader,
  Vector3,
  ShaderMaterial,
  MeshBasicMaterial
} from "three";

export class Earth {
  private earthMesh!: Mesh;
  private readonly radius = 30;

  constructor(private readonly scene: Scene, private readonly camera: Camera) {
    this.createEarth();
  }

  private createEarth(): void {
    const loader = new TextureLoader();
    const radius = 30;

    const dayTexture = loader.load('assets/textures/earthmap1k.jpg');
    const nightTexture = loader.load('assets/textures/earthlights1k.jpg');

    const geometry = new SphereGeometry(radius, 64, 64);

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

  private calcPosFromLatLonRad(lat: number, lon: number, radius:number): [number, number, number]{
    const phi   = (90-lat)*(Math.PI/180);
    const theta = (lon+180)*(Math.PI/180);

    const x = -(radius * Math.sin(phi)*Math.cos(theta));
    const z = (radius * Math.sin(phi)*Math.sin(theta));
    const y = (radius * Math.cos(phi));

    return [x, y, z];
  }

  public addMarker(lat: number, lon: number, color: number = 0xff0000): void {
    const position = this.calcPosFromLatLonRad(lat, lon, this.radius + 3);

    const markerGeometry = new SphereGeometry(0.5, 16, 16);
    const markerMaterial = new MeshBasicMaterial({ color });
    const marker = new Mesh(markerGeometry, markerMaterial);
    marker.position.set(...position);

    this.earthMesh.add(marker);
  }
}
