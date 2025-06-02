import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SatelliteSearchService {
  private searchVisibleSubject = new BehaviorSubject<boolean>(false);
  searchVisible$ = this.searchVisibleSubject.asObservable();

  toggleVisibility(): void {
    this.searchVisibleSubject.next(!this.searchVisibleSubject.value);
  }

  show(): void {
    this.searchVisibleSubject.next(true);
  }

  hide(): void {
    this.searchVisibleSubject.next(false);
  }

  isVisible(): boolean {
    return this.searchVisibleSubject.value;
  }

}
