import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SatelliteSearchService {
  private searchVisibleSubject = new BehaviorSubject<boolean>(false);
  searchVisible$ = this.searchVisibleSubject.asObservable();

  toggleVisibility(): void {
    console.log('Toggling search visibility. Current value:', this.searchVisibleSubject.value);
    this.searchVisibleSubject.next(!this.searchVisibleSubject.value);
    console.log('New value:', this.searchVisibleSubject.value);
  }

  show(): void {
    console.log('Showing search');
    this.searchVisibleSubject.next(true);
  }

  hide(): void {
    console.log('Hiding search');
    this.searchVisibleSubject.next(false);
  }

  isVisible(): boolean {
    return this.searchVisibleSubject.value;
  }

}
