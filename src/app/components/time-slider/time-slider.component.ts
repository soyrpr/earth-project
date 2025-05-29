import { Component, OnInit, OnDestroy } from '@angular/core';
import { SceneManager } from '../../../core/scene.manager';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-time-slider',
  templateUrl: './time-slider.component.html',
  styleUrls: ['./time-slider.component.css'],
  imports: [FormsModule, CommonModule]
})
export class TimeSliderComponent implements OnInit, OnDestroy {
  simulationStartTime = new Date();
  simulatedTime = new Date(this.simulationStartTime.getTime());
  baseTime = new Date(this.simulationStartTime.getTime());
  minutesOffset = 0;
  isSimulating = false;
  realTimeInterval: any;
  lastUpdateTime = Date.now();

  speedAmount = 1;
  speedUnit: 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months' | 'years' = 'seconds';
  private readonly MAX_TIME_STEP = 1000;

  ngOnInit() {
    this.startRealTimeUpdates();
  }

  ngOnDestroy() {
    this.stopRealTimeUpdates();
  }

  private startRealTimeUpdates() {
    this.realTimeInterval = setInterval(() => {
      const now = Date.now();
      const deltaTime = Math.min(now - this.lastUpdateTime, this.MAX_TIME_STEP);
      this.lastUpdateTime = now;

      if (this.isSimulating) {
        this.simulatedTime = new Date(this.simulationStartTime.getTime() + this.minutesOffset * 60 * 1000);
      } else {
        const simMillis = this.getMillisecondsFromSpeed(deltaTime);
        this.baseTime = new Date(this.baseTime.getTime() + simMillis);
        this.simulatedTime = new Date(this.baseTime);
      }

      SceneManager.satelliteManager?.simulateSatellitesAtTime(this.simulatedTime);
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
    this.baseTime = new Date(this.simulatedTime);
    this.minutesOffset = 0;
    this.lastUpdateTime = Date.now();
  }

  onDateTimeChange(event: any) {
    const newTime = new Date(event.target.value);
    this.simulatedTime = newTime;
    this.baseTime = newTime;
    this.simulationStartTime = newTime;
    this.minutesOffset = 0;
    this.lastUpdateTime = Date.now();
    this.isSimulating = false;
  }

  onSpeedChange() {
    this.lastUpdateTime = Date.now();
  }

  getMillisecondsFromSpeed(deltaTime: number): number {
    const multiplier = this.speedAmount;
    const unit = this.speedUnit;

    const seconds = {
      seconds: 1,
      minutes: 60,
      hours: 3600,
      days: 86400,
      weeks: 604800,
      months: 2629800,
      years: 31557600,
    };

    const speedSeconds = multiplier * seconds[unit];
    return (speedSeconds * deltaTime) / 1000;
  }

  getDatetimeLocalValue(): string {
    const local = new Date(this.simulatedTime.getTime() - this.simulatedTime.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  }
}
