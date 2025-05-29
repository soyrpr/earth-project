import { Component, OnInit } from '@angular/core';
import { SceneManager } from '../../../core/scene.manager';
import { loadAndMergeSatelliteData } from '../../../../data/data-loader';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Vector3 } from 'three';

@Component({
  selector: 'app-satellites',
  templateUrl: './satellites.component.html',
  styleUrls: ['./satellites.component.css'],
  imports: [ CommonModule, FormsModule ]
})
export class SatellitesComponent implements OnInit {
  searchText = '';
  searchResults: any[] = [];
  searchStatus: 'idle' | 'loading' | 'not-found' | 'ready' | 'error' = 'idle';
  errorMessage = '';
  allSatellitesData: any[] = [];
  isSearching = false;
  selectedSatelliteId: number | null = null;
  showSatelites = true;
  visibleSatellitesData: any[] = [];

  orbitTypes = ['LEO', 'MEO', 'GEO'];
  specialTypes = ['Starlink', 'Galileo'];
  categories = ['satellite', 'debris'];
  selectedOrbitType: string | null = null;
  selectedSpecialType: string | null = null;
  selectedCategory: string | null = null;

  ngOnInit(): void {
    (async () => {
      try {
        this.allSatellitesData = await loadAndMergeSatelliteData() ?? [];
      } catch (err) {
        this.errorMessage = 'Error loading satellite data.';
        this.searchStatus = 'error';
        console.error(err);
        this.allSatellitesData = [];
      }

  if (this.showSatelites) {
    this.visibleSatellitesData = this.allSatellitesData;
  } else {
    this.visibleSatellitesData = this.allSatellitesData.filter(sat =>
      sat.info?.satname?.toLowerCase().includes('starlink')
    );
  }
    })();
  }

  async onSearch() {
    if (this.isSearching || !this.visibleSatellitesData) return;

    this.isSearching = true;
    this.searchStatus = 'loading';
    this.errorMessage = '';
    this.searchResults = [];

    try {
      const query = this.searchText.trim().toLowerCase();

      // Si no hay texto de búsqueda, mostrar todos los satélites visibles
      if (query === '') {
        this.searchResults = this.visibleSatellitesData;
        this.searchStatus = 'ready';
        return;
      }

      // Filtrar por nombre
      this.searchResults = this.visibleSatellitesData.filter((sat: any) => {
        const name = (sat.info?.satname ?? '').toLowerCase();
        return name.includes(query);
      });

      if (this.searchResults.length === 0) {
        this.searchStatus = 'not-found';
      } else {
        this.searchStatus = 'ready';
        // Actualizar la visualización con los resultados de la búsqueda
        await SceneManager.satelliteManager?.loadSatellitesFiltered(this.searchResults);
      }
    } catch (err) {
      console.error(err);
      this.searchStatus = 'error';
      this.errorMessage = 'Error al buscar satélites. Por favor, inténtelo de nuevo más tarde.';
    } finally {
      this.isSearching = false;
    }
  }

  async focusOnSatellite(sat: any): Promise<void> {
    let id: string | undefined;

    if (typeof sat === 'string') {
      id = sat.trim();
    } else if (typeof sat === 'object' && sat !== null) {
      id = sat.norad_cat_id?.toString().trim() ?? sat.id?.toString();
    }

    if (!id) {
      this.errorMessage = 'No se pudo obtener ID válido del satélite seleccionado.';
      this.searchStatus = 'error';
      return;
    }

    const satManager = SceneManager.satelliteManager;
    if (!satManager) return;

    // Buscar el satélite en los datos visibles actuales
    const satData = this.visibleSatellitesData.find(s => s.norad_cat_id?.toString() === id);
    if (!satData) {
      this.errorMessage = `No se encontró el satélite ${id} en los datos visibles.`;
      this.searchStatus = 'error';
      return;
    }

    try {
      // Asegurarnos de que el satélite esté cargado en la escena
      await satManager.loadSatellitesFiltered([satData]);
      
      // Calcular la posición actual del satélite
      const positionEci = satManager.calculateSatellitePositionEci(satData);
      const earthRadius = 6371; // Radio de la Tierra en km
      const scaleFactor = 30 / earthRadius; // Radio de la Tierra en la escena / Radio de la Tierra real

      // Calcular la altitud usando los elementos TLE
      let altitudeKm = 0;
      let orbitInfo: {
        semiMajorAxis?: string;
        period?: string;
        meanMotion?: string;
        altitude?: string;
      } = {};

      if (satData.satrec) {
        console.log('Datos TLE para', satData.name, ':', {
          meanMotion: satData.satrec.no,
          eccentricity: satData.satrec.ecco,
          inclination: satData.satrec.inclo
        });

        const GM = 398600.4418; // Constante gravitacional de la Tierra (km³/s²)
        const n = satData.satrec.no * 60; // Convertir de revoluciones/minuto a revoluciones/hora
        const T = 24 / n; // Período orbital en horas
        const a = Math.pow((GM * Math.pow(T * 3600, 2)) / (4 * Math.pow(Math.PI, 2)), 1/3); // Semieje mayor en km
        
        altitudeKm = a - earthRadius;
        
        orbitInfo = {
          semiMajorAxis: a.toFixed(2),
          period: T.toFixed(2),
          meanMotion: n.toFixed(6),
          altitude: altitudeKm.toFixed(2)
        };

        console.log('Cálculos orbitales para', satData.name, ':', orbitInfo);
      } else {
        console.warn('No se encontraron elementos TLE para', satData.name);
      }
      
      // Intercambiar Y y Z para coincidir con el sistema de coordenadas de Three.js
      const position = new Vector3(
        positionEci.x * scaleFactor,
        positionEci.z * scaleFactor, // Y en Three.js es la altura (antes era Z)
        positionEci.y * scaleFactor  // Z en Three.js es la profundidad (antes era Y)
      );

      // Crear los datos necesarios para el mesh con la posición calculada
      const meshData = {
        id: satData.norad_cat_id,
        tleLine1: satData.tleLine1,
        tleLine2: satData.tleLine2,
        name: satData.info?.satname || satData.name,
        info: {
          ...satData.info,
          ...orbitInfo,
          position: {
            x: positionEci.x.toFixed(2),
            y: positionEci.y.toFixed(2),
            z: positionEci.z.toFixed(2)
          }
        },
        orbital: satData.orbital || {
          semiMajorAxis: orbitInfo.semiMajorAxis ? parseFloat(orbitInfo.semiMajorAxis) : 0,
          period: orbitInfo.period ? parseFloat(orbitInfo.period) : 0,
          meanMotion: orbitInfo.meanMotion ? parseFloat(orbitInfo.meanMotion) : 0,
          orbitType: altitudeKm < 2000 ? 'LEO' : 
                    altitudeKm < 35786 ? 'MEO' : 'GEO'
        },
        position: position
      };

      // Esperar un momento para asegurarnos de que el satélite esté completamente cargado
      await new Promise(resolve => setTimeout(resolve, 100));

      SceneManager.isSelectingFromSearch = true;
      const numericId = Number(id);
      
      // Mostrar la información del satélite
      console.log('Enviando datos del satélite a SceneManager:', meshData);
      SceneManager.showSatelliteInfoFromData(meshData, numericId);
      await SceneManager.focusCameraOnSatelliteById(id);
      this.selectedSatelliteId = numericId;

      setTimeout(() => {
        SceneManager.isSelectingFromSearch = false;
      }, 500);
    } catch (error) {
      console.error('Error al calcular la posición del satélite:', error);
      this.errorMessage = 'Error al calcular la posición del satélite';
      this.searchStatus = 'error';
    }
  }

  async toggleStarlinkFilter(): Promise<void> {
    this.showSatelites = !this.showSatelites;
    console.log('Filtro cambiado:', this.showSatelites);

    if (SceneManager.satelliteManager) {
      if (this.showSatelites) {
        SceneManager.satelliteManager.showAllSatellites();
        this.visibleSatellitesData = this.allSatellitesData;
      } else {
        SceneManager.satelliteManager.hideNonStarlinkSatellites();
        this.visibleSatellitesData = this.allSatellitesData.filter(sat =>
          sat.info?.satname?.toLowerCase().includes('starlink')
        );
      }
    }

    if (this.searchText.trim() !== '') {
      await this.onSearch();
    }
  }

  get filteredResults() {
    return this.searchResults.length > 0 ? this.searchResults : this.visibleSatellitesData.filter(sat => {
      const name = (sat.info?.satname || '').toUpperCase();
      const orbitType = sat.orbital?.orbitType || '';
      const category = sat.info?.category || '';

      // Filtro por tipo especial (Starlink o Galileo)
      const matchesSpecial =
        !this.selectedSpecialType ||
        (this.selectedSpecialType === 'Starlink' && name.includes('STARLINK')) ||
        (this.selectedSpecialType === 'Galileo' && 
          name.match(/^(GSAT|GALILEO|GAL)\s*\d+/i) !== null);

      // Si hay un filtro especial seleccionado, ignoramos los otros filtros
      if (this.selectedSpecialType) {
        return matchesSpecial;
      }

      // Si no hay filtro especial, aplicamos los filtros de órbita y categoría
      const matchesOrbit = !this.selectedOrbitType || orbitType === this.selectedOrbitType;
      const matchesCategory = !this.selectedCategory || category === this.selectedCategory;

      return matchesOrbit && matchesCategory;
    });
  }

  async toggleOrbitType(type: string) {
    // Si hay un tipo especial seleccionado, lo limpiamos primero
    if (this.selectedSpecialType) {
      this.selectedSpecialType = null;
      if (SceneManager.satelliteManager) {
        SceneManager.satelliteManager.showAllSatellites();
      }
    }
    
    this.selectedOrbitType = this.selectedOrbitType === type ? null : type;
    
    if (SceneManager.satelliteManager) {
      if (this.selectedOrbitType) {
        SceneManager.satelliteManager.showSatellitesByOrbitType(this.selectedOrbitType);
      } else {
        SceneManager.satelliteManager.showAllSatellites();
      }
    }
    
    await this.onSearch();
  }

  async toggleSpecialType(type: string) {
    // Limpiamos los otros filtros cuando se selecciona un tipo especial
    if (type !== this.selectedSpecialType) {
      this.selectedOrbitType = null;
      this.selectedCategory = null;
    }

    this.selectedSpecialType = this.selectedSpecialType === type ? null : type;

    if (SceneManager.satelliteManager) {
      if (!this.selectedSpecialType) {
        SceneManager.satelliteManager.showAllSatellites();
        this.visibleSatellitesData = this.allSatellitesData;
      } else {
        const filterName = this.selectedSpecialType.toLowerCase();
        if (filterName === 'starlink') {
          SceneManager.satelliteManager.hideNonStarlinkSatellites();
        } else if (filterName === 'galileo') {
          SceneManager.satelliteManager.showSatellitesByPattern(/^(galileo)\s*\d+/i);
        }
        
        this.visibleSatellitesData = this.allSatellitesData.filter(sat => {
          const name = (sat.info?.satname ?? '').toLowerCase();
          if (filterName === 'galileo') {
            return name.match(/^(galileo)\s*\d+/i) !== null;
          } else if (filterName === 'starlink') {
            return name.match(/^starlink/i) !== null;
          }
          return false;
        });
      }
    }

    // Actualizar la búsqueda si hay texto en el campo de búsqueda
    if (this.searchText.trim() !== '') {
      await this.onSearch();
    }
  }

  async toggleCategory(type: string) {
    // Si hay un tipo especial seleccionado, lo limpiamos primero
    if (this.selectedSpecialType) {
      this.selectedSpecialType = null;
      if (SceneManager.satelliteManager) {
        SceneManager.satelliteManager.showAllSatellites();
      }
    }
    
    this.selectedCategory = this.selectedCategory === type ? null : type;
    
    if (SceneManager.satelliteManager) {
      if (this.selectedCategory) {
        SceneManager.satelliteManager.showSatellitesByCategory(this.selectedCategory);
      } else {
        SceneManager.satelliteManager.showAllSatellites();
      }
    }
    
    await this.onSearch();
  }

}
