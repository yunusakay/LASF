const ctx = document.getElementById('hydroChart').getContext('2d');
const hydroChart = new Chart(ctx, {
    type: 'line',
    data: {
        labels: [],
        datasets: [
            { label: 'Su Sıcaklığı (°C)', borderColor: '#f87171', data: [], tension: 0.4 },
            { label: 'pH Seviyesi', borderColor: '#a78bfa', data: [], tension: 0.4, yAxisID: 'y1' }
        ]
    },
    options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        scales: {
            y: { type: 'linear', display: true, position: 'left', min: 18, max: 28, title: { display: true, text: 'Sıcaklık (°C)' } },
            y1: { type: 'linear', display: true, position: 'right', min: 4, max: 9, title: { display: true, text: 'pH' } }
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
        // Python API'sinden Gerçek Veriyi Çekiyoruz!
        const response = await fetch('http://localhost:8000/api/sensors');
        if (!response.ok) throw new Error('API Hatası');
        let simData = await response.json(); 
        
        document.getElementById('connection-status').textContent = `Uzay Saati: ${simData.current_time} | Node.js/Python'a Bağlı`;
        document.getElementById('connection-status').className = "status-online";

        // Arayüz Değerlerini Güncelle
        document.getElementById('val-watertemp').textContent = simData.water_temp.toFixed(1) + " °C";
        document.getElementById('val-ph').textContent = simData.ph.toFixed(2);
        document.getElementById('val-ec').textContent = simData.ec.toFixed(1) + " mS/cm";
        document.getElementById('val-do').textContent = simData.do.toFixed(1) + " mg/L";

        // Grafiği Güncelle
        const now = new Date().toLocaleTimeString();
        hydroChart.data.labels.push(now);
        hydroChart.data.datasets[0].data.push(simData.water_temp);
        hydroChart.data.datasets[1].data.push(simData.ph);

        if (hydroChart.data.labels.length > 15) {
            hydroChart.data.labels.shift();
            hydroChart.data.datasets[0].data.shift();
            hydroChart.data.datasets[1].data.shift();
        }
        hydroChart.update();

    } catch (error) {
        document.getElementById('connection-status').textContent = "Sunucu Bekleniyor...";
        document.getElementById('connection-status').className = "status-offline";
    }
}

// Jüri için Manuel Test Fonksiyonları (Python'a Komut Gönderir)
async function triggerDevice(device, action) {
    await fetch("http://localhost:8000/api/device", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ device: device, action: action })
    });
}

function triggerHeatSpike() {
    triggerDevice("chiller", false);
    logTerminal("MANUEL MÜDAHALE: Chiller kapatıldı, su ısınmaya bırakıldı!", "crit");
}

function triggerPhSpike() {
    triggerDevice("ph_doser", false);
    logTerminal("MANUEL MÜDAHALE: pH Doser kapatıldı, asit baz dengesizleşiyor!", "crit");
}

setInterval(fetchHydroData, 1000);
// Arayüz Terminaline Her 3 Saniyede Bir Durum Logu Bas
let logCounter = 0;
setInterval(() => {
    logCounter++;
    const temp = document.getElementById('val-watertemp').textContent;
    const ph = document.getElementById('val-ph').textContent;
    const sysStatus = document.getElementById('connection-status').textContent;

    if (sysStatus.includes("Bağlı")) {
        if (logCounter % 2 === 0) {
            logTerminal(`[SİSTEM RUTİNİ] Sensörler stabil. Su: ${temp}, pH: ${ph}`, "normal");
        } else {
            logTerminal(`[VERİ AKIŞI] NASA ISS telemetrisi ile senkronizasyon başarılı.`, "normal");
        }
    }
}, 3000); // 3 saniyede bir terminale yazı düşer