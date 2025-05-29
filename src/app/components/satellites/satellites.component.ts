import { Component, OnInit } from '@angular/core';
import { SceneManager } from '../../../core/scene.manager';
import { loadAndMergeSatelliteData } from '../../../../data/data-loader';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

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

  orbitTypes = ['LEO', 'MEO', 'GEO', 'Otro'];
  specialTypes = ['Starlink', 'Galileo']; // ajusta según tus datos
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
    this.visibleSatellitesData = this.allSatellitesData; // Todos
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

      let filtered: any[];
      if (query === '') {
        filtered = this.visibleSatellitesData;
      } else {
        filtered = this.visibleSatellitesData.filter((sat: any) =>
          (sat.info?.satname ?? '').toLowerCase().includes(query)
        );
      }

      if (filtered.length === 0) {
        this.searchStatus = 'not-found';
      }

      this.searchResults = filtered;
      this.searchStatus = 'ready';
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

  let mesh = satManager.getSatelliteMeshes().find((m: any) => {
    return m.userData['id']?.toString().trim() === id;
  });

  if (!mesh) {
    mesh = await satManager.loadSatelliteById(id);
    if (!mesh) {
      this.errorMessage = `El satélite ${id} no está presente ni pudo cargarse.`;
      this.searchStatus = 'error';
      return;
    }
  }

  // Asegurarse de que el userData esté completo
  if (sat.info) mesh.userData['info'] = sat.info;
  if (sat.tle) {
    mesh.userData['tleLine1'] = sat.tle.line1;
    mesh.userData['tleLine2'] = sat.tle.line2;
  }

  // Asignar el ID si no lo tiene (o forzamos a número válido)
  mesh.userData['id'] = Number(id);

  if (!mesh.userData['tleLine1'] || !mesh.userData['tleLine2']) {
    this.errorMessage = `El satélite ${id} no tiene datos de órbita (TLE).`;
    this.searchStatus = 'error';
    return;
  }

  SceneManager.isSelectingFromSearch = true;

  // Mostrar como si fuera clicado
  const numericId = Number(id);
  SceneManager.focusCameraOnSatelliteById(id);
  SceneManager.showSatelliteInfoFromData(mesh.userData, numericId);
  this.selectedSatelliteId = numericId;

  setTimeout(() => {
    SceneManager.isSelectingFromSearch = false;
  }, 500);

}

  async toggleStarlinkFilter(): Promise<void> {
    this.showSatelites = !this.showSatelites;
    console.log('Filtro cambiado:', this.showSatelites);

    await SceneManager.satelliteManager?.loadSatellites(this.showSatelites);

    if (this.showSatelites) {
      this.visibleSatellitesData = this.allSatellitesData; // Todos
    } else {
      this.visibleSatellitesData = this.allSatellitesData.filter(sat =>
        sat.info?.satname?.toLowerCase().includes('starlink')
      );
    }

    if (this.searchText.trim() !== '') {
      await this.onSearch();
    }
  }

  get filteredResults() {
    return this.searchResults.filter(sat => {
      const name = (sat.info?.satname || '').toUpperCase();
      const orbitType = sat.orbital?.orbitType || 'Otro';
      const category = sat.info?.category || '';

      const matchesOrbit = !this.selectedOrbitType || sat.orbital.orbitType === this.selectedOrbitType;
      const matchesSpecial =
        !this.selectedSpecialType ||
        (this.selectedSpecialType === 'Starlink' && name.includes('STARLINK')) ||
        (this.selectedSpecialType === 'Galileo' && name.includes('GALILEO'));
      const matchesCategory = !this.selectedCategory || category === this.selectedCategory;

      return matchesOrbit && matchesSpecial && matchesCategory;
    });
  }

  toggleOrbitType(type: string) {
    this.selectedOrbitType = this.selectedOrbitType === type ? null : type;
  }

  toggleSpecialType(type: string) {
    this.selectedSpecialType = this.selectedSpecialType === type ? null : type;
  }

  toggleCategory(type: string) {
    this.selectedCategory = this.selectedCategory === type ? null : type;
  }

}
