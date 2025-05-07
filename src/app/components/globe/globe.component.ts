import { Component } from '@angular/core';
import { RendererManager } from '../../../core/renderer.manager';

@Component({
  selector: 'app-globe',
  imports: [],
  templateUrl: './globe.component.html',
  styleUrl: './globe.component.css'
})
export class GlobeComponent {

  ngAfterViewInit() {
    RendererManager.start();
  }
}
