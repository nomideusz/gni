import type { PageLoad } from './$types';
import type { PriorityItem } from './priorityScoreUtils';

export const load: PageLoad = ({ data }) => {
    const priorityItems: PriorityItem[] = data.priorityScoreData?.items || [];
    
    // Calculate derived statistics
    const totalItems = priorityItems.length;
    
    // Count by status - using disposition values
    // Natural Gas (1) is considered "approved"
    const naturalGasCount = priorityItems.filter(item => 
        item.disposition === 1 || 
        item.dispositionLabel === "Natural Gas"
    ).length;
    
    // Possible Natural Gas (3) is considered "pending"
    const possibleNaturalGasCount = priorityItems.filter(item => 
        item.disposition === 3 || 
        item.dispositionLabel === "Possible Natural Gas"
    ).length;

    // Not Natural Gas (0)
    const notNaturalGasCount = priorityItems.filter(item => 
        item.disposition === 0 || 
        item.dispositionLabel === "Not Natural Gas"
    ).length;

    // Return enhanced data
    return {
        ...data,
        calculatedStats: {
            naturalGasCount,
            possibleNaturalGasCount,
            notNaturalGasCount,
            totalItems
        }
    };
}; 