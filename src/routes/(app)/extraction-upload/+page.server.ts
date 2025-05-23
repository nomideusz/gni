import { redirect, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import * as XLSX from 'xlsx';
import { parse } from 'csv-parse/sync';

export const load = (async ({ locals, url }) => {
    // Check if user is authenticated
    if (!locals.user) {
        // If not authenticated, redirect to login page
        throw redirect(303, '/login');
    }
    
    // Get PocketBase instance from locals
    const pb = locals.pb;
    
    // Verify PocketBase instance is available and authenticated
    if (!pb) {
        console.error('PocketBase instance not available in locals');
        return {
            user: locals.user,
            error: 'Database connection not available'
        };
    }
    
    // Check if PocketBase is authenticated
    if (!pb.authStore.isValid) {
        console.error('PocketBase auth token is invalid or expired');
        // Attempt to refresh the token if needed (depends on your auth setup)
        
        // Return user data with error
        return {
            user: locals.user,
            error: 'Database authentication expired. Please refresh the page or log in again.'
        };
    }
    
    // Log authentication status for debugging
    console.log('PocketBase auth:', {
        isValid: pb.authStore.isValid,
        token: pb.authStore.token ? 'Present' : 'Missing',
        modelId: pb.authStore.model?.id || 'No model'
    });
    
    // Always check if the collection exists and create it if needed
    // This ensures it's available for subsequent getData requests
    try {
        await ensurePriorityScoreCollection(pb);
        console.log('Priority score collection is ready');
    } catch (collectionError) {
        console.error('Error ensuring collection exists:', collectionError);
        // Don't fail the page load if this fails - we'll try again when needed
    }
    
    // Get any query parameters for data fetching
    const limit = Number(url.searchParams.get('limit') || '100');
    const page = Number(url.searchParams.get('page') || '1');
    const sort = url.searchParams.get('sort') || '-id';
    const filter = url.searchParams.get('filter') || '';

    // Return user data and priority score data if requested
    if (url.searchParams.has('getData') && pb) {
        try {
            // Prepare query options - don't include empty filter
            const queryOptions: {
                sort: string;
                filter?: string;
            } = {
                sort
            };
            
            // Only add filter if it's not empty
            if (filter) {
                queryOptions.filter = filter;
            }
            
            console.log('Fetching priority score data with options:', JSON.stringify(queryOptions));
            
            // Try to fetch the data from PocketBase
            try {
                const result = await pb.collection('priority_score_data').getList(page, limit, queryOptions);
                
                console.log(`Successfully retrieved ${result.items.length} items from priority_score_data`);
                
                return {
                    user: locals.user,
                    priorityScoreData: {
                        items: result.items,
                        totalItems: result.totalItems,
                        totalPages: result.totalPages,
                        page: result.page
                    }
                };
            } catch (pbError: any) {
                // Handle specific PocketBase errors
                console.error('PocketBase error details:', pbError);
                
                // Check for specific error types
                if (pbError.status === 401 || pbError.status === 403) {
                    console.error('Authentication error with PocketBase:', pbError.message);
                    
                    // Special case for auth errors
                    return {
                        user: locals.user,
                        error: 'Authentication with the database failed. Please log out and back in.',
                        priorityScoreData: { items: [], totalItems: 0, totalPages: 0, page: 1 }
                    };
                }
                
                if (pbError.status === 404) {
                    console.error('Collection not found:', pbError.message);
                    
                    // Create the collection first time if needed
                    await ensurePriorityScoreCollection(pb);
                    
                    return {
                        user: locals.user,
                        error: 'Priority score collection is being set up. Please refresh.',
                        priorityScoreData: { items: [], totalItems: 0, totalPages: 0, page: 1 }
                    };
                }
                
                return {
                    user: locals.user,
                    error: `Database error: ${pbError.message || 'Unknown PocketBase error'}`,
                    priorityScoreData: { items: [], totalItems: 0, totalPages: 0, page: 1 }
                };
            }
        } catch (err) {
            console.error('Error in getData handling:', err);
            return {
                user: locals.user,
                error: 'Failed to process data request',
                priorityScoreData: { items: [], totalItems: 0, totalPages: 0, page: 1 }
            };
        }
    }
    
    // If no data requested, just return user info
    return {
        user: locals.user
    };
}) satisfies PageServerLoad;

// Define a type for priority score items
interface PriorityScoreItem {
    id?: string;
    collectionId?: string;
    collectionName?: string;
    created?: string;
    updated?: string;
    unique_identifier: string;
    customer_name?: string;
    report_name?: string;
    report_title?: string;
    report_date?: string;
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
    [key: string]: any; // Index signature to allow dynamic properties
}

// Define field mapping between Excel/CSV columns and PocketBase fields
interface FieldMapping {
    excelField: string;          // Name in Excel/CSV
    pbField: string;             // Name in PocketBase
    required: boolean;           // Is this field required?
    type: 'text' | 'number' | 'date' | 'bool'; // Data type
    defaultValue?: any;          // Default value if missing
}

// Define the field mapping configuration
const fieldMappings: FieldMapping[] = [
    { excelField: 'customer_name', pbField: 'customer_name', required: true, type: 'text', defaultValue: 'Unknown Customer' },
    { excelField: 'report_name', pbField: 'report_name', required: true, type: 'text', defaultValue: 'Unknown Report' },
    { excelField: 'unique_identifier', pbField: 'unique_identifier', required: true, type: 'text' },
    { excelField: 'report_title', pbField: 'report_title', required: false, type: 'text' },
    { excelField: 'report_date', pbField: 'report_date', required: false, type: 'date' },
    { excelField: 'emission_source_id', pbField: 'emission_source_id', required: false, type: 'text' },
    { excelField: 'lisa_wkt4326', pbField: 'lisa_wkt4326', required: false, type: 'text' },
    { excelField: 'lisa_number', pbField: 'lisa_number', required: false, type: 'number' },
    { excelField: 'report_build_number', pbField: 'report_build_number', required: false, type: 'text' },
    { excelField: 'report_asset_length_km', pbField: 'report_asset_length_km', required: false, type: 'number' },
    { excelField: 'report_percent_coverage_assets', pbField: 'report_percent_coverage_assets', required: false, type: 'number' },
    { excelField: 'asset_covered_length_km', pbField: 'asset_covered_length_km', required: false, type: 'number' },
    { excelField: 'ch4', pbField: 'ch4', required: false, type: 'number' },
    { excelField: 'classification_confidence', pbField: 'classification_confidence', required: false, type: 'number' },
    { excelField: 'disposition', pbField: 'disposition', required: false, type: 'number' },
    { excelField: 'detection_probability', pbField: 'detection_probability', required: false, type: 'number' },
    { excelField: 'emission_rate', pbField: 'emission_rate', required: false, type: 'number' },
    { excelField: 'emission_rate_a_mean', pbField: 'emission_rate_a_mean', required: false, type: 'number' },
    { excelField: 'emission_rate_a_std', pbField: 'emission_rate_a_std', required: false, type: 'number' },
    { excelField: 'emission_rate_g_mean', pbField: 'emission_rate_g_mean', required: false, type: 'number' },
    { excelField: 'emission_rate_g_std', pbField: 'emission_rate_g_std', required: false, type: 'number' },
    { excelField: 'emission_rate_lower_bound', pbField: 'emission_rate_lower_bound', required: false, type: 'number' },
    { excelField: 'emission_rate_upper_bound', pbField: 'emission_rate_upper_bound', required: false, type: 'number' },
    { excelField: 'ethane_ratio', pbField: 'ethane_ratio', required: false, type: 'number' },
    { excelField: 'ethane_ratio_uncertainty', pbField: 'ethane_ratio_uncertainty', required: false, type: 'number' },
    { excelField: 'geocode_address', pbField: 'geocode_address', required: false, type: 'text' },
    { excelField: 'gps_latitude', pbField: 'gps_latitude', required: false, type: 'number' },
    { excelField: 'gps_longitude', pbField: 'gps_longitude', required: false, type: 'number' },
    { excelField: 'is_filtered', pbField: 'is_filtered', required: false, type: 'bool' },
    { excelField: 'max_amplitude', pbField: 'max_amplitude', required: false, type: 'number' },
    { excelField: 'max_car_speed', pbField: 'max_car_speed', required: false, type: 'number' },
    { excelField: 'max_wind_speed', pbField: 'max_wind_speed', required: false, type: 'number' },
    { excelField: 'min_wind_speed', pbField: 'min_wind_speed', required: false, type: 'number' },
    { excelField: 'number_of_passes', pbField: 'number_of_passes', required: false, type: 'number' },
    { excelField: 'number_of_peaks', pbField: 'number_of_peaks', required: false, type: 'number' },
    { excelField: 'peak_number', pbField: 'peak_number', required: false, type: 'number' },
    { excelField: 'priority_score', pbField: 'priority_score', required: false, type: 'number' },
    { excelField: 'ranking_group', pbField: 'ranking_group', required: false, type: 'number' },
    { excelField: 'report_id', pbField: 'report_id', required: false, type: 'text' },
    { excelField: 'representative_peak_id', pbField: 'representative_peak_id', required: false, type: 'text' },
    { excelField: 'representative_emission_rate', pbField: 'representative_emission_rate', required: false, type: 'number' },
    { excelField: 'representative_bin_label', pbField: 'representative_bin_label', required: false, type: 'text' },
    { excelField: 'labels', pbField: 'labels', required: false, type: 'text' },
    { excelField: 'number_of_labels', pbField: 'number_of_labels', required: false, type: 'number' },
    { excelField: 'common_time_zone', pbField: 'common_time_zone', required: false, type: 'text' },
    { excelField: 'priority_score_2', pbField: 'priority_score_2', required: false, type: 'number' },
    { excelField: 'last_processed', pbField: 'last_processed', required: false, type: 'date' },
    { excelField: 'filter_status', pbField: 'filter_status', required: false, type: 'text' }
];

// Simplified field mapping function to replace the complex mapping logic
function mapRecordFields(record: any, index: number): PriorityScoreItem {
    const result: PriorityScoreItem = {
        report_name: '',
        unique_identifier: ''
    };
    
    const defaultUniqueId = `row${index}_${Date.now()}`;
    
    // Create a map of possible field name variations to standardized field names
    const fieldVariationMap: Record<string, string> = {};
    
    // Populate the variation map
    for (const mapping of fieldMappings) {
        // Add the exact field name
        fieldVariationMap[mapping.excelField.toLowerCase()] = mapping.pbField;
        
        // Add common variations
        fieldVariationMap[mapping.excelField.replace(/_/g, '').toLowerCase()] = mapping.pbField;
        fieldVariationMap[mapping.excelField.replace(/_/g, ' ').toLowerCase()] = mapping.pbField;
        
        // Add special cases for some fields
        if (mapping.excelField === 'customer_name') {
            fieldVariationMap['customer'] = mapping.pbField;
            fieldVariationMap['client'] = mapping.pbField;
            fieldVariationMap['clientname'] = mapping.pbField;
        } else if (mapping.excelField === 'report_name') {
            fieldVariationMap['report'] = mapping.pbField;
            fieldVariationMap['reportname'] = mapping.pbField;
        }
    }
    
    // Process each field in the record
    for (const [fieldName, value] of Object.entries(record)) {
        const fieldKey = fieldName.toLowerCase();
        const mappedField = fieldVariationMap[fieldKey];
        
        if (!mappedField) continue;
        
        // Find the original mapping to get type information
        const fieldMapping = fieldMappings.find(m => m.pbField === mappedField);
        if (!fieldMapping) continue;
        
        // Process based on type
        if (value !== null && value !== undefined && value !== '') {
            switch (fieldMapping.type) {
                case 'number':
                    if (typeof value === 'string' && !isNaN(Number(value))) {
                        result[mappedField] = Number(value);
                    } else if (typeof value === 'number') {
                        result[mappedField] = value;
                    }
                    break;
                case 'date':
                    const dateStr = parseDateForPocketBase(value, mappedField, 
                        fieldMapping.pbField === 'report_date' || fieldMapping.pbField === 'last_processed');
                    if (dateStr) {
                        result[mappedField] = dateStr;
                    }
                    break;
                case 'bool':
                    result[mappedField] = value === true || value === 'true' || value === 1 || value === '1';
                    break;
                case 'text':
                default:
                    result[mappedField] = String(value);
                    break;
            }
        } else if (fieldMapping.defaultValue !== undefined) {
            result[mappedField] = fieldMapping.defaultValue;
        }
    }
    
    // Generate unique identifier if missing
    if (!result.unique_identifier) {
        const reportName = result.report_name || 'Unknown';
        let idField = '';
        
        // Try to find an ID field
        for (const field in record) {
            if (field.toLowerCase().includes('id') && record[field]) {
                idField = record[field];
                break;
            }
        }
        
        result.unique_identifier = `${reportName}_${idField || defaultUniqueId}`;
    }
    
    // Set required fields if missing
    for (const mapping of fieldMappings) {
        if (mapping.required && !result[mapping.pbField] && mapping.defaultValue) {
            result[mapping.pbField] = mapping.defaultValue;
        }
    }
    
    return result;
}

// Simplify CSV parsing
function parseCSVData(csvText: string): PriorityScoreItem[] {
    try {
        const records = parse(csvText, {
            columns: true,
            skip_empty_lines: true,
            trim: true,
            cast: true,
        });

        return records.map((record: any, index: number) => mapRecordFields(record, index));
    } catch (error) {
        console.error('Error parsing CSV:', error);
        throw new Error(`Failed to parse CSV data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

// Simplify Excel parsing
function parseExcelData(buffer: ArrayBuffer): PriorityScoreItem[] {
    try {
        const workbook = XLSX.read(buffer, { 
            type: 'array',
            cellDates: false
        });

        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        const records = XLSX.utils.sheet_to_json(worksheet, { 
            raw: true,
            defval: ''
        });

        return records.map((record: any, index: number) => mapRecordFields(record, index));
    } catch (error) {
        console.error('Error parsing Excel:', error);
        throw new Error(`Failed to parse Excel data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

// Simplified collection setup
async function ensurePriorityScoreCollection(pb: any) {
    try {
        // Check if collection exists
        try {
            await pb.collections.getOne('priority_score_data');
            console.log('Priority score data collection exists');
            return true;
        } catch (err: any) {
            // Collection doesn't exist if status is 404
            if (err?.status !== 404) {
                console.log('Collection check failed with non-404 error. Assuming it exists:', err?.message);
                return true;
            }
            
            console.log('Collection does not exist, creating...');
            
            // Define the schema with essential fields
            const schema = [
                // Required fields
                { name: 'customer_name', type: 'text', required: true },
                { name: 'report_name', type: 'text', required: true },
                { name: 'unique_identifier', type: 'text', required: true },
                
                // Common data fields
                { name: 'report_title', type: 'text' },
                { name: 'report_date', type: 'date', options: { format: 'datetime' } as any },
                { name: 'emission_source_id', type: 'text' },
                { name: 'gps_latitude', type: 'number' },
                { name: 'gps_longitude', type: 'number' },
                { name: 'emission_rate', type: 'number' },
                { name: 'priority_score', type: 'number' },
                { name: 'max_amplitude', type: 'number' },
                { name: 'filter_status', type: 'select', options: { maxSelect: 1, values: ['included', 'excluded', 'pending'] } }
            ];
            
            // Add all remaining fields from fieldMappings that aren't already in the schema
            const existingFields = schema.map(f => f.name);
            for (const mapping of fieldMappings) {
                if (!existingFields.includes(mapping.pbField)) {
                    const fieldDef: any = { 
                        name: mapping.pbField, 
                        type: mapping.type === 'number' ? 'number' : 
                              mapping.type === 'date' ? 'date' : 
                              mapping.type === 'bool' ? 'bool' : 'text',
                        required: mapping.required
                    };
                    
                    if (mapping.type === 'date') {
                        fieldDef.options = { format: 'datetime' };
                    }
                    
                    schema.push(fieldDef);
                }
            }
            
            // Create the collection
            try {
                await pb.collections.create({
                    name: 'priority_score_data',
                    type: 'base',
                    listRule: '@request.auth.id != ""',
                    viewRule: '@request.auth.id != ""',
                    createRule: '@request.auth.id != ""',
                    updateRule: '@request.auth.id != ""',
                    deleteRule: '@request.auth.id != ""',
                    schema,
                    indexes: [
                        "CREATE INDEX IF NOT EXISTS idx_priority_score_unique_identifier ON priority_score_data (unique_identifier)",
                        "CREATE INDEX IF NOT EXISTS idx_priority_score_customer_name ON priority_score_data (customer_name)",
                        "CREATE INDEX IF NOT EXISTS idx_priority_score_priority_score ON priority_score_data (priority_score)"
                    ]
                });
                
                console.log('Collection created successfully');
                return true;
            } catch (createErr: any) {
                // If permission error, assume collection exists
                if (createErr?.status === 403) {
                    console.log('No permission to create collections, assuming collection exists');
                    return true;
                }
                throw createErr;
            }
        }
    } catch (error) {
        console.error('Error ensuring collection exists:', error);
        return false;
    }
}

// Simplified batch insert function
async function batchInsertData(pb: any, data: PriorityScoreItem[], batchSize = 25) {
    try {
        const totalItems = data.length;
        const batches = Math.ceil(totalItems / batchSize);
        let successfulItems = 0;

        console.log(`Starting batch insert of ${totalItems} items in ${batches} batches`);
        
        // Ensure collection exists
        await ensurePriorityScoreCollection(pb);

        // Process batches
        for (let i = 0; i < batches; i++) {
            const start = i * batchSize;
            const end = Math.min(start + batchSize, totalItems);
            const batch = data.slice(start, end);
            
            console.log(`Processing batch ${i + 1}/${batches} (items ${start + 1}-${end})`);
            
            // Process items in parallel for better performance (with limit)
            const batchPromises = batch.map(async (item) => {
                try {
                    if (!validateItem(item)) {
                        return { success: false };
                    }
                    
                    const cleanedItem = cleanItemForInsert(item);
                    
                    // Check if item exists first
                    try {
                        const existingRecord = await pb.collection('priority_score_data').getFirstListItem(
                            `unique_identifier = "${item.unique_identifier}"`
                        );
                        
                        // Update if exists
                        await pb.collection('priority_score_data').update(existingRecord.id, cleanedItem);
                    } catch (err) {
                        // Create if doesn't exist
                        await pb.collection('priority_score_data').create(cleanedItem);
                    }
                    
                    return { success: true };
                } catch (err) {
                    console.error(`Error processing item:`, err);
                    return { success: false };
                }
            });
            
            // Wait for all operations in this batch to complete
            const results = await Promise.all(batchPromises);
            const batchSuccessCount = results.filter(r => r.success).length;
            
            successfulItems += batchSuccessCount;
            console.log(`Batch ${i + 1}/${batches} complete: ${batchSuccessCount}/${batch.length} successful`);
            
            // Add a small delay between batches to avoid overwhelming the server
            if (i < batches - 1) {
                await new Promise(resolve => setTimeout(resolve, 200));
            }
        }

        return {
            success: true,
            totalItems,
            processedItems: totalItems,
            successfulItems
        };
    } catch (error) {
        console.error('Error in batch insert:', error);
        throw error;
    }
}

// Simplified item validation
function validateItem(item: PriorityScoreItem): boolean {
    // Must have required fields with reasonable values
    if (!item.customer_name || item.customer_name === 'Unknown Customer') return false;
    if (!item.report_name || item.report_name === 'Unknown Report') return false;
    if (!item.unique_identifier || item.unique_identifier.startsWith('Unknown_row')) return false;
    
    // Must have at least some non-empty fields
    return Object.values(item).some(val => 
        val !== undefined && val !== null && val !== '' && val !== 0 && val !== false
    );
}

// Simplified item cleaning
function cleanItemForInsert(item: PriorityScoreItem): Record<string, any> {
    const cleanItem: Record<string, any> = {};
    
    // Only include non-empty values
    for (const [key, value] of Object.entries(item)) {
        if (key === 'id' || key === 'collectionId' || key === 'collectionName') continue;
        if (value !== undefined && value !== null) {
            cleanItem[key] = value;
        }
    }
    
    return cleanItem;
}

export const actions = {
    upload: async ({ request, locals }) => {
        try {
            // Ensure user is authenticated
            if (!locals.user) {
                return fail(401, { error: 'Unauthorized - Please log in' });
            }

            // Get PocketBase instance
            const pb = locals.pb;
            if (!pb) {
                return fail(500, { error: 'Database connection not available' });
            }

            // Get form data
            const data = await request.formData();
            const file = data.get('file') as File;
            
            if (!file) {
                return fail(400, { error: 'No file uploaded' });
            }
            
            // Check file type
            const fileType = file.name.split('.').pop()?.toLowerCase();
            if (!fileType || !['csv', 'xlsx', 'xls'].includes(fileType)) {
                return fail(400, { error: 'Invalid file format. Please upload .csv, .xlsx, or .xls files.' });
            }
            
            // Parse file
            const buffer = await file.arrayBuffer();
            let parsedData: PriorityScoreItem[];
            
            if (fileType === 'csv') {
                const text = new TextDecoder().decode(buffer);
                parsedData = parseCSVData(text);
            } else {
                parsedData = parseExcelData(buffer);
            }
            
            // Validate data
            if (parsedData.length === 0) {
                return fail(400, { error: 'No data found in file' });
            }
            
            // Filter valid items
            const validItems = parsedData.filter(item => validateItem(item));
            if (validItems.length === 0) {
                return fail(400, { error: 'No valid data found after mapping' });
            }
            
            // Insert data
            const result = await batchInsertData(pb, validItems);
            
            return {
                success: true,
                fileName: file.name,
                totalItems: parsedData.length,
                validItems: validItems.length,
                successfulItems: result.successfulItems
            };
        } catch (error) {
            console.error('Upload error:', error);
            return fail(500, {
                error: `Failed to process file: ${error instanceof Error ? error.message : 'Unknown error'}`
            });
        }
    },
    
    preview: async ({ request, locals }) => {
        try {
            // Ensure user is authenticated
            if (!locals.user) {
                return fail(401, { error: 'Unauthorized - Please log in' });
            }

            // Get form data
            const data = await request.formData();
            const file = data.get('file') as File;
            
            if (!file) {
                return fail(400, { error: 'No file uploaded' });
            }
            
            // Check file type
            const fileType = file.name.split('.').pop()?.toLowerCase();
            if (!fileType || !['csv', 'xlsx', 'xls'].includes(fileType)) {
                return fail(400, { error: 'Invalid file format. Please upload .csv, .xlsx, or .xls files.' });
            }
            
            // Get sample data
            const buffer = await file.arrayBuffer();
            let fields: string[] = [];
            let rawSample: any[] = [];
            
            if (fileType === 'csv') {
                const text = new TextDecoder().decode(buffer);
                const records = parse(text, {
                    columns: true,
                    skip_empty_lines: true,
                    to_line: 5 // Only parse first 5 rows
                });
                
                if (records.length > 0) {
                    fields = Object.keys(records[0] as Record<string, any>);
                    rawSample = records.slice(0, 3);
                }
            } else {
                const workbook = XLSX.read(buffer, { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const records = XLSX.utils.sheet_to_json(firstSheet, { 
                    range: 0,
                    defval: ''
                });
                
                if (records.length > 0) {
                    fields = Object.keys(records[0] as Record<string, any>);
                    rawSample = records.slice(0, 3);
                }
            }
            
            if (fields.length === 0) {
                return fail(400, { error: 'No valid headers found in the file' });
            }
            
            // Map the sample records
            const parsedSample = rawSample.map((record, index) => mapRecordFields(record, index));
            
            return {
                success: true,
                fileName: file.name,
                fields: fields,
                rawSample: rawSample,
                parsedSample: parsedSample.map(item => ({
                    customer_name: item.customer_name,
                    report_name: item.report_name,
                    unique_identifier: item.unique_identifier,
                    emission_rate: item.emission_rate
                }))
            };
        } catch (error) {
            console.error('Preview error:', error);
            return fail(500, {
                error: `Failed to preview file: ${error instanceof Error ? error.message : 'Unknown error'}`
            });
        }
    }
} satisfies Actions;

// Helper function to analyze mapping results
function analyzeMappingResults(sourceFields: string[], parsedItems: PriorityScoreItem[]) {
    // Check which fields were successfully mapped
    const requiredFieldMappings = fieldMappings.filter(m => m.required);
    const importantFieldMappings = fieldMappings.filter(m => 
        ['emission_rate', 'max_amplitude', 'ch4', 'priority_score_2'].includes(m.pbField)
    );
    
    const mappingResults = {
        requiredFieldsMapped: true,
        importantFieldsMapped: true,
        missingRequiredFields: [] as string[],
        missingImportantFields: [] as string[],
        possibleMatches: {} as Record<string, string[]>
    };
    
    // Check required fields
    for (const field of requiredFieldMappings) {
        const allHaveValue = parsedItems.every(item => 
            item[field.pbField] !== undefined && 
            item[field.pbField] !== null && 
            item[field.pbField] !== ''
        );
        
        // If using default values, mark as missing
        const usingDefaults = parsedItems.every(item => 
            item[field.pbField] === field.defaultValue
        );
        
        if (!allHaveValue || usingDefaults) {
            mappingResults.requiredFieldsMapped = false;
            mappingResults.missingRequiredFields.push(field.pbField);
            
            // Suggest possible matches
            mappingResults.possibleMatches[field.pbField] = sourceFields.filter(f => 
                f.toLowerCase().includes(field.excelField.replace(/_/g, '').toLowerCase()) ||
                field.excelField.replace(/_/g, '').toLowerCase().includes(f.toLowerCase())
            );
        }
    }
    
    // Check important fields
    for (const field of importantFieldMappings) {
        const anyHasValue = parsedItems.some(item => 
            item[field.pbField] !== undefined && 
            item[field.pbField] !== null && 
            item[field.pbField] !== ''
        );
        
        if (!anyHasValue) {
            mappingResults.importantFieldsMapped = false;
            mappingResults.missingImportantFields.push(field.pbField);
            
            // Suggest possible matches
            mappingResults.possibleMatches[field.pbField] = sourceFields.filter(f => 
                f.toLowerCase().includes(field.excelField.replace(/_/g, '').toLowerCase()) ||
                field.excelField.replace(/_/g, '').toLowerCase().includes(f.toLowerCase())
            );
        }
    }
    
    return mappingResults;
}

// Simplified date parsing function
function parseDateForPocketBase(value: any, fieldName: string, prioritizeEuropeanFormat: boolean = false): string | null {
    if (!value) return null;
    
    try {
        let dateValue: Date | null = null;
        
        // Handle string dates
        if (typeof value === 'string') {
            // Try standard date parsing
            const date = new Date(value);
            if (!isNaN(date.getTime())) {
                dateValue = date;
            } 
            // Try European format (DD/MM/YYYY)
            else if (value.match(/^\d{1,2}[.\/-]\d{1,2}[.\/-]\d{4}/)) {
                const parts = value.split(/[.\/-]/);
                const day = parseInt(parts[0], 10);
                const month = parseInt(parts[1], 10) - 1;
                const year = parseInt(parts[2], 10);
                
                dateValue = new Date(year, month, day);
            }
        } 
        // Handle Excel dates (numeric)
        else if (typeof value === 'number') {
            // Excel dates are days since 1/1/1900
            if (value > 0 && value < 50000) {
                // Adjust for Excel's leap year bug
                let excelDays = value > 60 ? value - 1 : value;
                
                const msPerDay = 24 * 60 * 60 * 1000;
                const excelEpoch = new Date(1899, 11, 30);
                dateValue = new Date(excelEpoch.getTime() + excelDays * msPerDay);
            }
        }
        
        // Validate the date is reasonable
        if (dateValue && !isNaN(dateValue.getTime())) {
            const year = dateValue.getFullYear();
            if (year >= 1950 && year <= 2050) {
                // Format as YYYY-MM-DD HH:MM:SS for PocketBase
                return dateValue.toISOString().replace('T', ' ').split('.')[0];
            }
        }
        
        return null;
    } catch (error) {
        console.warn(`Error parsing date for ${fieldName}:`, error);
        return null;
    }
} 