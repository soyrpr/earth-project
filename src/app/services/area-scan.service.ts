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
    // Obtener todos los satélites del SceneManager
    const satellites = SceneManager.satelliteManager?.getAllSatellitesData() || [];
    const results: any[] = [];

    console.log('Starting scan with line:', {
      start: { lat: startLat, lon: startLon },
      end: { lat: endLat, lon: endLon }
    });
    console.log('Total satellites to check:', satellites.length);

    // Para cada satélite, verificar si cruza la línea
    satellites.forEach(sat => {
      try {
        const satrec = satellite.twoline2satrec(sat.tle_line_1, sat.tle_line_2);
        const positionAndVelocity = satellite.propagate(satrec, date);

        if (!positionAndVelocity || !positionAndVelocity.position) {
          console.log(`No position data for satellite ${sat.name}`);
          return;
        }

        const positionEci = positionAndVelocity.position;
        const gmst = satellite.gstime(date);
        const geodeticCoords = satellite.eciToGeodetic(positionEci, gmst);

        const position = {
          lat: geodeticCoords.latitude * (180 / Math.PI),
          lon: geodeticCoords.longitude * (180 / Math.PI)
        };

        // Calcular la distancia usando la fórmula de Haversine
        const distance = this.calculateHaversineDistance(
          position,
          { lat: startLat, lon: startLon },
          { lat: endLat, lon: endLon }
        );

        console.log(`Satellite ${sat.name}:`, {
          position,
          distance,
          threshold: 5
        });

        // Aumentamos el umbral de detección a 5 grados para hacer la detección más sensible
        if (distance < 5) {
          console.log(`Detected satellite ${sat.name} with distance ${distance}`);
          results.push({
            name: sat.name,
            norad_cat_id: sat.norad_cat_id,
            position: position
          });
        }
      } catch (error) {
        console.warn(`Error procesando satélite ${sat.name}`, error);
      }
    });

    console.log('Scan complete. Detected satellites:', results.length);
    return new Observable(subscriber => {
      subscriber.next(results);
      subscriber.complete();
    });
  }

  private calculateHaversineDistance(
    point: { lat: number; lon: number },
    lineStart: { lat: number; lon: number },
    lineEnd: { lat: number; lon: number }
  ): number {
    // Convertir a radianes
    const lat1 = point.lat * (Math.PI / 180);
    const lon1 = point.lon * (Math.PI / 180);
    const lat2 = lineStart.lat * (Math.PI / 180);
    const lon2 = lineStart.lon * (Math.PI / 180);
    const lat3 = lineEnd.lat * (Math.PI / 180);
    const lon3 = lineEnd.lon * (Math.PI / 180);

    // Calcular la distancia al punto inicial de la línea
    const d1 = Math.acos(
      Math.sin(lat1) * Math.sin(lat2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1)
    );

    // Calcular la distancia al punto final de la línea
    const d2 = Math.acos(
      Math.sin(lat1) * Math.sin(lat3) +
      Math.cos(lat1) * Math.cos(lat3) * Math.cos(lon3 - lon1)
    );

    // Calcular la distancia entre los puntos de la línea
    const d3 = Math.acos(
      Math.sin(lat2) * Math.sin(lat3) +
      Math.cos(lat2) * Math.cos(lat3) * Math.cos(lon3 - lon2)
    );

    // Verificar si el punto está dentro del segmento de línea
    const isWithinSegment = d1 + d2 <= d3 + 0.0001; // Agregamos un pequeño margen de error

    // Calcular la distancia perpendicular usando la fórmula de Heron
    const s = (d1 + d2 + d3) / 2;
    const area = Math.sqrt(s * (s - d1) * (s - d2) * (s - d3));
    const height = (2 * area) / d3;

    // Si el punto está fuera del segmento, usar la distancia al punto más cercano
    const distance = isWithinSegment ? height : Math.min(d1, d2);

    // Convertir de radianes a grados
    return distance * (180 / Math.PI);
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
