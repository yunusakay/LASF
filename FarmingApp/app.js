// 1. GRAFİK KURULUMU
const ctx = document.getElementById('hydroChart').getContext('2d');
const hydroChart = new Chart(ctx, {
    type: 'line',
    data: {
        labels: [],
        datasets: [
            { label: 'Kabin Sıcaklığı (°C)', borderColor: '#f87171', data: [], tension: 0.4 },
            { label: 'Kabin Nemi (%)', borderColor: '#38bdf8', data: [], tension: 0.4, yAxisID: 'y1' }
        ]
    },
    options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        scales: {
            y: { type: 'linear', display: true, position: 'left', min: 18, max: 28, title: { display: true, text: 'Sıcaklık (°C)' } },
            y1: { type: 'linear', display: true, position: 'right', min: 30, max: 90, title: { display: true, text: 'Nem (%)' } }
        },
        plugins: { legend: { labels: { color: '#f8fafc' } } }
    }
});

function logTerminal(msg, type = 'normal') {
    const term = document.getElementById('terminal');
    const time = new Date().toLocaleTimeString();
    let color = type === 'warn' ? 'log-warn' : (type === 'crit' ? 'log-crit' : '');
    term.innerHTML += `<div class="${color}">> [${time}] ${msg}</div>`;
    term.scrollTop = term.scrollHeight;
}

// 2. NODE-RED WEBSOCKET BAĞLANTISI (Ana Veri Akışı)
const ws = new WebSocket('ws://localhost:1880/ws/telemetry');

ws.onopen = function () {
    console.log("Node-RED'e başarıyla bağlanıldı!");
    const statusEl = document.getElementById('connection-status');
    statusEl.textContent = "Node-RED Canlı Veri (NASA VEG-01C)";
    statusEl.className = "status-online";
    logTerminal("Sistem Çevrimiçi: NASA Telemetri verisi alınıyor...", "normal");
};

ws.onmessage = function (event) {
    // Node-RED'den saniyede 2 kez gelen JSON paketini aç
    const data = JSON.parse(event.data);

    // Arayüzdeki kutuları (KPI) güncelle
    document.getElementById('val-temp').textContent = data.chamber_temperature.toFixed(1) + " °C";
    document.getElementById('val-hum').textContent = data.chamber_humidity.toFixed(1) + " %";
    document.getElementById('val-water').textContent = data.water_tank_liters.toFixed(2) + " L";
    document.getElementById('val-biomass').textContent = data.plant_biomass_kg.toFixed(4) + " kg";

    document.getElementById('nasa-time').textContent = data.current_time;
    document.getElementById('sys-status').textContent = data.system_status;

    // OTONOM ZEKA (Sıcaklık çok artarsa fanı aç)
    const fanBadge = document.getElementById('status-fan');
    if (data.chamber_temperature > 24.5) {
        if (fanBadge.innerText !== "AKTİF") {
            fanBadge.className = "badge badge-active";
            fanBadge.innerText = "AKTİF";
            logTerminal(`Kritik Sıcaklık (${data.chamber_temperature.toFixed(1)}°C)! Havalandırma Fanı devrede.`, "warn");
        }
    } else {
        if (fanBadge.innerText !== "BEKLEMEDE") {
            fanBadge.className = "badge badge-standby";
            fanBadge.innerText = "BEKLEMEDE";
            logTerminal("Sıcaklık normale döndü. Fan kapatıldı.", "normal");
        }
    }

    // Grafiğe yeni veriyi ekle
    hydroChart.data.labels.push(data.current_time);
    hydroChart.data.datasets[0].data.push(data.chamber_temperature);
    hydroChart.data.datasets[1].data.push(data.chamber_humidity);

    if (hydroChart.data.labels.length > 20) {
        hydroChart.data.labels.shift();
        hydroChart.data.datasets.forEach(dataset => {
            dataset.data.shift();
        });
    }
    hydroChart.update();
};

ws.onerror = function (error) {
    console.error("WebSocket Hatası:", error);
    document.getElementById('connection-status').textContent = "Node-RED Bekleniyor...";
    document.getElementById('connection-status').className = "status-offline";
};

ws.onclose = function () {
    logTerminal("Sistem Uyarısı: Node-RED bağlantısı kesildi.", "crit");
};

// 3. JÜRİ TEST BUTONLARI (Alt kısımdaki butonların hata vermemesi için)
function toggleDevice(deviceName, actionState) {
    logTerminal(`MANUEL MÜDAHALE: ${deviceName} durumu ${actionState ? 'AÇIK' : 'KAPALI'} yapıldı.`, actionState ? "warn" : "normal");

    const badgeId = deviceName === 'ventilation_fan' ? 'status-fan' : (deviceName === 'aerogel_collector' ? 'status-aerogel' : 'status-pump');
    const badge = document.getElementById(badgeId);
    if (actionState) {
        badge.className = "badge badge-active";
        badge.innerText = "AKTİF";
    } else {
        badge.className = "badge badge-standby";
        badge.innerText = "BEKLEMEDE";
    }
}
