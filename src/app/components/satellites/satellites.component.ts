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
  allSatellitesData: any[] | null = null;
  isSearching = false;
  selectedSatelliteId: number | null = null;
  showSatelites = true;

  async ngOnInit(): Promise<void> {
    try {
      this.allSatellitesData = await loadAndMergeSatelliteData();
    } catch (err) {
      this.errorMessage = 'Error loading satellite data.';
      this.searchStatus = 'error';
      console.error(err);
    }
  }

  async onSearch() {
    if (this.isSearching) return;
    this.isSearching = true;

    this.searchStatus = 'loading';
    this.errorMessage = '';
    this.searchResults = [];

    try {
      const satManager = SceneManager.satelliteManager;
      if (!satManager) {
        this.searchStatus = 'error';
        this.errorMessage = 'No se ha inicializado el gestor de satélites.';
        return;
      }

      const meshes = satManager.getSatelliteMeshes();
      const sats = meshes.map((m: any) => ({
        norad_cat_id: m.userData['id'],
        tle_line_1: m.userData['tle_line_1'],
        tle_line_2: m.userData['tle_line_2'],
        info: { satname: m.userData['name'] }
      }));

      const filtered = sats.filter(sat =>
        (sat.info?.satname ?? '').toLowerCase().includes(this.searchText.toLowerCase())
      );

      if (filtered.length === 0) {
        this.searchStatus = 'not-found';
        return;
      }

      this.searchResults = filtered;
      this.searchStatus = 'ready';

      // await this.focusOnSatellite(filtered[0]);

    } catch (err) {
      this.searchStatus = 'error';
      this.errorMessage = 'Error al buscar satélites.';
      console.error(err);
    } finally {
      this.isSearching = false;
    }
  }

async focusOnSatellite(sat: any): Promise<void> {
  console.log('focusOnSatellite recibido:', sat);

  let id: string | undefined;

  if (typeof sat === 'string') {
    id = sat.trim();
  } else if (typeof sat === 'object' && sat !== null) {
    id = sat.norad_cat_id?.trim() ?? sat.id?.toString();
  }

  console.log('ID usado para buscar satélite:', id);

  if (!id) {
    this.errorMessage = 'No se pudo obtener ID válido del satélite seleccionado.';
    this.searchStatus = 'error';
    return;
  }

  const satManager = SceneManager.satelliteManager;
  if (!satManager) return;

  const mesh = satManager.getSatelliteMeshes().find((m: any) => m.userData['id'] === id);

  if (!mesh) {
    console.error(`El satélite ${id} no está cargado en la escena.`);
    this.errorMessage = `El satélite ${id} no está presente en la visualización.`;
    this.searchStatus = 'error';
    return;
  }

  // Ahora sí puedes hacer lo que necesites con el satélite cargado
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
    SceneManager.satelliteManager?.loadSatellites(this.showSatelites);
  }
}
