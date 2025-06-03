import { Component, ViewChild } from '@angular/core';
import { SatellitesComponent } from '../satellites/satellites.component';
import { TimeSliderComponent } from '../time-slider/time-slider.component';
import { TimeSliderService } from '../../services/time-slider.service';
import { SatelliteSearchService } from '../../services/satellite-search.service';
import { AreaScanService } from '../../services/area-scan.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-menu-buttons',
  templateUrl: './menu-buttons.component.html',
  styleUrls: ['./menu-buttons.component.css'],
  standalone: true,
  imports: [ CommonModule ],
})
export class MenuButtonsComponent {
  @ViewChild(SatellitesComponent) satellitesComponent!: SatellitesComponent;
  isTimeActive = false;
  isSearchActive = false;
  isAreaScanActive = false;

  constructor(
    private timeSliderService: TimeSliderService,
    private satelliteSearchService: SatelliteSearchService,
    private areaScanService: AreaScanService
  ) {}

  toggleTime() {
    this.isTimeActive = !this.isTimeActive;
    this.timeSliderService.toggleControls();
  }

  toggleSearch() {
    this.isSearchActive = !this.isSearchActive;
    this.satelliteSearchService.toggleVisibility();
  }

  toggleAreaScan() {
    this.isAreaScanActive = !this.isAreaScanActive;
    this.areaScanService.toggleVisibility();
  }
}
