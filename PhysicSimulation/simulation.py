import os
import math
import asyncio
import csv
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

# --- SİMÜLASYON SABİTLERİ (İNSAN VE LİMİTLER) ---
HUMANS_IN_CABIN = 2
HUMAN_TEMP_RISE_PER_TICK = 0.03 * HUMANS_IN_CABIN  # Vücut ısısı radyasyonu
HUMAN_HUM_RISE_PER_TICK = 0.08 * HUMANS_IN_CABIN   # Solunum ve terleme (Nem)

NPK_MIN = 0.0
NPK_MAX = 250.0  # Hidroponik çözeltinin maksimum PPM kapasitesi

# NPK tüketim hızları (tick başına ppm)
NPK_CONSUME_N = 0.15
NPK_CONSUME_P = 0.05
NPK_CONSUME_K = 0.12

# --- APP KURULUMU VE LİFESPAN ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(physics_loop())
    yield
    task.cancel()

app = FastAPI(title="LASF Akıllı Tarım Motoru", lifespan=lifespan)

# ⚠️ KRİTİK CORS DÜZELTMESİ: allow_credentials=False OLMAK ZORUNDA
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False, 
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- NASA VERİ SETİ YÜKLEYİCİ ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.path.join(BASE_DIR, "..", "IoTSimulation", "VEG-01C_EDA_Telemetry_data.csv")
dataset = []

try:
    with open(CSV_PATH, mode="r", encoding="utf-8") as file:
        reader = csv.DictReader(file)
        for row in reader:
            dataset.append({
                "time": row.get("Controller_Time_GMT", "00:00:00"),
                "iss_temp": float(row.get("Temp_degC_ISS", 23.0)),
                "iss_hum": float(row.get("RH_percent_ISS", 40.0)),
            })
    print(f"[BAŞARILI] {len(dataset)} satır NASA verisi yüklendi.")
except Exception:
    print("[UYARI] Veri seti bulunamadı. Fallback kullanılıyor.")
    dataset.append({"time": "FALLBACK", "iss_temp": 23.0, "iss_hum": 55.0})

# --- DURUM (STATE) VE CİHAZLAR ---
# Orijinal app.js'in beklediği tüm değişkenler eksiksiz korunmuştur.
current_row_index = 0

state = {
    "current_time": "Başlatılıyor...",
    "chamber_temperature": 23.0, "chamber_humidity": 50.0,
    "water_tank_liters": 20.0, "water_temp": 22.0,
    "ph": 6.0, "ec": 1.8,
    "mineral_n": 120.0, "mineral_p": 50.0, "mineral_k": 150.0,
    "ai_recommendation": "Analiz Ediliyor...", "ai_crop": "NONE",
    "vpd_kpa": 1.0, "light_ppfd": 400.0, "blue_light_ratio": 20.0,
    "stress_phase": "NORMAL", "stress_duration_ticks": 0,
    "water_harvested_total": 0.0, "npk_doses_given": 0, "stress_cycles_completed": 0,
    "alerts": []
}

devices = {
    "ventilation_fan": False, "dehumidifier": False, "chiller": False,
    "ph_doser": False, "npk_doser": False, "grow_lights": True,
    "spectrum_controller": True, "ec_doser": False,
}

# --- LOJİK FONKSİYONLARI ---
def apply_stress_algorithms(current_plant, temp, hum):
    """Su verimliliğini artırmak için kontrollü stres uygular."""
    global state, devices
    
    # VPD (Vapor Pressure Deficit) Hesaplaması
    svp = 0.61078 * math.exp((17.27 * temp) / (temp + 237.3))
    avp = svp * (hum / 100.0)
    state["vpd_kpa"] = round(svp - avp, 3)

    phase = state["stress_phase"]

    if phase == "NORMAL" and state["water_tank_liters"] > 15.0 and temp < 25.0:
        if current_plant == "LETTUCE":
            state["stress_phase"], state["stress_duration_ticks"] = "LIGHT_STRESS", 0
        elif current_plant == "POTATO":
            state["stress_phase"], state["stress_duration_ticks"] = "OSMOTIC_STRESS", 0

    elif phase == "LIGHT_STRESS":
        state["light_ppfd"], state["blue_light_ratio"] = 340.0, 35.0
        state["stress_duration_ticks"] += 1
        if state["stress_duration_ticks"] >= 120:
            state["stress_phase"] = "RECOVERY"

    elif phase == "OSMOTIC_STRESS":
        devices["ec_doser"] = True
        state["ec"] += 0.05
        state["stress_duration_ticks"] += 1
        if state["ec"] >= 3.0 or state["stress_duration_ticks"] >= 180:
            devices["ec_doser"], state["stress_phase"] = False, "RECOVERY"

    elif phase == "RECOVERY":
        state["light_ppfd"], state["blue_light_ratio"] = 400.0, 20.0
        if state["ec"] > 1.8:
            state["ec"] -= 0.1
            state["water_tank_liters"] += 0.5
        if state["ec"] <= 2.0:
            state["stress_phase"] = "NORMAL"
            state["stress_cycles_completed"] += 1

def run_ai_recommendation():
    """O anki besin durumuna göre ekim stratejisi belirler."""
    n, p, k = state["mineral_n"], state["mineral_p"], state["mineral_k"]
    if (n + p + k) < 50:
        state["ai_recommendation"], state["ai_crop"] = "Mineraller Tükendi", "DEPLETED"
    elif n >= k and n >= p:
        state["ai_recommendation"], state["ai_crop"] = "Marul (Yüksek N)", "LETTUCE"
    elif k > n and k >= p:
        state["ai_recommendation"], state["ai_crop"] = "Patates (Yüksek K)", "POTATO"
    else:
        state["ai_recommendation"], state["ai_crop"] = "Çilek (Dengeli P)", "STRAWBERRY"

# --- ANA FİZİK DÖNGÜSÜ ---
async def physics_loop():
    global current_row_index
    while True:
        if current_row_index >= len(dataset): current_row_index = 0
        
        row = dataset[current_row_index]
        state["current_time"] = row["time"]
        state["alerts"] = []  # Orijinal app.js terminali için uyarıları temizle

        # 1. Mineral Tüketimi
        state["mineral_n"] -= NPK_CONSUME_N
        state["mineral_p"] -= NPK_CONSUME_P
        state["mineral_k"] -= NPK_CONSUME_K

        # 2. Yapay Zeka ve Stres Lojikleri
        run_ai_recommendation()
        apply_stress_algorithms(state["ai_crop"], state["chamber_temperature"], state["chamber_humidity"])

        # 3. Fizik (Terleme + İNSAN FAKTÖRÜ EKLENDİ)
        in_stress = state["stress_phase"] in ["LIGHT_STRESS", "OSMOTIC_STRESS"]
        water_consume = 0.02 if in_stress else 0.05
        hum_rise = 0.2 if in_stress else 0.5

        # Astronotların solunumu nemi, vücut ısıları sıcaklığı artırır
        state["chamber_humidity"] += hum_rise + HUMAN_HUM_RISE_PER_TICK
        state["chamber_temperature"] += HUMAN_TEMP_RISE_PER_TICK
        
        state["water_tank_liters"] -= water_consume
        state["ph"] += 0.02

        # 4. Cihaz Müdahaleleri
        if devices["npk_doser"]:
            state["mineral_n"] += 5.0
            state["mineral_p"] += 2.0
            state["mineral_k"] += 4.0
            state["npk_doses_given"] += 1

        if devices["ventilation_fan"]:
            # ISS kabin havası ile karışım simülasyonu
            state["chamber_temperature"] += (row["iss_temp"] - state["chamber_temperature"]) * 0.4
        else:
            state["chamber_temperature"] += 0.05

        if devices["dehumidifier"] and state["chamber_humidity"] > 40.0:
            state["chamber_humidity"] -= 2.0
            state["water_tank_liters"] += 0.5
            state["water_harvested_total"] += 0.5

        if devices["chiller"]: state["water_temp"] -= 0.3
        if devices["ph_doser"]: state["ph"] -= 0.1

        # 5. LİMİTLEYİCİLER (NPK Limitleri Eklendi)
        state["mineral_n"] = max(NPK_MIN, min(NPK_MAX, state["mineral_n"]))
        state["mineral_p"] = max(NPK_MIN, min(NPK_MAX, state["mineral_p"]))
        state["mineral_k"] = max(NPK_MIN, min(NPK_MAX, state["mineral_k"]))
        
        state["ph"] = max(4.0, min(8.0, state["ph"]))
        state["chamber_humidity"] = max(0.0, min(100.0, state["chamber_humidity"]))
        state["chamber_temperature"] = max(15.0, min(40.0, state["chamber_temperature"]))
        state["ec"] = max(0.5, min(4.0, state["ec"]))

        # Orijinal terminal logları için kritik uyarılar
        if state["water_tank_liters"] < 4.0:
            state["alerts"].append("KRİTİK SU SEVİYESİ!")
        if state["ec"] > 3.5:
            state["alerts"].append("YÜKSEK EC TEHLİKESİ (TOKSİSİTE)!")

        print(f"[{state['current_time']}] Temp:{state['chamber_temperature']:.1f} Hum:{state['chamber_humidity']:.1f} | NPK: {state['mineral_n']:.0f}/{state['mineral_p']:.0f}/{state['mineral_k']:.0f} | AI: {state['ai_crop']}")

        current_row_index += 1
        await asyncio.sleep(1)

# --- ENDPOINTLER ---
@app.get("/api/sensors")
def get_sensors():
    # app.js'in beklediği formatta (devices dahil) gönderilir
    return {**state, "devices": devices}

class Command(BaseModel):
    device: str
    action: bool

@app.post("/api/device")
def control_device(cmd: Command):
    if cmd.device in devices:
        devices[cmd.device] = cmd.action
        return {"status": "success"}
    return {"status": "error"}

@app.post("/api/auto")
def release_to_auto():
    # Otonom moda geçiş (tüm manuel kontrolleri devre dışı bırakır)
    for dev in devices: devices[dev] = False
    return {"status": "success"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)