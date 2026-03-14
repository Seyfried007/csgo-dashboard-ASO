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

// Configuración del gráfico en tiempo real
const ctx = document.getElementById('playersChart').getContext('2d');
const gradient = ctx.createLinearGradient(0, 0, 0, 400);
gradient.addColorStop(0, 'rgba(34, 211, 238, 0.5)'); // Cyan border
gradient.addColorStop(1, 'rgba(34, 211, 238, 0.0)'); // Transparent

const chart = new Chart(ctx, {
    type: 'line',
    data: {
        labels: [],
        datasets: [{
            label: 'Jugadores Conectados',
            data: [],
            borderColor: '#22d3ee', // Cyan-400
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
                displayColors: false,
                callbacks: {
                    label: function(context) {
                        return context.parsed.y + ' jugadores';
                    }
                }
            }
        },
        scales: {
            x: {
                grid: { color: 'rgba(255, 255, 255, 0.05)', drawBorder: false },
                ticks: { color: 'rgba(255, 255, 255, 0.5)' }
            },
            y: {
                beginAtZero: true,
                suggestedMax: 32,
                grid: { color: 'rgba(255, 255, 255, 0.05)', drawBorder: false },
                ticks: { color: 'rgba(255, 255, 255, 0.5)', stepSize: 5 }
            }
        },
        animation: { duration: 1000, easing: 'easeOutQuart' }
    }
});

// Función para cambiar rango del historial de GameTracker
function changeHistoryRange(rangeStr) {
    const chartImg = document.getElementById('historyChart');
    if (!chartImg) return;
    
    // Obtenemos los maxPlayers actuales del DOM para enviar a GT
    const currentMax = elMaxPlayers.textContent !== '--' ? elMaxPlayers.textContent : 32;
    // Forzamos la actualización de la imagen evitando la caché
    chartImg.src = `https://image.gametracker.com/images/graphs/server_players.php?GSID=6033340&start=${rangeStr}&max=${currentMax}&name=History&_t=${Date.now()}`;
}


// Función para actualizar contador y gráfico
function addData(players) {
    const now = new Date();
    const timeStr = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
    
    chart.data.labels.push(timeStr);
    chart.data.datasets[0].data.push(players);
    
    // Mantener máximo 60 puntos (últimos 60 minutos = 1 hora)
    if (chart.data.labels.length > 60) {
        chart.data.labels.shift();
        chart.data.datasets[0].data.shift();
    }
    
    chart.update();
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
    fetchServerData();
    startTimer();
};
