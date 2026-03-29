/**
 * KOTA Dashboard — app.js v2.0
 * LASF Low Atmosphere Satellite Farming
 */

'use strict';

const API_BASE      = 'http://127.0.0.1:8000';
const POLL_INTERVAL = 1000;
const CHART_WINDOW  = 60;

const DEVICE_LABELS = {
    ventilation_fan: 'Havalandırma Fanı',
    dehumidifier:    'Nem Toplayıcı',
    chiller:         'Su Soğutucu',
    ph_doser:        'pH Düzenleyici',
    npk_doser:       'NPK Gübre Dozlayıcı',
};

const STRESS_LABELS = {
    NORMAL:         { text: 'NORMAL',        cls: 'badge-standby' },
    LIGHT_STRESS:   { text: 'IŞIK STRESİ',   cls: 'badge-alert'   },
    OSMOTIC_STRESS: { text: 'OZMOTİK STRES', cls: 'badge-alert'   },
    RECOVERY:       { text: 'İYİLEŞME',      cls: 'badge-active'  },
};

const CROP_COLORS = {
    LETTUCE:    '#4ade80',
    STRAWBERRY: '#f472b6',
    POTATO:     '#fbbf24',
    DEPLETED:   '#f87171',
    NONE:       '#94a3b8',
};

// ---------------------------------------------------------------------------
// CHARTS (GRAFİKLER)
// ---------------------------------------------------------------------------

const hydroChart = new Chart(document.getElementById('hydroChart').getContext('2d'), {
    type: 'line',
    data: {
        labels: [],
        datasets: [
            { label: 'Sıcaklık (°C)', borderColor: '#f87171', backgroundColor: 'rgba(248,113,113,0.08)', fill: true, data: [], tension: 0.4, pointRadius: 0 },
            { label: 'Nem (%)',borderColor: '#38bdf8',backgroundColor: 'rgba(56,189,248,0.08)', fill: true, data: [], tension: 0.4, pointRadius: 0 }
        ]
    },
    options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        scales: {
<<<<<<< HEAD
            x:  { display: false },
            y:  { type: 'linear', position: 'left', min: 18, max: 28 },
            y1: { type: 'linear', position: 'right', min: 30, max: 90, grid: { drawOnChartArea: false } }
=======
            x:  { ticks: { color: '#64748b', maxTicksLimit: 8, font: { size: 11 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
            y:  { type: 'linear', position: 'left',  min: 18, max: 30, title: { display: true, text: 'Sıcaklık (°C)', color: '#f87171' }, ticks: { color: '#f87171' }, grid: { color: 'rgba(255,255,255,0.04)' } },
            y1: { type: 'linear', position: 'right', min: 30, max: 95, title: { display: true, text: 'Nem (%)',       color: '#38bdf8' }, ticks: { color: '#38bdf8' }, grid: { drawOnChartArea: false } },
>>>>>>> 4e81728d43b2451143da7c4b7ad22a2dddc98b71
        },
        plugins: { legend: { labels: { color: '#94a3b8' } } }
    }
});

const npkChart = new Chart(document.getElementById('npkChart').getContext('2d'), {
    type: 'line',
    data: {
        labels: [],
        datasets: [
<<<<<<< HEAD
            { label: 'Azot (N)',     borderColor: '#4ade80', fill: false, data: [], tension: 0.4, pointRadius: 0 },
            { label: 'Fosfor (P)',   borderColor: '#fb923c', fill: false, data: [], tension: 0.4, pointRadius: 0 },
            { label: 'Potasyum (K)', borderColor: '#a78bfa', fill: false, data: [], tension: 0.4, pointRadius: 0 }
        ]
=======
            { label: 'Azot N (ppm)',     borderColor: '#4ade80', backgroundColor: 'rgba(74,222,128,0.08)',  fill: false, data: [], tension: 0.4, pointRadius: 0 },
            { label: 'Fosfor P (ppm)',   borderColor: '#fb923c', backgroundColor: 'rgba(251,146,60,0.08)',  fill: false, data: [], tension: 0.4, pointRadius: 0 },
            { label: 'Potasyum K (ppm)', borderColor: '#a78bfa', backgroundColor: 'rgba(167,139,250,0.08)', fill: false, data: [], tension: 0.4, pointRadius: 0 },
        ],
>>>>>>> 4e81728d43b2451143da7c4b7ad22a2dddc98b71
    },
    options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        scales: {
            x: { display: false },
            y: { min: 0, max: 200, title: { display: true, text: 'ppm', color: '#94a3b8' } }
        },
        plugins: { legend: { labels: { color: '#94a3b8' } } }
    }
});

// ---------------------------------------------------------------------------
<<<<<<< HEAD
// HELPERS (Arayüz Yardımcıları - YENİ VE PARLAK)
=======
// TERMINAL
// ---------------------------------------------------------------------------

const MAX_TERMINAL_LINES = 80;

function logTerminal(msg, type = 'normal') {
    const term = document.getElementById('terminal');
    if (!term) return;
    const entry = document.createElement('div');
    const time  = new Date().toLocaleTimeString('tr-TR');
    entry.className   = type === 'warn' ? 'log-warn' : type === 'crit' ? 'log-crit' : '';
    entry.textContent = `> [${time}] ${msg}`;
    term.appendChild(entry);
    while (term.children.length > MAX_TERMINAL_LINES) term.removeChild(term.firstChild);
    term.scrollTop = term.scrollHeight;
}

// ---------------------------------------------------------------------------
// UI HELPERS
>>>>>>> 4e81728d43b2451143da7c4b7ad22a2dddc98b71
// ---------------------------------------------------------------------------

function setBadge(id, isActive) {
    const el = document.getElementById(id);
    if (!el) return;
    
    el.textContent = isActive ? 'ÇALIŞIYOR' : 'BEKLEMEDE';
    el.className   = `badge ${isActive ? 'badge-active' : 'badge-standby'}`;
<<<<<<< HEAD
    
    // Çalışıyorsa Fosforlu Yeşil, Bekliyorsa Gri olsun
    if(isActive) { 
        el.style.background = "#4ade80"; 
        el.style.color = "#000"; 
        el.style.boxShadow = "0 0 10px #4ade80"; // Havalı parlama efekti
    } else { 
        el.style.background = "#334155"; 
        el.style.color = "#94a3b8"; 
        el.style.boxShadow = "none";
    }
=======
>>>>>>> 4e81728d43b2451143da7c4b7ad22a2dddc98b71
}

function setNpkBar(id, value, max=200) {
    const el = document.getElementById(id);
    if (!el) return;
<<<<<<< HEAD
    el.style.width = Math.min(100, Math.max(0, (value / max) * 100)) + '%';
=======
    el.style.width      = Math.min(100, Math.max(0, (value / max) * 100)).toFixed(1) + '%';
    el.style.background = value < 40 ? '#f87171' : value < 80 ? '#fbbf24' : '#4ade80';
>>>>>>> 4e81728d43b2451143da7c4b7ad22a2dddc98b71
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function logTerminal(msg, type = 'normal') {
    const term = document.getElementById('terminal');
    const entry = document.createElement('div');
    entry.textContent = `> [${new Date().toLocaleTimeString('tr-TR')}] ${msg}`;
    entry.className = type === 'warn' ? 'log-warn' : '';
    term.appendChild(entry);
    term.scrollTop = term.scrollHeight;
}

// ---------------------------------------------------------------------------
// MAIN FETCH (Canlı Veri Çekme)
// ---------------------------------------------------------------------------

<<<<<<< HEAD
=======
let _prevCrop    = null;
let _prevStress  = null;
let _prevDevices = {};

// DÜZELTİLDİ: Pseudocode '...' kaldırıldı, gerçek JS yazıldı
function _logChanges(d) {
    if (d.ai_crop !== _prevCrop && _prevCrop !== null)
        logTerminal(`AI ÖNERİ DEĞİŞTİ: ${_prevCrop} → ${d.ai_crop}`, 'warn');
    _prevCrop = d.ai_crop;

    if (d.stress_phase !== _prevStress && _prevStress !== null)
        logTerminal(`STRES DURUMU: ${_prevStress} → ${d.stress_phase}`, d.stress_phase === 'NORMAL' ? 'normal' : 'warn');
    _prevStress = d.stress_phase;

    if (d.devices) {
        for (const [dev, active] of Object.entries(d.devices)) {
            if (_prevDevices[dev] !== undefined && _prevDevices[dev] !== active)
                logTerminal(`CİHAZ: ${DEVICE_LABELS[dev] || dev} → ${active ? 'AÇIK' : 'KAPALI'}`, active ? 'warn' : 'normal');
        }
        _prevDevices = { ...d.devices };
    }

    if (d.alerts?.length > 0) d.alerts.forEach(a => logTerminal(a, 'crit'));
}

// ---------------------------------------------------------------------------
// MAIN FETCH
// ---------------------------------------------------------------------------

let _isFirstFetch = true;

>>>>>>> 4e81728d43b2451143da7c4b7ad22a2dddc98b71
async function fetchAndUpdate() {
    try {
        const res = await fetch(`${API_BASE}/api/sensors`);
        if (!res.ok) throw new Error('API Bağlantı Hatası');
        const d = await res.json();

        // Bağlantı Durumu
        document.getElementById('connection-status').textContent = `Python Motoruna Bağlı | Uzay Saati: ${d.current_time}`;
        document.getElementById('connection-status').className = 'status-online';

<<<<<<< HEAD
        // Sol Panel
        setText('nasa-time', d.current_time);

        // Hızlı Sensörler
        setText('val-temp', d.chamber_temperature.toFixed(1) + ' °C');
        setText('val-hum',  d.chamber_humidity.toFixed(1) + ' %');
        setText('val-ph',   d.ph.toFixed(2));
        setText('val-water',d.water_tank_liters.toFixed(1) + ' L');
=======
        const statusEl = document.getElementById('connection-status');
        if (statusEl) {
            statusEl.textContent = `Uzay Saati: ${d.current_time} | Bağlı`;
            statusEl.className   = 'status-online';
        }

        setText('val-temp',  d.chamber_temperature.toFixed(1) + ' °C');
        setText('val-hum',   d.chamber_humidity.toFixed(1) + ' %');
        setText('val-water', d.water_tank_liters.toFixed(1) + ' L');
        setText('val-ph',    d.ph.toFixed(2));

        const waterEl = document.getElementById('val-water');
        if (waterEl)
            waterEl.style.color = d.water_tank_liters < 4 ? '#f87171' : d.water_tank_liters < 8 ? '#fbbf24' : '#4ade80';
>>>>>>> 4e81728d43b2451143da7c4b7ad22a2dddc98b71

        // NPK Barları
        setText('val-n', d.mineral_n.toFixed(0) + ' ppm');
        setText('val-p', d.mineral_p.toFixed(0) + ' ppm');
        setText('val-k', d.mineral_k.toFixed(0) + ' ppm');
        setNpkBar('bar-n', d.mineral_n);
        setNpkBar('bar-p', d.mineral_p);
        setNpkBar('bar-k', d.mineral_k);

<<<<<<< HEAD
        // AI ve Statü
        setText('ai-status', d.ai_recommendation);
        setBadge('status-fan', d.devices?.ventilation_fan);
        setBadge('status-dehumidifier', d.devices?.dehumidifier);
        setBadge('status-npk', d.devices?.npk_doser);
        setBadge('status-ph',  d.devices?.ph_doser);

        // Grafikleri Güncelle
        const now = new Date().toLocaleTimeString('tr-TR');
        npkChart.data.labels.push(now);
        npkChart.data.datasets[0].data.push(d.mineral_n);
        npkChart.data.datasets[1].data.push(d.mineral_p);
        npkChart.data.datasets[2].data.push(d.mineral_k);

        if(npkChart.data.labels.length > 30) {
            npkChart.data.labels.shift();
            npkChart.data.datasets.forEach(ds => ds.data.shift());
        }
        npkChart.update('none');

    } catch (err) {
        document.getElementById('connection-status').textContent = "Python Sunucusu Bekleniyor...";
        document.getElementById('connection-status').className = 'status-offline';
=======
        const aiEl = document.getElementById('ai-status');
        if (aiEl) {
            const color       = CROP_COLORS[d.ai_crop] || '#a78bfa';
            aiEl.textContent  = d.ai_recommendation;
            aiEl.style.color  = color;
            aiEl.style.textShadow = `0 0 12px ${color}`;
        }

        const stressInfo = STRESS_LABELS[d.stress_phase] || STRESS_LABELS['NORMAL'];
        const stressEl   = document.getElementById('status-stress');
        if (stressEl) {
            stressEl.textContent = stressInfo.text;
            stressEl.className   = `badge ${stressInfo.cls}`;
        }

        const vpdEl = document.getElementById('val-vpd');
        if (vpdEl) {
            vpdEl.textContent = d.vpd_kpa.toFixed(2) + ' kPa';
            vpdEl.style.color = d.vpd_kpa < 0.4 ? '#f87171' : d.vpd_kpa < 0.8 ? '#fbbf24' : d.vpd_kpa <= 1.2 ? '#4ade80' : d.vpd_kpa <= 1.6 ? '#fbbf24' : '#f87171';
        }

        setText('val-harvested',     d.water_harvested_total.toFixed(1) + ' L');
        setText('val-npk-doses',     d.npk_doses_given);
        setText('val-stress-cycles', d.stress_cycles_completed);
        setText('val-ppfd',          d.light_ppfd.toFixed(0) + ' μmol/m²/s');
        setText('val-ec',            d.ec.toFixed(2) + ' mS/cm');
        setText('nasa-time',         d.current_time);

        if (d.devices) {
            setBadge('status-fan',          d.devices.ventilation_fan);
            setBadge('status-dehumidifier', d.devices.dehumidifier);
            setBadge('status-chiller',      d.devices.chiller);
            setBadge('status-ph',           d.devices.ph_doser);
            setBadge('status-npk',          d.devices.npk_doser);
        }

        document.body.classList.toggle('red-alert-mode',
            d.water_tank_liters < 4 || d.mineral_n < 20 || d.mineral_k < 20 || d.ph > 7.5 || d.chamber_humidity > 80
        );

        const ts = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        pushChart(hydroChart, ts, d.chamber_temperature, d.chamber_humidity);
        pushChart(npkChart,   ts, d.mineral_n, d.mineral_p, d.mineral_k);

        // DÜZELTİLDİ: try bloğu içinde, d erişilebilir durumda
        for (let i = 1; i <= 4; i++) {
            const selectEl = document.getElementById(`crop-select-${i}`);
            if (!selectEl) continue;
            const selectedCrop = selectEl.value;
            let growth = 0, color = '#64748b';
            if (selectedCrop === 'marul') {
                growth = Math.min(100, d.chamber_humidity * 0.85);
                color  = '#4ade80';
            } else if (selectedCrop === 'patates') {
                growth = Math.min(100, (d.mineral_k / 250) * 100);
                color  = '#fbbf24';
            } else if (selectedCrop === 'soya') {
                growth = Math.min(100, (d.mineral_n / 200) * 100);
                color  = '#38bdf8';
            }
            const progEl = document.getElementById(`crop-prog-${i}`);
            if (progEl) {
                progEl.style.width      = `${growth.toFixed(1)}%`;
                progEl.style.background = color;
                progEl.style.boxShadow  = `0 0 10px ${color}`;
            }
        }

        _logChanges(d);

    } catch (err) {
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

// ---------------------------------------------------------------------------
// DEVICE CONTROLS
// ---------------------------------------------------------------------------

async function toggleDevice(deviceName, actionState) {
    try {
        const res = await fetch(`${API_BASE}/api/device`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ device: deviceName, action: actionState }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        logTerminal(`MANUEL: ${DEVICE_LABELS[deviceName] || deviceName} → ${actionState ? 'AÇIK' : 'KAPALI'}`, actionState ? 'warn' : 'normal');
    } catch {
        logTerminal('HATA: Python sunucusuna komut gönderilemedi!', 'crit');
>>>>>>> 4e81728d43b2451143da7c4b7ad22a2dddc98b71
    }
}

async function releaseToAuto() {
    try {
        await fetch(`${API_BASE}/api/auto`, { method: 'POST' });
        logTerminal('SİSTEM: Tüm cihazlar otonom kontrole bırakıldı.', 'warn');
    } catch { logTerminal('HATA: Python sunucusuna ulaşılamıyor.', 'warn'); }
}

// Sistemi Başlat
logTerminal('LASF KOTA Dashboard v2.0 başlatıldı.');
fetchAndUpdate();
<<<<<<< HEAD
setInterval(fetchAndUpdate, POLL_INTERVAL);
=======
setInterval(fetchAndUpdate, POLL_INTERVAL);

// Arayüzden bitki değiştirildiğinde ikonu anında günceller
window.updateCropIcon = function (slotIndex) {
    const val    = document.getElementById(`crop-select-${slotIndex}`).value;
    const iconEl = document.getElementById(`crop-icon-${slotIndex}`);
    if (val === 'marul')        iconEl.textContent = '🥬';
    else if (val === 'patates') iconEl.textContent = '🥔';
    else if (val === 'soya')    iconEl.textContent = '🌱';
};
>>>>>>> 4e81728d43b2451143da7c4b7ad22a2dddc98b71
