<!-- StatsDisplaySmooth.svelte -->
<script lang="ts">
    let { calculatedStats }: {
      calculatedStats: {
        naturalGasCount: number;
        possibleNaturalGasCount: number;
        notNaturalGasCount: number;
        totalItems: number;
        emissionRateStats: {
          total: number;
          average: number;
          min: number;
          max: number;
          count: number;
        };
      }
    } = $props();
  
    // Use $state instead of tweened stores
    let naturalGas = $state(0);
    let possibleNaturalGas = $state(0);
    let notNaturalGas = $state(0);
    let total = $state(0);
    
    let emissionTotal = $state(0);
    let emissionAvg = $state(0);
    let emissionMin = $state(0);
    let emissionMax = $state(0);
    let emissionCount = $state(0);
    
    // Track loading state
    let isLoaded = $state(false);
    
    // Update values when props change
    $effect(() => {
      if (calculatedStats) {
        naturalGas = calculatedStats.naturalGasCount;
        possibleNaturalGas = calculatedStats.possibleNaturalGasCount;
        notNaturalGas = calculatedStats.notNaturalGasCount;
        total = calculatedStats.totalItems;
        
        emissionTotal = calculatedStats.emissionRateStats.total;
        emissionAvg = calculatedStats.emissionRateStats.average;
        emissionMin = calculatedStats.emissionRateStats.min;
        emissionMax = calculatedStats.emissionRateStats.max;
        emissionCount = calculatedStats.emissionRateStats.count;
        
        isLoaded = true;
      }
    });
  
    // Format numbers with commas and fixed decimal places
    function formatNumber(num: number, decimals: number = 0): string {
      return Math.round(num).toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      });
    }
  
    // Format SCFH values
    function formatSCFH(num: number): string {
      return num.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
    }
  </script>
  
  <div class="stats-container">
    <div class="stats-grid">
      <!-- Disposition Stats -->
      <div class="stat-card">
        <h3>Detection Summary</h3>
        <div class="stat-row">
          <span class="stat-label">Natural Gas:</span>
          <span class="stat-value" class:loading={!isLoaded}>
            {formatNumber(naturalGas)}
          </span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Possible Natural Gas:</span>
          <span class="stat-value" class:loading={!isLoaded}>
            {formatNumber(possibleNaturalGas)}
          </span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Not Natural Gas:</span>
          <span class="stat-value" class:loading={!isLoaded}>
            {formatNumber(notNaturalGas)}
          </span>
        </div>
        <div class="stat-row total">
          <span class="stat-label">Total Items:</span>
          <span class="stat-value" class:loading={!isLoaded}>
            {formatNumber(total)}
          </span>
        </div>
      </div>
  
      <!-- Emission Rate Stats -->
      <div class="stat-card">
        <h3>Representative Emission Rate (SCFH)</h3>
        <div class="stat-row">
          <span class="stat-label">Total:</span>
          <span class="stat-value" class:loading={!isLoaded}>
            {formatSCFH(emissionTotal)}
          </span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Average:</span>
          <span class="stat-value" class:loading={!isLoaded}>
            {formatSCFH(emissionAvg)}
          </span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Minimum:</span>
          <span class="stat-value" class:loading={!isLoaded}>
            {formatSCFH(emissionMin)}
          </span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Maximum:</span>
          <span class="stat-value" class:loading={!isLoaded}>
            {formatSCFH(emissionMax)}
          </span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Items with data:</span>
          <span class="stat-value" class:loading={!isLoaded}>
            {formatNumber(emissionCount)}
          </span>
        </div>
      </div>
    </div>
  </div>
  
  <style>
    /* Container styling */
    .stats-container {
      padding: 1rem;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    }
  
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 1.5rem;
      max-width: 1200px;
      margin: 0 auto;
    }
  
    .stat-card {
      background: #ffffff;
      border: 1px solid #e1e4e8;
      border-radius: 12px;
      padding: 1.75rem;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
      transition: box-shadow 0.2s ease;
    }
  
    .stat-card:hover {
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
    }
  
    .stat-card h3 {
      margin: 0 0 1.25rem 0;
      font-size: 1.125rem;
      font-weight: 600;
      color: #24292e;
    }
  
    /* Key anti-flicker techniques */
    .stat-row {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 1rem;
      align-items: center;
      padding: 0.625rem 0;
      border-bottom: 1px solid #e1e4e8;
    }
  
    .stat-row:last-child {
      border-bottom: none;
    }
  
    .stat-row.total {
      margin-top: 0.75rem;
      padding-top: 1rem;
      border-top: 2px solid #d1d5da;
      border-bottom: none;
    }
  
    .stat-label {
      color: #586069;
      font-size: 0.875rem;
      font-weight: 500;
    }
  
    .stat-row.total .stat-label {
      font-weight: 600;
      color: #24292e;
    }
  
    /* Critical anti-flicker styling for right-aligned values */
    .stat-value {
      /* Fixed minimum width prevents layout shifts */
      min-width: 140px;
      
      /* Right alignment */
      text-align: right;
      
      /* Monospace font ensures consistent digit widths */
      font-family: 'SF Mono', 'Monaco', 'Cascadia Code', 'Roboto Mono', 'Consolas', 'Courier New', monospace;
      
      /* Tabular numbers for consistent width */
      font-variant-numeric: tabular-nums;
      
      /* Prevent text selection during updates */
      user-select: none;
      
      /* Font size and weight */
      font-size: 1rem;
      font-weight: 600;
      color: #24292e;
      
      /* Smooth color transitions if values change state */
      transition: color 0.2s ease, opacity 0.2s ease;
      
      /* Prevent layout shifts with proper line height */
      line-height: 1.5;
      
      /* GPU acceleration hint for smooth animations */
      will-change: contents;
    }
  
    .stat-row.total .stat-value {
      font-size: 1.125rem;
      color: #0366d6;
    }
  
    /* Loading state */
    .stat-value.loading {
      opacity: 0.3;
      color: #959da5;
    }
  
    /* Responsive adjustments */
    @media (max-width: 768px) {
      .stats-grid {
        grid-template-columns: 1fr;
      }
      
      .stat-card {
        padding: 1.5rem;
      }
      
      .stat-value {
        min-width: 100px;
        font-size: 0.9375rem;
      }
      
      .stat-row.total .stat-value {
        font-size: 1rem;
      }
    }
  
    /* High contrast mode support */
    @media (prefers-contrast: high) {
      .stat-card {
        border-width: 2px;
        background: #ffffff;
      }
      
      .stat-value {
        font-weight: 700;
      }
    }
  
    /* Reduced motion support */
    @media (prefers-reduced-motion: reduce) {
      .stat-value {
        transition: none;
        will-change: auto;
      }
      
      .stat-card {
        transition: none;
      }
    }
  
    /* Dark mode support */
    @media (prefers-color-scheme: dark) {
      .stats-container {
        background: #0d1117;
      }
      
      .stat-card {
        background: #161b22;
        border-color: #30363d;
      }
      
      .stat-card h3 {
        color: #f0f6fc;
      }
      
      .stat-label {
        color: #8b949e;
      }
      
      .stat-value {
        color: #f0f6fc;
      }
      
      .stat-row.total .stat-value {
        color: #58a6ff;
      }
      
      .stat-row {
        border-bottom-color: #30363d;
      }
      
      .stat-row.total {
        border-top-color: #30363d;
      }
    }
  </style>