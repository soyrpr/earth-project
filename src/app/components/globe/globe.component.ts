import { Component } from "@angular/core";
import { CommonModule } from '@angular/common';  // <-- importa CommonModule
import { RendererManager } from "../../../core/renderer.manager";
import { SceneManager } from "../../../core/scene.manager";
import { EarthComponent } from "../earth/earth.component";
import { StarfieldComponent } from "../starfield/starfield.component";
import { SatellitesComponent } from "../satellites/satellites.component";

@Component({
  selector: 'app-globe',
  templateUrl: './globe.component.html',
  styleUrls: ['./globe.component.css'],
  standalone: true,  // Si usas standalone, asegúrate de ponerlo
  imports: [
    CommonModule,        // <-- importa CommonModule para usar *ngIf, *ngFor, etc.
    EarthComponent,
    StarfieldComponent,
  ]
})
export class GlobeComponent {
  sceneManagerReady = false;

  ngOnInit() {
    SceneManager.init();
    this.sceneManagerReady = true;
  }

  ngAfterViewInit() {
    RendererManager.start();
  }
}
