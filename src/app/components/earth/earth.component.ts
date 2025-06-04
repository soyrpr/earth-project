import { Component, OnInit, OnDestroy } from '@angular/core';
import { TextureLoader, PerspectiveCamera, Vector3 } from 'three';
import { SceneManager } from '../../../core/scene.manager';
import { Earth } from '../../../core/earth';
import { RendererManager } from '../../../core/renderer.manager';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

@Component({
  selector: 'app-earth',
  templateUrl: './earth.component.html',
  styleUrls: ['./earth.component.css']
})
export class EarthComponent implements OnDestroy {
  private dayTexture1k: any;
  private nightTexture1k: any;
  private dayTexture10k: any;
  private animationFrameId: number | null = null;
  private readonly DISTANCE_THRESHOLD = 100; // Distancia a la que cambiar a textura 10k
  private lastZoomDistance: number = 0;
  private isManualZoom: boolean = false;

  ngAfterViewInit(): void {
    if (!SceneManager.scene || !SceneManager.camera) {
      console.error('SceneManager no está listo aún');
      return;
    }

    const earth = SceneManager.earth!;
    const loader = new TextureLoader();

    // Cargar todas las texturas
    Promise.all([
      loader.loadAsync('assets/textures/earthmap1k.jpg'),
      loader.loadAsync('assets/textures/earthlights1k.jpg'),
      loader.loadAsync('assets/textures/earthmap10k.jpg')
    ]).then(([dayTex1k, nightTex1k, dayTex10k]) => {
      this.dayTexture1k = dayTex1k;
      this.nightTexture1k = nightTex1k;
      this.dayTexture10k = dayTex10k;

      // Inicializar con texturas de 1k
      SceneManager.scene.add(earth.createEarth(this.dayTexture1k, this.nightTexture1k));
      
      // Configurar el listener para el zoom manual
      this.setupZoomListener();
      
      // Iniciar el loop de actualización
      this.startTextureUpdateLoop();
    });
  }

  private setupZoomListener(): void {
    const controls = RendererManager.controls;
    if (!controls) return;

    // Guardar la distancia inicial
    this.lastZoomDistance = controls.getDistance();

    // Escuchar cambios en el zoom
    controls.addEventListener('change', () => {
      const currentDistance = controls.getDistance();
      // Si la distancia cambió y no es por una animación programática
      if (Math.abs(currentDistance - this.lastZoomDistance) > 0.1 && !SceneManager.isSelectingFromSearch) {
        this.isManualZoom = true;
      }
      this.lastZoomDistance = currentDistance;
    });
  }

  private startTextureUpdateLoop(): void {
    const updateTextures = () => {
      if (!SceneManager.camera || !SceneManager.earth) return;

      const camera = SceneManager.camera;
      const earthPosition = new Vector3(0, 0, 0); // Posición del centro de la Tierra
      const distance = camera.position.distanceTo(earthPosition);

      // Obtener el material actual
      const earthMesh = SceneManager.earth.getMesh();
      const material = earthMesh.material as any;

      // Cambiar texturas basado en la distancia y si es zoom manual
      if (distance < this.DISTANCE_THRESHOLD && this.isManualZoom) {
        if (material.uniforms.dayTexture.value !== this.dayTexture10k) {
          console.log('Cambiando a textura 10k - Distancia:', Math.round(distance), 'unidades');
          material.uniforms.dayTexture.value = this.dayTexture10k;
          // Mantener la textura de luces nocturnas de 1k
          material.uniforms.nightTexture.value = this.nightTexture1k;
          material.needsUpdate = true;
        }
      } else {
        if (material.uniforms.dayTexture.value !== this.dayTexture1k) {
          console.log('Cambiando a textura 1k - Distancia:', Math.round(distance), 'unidades');
          material.uniforms.dayTexture.value = this.dayTexture1k;
          material.uniforms.nightTexture.value = this.nightTexture1k;
          material.needsUpdate = true;
        }
      }

      this.animationFrameId = requestAnimationFrame(updateTextures);
    };

    updateTextures();
  }

  ngOnDestroy(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }
}
