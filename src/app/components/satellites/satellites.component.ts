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

  if (!this.showSatelites) {
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

    let mesh = satManager.getSatelliteMeshes().find((m: any) => String(m.userData['id']) === id);

    if (!mesh) {
      // No está cargado, intenta cargarlo ahora
      mesh = await satManager.loadSatelliteById(id);

      if (!mesh) {
        this.errorMessage = `El satélite ${id} no está presente ni pudo cargarse.`;
        this.searchStatus = 'error';
        return;
      }
    }

    if (!mesh.userData['tleLine1'] || !mesh.userData['tleLine2']) {
      this.errorMessage = `El satélite ${id} no tiene datos de órbita (TLE).`;
      this.searchStatus = 'error';
      return;
    }

    SceneManager.focusCameraOnSatelliteById(id);
    SceneManager.showSatelliteInfoFromData(mesh.userData, mesh.userData['id']);
    this.selectedSatelliteId = Number(id);
  }

  async toggleStarlinkFilter(): Promise<void> {
    this.showSatelites = !this.showSatelites;
    console.log('Filtro cambiado:', this.showSatelites);

    // Como showSatelites = true es mostrar todos, pasamos su valor directo
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
}
