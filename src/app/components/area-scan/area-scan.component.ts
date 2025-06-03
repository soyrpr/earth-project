import { Component, OnInit, OnDestroy, ElementRef, ViewChild, Renderer2 } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AreaScanService } from '../../services/area-scan.service';
import { SceneManager } from '../../../core/scene.manager';
import { Vector3, Vector2, Raycaster, Line, BufferGeometry, LineBasicMaterial, Mesh, MeshBasicMaterial, Object3D, SphereGeometry, Matrix4, Quaternion, ConeGeometry, CircleGeometry, DoubleSide, CylinderGeometry } from 'three';
import { Subscription } from 'rxjs';
import { GlobeService } from '../../services/globe.service';
import { RendererManager } from '../../../core/renderer.manager';
import * as satellite from 'satellite.js';

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
  isDrawingMode = false;
  private permanentCircle: Line | null = null;
  private subscription: Subscription = new Subscription();
  private centerPoint: Vector3 | null = null;
  detectedSatellites: any[] = [];
  private originalSatelliteColors: Map<string, number> = new Map();
  private readonly DETECTION_COLOR = 0x0000ff; // Azul oscuro
  private animationFrameId: number | null = null;
  private detectionMeshes: Mesh[] = [];
  private lastCheckTime = 0;
  private readonly CHECK_INTERVAL = 500; // Check every 500ms instead of every frame
  private detectionCircle: Mesh | null = null;
  private detectionArea: Mesh | null = null;
  private raycaster: Raycaster = new Raycaster();
  private detectionCylinder: Mesh | null = null;

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

  private setupDrawingMode() {
    const canvas = this.globeService.getCanvas();
    if (!canvas) return;

    // Verificar que tenemos acceso a los satélites
    if (!SceneManager.satelliteManager) {
      console.error('SatelliteManager is not initialized in setupDrawingMode');
      return;
    }

    const satelliteMeshes = SceneManager.satelliteManager.getSatelliteMeshes();
    console.log('Satellite meshes in setupDrawingMode:', satelliteMeshes?.length);

    // Desactivar el control de la cámara
    this.globeService.disableCameraControls();

    // Agregar la clase drawing-mode al body
    this.renderer.addClass(document.body, 'drawing-mode');

    canvas.addEventListener('mousedown', this.onMouseDown);
    this.isDrawingMode = true;

    // Iniciar la animación
    this.startAnimation();
  }

  private startAnimation() {
    const animate = () => {
      if (this.isDrawingMode && this.centerPoint) {
        console.log('Running detection check...');
        this.checkSatellitesInCircle();
      }
      this.animationFrameId = requestAnimationFrame(animate);
    };
    this.animationFrameId = requestAnimationFrame(animate);
  }

  private cleanupDrawingMode() {
    const canvas = this.globeService.getCanvas();
    if (!canvas) return;

    // Reactivar el control de la cámara
    this.globeService.enableCameraControls();

    // Remover la clase drawing-mode del body
    this.renderer.removeClass(document.body, 'drawing-mode');

    canvas.removeEventListener('mousedown', this.onMouseDown);
    canvas.style.cursor = 'default';

    // Detener la animación
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // Limpiar el círculo de detección
    if (this.detectionCircle) {
      this.globeService.getScene().remove(this.detectionCircle);
      this.detectionCircle.geometry.dispose();
      (this.detectionCircle.material as MeshBasicMaterial).dispose();
      this.detectionCircle = null;
    }

    // Limpiar el cilindro de detección
    if (this.detectionCylinder) {
      this.globeService.getScene().remove(this.detectionCylinder);
      this.detectionCylinder.geometry.dispose();
      (this.detectionCylinder.material as MeshBasicMaterial).dispose();
      this.detectionCylinder = null;
    }

    // Restaurar colores originales de los satélites
    this.originalSatelliteColors.forEach((color, noradId) => {
      const satelliteMeshes = SceneManager.satelliteManager?.getSatelliteMeshes();
      if (!satelliteMeshes) return;

      const satelliteMesh = satelliteMeshes.find(mesh => 
        (mesh as Mesh).userData?.['noradId'] === noradId
      ) as Mesh | undefined;

      if (satelliteMesh) {
        const material = satelliteMesh.material as MeshBasicMaterial;
        material.color.setHex(color);
      }
    });
    this.originalSatelliteColors.clear();
    this.detectedSatellites = [];

    this.cleanupPermanentObjects();
    this.isDrawingMode = false;
  }

  ngOnDestroy() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
    this.cleanupDrawingMode();
    this.subscription.unsubscribe();
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
      console.log('Mouse click detected on globe');
      this.centerPoint = intersects[0].point.clone();
      this.createPermanentCircle();
    }
  };

  private createPermanentCircle() {
    if (!this.centerPoint) return;

    // Limpiar el círculo anterior si existe
    this.cleanupPermanentObjects();

    const earthRadius = SceneManager.earth!.getRadius();
    const radius = earthRadius * 0.03; // 3% del radio de la Tierra
    const segments = 64;
    const geometry = new BufferGeometry();
    const points: Vector3[] = [];

    // Convertir el punto central a coordenadas esféricas
    const centerNormal = this.centerPoint.clone().normalize();
    const centerLat = Math.asin(centerNormal.y);
    const centerLon = Math.atan2(centerNormal.x, centerNormal.z);

    // Crear puntos del círculo usando coordenadas esféricas
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      const angle = radius / earthRadius; // Ángulo en radianes

      // Calcular la latitud y longitud del punto en el círculo
      const lat = centerLat + angle * Math.cos(theta);
      const lon = centerLon + angle * Math.sin(theta) / Math.cos(centerLat);

      // Convertir de vuelta a coordenadas cartesianas
      const x = earthRadius * Math.cos(lat) * Math.sin(lon);
      const y = earthRadius * Math.sin(lat);
      const z = earthRadius * Math.cos(lat) * Math.cos(lon);

      points.push(new Vector3(x, y, z));
    }

    geometry.setFromPoints(points);
    const material = new LineBasicMaterial({ 
      color: 0x00ffff,
      linewidth: 2,
      transparent: true,
      opacity: 0.8
    });
    
    this.permanentCircle = new Line(geometry, material);
    this.globeService.getScene().add(this.permanentCircle);

    // Forzar una actualización del renderer
    RendererManager.forceRender();
  }

  private cleanupPermanentObjects() {
    if (this.permanentCircle) {
      this.globeService.getScene().remove(this.permanentCircle);
      this.permanentCircle.geometry.dispose();
      (this.permanentCircle.material as LineBasicMaterial).dispose();
      this.permanentCircle = null;
    }

    // Limpiar los meshes de detección
    this.detectionMeshes.forEach(mesh => {
      this.globeService.getScene().remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as MeshBasicMaterial).dispose();
    });
    this.detectionMeshes = [];
  }

  private createDetectionCircle() {
    if (this.detectionCircle) {
      this.globeService.getScene().remove(this.detectionCircle);
      this.detectionCircle.geometry.dispose();
      (this.detectionCircle.material as MeshBasicMaterial).dispose();
    }

    const earthRadius = SceneManager.earth!.getRadius();
    const radius = earthRadius * 0.02; // 2% del radio de la Tierra

    // Crear geometría del círculo
    const geometry = new CircleGeometry(radius, 32);
    const material = new MeshBasicMaterial({
      color: 0x0000ff,
      transparent: true,
      opacity: 0.3,
      side: DoubleSide
    });

    this.detectionCircle = new Mesh(geometry, material);
    
    // Posicionar y orientar el círculo
    const upVector = this.centerPoint!.clone().normalize();
    const quaternion = new Quaternion();
    quaternion.setFromUnitVectors(new Vector3(0, 1, 0), upVector);

    this.detectionCircle.position.copy(this.centerPoint!);
    this.detectionCircle.setRotationFromQuaternion(quaternion);
    
    this.globeService.getScene().add(this.detectionCircle);
  }

  private createDetectionCylinder() {
    if (this.detectionCylinder) {
      this.globeService.getScene().remove(this.detectionCylinder);
      this.detectionCylinder.geometry.dispose();
      (this.detectionCylinder.material as MeshBasicMaterial).dispose();
    }

    const earthRadius = SceneManager.earth!.getRadius();
    const radius = earthRadius * 0.02; // 2% del radio de la Tierra
    const height = earthRadius * 0.1; // 10% del radio de la Tierra para la altura

    // Crear geometría del cilindro
    const geometry = new CylinderGeometry(radius, radius, height, 32);
    const material = new MeshBasicMaterial({
      color: 0x0000ff,
      transparent: true,
      opacity: 0.2,
      side: DoubleSide
    });

    this.detectionCylinder = new Mesh(geometry, material);
    
    // Posicionar y orientar el cilindro
    const upVector = this.centerPoint!.clone().normalize();
    const quaternion = new Quaternion();
    quaternion.setFromUnitVectors(new Vector3(0, 1, 0), upVector);

    // Posicionar el cilindro desde la superficie
    this.detectionCylinder.position.copy(this.centerPoint!);
    // Mover el cilindro hacia arriba la mitad de su altura
    this.detectionCylinder.position.add(upVector.clone().multiplyScalar(height / 2));
    
    this.detectionCylinder.setRotationFromQuaternion(quaternion);
    
    this.globeService.getScene().add(this.detectionCylinder);
  }

  private checkSatellitesInCircle() {
    if (!this.centerPoint) {
      console.log('No center point available');
      return;
    }

    if (!SceneManager.satelliteManager) {
      console.error('SatelliteManager is not initialized');
      return;
    }

    // Throttle checks
    const now = Date.now();
    if (now - this.lastCheckTime < this.CHECK_INTERVAL) {
      return;
    }
    this.lastCheckTime = now;

    // Crear o actualizar el cilindro de detección
    this.createDetectionCylinder();

    const detectedSatellites: any[] = [];
    const satelliteData = SceneManager.satelliteManager.getAllSatellitesData();
    const instancedMeshes = SceneManager.satelliteManager.getAllInstancedMeshes();
    const earthRadius = SceneManager.earth!.getRadius();
    const maxDistance = earthRadius * 0.02; // 2% del radio de la Tierra

    console.log('Starting detection with:', {
      centerPoint: this.centerPoint.toArray(),
      maxDistance,
      totalSatellites: satelliteData.length,
      totalInstancedMeshes: instancedMeshes.length
    });

    // Clear previous detection meshes
    this.detectionMeshes.forEach(mesh => {
      this.globeService.getScene().remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as MeshBasicMaterial).dispose();
    });
    this.detectionMeshes = [];

    // Process each instanced mesh
    for (const instancedMesh of instancedMeshes) {
      // Verificar si el mesh está visible
      if (!instancedMesh.visible) {
        continue;
      }

      const matrix = new Matrix4();
      const position = new Vector3();
      const quaternion = new Quaternion();
      const scale = new Vector3();

      const instanceCount = instancedMesh.count;
      console.log(`Processing visible instanced mesh with ${instanceCount} instances`);

      for (let i = 0; i < instanceCount; i++) {
        // Verificar si esta instancia específica está visible
        const visible = instancedMesh.userData?.['visible']?.[i];
        if (visible === false) {
          continue;
        }

        instancedMesh.getMatrixAt(i, matrix);
        matrix.decompose(position, quaternion, scale);

        // Calcular la distancia horizontal al punto central
        const toSatellite = position.clone().sub(this.centerPoint);
        const upVector = this.centerPoint.clone().normalize();
        const verticalDistance = toSatellite.dot(upVector);
        const horizontalDistance = Math.sqrt(toSatellite.lengthSq() - verticalDistance * verticalDistance);

        // Si está dentro del radio horizontal y por encima de la superficie
        if (horizontalDistance <= maxDistance && verticalDistance > 0) {
          const satelliteId = instancedMesh.userData?.['ids']?.[i];
          if (satelliteId) {
            const satData = satelliteData.find(s => s.norad_cat_id === satelliteId);
            if (satData) {
              const name = satData.info?.satname || `Satellite ${satelliteId}`;
              
              console.log(`Found visible satellite in cylinder:`, {
                name,
                noradId: satelliteId,
                horizontalDistance,
                verticalDistance,
                position: position.toArray()
              });

              detectedSatellites.push({
                name: name,
                norad_cat_id: satelliteId,
                position: position.clone(),
                horizontalDistance,
                verticalDistance
              });

              // Create detection mesh
              const geometry = new SphereGeometry(earthRadius * 0.001, 16, 16);
              const material = new MeshBasicMaterial({ 
                color: this.DETECTION_COLOR,
                transparent: true,
                opacity: 0.8
              });
              const detectionMesh = new Mesh(geometry, material);
              detectionMesh.position.copy(position);
              this.globeService.getScene().add(detectionMesh);
              this.detectionMeshes.push(detectionMesh);
            }
          }
        }
      }
    }

    // Ordenar los satélites por distancia horizontal
    detectedSatellites.sort((a, b) => a.horizontalDistance - b.horizontalDistance);

    console.log(`Detection complete. Found ${detectedSatellites.length} visible satellites:`, 
      detectedSatellites.map(s => ({ 
        name: s.name, 
        noradId: s.norad_cat_id,
        horizontalDistance: s.horizontalDistance,
        verticalDistance: s.verticalDistance
      }))
    );
    this.detectedSatellites = detectedSatellites;
  }
}
