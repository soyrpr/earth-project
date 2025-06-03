import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SearchService {
  private isSearchVisibleSubject = new BehaviorSubject<boolean>(false);
  isSearchVisible$ = this.isSearchVisibleSubject.asObservable();

  toggleSearch() {
    this.isSearchVisibleSubject.next(!this.isSearchVisibleSubject.value);
  }

  setControlsVisibility(state: boolean) {
    this.isSearchVisibleSubject.next(state);
  }
}
