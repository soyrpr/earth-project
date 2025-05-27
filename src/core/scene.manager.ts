import {
  Scene, PerspectiveCamera,  Raycaster, Vector2,
  Object3D, Line, MeshBasicMaterial, Color,  Vector3, WebGLRenderer,
  Frustum,
  Matrix4,
  AmbientLight,
  DirectionalLight,
  BufferGeometry,
  LineBasicMaterial
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

  private static readonly raycaster = new Raycaster();
  private static readonly pointer = new Vector2();

  private static selectedSatellite: Object3D | null = null;
  private static selectedOrbitLine: Line | null = null;
  private static selectedConnectionLine: Line | null = null;

  private static initialized = false;

  private static frustum = new Frustum();
  private static cameraViewProjectionMatrix = new Matrix4();

  static modelsByName: Map<string, Object3D> = new Map();

  private static selectedSatellitePosition: Vector3 | null = null;

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
    await this.satelliteManager.loadSatellites(false);

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

    const instancedMesh = this.satelliteManager?.getInstancedMesh();
    if (!instancedMesh) {
      console.log('No hay mesh instanciado disponible');
      this.hideSatelliteInfo();
      return;
    }

    // Configuración del raycaster
    this.raycaster.near = 0.1;
    this.raycaster.far = 1000;

    const intersects = this.raycaster.intersectObject(instancedMesh);

    if (intersects.length > 0) {
      const instanceId = intersects[0].instanceId;
      if (instanceId !== undefined) {
        const satData = this.satelliteManager!.getSatelliteDataByInstancedId(instanceId);
        if (!satData) {
          console.log('No se encontraron datos para el satélite con instanceId:', instanceId);
          this.hideSatelliteInfo();
          return;
        }

        const matrix = new Matrix4();
        instancedMesh.getMatrixAt(instanceId, matrix);

        const position = new Vector3();
        position.setFromMatrixPosition(matrix);

        this.selectedSatellitePosition = position;
        this.showSatelliteInfoFromData(satData, instanceId);

        console.log('Datos del satélite encontrado:', satData);
        return;
      }
    }

    this.hideSatelliteInfo();
  }

  public static showSatelliteInfoFromData(satData: any, instanceId: number): void {
    if (!satData) return;

    const position = satData.position;
    const lat = Math.atan2(position.z, Math.sqrt(position.x * position.x + position.y * position.y));
    const lon = Math.atan2(position.y, position.x);

    const { orbitType } = this.satelliteManager!.getOrbitTypeAndColor(satData.position);
    const altitude = satData.altitude;

    // Función auxiliar para formatear números
    const formatNumber = (value: any, decimals: number = 2): string => {
      if (typeof value === 'number') {
        return value.toFixed(decimals);
      }
      return 'N/A';
    };

    const info: Record<string, string> = {
      'Nombre': satData.name,
      'ID': satData.id,
      'Tipo de Órbita': orbitType,
      'Altitud': `${formatNumber(altitude)} km`,
      'Latitud': this.formatCoordinate(lat * (180 / Math.PI), 'N', 'S'),
      'Longitud': this.formatCoordinate(lon * (180 / Math.PI), 'E', 'W'),
    };
    if (satData.orbital?.velocity != null) {
      info['Velocidad Orbital'] = `${formatNumber(satData.orbital.velocity)} km/s`;
    }
    if (satData.orbital?.period != null) {
      info['Período'] = `${formatNumber(satData.orbital.period)} min`;
    }
    if (satData.orbital?.inclination != null) {
      info['Inclinación'] = `${formatNumber(satData.orbital.inclination)}°`;
    }
    if (satData.orbital?.apogee != null) {
      info['Apogeo'] = `${formatNumber(satData.orbital.apogee)} km`;
    }
    if (satData.orbital?.perigee != null) {
      info['Perigeo'] = `${formatNumber(satData.orbital.perigee)} km`;
    }

    const infoHtml = Object.entries(info)
      .map(([key, value]) => `<div><strong>${key}:</strong> ${value}</div>`)
      .join('');

    const infoElement = document.getElementById('satellite-info') ||
                       document.getElementById('satellite-info-box') ||
                       document.getElementById('info-panel');

    if (infoElement) {
      infoElement.innerHTML = infoHtml;
      infoElement.style.display = 'block';
    } else {
      console.error('No se encontró el elemento para mostrar la información del satélite');

      const newInfoElement = document.createElement('div');
      newInfoElement.id = 'satellite-info';
      newInfoElement.style.position = 'absolute';
      newInfoElement.style.top = '20px';
      newInfoElement.style.right = '20px';
      newInfoElement.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
      newInfoElement.style.color = 'white';
      newInfoElement.style.padding = '15px';
      newInfoElement.style.borderRadius = '5px';
      newInfoElement.style.fontFamily = 'Arial, sans-serif';
      newInfoElement.style.zIndex = '1000';
      newInfoElement.innerHTML = infoHtml;
      document.body.appendChild(newInfoElement);
    }

    if (this.selectedOrbitLine) {
      this.selectedOrbitLine.geometry.dispose();
      (this.selectedOrbitLine.material as MeshBasicMaterial).dispose();
      this.scene.remove(this.selectedOrbitLine);
      this.selectedOrbitLine = null;
    }

    if (this.selectedConnectionLine) {
      this.selectedConnectionLine.geometry.dispose();
      (this.selectedConnectionLine.material as MeshBasicMaterial).dispose();
      this.scene.remove(this.selectedConnectionLine);
      this.selectedConnectionLine = null;
    }

    const points = [
      new Vector3(0, 0, 0),
      position.clone()
    ];
    const geometry = new BufferGeometry().setFromPoints(points);
    const material = new LineBasicMaterial({
      color: 0xff0000,
      linewidth: 4,
      transparent: true,
      opacity: 0.5
    });
    this.selectedConnectionLine = new Line(geometry, material);
    this.scene.add(this.selectedConnectionLine);

    const tleLine1 = satData.tleLine1 || satData.tle_line_1;
    const tleLine2 = satData.tleLine2 || satData.tle_line_2;
    const satId = satData.id || satData.norad_cat_id;

    if (tleLine1 && tleLine2 && satId) {
      const orbitLine = this.satelliteManager!.drawOrbit(
        satId,
        tleLine1,
        tleLine2
      );

      if (orbitLine) {
        this.selectedOrbitLine = orbitLine;
        this.scene.add(orbitLine);
      }
    }
  }

  private static hideSatelliteInfo(): void {
    const infoElement = document.getElementById('satellite-info') ||
                       document.getElementById('satellite-info-box') ||
                       document.getElementById('info-panel');

    if (infoElement) {
      infoElement.style.display = 'none';
    }

    // Limpiar líneas cuando se oculta la información
    if (this.selectedOrbitLine) {
      this.selectedOrbitLine.geometry.dispose();
      (this.selectedOrbitLine.material as MeshBasicMaterial).dispose();
      this.scene.remove(this.selectedOrbitLine);
      this.selectedOrbitLine = null;
    }

    if (this.selectedConnectionLine) {
      this.selectedConnectionLine.geometry.dispose();
      (this.selectedConnectionLine.material as MeshBasicMaterial).dispose();
      this.scene.remove(this.selectedConnectionLine);
      this.selectedConnectionLine = null;
    }
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
    if (this.selectedSatellite) {
      this.selectedSatellitePosition = this.selectedSatellite.position.clone();
    }

    if (this.selectedConnectionLine && this.selectedConnectionLine.geometry && this.selectedSatellitePosition) {
      const positionAttributes = this.selectedConnectionLine.geometry.attributes['position'];
      positionAttributes.setXYZ(1,
        this.selectedSatellitePosition.x,
        this.selectedSatellitePosition.y,
        this.selectedSatellitePosition.z
      );
      positionAttributes.needsUpdate = true;
      this.selectedConnectionLine.geometry.computeBoundingSphere();
    }
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

    let satObj = this.satelliteManager.getSatelliteMeshes().find((m: Object3D) => m.userData['id'] === id);

    if (!satObj) {
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

  private static formatCoordinate(value: number, posDir: string, negDir: string): string {
    const absValue = Math.abs(value);
    const degrees = Math.floor(absValue);
    const minutes = (absValue - degrees) * 60;
    const direction = value >= 0 ? posDir : negDir;
    return `${degrees}° ${minutes.toFixed(2)}' ${direction}`;
  }

}
