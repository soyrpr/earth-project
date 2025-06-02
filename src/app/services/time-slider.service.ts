import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
 })

export class TimeSliderService {
  private showControlsSubject = new BehaviorSubject<boolean>(false);
  showControls$ = this.showControlsSubject.asObservable();

  toggleControls() {
    this.showControlsSubject.next(!this.showControlsSubject.value);
  }

  setControlsVisibility(state: boolean) {
    this.showControlsSubject.next(state);
  }
}
