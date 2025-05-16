import { Component, OnInit } from '@angular/core';
import { Starfield } from '../../../core/starfield';
import { SceneManager } from '../../../core/scene.manager';

@Component({
  selector: 'app-starfield',
  imports: [],
  templateUrl: './starfield.component.html',
  styleUrl: './starfield.component.css'
})
export class StarfieldComponent implements OnInit {
  ngOnInit(): void {
    new Starfield(SceneManager.scene);
  }
}
