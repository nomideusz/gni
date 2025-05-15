import PocketBase from 'pocketbase';
import type { RecordModel } from 'pocketbase';
import { browser } from '$app/environment';
import { writable } from 'svelte/store';

// Get PocketBase URL from environment variables
// For client-side, this is made available through Vite's define in vite.config.ts
const POCKETBASE_URL = process.env.POCKETBASE_URL || 'https://xeon.pl';

// Create PocketBase client instance
// We'll use a different approach for client vs server
export const pb = browser 
  ? new PocketBase(POCKETBASE_URL)
  : null; // On server, we'll use the instance from locals

// In Svelte 5 Runes mode, we don't need to use a writable store
// The currentUser will be defined directly in components using $state()
// This is just the initial value
export const initialUserValue = browser ? pb?.authStore.record : null;

// Create a writable store for currentUser
export const currentUser = writable(initialUserValue);

// We'll pass this function to components to update user state when auth changes
export function setupAuthListener(setCurrentUser: (user: any) => void) {
  if (browser && pb) {
    pb.authStore.onChange(() => {
      setCurrentUser(pb.authStore.record);
      currentUser.set(pb.authStore.record);
    });
    return () => {
      // Return cleanup function
      pb.authStore.onChange(() => {});
    };
  }
  return () => {};
}

// ========= Gas Reports API =========

// Define the type for gas reports
export interface GasReport extends RecordModel {
  report_name: string;
  report_title: string;
  report_date: string;
  labels: string[];
  dist_mains_covered: number;
  report_final: number;
}

// API functions for gas reports with better error handling
export const gasReportsApi = {
  /**
   * Get all gas reports
   * @param sortField Optional field to sort by (default: -report_date)
   * @returns Promise with array of gas reports
   */
  getAll: async (sortField: string = '-report_date'): Promise<GasReport[]> => {
    if (!browser || !pb) {
      console.warn('PocketBase client not available');
      return [];
    }
    
    try {
      return await pb.collection('gas_reports').getFullList<GasReport>({
        sort: sortField,
      });
    } catch (error) {
      console.error('Error fetching gas reports:', error);
      throw error;
    }
  },

  /**
   * Get a single gas report by ID
   * @param id Gas report ID
   * @returns Promise with the gas report
   */
  getById: async (id: string): Promise<GasReport | null> => {
    if (!browser || !pb) {
      console.warn('PocketBase client not available');
      return null;
    }
    
    try {
      return await pb.collection('gas_reports').getOne<GasReport>(id);
    } catch (error) {
      console.error(`Error fetching gas report with ID ${id}:`, error);
      throw error;
    }
  },

  /**
   * Get filtered gas reports
   * @param filter Filter query
   * @param page Page number (default: 1)
   * @param perPage Items per page (default: 50)
   * @returns Promise with paginated gas reports
   */
  getFiltered: async (filter: string, page: number = 1, perPage: number = 50) => {
    if (!browser || !pb) {
      console.warn('PocketBase client not available');
      return { items: [], totalItems: 0, totalPages: 0, page };
    }
    
    try {
      return await pb.collection('gas_reports').getList<GasReport>(page, perPage, {
        filter,
      });
    } catch (error) {
      console.error('Error fetching filtered gas reports:', error);
      throw error;
    }
  }
};

// Format date for display
export function formatDate(dateString: string): string {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString();
} 