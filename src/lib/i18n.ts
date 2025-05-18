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
    totalDistance: string;
    jimnyDistance: string;
    torresDistance: string;
    lisa: string;
    lisaPerKm: string;
    recentReports: string;
    viewAllReports: string;
    lastSynced: string;
    syncUnavailable: string;
    loadingReports: string;
    reportName: string;
    reportTitle: string;
    date: string;
    assetsCovered: string;
    surveyorUnit: string;
    status: string;
    final: string;
    draft: string;
    noReportsFound: string;
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
  auth: {
    login: string;
    logout: string;
    loggingOut: string;
    loading: string;
  };
  loading: {
    pageLoading: string;
  };
  tools: {
    surveyViewer: string;
  };
  loginPage: {
    title: string;
    email: string;
    emailPlaceholder: string;
    password: string;
    passwordPlaceholder: string;
    loginButton: string;
    loggingIn: string;
    forgotPassword: string;
    pleaseWait: string;
    validation: {
      emailRequired: string;
      emailInvalid: string;
      passwordRequired: string;
    }
  };
  forgotPassword: {
    title: string;
    description: string;
    emailLabel: string;
    emailPlaceholder: string;
    sendButton: string;
    sending: string;
    backToLogin: string;
    pleaseWait: string;
    success: string;
    returnToLogin: string;
    validation: {
      emailRequired: string;
      emailInvalid: string;
    }
  };
  reports: {
    title: string;
    description: string;
    status: {
      final: string;
      draft: string;
      total: string;
    };
    table: {
      reportName: string;
      reportTitle: string;
      date: string;
      assetsCovered: string;
      surveyorUnit: string;
      lisa: string;
      status: string;
      noReportsFound: string;
    };
    loading: string;
    sync: {
      lastSynced: string;
      unavailable: string;
      never: string;
      unknown: string;
    };
    error: string;
  };
  logout: {
    redirecting: string;
    error: string;
  };
  resetPassword: {
    title: string;
    description: string;
    invalidToken: string;
    requestNewLink: string;
    success: string;
    goToLogin: string;
    newPassword: string;
    newPasswordPlaceholder: string;
    confirmPassword: string;
    confirmPasswordPlaceholder: string;
    passwordNote: string;
    setPasswordButton: string;
    settingPassword: string;
    backToLogin: string;
    pleaseWait: string;
    validation: {
      passwordRequired: string;
      passwordLength: string;
      confirmRequired: string;
      passwordsDoNotMatch: string;
    };
    error: string;
  };
  settings: {
    title: string;
    authRequired: string;
    login: string;
    profile: {
      title: string;
      username: string;
      email: string;
      emailNote: string;
      updateButton: string;
      updating: string;
      success: string;
      error: string;
    };
    password: {
      title: string;
      current: string;
      new: string;
      confirm: string;
      passwordNote: string;
      changeButton: string;
      changing: string;
      success: string;
      error: string;
      validationError: string;
    };
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
      allOperational: 'All systems operational',
      totalDistance: 'Total Distance',
      jimnyDistance: 'Suzuki Jimny Distance',
      torresDistance: 'Ssanyong Torres Distance',
      lisa: 'LISA',
      lisaPerKm: 'LISA/km',
      recentReports: 'Recent Reports',
      viewAllReports: 'View All Reports',
      lastSynced: 'Last synced',
      syncUnavailable: 'Sync status unavailable',
      loadingReports: 'Loading recent reports...',
      reportName: 'Report Name',
      reportTitle: 'Report Title',
      date: 'Date',
      assetsCovered: 'Assets Covered',
      surveyorUnit: 'Surveyor Unit',
      status: 'Status',
      final: 'Final',
      draft: 'Draft',
      noReportsFound: 'No recent reports found'
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
    footer: {
      copyright: '© {year} PSG Dashboard',
      version: 'Version'
    },
    
    // Auth
    auth: {
      login: 'Login',
      logout: 'Logout',
      loggingOut: 'Logging out...',
      loading: 'Loading...'
    },
    
    // Loading
    loading: {
      pageLoading: 'Loading page...'
    },
    
    // Tools
    tools: {
      surveyViewer: 'Survey Viewer'
    },
    
    // Login Page
    loginPage: {
      title: 'Login',
      email: 'Email',
      emailPlaceholder: 'your@email.com',
      password: 'Password',
      passwordPlaceholder: 'Your password',
      loginButton: 'Login',
      loggingIn: 'Logging in...',
      forgotPassword: 'Forgot password?',
      pleaseWait: 'Please wait...',
      validation: {
        emailRequired: 'Email is required',
        emailInvalid: 'Please enter a valid email address',
        passwordRequired: 'Password is required'
      }
    },
    
    // Forgot Password Page
    forgotPassword: {
      title: 'Reset Your Password',
      description: 'Enter your email address, and we\'ll send you instructions to reset your password.',
      emailLabel: 'Email Address',
      emailPlaceholder: 'Enter your email address',
      sendButton: 'Send Reset Instructions',
      sending: 'Sending...',
      backToLogin: 'Back to Login',
      pleaseWait: 'Please wait...',
      success: 'Password reset instructions have been sent to your email.',
      returnToLogin: 'Return to Login',
      validation: {
        emailRequired: 'Email is required',
        emailInvalid: 'Please enter a valid email address'
      }
    },
    
    // Reports Page
    reports: {
      title: 'Reports',
      description: 'View all reports.',
      status: {
        final: 'Final',
        draft: 'Draft',
        total: 'Total'
      },
      table: {
        reportName: 'Report Name',
        reportTitle: 'Report Title',
        date: 'Date',
        assetsCovered: 'Assets Covered',
        surveyorUnit: 'Surveyor Unit',
        lisa: 'LISA',
        status: 'Status',
        noReportsFound: 'No reports found'
      },
      loading: 'Loading reports...',
      sync: {
        lastSynced: 'Last synced',
        unavailable: 'Sync status unavailable',
        never: 'Never',
        unknown: 'Unknown'
      },
      error: 'Failed to load reports'
    },
    
    // Logout
    logout: {
      redirecting: 'Redirecting...',
      error: 'Failed to logout'
    },
    
    // Reset Password
    resetPassword: {
      title: 'Set New Password',
      description: 'Please enter and confirm your new password.',
      invalidToken: 'Invalid or missing reset token. Please request a new password reset link.',
      requestNewLink: 'Request New Link',
      success: 'Your password has been successfully reset!',
      goToLogin: 'Go to Login',
      newPassword: 'New Password',
      newPasswordPlaceholder: 'Enter your new password',
      confirmPassword: 'Confirm Password',
      confirmPasswordPlaceholder: 'Confirm your new password',
      passwordNote: 'Must be at least 8 characters long.',
      setPasswordButton: 'Set New Password',
      settingPassword: 'Setting Password...',
      backToLogin: 'Back to Login',
      pleaseWait: 'Please wait...',
      validation: {
        passwordRequired: 'Password is required',
        passwordLength: 'Password must be at least 8 characters long',
        confirmRequired: 'Please confirm your password',
        passwordsDoNotMatch: 'Passwords do not match'
      },
      error: 'Failed to reset password'
    },
    
    // Settings
    settings: {
      title: 'Account Settings',
      authRequired: 'You must be logged in to access this page.',
      login: 'Login',
      profile: {
        title: 'Profile Information',
        username: 'Username',
        email: 'Email Address',
        emailNote: 'Email address cannot be changed.',
        updateButton: 'Update Profile',
        updating: 'Updating...',
        success: 'Profile updated successfully',
        error: 'Failed to update profile'
      },
      password: {
        title: 'Change Password',
        current: 'Current Password',
        new: 'New Password',
        confirm: 'Confirm New Password',
        passwordNote: 'Must be at least 8 characters long.',
        changeButton: 'Change Password',
        changing: 'Changing...',
        success: 'Password changed successfully',
        error: 'Failed to change password',
        validationError: 'New passwords do not match'
      }
    }
  },
  
  pl: {
    // Header
    appName: 'PSG Dashboard',
    appDescription: 'Narzędzie do zarządzania i analizy danych',
    
    // Navigation
    nav: {
      main: 'Główne',
      dashboard: 'Dashboard',
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
      allOperational: 'Wszystkie systemy działają',
      totalDistance: 'Całkowita odległość',
      jimnyDistance: 'Odległość Suzuki Jimny',
      torresDistance: 'Odległość Ssanyong Torres',
      lisa: 'LISA',
      lisaPerKm: 'LISA/km',
      recentReports: 'Ostatnie raporty',
      viewAllReports: 'Zobacz wszystkie raporty',
      lastSynced: 'Ostatnia synchronizacja',
      syncUnavailable: 'Status synchronizacji niedostępny',
      loadingReports: 'Ładowanie raportów...',
      reportName: 'Nazwa raportu',
      reportTitle: 'Tytuł raportu',
      date: 'Data',
      assetsCovered: 'Pokryte aktywa',
      surveyorUnit: 'Jednostka miernicza',
      status: 'Status',
      final: 'Finalny',
      draft: 'Wersja robocza',
      noReportsFound: 'Nie znaleziono raportów'
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
      version: 'Wersja'
    },
    
    // Auth
    auth: {
      login: 'Zaloguj',
      logout: 'Wyloguj',
      loggingOut: 'Wylogowywanie...',
      loading: 'Ładowanie...'
    },
    
    // Loading
    loading: {
      pageLoading: 'Ładowanie strony...'
    },
    
    // Tools
    tools: {
      surveyViewer: 'Podgląd pomiarów'
    },
    
    // Login Page
    loginPage: {
      title: 'Zaloguj się',
      email: 'Email',
      emailPlaceholder: 'twoj@email.com',
      password: 'Hasło',
      passwordPlaceholder: 'Twoje hasło',
      loginButton: 'Zaloguj',
      loggingIn: 'Logowanie...',
      forgotPassword: 'Zapomniałeś hasła?',
      pleaseWait: 'Proszę czekać...',
      validation: {
        emailRequired: 'Email jest wymagany',
        emailInvalid: 'Wprowadź prawidłowy adres email',
        passwordRequired: 'Hasło jest wymagane'
      }
    },
    
    // Forgot Password Page
    forgotPassword: {
      title: 'Zresetuj swoje hasło',
      description: 'Wprowadź swój adres email, a my wyślemy Ci instrukcje resetowania hasła.',
      emailLabel: 'Adres Email',
      emailPlaceholder: 'Wprowadź swój adres email',
      sendButton: 'Wyślij instrukcje resetowania',
      sending: 'Wysyłanie...',
      backToLogin: 'Powrót do logowania',
      pleaseWait: 'Proszę czekać...',
      success: 'Instrukcje resetowania hasła zostały wysłane na Twój email.',
      returnToLogin: 'Powrót do logowania',
      validation: {
        emailRequired: 'Email jest wymagany',
        emailInvalid: 'Wprowadź prawidłowy adres email'
      }
    },
    
    // Reports Page
    reports: {
      title: 'Raporty',
      description: 'Przegląd raportów.',
      status: {
        final: 'Finalny',
        draft: 'Wersja robocza',
        total: 'Suma'
      },
      table: {
        reportName: 'Nazwa raportu',
        reportTitle: 'Tytuł raportu',
        date: 'Data',
        assetsCovered: 'Pokryte aktywa',
        surveyorUnit: 'Jednostka miernicza',
        lisa: 'LISA',
        status: 'Status',
        noReportsFound: 'Nie znaleziono raportów'
      },
      loading: 'Ładowanie raportów...',
      sync: {
        lastSynced: 'Ostatnia synchronizacja',
        unavailable: 'Status synchronizacji niedostępny',
        never: 'Nigdy',
        unknown: 'Nieznany'
      },
      error: 'Nie udało się załadować raportów'
    },
    
    // Logout
    logout: {
      redirecting: 'Przekierowywanie...',
      error: 'Nie udało się wylogować'
    },
    
    // Reset Password
    resetPassword: {
      title: 'Ustaw nowe hasło',
      description: 'Wprowadź i potwierdź swoje nowe hasło.',
      invalidToken: 'Nieprawidłowy lub brakujący token resetowania. Proszę poprosić o nowy link resetowania hasła.',
      requestNewLink: 'Poproś o nowy link',
      success: 'Twoje hasło zostało pomyślnie zresetowane!',
      goToLogin: 'Przejdź do logowania',
      newPassword: 'Nowe hasło',
      newPasswordPlaceholder: 'Wprowadź swoje nowe hasło',
      confirmPassword: 'Potwierdź hasło',
      confirmPasswordPlaceholder: 'Potwierdź swoje nowe hasło',
      passwordNote: 'Musi mieć co najmniej 8 znaków.',
      setPasswordButton: 'Ustaw nowe hasło',
      settingPassword: 'Ustawianie hasła...',
      backToLogin: 'Powrót do logowania',
      pleaseWait: 'Proszę czekać...',
      validation: {
        passwordRequired: 'Hasło jest wymagane',
        passwordLength: 'Hasło musi mieć co najmniej 8 znaków',
        confirmRequired: 'Proszę potwierdzić hasło',
        passwordsDoNotMatch: 'Hasła nie są zgodne'
      },
      error: 'Nie udało się zresetować hasła'
    },
    
    // Settings
    settings: {
      title: 'Ustawienia konta',
      authRequired: 'Musisz być zalogowany, aby uzyskać dostęp do tej strony.',
      login: 'Zaloguj',
      profile: {
        title: 'Informacje o profilu',
        username: 'Nazwa użytkownika',
        email: 'Adres email',
        emailNote: 'Adres email nie może zostać zmieniony.',
        updateButton: 'Aktualizuj profil',
        updating: 'Aktualizowanie...',
        success: 'Profil został zaktualizowany pomyślnie',
        error: 'Nie udało się zaktualizować profilu'
      },
      password: {
        title: 'Zmień hasło',
        current: 'Aktualne hasło',
        new: 'Nowe hasło',
        confirm: 'Potwierdź nowe hasło',
        passwordNote: 'Musi mieć co najmniej 8 znaków.',
        changeButton: 'Zmień hasło',
        changing: 'Zmienianie...',
        success: 'Hasło zostało zmienione pomyślnie',
        error: 'Nie udało się zmienić hasła',
        validationError: 'Nowe hasła nie są zgodne'
      }
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