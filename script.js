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

// NO SE USA LOCALSTORAGE, SE USA EL ARCHIVO GLOBAL history.json PARA HORAS Y DÍAS.
let historyData = {};

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

    // 1. Llenar Tabla (Orden Inverso, del más reciente al más antiguo)
    const tableBody = document.getElementById('historyTableBody');
    if (tableBody) {
        tableBody.innerHTML = ''; // Limpiar
        
        // Iterar en reversa
        for (let i = dates.length - 1; i >= 0; i--) {
            const dateStr = dates[i];
            const d = new Date(dateStr);
            const formattedDate = d.toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'short' });
            
            // Buscar pico de ese día
            const hoursInDay = historyData[dateStr];
            let peakOfDay = 0;
            for (const h in hoursInDay) {
                if (hoursInDay[h] > peakOfDay) peakOfDay = hoursInDay[h];
            }
            
            // Crear fila HTML
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-white/5 transition-colors group';
            tr.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap group-hover:text-white transition-colors capitalize">${formattedDate}</td>
                <td class="px-6 py-4 whitespace-nowrap text-center font-bold text-cyan-400">${peakOfDay}</td>
            `;
            tableBody.appendChild(tr);
        }
    }

    // 2. GRAFICO DE HORAS (Último día disponible)
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
    
    if (hoursChart) {
        hoursChart.data.labels = hLabels.length > 0 ? hLabels : ['Sin datos'];
        hoursChart.data.datasets[0].data = hLabels.length > 0 ? hData : [0];
        hoursChart.update();
    }

    // 3. GRAFICO DE DIAS (Pico máximo por día)
    const dLabels = [];
    const dData = [];
    
    dates.forEach(dateStr => {
        const d = new Date(dateStr);
        dLabels.push(d.getDate() + '/' + (d.getMonth() + 1));
        
        const hoursInDay = historyData[dateStr];
        let peakOfDay = 0;
        
        for (const h in hoursInDay) {
            if (hoursInDay[h] > peakOfDay) peakOfDay = hoursInDay[h];
        }
        
        dData.push(peakOfDay);
    });
    
    if (daysChart) {
        daysChart.data.datasets[0].label = 'Pico Máximo Diario';
        daysChart.data.labels = dLabels.length > 0 ? dLabels : ['Sin datos'];
        daysChart.data.datasets[0].data = dLabels.length > 0 ? dData : [0];
        daysChart.update();
    }
}

function clearHistory() {
    alert("Ahora los datos vienen directo de la nube de forma automática cada hora. No se pueden borrar desde aquí para proteger el historial global.");
}

// Se eliminó el gráfico de tiempo real (Minutos)

// Configuración de Chart.js - Por Horas (Hoy)
const ctxHours = document.getElementById('hoursChart')?.getContext('2d');
const gradientHours = ctxHours?.createLinearGradient(0, 0, 0, 400);
if(gradientHours) {
    gradientHours.addColorStop(0, 'rgba(192, 132, 252, 0.6)'); // Purple
    gradientHours.addColorStop(1, 'rgba(192, 132, 252, 0.1)');
}

let hoursChart;
if (ctxHours) {
    hoursChart = new Chart(ctxHours, {
        type: 'bar',
        data: { labels: [], datasets: [{ label: 'Pico de Jugadores', data: [], backgroundColor: gradientHours, borderColor: '#c084fc', borderWidth: 2, borderRadius: 6, hoverBackgroundColor: '#d8b4fe' }] },
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

// Configuración de Chart.js - Por Días
const ctxDays = document.getElementById('daysChart')?.getContext('2d');
const gradientDays = ctxDays?.createLinearGradient(0, 0, 0, 400);
if(gradientDays) {
    gradientDays.addColorStop(0, 'rgba(52, 211, 153, 0.6)'); // Emerald
    gradientDays.addColorStop(1, 'rgba(52, 211, 153, 0.1)');
}

let daysChart;
if (ctxDays) {
    daysChart = new Chart(ctxDays, {
        type: 'bar',
        data: { labels: [], datasets: [{ label: 'Pico Diario', data: [], backgroundColor: gradientDays, borderColor: '#34d399', borderWidth: 2, borderRadius: 6, hoverBackgroundColor: '#6ee7b7' }] },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { backgroundColor: 'rgba(15, 32, 39, 0.9)', titleColor: '#fff', bodyColor: '#34d399', borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1, padding: 12, displayColors: false }
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
            
            if(hoursChart) hoursChart.options.scales.y.suggestedMax = maxPlayers;
            if(daysChart) daysChart.options.scales.y.suggestedMax = maxPlayers;
            
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
