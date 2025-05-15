<!-- DataSelector.svelte -->
<script lang="ts">
  import { dataFiles, type DataFile } from '$lib/data/testData';
  
  // Initialize with test1 as default
  let selectedFile = $state<DataFile>(dataFiles[0]);
  
  // Initialize an internal variable for tracking the selection
  let _path = $state<string>('');
  
  // Make sure _path stays in sync with selectedFile
  $effect(() => {
    _path = selectedFile.path;
  });
  
  // Define a derived value that can be accessed externally
  let selectedPath = $derived(_path);
  
  // Function to handle selection
  function selectFile(file: DataFile): void {
    selectedFile = file;
    _path = file.path;
    
    // Dispatch an event on the window object
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('pathselected', {
        detail: file.path
      }));
    }
  }
</script>

<div class="data-selector-container">
  <div class="tabs">
    {#each dataFiles as file}
      <button 
        class="tab-button" 
        class:active={selectedFile.id === file.id}
        onclick={() => selectFile(file)}
      >
        {file.name}
      </button>
    {/each}
  </div>
  <div class="selected-file-info">
    <span class="file-label">Selected file:</span>
    <span class="file-name">{selectedFile.id}</span>
    <span class="file-path">{selectedPath}</span>
  </div>
</div>

<style>
  .data-selector-container {
    display: flex;
    flex-direction: column;
    width: 100%;
    margin-bottom: 0.5rem;
  }
  
  .tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }
  
  .tab-button {
    padding: 0.4rem 0.75rem;
    border: none;
    border-radius: 0.3rem;
    background-color: #2a2a3c;
    color: #cbd5e1;
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s ease;
    border: 1px solid #3a3a4f;
  }
  
  .tab-button:hover {
    background-color: #313147;
  }
  
  .tab-button.active {
    background-color: #2563eb;
    color: #e2e8f0;
    font-weight: 500;
  }
  
  .selected-file-info {
    margin-top: 0.5rem;
    font-size: 0.75rem;
    color: #94a3b8;
  }
  
  .file-label {
    font-weight: 500;
    color: #cbd5e1;
  }
  
  .file-name {
    font-family: monospace;
    margin-left: 0.25rem;
    color: #7dd3fc;
  }
  
  .file-path {
    font-family: monospace;
    margin-left: 0.25rem;
  }
</style> 