import { Context } from "runed";
import type { Language } from './i18n';
import { language as languageStore } from './i18n';

// Create language context
export const languageContext = new Context<Language>("language");

// Helper functions to switch language
export function switchLanguage(newLang: Language): void {
  languageStore.set(newLang);
  if (typeof window !== 'undefined') {
    localStorage.setItem('language', newLang);
  }
}

export function toggleLanguage(): void {
  languageStore.update(current => {
    const newLang = current === 'en' ? 'pl' : 'en';
    if (typeof window !== 'undefined') {
      localStorage.setItem('language', newLang);
    }
    return newLang;
  });
} 