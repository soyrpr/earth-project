import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { GlobeComponent } from "./components/globe/globe.component";

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, GlobeComponent ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'earth-project';
}
