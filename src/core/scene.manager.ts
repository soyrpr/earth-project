import {
  Scene, PerspectiveCamera, Mesh, Raycaster, Vector2,
  Object3D, Line, MeshBasicMaterial, Color, HemisphereLight, Vector3, WebGLRenderer,
  Frustum,
  Matrix4,
  Camera
} from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { Earth } from "./earth";
import { SatelliteManager } from "./satellite";
import { Starfield } from "./starfield";
import { RenderPass, UnrealBloomPass } from "three/examples/jsm/Addons.js";

export class SceneManager {
  private static _scene: Scene | null = null;
  private static _camera: PerspectiveCamera | null = null;
  private static starfield: Starfield | null = null;
  public static earth: Earth | null = null;
  public static satelliteManager: SatelliteManager | null = null;
  public static composer: EffectComposer | null = null;

  private static raycaster = new Raycaster();
  private static pointer = new Vector2();

  private static selectedSatellite: Object3D | null = null;
  private static selectedOrbitLine: Line | null = null;

  private static initialized = false;

  private static frustum = new Frustum();
  private static cameraViewProjectionMatrix = new Matrix4();

  public static get scene(): Scene {
    if (!this._scene) throw new Error("SceneManager.scene no está inicializado");
    return this._scene;
  }

  public static get camera(): PerspectiveCamera {
    if (!this._camera) throw new Error("SceneManager.camera no está inicializado");
    return this._camera;
  }

public static async init(): Promise<void> {
  if (this.initialized) {
    console.warn("SceneManager ya fue inicializado, ignorando llamada.");
    return;
  }
  this.initialized = true;

  console.log("SceneManager.init() llamado");
  this.createScene();
  this.createCamera();
  this.createLights();

  this.starfield = new Starfield(this.scene);
  this.earth = new Earth(this.camera, this.scene);
  this.satelliteManager = new SatelliteManager(this.earth);

  await this.satelliteManager.loadSatellites(true);

  window.addEventListener('click', this.onDocumentClick.bind(this));
}


  private static onDocumentClick(event: MouseEvent): void {
    this.pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;

    this.raycaster.setFromCamera(this.pointer, this.camera);
    const intersects = this.raycaster.intersectObjects(this.scene.children, true);

    for (const intersect of intersects) {
      let current: Object3D | null = intersect.object;

      while (current) {
        if (current.userData?.['tleLine1'] && current.userData?.['tleLine2']) {
          this.showSatelliteInfo(current);
          return;
        }
        current = current.parent;
      }
    }

    this.hideSatelliteInfo();
  }

  private static showSatelliteInfo(object: Object3D): void {
    const box = document.getElementById("satellite-info-box");
    const nameEl = document.getElementById("satellite-name");
    const tle1El = document.getElementById("tle-line1");
    const tle2El = document.getElementById("tle-line2");

    if (!box || !nameEl || !tle1El || !tle2El) return;

    nameEl.textContent = object.userData['name'] || object.name || "Satélite desconocido";
    tle1El.textContent = object.userData['tleLine1'] || "No disponible";
    tle2El.textContent = object.userData['tleLine2'] || "No disponible";

    box.style.display = "block";

  if (this.selectedSatellite && this.selectedSatellite !== object) {
    const prev = this.selectedSatellite as Mesh;
    if (prev.material) {
      // Restaurar color original (cian)
      (prev.material as MeshBasicMaterial).color.set(0x00ffff);
    }
    if (this.selectedOrbitLine) {
      this.scene.remove(this.selectedOrbitLine);
      this.selectedOrbitLine = null;
    }
  }

  this.selectedSatellite = object;

  if ((object as Mesh).material) {
    // Clonar el material para que no se comparta entre satélites
    const mesh = object as Mesh;
    mesh.material = (mesh.material as MeshBasicMaterial).clone();
    (mesh.material as MeshBasicMaterial).color.set(0xff0000);
  }

    const orbitLine = this.satelliteManager!.drawOrbit(
      object.userData['id'],
      object.userData['tleLine1'],
      object.userData['tleLine2']
    );

    if (orbitLine) {
      this.selectedOrbitLine = orbitLine;
      this.scene.add(orbitLine);
    } else {
      this.selectedOrbitLine = null;
    }
  }

  private static hideSatelliteInfo(): void {
    const box = document.getElementById("satellite-info-box");
    if (box) box.style.display = "none";
  }

  private static createScene(): void {
    this._scene = new Scene();
    this._scene.background = new Color(0x000000);
  }

  private static createCamera(): void {
    this._camera = new PerspectiveCamera(34, window.innerWidth / window.innerHeight, 1, 2000);
    this._camera.position.set(200, 5, 10);
    this._camera.lookAt(0, 0, 0);
    this.scene.add(this._camera);
  }

  private static createLights(): void {
    const hemiLight = new HemisphereLight(0xffffff, 0x000000, 0.2);
    this.scene.add(hemiLight);
  }

  public static initPostProcessing(renderer: WebGLRenderer): void {
    const renderScene = new RenderPass(this.scene, this.camera);
    const bloomPass = new UnrealBloomPass(
      new Vector2(window.innerWidth, window.innerHeight),
      1.5,
      0.4,
      0.85
    );
    bloomPass.threshold = 0;
    bloomPass.strength = 2;
    bloomPass.radius = 0;

    this.composer = new EffectComposer(renderer);
    this.composer.setSize(window.innerWidth, window.innerHeight);
    this.composer.addPass(renderScene);
    this.composer.addPass(bloomPass);
  }

  public static update(): void {
    this.satelliteManager?.updateSatellites();
  }

  public static isPOV(position: Vector3, camera: PerspectiveCamera): boolean {
    this.cameraViewProjectionMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.cameraViewProjectionMatrix);
    return this.frustum.containsPoint(position);
  }
}
