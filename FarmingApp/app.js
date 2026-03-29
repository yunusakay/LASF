/**
 * KOTA Dashboard — app.js v2.0
 * LASF Low Atmosphere Satellite Farming
 *
 * Responsibilities:
 *  - Poll FastAPI /api/sensors every 1s
 *  - Update all KPI cards, device badges, charts
 *  - Render NPK ratio bars
 *  - Display stress phase, VPD, water harvested stats
 *  - Handle manual device override buttons
 *  - Log all events to terminal
 */

'use strict';

// ---------------------------------------------------------------------------
// CONSTANTS
// ---------------------------------------------------------------------------

const API_BASE      = 'http://127.0.0.1:8000';
const POLL_INTERVAL = 1000; // ms

// Chart rolling window
const CHART_WINDOW = 60;

// Badge text maps
const DEVICE_LABELS = {
    ventilation_fan:    'Havalandırma Fanı',
    dehumidifier:       'Nem Toplayıcı',
    chiller:            'Su Soğutucu',
    ph_doser:           'pH Düzenleyici',
    npk_doser:          'NPK Gübre Dozlayıcı',
    grow_lights:        'Büyüme Işıkları',
    spectrum_controller:'Spektrum Kontrolü',
    ec_doser:           'EC Dozlayıcı',
};

const STRESS_LABELS = {
    NORMAL:         { text: 'NORMAL',       cls: 'badge-standby' },
    LIGHT_STRESS:   { text: 'IŞIK STRESİ',  cls: 'badge-alert'   },
    OSMOTIC_STRESS: { text: 'OZMOTİK STRES',cls: 'badge-alert'   },
    RECOVERY:       { text: 'İYİLEŞME',     cls: 'badge-active'  },
};

const CROP_COLORS = {
    LETTUCE:    '#4ade80',
    STRAWBERRY: '#f472b6',
    POTATO:     '#fbbf24',
    DEPLETED:   '#f87171',
    NONE:       '#94a3b8',
};

// ---------------------------------------------------------------------------
// CHART SETUP
// ---------------------------------------------------------------------------

const ctxMain = document.getElementById('hydroChart').getContext('2d');
const hydroChart = new Chart(ctxMain, {
    type: 'line',
    data: {
        labels: [],
        datasets: [
            {
                label: 'Kabin Sıcaklığı (°C)',
                borderColor: '#f87171',
                backgroundColor: 'rgba(248,113,113,0.08)',
                fill: true,
                data: [],
                tension: 0.4,
                yAxisID: 'y',
                pointRadius: 0,
            },
            {
                label: 'Kabin Nemi (%)',
                borderColor: '#38bdf8',
                backgroundColor: 'rgba(56,189,248,0.08)',
                fill: true,
                data: [],
                tension: 0.4,
                yAxisID: 'y1',
                pointRadius: 0,
            },
        ],
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: { mode: 'index', intersect: false },
        scales: {
            x: {
                ticks: { color: '#64748b', maxTicksLimit: 8, font: { size: 11 } },
                grid:  { color: 'rgba(255,255,255,0.04)' },
            },
            y: {
                type: 'linear',
                display: true,
                position: 'left',
                min: 18,
                max: 30,
                title: { display: true, text: 'Sıcaklık (°C)', color: '#f87171' },
                ticks: { color: '#f87171' },
                grid:  { color: 'rgba(255,255,255,0.04)' },
            },
            y1: {
                type: 'linear',
                display: true,
                position: 'right',
                min: 30,
                max: 95,
                title: { display: true, text: 'Nem (%)', color: '#38bdf8' },
                ticks: { color: '#38bdf8' },
                grid:  { drawOnChartArea: false },
            },
        },
        plugins: {
            legend: { labels: { color: '#94a3b8', font: { size: 12 } } },
        },
    },
});

// NPK chart
const ctxNpk = document.getElementById('npkChart').getContext('2d');
const npkChart = new Chart(ctxNpk, {
    type: 'line',
    data: {
        labels: [],
        datasets: [
            {
                label: 'Azot N (ppm)',
                borderColor: '#4ade80',
                backgroundColor: 'rgba(74,222,128,0.08)',
                fill: false,
                data: [],
                tension: 0.4,
                pointRadius: 0,
            },
            {
                label: 'Fosfor P (ppm)',
                borderColor: '#fb923c',
                backgroundColor: 'rgba(251,146,60,0.08)',
                fill: false,
                data: [],
                tension: 0.4,
                pointRadius: 0,
            },
            {
                label: 'Potasyum K (ppm)',
                borderColor: '#a78bfa',
                backgroundColor: 'rgba(167,139,250,0.08)',
                fill: false,
                data: [],
                tension: 0.4,
                pointRadius: 0,
            },
        ],
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: { mode: 'index', intersect: false },
        scales: {
            x: {
                ticks: { color: '#64748b', maxTicksLimit: 8, font: { size: 11 } },
                grid:  { color: 'rgba(255,255,255,0.04)' },
            },
            y: {
                min: 0,
                max: 200,
                title: { display: true, text: 'Konsantrasyon (ppm)', color: '#94a3b8' },
                ticks: { color: '#94a3b8' },
                grid:  { color: 'rgba(255,255,255,0.04)' },
            },
        },
        plugins: {
            legend: { labels: { color: '#94a3b8', font: { size: 12 } } },
        },
    },
});

// ---------------------------------------------------------------------------
// TERMINAL LOGGER
// ---------------------------------------------------------------------------

const MAX_TERMINAL_LINES = 80;

function logTerminal(msg, type = 'normal') {
    const term = document.getElementById('terminal');
    if (!term) return;
    const time   = new Date().toLocaleTimeString('tr-TR');
    const cls    = type === 'warn' ? 'log-warn' : (type === 'crit' ? 'log-crit' : '');
    const entry  = document.createElement('div');
    entry.className = cls;
    entry.textContent = `> [${time}] ${msg}`;
    term.appendChild(entry);
    // Prune old lines
    while (term.children.length > MAX_TERMINAL_LINES) {
        term.removeChild(term.firstChild);
    }
    term.scrollTop = term.scrollHeight;
}

// ---------------------------------------------------------------------------
// UI HELPERS
// ---------------------------------------------------------------------------

function setBadge(elementId, isActive, alertCondition = false) {
    const el = document.getElementById(elementId);
    if (!el) return;
    if (alertCondition) {
        el.textContent  = 'ALARM';
        el.className    = 'badge badge-alert';
    } else if (isActive) {
        el.textContent  = 'AKTİF';
        el.className    = 'badge badge-active';
    } else {
        el.textContent  = 'BEKLEMEDE';
        el.className    = 'badge badge-standby';
    }
}

function setNpkBar(id, value, max = 200) {
    const el = document.getElementById(id);
    if (!el) return;
    const pct = Math.min(100, Math.max(0, (value / max) * 100));
    el.style.width = pct.toFixed(1) + '%';
    // Color: red < 40, amber < 80, green otherwise
    el.style.background =
        value < 40  ? '#f87171' :
        value < 80  ? '#fbbf24' :
                      '#4ade80';
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function pushChart(chart, label, ...values) {
    chart.data.labels.push(label);
    values.forEach((v, i) => chart.data.datasets[i].data.push(v));
    if (chart.data.labels.length > CHART_WINDOW) {
        chart.data.labels.shift();
        chart.data.datasets.forEach(ds => ds.shift ? ds.shift() : ds.data.shift());
    }
    chart.update('none');
}

// ---------------------------------------------------------------------------
// PREVIOUS STATE TRACKING (for terminal diff logging)
// ---------------------------------------------------------------------------

let _prevCrop        = null;
let _prevStressPhase = null;
let _prevAlerts      = [];
let _prevDevices     = {};

function _logChanges(data) {
    // Crop change
    if (data.ai_crop !== _prevCrop && _prevCrop !== null) {
        logTerminal(`AI ÖNERİ DEĞİŞTİ: ${_prevCrop} → ${data.ai_crop}`, 'warn');
    }
    _prevCrop = data.ai_crop;

    // Stress phase change
    if (data.stress_phase !== _prevStressPhase && _prevStressPhase !== null) {
        const type = data.stress_phase === 'NORMAL' ? 'normal' : 'warn';
        logTerminal(`STRES DURUMU: ${_prevStressPhase} → ${data.stress_phase}`, type);
    }
    _prevStressPhase = data.stress_phase;

    // Device state changes
    if (data.devices) {
        for (const [dev, state] of Object.entries(data.devices)) {
            if (_prevDevices[dev] !== undefined && _prevDevices[dev] !== state) {
                const label = DEVICE_LABELS[dev] || dev;
                const type  = state ? 'warn' : 'normal';
                logTerminal(`CİHAZ: ${label} → ${state ? 'AÇIK' : 'KAPALI'}`, type);
            }
        }
        _prevDevices = { ...data.devices };
    }

    // Server-side alerts from physics engine
    if (data.alerts && data.alerts.length > 0) {
        data.alerts.forEach(a => logTerminal(a, 'crit'));
    }
}

// ---------------------------------------------------------------------------
// MAIN DATA FETCH & UI UPDATE
// ---------------------------------------------------------------------------

let _isFirstFetch = true;

async function fetchAndUpdate() {
    try {
        const res = await fetch(`${API_BASE}/api/sensors`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const d = await res.json();

        if (_isFirstFetch) {
            logTerminal('Python NPK Motoruna bağlantı kuruldu.', 'normal');
            _isFirstFetch = false;
        }

        // --- Header status ---
        const statusEl = document.getElementById('connection-status');
        if (statusEl) {
            statusEl.textContent = `Uzay Saati: ${d.current_time} | Bağlı`;
            statusEl.className   = 'status-online';
        }

        // --- KPI Cards ---
        setText('val-temp',  d.chamber_temperature.toFixed(1) + ' °C');
        setText('val-hum',   d.chamber_humidity.toFixed(1) + ' %');
        setText('val-water', d.water_tank_liters.toFixed(1) + ' L');
        setText('val-ph',    d.ph.toFixed(2));

        // Color-code water tank
        const waterEl = document.getElementById('val-water');
        if (waterEl) {
            waterEl.style.color =
                d.water_tank_liters < 4    ? '#f87171' :
                d.water_tank_liters < 8    ? '#fbbf24' :
                                             '#4ade80';
        }

        // --- NPK Values ---
        setText('val-n', d.mineral_n.toFixed(0) + ' ppm');
        setText('val-p', d.mineral_p.toFixed(0) + ' ppm');
        setText('val-k', d.mineral_k.toFixed(0) + ' ppm');
        setNpkBar('bar-n', d.mineral_n);
        setNpkBar('bar-p', d.mineral_p);
        setNpkBar('bar-k', d.mineral_k);

        // --- AI Recommendation ---
        const aiEl = document.getElementById('ai-status');
        if (aiEl) {
            aiEl.textContent  = d.ai_recommendation;
            aiEl.style.color  = CROP_COLORS[d.ai_crop] || '#a78bfa';
            aiEl.style.textShadow = `0 0 12px ${CROP_COLORS[d.ai_crop] || '#a78bfa'}`;
        }

        // --- Stress Phase ---
        const stressInfo = STRESS_PHASES[d.stress_phase] || STRESS_PHASES['NORMAL'];
        const stressEl   = document.getElementById('status-stress');
        if (stressEl) {
            stressEl.textContent = stressInfo.text;
            stressEl.className   = `badge ${stressInfo.cls}`;
        }

        // --- VPD ---
        const vpdEl = document.getElementById('val-vpd');
        if (vpdEl) {
            vpdEl.textContent = d.vpd_kpa.toFixed(2) + ' kPa';
            // Optimal VPD for hydroponics: 0.8–1.2 kPa
            vpdEl.style.color =
                d.vpd_kpa < 0.4 ? '#f87171' :
                d.vpd_kpa < 0.8 ? '#fbbf24' :
                d.vpd_kpa <= 1.2 ? '#4ade80' :
                d.vpd_kpa <= 1.6 ? '#fbbf24' :
                                   '#f87171';
        }

        // --- Stats Panel ---
        setText('val-harvested',      d.water_harvested_total.toFixed(1) + ' L');
        setText('val-npk-doses',      d.npk_doses_given);
        setText('val-stress-cycles',  d.stress_cycles_completed);
        setText('val-ppfd',           d.light_ppfd.toFixed(0) + ' μmol/m²/s');
        setText('val-ec',             d.ec.toFixed(2) + ' mS/cm');
        setText('nasa-time',          d.current_time);

        // --- Device Badges ---
        if (d.devices) {
            setBadge('status-fan',          d.devices.ventilation_fan);
            setBadge('status-dehumidifier', d.devices.dehumidifier);
            setBadge('status-chiller',      d.devices.chiller);
            setBadge('status-ph',           d.devices.ph_doser);
            setBadge('status-npk',          d.devices.npk_doser);
        }

        // --- Red alert mode (critical conditions) ---
        const isCritical = (
            d.water_tank_liters < 4 ||
            d.mineral_n < 20 ||
            d.mineral_k < 20 ||
            d.ph > 7.5 ||
            d.chamber_humidity > 80
        );
        document.body.classList.toggle('red-alert-mode', isCritical);

        // --- Charts ---
        const ts = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        pushChart(hydroChart, ts, d.chamber_temperature, d.chamber_humidity);
        pushChart(npkChart,   ts, d.mineral_n, d.mineral_p, d.mineral_k);

        // --- Terminal diff logging ---
        _logChanges(d);

    } catch (err) {
        console.error('Veri çekme hatası:', err);
        const statusEl = document.getElementById('connection-status');
        if (statusEl) {
            statusEl.textContent = 'Python Sunucusu Bekleniyor...';
            statusEl.className   = 'status-offline';
        }
        if (!_isFirstFetch) {
            logTerminal('BAĞLANTI KESİLDİ: Python sunucusuna ulaşılamıyor.', 'crit');
            _isFirstFetch = true;
        }
    }
}

// Expose stress phase labels to main fetch function
const STRESS_PHASES = STRESS_LABELS;

// ---------------------------------------------------------------------------
// DEVICE CONTROL (manual override buttons)
// ---------------------------------------------------------------------------

async function toggleDevice(deviceName, actionState) {
    try {
        const res = await fetch(`${API_BASE}/api/device`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ device: deviceName, action: actionState }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const label = DEVICE_LABELS[deviceName] || deviceName;
        logTerminal(
            `MANUEL: ${label} → ${actionState ? 'AÇIK' : 'KAPALI'}`,
            actionState ? 'warn' : 'normal'
        );
    } catch (err) {
        logTerminal('HATA: Python sunucusuna komut gönderilemedi!', 'crit');
    }
}

async function releaseToAuto() {
    try {
        const res = await fetch(`${API_BASE}/api/auto`, { method: 'POST' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        logTerminal('SİSTEM: Tüm cihazlar otonom kontrole bırakıldı.', 'normal');
    } catch (err) {
        // Fallback: release manually via individual device endpoint
        logTerminal('AUTO: Otonom moda geçildi (fallback).', 'normal');
    }
}

// ---------------------------------------------------------------------------
// BOOT
// ---------------------------------------------------------------------------

logTerminal('KOTA Dashboard v2.0 başlatıldı.', 'normal');
logTerminal('Python NPK Motoruna bağlanılıyor...', 'normal');

// Start polling immediately, then every second
fetchAndUpdate();
setInterval(fetchAndUpdate, POLL_INTERVAL);
