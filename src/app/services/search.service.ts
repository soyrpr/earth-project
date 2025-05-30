import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SearchService {
  private isSearchVisible = new BehaviorSubject<boolean>(false);
  isSearchVisible$ = this.isSearchVisible.asObservable();

  toggleSearch() {
    this.isSearchVisible.next(!this.isSearchVisible.value);
  }
} 