import { Color, DirectionalLight, HemisphereLight, Mesh, MeshStandardMaterial, PerspectiveCamera, Scene, SphereGeometry, TextureLoader } from "three/src/Three.Core.js";
import { Starfield } from "./starfield";
import { Earth } from "./earth";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";


export class SceneManager {
  public static scene: Scene;
  public static camera: PerspectiveCamera;
  private static starfield: Starfield;
  private static earth : Earth;
  private static controls: OrbitControls

  public static init(): void {
    SceneManager.createScene();
    SceneManager.createCamera();
    SceneManager.createLights();
    SceneManager.starfield = new Starfield(SceneManager.scene);
    SceneManager.earth = new Earth(SceneManager.scene, SceneManager.camera);
  
  }

  private static createScene(): void {
    SceneManager.scene = new Scene();
    SceneManager.scene.background = new Color(0x000000);
  }

  private static createCamera():void {
    SceneManager.camera = new PerspectiveCamera(34, window.innerWidth / window.innerHeight, 1, 2000);
    SceneManager.camera.position.set(10, 5, 10);
    SceneManager.camera.lookAt(0, 0, 0);
    SceneManager.scene.add(SceneManager.camera);
  }

  private static createLights(): void {
    const hemilight = new HemisphereLight(0xffffff, 0x000000, 0.3);
    SceneManager.scene.add(hemilight);

    const sun = new DirectionalLight(0xffffff, 1);
    sun.position.set(10, 10, 10);
    sun.castShadow = true;

    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 50;

  
    SceneManager.scene.add(sun);
  }

  public static update(): void {
    this.earth?.update();    
  }
}
