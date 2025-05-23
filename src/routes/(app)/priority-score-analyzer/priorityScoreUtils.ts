// Define type for priority items
export type PriorityItem = {
    id: string;
    report_title?: string;
    unique_identifier?: string;
    report_date?: string;
    ch4?: number;
    max_amplitude?: number;
    ethane_ratio?: number;
    classification_confidence?: number;
    detection_probability?: number;
    emission_rate?: number;
    representative_emission_rate?: number;
    representative_bin_label?: string;
    number_of_passes?: number;
    number_of_peaks?: number;
    priority_score_2?: number;
    disposition?: number | string;
    dispositionLabel?: string;
    isFiltered?: boolean;
};

/**
 * Calculate Priority Score 2 using the formula:
 * Priority Score 2 = BCH4 · Bemission_rate · (detection_probability)^1/2 · Cethane · K
 * 
 * @param item PriorityItem containing all required parameters
 * @returns Calculated Priority Score 2
 */
export function calculatePS2(item: PriorityItem): number {
    // Get BCH4 value based on max_amplitude
    const bch4 = calculateBCH4(item.max_amplitude);
    
    // Get Bemission value based on emission_rate
    const bemission = calculateBemission(item.emission_rate);
    
    // Calculate square root of detection_probability (persistence)
    const detectionProbabilityRoot = item.detection_probability 
        ? Math.sqrt(item.detection_probability) 
        : 0;
    
    // Get classification value (Cethane)
    const cethane = getClassificationValue(item.disposition);
    
    // Calculate Priority Score 2
    const priorityScore = bch4 * bemission * detectionProbabilityRoot * cethane;
    
    // Apply scaling factor to match database values (100x instead of 1000x)
    return priorityScore;
}

/**
 * Calculate BCH4 value based on max_amplitude
 * @param maxAmplitude CH4 max amplitude in PPM
 * @returns BCH4 value
 */
function calculateBCH4(maxAmplitude: number | undefined | null): number {
    if (maxAmplitude === undefined || maxAmplitude === null) return 0;
    
    if (maxAmplitude >= 20) return 1000;
    if (maxAmplitude >= 2) return 1000;
    return 1;
}

/**
 * Calculate Bemission value based on emission_rate
 * @param emissionRate Emission rate in SCFH
 * @returns Bemission value
 */
function calculateBemission(emissionRate: number | undefined | null): number {
    if (emissionRate === undefined || emissionRate === null) return 0;
    
    if (emissionRate >= 10) return 10;
    if (emissionRate >= 0.885) return 5;
    if (emissionRate >= 0.1) return 1;
    return 0.01;
}

/**
 * Get classification value based on disposition
 * @param disposition Disposition code (1, 3, or 0)
 * @returns Classification value
 */
function getClassificationValue(disposition: number | string | undefined | null): number {
    if (disposition === undefined || disposition === null) return 0;
    
    // Convert string to number if needed
    const dispCode = typeof disposition === 'string' 
        ? parseInt(disposition, 10) 
        : disposition;
    
    switch (dispCode) {
        case 1: return 1;      // Natural Gas
        case 3: return 0.7;    // Possible Natural Gas
        case 0: return 0;      // Not Natural Gas
        default: return 0;
    }
}