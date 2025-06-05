import { Injectable } from "@angular/core";
import { BehaviorSubject, Observable } from "rxjs";

@Injectable({
  providedIn: 'root'
})
export class SettingsService {
    private fontSubject = new BehaviorSubject<string>('Helvetica');
    private languageSubject = new BehaviorSubject<string>('en');
    private visibilitySubject = new BehaviorSubject<boolean>(false);

    font$ = this.fontSubject.asObservable();
    language$ = this.languageSubject.asObservable();
    isVisible$ = this.visibilitySubject.asObservable();

    private translations: { [key: string]: { [key: string]: string } } = {
        'en': {
            'settings': 'Settings',
            'font': 'Font',
            'language': 'Language',
            'simulated_time': 'Simulated Time:',
            'select_date_time': 'Select date and time:',
            'simulation_speed': 'Simulation Speed:',
            'speed_units': 'Speed Units:',
            'seconds_per_second': 'Seconds per second',
            'minutes_per_second': 'Minutes per second',
            'hours_per_second': 'Hours per second',
            'days_per_second': 'Days per second',
            'pause': 'Pause',
            'resume': 'Resume',
            'forward': 'Moving forward in time',
            'backward': 'Moving backward in time',
            'search': 'Search',
            'search_satellite_placeholder': 'Search satellite by name...',
            'orbit': 'Orbit',
            'type': 'Type',
            'no_satellites_found': 'No satellites found',
            'error_loading': 'Error loading satellites',
            'draw_area': 'Draw Area',
            'click_to_draw': 'Click to draw a circle',
            'detected_satellites': 'Detected Satellites',
            'time_in_zone': 'Time in zone:',
            'satellite_name': 'Satellite Name',
            'total_time': 'Total Time',
            'current_time': 'Current Time',
            'start_scan': 'Start Scan',
            'stop_scan': 'Stop Scan',
            'clear_area': 'Clear Area'
        },
        'es': {
            'settings': 'Ajustes',
            'font': 'Fuente',
            'language': 'Idioma',
            'simulated_time': 'Tiempo Simulado:',
            'select_date_time': 'Seleccionar fecha y hora:',
            'simulation_speed': 'Velocidad de Simulación:',
            'speed_units': 'Unidades de Velocidad:',
            'seconds_per_second': 'Segundos por segundo',
            'minutes_per_second': 'Minutos por segundo',
            'hours_per_second': 'Horas por segundo',
            'days_per_second': 'Días por segundo',
            'pause': 'Pausar',
            'resume': 'Reanudar',
            'forward': 'Avanzando en el tiempo',
            'backward': 'Retrocediendo en el tiempo',
            'search': 'Buscar',
            'search_satellite_placeholder': 'Buscar satélite por nombre...',
            'orbit': 'Órbita',
            'type': 'Tipo',
            'no_satellites_found': 'No se encontraron satélites',
            'error_loading': 'Error al cargar los satélites',
            'draw_area': 'Dibujar Área',
            'click_to_draw': 'Haz clic para dibujar un círculo',
            'detected_satellites': 'Satélites Detectados',
            'time_in_zone': 'Tiempo en zona:',
            'satellite_name': 'Nombre del Satélite',
            'total_time': 'Tiempo Total',
            'current_time': 'Tiempo Actual',
            'start_scan': 'Iniciar Escaneo',
            'stop_scan': 'Detener Escaneo',
            'clear_area': 'Limpiar Área'
        }
    };

    constructor() {
        // Initialize with default values first
        this.setFont('Helvetica');
        this.setLanguage('en');
        
        // Then try to load saved preferences
        const savedFont = localStorage.getItem('preferredFont');
        const savedLanguage = localStorage.getItem('preferredLanguage');
        
        if (savedFont) {
            this.setFont(savedFont);
        }
        
        if (savedLanguage) {
            this.setLanguage(savedLanguage);
        }

        // Subscribe to language changes to update translations
        this.language$.subscribe(lang => {
            this.updateTranslations(lang);
        });
    }

    setFont(font: string) {
        // Remove all font classes first
        document.body.classList.remove('font-helvetica', 'font-courier', 'font-comic-sans');
        
        // Add the appropriate font class
        let fontClass = '';
        switch (font) {
            case 'Helvetica':
                fontClass = 'font-helvetica';
                break;
            case 'Courier New':
                fontClass = 'font-courier';
                break;
            case 'Comic Sans MS':
                fontClass = 'font-comic-sans';
                break;
            default:
                fontClass = 'font-helvetica';
                font = 'Helvetica';
        }
        
        // Apply the font class
        document.body.classList.add(fontClass);
        
        // Update the subject and store preference
        this.fontSubject.next(font);
        localStorage.setItem('preferredFont', font);
    }

    getCurrentFont(): string {
        return this.fontSubject.value;
    }

    setLanguage(language: string) {
        // Validate language
        if (language !== 'en' && language !== 'es') {
            language = 'en';
        }

        this.languageSubject.next(language);
        document.documentElement.lang = language;
        localStorage.setItem('preferredLanguage', language);
        this.updateTranslations(language);
    }

    private updateTranslations(language: string) {
        // Apply translations to elements with data-i18n attribute
        const elements = document.querySelectorAll('[data-i18n]');
        elements.forEach(element => {
            const key = element.getAttribute('data-i18n');
            if (key && this.translations[language] && this.translations[language][key]) {
                element.textContent = this.translations[language][key];
            }
        });

        // Update placeholders
        const inputs = document.querySelectorAll('input[placeholder]');
        inputs.forEach(input => {
            const key = input.getAttribute('placeholder');
            if (key && this.translations[language] && this.translations[language][key]) {
                input.setAttribute('placeholder', this.translations[language][key]);
            }
        });
    }

    getTranslation(key: string): string {
        const currentLang = this.languageSubject.value;
        return this.translations[currentLang]?.[key] || key;
    }

    getCurrentLanguage(): string {
        return this.languageSubject.value;
    }

    toggleVisibility() {
        this.visibilitySubject.next(!this.visibilitySubject.value);
    }

    setVisible(visible: boolean) {
        this.visibilitySubject.next(visible);
    }

    isVisible() {
        return this.visibilitySubject.value;
    }
}