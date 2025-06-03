import { PCFSoftShadowMap, WebGLRenderer } from "three";
import { SceneManager } from "./scene.manager";
import { EffectComposer, OrbitControls } from "three/examples/jsm/Addons.js";

export class RendererManager {
  private static renderer: WebGLRenderer;
  public static canvas: HTMLCanvasElement;
  private static composer: EffectComposer;
  public static controls: OrbitControls;

  private constructor() {
    RendererManager.init();
  }

  private static init(): void {
    RendererManager.getCanvas();
    RendererManager.createRenderer();
    RendererManager.handleResize();
    RendererManager.renderLoop();
  }

  private static getCanvas(): void {
    const canvas = document.getElementById('globeCanvas') as HTMLCanvasElement;
    if (!canvas) {
      throw new Error('Canvas element not found');
    }
    RendererManager.canvas = canvas;
  }

  private static createRenderer(): void {
    RendererManager.getCanvas();
    RendererManager.renderer = new WebGLRenderer({ antialias: true, canvas: RendererManager.canvas });
    RendererManager.renderer.setPixelRatio(window.devicePixelRatio);
    RendererManager.renderer.setSize(window.innerWidth, window.innerHeight);
    RendererManager.renderer.toneMapping = 2;
    RendererManager.renderer.shadowMap.enabled = true;
    RendererManager.renderer.shadowMap.type = PCFSoftShadowMap;

    if (!RendererManager.controls) {
      RendererManager.controls = new OrbitControls(SceneManager.camera!, RendererManager.renderer.domElement);
      RendererManager.controls.enableDamping = true;
      RendererManager.controls.dampingFactor = 0.25;
      RendererManager.controls.enableZoom = true;
      RendererManager.controls.minDistance = 35;
      RendererManager.controls.maxDistance = 700;
    }
  }

  private static renderLoop(): void {
    SceneManager.update();
    requestAnimationFrame(RendererManager.renderLoop);

    if (RendererManager.composer) {
      RendererManager.composer.render();
    } else {
      RendererManager.renderer.render(SceneManager.scene!, SceneManager.camera!);
    }
  }

  public static start(): void {
    SceneManager.init();
    RendererManager.init();
  }

  public static handleResize(): void {
    window.addEventListener('resize', () => {
      const width = window.innerWidth;
      const height = window.innerHeight;

      SceneManager.camera!.aspect = width / height;
      SceneManager.camera!.updateProjectionMatrix();

      RendererManager.renderer.setSize(width, height);
    });
  }

  public static forceRender(): void {
    if (RendererManager.composer) {
      RendererManager.composer.render();
    } else {
      RendererManager.renderer.render(SceneManager.scene!, SceneManager.camera!);
    }
  }
}
