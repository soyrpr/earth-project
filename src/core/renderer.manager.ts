import { PCFSoftShadowMap, WebGLRenderer } from "three";
import { SceneManager } from "./scene.manager";
import { EffectComposer, OrbitControls } from "three/examples/jsm/Addons.js";


export class RendererManager {

  private static renderer: WebGLRenderer;
  public static canvas: HTMLCanvasElement;
  private static composer: EffectComposer;

  private constructor() {
    SceneManager.init();
    RendererManager.init();
  }

  private static init(): void {
    RendererManager.getCanvas();
    RendererManager.createRenderer();
    RendererManager.renderLoop();
  }

  private static getCanvas(): void {
    RendererManager.canvas = document.getElementById('globeCanvas') as HTMLCanvasElement;
    if (!RendererManager.canvas) console.error("Canvas no encontrado");
  }

  private static createRenderer(): void {

    RendererManager.getCanvas();
    RendererManager.renderer = new WebGLRenderer({ antialias: true, canvas: RendererManager.canvas });
    RendererManager.renderer.setPixelRatio(window.devicePixelRatio);
    RendererManager.renderer.setSize(window.innerWidth, window.innerHeight);
    RendererManager.renderer.toneMapping = 2;
    RendererManager.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFSoftShadowMap;

    const controls = new OrbitControls(SceneManager.camera, RendererManager.renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;
    controls.enableZoom = true;
    controls.minDistance= 60;
    controls.maxDistance = 700;
  }

  private static renderLoop(): void {
    SceneManager.update();
    requestAnimationFrame(RendererManager.renderLoop);

    if (RendererManager.composer) {
      RendererManager.composer.render();
    } else {
      RendererManager.renderer.render(SceneManager.scene, SceneManager.camera);
    }
  }


  public static start(): void {
    SceneManager.init();
    RendererManager.init();
  }

  public static getRenderer(): WebGLRenderer {
    return RendererManager.renderer;
  }
}
