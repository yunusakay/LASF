// app.js - BİRLEŞTİRİLMİŞ TAM SÜRÜM (HACKATHON READY)

// ==========================================
// 1. GRAFİK (CHART) KURULUMU
// ==========================================
const ctx = document.getElementById('telemetryChart').getContext('2d');
const telemetryChart = new Chart(ctx, {
    type: 'line',
    data: {
        labels: ['','','','','','','','','',''], // X ekseni için 10 boş etiket
        datasets: [
            {
                label: 'Temperature (°C)',
                borderColor: '#ff7b72', // Kırmızı çizgi
                backgroundColor: 'rgba(255, 123, 114, 0.1)',
                data: [24, 24, 24, 24, 24, 24, 24, 24, 24, 24],
                tension: 0.4,
                fill: true
            },
            {
                label: 'Humidity (%)',
                borderColor: '#58a6ff', // Mavi çizgi
                backgroundColor: 'rgba(88, 166, 255, 0.1)',
                data: [85, 85, 85, 85, 85, 85, 85, 85, 85, 85],
                tension: 0.4,
                fill: true
            }
        ]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 0 }, // Hızlı güncellemeler için animasyon kapalı
        scales: {
            y: { beginAtZero: false, min: 10, max: 100 }
        },
        plugins: {
            legend: { labels: { color: '#c9d1d9' } } // Karanlık mod için efsane metni
        }
    }
});

// ==========================================
// 2. TERMİNAL LOG FONKSİYONU
// ==========================================
function logAction(message, isWarning = false) {
    const terminal = document.getElementById('terminal');
    const time = new Date().toLocaleTimeString();
    const logHTML = `<div class="log-entry ${isWarning ? 'log-warning' : ''}">> [${time}] ${message}</div>`;
    terminal.innerHTML += logHTML;
    terminal.scrollTop = terminal.scrollHeight; // Otomatik olarak en alta kaydır
}

// ==========================================
// 3. NODE-RED API VE SİMÜLASYON DÖNGÜSÜ
// ==========================================
let currentTemp = 24.0;
let currentHum = 85.0;
let currentWater = 100.0;

// Node-RED'in veri göndereceği adres
const NODE_RED_API_URL = "http://localhost:1880/api/mars-data"; 

// Arayüzü ve grafiği güncelleyen ortak fonksiyon
function updateDashboard(temp, hum, water) {
    document.getElementById('val-temp').innerText = temp.toFixed(1) + " °C";
    document.getElementById('val-hum').innerText = hum.toFixed(1) + " %";
    document.getElementById('val-water').innerText = water.toFixed(1) + " %";

    telemetryChart.data.datasets[0].data.shift();
    telemetryChart.data.datasets[1].data.shift();
    
    telemetryChart.data.datasets[0].data.push(temp);
    telemetryChart.data.datasets[1].data.push(hum);
    telemetryChart.update();
}

// Backend çökerse veya dataset yoksa çalışacak yedek simülasyon
function runSimulationFallback() {
    currentTemp += (Math.random() - 0.5) * 0.5;
    currentHum -= 0.5; 
    currentWater -= 0.1; 

    if (currentHum < 75) {
        currentHum = 95;
        currentWater -= 2;
        logAction("Humidity low. Ultrasonic misting engaged.");
    }
    if (currentTemp > 26) {
        currentTemp -= 1.5;
        logAction("Temp spike detected. Cooling fans activated.", true);
    }

    updateDashboard(currentTemp, currentHum, currentWater);
}

// Node-RED'den veriyi çeken ana fonksiyon
async function getMarsTelemetry() {
    try {
        const response = await fetch(NODE_RED_API_URL);
        if (response.ok) {
            const data = await response.json();
            currentTemp = data.temp;
            currentHum = data.humidity;
            currentWater = data.water;
            
            updateDashboard(currentTemp, currentHum, currentWater);
            
            // Veri setinden (Node-RED'den) özel bir uyarı gelirse terminale bas
            if(data.alert) {
                logAction(`[SYSTEM] ${data.alert}`, true);
            }
        } else {
            runSimulationFallback();
        }
    } catch (error) {
        // Node-RED kapalıysa arayüzün donmaması için simülasyonu çalıştır
        runSimulationFallback();
    }
}

// Her 1 saniyede bir verileri çek (veya simüle et)
setInterval(getMarsTelemetry, 1000);

// ==========================================
// 4. BİTKİ VE SAĞLIK YÖNETİM SİSTEMİ (CROP MANAGEMENT)
// ==========================================
const cropDatabase = {
    "Patates": {
        warning: "High risk of constipation due to low fiber & high carbohydrates.",
        cure: "Plant Spinach (High fiber) or Beans.",
        companion: "Beans (fixes nitrogen in soil for potatoes).",
        resources: "Water: HIGH | Light: MEDIUM | Soil: DEEP"
    },
    "Ispanak": {
        warning: "Kidney stone risk due to high oxalate levels.",
        cure: "Plant Tomatoes (Vitamin C helps oxalate processing).",
        companion: "Strawberries or Peas.",
        resources: "Water: MEDIUM | Light: LOW | Soil: SHALLOW"
    },
    "Domates": {
        warning: "Acid reflux or heartburn from prolonged overconsumption.",
        cure: "Plant alkaline greens like Spinach.",
        companion: "Basil or Carrots.",
        resources: "Water: HIGH | Light: HIGH | Nutrients: HIGH"
    },
    "Fasulye": {
        warning: "Digestive issues / gas if consumed as primary calorie source.",
        cure: "Plant Fennel or Mint (Digestion aids).",
        companion: "Potatoes or Corn.",
        resources: "Water: LOW | Light: HIGH | Trait: NITROGEN FIXING"
    }
};

document.getElementById('plant-btn').addEventListener('click', () => {
    const selectedCrop = document.getElementById('crop-select').value;
    const infoDiv = document.getElementById('crop-info');
    
    if(!selectedCrop) {
        logAction("ERROR: No crop selected for planting. Aborting.", true);
        return;
    }

    const data = cropDatabase[selectedCrop];
    
    // UI Bilgilerini Doldur
    document.getElementById('crop-warning').innerText = data.warning;
    document.getElementById('crop-cure').innerText = data.cure;
    document.getElementById('crop-companion').innerText = data.companion;
    document.getElementById('crop-resources').innerText = data.resources;
    
    // Paneli Görünür Yap
    infoDiv.style.display = 'grid'; 
    
    // Terminal Logları (Jüri Şovu)
    logAction(`[BIO-SYS] ${selectedCrop} planting sequence initiated.`);
    logAction(`[BIO-SYS] Scanning companion compatibility... OK.`);
    
    // Ekim yapıldığı için sistemdeki suyu azalt ve grafiği güncelle
    currentWater -= 5.0; 
    updateDashboard(currentTemp, currentHum, currentWater);
    logAction(`[PUMP] Irrigating soil for new ${selectedCrop} seeds... Water level dropped.`);
});

// ==========================================
// 5. MISSION TIMER (Görev Kronometresi)
// ==========================================
let missionSeconds = 0;
setInterval(() => {
    missionSeconds++;
    const hrs = String(Math.floor(missionSeconds / 3600)).padStart(2, '0');
    const mins = String(Math.floor((missionSeconds % 3600) / 60)).padStart(2, '0');
    const secs = String(missionSeconds % 60).padStart(2, '0');
    document.getElementById('mission-timer').innerText = `T+ ${hrs}:${mins}:${secs}`;
}, 1000);

// ==========================================
// 6. MANUEL KONTROL BUTONLARI (Actuators)
// ==========================================
document.getElementById('btn-water').addEventListener('click', () => {
    logAction("[MANUAL] Water pump toggled. Flow rate increased.", false);
    currentWater += 10.0; // Suyu manuel artır
    if(currentWater > 100) currentWater = 100;
    document.getElementById('val-water').innerText = currentWater.toFixed(1) + " %";
});

document.getElementById('btn-fan').addEventListener('click', () => {
    logAction("[MANUAL] Emergency ventilation activated! O2 mixing...", true);
    currentTemp -= 2.0; // Sıcaklığı aniden düşür
    document.getElementById('val-temp').innerText = currentTemp.toFixed(1) + " °C";
});

document.getElementById('btn-light').addEventListener('click', () => {
    logAction("[MANUAL] UV Light arrays set to 150% capacity.", false);
    document.getElementById('val-lux').innerText = "18000 lx"; // Işığı manuel artır
    setTimeout(() => { document.getElementById('val-lux').innerText = "12000 lx"; }, 3000); // 3 sn sonra geri al
});

// ==========================================
// YENI MANUEL KONTROL BUTONLARI (Actuators)
// ==========================================

// 1. Besin Enjeksiyonu
document.getElementById('btn-nutrient').addEventListener('click', () => {
    logAction("[MANUAL] Injecting nutrient solution (N-P-K) into soil.");
    logAction("[BIO-SYS] Root absorption rate: OPTIMAL.");
});

// 2. CO2 Basımı
document.getElementById('btn-co2').addEventListener('click', () => {
    // Terminale yaz
    logAction("[MANUAL] Manual CO2 spike for growth boost. [WARNING]", true);
    
    // Simülasyonu etkile (CO2'yi zıplat)
    currentCO2 = 850; 
    document.getElementById('val-co2').innerText = currentCO2.toFixed(0) + " ppm";
    
    // 5 saniye sonra normal değere geri dön
    setTimeout(() => { 
        currentCO2 = 400; 
        document.getElementById('val-co2').innerText = currentCO2.toFixed(0) + " ppm";
        logAction("[SYSTEM] CO2 levels normalized.");
    }, 5000); 
});

// 3. Radyasyon Kalkanı
document.getElementById('btn-shield').addEventListener('click', () => {
    logAction("[ALERT] Solar radiation spike detected! Manual shielding initiated.", true);
    
    // Işığı manuel sıfırla (Kalkan kapandığı için)
    currentLux = 0;
    document.getElementById('val-lux').innerText = currentLux.toFixed(0) + " lx";
    
    setTimeout(() => { 
        currentLux = 12000;
        document.getElementById('val-lux').innerText = currentLux.toFixed(0) + " lx";
        logAction("[SYSTEM] Radiation threat passed. De-shielding...");
    }, 4000); // 4 saniye sonra kalkanı aç
});

// 4. Hasat Protokolü
document.getElementById('btn-harvest').addEventListener('click', () => {
    logAction("[PROTOCOL] HARVEST: Collecting biomass yield.");
    logAction("[PROTOCOL] CROP MANAGEMENT: Soil preparation for next rotation.");
    
    // Hasat yapıldığı için su tankı kullanımını düşür
    currentWater = 100.0;
    document.getElementById('val-water').innerText = currentWater.toFixed(1) + " %";
});