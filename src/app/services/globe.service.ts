import { Injectable } from '@angular/core';
import { Scene, Camera, Raycaster, Object3D } from 'three';

@Injectable({
  providedIn: 'root'
})
export class GlobeService {
  private scene: Scene;
  private camera: Camera;
  private raycaster: Raycaster;
  private globe: Object3D;
  private canvas: HTMLCanvasElement;

  constructor() {
    this.scene = new Scene();
    this.camera = new Camera();
    this.raycaster = new Raycaster();
    this.globe = new Object3D();
    this.canvas = document.createElement('canvas');
  }

  getScene(): Scene {
    return this.scene;
  }

  getCamera(): Camera {
    return this.camera;
  }

  getRaycaster(): Raycaster {
    return this.raycaster;
  }

  getGlobe(): Object3D {
    return this.globe;
  }

  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  setScene(scene: Scene) {
    this.scene = scene;
  }

  setCamera(camera: Camera) {
    this.camera = camera;
  }

  setGlobe(globe: Object3D) {
    this.globe = globe;
  }

  setCanvas(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }
} 