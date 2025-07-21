<script lang="ts">
	// Props interface
	interface Props {
		reportFilter?: string;
		searchQuery?: string;
		includeSurveysOnly?: boolean;
		finalReports?: number;
		totalReports?: number;
		draftReports?: number;
		finalAndDraftReports?: number;
		onFilterChange?: () => void;
		onSurveyFilterChange?: () => void;
	}

	let { 
		reportFilter = $bindable('final'),
		searchQuery = $bindable(''),
		includeSurveysOnly = $bindable(true),
		finalReports = 0,
		totalReports = 0,
		draftReports = 0,
		finalAndDraftReports = 0,
		onFilterChange,
		onSurveyFilterChange
	}: Props = $props();

	function handleFilterChange() {
		if (onFilterChange) {
			onFilterChange();
		}
	}

	function handleSurveyFilterChange() {
		if (onSurveyFilterChange) {
			onSurveyFilterChange();
		}
	}
</script>

<div class="filter-controls">
	<div class="filter-row">
		<div class="filter-item filter-item--radio-group">
			<span class="filter-group-label">Report Type:</span>
			<div class="radio-group">
				<label class="radio-option">
					<input 
						type="radio" 
						name="reportFilter" 
						value="final" 
						bind:group={reportFilter}
						onchange={handleFilterChange}
					>
					<span class="radio-indicator"></span>
					<span class="radio-label">Final Reports Only</span>
					<span class="radio-count">({finalReports})</span>
				</label>
				
				<label class="radio-option">
					<input 
						type="radio" 
						name="reportFilter" 
						value="all" 
						bind:group={reportFilter}
						onchange={handleFilterChange}
					>
					<span class="radio-indicator"></span>
					<span class="radio-label">All Reports</span>
					<span class="radio-count">({totalReports})</span>
				</label>
				
				<label class="radio-option">
					<input 
						type="radio" 
						name="reportFilter" 
						value="draft" 
						bind:group={reportFilter}
						onchange={handleFilterChange}
					>
					<span class="radio-indicator"></span>
					<span class="radio-label">Draft Reports Only</span>
					<span class="radio-count">({draftReports})</span>
				</label>
				
				<label class="radio-option">
					<input 
						type="radio" 
						name="reportFilter" 
						value="final-and-draft" 
						bind:group={reportFilter}
						onchange={handleFilterChange}
					>
					<span class="radio-indicator"></span>
					<span class="radio-label">Final & Draft (Deletable)</span>
					<span class="radio-count">({finalAndDraftReports})</span>
				</label>
			</div>
		</div>
		
		<div class="filter-item">
			<label class="search-label" for="search-input">Search Reports:</label>
			<input 
				id="search-input"
				type="text" 
				class="search-input"
				placeholder="Search by name, title, unit, or date..."
				bind:value={searchQuery}
				oninput={handleFilterChange}
			>
		</div>
		
		<div class="filter-item">
			<label class="toggle-label">
				<input 
					type="checkbox" 
					class="toggle-checkbox"
					bind:checked={includeSurveysOnly}
					onchange={handleSurveyFilterChange}
				>
				<span class="toggle-slider"></span>
				<span class="toggle-text">Reports with surveys only</span>
			</label>
		</div>
	</div>
</div>

<style>
	/* Filter Controls */
	.filter-controls {
		background: var(--bg-secondary);
		border: 1px solid var(--border-primary);
		border-radius: 6px;
		padding: 1rem;
		margin-bottom: 1.5rem;
	}

	.filter-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 2rem;
		flex-wrap: wrap;
	}

	.filter-item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.filter-item--radio-group {
		flex-direction: column;
		align-items: flex-start;
		gap: 0.5rem;
	}

	.filter-group-label {
		font-size: 0.9rem;
		font-weight: 500;
		color: var(--text-primary);
	}

	.radio-group {
		display: flex;
		align-items: center;
		gap: 1.5rem;
		flex-wrap: wrap;
	}

	.radio-option {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
		user-select: none;
		position: relative;
	}

	.radio-option input {
		position: absolute;
		opacity: 0;
		width: 0;
		height: 0;
	}

	.radio-indicator {
		width: 16px;
		height: 16px;
		border: 2px solid var(--border-primary);
		border-radius: 50%;
		background: white;
		transition: all 0.2s ease;
		flex-shrink: 0;
	}

	.radio-option input:checked + .radio-indicator {
		border-color: var(--accent-primary);
		background: var(--accent-primary);
		box-shadow: inset 0 0 0 3px white;
	}

	.radio-option:hover .radio-indicator {
		border-color: var(--accent-primary);
	}

	.radio-label {
		font-size: 0.85rem;
		font-weight: 500;
		color: var(--text-primary);
		white-space: nowrap;
	}

	.radio-count {
		font-size: 0.7rem;
		color: var(--text-secondary);
		font-style: italic;
	}

	.radio-option input:checked + .radio-indicator + .radio-label {
		color: var(--accent-primary);
	}

	.radio-option input:checked + .radio-indicator + .radio-label + .radio-count {
		color: var(--accent-primary);
	}

	/* Search Input */
	.search-label {
		font-size: 0.9rem;
		font-weight: 500;
		color: var(--text-primary);
		white-space: nowrap;
	}

	.search-input {
		width: 300px;
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--border-primary);
		border-radius: 4px;
		background: var(--bg-primary);
		color: var(--text-primary);
		font-size: 0.85rem;
		transition: border-color 0.2s ease, box-shadow 0.2s ease;
	}

	.search-input:focus {
		outline: none;
		border-color: var(--accent-primary);
		box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.2);
	}

	.search-input::placeholder {
		color: var(--text-secondary);
		opacity: 0.7;
	}

	/* Toggle Switch */
	.toggle-label {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		cursor: pointer;
		user-select: none;
		font-size: 0.9rem;
		color: var(--text-primary);
	}

	.toggle-checkbox {
		position: absolute;
		opacity: 0;
		width: 0;
		height: 0;
	}

	.toggle-slider {
		position: relative;
		display: inline-block;
		width: 44px;
		height: 24px;
		background-color: var(--border-primary);
		border-radius: 24px;
		transition: background-color 0.2s ease;
		flex-shrink: 0;
	}

	.toggle-slider:before {
		position: absolute;
		content: "";
		height: 18px;
		width: 18px;
		left: 3px;
		bottom: 3px;
		background-color: white;
		border-radius: 50%;
		transition: transform 0.2s ease;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
	}

	.toggle-checkbox:checked + .toggle-slider {
		background-color: var(--accent-primary);
	}

	.toggle-checkbox:checked + .toggle-slider:before {
		transform: translateX(20px);
	}

	.toggle-text {
		font-weight: 500;
		white-space: nowrap;
	}

	/* Responsive adjustments */
	@media (max-width: 768px) {
		.filter-row {
			flex-direction: column;
			align-items: stretch;
			gap: 1rem;
		}

		.filter-item {
			justify-content: space-between;
		}

		.filter-item--radio-group {
			align-items: stretch;
		}

		.radio-group {
			justify-content: space-between;
			gap: 1rem;
		}

		.search-input {
			width: 100%;
		}
	}
</style> 