import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SceneManager } from '../../../core/scene.manager';
import { TimeSliderService } from '../../services/time-slider.service';

@Component({
  selector: 'app-time-slider',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './time-slider.component.html',
  styleUrls: ['./time-slider.component.css']
})
export class TimeSliderComponent {
  simulationStartTime = new Date();
  simulatedTime = new Date(this.simulationStartTime.getTime());
  isSimulating = true;

  speedUnit: 'seconds' | 'minutes' | 'hours' | 'days' = 'seconds';
  speedAmount = 1;

  timeDirection = 1;
  lastUpdateTime = Date.now();
  showControls = false;

  private readonly MAX_TIME_STEP = 1000;
  private baseTime = new Date();
  private realTimeInterval: any;

  constructor(private timeSliderService :TimeSliderService) {}

  ngOnInit() {
    this.normalizeSpeedUnit();
    this.startRealTimeUpdates();
    this.timeSliderService.showControls$.subscribe(value => {
      this.showControls = value;
    });
  }

  ngOnDestroy() {
    this.stopRealTimeUpdates();
  }

  toggleControls() {
    this.showControls = !this.showControls;
  }

  toggleSimulation() {
    this.isSimulating = !this.isSimulating;
    this.lastUpdateTime = Date.now();
  }

  toggleDirection() {
    this.timeDirection *= -1;
  }

  private startRealTimeUpdates() {
    this.realTimeInterval = setInterval(() => {
      if (!SceneManager.satelliteManager) return;

      const now = Date.now();
      const deltaTime = Math.min(now - this.lastUpdateTime, this.MAX_TIME_STEP);
      this.lastUpdateTime = now;

      if (this.isSimulating) {
        const msPerUnit = this.convertToMilliseconds(1, this.speedUnit);
        const deltaSim = deltaTime * (this.speedAmount * msPerUnit / 1000) * this.timeDirection;
        this.baseTime = new Date(this.baseTime.getTime() + deltaSim);
        this.simulatedTime = this.baseTime;
        SceneManager.satelliteManager.simulateSatellitesAtTime(this.simulatedTime);
      }
    }, 100);
  }

  private stopRealTimeUpdates() {
    if (this.realTimeInterval) {
      clearInterval(this.realTimeInterval);
    }
  }

  onDateTimeChange(event: Event) {
    const target = event.target as HTMLInputElement;
    if (target.value) {
      this.baseTime = new Date(target.value);
      this.simulatedTime = new Date(this.baseTime);
    }
  }

  getDatetimeLocalValue(): string {
    return this.simulatedTime.toISOString().slice(0, 16);
  }

  onSpeedChange() {
    this.normalizeSpeedUnit();
    this.lastUpdateTime = Date.now();
  }

  private normalizeSpeedUnit() {
    const units: ('seconds' | 'minutes' | 'hours' | 'days')[] = ['seconds', 'minutes', 'hours', 'days'];
    const maxValues = { seconds: 59, minutes: 59, hours: 23, days: 7 };

    let index = units.indexOf(this.speedUnit);
    let amount = this.speedAmount;

    while (amount > maxValues[units[index]] && index < units.length - 1) {
      amount = amount / (units[index] === 'hours' ? 24 : 60);
      index++;
    }

    while (amount < 1 && index > 0) {
      index--;
      amount = amount * (units[index] === 'hours' ? 24 : 60);
    }

    amount = Math.min(amount, maxValues[units[index]]);

    this.speedUnit = units[index];
    this.speedAmount = Math.round(amount);
  }

  convertToMilliseconds(amount: number, unit: 'seconds' | 'minutes' | 'hours' | 'days'): number {
    switch (unit) {
      case 'seconds': return amount * 1000;
      case 'minutes': return amount * 60 * 1000;
      case 'hours': return amount * 60 * 60 * 1000;
      case 'days': return amount * 24 * 60 * 60 * 1000;
      default: return amount * 1000;
    }
  }

  private readonly timeUnitLabels: Record<'seconds' | 'minutes' | 'hours' | 'days', [string, string]> = {
    seconds: ['segundo', 'segundos'],
    minutes: ['minuto', 'minutos'],
    hours: ['hora', 'horas'],
    days: ['día', 'días']
  };

  getFormattedSpeed(): string {
    const [singular, plural] = this.timeUnitLabels[this.speedUnit];
    const label = this.speedAmount === 1 ? singular : plural;
    return `${this.speedAmount} ${label}`;
  }

  getMaxForUnit(unit: 'seconds' | 'minutes' | 'hours' | 'days'): number {
  switch (unit) {
    case 'seconds': return 59;
    case 'minutes': return 59;
    case 'hours': return 23;
    case 'days': return 7;
    default: return 59;
  }
}

}
