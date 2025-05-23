import { FiniteStateMachine, Context } from 'runed';
import { get, readable, writable } from 'svelte/store';

// Define the upload state types
export type UploadStates = 
  | 'idle' 
  | 'fileSelected' 
  | 'previewing' 
  | 'uploading' 
  | 'validating'
  | 'analyzing'
  | 'finalizing'
  | 'complete' 
  | 'error';

// Define progress mapping for each state
export const STATE_PROGRESS: Record<UploadStates, number> = {
  'idle': 0,
  'fileSelected': 0,
  'previewing': 10,
  'uploading': 20,
  'validating': 40,
  'analyzing': 60,
  'finalizing': 80,
  'complete': 100,
  'error': 0
};

export type UploadEvents = 
  | 'selectFile' 
  | 'preview' 
  | 'upload' 
  | 'processComplete' 
  | 'validate'
  | 'analyze'
  | 'finalize'
  | 'error' 
  | 'reset';

// Define the structure for an item in the priority score table
export interface PriorityScoreItem {
  id?: string;
  unique_identifier: string;
  report_title?: string;
  ch4?: number;
  classification_confidence?: number;
  emission_rate?: number;
  ethane_ratio?: number; 
  max_amplitude?: number;
  number_of_passes?: number;
  number_of_peaks?: number;
  representative_emission_rate?: number;
  representative_bin_label?: string;
  priority_score_2?: number;
  [key: string]: any;
}

// Create a writable store to hold upload data
export const uploadStore = writable<{
  state: UploadStates;
  fileName: string;
  fileSize: number;
  file: File | null;
  progress: number;
  errorMessage: string;
  preview: {
    fields: string[];
    rawSample: any[];
    parsedSample: any[];
    mappingResults?: {
      requiredFieldsMapped: boolean;
      importantFieldsMapped: boolean;
      missingRequiredFields: string[];
      missingImportantFields: string[];
      possibleMatches: Record<string, string[]>;
    };
  } | null;
  result: {
    totalItems: number;
    validItems: number;
    processedItems: number;
    successfulItems: number;
    data: PriorityScoreItem[];
  } | null;
  // Sort and pagination state
  sortField: string;
  sortDirection: 'asc' | 'desc';
  currentPage: number;
  itemsPerPage: number;
}>({
  state: 'idle',
  fileName: '',
  fileSize: 0,
  file: null,
  progress: 0,
  errorMessage: '',
  preview: null,
  result: null,
  // Default sort and pagination values
  sortField: 'priority_score_2',
  sortDirection: 'desc',
  currentPage: 1,
  itemsPerPage: 10
});

// Context definition for upload state
export const uploadContext = new Context<typeof uploadStore>("upload");

// Define the state machine with transitions - without automatic progress updates
export const uploadFSM = new FiniteStateMachine<UploadStates, UploadEvents>('idle', {
  idle: {
    selectFile: 'fileSelected',
    _enter: () => {
      // Reset the upload store when entering idle state
      uploadStore.update(store => ({
        ...store,
        state: 'idle',
        fileName: '',
        fileSize: 0,
        file: null,
        progress: STATE_PROGRESS.idle,
        errorMessage: '',
        preview: null,
        result: null
      }));
    }
  },
  fileSelected: {
    preview: 'previewing',
    upload: 'uploading',
    reset: 'idle',
    error: 'error'
  },
  previewing: {
    upload: 'uploading',
    error: 'error',
    reset: 'idle'
  },
  uploading: {
    validate: 'validating',
    error: 'error',
    reset: 'idle'
  },
  validating: {
    analyze: 'analyzing',
    error: 'error',
    reset: 'idle'
  },
  analyzing: {
    finalize: 'finalizing',
    error: 'error',
    reset: 'idle'
  },
  finalizing: {
    processComplete: 'complete',
    error: 'error',
    reset: 'idle'
  },
  complete: {
    reset: 'idle'
  },
  error: {
    reset: 'idle',
    selectFile: 'fileSelected'
  }
});

// Create a writable store to track FSM state changes
const uploadStateStore = writable<UploadStates>(uploadFSM.current);

// Store the original send method
const originalSend = uploadFSM.send;

// Override the send method to update the state and progress in the store
uploadFSM.send = function(event: UploadEvents, ...args: unknown[]) {
  // Keep track of the current state before transition
  const previousState = uploadFSM.current;
  
  // Call the original method to perform the transition
  const result = originalSend.call(this, event, ...args);
  
  // After transition, update the store with new state
  uploadStateStore.set(uploadFSM.current);
  
  // Update both state and progress based on the current state
  if (previousState !== uploadFSM.current) {
    console.log(`FSM State transition: ${previousState} -> ${uploadFSM.current}`);
    
    // Update both state and progress in the store
    uploadStore.update(store => ({
      ...store,
      state: uploadFSM.current,
      progress: STATE_PROGRESS[uploadFSM.current]
    }));
    
    console.log(`Progress updated to: ${STATE_PROGRESS[uploadFSM.current]}%`);
  }
  
  return result;
};

// Export a readable version of the store for components
export const uploadState = readable<UploadStates>(uploadFSM.current, (set) => {
  const unsubscribe = uploadStateStore.subscribe((state) => {
    console.log('Upload state changed to:', state);
    set(state);
  });
  
  return unsubscribe;
});

// Helper functions for common operations
export function selectFile(file: File) {
  uploadStore.update(store => ({
    ...store,
    fileName: file.name,
    fileSize: file.size,
    file: file,
    progress: STATE_PROGRESS.fileSelected
  }));
  uploadFSM.send('selectFile');
}

export function setError(message: string) {
  uploadStore.update(store => ({
    ...store,
    errorMessage: message
  }));
  uploadFSM.send('error');
}

export function setPreview(previewData: any) {
  uploadStore.update(store => ({
    ...store,
    preview: previewData
  }));
}

export function setResult(resultData: any) {
  uploadStore.update(store => ({
    ...store,
    result: {
      ...resultData,
      data: resultData.data || [] // Ensure data property exists
    }
  }));
  uploadFSM.send('processComplete');
}

export function resetUpload() {
  uploadFSM.send('reset');
}

export function startPreview() {
  uploadFSM.send('preview');
}

export function startUpload() {
  uploadFSM.send('upload');
}

export function finishProcessing() {
  uploadFSM.send('processComplete');
}

// Table sorting and pagination functions
export function changeSort(field: string) {
  uploadStore.update(store => {
    // If sorting by the same field, toggle direction
    const direction = store.sortField === field && store.sortDirection === 'desc' ? 'asc' : 'desc';
    return {
      ...store,
      sortField: field,
      sortDirection: direction,
      currentPage: 1 // Reset to first page on sort change
    };
  });
}

export function getSortIndicator(field: string): string {
  const store = get(uploadStore);
  if (store.sortField !== field) return '';
  return store.sortDirection === 'asc' ? '↑' : '↓';
}

export function nextPage() {
  uploadStore.update(store => {
    if (!store.result || !store.result.data) return store;
    
    const maxPage = Math.ceil(store.result.data.length / store.itemsPerPage);
    if (store.currentPage < maxPage) {
      return { ...store, currentPage: store.currentPage + 1 };
    }
    return store;
  });
}

export function prevPage() {
  uploadStore.update(store => {
    if (store.currentPage > 1) {
      return { ...store, currentPage: store.currentPage - 1 };
    }
    return store;
  });
}

export function goToPage(page: number) {
  uploadStore.update(store => {
    if (!store.result || !store.result.data) return store;
    
    const maxPage = Math.ceil(store.result.data.length / store.itemsPerPage);
    if (page >= 1 && page <= maxPage) {
      return { ...store, currentPage: page };
    }
    return store;
  });
}

export function setItemsPerPage(count: number) {
  uploadStore.update(store => {
    return { ...store, itemsPerPage: count, currentPage: 1 };
  });
}

// Helper functions for the more granular states
export function startValidation() {
  uploadFSM.send('validate');
}

export function startAnalysis() {
  uploadFSM.send('analyze');
}

export function startFinalization() {
  uploadFSM.send('finalize');
} 