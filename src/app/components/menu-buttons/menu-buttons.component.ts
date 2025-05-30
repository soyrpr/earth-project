import { Component, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SatellitesComponent } from '../satellites/satellites.component';

@Component({
  selector: 'app-menu-buttons',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="menu-buttons">
      <button class="menu-button" [class.active]="isTimeActive" (click)="toggleTime()">
        <i class="material-icons">schedule</i>
      </button>
      <button class="menu-button" [class.active]="isSearchActive" (click)="toggleSearch()">
        <i class="material-icons">search</i>
      </button>
    </div>
  `,
  styles: [`
    .menu-buttons {
      position: fixed;
      top: 20px;
      left: 20px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      z-index: 1000;
    }

    .menu-button {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      border: none;
      background: #333446;
      color: #EAEFEF;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.3s ease;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
    }

    .menu-button:hover {
      background: #7F8CAA;
      transform: scale(1.1);
    }

    .menu-button.active {
      background: #B8CFCE;
      color: #333446;
    }

    .menu-button i {
      font-size: 1.2em;
    }
  `]
})
export class MenuButtonsComponent {
  @ViewChild(SatellitesComponent) satellitesComponent!: SatellitesComponent;
  isTimeActive = false;
  isSearchActive = false;

  toggleTime() {
    this.isTimeActive = !this.isTimeActive;
    const timeSlider = document.querySelector('app-time-slider');
    if (timeSlider) {
      const button = timeSlider.querySelector('button');
      if (button) {
        button.click();
      }
    }
  }

  toggleSearch() {
    this.isSearchActive = !this.isSearchActive;
    if (this.satellitesComponent) {
      this.satellitesComponent.toggleSearchVisibility();
    }
  }
} 