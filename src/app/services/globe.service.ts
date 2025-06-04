import { Injectable } from '@angular/core';
import { Scene, Camera, Raycaster, Object3D } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { RendererManager } from '../../core/renderer.manager';
import { SceneManager } from '../../core/scene.manager';

@Injectable({
  providedIn: 'root'
})
export class GlobeService {
  private raycaster: Raycaster;

  constructor() {
    this.raycaster = new Raycaster();
  }

  getScene(): Scene {
    return SceneManager.scene!;
  }

  getCamera(): Camera {
    return SceneManager.camera!;
  }

  getRaycaster(): Raycaster {
    return this.raycaster;
  }

  getGlobe(): Object3D {
    return SceneManager.earth!.getMesh();
  }

  getCanvas(): HTMLCanvasElement {
    return RendererManager.canvas;
  }

  disableCameraControls() {
    if (RendererManager.controls) {
      RendererManager.controls.enabled = false;
    }
  }

  enableCameraControls() {
    if (RendererManager.controls) {
      RendererManager.controls.enabled = true;
    }
  }

  getSimulationTime(): Date {
    return SceneManager.satelliteManager?.getCurrentDate() || new Date();
  }
} 