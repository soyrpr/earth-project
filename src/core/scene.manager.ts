import { Color, DirectionalLight, HemisphereLight, PerspectiveCamera, Scene, Vector2, Vector3 } from "three/src/Three.Core.js";
import { Starfield } from "./starfield";
import { Earth } from "./earth";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EffectComposer, RenderPass, UnrealBloomPass } from "three/examples/jsm/Addons.js";
import { WebGLRenderer } from "three";
import { Sun } from "./sun";

export class SceneManager {
  public static scene: Scene;
  public static camera: PerspectiveCamera;
  private static starfield: Starfield;
  private static earth : Earth;
  private static composer: EffectComposer;
  private static sun: Sun;
  private static sunLight: DirectionalLight;

  public static init(): void {
    SceneManager.createScene();
    SceneManager.createCamera();
    SceneManager.createLights();
    SceneManager.starfield = new Starfield(SceneManager.scene);
    SceneManager.earth = new Earth(SceneManager.scene, SceneManager.camera);
    SceneManager.sun = new Sun(SceneManager.scene, SceneManager.camera);
    SceneManager.createSunLight();
  }


  private static createScene(): void {
    SceneManager.scene = new Scene();
    SceneManager.scene.background = new Color(0x000000);
  }

  private static createCamera():void {
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
