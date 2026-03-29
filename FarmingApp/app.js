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
    term.scrollTop = term.scrollHeight; 
}

// 2. PYTHON API ENTEGRASYONU (WebSocket Yerine Doğrudan Veri Çekimi)
async function fetchHydroData() {
    try {
        const response = await fetch('http://127.0.0.1:8000/api/sensors');
        if (!response.ok) throw new Error('API Hatası');
        let simData = await response.json(); 
        
        document.getElementById('connection-status').textContent = `Uzay Saati: ${simData.current_time} | Python NPK Motoruna Bağlı`;
        document.getElementById('connection-status').className = "status-online";

        // HTML içindeki ID'leri güncelliyoruz
        document.getElementById('val-temp').textContent = simData.chamber_temperature.toFixed(1) + " °C";
        document.getElementById('val-hum').textContent = simData.chamber_humidity.toFixed(1) + " %";
        document.getElementById('val-water').textContent = simData.water_tank_liters.toFixed(1) + " L"; // Su tankı eklendi!
        
        // NPK değerlerini tek bir satırda birleştirip val-npk içine yazıyoruz
        document.getElementById('val-npk').textContent = `N:${simData.mineral_n.toFixed(0)} | P:${simData.mineral_p.toFixed(0)} | K:${simData.mineral_k.toFixed(0)}`;
        
        // AI Önerisi ve Zaman
        document.getElementById('ai-status').textContent = simData.ai_recommendation;
        document.getElementById('nasa-time').textContent = simData.current_time;

        // Grafiği Güncelle
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
        // Hata ayıklama için hatayı tarayıcı konsoluna (F12) yazdır
        console.error("Veri çekme hatası: ", error); 
        document.getElementById('connection-status').textContent = "Python Sunucusu Bekleniyor...";
        document.getElementById('connection-status').className = "status-offline";
    }
}

// 3. MANUEL TEST BUTONLARI
async function toggleDevice(deviceName, actionState) {
    try {
        await fetch("http://127.0.0.1:8000/api/device", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ device: deviceName, action: actionState })
        });

        logTerminal(`MANUEL MÜDAHALE: ${deviceName} durumu ${actionState ? 'AÇIK' : 'KAPALI'} yapıldı.`, actionState ? "warn" : "normal");

    } catch (error) {
        logTerminal("HATA: Python sunucusuna ulaşılamıyor!", "crit");
    }
}

setInterval(fetchHydroData, 1000);