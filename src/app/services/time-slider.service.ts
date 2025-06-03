import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
 })

export class TimeSliderService {
  private showControlsSubject = new BehaviorSubject<boolean>(false);
  showControls$ = this.showControlsSubject.asObservable();

  private currentTimeSubject = new BehaviorSubject<Date>(new Date());
  currentTime$ = this.currentTimeSubject.asObservable();

  toggleControls() {
    this.showControlsSubject.next(!this.showControlsSubject.value);
  }

  setControlsVisibility(state: boolean) {
    this.showControlsSubject.next(state);
  }

  setSimulatedTime(date: Date) {
    this.currentTimeSubject.next(date);
  }

  getSimulatedTime(): Date {
    return this.currentTimeSubject.getValue();
  }

}
