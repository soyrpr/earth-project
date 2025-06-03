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
    const satellites = SceneManager.satelliteManager?.getAllSatellitesData() || [];
    const results: any[] = [];

    console.log('Starting scan with line:', {
      start: { lat: startLat, lon: startLon },
      end: { lat: endLat, lon: endLon }
    });
    console.log('Total satellites to check:', satellites.length);

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

        // Calculate distance using great circle distance
        const distance = this.calculateGreatCircleDistance(
          position,
          { lat: startLat, lon: startLon },
          { lat: endLat, lon: endLon }
        );

        console.log(`Satellite ${sat.name}:`, {
          position,
          distance,
          threshold: 2 // Threshold in degrees
        });

        // Check if satellite is within detection range (2 degrees)
        if (distance < 2) {
          console.log(`Detected satellite ${sat.name} with distance ${distance} degrees`);
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

  scanSatellitesOverArea(
    center: { lat: number; lon: number },
    radiusDegrees: number,
    date: Date = new Date()
  ): Observable<any[]> {
    const satellites = SceneManager.satelliteManager?.getAllSatellitesData() || [];
    const results: any[] = [];

    console.log('Starting area scan:', {
      center,
      radiusDegrees
    });
    console.log('Total satellites to check:', satellites.length);

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

        // Calculate distance from center to satellite
        const distance = this.calculateGreatCircleDistance(center, position, position);

        console.log(`Satellite ${sat.name}:`, {
          position,
          distance,
          threshold: radiusDegrees
        });

        // Check if satellite is within the circle
        if (distance <= radiusDegrees) {
          console.log(`Detected satellite ${sat.name} with distance ${distance} degrees`);
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

}
