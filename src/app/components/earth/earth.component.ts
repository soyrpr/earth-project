import { Component, OnInit } from '@angular/core';
import { TextureLoader } from 'three';
import { SceneManager } from '../../../core/scene.manager';
import { Earth } from '../../../core/earth';

@Component({
  selector: 'app-earth',
  templateUrl: './earth.component.html',
  styleUrls: ['./earth.component.css']
})
export class EarthComponent {
  ngAfterViewInit(): void {
    if (!SceneManager.scene || !SceneManager.camera) {
      console.error('SceneManager no está listo aún');
      return;
    }

    const earth = SceneManager.earth!;
    const loader = new TextureLoader();

    Promise.all([
      loader.loadAsync('assets/textures/earthmap1k.jpg'),
      loader.loadAsync('assets/textures/earthlights1k.jpg')
    ]).then(([dayTex, nightTex]) => {
      SceneManager.scene.add(earth.createEarth(dayTex, nightTex));
    });
  }
}
