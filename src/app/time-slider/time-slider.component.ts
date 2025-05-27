import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SceneManager } from '../../core/scene.manager';

@Component({
  selector: 'app-time-slider',
  templateUrl: './time-slider.component.html',
  styleUrls: ['./time-slider.component.css'],
  imports: [CommonModule, FormsModule]
})

export class TimeSliderComponent {
  simulationStartTime = new Date();
  minutesOffset = 0;
  simulatedTime = new Date(this.simulationStartTime.getTime());
  isSimulating = false;
  realTimeInterval: any;
  timeSpeed = 1;
  lastUpdateTime = Date.now();
  private readonly MAX_TIME_STEP = 1000;
  private baseTime = new Date();

  ngOnInit() {
    this.startRealTimeUpdates();
  }

  ngOnDestroy() {
    this.stopRealTimeUpdates();
  }

  private startRealTimeUpdates() {
    this.realTimeInterval = setInterval(() => {
      if (SceneManager.satelliteManager) {
        const now = Date.now();
        const deltaTime = Math.min(now - this.lastUpdateTime, this.MAX_TIME_STEP);
        this.lastUpdateTime = now;

        if (this.isSimulating) {
          this.simulatedTime = new Date(this.simulationStartTime.getTime() + this.minutesOffset * 60 * 1000);
        } else {
          const timeToAdd = deltaTime * this.timeSpeed;
          this.baseTime = new Date(this.baseTime.getTime() + timeToAdd);
          this.simulatedTime = this.baseTime;
        }

        SceneManager.satelliteManager.simulateSatellitesAtTime(this.simulatedTime);
      }
    }, 100);
  }

  private stopRealTimeUpdates() {
    if (this.realTimeInterval) {
      clearInterval(this.realTimeInterval);
    }
  }

  onTimeChange() {
    this.isSimulating = true;
    this.simulatedTime = new Date(this.simulationStartTime.getTime() + this.minutesOffset * 60 * 1000);
  }

  onSliderRelease() {
    this.isSimulating = false;
    this.baseTime = this.simulatedTime;
    this.minutesOffset = 0;
    this.lastUpdateTime = Date.now();
  }

  setTimeSpeed(speed: number) {
    this.timeSpeed = speed;
    this.lastUpdateTime = Date.now();
  }
}
