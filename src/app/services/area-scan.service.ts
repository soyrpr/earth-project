import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import * as satellite from 'satellite.js';
import { SceneManager } from '../../core/scene.manager';
import { Vector3 } from 'three';

@Injectable({
  providedIn: 'root'
})
export class AreaScanService {
  private isVisibleSubject = new BehaviorSubject<boolean>(false);
  isVisible$ = this.isVisibleSubject.asObservable();

  constructor() {}

  toggleVisibility() {
    this.isVisibleSubject.next(!this.isVisibleSubject.value);
  }

  isVisible(): boolean {
    return this.isVisibleSubject.value;
  }

  scanSatellitesOverLine(startLat: number, startLon: number, endLat: number, endLon: number, date: Date = new Date()): Observable<any[]> {
    // Obtener todos los satélites
    const satellites = this.getAllSatellites();
    const results: any[] = [];

    // Para cada satélite, verificar si cruza la línea
    satellites.forEach(sat => {
      const position = this.calculateSatellitePosition(sat, date);
      if (position) {
        const distance = this.distanceToLine(
          position,
          this.sphericalToCartesian(startLat, startLon),
          this.sphericalToCartesian(endLat, endLon)
        );

        // Si el satélite está dentro de 1 grado de la línea
        if (distance < 1) {
          results.push({
            name: sat.name,
            norad_cat_id: sat.norad_cat_id,
            position: position
          });
        }
      }
    });

    return new Observable(subscriber => {
      subscriber.next(results);
      subscriber.complete();
    });
  }

  private getAllSatellites(): any[] {
    // Aquí deberías obtener la lista de satélites de tu fuente de datos
    // Por ahora retornamos un array vacío
    return [];
  }

  private calculateSatellitePosition(satellite: any, date: Date): { lat: number; lon: number } | null {
    try {
      const position = satellite.propagate(date);
      if (position) {
        const latLon = satellite.eciToGeodetic(position);
        return {
          lat: latLon.latitude * (180 / Math.PI),
          lon: latLon.longitude * (180 / Math.PI)
        };
      }
    } catch (error) {
      console.error('Error calculating satellite position:', error);
    }
    return null;
  }

  private distanceToLine(point: { lat: number; lon: number }, lineStart: Vector3, lineEnd: Vector3): number {
    const pointVec = this.sphericalToCartesian(point.lat, point.lon);
    
    // Vector de la línea
    const lineVec = new Vector3().subVectors(lineEnd, lineStart);
    
    // Vector del punto al inicio de la línea
    const pointToStart = new Vector3().subVectors(pointVec, lineStart);
    
    // Proyección del punto sobre la línea
    const t = pointToStart.dot(lineVec) / lineVec.lengthSq();
    
    // Punto más cercano en la línea
    const closestPoint = new Vector3().addVectors(
      lineStart,
      lineVec.multiplyScalar(Math.max(0, Math.min(1, t)))
    );
    
    // Distancia en grados
    return this.cartesianToSpherical(closestPoint).lat - point.lat;
  }

  private sphericalToCartesian(lat: number, lon: number): Vector3 {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);
    
    const x = -Math.sin(phi) * Math.cos(theta);
    const y = Math.cos(phi);
    const z = Math.sin(phi) * Math.sin(theta);
    
    return new Vector3(x, y, z);
  }

  private cartesianToSpherical(point: Vector3): { lat: number; lon: number } {
    const radius = Math.sqrt(point.x * point.x + point.y * point.y + point.z * point.z);
    const lat = Math.asin(point.y / radius) * (180 / Math.PI);
    const lon = Math.atan2(point.x, point.z) * (180 / Math.PI);
    return { lat, lon };
  }

  scanSatellitesOverArea(
    center: { lat: number; lon: number },
    radiusKm: number,
    date: Date = new Date()
  ): Observable<any[]> {
    const latRad = satellite.degreesToRadians(center.lat);
    const lonRad = satellite.degreesToRadians(center.lon);

    const EARTH_RADIUS_KM = 6371;
    const maxAngleRad = radiusKm / EARTH_RADIUS_KM;
    const satsInArea: any[] = [];

    const satellites = SceneManager.satelliteManager?.getAllSatellitesData() || [];

    for (const sat of satellites) {
      try {
        const satrec = satellite.twoline2satrec(sat.tle_line_1, sat.tle_line_2);
        const positionAndVelocity = satellite.propagate(satrec, date);

        if (!positionAndVelocity || !positionAndVelocity.position) continue;

        const positionEci = positionAndVelocity.position;
        const gmst = satellite.gstime(date);
        const geodeticCoords = satellite.eciToGeodetic(positionEci, gmst);

        const satLatRad = geodeticCoords.latitude;
        const satLonRad = geodeticCoords.longitude;

        const angularDistance = Math.acos(
          Math.sin(latRad) * Math.sin(satLatRad) +
          Math.cos(latRad) * Math.cos(satLatRad) * Math.cos(satLonRad - lonRad)
        );

        if (angularDistance <= maxAngleRad) {
          satsInArea.push(sat);
        }
      } catch (error) {
        console.warn(`Error procesando satélite ${sat.name}`, error);
      }
    }

    return new Observable(subscriber => {
      subscriber.next(satsInArea);
      subscriber.complete();
    });
  }
}
