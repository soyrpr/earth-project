import * as satellite from "satellite.js";
import { CanvasTexture, Color, DirectionalLight, HemisphereLight, LinearFilter, Mesh, Object3D, PerspectiveCamera, Raycaster, Scene, Sprite, SpriteMaterial, Vector2, Vector3 } from "three/src/Three.Core.js";
import { Earth } from "./earth";
import { RenderPass, UnrealBloomPass, EffectComposer } from "three/examples/jsm/Addons.js";
import { Starfield } from "./starfield";
import { Sun } from "./sun";
import { loadAndMergeSatelliteData } from "../assets/data/data-loader";
import { SatelliteManager } from "./satellite";
import { WebGLRenderer } from "three";

export class SceneManager {
  public static scene: Scene;
  public static camera: PerspectiveCamera;
  private static starfield: Starfield;
  private static earth: Earth;
  private static sun: Sun;
  private static sunLight: DirectionalLight;
  public static satelliteMarkers: Map<string, Mesh> = new Map();
  private static satelliteIntervals: Map<string, NodeJS.Timeout> = new Map(); // Para almacenar los intervalos
  public static composer: EffectComposer;
  private static satelliteManager: SatelliteManager; // SatelliteManager instance
  private static raycaster = new Raycaster();
  private static pointer = new Vector2();

  public static init(): void {
    SceneManager.createScene();
    SceneManager.createCamera();
    SceneManager.createLights();

    SceneManager.starfield = new Starfield(SceneManager.scene);
    SceneManager.earth = new Earth(SceneManager.scene, SceneManager.camera);
    SceneManager.sun = new Sun(SceneManager.scene, SceneManager.camera);
    SceneManager.createSunLight();
    SceneManager.earth.addMovingMarker(37, -4, 0x0000ff)

    SceneManager.satelliteManager = new SatelliteManager(SceneManager.earth);
    SceneManager.loadSatellitesFromFile();

    window.addEventListener('click', SceneManager.onDocumentClick);
  }

  private static onDocumentClick(event: MouseEvent) {
    SceneManager.pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    SceneManager.pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;

    SceneManager.raycaster.setFromCamera(SceneManager.pointer, SceneManager.camera);

    const intersects = SceneManager.raycaster.intersectObjects(SceneManager.scene.children, true);

    for (const intersect of intersects) {
      const object = intersect.object;

      // Comprueba si el objeto pertenece a un dron
      let current = object;
      while (current.parent) {
        if (current.userData['tleLine1'] && current.userData['tleLine2']) {
          SceneManager.showDroneInfo(current);
          return;
        }
        current = current.parent;
      }
    }
    SceneManager.hideDroneInfo();
  }

private static showDroneInfo(object: Object3D) {
  const box = document.getElementById("drone-info-box")!;
  const nameEl = document.getElementById("drone-name")!;
  const tle1El = document.getElementById("tle-line1")!;
  const tle2El = document.getElementById("tle-line2")!;

  nameEl.textContent = object.userData["name"] || object.name || "Satélite desconocido";
  tle1El.textContent = object.userData["tleLine1"] || "No disponible";
  tle2El.textContent = object.userData['tleLine2'] || "No disponible";

  box.style.display = "block";
}

private static hideDroneInfo() {
  const box = document.getElementById("drone-info-box")!;
  box.style.display = "none";
}


  private static async loadSatellitesFromFile(): Promise<void> {
    const satellitesData = await loadAndMergeSatelliteData();
    console.log('Datos de satélites cargados:', satellitesData);

    const starlinkSatellites = satellitesData.filter(
      (sat) => sat.info?.satname?.toLowerCase().includes('starlink')
    );

    console.log(`Total de satélites Starlink encontrados: ${starlinkSatellites.length}`);

    starlinkSatellites.forEach((sat) => {
      const satname = sat.info?.satname || 'Unknown';
      SceneManager.satelliteManager.addSatellite(sat.norad_cat_id, sat.tle_line_1, sat.tle_line_2, satname);
    });
  }

  private static createScene(): void {
    SceneManager.scene = new Scene();
    SceneManager.scene.background = new Color(0x000000);
  }

  private static createCamera(): void {
    SceneManager.camera = new PerspectiveCamera(34, window.innerWidth / window.innerHeight, 1, 2000);
    SceneManager.camera.position.set(200, 5, 10);
    SceneManager.camera.lookAt(0, 0, 0);
    SceneManager.scene.add(SceneManager.camera);
  }

  private static createLights(): void {
    const hemilight = new HemisphereLight(0xffffff, 0x000000, 0.2);
    SceneManager.scene.add(hemilight);
  }

  private static createSunLight(): void {
    const sunPosition = SceneManager.sun.getPosition();
    const eartPosition = new Vector3(0, 0, 0);
    const lightDirection = SceneManager.sun.getLightDirection();

    SceneManager.sunLight = new DirectionalLight(0xffffff, 1.2);
    SceneManager.sunLight.position.copy(sunPosition);
    SceneManager.sunLight.target.position.copy(eartPosition);

    SceneManager.scene.add(SceneManager.sunLight);
    SceneManager.scene.add(SceneManager.sunLight.target);
  }

  public static initPostProcessing(renderer: WebGLRenderer): void {
    const renderScene = new RenderPass(SceneManager.scene, SceneManager.camera);
    const bloomPass = new UnrealBloomPass(
      new Vector2(window.innerWidth, window.innerHeight),
      1.5,
      0.4,
      0.85
    );
    bloomPass.threshold = 0;
    bloomPass.strength = 2;
    bloomPass.radius = 0;

    SceneManager.composer = new EffectComposer(renderer);
    SceneManager.composer.setSize(window.innerWidth, window.innerHeight);
    SceneManager.composer.addPass(renderScene);
    SceneManager.composer.addPass(bloomPass);
  }

  public static update(): void {
    SceneManager.earth?.update();
  }
}
