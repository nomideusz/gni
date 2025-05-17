import { writable, type Writable } from 'svelte/store';

// Define language type
export type Language = 'en' | 'pl';

// Define translation structure types
export interface Translations {
  en: TranslationContent;
  pl: TranslationContent;
}

export interface TranslationContent {
  appName: string;
  appDescription: string;
  nav: {
    main: string;
    dashboard: string;
    tests: string;
    reports: string;
    users: string;
    settings: string;
    tools: string;
  };
  dashboard: {
    overview: string;
    lastUpdated: string;
    salesPerformance: string;
    salesIncrease: string;
    userActivity: string;
    activeUsers: string;
    inventoryStatus: string;
    stockLevel: string;
    systemHealth: string;
    allOperational: string;
  };
  dataPanel: {
    dataDetails: string;
    id: string;
    product: string;
    sales: string;
    growth: string;
  };
  tests: {
    title: string;
    description: string;
    infoPanel: {
      testInfo: string;
      currentTest: string;
      displayingData: string;
      aboutData: string;
      aboutDataDescription: string;
      dataParameters: string;
      stats: {
        methane: string;
        ethane: string;
        dataPoints: string;
        averageSpeed: string;
        range: string;
        columns: string;
        max: string;
        min: string;
        avg: string;
        carSpeed: string;
        windSpeed: string;
      };
      parameters: {
        gpsCoords: string;
        windComponents: string;
        carSpeed: string;
      };
      summary: {
        title: string;
        timeRange: string;
        minCH4: string;
        avgCH4: string;
        maxCH4: string;
        dataPoints: string;
        avgCarSpeed: string;
        avgWind: string;
      };
      detailedStats: {
        title: string;
        parameter: string;
        min: string;
        max: string;
        average: string;
      };
      notes: {
        title: string;
        ethaneNegativeTitle: string;
        ethaneNegativeText: string;
      };
    },
    chart: {
      title: string;
      timeSeriesTitle: string;
      ch4Label: string;
      c2h6Label: string;
      timeLabel: string;
      concentrationLabel: string;
      dualAxisTitle: string;
      tooltipTimeLabel: string;
      methaneOnly: string;
      methaneTitle: string;
      gpsTitle: string;
      gpsTraceTitle: string;
      longitudeLabel: string;
      latitudeLabel: string;
      windRoseTitle: string;
      carSpeedLabel: string;
      windSpeedLabel: string;
      directionLabel: string;
      colorGradient: {
        level: string;
        min: string;
        max: string;
      };
    }
  };
  footer: {
    copyright: string;
    version: string;
  };
}

// Translations for the application
export const translations: Translations = {
  en: {
    // Header
    appName: 'PSG Dashboard',
    appDescription: 'Tool for data management and analysis',
    
    // Navigation
    nav: {
      main: 'Main',
      dashboard: 'Dashboard',
      tests: 'Tests',
      reports: 'Reports',
      users: 'Users',
      settings: 'Settings',
      tools: 'Tools'
    },
    
    // Dashboard
    dashboard: {
      overview: 'Dashboard Overview',
      lastUpdated: 'Last updated',
      salesPerformance: 'Sales Performance',
      salesIncrease: 'Monthly sales have increased by 15% compared to previous quarter',
      userActivity: 'User Activity',
      activeUsers: '1,245 active users in the last 24 hours',
      inventoryStatus: 'Inventory Status',
      stockLevel: 'Current stock level: 85% of capacity',
      systemHealth: 'System Health',
      allOperational: 'All systems operational'
    },
    
    // Tests section
    tests: {
      title: 'Tests',
      description: 'Gas data visualization tests and experiments',
      infoPanel: {
        testInfo: 'Test Information',
        currentTest: 'Current Test:',
        displayingData: 'Displaying data from',
        aboutData: 'About the Data',
        aboutDataDescription: 'This test measures concentrations of methane (CH4) and ethane (C2H6) along with related parameters.',
        dataParameters: 'Data Parameters',
        stats: {
          methane: 'Methane concentration',
          ethane: 'Ethane concentration',
          dataPoints: 'Data points',
          averageSpeed: 'Average speed',
          range: 'Range',
          columns: 'Columns',
          max: 'Max',
          min: 'Min',
          avg: 'Average',
          carSpeed: 'Car Speed',
          windSpeed: 'Wind Speed'
        },
        parameters: {
          gpsCoords: 'GPS coordinates',
          windComponents: 'Wind vector components',
          carSpeed: 'Vehicle speed'
        },
        summary: {
          title: 'Summary',
          timeRange: 'Time Range',
          minCH4: 'Min CH₄',
          avgCH4: 'Avg. CH₄',
          maxCH4: 'Max CH₄',
          dataPoints: 'Data Points',
          avgCarSpeed: 'Avg. Car Speed',
          avgWind: 'Avg. Wind'
        },
        detailedStats: {
          title: 'Detailed Statistics',
          parameter: 'Parameter',
          min: 'Min',
          max: 'Max',
          average: 'Average'
        },
        notes: {
          title: 'Notes',
          ethaneNegativeTitle: 'About Negative Ethane Values',
          ethaneNegativeText: 'Negative ethane (C₂H₆) values can occur due to instrument measurement uncertainty when concentrations are near the detection limit. These values are normal and represent background noise rather than true negative concentrations.'
        }
      },
      chart: {
        title: 'Gas concentrations over time',
        timeSeriesTitle: 'CH4 and C2H6 Time Series',
        ch4Label: 'CH4 (ppm)',
        c2h6Label: 'C2H6 (ppb)',
        timeLabel: 'Time',
        concentrationLabel: 'Concentration',
        dualAxisTitle: 'Gas concentrations (dual scale)',
        tooltipTimeLabel: 'Time',
        methaneOnly: 'CH4 Only',
        methaneTitle: 'Methane Concentration',
        gpsTitle: 'Vehicle Path with CH4 Readings',
        gpsTraceTitle: 'GPS Trace',
        longitudeLabel: 'Longitude',
        latitudeLabel: 'Latitude',
        windRoseTitle: 'Wind Rose Chart',
        carSpeedLabel: 'Car Speed',
        windSpeedLabel: 'Wind Speed',
        directionLabel: 'Direction',
        colorGradient: {
          level: 'level',
          min: 'Min',
          max: 'Max'
        }
      }
    },
    
    // Data panel
    dataPanel: {
      dataDetails: 'Data Details',
      id: 'ID',
      product: 'Product',
      sales: 'Sales',
      growth: 'Growth'
    },
    
    // Footer
        footer: {      copyright: '© {year} PSG Dashboard',      version: 'Version 0.2.0'    }
  },
  
  pl: {
    // Header
    appName: 'PSG Dashboard',
    appDescription: 'Narzędzie do zarządzania i analizy danych',
    
    // Navigation
    nav: {
      main: 'Główne',
      dashboard: 'Pulpit',
      tests: 'Testy',
      reports: 'Raporty',
      users: 'Użytkownicy',
      settings: 'Ustawienia',
      tools: 'Narzędzia'
    },
    
    // Dashboard
    dashboard: {
      overview: 'Przegląd Pulpitu',
      lastUpdated: 'Ostatnia aktualizacja',
      salesPerformance: 'Wyniki sprzedaży',
      salesIncrease: 'Miesięczna sprzedaż wzrosła o 15% w porównaniu do poprzedniego kwartału',
      userActivity: 'Aktywność użytkowników',
      activeUsers: '1 245 aktywnych użytkowników w ciągu ostatnich 24 godzin',
      inventoryStatus: 'Stan magazynu',
      stockLevel: 'Aktualny poziom zapasów: 85% pojemności',
      systemHealth: 'Stan systemu',
      allOperational: 'Wszystkie systemy działają'
    },
    
    // Tests section
    tests: {
      title: 'Testy',
      description: 'Wizualizacja danych gazowych i eksperymenty',
      infoPanel: {
        testInfo: 'Informacje o teście',
        currentTest: 'Aktualny test:',
        displayingData: 'Wyświetlanie danych od',
        aboutData: 'O danych',
        aboutDataDescription: 'Ten test mierzy stężenia metanu (CH4) i etanu (C2H6) wraz z powiązanymi parametrami.',
        dataParameters: 'Parametry danych',
        stats: {
          methane: 'Stężenie metanu',
          ethane: 'Stężenie etanu',
          dataPoints: 'Punkty danych',
          averageSpeed: 'Średnia prędkość',
          range: 'Zakres',
          columns: 'Kolumny',
          max: 'Maksimum',
          min: 'Minimum',
          avg: 'Średnia',
          carSpeed: 'Prędkość pojazdu',
          windSpeed: 'Prędkość wiatru'
        },
        parameters: {
          gpsCoords: 'Współrzędne GPS',
          windComponents: 'Komponenty wektoru wiatru',
          carSpeed: 'Prędkość pojazdu'
        },
        summary: {
          title: 'Podsumowanie',
          timeRange: 'Zakres czasu',
          minCH4: 'Min CH₄',
          avgCH4: 'Śr. CH₄',
          maxCH4: 'Maks CH₄',
          dataPoints: 'Punkty danych',
          avgCarSpeed: 'Śr. prędkość pojazdu',
          avgWind: 'Śr. wiatr'
        },
        detailedStats: {
          title: 'Szczegółowe statystyki',
          parameter: 'Parametr',
          min: 'Min',
          max: 'Maks',
          average: 'Średnia'
        },
        notes: {
          title: 'Uwagi',
          ethaneNegativeTitle: 'O ujemnych wartościach etanu',
          ethaneNegativeText: 'Ujemne wartości etanu (C₂H₆) mogą wystąpić z powodu niepewności pomiarowej przyrządu, gdy stężenia są bliskie granicy wykrywalności. Takie wartości są normalne i reprezentują szum tła, a nie rzeczywiste ujemne stężenia.'
        }
      },
      chart: {
        title: 'Stężenia gazów w czasie',
        timeSeriesTitle: 'Szeregi czasowe CH4 i C2H6',
        ch4Label: 'CH4 (ppm)',
        c2h6Label: 'C2H6 (ppb)',
        timeLabel: 'Czas',
        concentrationLabel: 'Stężenie',
        dualAxisTitle: 'Stężenia gazów (podwójna skala)',
        tooltipTimeLabel: 'Czas',
        methaneOnly: 'Tylko CH4',
        methaneTitle: 'Stężenie metanu',
        gpsTitle: 'Ścieżka pojazdu z odczytami CH4',
        gpsTraceTitle: 'Ślad GPS',
        longitudeLabel: 'Długość geograficzna',
        latitudeLabel: 'Szerokość geograficzna',
        windRoseTitle: 'Wykres Róży Wiatrów',
        carSpeedLabel: 'Prędkość pojazdu',
        windSpeedLabel: 'Prędkość wiatru',
        directionLabel: 'Kierunek',
        colorGradient: {
          level: 'poziom',
          min: 'Min',
          max: 'Maks'
        }
      }
    },
    
    // Data panel
    dataPanel: {
      dataDetails: 'Szczegóły danych',
      id: 'ID',
      product: 'Produkt',
      sales: 'Sprzedaż',
      growth: 'Wzrost'
    },
    
    // Footer
    footer: {
      copyright: '© {year} PSG Dashboard',
      version: 'Wersja 1.0.0'
    }
  }
};

// Supported languages
export const LANGUAGES: Language[] = ['en', 'pl'];

// Initialize language from localStorage or use browser language or default to English
const initLang = (): Language => {
  if (typeof window !== 'undefined') {
    const savedLang = localStorage.getItem('language') as Language;
    if (savedLang && LANGUAGES.includes(savedLang)) {
      return savedLang;
    }
    
    // Check browser language
    const browserLang = navigator.language.split('-')[0];
    if (browserLang === 'pl') {
      return 'pl';
    }
  }
  
  return 'en'; // Default to English
};

export const language: Writable<Language> = writable<Language>(initLang());

// Update localStorage when language changes
if (typeof window !== 'undefined') {
  language.subscribe((value: Language) => {
    localStorage.setItem('language', value);
  });
}

// Helper function to get translated text
export function t(key: string, lang: Language): string {
  const keys = key.split('.');
  let result: any = translations[lang];
  
  for (const k of keys) {
    if (result && result[k] !== undefined) {
      result = result[k];
    } else {
      return key; // Return the key if translation is missing
    }
  }
  
  // Handle special variables like {year}
  if (typeof result === 'string') {
    const yearStr = String(new Date().getFullYear());
    result = result.replace('{year}', yearStr);
  }
  
  return result;
} 