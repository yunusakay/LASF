// 1. GRAFİK KURULUMU (Sıcaklık ve Nem)
const ctx = document.getElementById('hydroChart').getContext('2d');
const hydroChart = new Chart(ctx, {
    type: 'line',
    data: {
        labels: [],
        datasets: [
            { label: 'Kabin Sıcaklığı (°C)', borderColor: '#f87171', data: [], tension: 0.4, yAxisID: 'y' },
            { label: 'Kabin Nemi (%)', borderColor: '#38bdf8', data: [], tension: 0.4, yAxisID: 'y1' }
        ]
    },
    options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        scales: {
            y: { type: 'linear', display: true, position: 'left', min: 15, max: 30, title: { display: true, text: 'Sıcaklık' } },
            y1: { type: 'linear', display: true, position: 'right', min: 20, max: 100, title: { display: true, text: 'Nem' } }
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

// 2. PYTHON API ENTEGRASYONU
async function fetchHydroData() {
    try {
        const response = await fetch('http://localhost:8000/api/sensors');
        if (!response.ok) throw new Error('API Hatası');
        
        let simData = await response.json(); 
        
        document.getElementById('connection-status').textContent = "Simülasyona Bağlı";
        document.getElementById('connection-status').className = "status-online";

        // Arayüzü Güncelle
        document.getElementById('val-temp').textContent = simData.chamber_temperature.toFixed(1) + " °C";
        document.getElementById('val-hum').textContent = simData.chamber_humidity.toFixed(1) + " %";
        document.getElementById('val-water').textContent = simData.water_tank_liters.toFixed(2) + " L";
        document.getElementById('val-biomass').textContent = simData.plant_biomass_kg.toFixed(4) + " kg";
        
        document.getElementById('nasa-time').textContent = simData.current_time;
        document.getElementById('sys-status').textContent = simData.system_status;

        // Grafiğe Veri Ekle
        const now = new Date().toLocaleTimeString();
        hydroChart.data.labels.push(now);
        hydroChart.data.datasets[0].data.push(simData.chamber_temperature);
        hydroChart.data.datasets[1].data.push(simData.chamber_humidity);

        if (hydroChart.data.labels.length > 20) {
            hydroChart.data.labels.shift();
            hydroChart.data.datasets[0].data.shift();
            hydroChart.data.datasets[1].data.shift();
        }
        hydroChart.update();

    } catch (error) {
        console.error(error);
        document.getElementById('connection-status').textContent = "Sunucu Bekleniyor...";
        document.getElementById('connection-status').className = "status-offline";
    }
}

// 3. IOT CİHAZ KONTROLÜ (POST REQUEST)
async function toggleDevice(deviceName, actionState) {
    try {
        await fetch("http://localhost:8000/api/device", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ device: deviceName, action: actionState })
        });
        
        logTerminal(`MANUEL KONTROL: ${deviceName} durumu ${actionState ? 'AÇIK' : 'KAPALI'} yapıldı.`, actionState ? "warn" : "normal");
        
        // Arayüz Badge Güncelleme
        const badgeId = deviceName === 'ventilation_fan' ? 'status-fan' : (deviceName === 'aerogel_collector' ? 'status-aerogel' : 'status-pump');
        const badge = document.getElementById(badgeId);
        if (actionState) {
            badge.className = "badge badge-active";
            badge.innerText = "AKTİF";
        } else {
            badge.className = "badge badge-standby";
            badge.innerText = "BEKLEMEDE";
        }
    } catch (err) {
        logTerminal("Cihaz kontrol hatası! Sunucuya ulaşılamıyor.", "crit");
    }
}

// Saniyede bir verileri çek
setInterval(fetchHydroData, 1000);