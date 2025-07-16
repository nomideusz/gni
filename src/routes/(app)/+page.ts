import type { PageLoad } from './$types';

// Report interface based on the API response
export interface Report {
    id: string;
    report_name: string;
    report_title: string;
    report_date: string;
    linear_asset_covered_length: number;
    surveyor_unit_desc?: string;
    report_final: boolean | number | string;
    driving_sessions?: any[];
    has_surveys?: boolean;
    indicationsCount?: number;
    [key: string]: any; // Allow other properties
}

// Sync status interface
export interface SyncStatus {
    id: string;
    layer_id?: number;
    layer_name?: string;
    last_sync_attempt?: string;
    last_sync_success?: string;
    last_sync?: string;
    sync_status?: string;
    error_message?: string;
}

// API Response structure from the backend
export interface ApiResponseStats {
    totalReports: number;
    calculationReportsCount: number;
    reportCounts: {
        all: number;
        withSurveys: number;
        final: number;
        finalWithSurveys: number;
        draftWithSurveys: number;
    };
    totalDistance: number;
    car1Distance: number;
    car2Distance: number;
    car3Distance: number;
    car4Distance: number;
    totalDraftDistance: number;
    car1DraftDistance: number;
    car2DraftDistance: number;
    car3DraftDistance: number;
    car4DraftDistance: number;
    totalIndications: number;
    car1LisaCount: number;
    car2LisaCount: number;
    car3LisaCount: number;
    car4LisaCount: number;
    totalLisaPerKm: number;
    car1LisaPerKm: number;
    car2LisaPerKm: number;
    car3LisaPerKm: number;
    car4LisaPerKm: number;
    totalWorkHours: number;
    car1WorkHours: number;
    car2WorkHours: number;
    car3WorkHours: number;
    car4WorkHours: number;
    weeklyTargetKm?: number;
    dailyTargetKm?: number;
    weeklyProgress?: number;
    dailyProgress?: number;
    timePeriod?: string;
    [key: string]: any;
}

// Interface for the dashboard data structure that matches server response
export interface DashboardData {
    reports: Report[];
    recentReports: Report[];
    stats: {
        totalReports: number;
        finalReports: number;
        draftReports: number;
        totalDistance: number;
        car1Distance: number;
        car2Distance: number;
        car3Distance: number;
        car4Distance: number;
        totalDraftDistance: number;
        car1DraftDistance: number;
        car2DraftDistance: number;
        car3DraftDistance: number;
        car4DraftDistance: number;
        totalIndications: number;
        car1LisaCount: number;
        car2LisaCount: number;
        car3LisaCount: number;
        car4LisaCount: number;
        totalLisaPerKm: number;
        car1LisaPerKm: number;
        car2LisaPerKm: number;
        car3LisaPerKm: number;
        car4LisaPerKm: number;
        totalWorkHours: number;
        car1WorkHours: number;
        car2WorkHours: number;
        car3WorkHours: number;
        car4WorkHours: number;
        totalGaps: number;
        weeklyTargetKm?: number;
        dailyTargetKm?: number;
        weeklyProgress?: number;
        dailyProgress?: number;
        timePeriod?: string;
    } | null;
    meta: {
        page: number;
        totalPages: number;
        totalItems: number;
        perPage: number;
        calculationReportsCount?: number;
        note?: string;
    } | null;
    syncInfo: SyncStatus | null;
    error?: string;
    syncError?: string;
}

export const load: PageLoad = ({ data }) => {
    console.log('Page.ts processing data - preparing for streaming');
    
    // IMPORTANT: Return the promises directly from page.server.ts
    // Don't try to cast them to DashboardData, as they're still promises
    // In page.svelte, you'll need to use either:
    // 1. await data.dashboardData and await data.syncData, or
    // 2. Use reactive states that update when the promises resolve
    
    return {
        // Pass through the promises directly
        dashboardData: data.dashboardData,
        syncData: data.syncData
    };
} 