import * as satellite from "satellite.js";
import { CanvasTexture, Color, DirectionalLight, HemisphereLight, LinearFilter, Mesh, PerspectiveCamera, Scene, Sprite, SpriteMaterial, Vector2, Vector3 } from "three/src/Three.Core.js";
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

  public static init(): void {
    SceneManager.createScene();
    SceneManager.createCamera();
    SceneManager.createLights();
    SceneManager.starfield = new Starfield(SceneManager.scene);
    SceneManager.earth = new Earth(SceneManager.scene, SceneManager.camera);
    SceneManager.sun = new Sun(SceneManager.scene, SceneManager.camera);
    SceneManager.createSunLight();
    SceneManager.earth.addMovingMarker(37, -4, 0x0000ff)
    // Initialize SatelliteManager
    SceneManager.satelliteManager = new SatelliteManager(SceneManager.earth);

    // Llamada para cargar y añadir satélites
    SceneManager.loadSatellitesFromFile();
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
      SceneManager.satelliteManager.addSatellite(sat.id, sat.tle_line_1, sat.tle_line_2, satname);
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

public static createTextSprite(
  message: string,
  parameters: {
    fontface?: string;
    fontsize?: number;
    color?: { r: number; g: number; b: number; a: number }; // Color del texto
  } = {}
): Sprite {
  const fontface = parameters.fontface || 'Arial';
  const fontsize = parameters.fontsize || 11;  // Puedes cambiar el tamaño aquí
  const color = parameters.color || { r: 0, g: 0, b: 0, a: 1.0 }; // Color del texto, por defecto negro

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d')!;
  context.font = `${fontsize}px ${fontface}`;

  // Calcular tamaño del texto
  const metrics = context.measureText(message);
  const textWidth = metrics.width;

  // Ajustar tamaño del canvas solo para el texto
  canvas.width = textWidth;
  canvas.height = fontsize * 1.4;

  // Establecer color del texto
  context.fillStyle = `rgba(${color.r},${color.g},${color.b},${color.a})`;
  context.fillText(message, 0, fontsize);  // Dibujar solo el texto, sin fondo ni borde

  const texture = new CanvasTexture(canvas);
  texture.minFilter = LinearFilter;
  const spriteMaterial = new SpriteMaterial({ map: texture, transparent: true });
  const sprite = new Sprite(spriteMaterial);

  // Ajustar el tamaño del sprite según sea necesario
  sprite.scale.set(2, 1, 1);  // Ajusta el tamaño según lo que necesites

  console.log(`Texto del sprite: ${message}`);

  return sprite;
}

  public static update(): void {
    SceneManager.earth?.update();
  }
}
