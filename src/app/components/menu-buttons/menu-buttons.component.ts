import { Component, ViewChild } from '@angular/core';
import { SatellitesComponent } from '../satellites/satellites.component';
import { TimeSliderComponent } from '../time-slider/time-slider.component';
import { TimeSliderService } from '../../services/time-slider.service';

@Component({
  selector: 'app-menu-buttons',
  templateUrl: './menu-buttons.component.html',
  styleUrls: ['./menu-buttons.component.css'],
  standalone: true,
  imports: [],
})
export class MenuButtonsComponent {
  @ViewChild(SatellitesComponent) satellitesComponent!: SatellitesComponent;
  isTimeActive = false;
  isSearchActive = false;

  constructor(private timeSliderService: TimeSliderService) {}

  toggleTime() {
    this.isTimeActive = !this.isTimeActive;
      this.timeSliderService.toggleControls();
  }

  toggleSearch() {
    this.isSearchActive = !this.isSearchActive;
    const searchSlider = document.querySelector('app-satellites');
    if (searchSlider) {
      const button = searchSlider.querySelector('button');
      if (button) {
        button.click();
      }
    }
  }
}
