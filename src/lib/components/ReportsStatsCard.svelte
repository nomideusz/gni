<script lang="ts">
	interface Props {
		finalReports?: number;
		draftReports?: number;
		totalCoverage?: number;
		totalLISAs?: number;
		totalGaps?: number;
		car1Distance?: number;
		car2Distance?: number;
		car3Distance?: number;
	}

	let { 
		finalReports = 0, 
		draftReports = 0, 
		totalCoverage = 0, 
		totalLISAs = 0, 
		totalGaps = 0,
		car1Distance = 0,
		car2Distance = 0,
		car3Distance = 0
	}: Props = $props();
</script>

<div class="stats-row">
	<!-- Reports -->
	<div class="stats-card">
		<div class="stats-card__header">Reports</div>
		<div class="stats-card__body">
			<div class="stats-card__item">
				<span class="stats-card__value">{finalReports}</span>
				<span class="stats-card__label">Final</span>
			</div>
			<div class="stats-card__divider"></div>
			<div class="stats-card__item stats-card__item--dimmed">
				<span class="stats-card__value">{draftReports}</span>
				<span class="stats-card__label">Draft</span>
			</div>
		</div>
	</div>

	<!-- Assets -->
	<div class="stats-card">
		<div class="stats-card__header">Assets (Final)</div>
		<div class="stats-card__body">
			<div class="stats-card__item">
				<span class="stats-card__value">{totalCoverage.toFixed(1)}<small>%</small></span>
				<span class="stats-card__label">Coverage</span>
			</div>
			<div class="stats-card__divider"></div>
			<div class="stats-card__item">
				<span class="stats-card__value">{totalLISAs}</span>
				<span class="stats-card__label">LISAs</span>
			</div>
			<div class="stats-card__divider"></div>
			<div class="stats-card__item">
				<span class="stats-card__value">{totalGaps}</span>
				<span class="stats-card__label">Gaps</span>
			</div>
		</div>
	</div>

	<!-- Vehicles -->
	<div class="stats-card">
		<div class="stats-card__header">Vehicles (Final km)</div>
		<div class="stats-card__body">
			{#each [
				{ label: '#1', dist: car1Distance },
				{ label: '#2', dist: car2Distance },
				{ label: '#3', dist: car3Distance },
			] as car, i}
				{#if i > 0}<div class="stats-card__divider"></div>{/if}
				<div class="stats-card__item">
					<span class="stats-card__value">{car.dist.toFixed(1)}</span>
					<span class="stats-card__label">Car {car.label}</span>
				</div>
			{/each}
		</div>
	</div>
</div>

<style>
	.stats-row {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
		gap: 0.75rem;
		margin-bottom: 1.5rem;
	}

	.stats-card {
		background: var(--bg-card, #161825);
		border: 1px solid var(--border-primary, #22253a);
		border-radius: 10px;
		overflow: hidden;
	}

	.stats-card__header {
		padding: 0.6rem 1rem;
		font-size: 0.65rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--accent-primary, #2dd4bf);
		border-bottom: 1px solid var(--border-primary, #22253a);
		background: rgba(var(--accent-primary-rgb), 0.03);
	}

	.stats-card__body {
		display: flex;
		align-items: center;
		padding: 0.875rem 1rem;
		gap: 0;
	}

	.stats-card__item {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.15rem;
	}

	.stats-card__item--dimmed {
		opacity: 0.5;
	}

	.stats-card__value {
		font-size: 1.25rem;
		font-weight: 700;
		color: var(--text-primary, #eef0f6);
		line-height: 1;
		font-variant-numeric: tabular-nums;
	}

	.stats-card__value small {
		font-size: 0.7em;
		font-weight: 400;
		color: var(--text-secondary, #8b8fa6);
	}

	.stats-card__label {
		font-size: 0.6rem;
		font-weight: 500;
		color: var(--text-secondary, #8b8fa6);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.stats-card__divider {
		width: 1px;
		height: 28px;
		background: var(--border-primary, #22253a);
		flex-shrink: 0;
	}
</style>
