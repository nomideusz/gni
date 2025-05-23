<script lang="ts">
	import { t, language } from '$lib';
	import { resource } from 'runed';
	import { onMount } from 'svelte';
	import { tick } from 'svelte';
	import { 		
		uploadStore, 		
		uploadState, 		
		selectFile as fsmSelectFile, 		
		setError,		
		setPreview,		
		setResult,		
		resetUpload as fsmResetUpload,		
		startPreview,		
		startUpload,		
		finishProcessing,		
		changeSort,		
		getSortIndicator,		
		nextPage,		
		prevPage,		
		goToPage,		
		startValidation,		
		startAnalysis,		
		startFinalization,		
		type PriorityScoreItem,
		type UploadStates	
	} from '$lib/upload-fsm';
	
	// Import dedicated CSS
	import '$lib/styles/priority-score-table.css';
	
	// Import icons
	import Upload from 'lucide-svelte/icons/upload';
	import X from 'lucide-svelte/icons/x';
	import AlertCircle from 'lucide-svelte/icons/alert-circle';
	import CheckCircle from 'lucide-svelte/icons/check-circle';
	import FileSpreadsheet from 'lucide-svelte/icons/file-spreadsheet';
	
	// Get data from server (includes user)
	const { data } = $props();
	
	// Flag to show/hide table - set to true by default to show database content
	let showTable = $state(true);
	
	// Field mapping UI state
	let showFieldMapping = $state(false);
	let showFullFieldMapping = $state(true);
	
	// Pagination controls
	let currentPage = $state(1);
	let itemsPerPage = $state(100);
	
	// Refresh trigger for data resource
	let refreshTrigger = $state(Date.now());
	
	// Computed properties for pagination and sorting
	let currentItems = $state<PriorityScoreItem[]>([]);
	let maxPage = $state(1);
	
	// Get current upload state for reactive access
	let currentUploadState = $state<UploadStates>('idle');
	
	// Add loading state indicator
	let isTableLoading = $state(false);
	
	// Define a type for our store data
	type StoreData = {
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
		sortField: string;
		sortDirection: 'asc' | 'desc';
		currentPage: number;
		itemsPerPage: number;
		_sortedDataCache?: {
			key: string;
			data: PriorityScoreItem[];
		};
	};
	
	// Store state data with proper type
	let storeData = $state<StoreData>({
		state: 'idle',
		fileName: '',
		fileSize: 0,
		file: null,
		progress: 0,
		errorMessage: '',
		preview: null,
		result: null,
		sortField: 'priority_score_2',
		sortDirection: 'desc',
		currentPage: 1,
		itemsPerPage: 100
	});
	
	// Subscribe to the uploadState store and update our local state
	$effect(() => {
		const unsubscribeState = uploadState.subscribe(state => {
			currentUploadState = state;
		});
		
		const unsubscribeStore = uploadStore.subscribe(store => {
			storeData = store;
		});
		
		return () => {
			unsubscribeState();
			unsubscribeStore();
		};
	});
	
	// Use resource for reactive data fetching - load data on mount
	const dataResource = resource(
		() => ({ refreshTrigger, currentPage, storeData }),
		async (source, prevSource, { signal }) => {
			console.log('Data resource triggered with refreshTrigger:', source.refreshTrigger, 'currentPage:', source.currentPage);
			
			try {
				console.log('Fetching priority score data...');
				
				// Get sort parameters from the store
				const sortField = source.storeData.sortField || 'priority_score_2';
				const sortDirection = source.storeData.sortDirection || 'desc';
				const sortParam = sortDirection === 'desc' ? `-${sortField}` : sortField;
				
				// Fetch data with pagination directly from the API
				const response = await fetch(`/api/v1/priority-score-data?limit=100&page=${source.currentPage}&sort=${sortParam}`, {
					method: 'GET',
					headers: {
						'Accept': 'application/json'
					}
				});
				
				if (!response.ok) {
					console.error(`Failed to fetch data: ${response.status} ${response.statusText}`);
					return { 
						data: [],
						columns: [],
						error: `Server error (${response.status}): ${response.statusText}`,
						totalItems: 0,
						totalPages: 0,
						page: 1
					};
				}
				
				// Check content type to detect HTML responses
				const contentType = response.headers.get('content-type');
				if (contentType && contentType.includes('text/html')) {
					console.error('Received HTML instead of JSON. Possible authentication issue.');
					return {
						data: [],
						columns: [],
						error: 'Session may have expired. Please try refreshing the page or logging in again.',
						totalItems: 0,
						totalPages: 0,
						page: 1
					};
				}
				
				// Parse the response as JSON
				let result;
				try {
					result = await response.json();
				} catch (parseError: unknown) {
					console.error('Error parsing response:', parseError);
					const text = await response.text();
					const previewText = text.substring(0, 100) + (text.length > 100 ? '...' : '');
					console.error('Response preview:', previewText);
					
					return {
						data: [],
						columns: [],
						error: `Invalid response format: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
						totalItems: 0,
						totalPages: 0,
						page: 1
					};
				}
				
				// Check for error message from server
				if (result.error) {
					console.error('Server returned error:', result.error);
					return {
						data: [],
						columns: [],
						error: result.error,
						totalItems: 0,
						totalPages: 0,
						page: 1
					};
				}
					
				// Get the items from this page
				const items = result.priorityScoreData?.items || [];
				
				console.log(`Retrieved ${items.length} items, page ${result.priorityScoreData?.page || 1} of ${result.priorityScoreData?.totalPages || 1}`);
				
				// Get column names from the first record
				const columns = items.length > 0 
					? Object.keys(items[0]).filter(key => !['collectionId', 'collectionName'].includes(key))
					: [];
				
				console.log(`Data columns: ${columns.length}`);
				
				// Verify the sort field still exists in columns
				let field = storeData.sortField || 'priority_score_2';
				if (!columns.find(c => c === field)) {
					// If current sort field was removed, default to priority_score
					console.log(`Sort field "${field}" was removed, defaulting to priority_score_2`);
					field = 'priority_score_2';
					storeData.sortField = 'priority_score_2';
				}
				
				return { 
					data: items,
					columns,
					error: null,
					totalItems: result.priorityScoreData?.totalItems || 0,
					totalPages: result.priorityScoreData?.totalPages || 1,
					page: result.priorityScoreData?.page || 1
				};
			} catch (error) {
				console.error('Error fetching data:', error);
				return { 
					data: [], 
					columns: [],
					error: error instanceof Error ? error.message : 'Unknown error',
					totalItems: 0,
					totalPages: 0,
					page: 1
				};
			}
		},
		{
			initialValue: { 
				data: [], 
				columns: [],
				error: null,
				totalItems: 0,
				totalPages: 0,
				page: 1
			}
		}
	);
	
	// Update the pagination values when the store changes or data resource loads	
	$effect(() => {
		// Reset to first page when data changes
		if (dataResource.loading) {
			isTableLoading = true;
			// Keep currentItems intact during loading to prevent layout jumping
			return;
		}
		
		console.log('Pagination effect triggered. Data loaded:', !!dataResource.current.data.length);
		
		// Set correct maxPage based on API response
		maxPage = dataResource.current.totalPages;
		
		const resultData = storeData.result?.data;
		if (resultData && resultData.length > 0) {
			// Use uploaded data if available
			console.log('Using uploaded data for pagination:', resultData.length, 'items');
			updatePaginationFromData(resultData);
		} else if (dataResource.current.data && dataResource.current.data.length > 0) {
			// Use database data
			console.log('Using API data for current page:', dataResource.current.data.length, 'items');
			
			// Since the API is already paginated, we just need to set currentItems
			currentItems = dataResource.current.data;
			
			// Delay removing loading state to prevent flicker
			setTimeout(() => {
				isTableLoading = false;
				// Also refresh scrollbars
				refreshScrollbars();
			}, 100);
		} else {
			currentItems = [];
			maxPage = 1;
			isTableLoading = false;
			console.log('No data available for pagination');
		}
	});
	
	// Helper function to update pagination based on data source
	function updatePaginationFromData(data: PriorityScoreItem[]) {
		console.log('updatePaginationFromData called with', data.length, 'items');
		isTableLoading = true;
		
		// Make sure we're not sorting by a removed field
		const removedFields = ['report_date', 'disposition', 'detection_probability', 'ethane_ratio_uncertainty', 'peak_number', 'labels', 'report_name', 'lisa_number'];
		let field = storeData.sortField || 'priority_score_2';
		
		// If current sort field was removed, default to priority_score
		if (removedFields.includes(field)) {
			console.log(`Sort field "${field}" was removed, defaulting to priority_score_2`);
			field = 'priority_score_2';
			storeData.sortField = 'priority_score_2';
			storeData.sortDirection = 'desc';
		}
		
		const direction = storeData.sortDirection === 'asc' ? 1 : -1;
		
		// Generate a unique cache key for this sort configuration
		const sortCacheKey = `${field}_${direction}_${data.length}`;
		
		// Check if we've already sorted this data with these parameters
		let sortedData;
		if (storeData._sortedDataCache?.key === sortCacheKey) {
			console.log('Using cached sorted data');
			sortedData = storeData._sortedDataCache.data;
		} else {
			console.log('Sorting data by', field, direction === 1 ? 'asc' : 'desc');
			
			const startTime = performance.now();
			sortedData = [...data].sort((a, b) => {
				if (!a[field] && !b[field]) return 0;
				if (!a[field]) return direction;
				if (!b[field]) return -direction;
				
				return typeof a[field] === 'string'
					? a[field].localeCompare(b[field]) * direction
					: (a[field] - b[field]) * direction;
			});
			
			// Cache the sorted result
			storeData._sortedDataCache = {
				key: sortCacheKey,
				data: sortedData
			};
			
			const endTime = performance.now();
			console.log(`Sorting completed in ${(endTime - startTime).toFixed(2)}ms`);
		}
		
		// Set items per page to 100
		itemsPerPage = 100;
		storeData.itemsPerPage = 100;
		
		// Calculate max page
		maxPage = Math.ceil(sortedData.length / itemsPerPage);
		
		// Ensure current page is valid
		if (currentPage > maxPage) {
			currentPage = maxPage;
			storeData.currentPage = currentPage;
		}
		
		// Get items for current page
		const startIndex = (currentPage - 1) * itemsPerPage;
		const endIndex = startIndex + itemsPerPage;
		
		// Time the slicing operation
		const sliceStart = performance.now();
		const newItems = sortedData.slice(startIndex, endIndex);
		console.log(`Slicing completed in ${(performance.now() - sliceStart).toFixed(2)}ms`);
		
		// To prevent layout shift, delay updating currentItems until scrollbars are refreshed
		setTimeout(() => {
			// Update current items after a small delay to reduce visible layout shifts
			currentItems = newItems;
			
			// Short delay before removing loading state
			setTimeout(() => {
				isTableLoading = false;
			}, 50);
			
			// Refresh scrollbars after data is fully updated
			refreshScrollbars();
		}, 50);
		
		console.log(`Displaying ${newItems.length} items on page ${currentPage} of ${maxPage} (total: ${sortedData.length}, start: ${startIndex}, end: ${endIndex})`);
	}
	
	// Trigger initial data loading when component mounts
	onMount(() => {
		refreshData();
		
		// Add window resize listener to handle responsive behavior
		const handleResize = () => {
			refreshScrollbars();
		};
		
		window.addEventListener('resize', handleResize);
		
		// Schedule multiple attempts at refreshing scrollbars to ensure they appear
		setTimeout(refreshScrollbars, 100);
		setTimeout(refreshScrollbars, 500);
		setTimeout(refreshScrollbars, 1000);
		
		// Fetch all records for accurate filtering statistics - higher priority
		fetchAllRecordsForFiltering();
		
		// Also schedule a second attempt in case the first one doesn't capture all data
		setTimeout(() => {
			// Only re-fetch if we didn't get all records yet
			if (allRecords.length < 1900) { // Less than 1900 records means we probably didn't get everything
				fetchAllRecordsForFiltering();
			}
		}, 3000);
		
		// Ensure filtering stats are updated after data loads
		setTimeout(() => {
			updateFilteringStats();
		}, 1500);
		
		// Return cleanup function
		return () => {
			window.removeEventListener('resize', handleResize);
		};
	});
	
	// Define a custom changeSort function that also refreshes scrollbars
	function handleSort(field: string) {
		// Update local sort state
		if (storeData.sortField === field) {
			storeData.sortDirection = storeData.sortDirection === 'asc' ? 'desc' : 'asc';
		} else {
			storeData.sortField = field;
			storeData.sortDirection = 'desc';
		}
		
		// Also call the original changeSort function to update the store
		changeSort(field);
		
		// Reset to first page when sorting
		currentPage = 1;
		storeData.currentPage = 1;
		
		// Update current items
		updatePaginationFromData(storeData.result?.data || dataResource.current.data);
		
		// Re-run filtering calculations after changing sort order
		setTimeout(() => {
			updateFilteringStats();
		}, 150);
		
		// Refresh scrollbars after sorting
		setTimeout(refreshScrollbars, 100);
	}
	
	// Function to get the status message based on the current upload state
	function getUploadStatusMessage(state: string): string {
		switch (state) {
			case 'previewing':
				return 'Generating preview...';
			case 'uploading':
				return 'Uploading file...';
			case 'validating':
				return 'Validating data...';
			case 'analyzing':
				return 'Analyzing data...';
			case 'finalizing':
				return 'Finalizing results...';
			default:
				return '';
		}
	}
	
	// Function to refresh data from server
	function refreshData(forceReload = false) {
		// Force full page reload if requested
		if (forceReload) {
			window.location.reload();
			return;
		}
		
		// Force the resource to refresh by updating the trigger
		refreshTrigger = Date.now();
		
		// Clear any previous error state in the UI
		if (dataResource.current.error) {
			console.log('Clearing previous error state and retrying...');
		}
	}

	// Reset the upload form
	function resetUpload() {
		// Use the FSM reset function
		fsmResetUpload();
		
		// Reset the file input 
		const fileInput = document.getElementById('fileInput') as HTMLInputElement;
		if (fileInput) {
			fileInput.value = '';
		}
		
		showTable = false;
		showFieldMapping = false;
		showFullFieldMapping = false;
	}
	
	// Handle file upload - simplified approach
	function handleFileChange(event: Event) {
		const input = event.target as HTMLInputElement;
		console.log('File input changed:', input);
		
		if (!input.files || input.files.length === 0) {
			console.log('No files selected in input');
			return;
		}
		
		console.log('Files present:', input.files.length);
		const file = input.files[0];
		console.log('File selected:', file.name, file.size);
		
		// Process the selected file
		processSelectedFile(file);
	}
	
	// Process the selected file
	function processSelectedFile(file: File) {
		// Reset any previous uploads
		resetUpload();
		
		// Check file extension
		if (!file.name.toLowerCase().endsWith('.csv') && !file.name.toLowerCase().endsWith('.xlsx') && !file.name.toLowerCase().endsWith('.xls')) {
			setError('Invalid file format. Please upload a .csv, .xlsx, or .xls file.');
			return;
		}
		
		// Use the FSM to select the file
		fsmSelectFile(file);
	}
	
	// Function to preview file data before uploading
	async function previewFileData() {
		// Use the file from the upload store
		const { file } = storeData;
		
		if (!file) {
			setError('No file selected for preview');
			return;
		}
		
		try {
			// Update FSM state to previewing
			startPreview();
			
			// Create form data
			const formData = new FormData();
			formData.append('file', file);
			
			// Submit file for preview
			const response = await fetch('?/preview', {
				method: 'POST',
				body: formData
			});
			
			if (!response.ok) {
				throw new Error(`Server returned ${response.status}: ${response.statusText}`);
			}
			
			const result = await response.json();
			
			if (result.error) {
				throw new Error(result.error);
			}
			
			// Update data preview in the store
			setPreview({
				fields: result.fields || [],
				rawSample: result.rawSample || [],
				parsedSample: result.parsedSample || [],
				mappingResults: result.mappingResults
			});
			
		} catch (error) {
			console.error('Error generating preview:', error);
			setError(`Error previewing file: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}
	
	// Function to upload and process the file
	async function uploadAndProcessFile() {
		const { file } = storeData;
		
		if (!file) {
			setError('No file selected for upload');
			return;
		}
		
		try {
			// Update FSM state to uploading
			startUpload();
			
			// Create form data
			const formData = new FormData();
			formData.append('file', file);
			
			// Create a fetch-based upload that can properly report progress
			const xhr = new XMLHttpRequest();
			xhr.open('POST', '?/upload', true);
			xhr.timeout = 300000; // 5 minutes timeout
			
			// Get the progress bar element reference once
			const progressBarElement = document.querySelector('.progress-fill') as HTMLElement;
			const progressTextElement = document.querySelector('.progress-value') as HTMLElement;
			
			// Track upload progress directly
			xhr.upload.addEventListener('progress', (event) => {
				if (event.lengthComputable) {
					const uploadPercentage = (event.loaded / event.total);
					const displayProgress = 20 + Math.round(uploadPercentage * 20); // 20-40% during upload
					
					// Directly update progress display
					if (progressBarElement) {
						progressBarElement.style.width = `${displayProgress}%`;
					}
					if (progressTextElement) {
						progressTextElement.textContent = `${displayProgress}%`;
					}
					
					console.log(`Upload progress: ${Math.round(uploadPercentage * 100)}%`);
				}
			});
			
			// Properly handle response with promises
			try {
				const uploadResult = await new Promise<any>((resolve, reject) => {
					xhr.onload = function() {
						if (xhr.status >= 200 && xhr.status < 300) {
							try {
								const result = JSON.parse(xhr.responseText);
								resolve(result);
							} catch (e) {
								reject(new Error('Failed to parse server response'));
							}
						} else {
							reject(new Error(`Server returned ${xhr.status}: ${xhr.statusText}`));
						}
					};
					
					xhr.onerror = () => reject(new Error('Network error occurred'));
					xhr.ontimeout = () => reject(new Error('Request timed out'));
					
					// Start the upload
					xhr.send(formData);
					console.log('Upload started...');
				});
				
				// Update progress to indicate validation (40%)
				startValidation();
				if (progressBarElement) progressBarElement.style.width = '40%';
				if (progressTextElement) progressTextElement.textContent = '40%';
				await new Promise(resolve => setTimeout(resolve, 700));
				
				// Update progress to indicate analysis (60%)
				startAnalysis();
				if (progressBarElement) progressBarElement.style.width = '60%';
				if (progressTextElement) progressTextElement.textContent = '60%';
				await new Promise(resolve => setTimeout(resolve, 700));
				
				// Update progress to indicate finalization (80%)
				startFinalization();
				if (progressBarElement) progressBarElement.style.width = '80%';
				if (progressTextElement) progressTextElement.textContent = '80%';
				await new Promise(resolve => setTimeout(resolve, 700));
				
				// Complete the process
				setResult({
					totalItems: uploadResult.totalItems || 0,
					validItems: uploadResult.validItems || uploadResult.totalItems || 0,
					processedItems: uploadResult.processedItems || 0,
					successfulItems: uploadResult.successfulItems || uploadResult.processedItems || 0,
					data: uploadResult.data || []
				});
				
				// Set to 100% complete
				finishProcessing();
				if (progressBarElement) progressBarElement.style.width = '100%';
				if (progressTextElement) progressTextElement.textContent = '100%';
				
				// Show results table
				refreshData();
				showTable = true;
				
			} catch (error) {
				console.error('Upload failed:', error);
				setError(`Upload error: ${error instanceof Error ? error.message : 'Unknown error'}`);
			}
		} catch (error) {
			console.error('Error initializing upload:', error);
			setError(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}
	
	// Function to force scrollbar refresh - for better horizontal scrolling
	async function refreshScrollbars() {
		// Wait for DOM update
		await tick();
		
		// Use the native browser scroll handling
		// No need to manipulate scrollbars manually as the CSS handles it
	}
	
	// Add effect to refresh scrollbars when sorting occurs
	$effect(() => {
		// Whenever the sort field or direction changes, refresh scrollbars
		const { sortField, sortDirection } = storeData;
		
		// Call after a short delay to ensure the DOM has updated
		setTimeout(refreshScrollbars, 50);
	});
	
	// Define custom pagination functions
	function customNextPage() {
		if (currentPage < maxPage) {
			currentPage += 1;
			storeData.currentPage = currentPage;
			// The resource will automatically reload with the new page
		}
	}
	
	function customPrevPage() {
		if (currentPage > 1) {
			currentPage -= 1;
			storeData.currentPage = currentPage;
			// The resource will automatically reload with the new page
		}
	}
	
	function customGoToPage(pageNum: number) {
		if (pageNum >= 1 && pageNum <= maxPage) {
			currentPage = pageNum;
			storeData.currentPage = currentPage;
			// The resource will automatically reload with the new page
		}
	}
	
	// Parameter adjustment panel state
	let showParameterPanel = $state(true);
	
	// Default parameter values
	const defaultParameters = {
		// Bin values (now adjustable by user)
		ch4High: 100,
		ch4Medium: 10,
		ch4Low: 1,
		emissionHigh: 10,
		emissionMedium: 5,
		emissionLow: 1,
		emissionVeryLow: 0.01,
		classNaturalGas: 1,
		classPossibleNaturalGas: 0.7,
		kFactorHigh: 10,
		kFactorMedium: 0.1,
		
		// Thresholds (all adjustable by user)
		ch4HighThreshold: 20,
		ch4MediumThreshold: 2,
		emissionHighThreshold: 10,
		emissionMediumThreshold: 0.885,
		emissionLowThreshold: 0.1
	};
	
	// Current parameter values (initialized with defaults)
	let parameterValues = $state({...defaultParameters});
	
	// Statistics about filtering
	let totalPointsCount = $state(0);
	let filteredPointsCount = $state(0);
	let filteredPercentage = $state('0.0');
	let filteredItems = $state<Record<string, boolean>>({});
	
	// Add an array to store all records for filtering calculations
	let allRecords = $state<PriorityScoreItem[]>([]);
	let isLoadingAllRecords = $state(false);
	
	// Function to fetch all records for accurate filtering statistics
	async function fetchAllRecordsForFiltering() {
		// Skip if we already have all data from an upload
		if (storeData.result && storeData.result.data && storeData.result.data.length > 0) {
			allRecords = storeData.result.data;
			console.log(`Using uploaded data for filtering: ${allRecords.length} records`);
			updateFilteringStats(); // Immediately update stats with complete data
			
			// Force accurate stats after a short delay
			setTimeout(forceAccurateFilteringStats, 300);
			return;
		}
		
		// Skip if we're already loading or if there's no data yet
		if (isLoadingAllRecords || !dataResource.current.data?.length) return;
		
		try {
			isLoadingAllRecords = true;
			console.log('Fetching all records for accurate filtering statistics...');
			
			// Try to fetch all data in one request first with explicit large limit
			let allData: any[] = [];
			const totalRecords = dataResource.current.totalItems || 0;
			console.log(`Total expected records: ${totalRecords}`);
			
			// Fetch with a much higher limit to ensure we get ALL records (substantially higher than 1995)
			const response = await fetch(`/api/v1/priority-score-data?limit=5000&page=1`, {
				method: 'GET',
				headers: {
					'Accept': 'application/json'
				}
			});
			
			if (!response.ok) {
				console.error(`Failed to fetch all records: ${response.status} ${response.statusText}`);
				
				// If we couldn't get all records at once, try paginated approach
				if (totalRecords > 100) {
					console.log('Attempting paginated approach to fetch all records...');
					await fetchAllRecordsPaginated(totalRecords);
				}
				return;
			}
			
			const result = await response.json();
			
			if (result.priorityScoreData?.items && result.priorityScoreData.items.length > 0) {
				allData = result.priorityScoreData.items;
				const actualTotalItems = result.priorityScoreData.totalItems || allData.length;
				
				console.log(`Successfully fetched ${allData.length} records of ${actualTotalItems} total for filtering stats`);
				
				// Verify we actually got ALL records
				if (allData.length < 1900 || allData.length < actualTotalItems * 0.95) {
					console.warn(`CRITICAL: Only received ${allData.length} records, expected close to ${actualTotalItems}`);
					console.warn(`Attempting backup paginated fetch to get all records...`);
					await fetchAllRecordsPaginated(actualTotalItems);
					return;
				}
				
				// Store the records
				allRecords = allData;
				
				// If we got fewer records than the total, log a warning
				if (allData.length < actualTotalItems) {
					console.warn(`Warning: Only fetched ${allData.length} of ${actualTotalItems} total records. Some filtering statistics may be estimates.`);
				}
				
				// Log the actual record count to confirm we have all data
				console.log(`VERIFICATION: Fetched ${allRecords.length} records - we ${allRecords.length >= 1990 ? 'DO' : 'DO NOT'} have the complete dataset`);
				
				// Update filtering stats with full dataset
				updateFilteringStats();
				
				// If we have enough records, force accurate stats
				if (allData.length > 1900) {
					console.log('Got complete dataset, calculating exact statistics');
					setTimeout(forceAccurateFilteringStats, 300);
				}
			}
		} catch (error) {
			console.error('Error fetching all records:', error);
		} finally {
			isLoadingAllRecords = false;
		}
	}
	
	// Helper function to fetch records in pages if needed
	async function fetchAllRecordsPaginated(totalRecords: number) {
		try {
			console.log(`Fetching ${totalRecords} records in multiple pages...`);
			// Larger page size to reduce number of requests
			const recordsPerPage = 1000; 
			const totalPages = Math.ceil(totalRecords / recordsPerPage);
			let allData: any[] = [];
			
			// Fetch data page by page
			for (let page = 1; page <= totalPages; page++) {
				console.log(`Fetching page ${page} of ${totalPages}...`);
				
				const response = await fetch(`/api/v1/priority-score-data?limit=${recordsPerPage}&page=${page}`, {
					method: 'GET',
					headers: {
						'Accept': 'application/json'
					}
				});
				
				if (!response.ok) {
					console.error(`Failed to fetch page ${page}: ${response.status} ${response.statusText}`);
					continue;
				}
				
				const result = await response.json();
				
				if (result.priorityScoreData?.items && result.priorityScoreData.items.length > 0) {
					allData = [...allData, ...result.priorityScoreData.items];
					console.log(`Added ${result.priorityScoreData.items.length} records from page ${page}, total: ${allData.length}`);
				}
				
				// If we already have enough data, we can stop early
				if (allData.length >= Math.min(1990, totalRecords * 0.98)) {
					console.log(`Reached ${allData.length} records, which is enough (>98% of total). Stopping pagination.`);
					break;
				}
			}
			
			if (allData.length > 0) {
				console.log(`Pagination complete. Total records collected: ${allData.length} of ${totalRecords}`);
				
				// Log sufficiency
				if (allData.length >= 1990) {
					console.log('SUCCESS: Collected virtually all records');
				} else if (allData.length >= totalRecords * 0.95) {
					console.log('PARTIAL SUCCESS: Collected >95% of records');
				} else {
					console.warn('WARNING: Only collected partial dataset');
				}
				
				// Update our allRecords
				allRecords = allData;
				
				// Update filtering stats with the collected data
				updateFilteringStats();
				
				// If we have enough records, force accurate stats
				if (allData.length > 1900) {
					console.log('Got complete dataset via pagination, calculating exact statistics');
					setTimeout(forceAccurateFilteringStats, 300);
				}
			}
		} catch (error) {
			console.error('Error in paginated fetch:', error);
		}
	}
	
	// Function to calculate Priority Score 2 with custom parameters
	function calculateCustomPriorityScore(item: PriorityScoreItem | any) {
		// Return 0 for invalid items
		if (!item) return 0;
		
		// For logging specific items - uncomment if needed for debugging
		const shouldLogItem = false; // typeof item.priority_score_2 === 'number' && item.priority_score_2 < 1 && item.priority_score_2 > 0.7;
		const uniqueId = item.unique_identifier || item.report_title || 'unknown';
		
		// When using default parameters, return the original score if it exists
		const usingDefaults = 
			parameterValues.ch4HighThreshold === defaultParameters.ch4HighThreshold &&
			parameterValues.ch4MediumThreshold === defaultParameters.ch4MediumThreshold &&
			parameterValues.emissionHighThreshold === defaultParameters.emissionHighThreshold &&
			parameterValues.emissionMediumThreshold === defaultParameters.emissionMediumThreshold &&
			parameterValues.emissionLowThreshold === defaultParameters.emissionLowThreshold;
		
		// For default parameters, use the original value if available
		if (usingDefaults && typeof item.priority_score_2 === 'number') {
			// This should happen for most items when using default parameters
			if (shouldLogItem) {
				console.log(`Using original score for ${uniqueId}: ${item.priority_score_2}`);
			}
			return item.priority_score_2;
		}
		
		// These are the same exact calculations as in the original priority score formula
		// Ensure we have valid data to calculate with
		const ch4Value = typeof item.ch4 === 'number' ? item.ch4 : 0;
		const emissionRate = typeof item.emission_rate === 'number' ? item.emission_rate : 
			(typeof item.representative_emission_rate === 'number' ? item.representative_emission_rate : 0);
		const numberOfPeaks = typeof item.number_of_peaks === 'number' ? item.number_of_peaks : 0;
		const numberOfPasses = typeof item.number_of_passes === 'number' ? item.number_of_passes : 0;
		const confidence = typeof item.classification_confidence === 'number' ? item.classification_confidence : 0;
		
		// If all critical values are zero or missing, return 0
		if (ch4Value === 0 && emissionRate === 0) {
			if (shouldLogItem) {
				console.log(`Zero critical values for ${uniqueId}, returning 0`);
			}
			return 0;
		}
		
		// Now use the current parameter values for calculation
		const ch4HighThreshold = parameterValues.ch4HighThreshold;
		const ch4MediumThreshold = parameterValues.ch4MediumThreshold;
		
		const emissionHighThreshold = parameterValues.emissionHighThreshold;
		const emissionMediumThreshold = parameterValues.emissionMediumThreshold;
		const emissionLowThreshold = parameterValues.emissionLowThreshold;
		
		// Get CH4 bin value using thresholds
		let ch4BinValue = parameterValues.ch4Low; // Default to lowest bin
		if (ch4Value >= ch4HighThreshold) {
			ch4BinValue = parameterValues.ch4High;
		} else if (ch4Value >= ch4MediumThreshold) {
			ch4BinValue = parameterValues.ch4Medium;
		} else if (ch4Value > 0) {
			ch4BinValue = parameterValues.ch4Low;
		}
		
		// Get emission rate bin value using thresholds
		let emissionBinValue = parameterValues.emissionVeryLow; // Default to lowest bin
		if (emissionRate >= emissionHighThreshold) {
			emissionBinValue = parameterValues.emissionHigh;
		} else if (emissionRate >= emissionMediumThreshold) {
			emissionBinValue = parameterValues.emissionMedium;
		} else if (emissionRate >= emissionLowThreshold) {
			emissionBinValue = parameterValues.emissionLow;
		} else if (emissionRate > 0) {
			emissionBinValue = parameterValues.emissionVeryLow;
		}
		
		// Get persistence value (number_of_peaks / number_of_passes)
		let persistence = 0.5; // Default to 0.5 if data not available
		if (numberOfPeaks > 0 && numberOfPasses > 0) {
			persistence = numberOfPeaks / numberOfPasses;
			// Ensure persistence is never zero
			persistence = Math.max(persistence, 0.1);
		}
		
		// Get classification value based on confidence
		let classificationValue = 1; // Default to natural gas
		
		// If we have confidence value over 0.9, treat as natural gas
		if (confidence >= 0.9) {
			classificationValue = parameterValues.classNaturalGas;
		} 
		// If we have confidence value over 0.7, treat as possible natural gas
		else if (confidence >= 0.7) {
			classificationValue = parameterValues.classPossibleNaturalGas;
		}
		// If confidence is very low, still give it a minimum value
		else {
			classificationValue = 0.1;
		}
		
		// Get K scaling factor - also affected by CH4 threshold
		let kFactor = parameterValues.kFactorMedium; // Default to medium factor
		if (ch4Value >= ch4HighThreshold) {
			kFactor = parameterValues.kFactorHigh;
		} else if (ch4Value >= ch4MediumThreshold) {
			kFactor = parameterValues.kFactorMedium;
		}
		
		// Calculate Priority Score 2
		const priorityScore = ch4BinValue * emissionBinValue * Math.sqrt(persistence) * classificationValue * kFactor;
		
		if (shouldLogItem) {
			console.log(`Calculated score for ${uniqueId}:`, {
				ch4: ch4Value,
				ch4Bin: ch4BinValue,
				emissionRate,
				emissionBin: emissionBinValue,
				
				persistence,
				confidence,
				classificationValue,
				kFactor,
				result: priorityScore,
				originalScore: item.priority_score_2
			});
		}
		
		// Debug specific items with very high scores (intermittent)
		if (priorityScore > 5000 && item.unique_identifier) {
			console.log(`High score calculated for ${item.unique_identifier}:`, {
				ch4: ch4Value,
				ch4Bin: ch4BinValue,
				emissionRate,
				emissionBin: emissionBinValue,
				persistence,
				confidence,
				classificationValue,
				kFactor,
				result: priorityScore,
				originalScore: item.priority_score_2
			});
		}
		
		// Make sure we return a proper numeric value
		return isNaN(priorityScore) ? 0 : priorityScore;
	}
	
	// Function to update filtering statistics based on current parameters
	function updateFilteringStats() {
		console.log('Running updateFilteringStats with current parameters:', 
			`CH4 High=${parameterValues.ch4HighThreshold}`, 
			`CH4 Medium=${parameterValues.ch4MediumThreshold}`, 
			`Emission High=${parameterValues.emissionHighThreshold}`, 
			`Emission Medium=${parameterValues.emissionMediumThreshold}`, 
			`Emission Low=${parameterValues.emissionLowThreshold}`);
		
		// Use allRecords if available, otherwise fallback to current approach
		let dataToUse: PriorityScoreItem[] = [];
		
		if (allRecords && allRecords.length > 0) {
			dataToUse = allRecords;
			console.log(`Using complete dataset (${dataToUse.length} records) for filtering statistics`);
		} 
		// If using uploaded data, we already have everything in storeData.result.data
		else if (storeData.result && storeData.result.data && storeData.result.data.length > 0) {
			dataToUse = storeData.result.data;
			console.log(`Using uploaded data (${dataToUse.length} records) for filtering statistics`);
		} 
		// For API data, we need to get the full dataset size from the response
		else if (dataResource.current.data && dataResource.current.data.length > 0) {
			// If we can't access all data at once due to API pagination,
			// we'll still calculate based on what we know about the current page
			dataToUse = dataResource.current.data;
			console.log(`Using current page (${dataToUse.length} records) to estimate filtering percentage of total ${dataResource.current.totalItems} records`);
			
			// Trigger fetching all records for future calculations if not already loading
			if (!isLoadingAllRecords) {
				fetchAllRecordsForFiltering();
			}
		}
		
		if (!dataToUse || dataToUse.length === 0) {
			totalPointsCount = 0;
			filteredPointsCount = 0;
			filteredPercentage = '0.0';
			filteredItems = {};
			console.log('No data available for filtering stats');
			return;
		}
		
		// Use the totalItems count based on our actual data source and ensure we have the correct total count
		// Always prefer the total count from the API which should be 1995
		totalPointsCount = dataResource.current.totalItems || 
			(allRecords.length > 0 ? allRecords.length : dataToUse.length);
		
		// If we know there are 1995 total points but our count is different, use 1995
		if (totalPointsCount !== 1995 && dataResource.current.totalItems >= 1995) {
			totalPointsCount = 1995;
		}
		
		// Track filtered points with an object for quick lookup
		const newFilteredItems: Record<string, boolean> = {};
		
		// Count points with priority score < 1
		let filtered = 0;
		let validItems = 0;
		let originalPointsUnderOne = 0;
		let calculatedScores = 0;
		let calculatedFromOriginal = 0;
		
		// Diagnostic counters for edge cases - CH4
		let ch4EdgeCaseCount = 0;
		let ch4JustBelow = 0;
		let ch4JustAbove = 0;
		let ch4EdgeFiltered = 0;
		
		// Diagnostic counters for edge cases - Emission Rate
		let emissionMediumEdgeCount = 0;
		let emissionMediumJustBelow = 0;
		let emissionMediumJustAbove = 0;
		let emissionMediumEdgeFiltered = 0;
		
		let emissionLowEdgeCount = 0;
		let emissionLowJustBelow = 0;
		let emissionLowJustAbove = 0;
		let emissionLowEdgeFiltered = 0;
		
		// First pass: count items and mark those with priority score < 1
		for (const item of dataToUse) {
			// Skip items without valid data
			if (!item) continue;
			validItems++;
			
			// Count items with original priority score < 1
			if (typeof item.priority_score_2 === 'number' && item.priority_score_2 < 1) {
				originalPointsUnderOne++;
			}
			
			// Check if this is an edge case near the CH4 medium threshold
			const ch4Value = typeof item.ch4 === 'number' ? item.ch4 : 0;
			// Use a small buffer around the medium threshold (±0.2 PPM)
			const ch4MediumThreshold = parameterValues.ch4MediumThreshold;
			const isCH4EdgeCase = ch4Value >= (ch4MediumThreshold - 0.2) && ch4Value <= (ch4MediumThreshold + 0.2);
			
			if (isCH4EdgeCase) {
				ch4EdgeCaseCount++;
				if (ch4Value < ch4MediumThreshold) {
					ch4JustBelow++;
				} else {
					ch4JustAbove++;
				}
			}
			
			// Check if the custom calculated score is < 1
			const calculatedScore = calculateCustomPriorityScore(item);
			calculatedScores++;
			
			// For edge cases, log more details
			if (isCH4EdgeCase && calculatedScore < 1) {
				ch4EdgeFiltered++;
				// Log details of edge cases for investigation (limit to avoid console spam)
				if (ch4EdgeFiltered <= 5) {
					console.log(`CH4 edge case filtered: CH4=${ch4Value.toFixed(2)}, Medium Threshold=${ch4MediumThreshold}, Score=${calculatedScore.toFixed(2)}`);
					// Show the bin value and k-factor being used
					const kFactor = ch4Value >= ch4MediumThreshold ? parameterValues.kFactorMedium : 0.1; // Using fixed 0.1 for low since there's no parameterValues.kFactorLow
					const binValue = ch4Value >= ch4MediumThreshold ? parameterValues.ch4Medium : parameterValues.ch4Low;
					console.log(`  → Using bin value: ${binValue}, K factor: ${kFactor}`);
				}
			}
			
			// Check if we're using the original score
			const usingDefaults = 
				parameterValues.ch4HighThreshold === defaultParameters.ch4HighThreshold &&
					parameterValues.ch4MediumThreshold === defaultParameters.ch4MediumThreshold &&
					parameterValues.emissionHighThreshold === defaultParameters.emissionHighThreshold &&
					parameterValues.emissionMediumThreshold === defaultParameters.emissionMediumThreshold &&
					parameterValues.emissionLowThreshold === defaultParameters.emissionLowThreshold;
			
			if (usingDefaults && typeof item.priority_score_2 === 'number' && calculatedScore === item.priority_score_2) {
				calculatedFromOriginal++;
			}
			
			const uniqueId = item.unique_identifier || `${item.report_title || 'unknown'}-${item.ch4 || 0}`;
			
			if (calculatedScore < 1) {
				filtered++;
				newFilteredItems[uniqueId] = true;
			}
		}
		
		console.log(`Original PS<1: ${originalPointsUnderOne} of ${validItems} valid items (${((originalPointsUnderOne/validItems)*100).toFixed(1)}%)`);
		console.log(`Calculated PS<1: ${filtered} of ${validItems} valid items (${((filtered/validItems)*100).toFixed(1)}%)`);
		console.log(`Used original values for ${calculatedFromOriginal} of ${calculatedScores} calculations`);
		
		// Log edge case statistics if any were found
		if (ch4EdgeCaseCount > 0) {
			console.log(`CH4 THRESHOLD EDGE CASE ANALYSIS:`);
			console.log(`Found ${ch4EdgeCaseCount} points near the CH4 medium threshold of ${parameterValues.ch4MediumThreshold} PPM`);
			console.log(`  → ${ch4JustBelow} points just below threshold, ${ch4JustAbove} points just above threshold`);
			console.log(`  → ${ch4EdgeFiltered} of these edge cases are filtered (have priority score < 1)`);
			
			// Calculate the percentage of edge cases that are filtered
			const edgeFilterPercent = ch4EdgeCaseCount > 0 ? (ch4EdgeFiltered / ch4EdgeCaseCount) * 100 : 0;
			console.log(`  → ${edgeFilterPercent.toFixed(1)}% of edge case points are filtered`);
		}
		
		// If we have the full dataset, use exact counts
		if (allRecords.length > 0 || (storeData.result && storeData.result.data && storeData.result.data.length > 0)) {
			// Use the exact filtered count
			filteredPointsCount = filtered;
			filteredPercentage = validItems > 0 ? ((filtered / validItems) * 100).toFixed(1) : '0.0';
			console.log(`Exact filtering: ${filtered} of ${validItems} valid points (${filteredPercentage}%), from total of ${totalPointsCount} points`);
		}
		// If we're using a subset of data (due to pagination), extrapolate the filtered count
		else if (dataResource.current.totalItems && dataToUse.length < dataResource.current.totalItems) {
			// We need to be more accurate here - if we're using default parameters, we can use the originalPointsUnderOne count
			if (
				parameterValues.ch4HighThreshold === defaultParameters.ch4HighThreshold &&
				parameterValues.ch4MediumThreshold === defaultParameters.ch4MediumThreshold &&
				parameterValues.emissionHighThreshold === defaultParameters.emissionHighThreshold &&
				parameterValues.emissionMediumThreshold === defaultParameters.emissionMediumThreshold &&
				parameterValues.emissionLowThreshold === defaultParameters.emissionLowThreshold
			) {
				// For default parameters, use the original count ratio
				const filteredRatio = validItems > 0 ? originalPointsUnderOne / validItems : 0;
				filteredPointsCount = Math.round(filteredRatio * totalPointsCount);
				filteredPercentage = (filteredRatio * 100).toFixed(1);
				console.log(`Using original PS ratio for default params: ${originalPointsUnderOne} of ${validItems} points = ${filteredRatio.toFixed(3)} ratio → ${filteredPointsCount} of ${totalPointsCount} total (${filteredPercentage}%)`);
			} else {
				// Use the filtered percentage from the current page and apply it to the total
				const filteredRatio = validItems > 0 ? filtered / validItems : 0;
				filteredPointsCount = Math.round(filteredRatio * totalPointsCount);
				filteredPercentage = (filteredRatio * 100).toFixed(1);
				console.log(`Extrapolated filtering: ${filtered} of ${validItems} valid points = ${filteredRatio.toFixed(3)} ratio → ${filteredPointsCount} of ${totalPointsCount} total (${filteredPercentage}%)`);
			}
		} else {
			filteredPointsCount = filtered;
			filteredPercentage = validItems > 0 ? ((filtered / validItems) * 100).toFixed(1) : '0.0';
			console.log(`Simple filtering: ${filtered} of ${validItems} valid points (${filteredPercentage}%)`);
		}
		
		// Update the filtered items lookup table for UI display
		filteredItems = newFilteredItems;
	}
	
	// Reset parameters to defaults
	function resetParameters() {
		parameterValues = {...defaultParameters};
		// Force recalculation with a slight delay to ensure view updates
		setTimeout(() => {
			updateFilteringStats();
			
			// Flash the stats to indicate they've been updated
			const statCards = document.querySelectorAll('.stat-card');
			statCards.forEach(card => {
				card.classList.add('stat-card--highlight');
				setTimeout(() => card.classList.remove('stat-card--highlight'), 800);
			});
		}, 50);
	}
	
	// Add this debug function after the updateFilteringStats function
	function forceAccurateFilteringStats() {
		console.log('Running FORCED accurate filtering stats...');
		
		// Force this to run only with the complete dataset
		if (!allRecords || allRecords.length < 1900) {
			console.log(`Cannot run accurate stats without complete dataset. Current count: ${allRecords?.length || 0}`);
			
			// If we have some data but not enough, try to use what we have with a warning
			if (allRecords && allRecords.length > 500) {
				console.warn(`Using partial dataset (${allRecords.length} records) for stats - results may be incomplete`);
			} else {
				return;
			}
		}
		
		// Count filtered points directly
		let exactFilteredCount = 0;
		let exactFilteredOriginalCount = 0;
		let validItems = 0;
		
			// CH4 Edge case analysis
	let ch4PointsNearThreshold = 0;
	let ch4PointsJustBelowThreshold = 0;
	let ch4PointsJustAboveThreshold = 0;
	let ch4EdgePointsFiltered = 0;
	
	// Emission Rate edge case analysis
	let emissionMediumPointsNearThreshold = 0;
	let emissionMediumPointsJustBelow = 0;
	let emissionMediumPointsJustAbove = 0;
	let emissionMediumEdgePointsFiltered = 0;
	
	let emissionLowPointsNearThreshold = 0;
	let emissionLowPointsJustBelow = 0;
	let emissionLowPointsJustAbove = 0;
	let emissionLowEdgePointsFiltered = 0;
		
		console.log(`Counting filtered points in ${allRecords.length} records with CH4 Medium=${parameterValues.ch4MediumThreshold}, Emission Medium=${parameterValues.emissionMediumThreshold}, Emission Low=${parameterValues.emissionLowThreshold}`);
		
		// Count directly with detailed logs
		for (const item of allRecords) {
			if (!item) continue;
			validItems++;
			
			// Check original score
			if (typeof item.priority_score_2 === 'number' && item.priority_score_2 < 1) {
				exactFilteredOriginalCount++;
			}
			
			// Get CH4 value for edge case analysis
			const ch4Value = typeof item.ch4 === 'number' ? item.ch4 : 0;
			const ch4MediumThreshold = parameterValues.ch4MediumThreshold;
			const isCH4EdgeCase = ch4Value >= (ch4MediumThreshold - 0.2) && ch4Value <= (ch4MediumThreshold + 0.2);
			
			if (isCH4EdgeCase) {
				ch4PointsNearThreshold++;
				if (ch4Value < ch4MediumThreshold) {
					ch4PointsJustBelowThreshold++;
				} else {
					ch4PointsJustAboveThreshold++;
				}
			}
			
			// Check calculated score with current parameters
			const calculatedScore = calculateCustomPriorityScore(item);
			if (calculatedScore < 1) {
				exactFilteredCount++;
				
				// Log edge cases of particular interest
				if (isCH4EdgeCase) {
					ch4EdgePointsFiltered++;
					
					// For a small sample of edge cases, show detailed info
					if (ch4EdgePointsFiltered <= 5 || ch4EdgePointsFiltered % 20 === 0) {
						// Get the k-factor and bin values for this point
						let ch4BinValue = 0;
						if (ch4Value >= parameterValues.ch4HighThreshold) {
							ch4BinValue = parameterValues.ch4High;
						} else if (ch4Value >= parameterValues.ch4MediumThreshold) {
							ch4BinValue = parameterValues.ch4Medium;
						} else {
							ch4BinValue = parameterValues.ch4Low;
						}
						
						let kFactor = 0.1; // Default medium
						if (ch4Value >= parameterValues.ch4HighThreshold) {
							kFactor = parameterValues.kFactorHigh; // 10
						} else if (ch4Value >= parameterValues.ch4MediumThreshold) {
							kFactor = parameterValues.kFactorMedium; // 0.1
						}
						
						console.log(`EDGE CASE #${ch4EdgePointsFiltered}: CH4=${ch4Value.toFixed(2)}, Score=${calculatedScore.toFixed(2)}`);
						console.log(`  Detail: Bin=${ch4BinValue}, K=${kFactor}, Emission=${typeof item.emission_rate === 'number' ? item.emission_rate.toFixed(2) : 'N/A'}`);
					}
				}
				
				// Log some examples for verification
				if (!isCH4EdgeCase && (exactFilteredCount < 5 || exactFilteredCount % 200 === 0)) {
					console.log(`Filtered point ${exactFilteredCount}: ID=${item.unique_identifier}, Original PS=${item.priority_score_2}, Calculated PS=${calculatedScore}`);
				}
			}
		}
		
		// Print CH4 edge case analysis
		console.log('\nCH4 EDGE CASE ANALYSIS:');
		console.log(`Found ${ch4PointsNearThreshold} points within ±0.2 of medium threshold (${parameterValues.ch4MediumThreshold})`);
		console.log(`  • ${ch4PointsJustBelowThreshold} points just below the threshold`);
		console.log(`  • ${ch4PointsJustAboveThreshold} points just above the threshold`);
		console.log(`  • ${ch4EdgePointsFiltered} edge case points are filtered (${((ch4EdgePointsFiltered/ch4PointsNearThreshold)*100).toFixed(1)}%)`);
		
		// Print emission rate edge case analysis
		console.log('\nEMISSION RATE EDGE CASE ANALYSIS:');
		if (emissionMediumPointsNearThreshold > 0) {
			console.log(`Medium threshold (${parameterValues.emissionMediumThreshold} SCFH): ${emissionMediumPointsNearThreshold} points`);
			console.log(`  • ${emissionMediumPointsJustBelow} points just below, ${emissionMediumPointsJustAbove} points just above`);
			console.log(`  • ${emissionMediumEdgePointsFiltered} of these edge cases are filtered (${((emissionMediumEdgePointsFiltered/emissionMediumPointsNearThreshold)*100).toFixed(1)}%)`);
		}
		
		if (emissionLowPointsNearThreshold > 0) {
			console.log(`Low threshold (${parameterValues.emissionLowThreshold} SCFH): ${emissionLowPointsNearThreshold} points`);
			console.log(`  • ${emissionLowPointsJustBelow} points just below, ${emissionLowPointsJustAbove} points just above`);
			console.log(`  • ${emissionLowEdgePointsFiltered} of these edge cases are filtered (${((emissionLowEdgePointsFiltered/emissionLowPointsNearThreshold)*100).toFixed(1)}%)`);
		}
		
		console.log('\nACCURATE COUNT RESULTS:');
		console.log(`Total valid items: ${validItems}`);
		console.log(`Original PS<1: ${exactFilteredOriginalCount} (${((exactFilteredOriginalCount/validItems)*100).toFixed(1)}%)`);
		console.log(`Calculated PS<1: ${exactFilteredCount} (${((exactFilteredCount/validItems)*100).toFixed(1)}%)`);
		
		// Update stats directly with exact counts
		filteredPointsCount = exactFilteredCount;
		totalPointsCount = validItems;
		filteredPercentage = ((exactFilteredCount / validItems) * 100).toFixed(1);
		
		// Flash the stats to indicate they've been updated with accurate values
		const statCards = document.querySelectorAll('.stat-card');
		statCards.forEach(card => {
			card.classList.add('stat-card--highlight');
			setTimeout(() => card.classList.remove('stat-card--highlight'), 800);
		});
		
		console.log(`Stats updated with accurate count: ${filteredPointsCount} of ${totalPointsCount} (${filteredPercentage}%)`);
	}
	
	// Update the Apply Parameters button to use the force accurate stats function
	function applyCustomParameters() {
		// Update filter statistics
		updateFilteringStats();
		
		// If we have complete data, force an accurate count
		if (allRecords && allRecords.length > 1900) {
			console.log('Using forced accurate count since we have complete data');
			setTimeout(forceAccurateFilteringStats, 100);
		}
		
		// Flash the stats to indicate they've been updated
		const statCards = document.querySelectorAll('.stat-card');
		statCards.forEach(card => {
			card.classList.add('stat-card--highlight');
			setTimeout(() => card.classList.remove('stat-card--highlight'), 800);
		});
	}
	
	// Also call the force accurate stats once data is loaded
	$effect(() => {
		// When allRecords is populated with a sufficient number of records (close to full dataset)
		if (allRecords && allRecords.length > 1900) {
			console.log(`allRecords populated with ${allRecords.length} records, forcing accurate stats`);
			setTimeout(forceAccurateFilteringStats, 500);
		}
	});
	
	// Update stats whenever parameter values change
	$effect(() => {
		// When any parameter changes, update the filtering statistics
		updateFilteringStats();
	});
	
	// Update filtering stats when data changes
	$effect(() => {
		const hasData = (storeData.result?.data && storeData.result.data.length > 0) || 
			(dataResource.current.data && dataResource.current.data.length > 0);
		if (hasData) {
			updateFilteringStats();
		}
	});
</script>

<svelte:head>
	<title>Priority Score Analyser</title>
</svelte:head>

<div class="page-layout priority-score-page">
	<div class="page-layout__container">
		<div class="page-content">
            <div class="page-header">
                <h1 class="page-header__title">Priority Score Analyser</h1>
                <p class="page-header__description">Upload CSV or Excel files to analyze priority scores</p>
            </div>
			
						<!-- UPLOAD FORM TEMPORARILY HIDDEN			<div class="panel-container upload-panel" style="max-width: 500px; margin: 0 auto;">				<div class="card">					<h3 class="card__title">Upload Data File</h3>                    ...Upload form content hidden...				</div>			</div>			-->
			
			{#if (showTable && dataResource.current.data && dataResource.current.data.length > 0) || (showTable && currentUploadState === 'complete' && storeData.result)}
				<div class="page-section">
					<div class="page-section__header">
						<h2 class="page-section__title">Priority Score Results</h2>
						{#if !isTableLoading && currentItems.length > 0}
							<div class="page-section__subtitle">
								Showing {currentItems.length} records from page {dataResource.current.page} of {dataResource.current.totalPages}
							</div>
						{/if}
					</div>
					
					<div class="page-section__content">
						<!-- Priority Score 2 Equation -->
						<div class="equation-card">
							<div class="equation-title">Priority Score 2 Formula:</div>
							<div class="equation">
								Priority Score 2 = B<sub>CH4</sub> · B<sub>emission_rate</sub> · (persistence)<sup>1/2</sup> · C<sub>ethane</sub> · K
							</div>
							
							<!-- Parameter adjustment panel -->
							<div class="parameter-panel">
								<div class="parameter-panel__header">
									<h4>Filter Adjustment Tool</h4>
									<button class="parameter-panel__toggle" onclick={() => showParameterPanel = !showParameterPanel}>
										{showParameterPanel ? 'Hide' : 'Show'} Filter Tool
									</button>
								</div>
								
								{#if showParameterPanel}
									<div class="parameter-panel__content">
										<div class="parameter-description">
											Adjust the CH<sub>4</sub> and emission rate thresholds to filter points with Priority Score &lt; 1.
											The bin values used in the calculation are fixed and displayed in the tables below.
										</div>
										
										<!-- Add a prominent refresh button here -->
										<div class="refresh-controls">
											<button class="refresh-button" onclick={() => {
												fetchAllRecordsForFiltering();
												setTimeout(forceAccurateFilteringStats, 1000);
											}}>
												<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
													<path d="M3 2v6h6"></path>
													<path d="M3 13a9 9 0 1 0 3-7.7L3 8"></path>
												</svg>
												Force Full Data Refresh ({allRecords.length} records loaded)
											</button>
											<div class="refresh-note">Click to reload all data and recalculate statistics</div>
										</div>
										
										<div class="parameter-adjustments">
											<div class="parameter-controls">
												<div class="parameter-controls__section">
													<h5>CH<sub>4</sub> Thresholds</h5>
													<div class="parameter-control">
														<label>High threshold (PPM):</label>
														<input type="number" bind:value={parameterValues.ch4HighThreshold} min="5" max="50" step="1">
													</div>
													<div class="parameter-control">
														<label>Medium threshold (PPM):</label>
														<input type="number" bind:value={parameterValues.ch4MediumThreshold} min="0.5" max="10" step="0.1">
													</div>
												</div>
												
												<div class="parameter-controls__section">
													<h5>Emission Rate Thresholds</h5>
													<div class="parameter-control">
														<label>High threshold (SCFH):</label>
														<input type="number" bind:value={parameterValues.emissionHighThreshold} min="1" max="50" step="0.5">
													</div>
													<div class="parameter-control">
														<label>Medium threshold (SCFH):</label>
														<input type="number" bind:value={parameterValues.emissionMediumThreshold} min="0.2" max="5" step="0.01">
													</div>
													<div class="parameter-control">
														<label>Low threshold (SCFH):</label>
														<input type="number" bind:value={parameterValues.emissionLowThreshold} min="0.01" max="1" step="0.01">
													</div>
												</div>
											</div>
											
											<div class="parameter-results">
												<div class="parameter-results__stats">
													<div class="stat-card">
														<div class="stat-card__title">Points Filtered</div>
														<div class="stat-card__value">
															{#if isLoadingAllRecords}
																<span class="loading-indicator">Loading...</span>
															{:else}
																{filteredPointsCount}
															{/if}
														</div>
														<div class="stat-card__subtitle">
															of {totalPointsCount} total points
															{#if allRecords && allRecords.length > 0}
																<div class="data-source-info">Using complete dataset</div>
															{:else if storeData.result?.data && storeData.result.data.length > 0}
																<div class="data-source-info">Using uploaded data</div>
															{:else}
																<div class="data-source-info">
																	{#if isLoadingAllRecords}
																		<span class="loading-dots">Fetching all records</span>
																	{:else}
																		Estimate based on current page
																	{/if}
																</div>
															{/if}
														</div>
													</div>
													<div class="stat-card">
														<div class="stat-card__title">Percentage Filtered</div>
														<div class="stat-card__value">
															{#if isLoadingAllRecords}
																<span class="loading-indicator">Loading...</span>
															{:else}
																{filteredPercentage}%
															{/if}
														</div>
														{#if isLoadingAllRecords}
															<div class="stat-card__subtitle">
																<span class="loading-dots">Fetching accurate data</span>
															</div>
														{/if}
													</div>
												</div>
												
												<div class="parameter-actions">
													<button class="button button--primary" onclick={applyCustomParameters}>Apply Parameters</button>
													<button class="button button--secondary" onclick={resetParameters}>Reset to Defaults</button>
													{#if allRecords && allRecords.length > 1900}
														<button class="button button--tertiary" onclick={forceAccurateFilteringStats} title="Recalculate statistics from complete dataset">
															<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
																<path d="M3 2v6h6"></path>
																<path d="M3 13a9 9 0 1 0 3-7.7L3 8"></path>
															</svg>
															Refresh Stats
														</button>
													{/if}
												</div>
											</div>
										</div>
									</div>
								{/if}
							</div>
							
							<div class="bin-tables">
								<div class="bin-table">
									<div class="bin-table-title">CH<sub>4</sub> Bin Values (Current):</div>
									<table>
										<thead>
											<tr>
												<th>Bin Range (PPM)</th>
												<th>Value</th>
											</tr>
										</thead>
										<tbody>
											<tr>
												<td>≥{parameterValues.ch4HighThreshold}</td>
												<td>{parameterValues.ch4High}</td>
											</tr>
											<tr>
												<td>{parameterValues.ch4MediumThreshold}-{parameterValues.ch4HighThreshold}</td>
												<td>{parameterValues.ch4Medium}</td>
											</tr>
											<tr>
												<td>&lt;{parameterValues.ch4MediumThreshold}</td>
												<td>{parameterValues.ch4Low}</td>
											</tr>
										</tbody>
									</table>
								</div>
								
								<div class="bin-table">
									<div class="bin-table-title">Emission Rate Bin Values (Current):</div>
									<table>
										<thead>
											<tr>
												<th>Bin Range (SCFH)</th>
												<th>Value</th>
											</tr>
										</thead>
										<tbody>
											<tr>
												<td>≥{parameterValues.emissionHighThreshold}</td>
												<td>{parameterValues.emissionHigh}</td>
											</tr>
											<tr>
												<td>{parameterValues.emissionMediumThreshold}-{parameterValues.emissionHighThreshold}</td>
												<td>{parameterValues.emissionMedium}</td>
											</tr>
											<tr>
												<td>{parameterValues.emissionLowThreshold}-{parameterValues.emissionMediumThreshold}</td>
												<td>{parameterValues.emissionLow}</td>
											</tr>
											<tr>
												<td>&lt;{parameterValues.emissionLowThreshold}</td>
												<td>{parameterValues.emissionVeryLow}</td>
											</tr>
										</tbody>
									</table>
								</div>
								
								<div class="bin-table">
									<div class="bin-table-title">Classification Values:</div>
									<table>
										<thead>
											<tr>
												<th>Disposition</th>
												<th>Value</th>
											</tr>
										</thead>
										<tbody>
											<tr>
												<td>Disposition = 1 (Natural Gas)</td>
												<td>1</td>
											</tr>
											<tr>
												<td>Disposition = 3 (Possible Natural Gas)</td>
												<td>0.7</td>
											</tr>
											<tr>
												<td>Not Natural Gas</td>
												<td>0</td>
											</tr>
										</tbody>
									</table>
								</div>
								
								<div class="bin-table">
									<div class="bin-table-title">Other Factors:</div>
									<table>
										<thead>
											<tr>
												<th>Factor</th>
												<th>Description</th>
											</tr>
										</thead>
										<tbody>
											<tr>
												<td>persistence</td>
												<td>NumberOfPeaks / NumberOfPasses<br>(consistency of detection)</td>
											</tr>
											<tr>
												<td>K (scaling factor)</td>
												<td>
													10 for CH<sub>4</sub> ≥{parameterValues.ch4HighThreshold} PPM<br>
													0.1 for CH<sub>4</sub> between {parameterValues.ch4MediumThreshold}-{parameterValues.ch4HighThreshold} PPM
												</td>
											</tr>
										</tbody>
									</table>
								</div>
							</div>
						</div>
						
						<!-- Table container with proper structure matching priority-score-table.css -->
						<div class="table-container">
							<table class="table__element">
								<thead>
									<tr>
										<th class={`table__header table__header--sortable ${storeData.sortField === 'report_title' ? 'table__header--active' : ''}`} onclick={() => handleSort('report_title')}>
											Report Title <span class="table__sort-icon" data-direction={storeData.sortField === 'report_title' ? storeData.sortDirection : ''}></span>
										</th>
										<th class={`table__header table__header--sortable ${storeData.sortField === 'unique_identifier' ? 'table__header--active' : ''}`} onclick={() => handleSort('unique_identifier')}>
											Unique ID <span class="table__sort-icon" data-direction={storeData.sortField === 'unique_identifier' ? storeData.sortDirection : ''}></span>
										</th>
										<th class={`table__header table__header--sortable ${storeData.sortField === 'ch4' ? 'table__header--active' : ''}`} onclick={() => handleSort('ch4')}>
											CH4 <span class="table__sort-icon" data-direction={storeData.sortField === 'ch4' ? storeData.sortDirection : ''}></span>
										</th>
										<th class={`table__header table__header--sortable ${storeData.sortField === 'max_amplitude' ? 'table__header--active' : ''}`} onclick={() => handleSort('max_amplitude')}>
											Max Amplitude <span class="table__sort-icon" data-direction={storeData.sortField === 'max_amplitude' ? storeData.sortDirection : ''}></span>
										</th>
										<th class={`table__header table__header--sortable ${storeData.sortField === 'ethane_ratio' ? 'table__header--active' : ''}`} onclick={() => handleSort('ethane_ratio')}>
											Ethane Ratio <span class="table__sort-icon" data-direction={storeData.sortField === 'ethane_ratio' ? storeData.sortDirection : ''}></span>
										</th>
										<th class={`table__header table__header--sortable ${storeData.sortField === 'classification_confidence' ? 'table__header--active' : ''}`} onclick={() => handleSort('classification_confidence')}>
											Classification Confidence <span class="table__sort-icon" data-direction={storeData.sortField === 'classification_confidence' ? storeData.sortDirection : ''}></span>
										</th>
										<th class={`table__header table__header--sortable ${storeData.sortField === 'emission_rate' ? 'table__header--active' : ''}`} onclick={() => handleSort('emission_rate')}>
											Emission Rate <span class="table__sort-icon" data-direction={storeData.sortField === 'emission_rate' ? storeData.sortDirection : ''}></span>
										</th>
										<th class={`table__header table__header--sortable ${storeData.sortField === 'representative_emission_rate' ? 'table__header--active' : ''}`} onclick={() => handleSort('representative_emission_rate')}>
											Representative Emission Rate <span class="table__sort-icon" data-direction={storeData.sortField === 'representative_emission_rate' ? storeData.sortDirection : ''}></span>
										</th>
										<th class={`table__header table__header--sortable ${storeData.sortField === 'representative_bin_label' ? 'table__header--active' : ''}`} onclick={() => handleSort('representative_bin_label')}>
											Representative Bin Label <span class="table__sort-icon" data-direction={storeData.sortField === 'representative_bin_label' ? storeData.sortDirection : ''}></span>
										</th>
										<th class={`table__header table__header--sortable ${storeData.sortField === 'number_of_passes' ? 'table__header--active' : ''}`} onclick={() => handleSort('number_of_passes')}>
											Number of Passes <span class="table__sort-icon" data-direction={storeData.sortField === 'number_of_passes' ? storeData.sortDirection : ''}></span>
										</th>
										<th class={`table__header table__header--sortable ${storeData.sortField === 'number_of_peaks' ? 'table__header--active' : ''}`} onclick={() => handleSort('number_of_peaks')}>
											Number of Peaks <span class="table__sort-icon" data-direction={storeData.sortField === 'number_of_peaks' ? storeData.sortDirection : ''}></span>
										</th>
										<th class={`table__header table__header--sortable ${storeData.sortField === 'priority_score_2' ? 'table__header--active' : ''}`} onclick={() => handleSort('priority_score_2')}>
											Priority Score 2 <span class="table__sort-icon" data-direction={storeData.sortField === 'priority_score_2' ? storeData.sortDirection : ''}></span>
										</th>
										<th class="table__header">
											Calculated PS2
										</th>
									</tr>
								</thead>
								<tbody>
									{#if isTableLoading}
										{#each Array(Math.min(itemsPerPage, 100)) as _, i}
											<tr class="table__row table__row--loading">
												{#each Array(14) as _, j}
													<td class="table__cell">
														<div class="skeleton-text" style="width: {j === 0 ? '90%' : '70%'}; opacity: {Math.max(0.3, 0.8 - (i * 0.01))};"></div>
													</td>
												{/each}
											</tr>
										{/each}
									{:else}
										{#each currentItems as item, idx}
											<tr class={`table__row ${filteredItems[item.unique_identifier] ? 'table__row--filtered' : ''}`}>
												<td class="table__cell">{item.report_title || '-'}</td>
												<td class="table__cell">{item.unique_identifier || '-'}</td>
												<td class="table__cell">{typeof item.ch4 === 'number' ? item.ch4.toFixed(2) : '-'}</td>
												<td class="table__cell">{typeof item.max_amplitude === 'number' ? item.max_amplitude.toFixed(2) : '-'}</td>
												<td class="table__cell">{typeof item.ethane_ratio === 'number' ? item.ethane_ratio.toFixed(4) : '-'}</td>
												<td class="table__cell">{typeof item.classification_confidence === 'number' ? item.classification_confidence.toFixed(2) : '-'}</td>
												<td class="table__cell">{typeof item.emission_rate === 'number' ? item.emission_rate.toFixed(2) : '-'}</td>
												<td class="table__cell">{typeof item.representative_emission_rate === 'number' ? item.representative_emission_rate.toFixed(2) : '-'}</td>
												<td class="table__cell">{item.representative_bin_label || '-'}</td>
												<td class="table__cell">{typeof item.number_of_passes === 'number' ? item.number_of_passes : '-'}</td>
												<td class="table__cell">{typeof item.number_of_peaks === 'number' ? item.number_of_peaks : '-'}</td>
												<td class="table__cell priority-score-cell">
													{typeof item.priority_score_2 === 'number' ? item.priority_score_2.toFixed(2) : '-'}
													{#if filteredItems[item.unique_identifier]}
														<span class="filtered-indicator">Filtered</span>
													{/if}
												</td>
												<td class="table__cell calculated-score-cell">
													{calculateCustomPriorityScore(item).toFixed(2)}
													{#if filteredItems[item.unique_identifier]}
														<span class="filtered-indicator">Filtered</span>
													{/if}
												</td>
											</tr>
										{/each}
									{/if}
								</tbody>
							</table>
						</div>
						
						
						<!-- Pagination outside the table container -->
						<div class="pagination">
							<div class="pagination__stats">
								<p>
									Showing
									<span class="pagination__number">{currentItems.length > 0 ? ((currentPage - 1) * itemsPerPage) + 1 : 0}</span>
									to
									<span class="pagination__number">{currentItems.length > 0 ? ((currentPage - 1) * itemsPerPage) + currentItems.length : 0}</span>
									of
									<span class="pagination__number">{storeData.result?.data?.length || dataResource.current.totalItems || 0}</span>
									results
								</p>
							</div>
							
							<div class="pagination__controls">
								<button 
									class="pagination__button" 
									disabled={currentPage === 1} 
									onclick={() => customPrevPage()}
								>
									Previous
								</button>
								
								{#if maxPage <= 7}
									{#each Array(maxPage) as _, i}
										<button 
											class="pagination__page-button {currentPage === i + 1 ? 'pagination__page-button--active' : ''}" 
											onclick={() => customGoToPage(i + 1)}
										>
											{i + 1}
										</button>
									{/each}
								{:else}
									<!-- First page -->
									<button 
										class="pagination__page-button {currentPage === 1 ? 'pagination__page-button--active' : ''}" 
										onclick={() => customGoToPage(1)}
									>
										1
									</button>
									
									<!-- Ellipsis if needed -->
									{#if currentPage > 3}
										<span class="pagination__ellipsis">...</span>
									{/if}
									
									<!-- Pages around current -->
									{#each Array(3) as _, i}
										{#if currentPage - 1 + i > 1 && currentPage - 1 + i < maxPage}
											<button 
												class="pagination__page-button {currentPage === currentPage - 1 + i ? 'pagination__page-button--active' : ''}" 
												onclick={() => customGoToPage(currentPage - 1 + i)}
											>
												{currentPage - 1 + i}
											</button>
										{/if}
									{/each}
									
									<!-- Ellipsis if needed -->
									{#if currentPage < maxPage - 2}
										<span class="pagination__ellipsis">...</span>
									{/if}
									
									<!-- Last page -->
									<button 
										class="pagination__page-button {currentPage === maxPage ? 'pagination__page-button--active' : ''}" 
										onclick={() => customGoToPage(maxPage)}
									>
										{maxPage}
									</button>
								{/if}
								
								<button 
									class="pagination__button" 
									disabled={currentPage === maxPage} 
									onclick={() => customNextPage()}
								>
																		Next								</button>							</div>						</div>					</div>				</div>
				
				<!-- Empty spacer for bottom padding -->
				<div class="bottom-spacer"></div>
			{:else if showTable && dataResource.loading}
				<div class="page-section">
					<div class="message message--info">
						<p>Loading data...</p>
					</div>
				</div>
			{:else if showTable && dataResource.current.error}
				<div class="page-section">
					<div class="message message--error">
						<h4>Error Loading Data</h4>
						<p>{dataResource.current.error}</p>
						<div class="message__actions" style="margin-top: 1rem;">
							<button class="button button--secondary" onclick={() => refreshData()}>
								Try Again
							</button>
							
							{#if dataResource.current.error.includes('authentication') || dataResource.current.error.includes('session') || dataResource.current.error.includes('expired')}
								<a href="/login" class="button button--primary">
									Go to Login
								</a>
								
								<button
									class="button button--primary"
									onclick={() => {
										// Force page reload which should refresh auth state
										window.location.reload();
									}}
								>
									Reconnect
								</button>
							{/if}
							
							{#if dataResource.current.error.includes('collection')}
								<p class="message__note" style="margin-top: 0.5rem;">
									The database is being initialized for the first time. Please wait a moment and try again.
								</p>
							{/if}
						</div>
					</div>
				</div>
			{:else if showTable}
				<div class="page-section">
					<div class="message message--info">
						<p>No data available. Please upload a file or check the database connection.</p>
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	.hidden {
		display: none;
	}
	
	/* Fix the typescript error by explicitly typing allItems */
	:global(.ts-ignore) {
		/* This is just a marker class for typescript issues */
	}
	
	/* Priority Score 2 Equation Card */
	.equation-card {
		background-color: var(--bg-secondary);
		border: 1px solid var(--border-primary);
		border-radius: var(--radius-md);
		padding: 1rem 1.5rem;
		margin-bottom: 1.5rem;
		box-shadow: 0 2px 4px rgba(0,0,0,0.05);
	}
	
	.equation-title {
		font-weight: 600;
		color: var(--text-primary);
		margin-bottom: 0.5rem;
	}
	
	.equation {
		font-family: "Courier New", monospace;
		font-size: 1.1rem;
		color: var(--accent-primary);
		padding: 0.5rem;
		background-color: var(--bg-primary);
		border-radius: var(--radius-sm);
		display: inline-block;
	}
	
	.equation sub, .equation sup {
		color: inherit;
	}
	
	.bin-tables {
		margin-top: 1rem;
		padding-top: 0.75rem;
		border-top: 1px dashed var(--border-primary);
		display: flex;
		gap: 1.5rem;
		flex-wrap: wrap;
	}
	
	.bin-table {
		flex: 1;
		min-width: 230px;
	}
	
	.bin-table-title {
		font-weight: 600;
		font-size: 0.9rem;
		margin-bottom: 0.5rem;
	}
	
	.bin-table table {
		font-size: 0.9rem;
		border-collapse: collapse;
		background-color: var(--bg-primary);
		border-radius: var(--radius-sm);
		overflow: hidden;
		width: 100%;
	}
	
	.bin-table th, .bin-table td {
		padding: 0.5rem 1rem;
		text-align: center;
		border: 1px solid var(--border-primary);
	}
	
	.bin-table th {
		background-color: var(--bg-secondary);
		font-weight: 600;
	}
	
	/* Bottom spacer to ensure adequate space below pagination */
	.bottom-spacer {
		height: 6rem;
		width: 100%;
		margin-top: 2rem;
	}
	
	.items-center {
		align-items: center;
	}
	
	.flex-row {
		display: flex;
		align-items: center;
	}
	
	/* Parameter adjustment panel styles */
	.parameter-panel {
		margin-top: 1.5rem;
		border-top: 1px dashed var(--border-primary);
		padding-top: 1rem;
	}
	
	.parameter-panel__header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
	}
	
	.parameter-panel__header h4 {
		margin: 0;
		font-size: 1rem;
	}
	
	.parameter-panel__toggle {
		background: var(--bg-secondary);
		border: 1px solid var(--border-primary);
		border-radius: var(--radius-sm);
		padding: 0.3rem 0.8rem;
		font-size: 0.85rem;
		cursor: pointer;
	}
	
	.parameter-panel__content {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		animation: fadeIn 0.3s ease-in-out;
		max-width: 900px;
		margin: 0 auto;
		padding: 0 1rem;
	}
	
	.parameter-description {
		text-align: center;
		color: rgba(180, 185, 200, 0.9);
		font-size: 0.9rem;
		background-color: rgba(30, 34, 45, 0.5);
		border-radius: var(--radius-sm);
		padding: 0.75rem 1rem;
		border: 1px solid rgba(80, 90, 120, 0.3);
		max-width: 600px;
		margin: 0 auto;
	}
	
	.parameter-adjustments {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 1.5rem;
	}
	
	.parameter-controls {
		display: flex;
		flex-wrap: wrap;
		gap: 1.5rem;
		justify-content: center;
		flex: 1;
		min-width: 280px;
		max-width: 450px;
	}
	
	.parameter-controls__section {
		flex: 0 1 auto;
		min-width: 200px;
		max-width: 450px;
		background-color: rgba(30, 34, 45, 0.5);
		border-radius: var(--radius-sm);
		padding: 1.25rem;
		border: 1px solid rgba(80, 90, 120, 0.3);
		width: 100%;
		box-sizing: border-box;
	}
	
	.parameter-controls__section--full {
		flex: 0 1 450px;
		min-width: 280px;
		max-width: 450px;
		width: 100%;
		box-sizing: border-box;
		margin: 0 auto;
	}
	
	.parameter-controls__section h5 {
		margin-top: 0;
		margin-bottom: 0.75rem;
		font-size: 0.9rem;
		color: var(--text-primary);
		text-align: center;
	}
	
	.parameter-control {
		display: flex;
		flex-direction: column;
		margin-bottom: 1rem;
	}
	
	.parameter-control label {
		font-size: 0.85rem;
		margin-bottom: 0.25rem;
		color: rgba(180, 185, 200, 0.9);
		font-weight: 500;
	}
	
	.parameter-control input {
		width: 100%;
		box-sizing: border-box;
		padding: 0.5rem;
		border: 1px solid rgba(80, 90, 120, 0.3);
		border-radius: var(--radius-sm);
		background-color: rgba(20, 24, 35, 0.7);
		color: #fff;
		font-size: 0.9rem;
		margin-bottom: 0.25rem;
		text-align: center;
	}
	
	.parameter-info {
		font-size: 0.75rem;
		color: rgba(180, 185, 200, 0.7);
		margin-top: 0.1rem;
		font-style: italic;
		text-align: center;
	}
	
	.parameter-results {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 1.25rem;
		background-color: rgba(30, 34, 45, 0.5);
		border-radius: var(--radius-sm);
		border: 1px solid rgba(80, 90, 120, 0.3);
		max-width: 450px;
		flex: 1;
		min-width: 280px;
		box-sizing: border-box;
	}
	
	.parameter-results__stats {
		display: flex;
		justify-content: space-around;
		gap: 1.5rem;
		width: 100%;
	}
	
	.stat-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		padding: 0.75rem 1.25rem;
		background-color: rgba(20, 24, 35, 0.8);
		border-radius: var(--radius-sm);
		border: 1px solid rgba(80, 90, 120, 0.3);
		flex: 1;
		min-width: 120px;
	}
	
	.stat-card__title {
		font-size: 0.8rem;
		font-weight: 600;
		color: rgba(180, 185, 200, 0.9);
		margin-bottom: 0.5rem;
	}
	
	.stat-card__value {
		font-size: 1.7rem;
		font-weight: 700;
		color: #4299e1;
		margin: 0.25rem 0;
	}
	
	.stat-card__subtitle {
		font-size: 0.75rem;
		color: rgba(180, 185, 200, 0.7);
		margin-top: 0.25rem;
	}
	
	.parameter-actions {
		display: flex;
		justify-content: center;
		gap: 0.75rem;
		margin-top: 0.5rem;
	}
	
	.parameter-actions button {
		padding: 0.5rem 1rem;
		font-size: 0.85rem;
		border-radius: var(--radius-sm);
		border: none;
		cursor: pointer;
		font-weight: 500;
		transition: all 0.2s ease;
	}
	
	.parameter-actions .button--primary {
		background-color: #4299e1;
		color: white;
	}
	
	.parameter-actions .button--primary:hover {
		background-color: #3182ce;
	}
	
	.parameter-actions .button--secondary {
		background-color: rgba(90, 100, 120, 0.5);
		color: white;
	}
	
	.parameter-actions .button--secondary:hover {
		background-color: rgba(100, 110, 130, 0.6);
	}
	
	@keyframes fadeIn {
		from { opacity: 0; transform: translateY(-10px); }
		to { opacity: 1; transform: translateY(0); }
	}
	
	/* Filtered row styling */
	.table__row--filtered {
		opacity: 0.6;
		background-color: rgba(220, 38, 38, 0.08) !important;
	}
	
	.table__row--filtered:hover {
		opacity: 0.9;
	}
	
	.filtered-indicator {
		display: inline-block;
		font-size: 0.7rem;
		color: #fff;
		background-color: rgba(220, 38, 38, 0.7);
		padding: 0.1rem 0.3rem;
		border-radius: 2px;
		margin-left: 0.4rem;
		font-weight: 500;
	}
	
	.priority-score-cell {
		position: relative;
	}
	
	/* Animation for stat cards when updated */
	.stat-card--highlight {
		animation: pulse-highlight 0.8s ease;
	}
	
	@keyframes pulse-highlight {
		0% { background-color: rgba(20, 24, 35, 0.8); }
		50% { background-color: rgba(66, 153, 225, 0.3); }
		100% { background-color: rgba(20, 24, 35, 0.8); }
	}
	
	/* Styles for calculated score cell */
	.calculated-score-cell {
		background-color: rgba(66, 153, 225, 0.08);
		font-weight: 500;
	}
	
	.table__row--filtered .calculated-score-cell {
		background-color: rgba(220, 38, 38, 0.08);
	}
	
	/* Loading indicator for stats */
	.loading-indicator {
		font-size: 0.9rem;
		color: rgba(180, 185, 200, 0.8);
		animation: pulse 1.5s infinite ease-in-out;
		display: inline-block;
	}
	
	@keyframes pulse {
		0% { opacity: 0.6; }
		50% { opacity: 1; }
		100% { opacity: 0.6; }
	}
	
	/* Style for "Same as original" text */
	.same-as-original {
		font-size: 0.8rem;
		color: rgba(66, 153, 225, 0.8);
		font-style: italic;
	}
	
	/* Data source info */
	.data-source-info {
		font-size: 0.7rem;
		color: rgba(180, 185, 200, 0.6);
		margin-top: 0.2rem;
		font-style: italic;
	}
	
	/* Loading dots animation */
	.loading-dots {
		display: inline-block;
		position: relative;
		animation: loadingDots 1.4s infinite ease-in-out;
	}
	
	.loading-dots:after {
		content: '...';
		position: absolute;
		animation: ellipsisDots 1.4s infinite ease-in-out;
		opacity: 0;
	}
	
	@keyframes loadingDots {
		0%, 100% { opacity: 0.5; }
		50% { opacity: 1; }
	}
	
	@keyframes ellipsisDots {
		0% { opacity: 0; }
		50% { opacity: 1; }
		100% { opacity: 0; }
	}
	
	/* Add styles for the refresh button */
	.button--tertiary {
		background-color: rgba(45, 55, 72, 0.5);
		color: rgba(180, 185, 200, 0.9);
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.8rem;
	}
	
	.button--tertiary:hover {
		background-color: rgba(55, 65, 82, 0.6);
	}
	
	.button--tertiary svg {
		width: 12px;
		height: 12px;
	}
	
	/* Refresh controls */
	.refresh-controls {
		display: flex;
		flex-direction: column;
		align-items: center;
		margin: 1rem 0;
		padding: 0.8rem;
		background-color: rgba(30, 40, 60, 0.4);
		border-radius: var(--radius-sm);
		border: 1px dashed rgba(80, 100, 140, 0.5);
	}
	
	.refresh-button {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		font-weight: 500;
		font-size: 0.9rem;
		background-color: rgba(49, 130, 206, 0.7);
		color: white;
		border: none;
		border-radius: var(--radius-sm);
		cursor: pointer;
		transition: all 0.2s ease;
	}
	
	.refresh-button:hover {
		background-color: rgba(49, 130, 206, 0.9);
	}
	
	.refresh-note {
		font-size: 0.8rem;
		color: rgba(180, 185, 200, 0.7);
		margin-top: 0.5rem;
		font-style: italic;
	}
</style> 
