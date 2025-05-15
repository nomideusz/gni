<!-- 
  TestDriveVisualization.svelte
  Wizualizacja danych z przejazdu testowego przy użyciu Svelte 5 (Runes mode)
-->
<script>
    // Import Svelte 5 API w trybie Runes
    import { createRender } from 'svelte';
    import { onMount } from 'svelte';
    
    // Importy dla wykresów
    import {
      LineChart, Line, XAxis, YAxis, CartesianGrid, 
      Tooltip, Legend, ResponsiveContainer, ScatterChart, Scatter, ZAxis
    } from 'recharts';
    
    // Runes - reaktywne zmienne
    let data = $state([]);
    let loading = $state(true);
    let selectedTab = $state('timeSeriesCharts');
    let timeRange = $state([0, 100]); // Procentowy zakres danych do wyświetlenia
    
    // Obliczane wartości
    $derived(filteredData = data.filter((item, index) => {
      const percent = (index / data.length) * 100;
      return percent >= timeRange[0] && percent <= timeRange[1];
    }));
    
    // Formatowanie czasu
    function formatTime(time) {
      const minutes = Math.floor(time / 60);
      const seconds = Math.floor(time % 60);
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
  
    // Obsługa zmiany zakresu czasu
    function handleRangeChange(e, index) {
      const newRange = [...timeRange];
      newRange[index] = parseInt(e.target.value, 10);
      timeRange = newRange;
    }
    
    // Wczytanie danych
    onMount(async () => {
      try {
        // Wczytanie pliku
        const fileContent = await fetch('/path/to/SurveyExport_12.05.25 test nr 1_RFADS2215_12-05-2025-07-57-07_C_Analytics.dat')
          .then(response => response.text());
        
        // Przetworzenie danych
        const lines = fileContent.split('\n');
        const headers = lines[0].trim().split(/\s+/);
        
        const parsedData = [];
        const startTime = parseFloat(lines[1].trim().split(/\s+/)[0]);
        
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (line) {
            const values = line.split(/\s+/);
            const row = {};
            
            for (let j = 0; j < headers.length; j++) {
              row[headers[j]] = parseFloat(values[j]);
            }
            
            // Dodajemy czas względny w sekundach od początku pomiaru
            row.relativeTime = row.EPOCH_TIME - startTime;
            
            parsedData.push(row);
          }
        }
        
        data = parsedData;
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        loading = false;
      }
    });
    
    // Obliczenie statystyk
    $derived(stats = {
      CH4: data.length ? {
        min: Math.min(...data.map(d => d.CH4)),
        max: Math.max(...data.map(d => d.CH4)),
        avg: data.reduce((sum, d) => sum + d.CH4, 0) / data.length
      } : {},
      C2H6: data.length ? {
        min: Math.min(...data.map(d => d.C2H6)),
        max: Math.max(...data.map(d => d.C2H6)),
        avg: data.reduce((sum, d) => sum + d.C2H6, 0) / data.length
      } : {},
      CAR_SPEED: data.length ? {
        min: Math.min(...data.map(d => d.CAR_SPEED)),
        max: Math.max(...data.map(d => d.CAR_SPEED)),
        avg: data.reduce((sum, d) => sum + d.CAR_SPEED, 0) / data.length
      } : {},
      measurement: data.length ? {
        duration: data[data.length-1].EPOCH_TIME - data[0].EPOCH_TIME,
        count: data.length,
        frequency: data.length / (data[data.length-1].EPOCH_TIME - data[0].EPOCH_TIME)
      } : {}
    });
  </script>
  
  <div class="p-4 bg-gray-50 min-h-screen">
    <h1 class="text-2xl font-bold mb-4 text-center">Wizualizacja danych z przejazdu testowego</h1>
    
    <!-- Panel kontrolny -->
    <div class="mb-6 bg-white p-4 rounded shadow">
      <h2 class="text-lg font-semibold mb-2">Panel kontrolny</h2>
      
      <div class="flex mb-4">
        <button 
          class="mr-2 px-4 py-2 rounded {selectedTab === 'timeSeriesCharts' ? 'bg-blue-500 text-white' : 'bg-gray-200'}"
          on:click={() => selectedTab = 'timeSeriesCharts'}
        >
          Wykresy czasowe
        </button>
        <button 
          class="mr-2 px-4 py-2 rounded {selectedTab === 'gpsMap' ? 'bg-blue-500 text-white' : 'bg-gray-200'}"
          on:click={() => selectedTab = 'gpsMap'}
        >
          Mapa GPS
        </button>
        <button 
          class="px-4 py-2 rounded {selectedTab === 'correlationCharts' ? 'bg-blue-500 text-white' : 'bg-gray-200'}"
          on:click={() => selectedTab = 'correlationCharts'}
        >
          Korelacje
        </button>
      </div>
      
      <div class="mb-2">
        <label class="block text-sm font-medium mb-1">Zakres czasu:</label>
        <div class="flex items-center">
          <input 
            type="range" 
            min="0" 
            max="100" 
            value={timeRange[0]} 
            on:input={(e) => handleRangeChange(e, 0)}
            class="w-1/2 mr-2"
          />
          <input 
            type="range" 
            min="0" 
            max="100" 
            value={timeRange[1]} 
            on:input={(e) => handleRangeChange(e, 1)}
            class="w-1/2"
          />
        </div>
        <div class="flex justify-between text-xs text-gray-500">
          <span>Zakres: {timeRange[0]}% - {timeRange[1]}%</span>
          <span>Liczba punktów: {filteredData.length}</span>
        </div>
      </div>
    </div>
    
    <!-- Loading state -->
    {#if loading}
      <div class="flex items-center justify-center h-64">
        <p class="text-lg">Wczytywanie danych...</p>
      </div>
    {:else}
      <!-- Zawartość zakładek -->
      <div class="bg-white p-4 rounded shadow">
        {#if selectedTab === 'timeSeriesCharts'}
          <div>
            <h2 class="text-lg font-semibold mb-4">Wykresy pomiarów w czasie</h2>
            
            <div class="mb-6">
              <h3 class="text-md font-medium mb-2">Stężenia gazów</h3>
              <div class="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={filteredData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="relativeTime" 
                      label={{ value: 'Czas [s]', position: 'insideBottomRight', offset: -10 }}
                      tickFormatter={formatTime}
                    />
                    <YAxis 
                      yAxisId="left"
                      label={{ value: 'CH4 [ppm]', angle: -90, position: 'insideLeft' }} 
                      domain={['auto', 'auto']}
                    />
                    <YAxis 
                      yAxisId="right" 
                      orientation="right" 
                      label={{ value: 'C2H6 [ppm]', angle: -90, position: 'insideRight' }} 
                      domain={['auto', 'auto']}
                    />
                    <Tooltip 
                      labelFormatter={(value) => `Czas: ${formatTime(value)}`}
                      formatter={(value, name) => [value.toFixed(6), name]}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="CH4" stroke="#8884d8" yAxisId="left" dot={false} />
                    <Line type="monotone" dataKey="C2H6" stroke="#82ca9d" yAxisId="right" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              
              <div class="mb-6">
                <h3 class="text-md font-medium mb-2">Prędkość pojazdu</h3>
                <div class="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={filteredData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="relativeTime" 
                        label={{ value: 'Czas [s]', position: 'insideBottomRight', offset: -10 }}
                        tickFormatter={formatTime}
                      />
                      <YAxis 
                        label={{ value: 'Prędkość [m/s]', angle: -90, position: 'insideLeft' }} 
                        domain={[0, 'auto']}
                      />
                      <Tooltip 
                        labelFormatter={(value) => `Czas: ${formatTime(value)}`}
                        formatter={(value, name) => [value.toFixed(2), "Prędkość pojazdu"]}
                      />
                      <Line type="monotone" dataKey="CAR_SPEED" stroke="#ff7300" dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
              
              <div class="mb-6">
                <h3 class="text-md font-medium mb-2">Wiatr</h3>
                <div class="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={filteredData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="relativeTime" 
                        label={{ value: 'Czas [s]', position: 'insideBottomRight', offset: -10 }}
                        tickFormatter={formatTime}
                      />
                      <YAxis 
                        label={{ value: 'Wiatr [m/s]', angle: -90, position: 'insideLeft' }} 
                      />
                      <Tooltip 
                        labelFormatter={(value) => `Czas: ${formatTime(value)}`}
                        formatter={(value, name) => [value.toFixed(3), name === "WIND_N" ? "Składowa N" : "Składowa E"]}
                      />
                      <Legend />
                      <Line type="monotone" dataKey="WIND_N" stroke="#0088FE" dot={false} name="Wiatr N" />
                      <Line type="monotone" dataKey="WIND_E" stroke="#00C49F" dot={false} name="Wiatr E" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        {/if}
        
        {#if selectedTab === 'gpsMap'}
          <div>
            <h2 class="text-lg font-semibold mb-4">Mapa trasy (GPS)</h2>
            <div class="h-128">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <CartesianGrid />
                  <XAxis 
                    type="number" 
                    dataKey="GPS_ABS_LONG" 
                    name="Długość" 
                    label={{ value: 'Długość geograficzna [°]', position: 'insideBottom', offset: -10 }}
                    domain={['auto', 'auto']}
                  />
                  <YAxis 
                    type="number" 
                    dataKey="GPS_ABS_LAT" 
                    name="Szerokość" 
                    label={{ value: 'Szerokość geograficzna [°]', angle: -90, position: 'insideLeft' }}
                    domain={['auto', 'auto']}
                  />
                  <ZAxis 
                    type="number" 
                    dataKey="CH4" 
                    range={[20, 400]} 
                    name="CH4" 
                  />
                  <Tooltip 
                    cursor={{ strokeDasharray: '3 3' }}
                    formatter={(value, name) => {
                      if (name === "Szerokość" || name === "Długość") {
                        return [value.toFixed(6), name];
                      } else if (name === "CH4") {
                        return [value.toFixed(6), "Stężenie CH4"];
                      }
                      return [value, name];
                    }}
                  />
                  <Scatter 
                    name="Punkty pomiarowe" 
                    data={filteredData} 
                    fill="#8884d8" 
                    line={{ stroke: '#8884d8', strokeWidth: 1 }}
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
            <div class="mt-4 text-sm text-gray-600">
              <p>Uwaga: Rozmiar punktów odpowiada stężeniu metanu (CH4). Punkty są połączone linią wg kolejności pomiarów.</p>
            </div>
          </div>
        {/if}
        
        {#if selectedTab === 'correlationCharts'}
          <div>
            <h2 class="text-lg font-semibold mb-4">Korelacje między parametrami</h2>
            
            <div class="mb-6">
              <h3 class="text-md font-medium mb-2">CH4 vs Prędkość pojazdu</h3>
              <div class="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                    <CartesianGrid />
                    <XAxis 
                      type="number" 
                      dataKey="CAR_SPEED" 
                      name="Prędkość" 
                      label={{ value: 'Prędkość pojazdu [m/s]', position: 'insideBottom', offset: -10 }}
                    />
                    <YAxis 
                      type="number" 
                      dataKey="CH4" 
                      name="CH4" 
                      label={{ value: 'Stężenie CH4 [ppm]', angle: -90, position: 'insideLeft' }}
                    />
                    <Tooltip 
                      cursor={{ strokeDasharray: '3 3' }}
                      formatter={(value, name) => {
                        if (name === "CH4") {
                          return [value.toFixed(6), "Stężenie CH4"];
                        } else if (name === "Prędkość") {
                          return [value.toFixed(2), "Prędkość pojazdu"];
                        }
                        return [value, name];
                      }}
                    />
                    <Scatter 
                      name="CH4 vs Prędkość" 
                      data={filteredData} 
                      fill="#8884d8" 
                    />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            <div class="mb-6">
              <h3 class="text-md font-medium mb-2">CH4 vs C2H6</h3>
              <div class="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                    <CartesianGrid />
                    <XAxis 
                      type="number" 
                      dataKey="C2H6" 
                      name="C2H6" 
                      label={{ value: 'Stężenie C2H6 [ppm]', position: 'insideBottom', offset: -10 }}
                    />
                    <YAxis 
                      type="number" 
                      dataKey="CH4" 
                      name="CH4" 
                      label={{ value: 'Stężenie CH4 [ppm]', angle: -90, position: 'insideLeft' }}
                    />
                    <Tooltip 
                      cursor={{ strokeDasharray: '3 3' }}
                      formatter={(value, name) => {
                        return [value.toFixed(6), name === "CH4" ? "Stężenie CH4" : "Stężenie C2H6"];
                      }}
                    />
                    <Scatter 
                      name="CH4 vs C2H6" 
                      data={filteredData} 
                      fill="#82ca9d" 
                    />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        {/if}
      </div>
      
      <!-- Sekcja statystyk -->
      <div class="mt-6 bg-white p-4 rounded shadow">
        <h2 class="text-lg font-semibold mb-3">Statystyki podstawowe</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {#if data.length > 0}
            <div class="p-3 border rounded">
              <h3 class="font-medium">CH4</h3>
              <p>Min: {stats.CH4.min.toFixed(6)}</p>
              <p>Max: {stats.CH4.max.toFixed(6)}</p>
              <p>Średnia: {stats.CH4.avg.toFixed(6)}</p>
            </div>
            
            <div class="p-3 border rounded">
              <h3 class="font-medium">C2H6</h3>
              <p>Min: {stats.C2H6.min.toFixed(6)}</p>
              <p>Max: {stats.C2H6.max.toFixed(6)}</p>
              <p>Średnia: {stats.C2H6.avg.toFixed(6)}</p>
            </div>
            
            <div class="p-3 border rounded">
              <h3 class="font-medium">Prędkość pojazdu</h3>
              <p>Min: {stats.CAR_SPEED.min.toFixed(2)}</p>
              <p>Max: {stats.CAR_SPEED.max.toFixed(2)}</p>
              <p>Średnia: {stats.CAR_SPEED.avg.toFixed(2)}</p>
            </div>
            
            <div class="p-3 border rounded">
              <h3 class="font-medium">Informacje o pomiarze</h3>
              <p>Czas trwania: {stats.measurement.duration.toFixed(1)} s</p>
              <p>Liczba próbek: {stats.measurement.count}</p>
              <p>Częstotliwość: {stats.measurement.frequency.toFixed(1)} Hz</p>
            </div>
          {/if}
        </div>
      </div>
    {/if}
    
    <div class="mt-6 text-center text-sm text-gray-500">
      <p>Dane z przejazdu testowego nr 1 z dnia 12.05.2025, godz. 07:57:07</p>
    </div>
  </div>