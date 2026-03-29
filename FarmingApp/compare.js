const API_BASE = 'http://127.0.0.1:8000';
const POLL_INTERVAL = 1000;

// Setup Temperature Chart
const ctxTemp = document.getElementById('tempCompareChart').getContext('2d');
const tempChart = new Chart(ctxTemp, {
    type: 'line',
    data: { labels: [], datasets: [
        { label: 'NASA ISS Actual', borderColor: '#38bdf8', borderDash: [5, 5], data: [], tension: 0.1 },
        { label: 'LASF Simulated (No Interventions)', borderColor: '#f87171', data: [], tension: 0.1 }
    ]},
    options: { responsive: true, maintainAspectRatio: false, animation: false, scales: { x: { display: false } } }
});

// Setup Humidity Chart
const ctxHum = document.getElementById('humCompareChart').getContext('2d');
const humChart = new Chart(ctxHum, {
    type: 'line',
    data: { labels: [], datasets: [
        { label: 'NASA ISS Actual', borderColor: '#4ade80', borderDash: [5, 5], data: [], tension: 0.1 },
        { label: 'LASF Simulated (No Interventions)', borderColor: '#fbbf24', data: [], tension: 0.1 }
    ]},
    options: { responsive: true, maintainAspectRatio: false, animation: false, scales: { x: { display: false } } }
});

async function fetchCompareData() {
    try {
        const res = await fetch(`${API_BASE}/api/sensors`);
        if (!res.ok) throw new Error();
        const d = await res.json();

        document.getElementById('connection-status').textContent = `Mission Time: ${d.current_time} | Online`;
        document.getElementById('connection-status').className = 'status-online';

        // Update KPIs
        document.getElementById('val-nasa-temp').textContent = d.iss_raw_temp.toFixed(1) + ' °C';
        document.getElementById('val-sim-temp').textContent = d.baseline_temp.toFixed(1) + ' °C';
        document.getElementById('val-nasa-hum').textContent = d.iss_raw_hum.toFixed(1) + ' %';
        document.getElementById('val-sim-hum').textContent = d.baseline_hum.toFixed(1) + ' %';

        const ts = new Date().toLocaleTimeString();
        
        // Update Temp Chart
        tempChart.data.labels.push(ts);
        tempChart.data.datasets[0].data.push(d.iss_raw_temp);
        tempChart.data.datasets[1].data.push(d.baseline_temp);

        // Update Hum Chart
        humChart.data.labels.push(ts);
        humChart.data.datasets[0].data.push(d.iss_raw_hum);
        humChart.data.datasets[1].data.push(d.baseline_hum);

        // Keep charts clean (max 50 points)
        if (tempChart.data.labels.length > 50) {
            tempChart.data.labels.shift(); tempChart.data.datasets.forEach(ds => ds.data.shift());
            humChart.data.labels.shift(); humChart.data.datasets.forEach(ds => ds.data.shift());
        }
        
        tempChart.update();
        humChart.update();

    } catch (err) {
        document.getElementById('connection-status').textContent = 'Offline...';
        document.getElementById('connection-status').className = 'status-offline';
    }
}

setInterval(fetchCompareData, POLL_INTERVAL);