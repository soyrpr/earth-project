import { Component, OnInit } from '@angular/core';
import { loadAndMergeSatelliteData } from '../../../assets/data/data-loader';
import { SceneManager } from '../../../core/scene.manager';

@Component({
  selector: 'app-satellites',
  imports: [],
  templateUrl: './satellites.component.html',
  styleUrl: './satellites.component.css'
})
export class SatellitesComponent implements OnInit {
  async ngOnInit(): Promise<void> {
    const sats = await loadAndMergeSatelliteData();
    const starlinkSats = sats.filter(sat => (sat.info?.satname ?? '').toLowerCase().startsWith('starlink'));
    starlinkSats.forEach(sat => {
      SceneManager.satelliteManager?.addSatellite(
        sat.norad_cat_id, sat.tle_line_1, sat.tle_line_2, sat.info?.satname ?? "Unknown"
      );
    });
  }
}
