import { Component, AfterViewInit } from "@angular/core";
import { CommonModule } from '@angular/common';
import { RendererManager } from "../../../core/renderer.manager";
import { SceneManager } from "../../../core/scene.manager";

@Component({
  selector: 'app-globe',
  standalone: true,
  imports: [
    CommonModule
  ],
  template: `
    <canvas id="globeCanvas"></canvas>
  `,
  styles: [`
    canvas {
      width: 100%;
      height: 100%;
      position: absolute;
      top: 0;
      left: 0;
    }
  `]
})
export class GlobeComponent implements AfterViewInit {
  sceneManagerReady = false;

  ngOnInit() {
    SceneManager.init();
    this.sceneManagerReady = true;
  }

  ngAfterViewInit() {
    RendererManager.start();
    // Importar el visualizador de la Tierra
    import('../../earth-viewer/transition').then(() => {
      console.log('Earth viewer initialized');
    });
  }
}
