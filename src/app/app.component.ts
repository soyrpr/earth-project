import { Component } from '@angular/core';
import { GlobeComponent } from "./components/globe/globe.component";
import { SatellitesComponent } from './components/satellites/satellites.component';

@Component({
  selector: 'app-root',
  imports: [ GlobeComponent, SatellitesComponent, ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'earth-project';

}
