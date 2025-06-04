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

  private detectedSatellitesSubject = new BehaviorSubject<any[]>([]);
  detectedSatellites$ = this.detectedSatellitesSubject.asObservable();

  private satelliteEntryTimes: Map<string, Date> = new Map(); // Tiempo de entrada en la simulación
  private satelliteTotalTimes: Map<string, number> = new Map(); // Tiempo total acumulado en segundos
  private allDetectedSatellites: Map<string, any> = new Map(); // Mantener todos los satélites detectados

  constructor() {
    // Solo cargar los tiempos si hay una sesión activa (por ejemplo, si hay satélites detectados)
    const hasActiveSession = sessionStorage.getItem('detectedSatellites');
    if (hasActiveSession) {
      try {
        const savedTimes = sessionStorage.getItem('satelliteTotalTimes');
        if (savedTimes) {
          const timesObject = JSON.parse(savedTimes);
          this.satelliteTotalTimes = new Map(Object.entries(timesObject));
        }
        const savedEntryTimes = sessionStorage.getItem('satelliteEntryTimes');
        if (savedEntryTimes) {
          const entryTimesObject = JSON.parse(savedEntryTimes);
          this.satelliteEntryTimes = new Map(
            Object.entries(entryTimesObject).map(([key, value]) => [key, new Date(value as number)])
          );
        }
      } catch (error) {
        this.clearData();
      }
    } else {
      this.clearData();
    }
  }

  toggleVisibility() {
    this.isVisibleSubject.next(!this.isVisibleSubject.value);
  }

  isVisible(): boolean {
    return this.isVisibleSubject.value;
  }

  scanSatellitesOverLine(startLat: number, startLon: number, endLat: number, endLon: number, date: Date = new Date()): Observable<any[]> {
    const satellites = SceneManager.satelliteManager?.getAllSatellitesData() || [];
    const results: any[] = [];

    satellites.forEach(sat => {
      try {
        const satrec = satellite.twoline2satrec(sat.tle_line_1, sat.tle_line_2);
        const positionAndVelocity = satellite.propagate(satrec, date);

        if (!positionAndVelocity || !positionAndVelocity.position) {
          return;
        }

        const positionEci = positionAndVelocity.position;
        const gmst = satellite.gstime(date);
        const geodeticCoords = satellite.eciToGeodetic(positionEci, gmst);

        const position = {
          lat: geodeticCoords.latitude * (180 / Math.PI),
          lon: geodeticCoords.longitude * (180 / Math.PI)
        };

        // Calculate distance using great circle distance
        const distance = this.calculateGreatCircleDistance(
          position,
          { lat: startLat, lon: startLon },
          { lat: endLat, lon: endLon }
        );

        // Check if satellite is within detection range (2 degrees)
        if (distance < 2) {
          results.push({
            name: sat.name,
            norad_cat_id: sat.norad_cat_id,
            position: position
          });
        }
      } catch (error) {
        // Silently handle errors
      }
    });

    return new Observable(subscriber => {
      subscriber.next(results);
      subscriber.complete();
    });
  }

  private calculateGreatCircleDistance(
    point: { lat: number; lon: number },
    lineStart: { lat: number; lon: number },
    lineEnd: { lat: number; lon: number }
  ): number {
    // Convert to radians
    const lat1 = point.lat * (Math.PI / 180);
    const lon1 = point.lon * (Math.PI / 180);
    const lat2 = lineStart.lat * (Math.PI / 180);
    const lon2 = lineStart.lon * (Math.PI / 180);
    const lat3 = lineEnd.lat * (Math.PI / 180);
    const lon3 = lineEnd.lon * (Math.PI / 180);

    // Calculate distance to start point
    const d1 = Math.acos(
      Math.sin(lat1) * Math.sin(lat2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1)
    );

    // Calculate distance to end point
    const d2 = Math.acos(
      Math.sin(lat1) * Math.sin(lat3) +
      Math.cos(lat1) * Math.cos(lat3) * Math.cos(lon3 - lon1)
    );

    // Calculate distance between line points
    const d3 = Math.acos(
      Math.sin(lat2) * Math.sin(lat3) +
      Math.cos(lat2) * Math.cos(lat3) * Math.cos(lon3 - lon2)
    );

    // Check if point is within line segment
    const isWithinSegment = d1 + d2 <= d3 + 0.0001;

    // Calculate perpendicular distance using Heron's formula
    const s = (d1 + d2 + d3) / 2;
    const area = Math.sqrt(s * (s - d1) * (s - d2) * (s - d3));
    const height = (2 * area) / d3;

    // If point is outside segment, use distance to closest point
    const distance = isWithinSegment ? height : Math.min(d1, d2);

    // Convert from radians to degrees
    return distance * (180 / Math.PI);
  }


  private sphericalToCartesian(lat: number, lon: number, altitude: number = 0): Vector3 {
    const EARTH_RADIUS = 6371; // Earth's radius in km
    const radius = EARTH_RADIUS + altitude;
    
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);
    
    const x = -radius * Math.sin(phi) * Math.cos(theta);
    const y = radius * Math.cos(phi);
    const z = radius * Math.sin(phi) * Math.sin(theta);
    
    return new Vector3(x, y, z);
  }

  private cartesianToSpherical(point: Vector3): { lat: number; lon: number } {
    const radius = Math.sqrt(point.x * point.x + point.y * point.y + point.z * point.z);
    const lat = Math.asin(point.y / radius) * (180 / Math.PI);
    const lon = Math.atan2(point.x, point.z) * (180 / Math.PI);
    return { lat, lon };
  }

  private calculateSatelliteTimeInZone(
    satrec: any,
    position: { lat: number; lon: number },
    date: Date,
    radiusDegrees: number
  ): number {
    return 0; // Ya no usamos este método
  }

  scanSatellitesOverArea(
    center: { lat: number; lon: number },
    radiusDegrees: number,
    date: Date = new Date()
  ): Observable<any[]> {
    const satellites = SceneManager.satelliteManager?.getAllSatellitesData() || [];
    const currentlyDetected = new Set<string>();
    const currentSimTime = date;

    satellites.forEach(sat => {
      try {
        const satrec = satellite.twoline2satrec(sat.tle_line_1, sat.tle_line_2);
        const positionAndVelocity = satellite.propagate(satrec, date);

        if (!positionAndVelocity || !positionAndVelocity.position) {
          return;
        }

        const positionEci = positionAndVelocity.position;
        const gmst = satellite.gstime(date);
        const geodeticCoords = satellite.eciToGeodetic(positionEci, gmst);

        const position = {
          lat: geodeticCoords.latitude * (180 / Math.PI),
          lon: geodeticCoords.longitude * (180 / Math.PI)
        };

        // Calculate distance from center to satellite
        const distance = this.calculateGreatCircleDistance(center, position, position);

        // Check if satellite is within the circle
        if (distance <= radiusDegrees) {
          currentlyDetected.add(sat.norad_cat_id);

          // Obtener el nombre completo del satélite
          const satelliteName = sat.info?.satname || sat.name || `Satélite ${sat.norad_cat_id}`;

          // Si el satélite acaba de entrar en la zona
          if (!this.satelliteEntryTimes.has(sat.norad_cat_id)) {
            this.satelliteEntryTimes.set(sat.norad_cat_id, currentSimTime);
          }

          // Actualizar o crear entrada del satélite
          const entryTime = this.satelliteEntryTimes.get(sat.norad_cat_id)!;
          const currentTimeInZone = (currentSimTime.getTime() - entryTime.getTime()) / 1000; // Tiempo actual en la zona en segundos
          const previousTotal = this.satelliteTotalTimes.get(sat.norad_cat_id) || 0;
          const totalTime = previousTotal + currentTimeInZone;

          this.allDetectedSatellites.set(sat.norad_cat_id, {
            name: satelliteName,
            norad_cat_id: sat.norad_cat_id,
            position: position,
            totalTime: totalTime,
            isInZone: true
          });
        } else {
          // Si el satélite estaba en la zona y ahora sale
          if (this.satelliteEntryTimes.has(sat.norad_cat_id)) {
            const entryTime = this.satelliteEntryTimes.get(sat.norad_cat_id)!;
            const timeSpent = (currentSimTime.getTime() - entryTime.getTime()) / 1000; // Tiempo en segundos
            const currentTotal = this.satelliteTotalTimes.get(sat.norad_cat_id) || 0;
            const newTotal = currentTotal + timeSpent;
            
            this.satelliteTotalTimes.set(sat.norad_cat_id, newTotal);
            this.satelliteEntryTimes.delete(sat.norad_cat_id);

            // Mantener el satélite en la lista pero marcarlo como fuera de la zona
            if (this.allDetectedSatellites.has(sat.norad_cat_id)) {
              const satData = this.allDetectedSatellites.get(sat.norad_cat_id)!;
              this.allDetectedSatellites.set(sat.norad_cat_id, {
                name: satData.name,
                norad_cat_id: sat.norad_cat_id,
                position: satData.position,
                totalTime: newTotal,
                isInZone: false
              });
            }
          }
        }
      } catch (error) {
        // Silently handle errors
      }
    });

    // Actualizar tiempos para satélites que siguen en la zona
    for (const [noradId, satData] of this.allDetectedSatellites.entries()) {
      if (satData.isInZone && this.satelliteEntryTimes.has(noradId)) {
        const entryTime = this.satelliteEntryTimes.get(noradId)!;
        const currentTimeInZone = (currentSimTime.getTime() - entryTime.getTime()) / 1000; // Tiempo en segundos
        const previousTotal = this.satelliteTotalTimes.get(noradId) || 0;
        const totalTime = previousTotal + currentTimeInZone;

        this.allDetectedSatellites.set(noradId, {
          name: satData.name,
          norad_cat_id: noradId,
          position: satData.position,
          totalTime: totalTime,
          isInZone: satData.isInZone
        });
      }
    }

    // Guardar los tiempos actualizados
    try {
      const timesObject = Object.fromEntries(this.satelliteTotalTimes);
      const entryTimesObject = Object.fromEntries(
        Array.from(this.satelliteEntryTimes.entries()).map(([key, value]) => [key, value.getTime()])
      );
      sessionStorage.setItem('satelliteTotalTimes', JSON.stringify(timesObject));
      sessionStorage.setItem('satelliteEntryTimes', JSON.stringify(entryTimesObject));
    } catch (error) {
      // Silently handle storage errors
    }

    // Convertir el Map a array y ordenar por tiempo total
    const results = Array.from(this.allDetectedSatellites.values())
      .map(sat => ({
        name: sat.name,
        norad_cat_id: sat.norad_cat_id,
        position: sat.position,
        totalTime: sat.totalTime,
        isInZone: sat.isInZone
      }))
      .sort((a, b) => b.totalTime - a.totalTime);

    return new Observable(subscriber => {
      subscriber.next(results);
      subscriber.complete();
    });
  }

  setVisible(visible: boolean) {
    this.isVisibleSubject.next(visible);
  }

  updateDetectedSatellites(satellites: any[]) {
    this.detectedSatellitesSubject.next(satellites);
  }

  getSatelliteTotalTimes(): Map<string, number> {
    return this.satelliteTotalTimes;
  }

  updateSatelliteTotalTimes(times: Map<string, number>) {
    this.satelliteTotalTimes = times;
    // Guardar los tiempos actualizados
    try {
      const timesObject = Object.fromEntries(times);
      sessionStorage.setItem('satelliteTotalTimes', JSON.stringify(timesObject));
    } catch (error) {
      // Silently handle storage errors
    }
  }

  resetSatelliteTimes() {
    this.clearData();
    this.allDetectedSatellites.clear();
    this.updateDetectedSatellites([]);
  }

  private clearData() {
    // Limpiar los datos del sessionStorage
    sessionStorage.removeItem('detectedSatellites');
    sessionStorage.removeItem('satelliteTotalTimes');
    sessionStorage.removeItem('satelliteEntryTimes');
    
    // Limpiar los datos en memoria
    this.detectedSatellitesSubject.next([]);
    this.satelliteTotalTimes = new Map();
    this.satelliteEntryTimes = new Map();
  }
}
