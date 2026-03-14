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

// Configurar inputs por defecto con fecha actual
document.addEventListener('DOMContentLoaded', () => {
    const today = new Date();
    const tzOffset = today.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(today - tzOffset)).toISOString();
    
    const weekInput = document.getElementById('weekPicker');
    if (weekInput) weekInput.value = localISOTime.split('T')[0];
    
    const monthInput = document.getElementById('monthPicker');
    if (monthInput) monthInput.value = localISOTime.substring(0, 7); // YYYY-MM
});

async function fetchHistory() {
    try {
        // Asegurarse de que los gráficos existan antes de intentar actualizarlos
        if (!mainChart || !secondaryChart) {
            initCharts();
        }

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
    
    const analContainer = document.getElementById('analyticalCardsContainer');
    const analTitle1 = document.getElementById('analTitle1'), analValue1 = document.getElementById('analValue1'), analSecondary1 = document.getElementById('analSecondary1'), analDesc1 = document.getElementById('analDesc1'), analIcon1 = document.getElementById('analIcon1');
    const analTitle2 = document.getElementById('analTitle2'), analValue2 = document.getElementById('analValue2'), analSecondary2 = document.getElementById('analSecondary2'), analDesc2 = document.getElementById('analDesc2'), analIcon2 = document.getElementById('analIcon2');

    if (currentTimeframe === 'day') {
        document.getElementById('secondaryChartContainer').classList.add('hidden'); // Ocultar gráfico secundario
        if (analContainer) analContainer.classList.add('hidden'); // Ocultar tarjetas extras
        document.getElementById('mainChartTitle').innerHTML = '<i class="fa-solid fa-clock text-purple-400"></i> Historial Hoy (24 Horas)';
        
        // 1. Llenar Tabla (Orden Inverso)
        for (let i = dates.length - 1; i >= 0; i--) {
            const dateStr = dates[i];
            const d = new Date(dateStr);
            // Fix timezone shift for localized display
            const userTimezoneOffset = d.getTimezoneOffset() * 60000;
            const localDate = new Date(d.getTime() + userTimezoneOffset);
            
            const formattedDate = localDate.toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'short' });
            
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
            mainChart.data.datasets = [{
                label: 'Jugadores a esta hora',
                data: hLabels.length > 0 ? hData : [0],
                backgroundColor: gradientPurple,
                borderColor: '#c084fc',
                borderWidth: 2, borderRadius: 6,
                hoverBackgroundColor: '#d8b4fe'
            }];
            mainChart.update();
        }

    } else if (currentTimeframe === 'week') {
        document.getElementById('secondaryChartContainer').classList.remove('hidden');
        
        let targetDateStr = document.getElementById('weekPicker')?.value;
        if (!targetDateStr) targetDateStr = dates[dates.length - 1]; // Fallback to latest
        
        // Find the index of the target date or closest past date
        let targetIndex = dates.length - 1;
        for (let i = dates.length - 1; i >= 0; i--) {
            if (dates[i] <= targetDateStr) {
                targetIndex = i;
                break;
            }
        }
        
        // Extract 7 days ending on target date
        let startIndex = Math.max(0, targetIndex - 6);
        let currentWeekDates = dates.slice(startIndex, targetIndex + 1);
        
        // Extract previous 7 days
        let prevEndIndex = startIndex - 1;
        let prevStartIndex = Math.max(0, prevEndIndex - 6);
        let prevWeekDates = prevEndIndex >= 0 ? dates.slice(prevStartIndex, prevEndIndex + 1) : [];

        document.getElementById('tableTitle').innerHTML = '<i class="fa-solid fa-calendar-week text-emerald-400"></i> Resumen Semana Sel.';
        document.getElementById('secondaryChartTitle').innerHTML = '<i class="fa-solid fa-code-compare text-emerald-400"></i> Crecimiento (Semana vs Ant.)';
        document.getElementById('mainChartTitle').innerHTML = '<i class="fa-solid fa-chart-area text-purple-400"></i> Picos Diarios de la Semana';

        const cLabels = [];
        const cData = [];
        const pData = [];
        let sumCurrent = 0;
        let sumPrev = 0;
        
        // Generar labels de 1 a 7 (Lunes a Domingo idealmente, o simplemente Día 1 a 7)
        for(let i=0; i<7; i++) {
            cLabels.push(`Día ${i+1}`);
            
            // Current week data point
            if (i < currentWeekDates.length) {
                const dateStr = currentWeekDates[i];
                let peakOfDay = 0;
                for (const h in historyData[dateStr]) {
                    if (historyData[dateStr][h] > peakOfDay) peakOfDay = historyData[dateStr][h];
                }
                cData.push(peakOfDay);
                sumCurrent += peakOfDay;
            } else {
                cData.push(0);
            }
            
            // Previous week data point
            if (i < prevWeekDates.length) {
                const dateStr = prevWeekDates[i];
                let peakOfDay = 0;
                for (const h in historyData[dateStr]) {
                    if (historyData[dateStr][h] > peakOfDay) peakOfDay = historyData[dateStr][h];
                }
                pData.push(peakOfDay);
                sumPrev += peakOfDay;
            } else {
                pData.push(0);
            }
        }

        // Llenar Tabla solo con la semana actual (Orden Cronológico Inverso)
        for (let i = currentWeekDates.length - 1; i >= 0; i--) {
            const dateStr = currentWeekDates[i];
            const d = new Date(dateStr);
            const userTimezoneOffset = d.getTimezoneOffset() * 60000;
            const localDate = new Date(d.getTime() + userTimezoneOffset);
            const formattedDate = localDate.toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'short' });
            
            let peakOfDay = 0;
            for (const h in historyData[dateStr]) {
                if (historyData[dateStr][h] > peakOfDay) peakOfDay = historyData[dateStr][h];
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
        
        // Tarjeta Analítica 1: Mejor Día vs Actual
        if (analContainer) {
            analContainer.classList.remove('hidden');
            
            // Encontrar el mejor día de la semana actual
            let maxWPeak = -1, maxWDateStr = "";
            let currentDayPeak = 0;
            currentWeekDates.forEach((dateStr, idx) => {
                let peakOfDay = 0;
                for (const h in historyData[dateStr]) {
                    if (historyData[dateStr][h] > peakOfDay) peakOfDay = historyData[dateStr][h];
                }
                if (peakOfDay > maxWPeak) {
                    maxWPeak = peakOfDay;
                    maxWDateStr = dateStr;
                }
                if (idx === currentWeekDates.length - 1) currentDayPeak = peakOfDay; // El último día (día actual de la búsqueda)
            });
            
            const bestD = new Date(maxWDateStr);
            const userTz = bestD.getTimezoneOffset() * 60000;
            const bDate = new Date(bestD.getTime() + userTz);
            const bestDayName = bDate.toLocaleDateString('es-ES', { weekday: 'long' });
            
            analTitle1.textContent = "Día Más Activo";
            analIcon1.className = "fa-solid fa-trophy";
            analValue1.textContent = maxWPeak;
            analSecondary1.className = "text-sm font-medium mb-1 px-2 py-0.5 rounded bg-gray-700 text-gray-300 capitalize";
            analSecondary1.textContent = bestDayName;
            
            if (currentDayPeak === maxWPeak) {
                analDesc1.innerHTML = `El día que seleccionaste <b>es el récord</b> de esta semana.`;
            } else {
                analDesc1.innerHTML = `El día seleccionado tuvo <b>${currentDayPeak} jugadores</b> en su punto máximo.`;
            }

            // Tarjeta Analítica 2: Rendimiento Semanal (Promedios sin decimales)
            let avgCurrentR = currentWeekDates.length > 0 ? Math.round(sumCurrent / currentWeekDates.length) : 0;
            let avgPrevR = prevWeekDates.length > 0 ? Math.round(sumPrev / prevWeekDates.length) : 0;
            let diffAvg = avgCurrentR - avgPrevR;
            
            let valClass = diffAvg > 0 ? "bg-emerald-500/20 text-emerald-400" : (diffAvg < 0 ? "bg-red-500/20 text-red-400" : "bg-gray-700 text-gray-300");
            let valSign = diffAvg > 0 ? "+" : "";
            let textDiff = diffAvg === 0 ? "Igual a la semana pasada" : `${valSign}${diffAvg} que la semana pasada`;

            analTitle2.textContent = "Promedio Semanal";
            analIcon2.className = "fa-solid fa-users";
            analValue2.textContent = avgCurrentR;
            analSecondary1.textContent = bestDayName; // Resetting just in case
            analSecondary2.className = `text-sm font-medium mb-1 px-2 py-0.5 rounded ${valClass}`;
            analSecondary2.textContent = textDiff;
            analDesc2.innerHTML = `Cantidad media de jugadores activos por día.`;
        }

        // Gráfico Secundario (Comparación de PROMENDIOS - Sin Decimales)
        let avgCurrent = currentWeekDates.length > 0 ? Math.round(sumCurrent / currentWeekDates.length) : 0;
        let avgPrev = prevWeekDates.length > 0 ? Math.round(sumPrev / prevWeekDates.length) : 0;
        
        if (secondaryChart) {
            secondaryChart.data.labels = ['S. Anterior', 'S. Actual'];
            secondaryChart.data.datasets = [{
                label: 'Promedio de Picos',
                data: [avgPrev, avgCurrent],
                backgroundColor: ['rgba(255, 255, 255, 0.2)', gradientEmerald],
                borderColor: ['rgba(255, 255, 255, 0.5)', '#34d399'],
                borderWidth: 2, borderRadius: 6
            }];
            secondaryChart.update();
        }

        // Gráfico Principal Expandido (Día por Día Comparativo)
        if (mainChart) {
            mainChart.data.labels = cLabels;
            mainChart.data.datasets = [
                {
                    label: 'Semana Actual',
                    data: cData,
                    backgroundColor: gradientPurple,
                    borderColor: '#c084fc',
                    borderWidth: 2, borderRadius: 6
                },
                {
                    label: 'Semana Anterior',
                    data: pData,
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    borderColor: 'rgba(255, 255, 255, 0.3)',
                    borderWidth: 2, borderRadius: 6,
                    type: 'line',
                    tension: 0.4
                }
            ];
            mainChart.update();
        }
        
    } else if (currentTimeframe === 'month') {
        document.getElementById('secondaryChartContainer').classList.remove('hidden'); // Mostrar gráfico secundario
        
        let targetMonthStr = document.getElementById('monthPicker')?.value;
        if (!targetMonthStr) {
            const lastDate = new Date(dates[dates.length-1]);
            targetMonthStr = lastDate.toISOString().substring(0, 7); 
        }
        
        // Calcular el mes anterior
        const tm = new Date(targetMonthStr + "-01");
        const pm = new Date(tm);
        pm.setMonth(pm.getMonth() - 1);
        const prevMonthStr = pm.toISOString().substring(0, 7);
        
        let currentMonthDays = [];
        let prevMonthDays = [];
        
        dates.forEach(dateStr => {
            const monthStr = dateStr.substring(0, 7); // "YYYY-MM"
            const dayNum = parseInt(dateStr.substring(8, 10), 10);
            
            let peakOfDay = 0;
            for (const h in historyData[dateStr]) {
                if (historyData[dateStr][h] > peakOfDay) peakOfDay = historyData[dateStr][h];
            }
            
            if (monthStr === targetMonthStr) {
                currentMonthDays.push({ date: dateStr, day: dayNum, peak: peakOfDay });
            } else if (monthStr === prevMonthStr) {
                prevMonthDays.push({ date: dateStr, day: dayNum, peak: peakOfDay });
            }
        });

        // Configurar Títulos
        document.getElementById('tableTitle').innerHTML = '<i class="fa-solid fa-calendar-days text-blue-400"></i> Días del Mes Sel.';
        document.getElementById('secondaryChartTitle').innerHTML = '<i class="fa-solid fa-code-compare text-blue-400"></i> Crecimiento (Mes vs Ant.)';
        document.getElementById('mainChartTitle').innerHTML = '<i class="fa-solid fa-chart-area text-purple-400"></i> Rendimiento de Mes: ' + targetMonthStr;

        // Tarjetas Analíticas de Mes (Semana a Semana y Promedios sin decimales)
        if (analContainer) {
            analContainer.classList.remove('hidden');
            
            // 1. Promedio General del Mes sin decimales
            let sumCurrMonth = 0, sumPrevMonth = 0;
            currentMonthDays.forEach(x => sumCurrMonth += x.peak);
            prevMonthDays.forEach(x => sumPrevMonth += x.peak);
            
            let avgCurrMonth = currentMonthDays.length > 0 ? Math.round(sumCurrMonth / currentMonthDays.length) : 0;
            let avgPrevMonth = prevMonthDays.length > 0 ? Math.round(sumPrevMonth / prevMonthDays.length) : 0;
            
            let pDiff = 0;
            if (avgPrevMonth > 0) {
                pDiff = Math.round(((avgCurrMonth - avgPrevMonth) / avgPrevMonth) * 100);
            }
            
            let mClass = pDiff > 0 ? "bg-emerald-500/20 text-emerald-400" : (pDiff < 0 ? "bg-red-500/20 text-red-400" : "bg-gray-700 text-gray-300");
            let mSign = pDiff > 0 ? "+" : "";
            let textMDiff = pDiff === 0 ? "Sin cambios vs mes anterior" : `${mSign}${pDiff}% vs mes pasado`;

            analTitle1.textContent = "Promedio del Mes";
            analIcon1.className = "fa-solid fa-users";
            analValue1.textContent = avgCurrMonth;
            analSecondary1.className = `text-sm font-medium mb-1 px-2 py-0.5 rounded ${mClass}`;
            analSecondary1.textContent = textMDiff;
            analDesc1.innerHTML = `Cantidad media de jugadores diarios este mes.`;

            // 2. Mejor Semana del Mes
            // Lo dividimos en "chunks" de 7 días (Días 1-7, 8-14, etc.)
            let weekSums = [0,0,0,0,0];
            let weekCounts = [0,0,0,0,0];
            currentMonthDays.forEach(dInfo => {
                let wIdx = Math.floor((dInfo.day - 1) / 7);
                if (wIdx > 4) wIdx = 4; // Agrupar los últimos días
                weekSums[wIdx] += dInfo.peak;
                weekCounts[wIdx]++;
            });
            
            let bestWeekIdx = -1;
            let bestWeekAvg = -1;
            for(let i=0; i<5; i++){
                if (weekCounts[i] > 0) {
                    let wAvg = Math.round(weekSums[i] / weekCounts[i]);
                    if (wAvg > bestWeekAvg) {
                        bestWeekAvg = wAvg;
                        bestWeekIdx = i;
                    }
                }
            }
            
            let wName = bestWeekIdx >= 0 ? `Semana ${bestWeekIdx + 1}` : "N/A";
            analTitle2.textContent = "Semana Más Fuerte";
            analIcon2.className = "fa-solid fa-fire";
            analValue2.textContent = bestWeekAvg > 0 ? bestWeekAvg : "--";
            analSecondary2.className = "text-sm font-medium mb-1 px-2 py-0.5 rounded bg-orange-500/20 text-orange-400";
            analSecondary2.textContent = wName;
            analDesc2.innerHTML = `El promedio más alto logrado en 7 días seguidos.`;
        }

        // 1. Llenar Tabla con los días del mes actual (Orden Inverso)
        for (let i = currentMonthDays.length - 1; i >= 0; i--) {
            const item = currentMonthDays[i];
            const d = new Date(item.date);
            const userTimezoneOffset = d.getTimezoneOffset() * 60000;
            const localDate = new Date(d.getTime() + userTimezoneOffset);
            const formattedDate = localDate.toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'short' });
            
            if(tableBody) {
                const tr = document.createElement('tr');
                tr.className = 'hover:bg-white/5 transition-colors group';
                tr.innerHTML = `
                    <td class="px-6 py-4 whitespace-nowrap group-hover:text-white transition-colors capitalize">${formattedDate}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-center font-bold text-cyan-400">${item.peak}</td>
                `;
                tableBody.appendChild(tr);
            }
        }
        
        // 2. Procesar datos para gráficos "Día x" vs "Día x"
        // Determinar cuántos días tiene el mes actual (máximo 31)
        const daysInMonth = new Date(tm.getFullYear(), tm.getMonth() + 1, 0).getDate();
        
        const mLabels = [];
        const cData = [];
        const pData = [];
        let sumCurrent = 0, countCurrent = 0;
        let sumPrev = 0, countPrev = 0;
        
        for (let d = 1; d <= daysInMonth; d++) {
            mLabels.push(`Día ${d}`);
            
            // Buscar día d en mes actual
            const cItem = currentMonthDays.find(x => x.day === d);
            if (cItem) {
                cData.push(cItem.peak);
                sumCurrent += cItem.peak;
                countCurrent++;
            } else {
                cData.push(0);
            }
            
            // Buscar día d en mes anterior
            const pItem = prevMonthDays.find(x => x.day === d);
            if (pItem) {
                pData.push(pItem.peak);
                sumPrev += pItem.peak;
                countPrev++;
            } else {
                pData.push(0); // Relleno visual
            }
        }
        
        // Gráfico Secundario (Comparación de Promedios del Mes - Sin Decimales)
        let avgCurrentM = countCurrent > 0 ? Math.round(sumCurrent / countCurrent) : 0;
        let avgPrevM = countPrev > 0 ? Math.round(sumPrev / countPrev) : 0;
        
        if (secondaryChart) {
            secondaryChart.data.labels = ['Mes Anterior', 'Mes Actual'];
            secondaryChart.data.datasets = [{
                label: 'Promedio de Picos',
                data: [avgPrevM, avgCurrentM],
                backgroundColor: ['rgba(255, 255, 255, 0.2)', gradientBlue],
                borderColor: ['rgba(255, 255, 255, 0.5)', '#60a5fa'],
                borderWidth: 2, borderRadius: 6
            }];
            secondaryChart.update();
        }

        // 3. Gráfico Principal Expandido (Días de este mes vs mes anterior)
        if (mainChart) {
            mainChart.data.labels = mLabels;
            mainChart.data.datasets = [
                {
                    label: 'Mes Actual',
                    data: cData,
                    backgroundColor: gradientPurple,
                    borderColor: '#c084fc',
                    borderWidth: 2, borderRadius: 6
                },
                {
                    label: 'Mes Anterior',
                    data: pData,
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    borderColor: 'rgba(255, 255, 255, 0.3)',
                    borderWidth: 2, borderRadius: 6,
                    type: 'line',
                    tension: 0.4
                }
            ];
            mainChart.update();
        }
    }
}

function setTimeframe(tf) {
    currentTimeframe = tf;
    
    // Controlar visibilidad de los Pickers
    const pContainer = document.getElementById('pickersContainer');
    const wContainer = document.getElementById('weekPickerContainer');
    const mContainer = document.getElementById('monthPickerContainer');
    
    if (tf === 'day') {
        pContainer.classList.add('hidden');
    } else {
        pContainer.classList.remove('hidden');
        if (tf === 'week') {
            wContainer.classList.remove('hidden');
            mContainer.classList.add('hidden');
        } else {
            wContainer.classList.add('hidden');
            mContainer.classList.remove('hidden');
        }
    }
    
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

let mainChart;
let secondaryChart;
let gradientPurple, gradientEmerald, gradientBlue;

function initCharts() {
    // Configuración de Gráfico Principal (Abajo Expandido)
    const ctxMain = document.getElementById('mainChart')?.getContext('2d');
    gradientPurple = ctxMain?.createLinearGradient(0, 0, 0, 400);
    if(gradientPurple) {
        gradientPurple.addColorStop(0, 'rgba(192, 132, 252, 0.6)'); // Purple
        gradientPurple.addColorStop(1, 'rgba(192, 132, 252, 0.1)');
    }

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
    gradientEmerald = ctxSecondary?.createLinearGradient(0, 0, 0, 400);
    if(gradientEmerald) {
        gradientEmerald.addColorStop(0, 'rgba(52, 211, 153, 0.6)'); // Emerald
        gradientEmerald.addColorStop(1, 'rgba(52, 211, 153, 0.1)');
    }
    // Nuevo gradiente azul para el mes
    gradientBlue = ctxSecondary?.createLinearGradient(0, 0, 0, 400);
    if(gradientBlue) {
        gradientBlue.addColorStop(0, 'rgba(96, 165, 250, 0.6)'); // Blue
        gradientBlue.addColorStop(1, 'rgba(96, 165, 250, 0.1)');
    }

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
    
    // Inicializar gráficos crudos de Chart.js primero
    initCharts();

    // Cargar gráficos históricos de GitHub Actions
    fetchHistory();
    
    fetchServerData();
    startTimer();
};
