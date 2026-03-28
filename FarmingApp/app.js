// 1. GRAFİK KURULUMU (Su Sıcaklığı ve pH)
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
            y: { type: 'linear', display: true, position: 'left', min: 15, max: 35, title: { display: true, text: 'Sıcaklık' } },
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

// 2. OTONOM SİMÜLASYON VE NODE.JS BAĞLANTISI
// Başlangıç değerleri (İdeal Hidroponik Şartlar)
let simData = { waterTemp: 22.0, ph: 6.0, ec: 1.8, do: 8.5 };

async function fetchHydroData() {
    try {
        /* ======== NODE.JS ENTEGRASYONU ========
        Arka uç hazır olduğunda aşağıdaki YORUM SATIRLARINI KALDIRIN.
        O zamana kadar sistem kendi kendini simüle edecek.
        */

        // const response = await fetch('http://localhost:3000/api/hydrodata');
        // if (!response.ok) throw new Error('API Hatası');
        // simData = await response.json(); 
        // document.getElementById('connection-status').textContent = "Node.js'e Bağlı";
        // document.getElementById('connection-status').className = "status-online";

        // --- GEÇİCİ SİMÜLASYON MANTIĞI (Node.js yokken çalışır) ---
        simData.waterTemp += (Math.random() - 0.4) * 0.3; // Su yavaşça ısınır
        simData.ph += 0.05; // pH zamanla yükselir (Bitki besin yedikçe)

        // Isınan suda oksijen azalır
        simData.do = 12.5 - (simData.waterTemp * 0.2);

        // Otonom Zeka (Jüri Şovu)
        if (simData.waterTemp > 24.5) {
            document.getElementById('status-chiller').className = "badge badge-active";
            document.getElementById('status-chiller').innerText = "SOĞUTUYOR";
            simData.waterTemp -= 0.8; // Chiller suyu soğutur
            logTerminal("Su sıcaklığı kritik! Chiller devreye alındı.", "warn");
        } else {
            document.getElementById('status-chiller').className = "badge badge-standby";
            document.getElementById('status-chiller').innerText = "BEKLEMEDE";
        }

        if (simData.ph > 6.5) {
            document.getElementById('status-phdoser').className = "badge badge-alert";
            document.getElementById('status-phdoser').innerText = "ASİT BASILIYOR";
            simData.ph -= 0.3; // pH düşürücü asit pompası
            logTerminal("Yüksek pH tespit edildi. pH-Down solüsyonu enjekte ediliyor.", "crit");
        } else {
            document.getElementById('status-phdoser').className = "badge badge-standby";
            document.getElementById('status-phdoser').innerText = "BEKLEMEDE";
        }
        // -----------------------------------------------------------

        updateUI(simData);

    } catch (error) {
        console.error(error);
        document.getElementById('connection-status').textContent = "Node.js Bekleniyor...";
        document.getElementById('connection-status').className = "status-offline";
    }
}

function updateUI(data) {
    document.getElementById('val-watertemp').textContent = data.waterTemp.toFixed(1) + " °C";
    document.getElementById('val-ph').textContent = data.ph.toFixed(2);
    document.getElementById('val-ec').textContent = data.ec.toFixed(1) + " mS/cm";
    document.getElementById('val-do').textContent = data.do.toFixed(1) + " mg/L";

    const now = new Date().toLocaleTimeString();
    hydroChart.data.labels.push(now);
    hydroChart.data.datasets[0].data.push(data.waterTemp);
    hydroChart.data.datasets[1].data.push(data.ph);

    if (hydroChart.data.labels.length > 15) {
        hydroChart.data.labels.shift();
        hydroChart.data.datasets[0].data.shift();
        hydroChart.data.datasets[1].data.shift();
    }
    hydroChart.update();
}

// Döngüyü başlat
setInterval(fetchHydroData, 1500);

// --- JÜRİ TEST BUTONLARI FONKSİYONLARI ---

function triggerHeatSpike() {
    simData.waterTemp = 29.5; // Sıcaklığı aniden tehlikeli seviyeye çek
    logTerminal("MANUEL MÜDAHALE: Isıtıcılar maksimuma alındı!", "crit");
}

function triggerPhSpike() {
    simData.ph = 7.8; // pH'ı aniden boz
    logTerminal("MANUEL MÜDAHALE: Suya asit baz dengesizliği verildi!", "crit");
}