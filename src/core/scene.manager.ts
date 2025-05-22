import {
  Scene, PerspectiveCamera, Mesh, Raycaster, Vector2,
  Object3D, Line, MeshBasicMaterial, Color, HemisphereLight, Vector3, WebGLRenderer,
  Frustum,
  Matrix4,
  Camera,
  AmbientLight,
  DirectionalLight
} from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { Earth } from "./earth";
import { SatelliteManager } from "./satellite";
import { Starfield } from "./starfield";
import { GLTFLoader, RenderPass, UnrealBloomPass } from "three/examples/jsm/Addons.js";
import { RendererManager } from './renderer.manager'; // Ajusta la ruta según tu estructura

export class SceneManager {
  private static _scene: Scene | null = null;
  private static _camera: PerspectiveCamera | null = null;
  private static starfield: Starfield | null = null;
  public static earth: Earth | null = null;
  public static satelliteManager: SatelliteManager | null = null;
  public static composer: EffectComposer | null = null;
  public static starlinkModel: Object3D | null = null;

  private static raycaster = new Raycaster();
  private static pointer = new Vector2();

  private static selectedSatellite: Object3D | null = null;
  private static selectedOrbitLine: Line | null = null;

  private static initialized = false;

  private static frustum = new Frustum();
  private static cameraViewProjectionMatrix = new Matrix4();

  static modelsByName: Map<string, Object3D> = new Map();

  public static get scene(): Scene {
    if (!this._scene) throw new Error("SceneManager.scene no está inicializado");
    return this._scene;
  }

  public static get camera(): PerspectiveCamera {
    if (!this._camera) throw new Error("SceneManager.camera no está inicializado");
    return this._camera;
  }

  public static async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    this.createScene();
    this.createCamera();
    this.createLights();

    this.starfield = new Starfield(this.scene);
    this.earth = new Earth(this.camera, this.scene);
    this.satelliteManager = new SatelliteManager(this.earth);

    // await this.loadStarlinkModel();
    await this.satelliteManager.loadSatellites(true);

    window.addEventListener('click', this.onDocumentClick.bind(this));
    window.addEventListener('resize', this.onWindowResize.bind(this));
  }

  private static onWindowResize(): void {
    if (!this._camera || !this.composer) return;
    this._camera.aspect = window.innerWidth / window.innerHeight;
    this._camera.updateProjectionMatrix();
    this.composer.setSize(window.innerWidth, window.innerHeight);
  }

private static onDocumentClick(event: MouseEvent): void {
  this.pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  this.pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;

  this.raycaster.setFromCamera(this.pointer, this.camera);

  const satelliteMeshes = this.satelliteManager?.getSatelliteMeshes() || [];
  const intersects = this.raycaster.intersectObjects(satelliteMeshes, true);

  for (const intersect of intersects) {
    let current: Object3D | null = intersect.object;
    while (current) {
      console.log('Objeto bajo cursor:', current.name, current.userData);
      if (current.userData && current.userData['name']) {
        console.log('¡Satélite detectado:', current.userData['name']);
        this.showSatelliteInfo(current);
        return;
      }
      current = current.parent;
    }
  }

  // console.log('No se encontró satélite bajo el clic');
  this.hideSatelliteInfo();
}


  public static showSatelliteInfo(object: Object3D): void {
    const box = document.getElementById("satellite-info-box");
    if (box) box.style.display = "block";

    if (this.selectedSatellite && this.selectedSatellite !== object) {
      const prev = this.selectedSatellite as Mesh;
      if (prev.material) {
        (prev.material as MeshBasicMaterial).color.set(0x00ffff);
      }
      if (this.selectedOrbitLine) {
        this.selectedOrbitLine.geometry.dispose();
        (this.selectedOrbitLine.material as MeshBasicMaterial).dispose();
        this.scene.remove(this.selectedOrbitLine);
        this.selectedOrbitLine = null;
      }
    }

    this.selectedSatellite = object;

    if ((object as Mesh).material) {
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
    this.scene.add(new AmbientLight(0xffffff, 0.4));
    const directionalLight = new DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(50, 50, 50);
    this.scene.add(directionalLight);
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

  public static render(): void {
    this.composer?.render();
  }

  static focusCameraOn(targetPosition: Vector3): void {
    if (!this.camera) return;

    // Define un offset para la cámara (por ejemplo, 50 unidades en Z)
    const cameraOffset = new Vector3(0, 0, 50);

    // Nueva posición de la cámara = posición objetivo + offset
    const newCameraPos = targetPosition.clone().add(cameraOffset);

    // Mueve la cámara a esa nueva posición
    this.camera.position.copy(newCameraPos);

    // Actualiza el target de los controles OrbitControls para que mire a targetPosition
    if (RendererManager.controls) {
      RendererManager.controls.target.copy(targetPosition);
      RendererManager.controls.update();
    }
  }

  public static async focusCameraOnSatelliteById(id: string): Promise<void> {
    if (!this.satelliteManager) return;

    let satObj = this.satelliteManager.getSatelliteMeshes().find(m => m.userData['id'] === id);

    if (!satObj) {
      // No está cargado: intenta cargarlo
      satObj = await this.satelliteManager.loadSatelliteById(id);
    }

    if (satObj) {
      this.focusCameraOn(satObj.position);
    } else {
      console.warn(`No se pudo enfocar cámara en satélite con ID ${id}`);
    }
  }


  public static isPOV(position: Vector3, camera: PerspectiveCamera): boolean {
    this.cameraViewProjectionMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.cameraViewProjectionMatrix);
    return this.frustum.containsPoint(position);
  }

  public static async loadStarlinkModel(): Promise<void> {
    const loader = new GLTFLoader();
    return new Promise((resolve, reject) => {
      loader.load(
        "assets/models/starlink_spacex_satellite.glb",
        (gltf) => {
          this.starlinkModel = gltf.scene;
          this.starlinkModel.scale.set(0.2, 0.2, 0.2);
          this.starlinkModel.position.set(0, 0, 0);
          console.log("Modelo Starlink cargado");
          resolve();
        },
        undefined,
        (error) => {
          console.error("Error cargando modelo Starlink:", error);
          reject(error);
        }
      );
    });
  }
}
