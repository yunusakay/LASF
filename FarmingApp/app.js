// 1. GRAFİK KURULUMU
const ctx = document.getElementById('hydroChart').getContext('2d');
const hydroChart = new Chart(ctx, {
    type: 'line',
    data: {
        labels: [],
        datasets: [
            { label: 'Kabin Sıcaklığı (°C)', borderColor: '#f87171', backgroundColor: 'rgba(248,113,113,0.1)', fill: true, data: [], tension: 0.4, yAxisID: 'y' },
            { label: 'Kabin Nemi (%)', borderColor: '#38bdf8', backgroundColor: 'rgba(56,189,248,0.1)', fill: true, data: [], tension: 0.4, yAxisID: 'y1' }
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
    term.scrollTop = term.scrollHeight; // Otomatik aşağı kaydır
}

// 2. NODE-RED WEBSOCKET BAĞLANTISI (Ana Veri Akışı)
const ws = new WebSocket('ws://localhost:1880/ws/telemetry');

ws.onopen = function () {
    console.log("Node-RED'e başarıyla bağlanıldı!");
    const statusEl = document.getElementById('connection-status');
    statusEl.textContent = "Node-RED Canlı Veri (NASA VEG-01C)";
    statusEl.className = "status-online";
    logTerminal("Sistem Çevrimiçi: Python ve NASA Telemetri verisi alınıyor...", "normal");
};

ws.onmessage = function (event) {
    const data = JSON.parse(event.data);

    // 1. ÜST KARTLARI (KPI) GÜNCELLE
    document.getElementById('val-temp').textContent = data.chamber_temperature.toFixed(1) + " °C";
    document.getElementById('val-hum').textContent = data.chamber_humidity.toFixed(1) + " %";
    document.getElementById('val-water').textContent = data.water_tank_liters.toFixed(1) + " L";

    // NPK Değerlerini birleştirerek göster
    document.getElementById('val-npk').textContent = `N:${data.mineral_n.toFixed(0)} P:${data.mineral_p.toFixed(0)} K:${data.mineral_k.toFixed(0)}`;

    // 2. ALT PANELİ GÜNCELLE (Zaman ve AI Önerisi)
    document.getElementById('nasa-time').textContent = data.current_time;
    document.getElementById('ai-status').textContent = data.ai_recommendation;

    // 3. AKTİVASYON PANELİ ROZETLERİNİ GÜNCELLE
    function updateBadge(id, isActive, activeText) {
        const badge = document.getElementById(id);
        if (isActive) {
            if (badge.innerText !== activeText) {
                badge.className = "badge badge-active";
                badge.innerText = activeText;
            }
        } else {
            if (badge.innerText !== "BEKLEMEDE") {
                badge.className = "badge badge-standby";
                badge.innerText = "BEKLEMEDE";
            }
        }
    }

    // Node-RED'deki otonom mantığın arayüze yansıması
    updateBadge('status-fan', data.chamber_temperature > 24.5, 'ÇALIŞIYOR');
    updateBadge('status-dehumidifier', data.chamber_humidity > 60.0, 'SU TOPLUYOR');
    updateBadge('status-npk', data.ai_recommendation.includes("Ekle"), 'DOZLUYOR');

    // 4. GRAFİĞİ GÜNCELLE
    hydroChart.data.labels.push(data.current_time);
    hydroChart.data.datasets[0].data.push(data.chamber_temperature);
    hydroChart.data.datasets[1].data.push(data.chamber_humidity);

    if (hydroChart.data.labels.length > 20) {
        hydroChart.data.labels.shift();
        hydroChart.data.datasets[0].data.shift();
        hydroChart.data.datasets[1].data.shift();
    }
    hydroChart.update();
};

ws.onerror = function (error) {
    document.getElementById('connection-status').textContent = "Node-RED Bekleniyor...";
    document.getElementById('connection-status').className = "status-offline";
};

ws.onclose = function () {
    logTerminal("Sistem Uyarısı: Node-RED bağlantısı kesildi.", "crit");
};

// 3. JÜRİ İÇİN MANUEL TEST BUTONLARI (Python'a POST Gönderir)
async function toggleDevice(deviceName, actionState) {
    try {
        await fetch("http://localhost:8000/api/device", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ device: deviceName, action: actionState })
        });

        logTerminal(`MANUEL MÜDAHALE: ${deviceName} durumu ${actionState ? 'AÇIK' : 'KAPALI'} yapıldı.`, actionState ? "warn" : "normal");

    } catch (error) {
        logTerminal("HATA: Python sunucusuna ulaşılamıyor! (Manuel Komut İletilemedi)", "crit");
    }
}