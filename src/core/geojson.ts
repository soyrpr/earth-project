import { Scene, Shape } from 'three';
import { FeatureCollection, GeoJSON, MultiPolygon, Polygon } from './../../node_modules/@types/geojson/index.d';

 export function addCountriesToScene( geojson: FeatureCollection, scene: Scene, radius: number) {
  geojson.features.forEach(feature => {
    const coordinates = (feature.geometry as Polygon | MultiPolygon).coordinates;

    const shape = new Shape();
    const polygons = feature.geometry.type === 'MultiPolygon' ? coordinates.flat() : coordinates;
  });
 }
