import { Component, OnInit, OnDestroy } from '@angular/core';
import { SceneManager } from '../../../core/scene.manager';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Vector3, Object3D, Mesh, MeshBasicMaterial, SphereGeometry } from 'three';
import { SatelliteSearchService } from '../../services/satellite-search.service';
import { Subscription } from 'rxjs';
import { loadAndMergeSatelliteData } from '../../../assets/data/data-loader';
import { RendererManager } from '../../../core/renderer.manager';
import { Color } from 'three';
import { HostListener } from '@angular/core';
import { SettingsService } from '../../services/settings.service';

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
  private selectedSatellite: any = null;

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

  private languageSubscription: Subscription;

  constructor(
    private satelliteSearchService: SatelliteSearchService,
    public settingsService: SettingsService
  ) {
    this.languageSubscription = this.settingsService.language$.subscribe(() => {
      // Update any component-specific translations if needed
      this.updateComponentTranslations();
    });
  }

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

    // Initialize with current settings
    this.updateComponentTranslations();
  }

  ngOnDestroy(): void {
    if (this.searchSubscription) {
      this.searchSubscription.unsubscribe();
    }
    if (this.languageSubscription) {
      this.languageSubscription.unsubscribe();
    }
  }

  private updateComponentTranslations() {
    // Update any component-specific translations here
    // For example, if you have any hardcoded strings that need translation
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
        // Solo mostrar satélites que están renderizados
        this.searchResults = this.visibleSatellitesData.filter((sat: any) => {
          const id = sat.norad_cat_id?.toString();
          return id && SceneManager.satelliteManager?.isSatelliteLoaded(id);
        });
        this.searchStatus = 'ready';
        return;
      }

      this.searchResults = this.visibleSatellitesData.filter((sat: any) => {
        const name = (sat.info?.satname ?? '').toLowerCase();
        const id = sat.norad_cat_id?.toString();
        return name.includes(query) && id && SceneManager.satelliteManager?.isSatelliteLoaded(id);
      });

      if (this.searchResults.length === 0) {
        this.searchStatus = 'not-found';
      } else {
        this.searchStatus = 'ready';
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
      // Si ya está seleccionado este satélite, no hacer nada
      if (this.selectedSatellite?.norad_cat_id === satData.norad_cat_id) {
        return;
      }

      // Si hay un satélite previamente seleccionado, eliminar su mesh temporal
      if (this.selectedSatellite) {
        const prevId = this.selectedSatellite.norad_cat_id;
        const prevMesh = satManager.getTemporaryMesh(prevId);
        if (prevMesh) {
          SceneManager.scene.remove(prevMesh);
          satManager.removeTemporaryMesh(prevId);
        }
      }

      // Guardar el nuevo satélite seleccionado
      this.selectedSatellite = satData;

      // Verificar si el satélite tiene datos TLE
      if (!satData.tle_line_1 || !satData.tle_line_2) {
        this.errorMessage = `El satélite ${satData.info?.satname || id} no tiene datos de órbita (TLE) disponibles.`;
        this.searchStatus = 'error';
        return;
      }

      // Obtener la posición actual del satélite usando el SatelliteManager
      let positionEci;
      try {
        positionEci = satManager.calculateSatellitePositionEci(satData);
      } catch (error: any) {
        if (error.message.includes('Failed to propagate')) {
          this.errorMessage = `No se pudo calcular la posición actual del satélite ${satData.info?.satname || id}. Los datos TLE pueden estar desactualizados.`;
        } else if (error.message.includes('Invalid TLE format')) {
          this.errorMessage = `Los datos de órbita (TLE) del satélite ${satData.info?.satname || id} tienen un formato inválido.`;
        } else {
          this.errorMessage = `Error al calcular la posición del satélite: ${error.message}`;
        }
        this.searchStatus = 'error';
        return;
      }
      
      // Calcular la posición del satélite en el espacio 3D
      const satellitePosition = new Vector3(
        positionEci.x,
        positionEci.z,
        positionEci.y
      );

      // Crear un mesh temporal para el satélite seleccionado
      const geometry = new SphereGeometry(0.3); // Un poco más grande que el instanced mesh
      const material = new MeshBasicMaterial({
        color: 0xDAA520, // Goldenrod
        transparent: true,
        opacity: 0.8
      });
      const tempMesh = new Mesh(geometry, material);
      tempMesh.position.copy(satellitePosition);
      SceneManager.scene.add(tempMesh);
      satManager.addTemporaryMesh(id, tempMesh);

      // Calcular la posición de la cámara para una mejor visualización
      const cameraDistance = 20; // Reducida la distancia para estar más cerca del satélite
      const cameraOffset = satellitePosition.clone().add(
        satellitePosition.clone().normalize().multiplyScalar(cameraDistance)
      );

      const meshData = {
        id: satData.norad_cat_id,
        tleLine1: satData.tle_line_1,
        tleLine2: satData.tle_line_2,
        name: satData.info?.satname || satData.name,
        info: {
          ...satData.info,
          position: {
            x: positionEci.x.toFixed(2),
            y: positionEci.z.toFixed(2),
            z: positionEci.y.toFixed(2),
          },
        },
        orbital: satData.orbital,
        position: satellitePosition,
      };

      await new Promise((resolve) => setTimeout(resolve, 100));

      SceneManager.isSelectingFromSearch = true;
      const numericId = Number(id);

      SceneManager.showSatelliteInfoFromData(meshData, numericId);
      
      // Animar la cámara hasta el satélite
      const camera = SceneManager.camera;
      const controls = RendererManager.controls;
      if (camera && controls) {
        const startPosition = camera.position.clone();
        const startTarget = controls.target.clone();
        const duration = 1000; // duración de la animación en ms
        const startTime = Date.now();

        const animate = () => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / duration, 1);
          
          // Función de easing para suavizar la animación
          const easeProgress = 1 - Math.pow(1 - progress, 3);

          // Interpolar la posición de la cámara
          camera.position.lerpVectors(startPosition, cameraOffset, easeProgress);
          
          // Interpolar el punto de mira
          controls.target.lerpVectors(startTarget, satellitePosition, easeProgress);
          
          // Actualizar los controles
          controls.update();

          if (progress < 1) {
            requestAnimationFrame(animate);
          }
        };

        // Desactivar temporalmente los controles durante la animación
        controls.enabled = false;
        animate();
        
        // Reactivar los controles después de la animación
        setTimeout(() => {
          controls.enabled = true;
        }, duration);
      }
      
      this.selectedSatelliteId = numericId;

      setTimeout(() => {
        SceneManager.isSelectingFromSearch = false;
      }, 500);
    } catch (error: any) {
      console.error('Error al calcular la posición del satélite:', error);
      this.errorMessage = `Error al calcular la posición del satélite: ${error.message}`;
      this.searchStatus = 'error';
    }
  }

  @HostListener('document:contextmenu', ['$event'])
  onRightClick(event: MouseEvent) {
    if (this.selectedSatellite) {
      // Eliminar el mesh temporal del satélite seleccionado
      const satManager = SceneManager.satelliteManager;
      if (satManager) {
        const id = this.selectedSatellite.norad_cat_id;
        const tempMesh = satManager.getTemporaryMesh(id);
        if (tempMesh) {
          SceneManager.scene.remove(tempMesh);
          satManager.removeTemporaryMesh(id);
        }
      }

      // Limpiar la selección
      this.selectedSatellite = null;
      this.selectedSatelliteId = null;
      SceneManager.hideSatelliteInfo();
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
