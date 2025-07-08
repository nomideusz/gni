import { Context } from 'runed';
import { writable, type Writable } from 'svelte/store';
import { language, type Language } from './i18n';

// Create a writable store for language
export const languageStore: Writable<Language> = writable('en');

// Language context using the store
export const languageContext = new Context<typeof languageStore>("language");

// Function to switch language and update the store - simplified for English only
export function switchLanguage(lang: Language) {
    // Always set to English since we only support English now
    language.set('en');
    languageStore.set('en');
}

// Subscribe to the language store to keep it synced with the language value
language.subscribe(value => {
    languageStore.set(value);
});

// Create navigation context and store
export interface NavigationState {
    pathname: string;
    isNavigating: boolean;
    shouldShowLoader: boolean;
}

export const navigationStore: Writable<NavigationState> = writable({ 
    pathname: '/',
    isNavigating: false,
    shouldShowLoader: false
});

export const navigationContext = new Context<typeof navigationStore>("navigation"); 