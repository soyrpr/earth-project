import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SatellitesComponent } from './satellites.component';

describe('SatellitesComponent', () => {
  let component: SatellitesComponent;
  let fixture: ComponentFixture<SatellitesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SatellitesComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SatellitesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
