'use strict';

const API_BASE = 'http://127.0.0.1:8000';
const TICK_MS = 1000;
const WINDOW = 60;

const $ = (id) => document.getElementById(id);
const term = $('terminal');

const chart = new Chart($('hydroChart').getContext('2d'), {
  type: 'line',
  data: {
    labels: [],
    datasets: [
      { label: 'Sıcaklık', data: [], borderColor: '#ef4444', tension: 0.3, pointRadius: 0 },
      { label: 'Nem', data: [], borderColor: '#38bdf8', tension: 0.3, pointRadius: 0 }
    ]
  },
  options: { responsive: true, maintainAspectRatio: false, animation: false }
});

function log(msg) {
  const row = document.createElement('div');
  row.textContent = `> ${new Date().toLocaleTimeString('tr-TR')} ${msg}`;
  term.appendChild(row);
  while (term.children.length > 50) term.removeChild(term.firstChild);
  term.scrollTop = term.scrollHeight;
}

function setValue(id, value) { const el = $(id); if (el) el.textContent = value; }
function setBadge(id, active, alert = false) {
  const el = $(id);
  if (!el) return;
  el.className = `badge ${alert ? 'alert' : active ? 'active' : ''}`;
  el.textContent = alert ? 'ALARM' : active ? 'AKTİF' : 'BEKLEME';
}

function pushPoint(label, temp, hum) {
  chart.data.labels.push(label);
  chart.data.datasets[0].data.push(temp);
  chart.data.datasets[1].data.push(hum);
  if (chart.data.labels.length > WINDOW) {
    chart.data.labels.shift();
    chart.data.datasets.forEach((s) => s.data.shift());
  }
  chart.update('none');
}

async function fetchSensors() {
  try {
    const res = await fetch(`${API_BASE}/api/sensors`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const d = await res.json();

    $('connection-status').className = 'status online';
    setValue('connection-status', `Bağlı · ${d.current_time}`);

    setValue('val-temp', `${d.chamber_temperature.toFixed(1)} °C`);
    setValue('val-hum', `${d.chamber_humidity.toFixed(1)} %`);
    setValue('val-water', `${d.water_tank_liters.toFixed(1)} L`);
    setValue('val-ph', d.ph.toFixed(2));

    setValue('ai-status', d.ai_recommendation || d.ai_crop);
    setValue('val-vpd', `${d.vpd_kpa.toFixed(2)} kPa`);
    setValue('val-ppfd', `${d.light_ppfd.toFixed(0)} μmol/m²/s`);
    setValue('val-ec', `${d.ec.toFixed(2)} mS/cm`);
    setValue('val-harvested', `${d.water_harvested_total.toFixed(1)} L`);
    setValue('val-npk-doses', `${d.npk_doses_given}`);
    setValue('val-stress-cycles', `${d.stress_cycles_completed}`);

    const dev = d.devices || {};
    const alert = (d.alerts || []).length > 0;
    setBadge('status-fan', !!dev.ventilation_fan);
    setBadge('status-dehumidifier', !!dev.dehumidifier, alert && d.water_tank_liters < 4);
    setBadge('status-chiller', !!dev.chiller);
    setBadge('status-ph', !!dev.ph_doser);
    setBadge('status-npk', !!dev.npk_doser);

    pushPoint(new Date().toLocaleTimeString('tr-TR'), d.chamber_temperature, d.chamber_humidity);
    if (alert) d.alerts.forEach(log);
  } catch (err) {
    $('connection-status').className = 'status offline';
    setValue('connection-status', 'Bağlantı yok');
    log(`Bağlantı hatası: ${err.message}`);
  }
}

async function toggleDevice(device, action) {
  try {
    await fetch(`${API_BASE}/api/device`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device, action })
    });
    log(`Komut: ${device} => ${action ? 'AÇIK' : 'KAPALI'}`);
  } catch {
    log(`Komut gönderilemedi: ${device}`);
  }
}

async function releaseToAuto() {
  const devices = ['dehumidifier', 'ventilation_fan', 'npk_doser'];
  await Promise.all(devices.map((device) => toggleDevice(device, false)));
  log('Manuel test kapatıldı, otomasyon aktif.');
}

window.toggleDevice = toggleDevice;
window.releaseToAuto = releaseToAuto;

log('Minimal dashboard başlatıldı.');
setInterval(fetchSensors, TICK_MS);
fetchSensors();
