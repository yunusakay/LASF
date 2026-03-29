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
            x:  { display: false },
            y:  { type: 'linear', position: 'left', min: 18, max: 28 },
            y1: { type: 'linear', position: 'right', min: 30, max: 90, grid: { drawOnChartArea: false } }
        },
        plugins: { legend: { labels: { color: '#94a3b8' } } }
    }
});

const npkChart = new Chart(document.getElementById('npkChart').getContext('2d'), {
    type: 'line',
    data: {
        labels: [],
        datasets: [
            { label: 'Azot (N)',     borderColor: '#4ade80', fill: false, data: [], tension: 0.4, pointRadius: 0 },
            { label: 'Fosfor (P)',   borderColor: '#fb923c', fill: false, data: [], tension: 0.4, pointRadius: 0 },
            { label: 'Potasyum (K)', borderColor: '#a78bfa', fill: false, data: [], tension: 0.4, pointRadius: 0 }
        ]
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
// HELPERS (Arayüz Yardımcıları - YENİ VE PARLAK)
// ---------------------------------------------------------------------------

function setBadge(id, isActive) {
    const el = document.getElementById(id);
    if (!el) return;
    
    el.textContent = isActive ? 'ÇALIŞIYOR' : 'BEKLEMEDE';
    el.className   = `badge ${isActive ? 'badge-active' : 'badge-standby'}`;
    
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
}

function setNpkBar(id, value, max=200) {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.width = Math.min(100, Math.max(0, (value / max) * 100)) + '%';
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

async function fetchAndUpdate() {
    try {
        const res = await fetch(`${API_BASE}/api/sensors`);
        if (!res.ok) throw new Error('API Bağlantı Hatası');
        const d = await res.json();

        // Bağlantı Durumu
        document.getElementById('connection-status').textContent = `Python Motoruna Bağlı | Uzay Saati: ${d.current_time}`;
        document.getElementById('connection-status').className = 'status-online';

        // Sol Panel
        setText('nasa-time', d.current_time);

        // Hızlı Sensörler
        setText('val-temp', d.chamber_temperature.toFixed(1) + ' °C');
        setText('val-hum',  d.chamber_humidity.toFixed(1) + ' %');
        setText('val-ph',   d.ph.toFixed(2));
        setText('val-water',d.water_tank_liters.toFixed(1) + ' L');

        // NPK Barları
        setText('val-n', d.mineral_n.toFixed(0) + ' ppm');
        setText('val-p', d.mineral_p.toFixed(0) + ' ppm');
        setText('val-k', d.mineral_k.toFixed(0) + ' ppm');
        setNpkBar('bar-n', d.mineral_n);
        setNpkBar('bar-p', d.mineral_p);
        setNpkBar('bar-k', d.mineral_k);

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
setInterval(fetchAndUpdate, POLL_INTERVAL);