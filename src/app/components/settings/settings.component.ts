import { Component, OnInit } from '@angular/core';
import { SettingsService } from '../../services/settings.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css',
  standalone: true,
  imports: [CommonModule, FormsModule]
})
export class SettingsComponent implements OnInit {
  selectedFont = 'Helvetica';
  selectedLanguage = 'en';
  fonts = ['Helvetica', 'Courier New', 'Comic Sans MS'];
  languages = ['en', 'es'];
  isVisible$;

  constructor(private settingsService: SettingsService) {
    this.isVisible$ = this.settingsService.isVisible$;
  }

  ngOnInit() {
    this.selectedFont = this.settingsService.getCurrentFont();
    this.selectedLanguage = this.settingsService.getCurrentLanguage();
  }

  onFontChange() {
    console.log('Changing font to:', this.selectedFont);
    this.settingsService.setFont(this.selectedFont);
  }

  onLanguageChange() {
    this.settingsService.setLanguage(this.selectedLanguage);
  }
}
