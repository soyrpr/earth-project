import { Component, OnInit, OnDestroy } from '@angular/core';
import { SceneManager } from '../../../core/scene.manager';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Vector3 } from 'three';
import { SatelliteSearchService } from '../../services/satellite-search.service';
import { Subscription } from 'rxjs';
import { loadAndMergeSatelliteData } from '../../../assets/data/data-loader';

@Component({
  selector: 'app-satellites',
  templateUrl: './satellites.component.html',
  styleUrls: ['./satellites.component.css'],
  standalone: true,
  imports: [CommonModule, FormsModule],
})
export class SatellitesComponent implements OnInit, OnDestroy {
  searchText = '';
  searchResults: any[] = [];
  searchStatus: 'idle' | 'loading' | 'not-found' | 'ready' | 'error' = 'idle';
  errorMessage = '';
  allSatellitesData: any[] = [];
  isSearching = false;
  selectedSatelliteId: number | null = null;
  showSatelites = true;
  visibleSatellitesData: any[] = [];
  isSearchVisible = false;
  private searchSubscription: Subscription | null = null;

  orbitTypes = ['LEO', 'MEO', 'GEO'];
  specialTypes = ['Starlink', 'Galileo'];
  categories: Array<'satellites' | 'debris'> = ['satellites', 'debris'];
  selectedOrbitType: string | null = null;
  selectedSpecialType: string | null = null;
  selectedCategory: string | null = null;
  currentDate = new Date();

  selectedFilters = {
    satellites: true,
    debris: false,
  };

  constructor(private satelliteSearchService: SatelliteSearchService) {}

  async ngOnInit(): Promise<void> {
    this.searchSubscription = this.satelliteSearchService.searchVisible$.subscribe(visible => {
      this.isSearchVisible = visible;
    });

    try {
      this.allSatellitesData = (await loadAndMergeSatelliteData()) ?? [];
    } catch (err) {
      this.errorMessage = 'Error loading satellite data.';
      this.searchStatus = 'error';
      console.error(err);
      this.allSatellitesData = [];
    }

    if (this.showSatelites) {
      this.visibleSatellitesData = this.allSatellitesData;
    } else {
      this.visibleSatellitesData = this.allSatellitesData.filter((sat) =>
        sat.info?.satname?.toLowerCase().includes('starlink')
      );
    }
  }

  ngOnDestroy(): void {
    if (this.searchSubscription) {
      this.searchSubscription.unsubscribe();
    }
  }

  async onSearch() {
    if (this.isSearching || !this.visibleSatellitesData) return;

    this.isSearching = true;
    this.searchStatus = 'loading';
    this.errorMessage = '';
    this.searchResults = [];

    try {
      const query = this.searchText.trim().toLowerCase();

      if (query === '') {
        this.searchResults = this.visibleSatellitesData;
        this.searchStatus = 'ready';
        return;
      }

      this.searchResults = this.visibleSatellitesData.filter((sat: any) => {
        const name = (sat.info?.satname ?? '').toLowerCase();
        return name.includes(query);
      });

      if (this.searchResults.length === 0) {
        this.searchStatus = 'not-found';
      } else {
        this.searchStatus = 'ready';
        await SceneManager.satelliteManager?.loadSatellitesFiltered(this.searchResults, this.currentDate);
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

    const satData = this.visibleSatellitesData.find((s) => s.norad_cat_id?.toString() === id);
    if (!satData) {
      this.errorMessage = `No se encontró el satélite ${id} en los datos visibles.`;
      this.searchStatus = 'error';
      return;
    }

    try {
      await satManager.loadSatellitesFiltered([satData], this.currentDate);

      const positionEci = satManager.calculateSatellitePositionEci(satData);
      const earthRadius = 6371; // km
      const scaleFactor = 30 / earthRadius;

      let altitudeKm = 0;
      let orbitInfo: {
        semiMajorAxis?: string;
        period?: string;
        meanMotion?: string;
        altitude?: string;
      } = {};

      if (satData.satrec) {
        const GM = 398600.4418; // km^3/s^2
        const n = satData.satrec.no * 60; // rev/hour
        const T = 24 / n; // hours
        const a = Math.pow((GM * Math.pow(T * 3600, 2)) / (4 * Math.pow(Math.PI, 2)), 1 / 3); // km

        altitudeKm = a - earthRadius;

        orbitInfo = {
          semiMajorAxis: a.toFixed(2),
          period: T.toFixed(2),
          meanMotion: n.toFixed(6),
          altitude: altitudeKm.toFixed(2),
        };
      }

      const position = new Vector3(
        positionEci.x * scaleFactor,
        positionEci.z * scaleFactor, // Swap Y and Z for Three.js coordinates
        positionEci.y * scaleFactor
      );

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
            z: positionEci.z.toFixed(2),
          },
        },
        orbital: satData.orbital || {
          semiMajorAxis: orbitInfo.semiMajorAxis ? parseFloat(orbitInfo.semiMajorAxis) : 0,
          period: orbitInfo.period ? parseFloat(orbitInfo.period) : 0,
          meanMotion: orbitInfo.meanMotion ? parseFloat(orbitInfo.meanMotion) : 0,
          orbitType:
            altitudeKm < 2000 ? 'LEO' : altitudeKm < 35787 ? 'MEO' : 'GEO',
        },
        position,
      };

      await new Promise((resolve) => setTimeout(resolve, 100));

      SceneManager.isSelectingFromSearch = true;
      const numericId = Number(id);

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

  get filteredResults() {
    return this.searchResults.filter((sat) => {
      const matchesOrbit = !this.selectedOrbitType || sat.orbit === this.selectedOrbitType;
      const matchesSpecial = !this.selectedSpecialType || sat.info?.satname?.includes(this.selectedSpecialType);
      const isDebris = sat.info?.satname?.includes('DEB');
      const matchesClass =
        (isDebris && this.selectedFilters.debris) ||
        (!isDebris && this.selectedFilters.satellites);

      return matchesOrbit && matchesSpecial && matchesClass;
    });
  }

  async toggleOrbitType(type: string) {
    if (this.selectedSpecialType) {
      this.selectedSpecialType = null;
      SceneManager.satelliteManager?.showAllSatellites();
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
          SceneManager.satelliteManager.showSatellitesByPattern(/starlink/i);
        } else if (filterName === 'galileo') {
          SceneManager.satelliteManager.showSatellitesByPattern(/^(galileo)\s*\d+/i);
        }

        this.visibleSatellitesData = this.allSatellitesData.filter((sat) => {
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

    if (this.searchText.trim() !== '') {
      await this.onSearch();
    }
  }

  async toggleCategory(type: 'satellites' | 'debris') {
    this.selectedFilters[type] = !this.selectedFilters[type];

    if (!this.selectedFilters.satellites && !this.selectedFilters.debris) {
      this.selectedFilters.satellites = false;
    }

    if (SceneManager.satelliteManager) {
      const filtered = this.allSatellitesData.filter((sat) => {
        const isDebris = sat.info?.satname?.includes('DEB');

        if (isDebris && this.selectedFilters.debris) return true;
        if (!isDebris && this.selectedFilters.satellites) return true;
        return false;
      });

      await SceneManager.satelliteManager.loadSatellitesFiltered(filtered, this.currentDate);
    }

    const totalSat = this.allSatellitesData.filter((sat) => !sat.info?.satname.includes('DEB')).length;
    const totalDebris = this.allSatellitesData.filter((sat) => sat.info?.satname.includes('DEB')).length;
    // console.log(`Satélites: ${totalSat}, Basura espacial: ${totalDebris}`);

    await this.onSearch();
  }

  toggleSearchVisibility() {
    this.satelliteSearchService.toggleVisibility(); ;
  }
}
