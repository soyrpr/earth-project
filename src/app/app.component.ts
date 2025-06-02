import { Component, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TimeSliderComponent } from './components/time-slider/time-slider.component';
import { SatellitesComponent } from './components/satellites/satellites.component';
import { MenuButtonsComponent } from './components/menu-buttons/menu-buttons.component';
import { GlobeComponent } from './components/globe/globe.component';
import { AreaScanComponent } from './components/area-scan/area-scan.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    TimeSliderComponent,
    SatellitesComponent,
    MenuButtonsComponent,
    GlobeComponent,
    AreaScanComponent
  ],
  template: `
    <app-menu-buttons #menuButtons></app-menu-buttons>
    <app-time-slider></app-time-slider>
    <app-satellites #satellites></app-satellites>
    <app-area-scan></app-area-scan>
    <app-globe></app-globe>
  `,
  styles: []
})
export class AppComponent implements AfterViewInit {
  @ViewChild('menuButtons') menuButtonsComponent!: MenuButtonsComponent;
  @ViewChild('satellites') satellitesComponent!: SatellitesComponent;
  title = 'earth-project';

  ngAfterViewInit() {
    if (this.menuButtonsComponent && this.satellitesComponent) {
      this.menuButtonsComponent.satellitesComponent = this.satellitesComponent;
    }
  }
}
