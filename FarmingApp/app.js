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

async function fetchHydroData() {
    try {
        const response = await fetch('http://localhost:8000/api/sensors');
        if (!response.ok) throw new Error('API Hatası');
        let simData = await response.json(); 
        
        document.getElementById('connection-status').textContent = `Uzay Saati: ${simData.current_time} | Python'a Bağlı`;
        document.getElementById('connection-status').className = "status-online";

        // HTML içindeki doğru ID'leri güncelliyoruz (Eski HTML'inize uygun olarak)
document.getElementById('val-temp').textContent = simData.chamber_temperature.toFixed(1) + " °C";
        document.getElementById('val-hum').textContent = simData.chamber_humidity.toFixed(1) + " %";
        document.getElementById('val-water').textContent = simData.water_tank_liters.toFixed(2) + " L";
        document.getElementById('val-biomass').textContent = "Hidroponik"; // Biomass yerine sistem tipi
        document.getElementById('val-n').textContent = simData.mineral_n.toFixed(0);
        document.getElementById('val-p').textContent = simData.mineral_p.toFixed(0);
        document.getElementById('val-k').textContent = simData.mineral_k.toFixed(0);
        document.getElementById('val-ai').textContent = simData.ai_recommendation;

        // Grafiği Güncelle
        const now = new Date().toLocaleTimeString();
        hydroChart.data.labels.push(now);
        hydroChart.data.datasets[0].data.push(simData.chamber_temperature);
        hydroChart.data.datasets[1].data.push(simData.chamber_humidity);

        if (hydroChart.data.labels.length > 15) {
            hydroChart.data.labels.shift();
            hydroChart.data.datasets[0].data.shift();
            hydroChart.data.datasets[1].data.shift();
        }
        hydroChart.update();

    } catch (error) {
        document.getElementById('connection-status').textContent = "Python Sunucusu Bekleniyor...";
        document.getElementById('connection-status').className = "status-offline";
    }
}

async function toggleDevice(deviceName, actionState) {
    try {
        await fetch("http://localhost:8000/api/device", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ device: deviceName, action: actionState })
        });
        
        logTerminal(`MANUEL MÜDAHALE: ${deviceName} durumu ${actionState ? 'AÇIK' : 'KAPALI'} yapıldı.`, actionState ? "warn" : "normal");
        
        const badgeId = deviceName === 'ventilation_fan' ? 'status-fan' : (deviceName === 'dehumidifier' ? 'status-aerogel' : 'status-pump');
        const badge = document.getElementById(badgeId);
        if (actionState) {
            badge.className = "badge badge-active";
            badge.innerText = "AKTİF";
        } else {
            badge.className = "badge badge-standby";
            badge.innerText = "BEKLEMEDE";
        }
    } catch (err) {
        logTerminal("Bağlantı Hatası: Komut gönderilemedi.", "crit");
    }
}

setInterval(fetchHydroData, 1000);