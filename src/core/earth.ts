import { Camera,  Mesh,  Scene,  SphereGeometry,  TextureLoader,  Vector3,  ShaderMaterial,  MeshBasicMaterial} from "three";

import vertexShader from '../assets/shaders/vertexShader';
import fragmentShader from '../assets/shaders/fragmentShader';
import * as satellite from 'satellite.js';

export class Earth {
  private earthMesh!: Mesh;
  private readonly radius = 30;

  constructor(private readonly scene: Scene, private readonly camera: Camera) {
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
        lightDirection: { value: new Vector3(1, 0, 1).normalize() }
      },
      vertexShader,
      fragmentShader,
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

  public setLightDirection(dir: Vector3): void {
    const material = this.earthMesh.material as ShaderMaterial;
    material.uniforms['lightDirection'].value = dir.clone().normalize();
  }


  public addMovingMarker(lat: number, lon: number, color: number = 0x00ffff): Mesh {
    const position = this.calcPosFromLatLonRad(lat, lon, this.radius +3);

    const markerGeometry = new SphereGeometry(0.5, 16, 16);
    const markerMaterial = new MeshBasicMaterial({ color });
    const marker = new Mesh(markerGeometry, markerMaterial);
    marker.position.set(...position);

    this.earthMesh.add(marker);
    return marker;
  }

}

const satellites = [
  {
    id: "51575",
    tle_line_1: "1 62877U 25023B   25033.45084872 -.00000130  00000-0  00000+0 0  9997",
    tle_line_2: "2 62877  21.9804 304.0630 7211676 175.5316  64.1386  2.29593579    09",
    space_object: 2
  }
];
