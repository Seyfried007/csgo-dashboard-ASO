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

// Utilidades de LocalStorage para guardar datos históricos
function saveToLocal(key, data) {
    localStorage.setItem(`csgo_dashboard_${key}`, JSON.stringify(data));
}

function loadFromLocal(key) {
    const data = localStorage.getItem(`csgo_dashboard_${key}`);
    return data ? JSON.parse(data) : null;
}

// Estructuras de datos locales
// historicalData: { date: "YYYY-MM-DD", hours: { "00": maxPlayers, "01": maxPlayers, ... } }
let todayData = loadFromLocal('today') || { date: new Date().toISOString().split('T')[0], hours: {} };
// dailyHistory: { "YYYY-MM-DD": peakPlayers, ... }
let dailyHistory = loadFromLocal('daily') || {};

function checkNewDay() {
    const currentDate = new Date().toISOString().split('T')[0];
    if (todayData.date !== currentDate) {
        // Guardar el pico del día anterior
        let maxYesterday = 0;
        for (const hour in todayData.hours) {
            if (todayData.hours[hour] > maxYesterday) maxYesterday = todayData.hours[hour];
        }
        if (Object.keys(todayData.hours).length > 0) {
            dailyHistory[todayData.date] = maxYesterday;
            saveToLocal('daily', dailyHistory);
        }
        
        // Reiniciar para hoy
        todayData = { date: currentDate, hours: {} };
        saveToLocal('today', todayData);
        updateDaysChart();
    }
}

function clearHistory(type) {
    if (type === 'hourly' && confirm('¿Borrar historial de horas de hoy?')) {
        todayData.hours = {};
        saveToLocal('today', todayData);
        updateHoursChart();
    } else if (type === 'daily' && confirm('¿Borrar historial de días anteriores?')) {
        dailyHistory = {};
        saveToLocal('daily', dailyHistory);
        updateDaysChart();
    }
}

// Configuración de Chart.js - Tiempo Real (Minutos)
const ctx = document.getElementById('playersChart').getContext('2d');
const gradient = ctx.createLinearGradient(0, 0, 0, 400);
gradient.addColorStop(0, 'rgba(34, 211, 238, 0.5)'); // Cyan
gradient.addColorStop(1, 'rgba(34, 211, 238, 0.0)');

const chart = new Chart(ctx, {
    type: 'line',
    data: {
        labels: [],
        datasets: [{
            label: 'Jugadores Conectados',
            data: [],
            borderColor: '#22d3ee',
            backgroundColor: gradient,
            borderWidth: 3,
            pointBackgroundColor: '#fff',
            pointBorderColor: '#22d3ee',
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6,
            fill: true,
            tension: 0.4
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: 'rgba(15, 32, 39, 0.9)',
                titleColor: '#fff',
                bodyColor: '#22d3ee',
                borderColor: 'rgba(255,255,255,0.1)',
                borderWidth: 1,
                padding: 12,
                displayColors: false
            }
        },
        scales: {
            x: { grid: { color: 'rgba(255, 255, 255, 0.05)', drawBorder: false }, ticks: { color: 'rgba(255, 255, 255, 0.5)' } },
            y: { beginAtZero: true, suggestedMax: 32, grid: { color: 'rgba(255, 255, 255, 0.05)', drawBorder: false }, ticks: { color: 'rgba(255, 255, 255, 0.5)', stepSize: 5 } }
        },
        animation: { duration: 1000, easing: 'easeOutQuart' }
    }
});

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

// Funciones de actualización de gráficos
function updateHoursChart() {
    if (!hoursChart) return;
    const labels = [];
    const data = [];
    // Recopilar datos de 00 a 23 hrs
    for (let i = 0; i < 24; i++) {
        const hourStr = i.toString().padStart(2, '0') + ':00';
        if (todayData.hours[hourStr] !== undefined) {
            labels.push(hourStr);
            data.push(todayData.hours[hourStr]);
        }
    }
    
    // Si no hay datos, mostrar algo vacío amigable
    if (labels.length === 0) {
        hoursChart.data.labels = ['Sin datos aún'];
        hoursChart.data.datasets[0].data = [0];
    } else {
        hoursChart.data.labels = labels;
        hoursChart.data.datasets[0].data = data;
    }
    hoursChart.update();
}

function updateDaysChart() {
    if (!daysChart) return;
    const labels = Object.keys(dailyHistory).sort(); // Fechas ordenadas
    const data = labels.map(date => dailyHistory[date]);
    
    if (labels.length === 0) {
        daysChart.data.labels = ['Sin historial'];
        daysChart.data.datasets[0].data = [0];
    } else {
        // Mostrar formarto corto (ej. "14 Mar")
        const shortLabels = labels.map(dateStr => {
            const d = new Date(dateStr);
            return d.getDate() + '/' + (d.getMonth()+1);
        });
        daysChart.data.labels = shortLabels;
        daysChart.data.datasets[0].data = data;
    }
    daysChart.update();
}

function addData(players) {
    const now = new Date();
    const timeStr = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
    const hourStr = now.getHours().toString().padStart(2, '0') + ':00';
    
    // 1. Gráfico en Tiempo Real
    chart.data.labels.push(timeStr);
    chart.data.datasets[0].data.push(players);
    if (chart.data.labels.length > 60) {
        chart.data.labels.shift();
        chart.data.datasets[0].data.shift();
    }
    chart.update();
    
    // 2. Lógica LocalStorage (Horas)
    checkNewDay();
    if (!todayData.hours[hourStr] || players > todayData.hours[hourStr]) {
        todayData.hours[hourStr] = players; // Guardar el pico máximo de esa hora
        saveToLocal('today', todayData);
        updateHoursChart();
    }
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

        let players = playersElem ? parseInt(playersElem.innerText.trim()) : 0;
        let maxPlayers = maxPlayersElem ? parseInt(maxPlayersElem.innerText.trim()) : 0;
        let map = mapElem ? mapElem.innerText.trim() : 'Desconocido';

        if (isNaN(players)) {
            const match = htmlString.match(/<span\s+id="HTML_num_players"[^>]*>(\d+)<\/span>/i);
            players = match ? parseInt(match[1]) : 0;
        }
        if (isNaN(maxPlayers)) {
            const match = htmlString.match(/<span\s+id="HTML_max_players"[^>]*>(\d+)<\/span>/i);
            maxPlayers = match ? parseInt(match[1]) : 0;
        }
        
        if (maxPlayers > 0) {
            setStatus(true);
            
            chart.options.scales.y.suggestedMax = maxPlayers;
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
    
    // Cargar gráficos iniciales vacíos o con datos guardados
    updateHoursChart();
    updateDaysChart();
    
    fetchServerData();
    startTimer();
};
