import { Component, OnInit, OnDestroy, ElementRef, ViewChild, Renderer2 } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AreaScanService } from '../../services/area-scan.service';
import { SceneManager } from '../../../core/scene.manager';
import { Vector3, Vector2, Raycaster, Line, BufferGeometry, LineBasicMaterial } from 'three';
import { Subscription } from 'rxjs';
import { GlobeService } from '../../services/globe.service';

interface Satellite {
  name: string;
  norad_cat_id: string;
  position?: {
    lat: number;
    lon: number;
  };
}

@Component({
  selector: 'app-area-scan',
  templateUrl: './area-scan.component.html',
  styleUrls: ['./area-scan.component.css'],
  standalone: true,
  imports: [CommonModule]
})
export class AreaScanComponent implements OnInit, OnDestroy {
  @ViewChild('container') container!: ElementRef;

  isVisible$;
  isScanning = false;
  isDrawingMode = false;
  detectedSatellites: Satellite[] = [];
  private tempLine: Line | null = null;
  private permanentLine: Line | null = null;
  private updateInterval: any;
  private startPoint: Vector3 | null = null;
  private endPoint: Vector3 | null = null;
  private subscription: Subscription = new Subscription();

  constructor(
    private areaScanService: AreaScanService,
    private globeService: GlobeService,
    private renderer: Renderer2
  ) {
    this.isVisible$ = this.areaScanService.isVisible$;
  }

  ngOnInit() {
    this.subscription.add(
      this.isVisible$.subscribe(isVisible => {
        if (isVisible) {
          this.setupDrawingMode();
        } else {
          this.cleanupDrawingMode();
        }
      })
    );
  }

  ngOnDestroy() {
    this.cleanupDrawingMode();
    this.subscription.unsubscribe();
  }

  focusOnSatellite(satellite: Satellite) {
    if (!satellite.position) return;

    // Convertir lat/lon a coordenadas cartesianas
    const phi = (90 - satellite.position.lat) * (Math.PI / 180);
    const theta = (satellite.position.lon + 180) * (Math.PI / 180);
    
    const x = -Math.sin(phi) * Math.cos(theta);
    const y = Math.cos(phi);
    const z = Math.sin(phi) * Math.sin(theta);
    
    const position = new Vector3(x, y, z).multiplyScalar(SceneManager.earth!.getRadius() + 100);
    
    // Enfocar la cámara en el satélite
    SceneManager.focusCameraOn(position);
  }

  private setupDrawingMode() {
    const canvas = this.globeService.getCanvas();
    if (!canvas) return;

    // Desactivar el control de la cámara
    this.globeService.disableCameraControls();

    // Agregar la clase drawing-mode al body
    this.renderer.addClass(document.body, 'drawing-mode');

    canvas.addEventListener('mousedown', this.onMouseDown);
    canvas.addEventListener('mousemove', this.onMouseMove);
    canvas.addEventListener('mouseup', this.onMouseUp);
    this.isDrawingMode = true;
  }

  private cleanupDrawingMode() {
    const canvas = this.globeService.getCanvas();
    if (!canvas) return;

    // Reactivar el control de la cámara
    this.globeService.enableCameraControls();

    // Remover la clase drawing-mode del body
    this.renderer.removeClass(document.body, 'drawing-mode');

    canvas.removeEventListener('mousedown', this.onMouseDown);
    canvas.removeEventListener('mousemove', this.onMouseMove);
    canvas.removeEventListener('mouseup', this.onMouseUp);
    canvas.style.cursor = 'default';

    this.cleanupTempObjects();
    this.cleanupPermanentObjects();
    this.stopContinuousScan();
    this.isDrawingMode = false;
  }

  private onMouseDown = (event: MouseEvent) => {
    const canvas = this.globeService.getCanvas();
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = this.globeService.getRaycaster();
    raycaster.setFromCamera(new Vector2(x, y), this.globeService.getCamera());

    const intersects = raycaster.intersectObject(this.globeService.getGlobe());
    if (intersects.length > 0) {
      console.log('Mouse down - Intersection point:', intersects[0].point);
      this.startPoint = intersects[0].point.clone();
      this.endPoint = this.startPoint.clone();
      this.createTempLine();
    }
  };

  private onMouseMove = (event: MouseEvent) => {
    if (!this.startPoint) return;

    const canvas = this.globeService.getCanvas();
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = this.globeService.getRaycaster();
    raycaster.setFromCamera(new Vector2(x, y), this.globeService.getCamera());

    const intersects = raycaster.intersectObject(this.globeService.getGlobe());
    if (intersects.length > 0) {
      this.endPoint = intersects[0].point.clone();
      this.updateTempLine();
    }
  };

  private onMouseUp = () => {
    if (this.startPoint && this.endPoint) {
      console.log('Mouse up - Creating permanent line');
      this.createPermanentLine();
      this.startContinuousScan();
    }
    this.cleanupTempObjects();
    this.startPoint = null;
    this.endPoint = null;
  };

  private createTempLine() {
    if (!this.startPoint || !this.endPoint) return;

    console.log('Creating temp line from', this.startPoint, 'to', this.endPoint);
    const geometry = new BufferGeometry().setFromPoints([this.startPoint, this.endPoint]);
    const material = new LineBasicMaterial({ 
      color: 0x00ff00,
      linewidth: 2
    });
    this.tempLine = new Line(geometry, material);
    this.globeService.getScene().add(this.tempLine);
    console.log('Temp line added to scene');
  }

  private updateTempLine() {
    if (!this.tempLine || !this.startPoint || !this.endPoint) return;

    const geometry = new BufferGeometry().setFromPoints([this.startPoint, this.endPoint]);
    this.tempLine.geometry.dispose();
    this.tempLine.geometry = geometry;
  }

  private createPermanentLine() {
    if (!this.startPoint || !this.endPoint) return;

    console.log('Creating permanent line from', this.startPoint, 'to', this.endPoint);
    const geometry = new BufferGeometry().setFromPoints([this.startPoint, this.endPoint]);
    const material = new LineBasicMaterial({ 
      color: 0x00ff00,
      linewidth: 2
    });
    this.permanentLine = new Line(geometry, material);
    this.globeService.getScene().add(this.permanentLine);
    console.log('Permanent line added to scene');
  }

  private cleanupTempObjects() {
    if (this.tempLine) {
      console.log('Cleaning up temp line');
      this.globeService.getScene().remove(this.tempLine);
      this.tempLine.geometry.dispose();
      (this.tempLine.material as LineBasicMaterial).dispose();
      this.tempLine = null;
    }
  }

  private cleanupPermanentObjects() {
    if (this.permanentLine) {
      console.log('Cleaning up permanent line');
      this.globeService.getScene().remove(this.permanentLine);
      this.permanentLine.geometry.dispose();
      (this.permanentLine.material as LineBasicMaterial).dispose();
      this.permanentLine = null;
    }
  }

  private startContinuousScan() {
    if (!this.startPoint || !this.endPoint) return;

    this.isScanning = true;
    this.updateInterval = setInterval(() => {
      if (!this.startPoint || !this.endPoint) {
        this.stopContinuousScan();
        return;
      }

      const startLat = this.cartesianToLatLon(this.startPoint);
      const endLat = this.cartesianToLatLon(this.endPoint);
      
      this.areaScanService.scanSatellitesOverLine(
        startLat.lat,
        startLat.lon,
        endLat.lat,
        endLat.lon
      ).subscribe((newSatellites: Satellite[]) => {
        newSatellites.forEach(sat => {
          if (!this.detectedSatellites.some(existing => existing.norad_cat_id === sat.norad_cat_id)) {
            this.detectedSatellites.push(sat);
          }
        });
      });
    }, 1000);
  }

  private stopContinuousScan() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    this.isScanning = false;
  }

  private cartesianToLatLon(point: Vector3) {
    if (!point) {
      console.error('Point is null in cartesianToLatLon');
      return { lat: 0, lon: 0 };
    }

    const radius = Math.sqrt(point.x * point.x + point.y * point.y + point.z * point.z);
    const lat = Math.asin(point.y / radius) * (180 / Math.PI);
    const lon = Math.atan2(point.x, point.z) * (180 / Math.PI);
    return { lat, lon };
  }
}
