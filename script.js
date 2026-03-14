// Configuración
const REFRESH_INTERVAL_SECONDS = 60;
let countdown = REFRESH_INTERVAL_SECONDS;
let peakPlayers = 0;
let intervalId = null;
let countdownId = null;

const TARGET_URL = 'https://www.gametracker.com/server_info/45.235.98.242:27035/';
const CORS_PROXY = 'https://api.allorigins.win/get?url=';

// Elementos del DOM
const elPlayers = document.getElementById('valPlayers');
const elMaxPlayers = document.getElementById('valMaxPlayers');
const elPeak = document.getElementById('valPeak');
const elMap = document.getElementById('valMap');
const elTimer = document.getElementById('countdownTimer');
const elStatusDot = document.getElementById('statusDot');
const elStatusText = document.getElementById('statusText');
const elPlayersBar = document.getElementById('playersBar');
const elRefreshIcon = document.getElementById('refreshIcon');
const elMapImage = document.getElementById('mapImage');
const elMapPlaceholder = document.getElementById('mapPlaceholder');
const elBestHour = document.getElementById('valBestHour');

// NO SE USA LOCALSTORAGE, SE USA EL ARCHIVO GLOBAL history.json PARA HORAS Y DÍAS.
let historyData = {};
let currentTimeframe = 'day'; // day, week, month

async function fetchHistory() {
    try {
        // Agregamos un timestamp para que GitHub no nos de una versión cacheada vieja
        const response = await fetch('history.json?t=' + new Date().getTime());
        if (!response.ok) return;
        historyData = await response.json();
        
        // Convertimos el JSON { "YYYY-MM-DD": { "HH:00": jugadores } } al formato de nuestros gráficos
        updateHistoricalCharts();
    } catch (e) {
        console.error("No se pudo cargar history.json", e);
    }
}

function updateHistoricalCharts() {
    const dates = Object.keys(historyData).sort();
    if (dates.length === 0) return;

    // --- CÁLCULO DE LA MEJOR HORA HISTÓRICA ---
    let hourSums = {};
    dates.forEach(dateStr => {
        const hoursObj = historyData[dateStr];
        for (const h in hoursObj) {
            if (!hourSums[h]) hourSums[h] = 0;
            hourSums[h] += hoursObj[h];
        }
    });
    
    let bestHourStr = "--:--";
    let maxHourSum = -1;
    for (const h in hourSums) {
        if (hourSums[h] > maxHourSum) {
            maxHourSum = hourSums[h];
            bestHourStr = h;
        }
    }
    if (elBestHour) elBestHour.textContent = bestHourStr;
    // ------------------------------------------

    // LIMPIAR TABLA Y GRÁFICOS ANTES DE DIBUJAR
    const tableBody = document.getElementById('historyTableBody');
    if (tableBody) tableBody.innerHTML = '';
    
    document.getElementById('tableTitle').innerHTML = '<i class="fa-solid fa-list-ul text-cyan-400"></i> Registro Diario';
    document.getElementById('tableHeader').innerHTML = `
        <tr>
            <th scope="col" class="px-6 py-4 font-semibold">Fecha</th>
            <th scope="col" class="px-6 py-4 font-semibold text-center">Pico de Jugadores</th>
        </tr>
    `;

    // ------------------------------------------
    // LÓGICA SEGÚN PESTAÑA (TIMEFRAME)
    // ------------------------------------------

    if (currentTimeframe === 'day') {
        document.getElementById('secondaryChartContainer').classList.add('hidden'); // Ocultar gráfico secundario
        document.getElementById('mainChartTitle').innerHTML = '<i class="fa-solid fa-clock text-purple-400"></i> Historial Hoy (24 Horas)';
        
        // 1. Llenar Tabla (Orden Inverso)
        for (let i = dates.length - 1; i >= 0; i--) {
            const dateStr = dates[i];
            const d = new Date(dateStr);
            const formattedDate = d.toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'short' });
            
            const hoursInDay = historyData[dateStr];
            let peakOfDay = 0;
            for (const h in hoursInDay) {
                if (hoursInDay[h] > peakOfDay) peakOfDay = hoursInDay[h];
            }
            
            if(tableBody) {
                const tr = document.createElement('tr');
                tr.className = 'hover:bg-white/5 transition-colors group';
                tr.innerHTML = `
                    <td class="px-6 py-4 whitespace-nowrap group-hover:text-white transition-colors capitalize">${formattedDate}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-center font-bold text-cyan-400">${peakOfDay}</td>
                `;
                tableBody.appendChild(tr);
            }
        }

        // 2. Gráfico Principal: Horas de Hoy
        const lastDate = dates[dates.length - 1];
        const todayHours = historyData[lastDate];
        const hLabels = [];
        const hData = [];
        for (let i = 0; i < 24; i++) {
            const hourStr = i.toString().padStart(2, '0') + ':00';
            if (todayHours[hourStr] !== undefined) {
                hLabels.push(hourStr);
                hData.push(todayHours[hourStr]);
            }
        }
        
        if (mainChart) {
            mainChart.data.labels = hLabels.length > 0 ? hLabels : ['Sin datos'];
            mainChart.data.datasets[0].label = 'Jugadores a esta hora';
            mainChart.data.datasets[0].data = hLabels.length > 0 ? hData : [0];
            mainChart.data.datasets[0].backgroundColor = gradientPurple;
            mainChart.data.datasets[0].borderColor = '#c084fc';
            mainChart.data.datasets[0].hoverBackgroundColor = '#d8b4fe';
            mainChart.update();
        }

    } else if (currentTimeframe === 'week' || currentTimeframe === 'month') {
        document.getElementById('secondaryChartContainer').classList.remove('hidden'); // Mostrar gráfico secundario
        
        let daysToSlice = currentTimeframe === 'week' ? 7 : 30;
        let recentDates = dates.slice(-daysToSlice);
        
        // Configurar Títulos
        if(currentTimeframe === 'week') {
            document.getElementById('tableTitle').innerHTML = '<i class="fa-solid fa-calendar-week text-emerald-400"></i> Resumen Semanal';
            document.getElementById('secondaryChartTitle').innerHTML = '<i class="fa-solid fa-chart-bar text-emerald-400"></i> Tendencia de la Semana';
            document.getElementById('mainChartTitle').innerHTML = '<i class="fa-solid fa-chart-area text-purple-400"></i> Picos por Día (Últimos 7 días)';
        } else {
            document.getElementById('tableTitle').innerHTML = '<i class="fa-solid fa-calendar-days text-blue-400"></i> Resumen Mensual';
            document.getElementById('secondaryChartTitle').innerHTML = '<i class="fa-solid fa-chart-line text-blue-400"></i> Tendencia del Mes';
            document.getElementById('mainChartTitle').innerHTML = '<i class="fa-solid fa-chart-area text-purple-400"></i> Picos por Día (Últimos 30 días)';
        }

        // Preparar Datos para Tablas y Gráficos
        const dLabels = [];
        const dData = [];
        let sumPeaks = 0;
        
        // Iterar de forma normal para gráficos
        recentDates.forEach(dateStr => {
            const d = new Date(dateStr);
            dLabels.push(d.getDate() + '/' + (d.getMonth() + 1));
            
            const hoursInDay = historyData[dateStr];
            let peakOfDay = 0;
            for (const h in hoursInDay) {
                if (hoursInDay[h] > peakOfDay) peakOfDay = hoursInDay[h];
            }
            dData.push(peakOfDay);
            sumPeaks += peakOfDay;
        });

        // 1. Llenar Tabla (Orden Inverso para que recientes salgan arriba)
        for (let i = recentDates.length - 1; i >= 0; i--) {
            const dateStr = recentDates[i];
            const d = new Date(dateStr);
            const formattedDate = d.toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'short' });
            
            const hoursInDay = historyData[dateStr];
            let peakOfDay = 0;
            for (const h in hoursInDay) {
                if (hoursInDay[h] > peakOfDay) peakOfDay = hoursInDay[h];
            }
            
            if(tableBody) {
                const tr = document.createElement('tr');
                tr.className = 'hover:bg-white/5 transition-colors group';
                tr.innerHTML = `
                    <td class="px-6 py-4 whitespace-nowrap group-hover:text-white transition-colors capitalize">${formattedDate}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-center font-bold text-cyan-400">${peakOfDay}</td>
                `;
                tableBody.appendChild(tr);
            }
        }
        
        // 2. Gráfico Secundario (Pequeño, Tendencia Promedio)
        if (secondaryChart) {
            secondaryChart.data.labels = dLabels.length > 0 ? dLabels : ['Sin datos'];
            secondaryChart.data.datasets[0].label = 'Pico Máximo Diario';
            secondaryChart.data.datasets[0].data = dLabels.length > 0 ? dData : [0];
            
            // Cambiar color por pestaña
            if(currentTimeframe === 'week') {
                secondaryChart.data.datasets[0].backgroundColor = gradientEmerald;
                secondaryChart.data.datasets[0].borderColor = '#34d399';
                secondaryChart.data.datasets[0].hoverBackgroundColor = '#6ee7b7';
            } else {
                secondaryChart.data.datasets[0].backgroundColor = gradientBlue;
                secondaryChart.data.datasets[0].borderColor = '#60a5fa';
                secondaryChart.data.datasets[0].hoverBackgroundColor = '#93c5fd';
            }
            secondaryChart.update();
        }

        // 3. Gráfico Principal Expandido (Horas promedio VS Días)
        if (mainChart) {
            mainChart.data.labels = dLabels.length > 0 ? dLabels : ['Sin datos'];
            mainChart.data.datasets[0].label = 'Jugadores Máximos';
            mainChart.data.datasets[0].data = dLabels.length > 0 ? dData : [0];
            mainChart.data.datasets[0].backgroundColor = gradientPurple;
            mainChart.data.datasets[0].borderColor = '#c084fc';
            mainChart.data.datasets[0].hoverBackgroundColor = '#d8b4fe';
            mainChart.update();
        }
    }
}

function setTimeframe(tf) {
    currentTimeframe = tf;
    
    // Cambiar clases CSS de los botones (Activo vs Inactivo)
    const tabs = ['day', 'week', 'month'];
    tabs.forEach(t => {
        const btn = document.getElementById('tab' + t.charAt(0).toUpperCase() + t.slice(1));
        if (!btn) return;
        
        if (t === tf) {
            btn.classList.add('bg-cyan-500/20', 'text-cyan-400', 'border-cyan-500/50');
            btn.classList.remove('bg-gray-800', 'text-gray-400', 'border-transparent');
        } else {
            btn.classList.remove('bg-cyan-500/20', 'text-cyan-400', 'border-cyan-500/50');
            btn.classList.add('bg-gray-800', 'text-gray-400', 'border-transparent');
        }
    });

    updateHistoricalCharts();
}

// Se eliminó el gráfico de tiempo real (Minutos)

// ==========================================
// CONFIGURACIÓN DE GRÁFICOS (CHART.JS)
// ==========================================

// Configuración de Gráfico Principal (Abajo Expandido)
const ctxMain = document.getElementById('mainChart')?.getContext('2d');
const gradientPurple = ctxMain?.createLinearGradient(0, 0, 0, 400);
if(gradientPurple) {
    gradientPurple.addColorStop(0, 'rgba(192, 132, 252, 0.6)'); // Purple
    gradientPurple.addColorStop(1, 'rgba(192, 132, 252, 0.1)');
}

let mainChart;
if (ctxMain) {
    mainChart = new Chart(ctxMain, {
        type: 'bar',
        data: { labels: [], datasets: [{ label: '', data: [], backgroundColor: gradientPurple, borderColor: '#c084fc', borderWidth: 2, borderRadius: 6, hoverBackgroundColor: '#d8b4fe' }] },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { backgroundColor: 'rgba(15, 32, 39, 0.9)', titleColor: '#fff', bodyColor: '#c084fc', borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1, padding: 12, displayColors: false }
            },
            scales: {
                x: { grid: { display: false, drawBorder: false }, ticks: { color: 'rgba(255, 255, 255, 0.5)' } },
                y: { beginAtZero: true, suggestedMax: 32, grid: { color: 'rgba(255, 255, 255, 0.05)', drawBorder: false }, ticks: { color: 'rgba(255, 255, 255, 0.5)', stepSize: 5 } }
            },
            animation: { duration: 1000 }
        }
    });
}

// Configuración de Gráfico Secundario (Arriba a la derecha)
const ctxSecondary = document.getElementById('secondaryChart')?.getContext('2d');
const gradientEmerald = ctxSecondary?.createLinearGradient(0, 0, 0, 400);
if(gradientEmerald) {
    gradientEmerald.addColorStop(0, 'rgba(52, 211, 153, 0.6)'); // Emerald
    gradientEmerald.addColorStop(1, 'rgba(52, 211, 153, 0.1)');
}
// Nuevo gradiente azul para el mes
const gradientBlue = ctxSecondary?.createLinearGradient(0, 0, 0, 400);
if(gradientBlue) {
    gradientBlue.addColorStop(0, 'rgba(96, 165, 250, 0.6)'); // Blue
    gradientBlue.addColorStop(1, 'rgba(96, 165, 250, 0.1)');
}

let secondaryChart;
if (ctxSecondary) {
    secondaryChart = new Chart(ctxSecondary, {
        type: 'bar', // Puede cambiar a line dinamicamente
        data: { labels: [], datasets: [{ label: '', data: [], backgroundColor: gradientEmerald, borderColor: '#34d399', borderWidth: 2, borderRadius: 6, hoverBackgroundColor: '#6ee7b7' }] },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { backgroundColor: 'rgba(15, 32, 39, 0.9)', titleColor: '#fff', bodyColor: '#fff', borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1, padding: 12, displayColors: false }
            },
            scales: {
                x: { grid: { display: false, drawBorder: false }, ticks: { color: 'rgba(255, 255, 255, 0.5)' } },
                y: { beginAtZero: true, suggestedMax: 32, grid: { color: 'rgba(255, 255, 255, 0.05)', drawBorder: false }, ticks: { color: 'rgba(255, 255, 255, 0.5)', stepSize: 5 } }
            },
            animation: { duration: 1000 }
        }
    });
}

// Las funciones originales updateHoursChart y updateDaysChart se eliminaron (ahora en fetchHistory)

function addData(players) {
    // 1. Gráfico histórico desde la nube
    // (Ya no guardamos en LocalStorage porque GitHub auto-actualiza history.json cada hora)
}

function setStatus(isOnline) {
    if (isOnline) {
        elStatusDot.classList.replace('bg-red-500', 'bg-green-400');
        elStatusDot.classList.replace('bg-gray-500', 'bg-green-400');
        elStatusDot.classList.add('pulse');
        elStatusText.textContent = 'ONLINE';
        elStatusText.classList.replace('text-red-500', 'text-green-400');
    } else {
        elStatusDot.classList.replace('bg-green-400', 'bg-red-500');
        elStatusDot.classList.remove('pulse');
        elStatusText.textContent = 'OFFLINE / ERROR';
        elStatusText.classList.replace('text-green-400', 'text-red-500');
    }
}

async function fetchServerData() {
    elRefreshIcon.classList.add('fa-spin');
    
    try {
        const response = await fetch(CORS_PROXY + encodeURIComponent(TARGET_URL));
        if (!response.ok) throw new Error("Error de red");
        
        const data = await response.json();
        const htmlString = data.contents;
        
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlString, 'text/html');
        
        const playersElem = doc.getElementById('HTML_num_players');
        const maxPlayersElem = doc.getElementById('HTML_max_players');
        const mapElem = doc.getElementById('HTML_curr_map');

        let players = playersElem ? parseInt(playersElem.innerText.trim()) : NaN;
        let maxPlayers = maxPlayersElem ? parseInt(maxPlayersElem.innerText.trim()) : NaN;
        let map = mapElem ? mapElem.innerText.trim() : 'Desconocido';

        // ¡Fallback crucial con Regex si el parser del DOM falla (muy común por CORS/Proxy)!
        if (isNaN(players)) {
            const playersMatch = htmlString.match(/<span\s+id=[\"']HTML_num_players[\"'][^>]*>(\d+)<\/span>/i);
            players = playersMatch ? parseInt(playersMatch[1], 10) : 0;
        }
        if (isNaN(maxPlayers)) {
            const maxMatch = htmlString.match(/<span\s+id=[\"']HTML_max_players[\"'][^>]*>(\d+)<\/span>/i);
            maxPlayers = maxMatch ? parseInt(maxMatch[1], 10) : 0;
        }
        
        if (maxPlayers > 0) {
            setStatus(true);
            
            if(mainChart) mainChart.options.scales.y.suggestedMax = maxPlayers;
            if(secondaryChart) secondaryChart.options.scales.y.suggestedMax = maxPlayers;
            
            elPlayers.textContent = players;
            elMaxPlayers.textContent = maxPlayers;
            elMap.textContent = map;
            elMap.title = map;
            
            const percent = Math.min((players / maxPlayers) * 100, 100);
            elPlayersBar.style.width = percent + '%';
            
            if (percent >= 90) {
                elPlayersBar.classList.replace('from-cyan-400', 'from-red-400');
                elPlayersBar.classList.replace('to-blue-500', 'to-orange-500');
            } else {
                elPlayersBar.classList.replace('from-red-400', 'from-cyan-400');
                elPlayersBar.classList.replace('to-orange-500', 'to-blue-500');
            }

            if (players > peakPlayers) {
                peakPlayers = players;
            }
            elPeak.textContent = peakPlayers;

            if (map && map !== 'Desconocido') {
                elMapImage.src = `https://image.gametracker.com/images/maps/160x120/csgo/${map}.jpg`;
                elMapImage.classList.remove('hidden');
                elMapPlaceholder.classList.add('hidden');
                
                elMapImage.onerror = function() {
                    elMapImage.classList.add('hidden');
                    elMapPlaceholder.classList.remove('hidden');
                }
            }

            addData(players);

        } else {
            throw new Error("No se encontraron datos del servidor");
        }
        
    } catch (err) {
        console.error("No se pudo obtener la info del servidor: ", err);
        setStatus(false);
    } finally {
        elRefreshIcon.classList.remove('fa-spin');
    }
    
    countdown = REFRESH_INTERVAL_SECONDS;
    updateTimerDisplay();
}

function updateTimerDisplay() {
    elTimer.textContent = countdown + 's';
}

function forceUpdate() {
    countdown = 0;
    clearInterval(countdownId);
    fetchServerData();
    startTimer();
}

function startTimer() {
    countdownId = setInterval(() => {
        countdown--;
        if(countdown <= 0) {
            fetchServerData();
        } else {
            updateTimerDisplay();
        }
    }, 1000);
}

// Inicialización
window.onload = () => {
    elStatusDot.classList.replace('bg-green-400', 'bg-gray-500');
    elStatusDot.classList.remove('pulse');
    
    // Cargar gráficos históricos de GitHub Actions
    fetchHistory();
    
    fetchServerData();
    startTimer();
};
