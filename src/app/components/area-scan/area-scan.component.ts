import { Component, OnInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AreaScanService } from '../../services/area-scan.service';
import { SceneManager } from '../../../core/scene.manager';
import { Vector3, Vector2, Raycaster, Line, BufferGeometry, LineBasicMaterial } from 'three';
import { Subscription } from 'rxjs';
import { GlobeService } from '../../services/globe.service';

interface Satellite {
  name: string;
  norad_cat_id: string;
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
  detectedSatellites: Satellite[] = [];
  private tempLine: Line | null = null;
  private permanentLine: Line | null = null;
  private updateInterval: any;
  private startPoint: Vector3 | null = null;
  private endPoint: Vector3 | null = null;
  private subscription: Subscription = new Subscription();

  constructor(
    private areaScanService: AreaScanService,
    private globeService: GlobeService
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

  private setupDrawingMode() {
    const canvas = this.globeService.getCanvas();
    if (!canvas) return;

    canvas.addEventListener('mousedown', this.onMouseDown);
    canvas.addEventListener('mousemove', this.onMouseMove);
    canvas.addEventListener('mouseup', this.onMouseUp);
    canvas.style.cursor = 'crosshair';
  }

  private cleanupDrawingMode() {
    const canvas = this.globeService.getCanvas();
    if (!canvas) return;

    canvas.removeEventListener('mousedown', this.onMouseDown);
    canvas.removeEventListener('mousemove', this.onMouseMove);
    canvas.removeEventListener('mouseup', this.onMouseUp);
    canvas.style.cursor = 'default';

    this.cleanupTempObjects();
    this.cleanupPermanentObjects();
    this.stopContinuousScan();
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
      this.startPoint = intersects[0].point;
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
      this.endPoint = intersects[0].point;
      this.updateTempLine();
    }
  };

  private onMouseUp = () => {
    if (this.startPoint && this.endPoint) {
      this.createPermanentLine();
      this.startContinuousScan();
    }
    this.cleanupTempObjects();
    this.startPoint = null;
    this.endPoint = null;
  };

  private createTempLine() {
    if (!this.startPoint || !this.endPoint) return;

    const geometry = new BufferGeometry().setFromPoints([this.startPoint, this.endPoint]);
    const material = new LineBasicMaterial({ color: 0x00ff00 });
    this.tempLine = new Line(geometry, material);
    this.globeService.getScene().add(this.tempLine);
  }

  private updateTempLine() {
    if (!this.tempLine || !this.startPoint || !this.endPoint) return;

    const geometry = new BufferGeometry().setFromPoints([this.startPoint, this.endPoint]);
    this.tempLine.geometry.dispose();
    this.tempLine.geometry = geometry;
  }

  private createPermanentLine() {
    if (!this.startPoint || !this.endPoint) return;

    const geometry = new BufferGeometry().setFromPoints([this.startPoint, this.endPoint]);
    const material = new LineBasicMaterial({ color: 0x00ff00 });
    this.permanentLine = new Line(geometry, material);
    this.globeService.getScene().add(this.permanentLine);
  }

  private cleanupTempObjects() {
    if (this.tempLine) {
      this.globeService.getScene().remove(this.tempLine);
      this.tempLine.geometry.dispose();
      (this.tempLine.material as LineBasicMaterial).dispose();
      this.tempLine = null;
    }
  }

  private cleanupPermanentObjects() {
    if (this.permanentLine) {
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
      const startLat = this.cartesianToLatLon(this.startPoint!);
      const endLat = this.cartesianToLatLon(this.endPoint!);

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
    const radius = Math.sqrt(point.x * point.x + point.y * point.y + point.z * point.z);
    const lat = Math.asin(point.y / radius) * (180 / Math.PI);
    const lon = Math.atan2(point.x, point.z) * (180 / Math.PI);
    return { lat, lon };
  }
}
