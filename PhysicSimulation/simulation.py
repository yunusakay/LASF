import asyncio
import random
import csv
from typing import Dict, Any, List
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ---------------------------------------------------------------------------
# GLOBAL STATE (Sistem Durumu - Simbiyotik)
# ---------------------------------------------------------------------------
state: Dict[str, Any] = {
    "current_time": "00:00:00",
    "chamber_temperature": 23.0,
    "chamber_humidity": 45.0,
    "water_tank_liters": 10.0,
    "ph": 5.8,
    "ec": 1.5,
    "mineral_n": 100.0,  # Soya sayesinde yüksek başlar
    "mineral_p": 45.0,
    "mineral_k": 90.0,   # Patates yüzünden hızlı düşer
    "ai_recommendation": "Sistem Dengede. NASA Verisi Bekleniyor.",
    "is_manual": False
}

devices: Dict[str, bool] = {
    "ventilation_fan": False,
    "dehumidifier": False,
    "ph_doser": False,
    "npk_doser": False
}

dataset: List[Dict[str, Any]] = []
current_row_index = 0

# ---------------------------------------------------------------------------
# SETUP (FASTAPI & CSV)
# ---------------------------------------------------------------------------
app = FastAPI(title="LASF Simülasyon Motoru")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def load_dataset():
    global dataset
    try:
        with open('nasadata.csv', mode='r', encoding='utf-8-sig') as file:
            reader = csv.DictReader(file)
            dataset = [row for row in reader]
    except FileNotFoundError:
        print("HATA: nasadata.csv bulunamadı, rastgele veri üretilecek.")
        dataset = []

# ---------------------------------------------------------------------------
# PHYSICS LOOP (Simbiyotik Ekosistem)
# ---------------------------------------------------------------------------
async def physics_loop():
    global current_row_index, dataset
    while True:
        # NASA Verisi Okuma
        if dataset:
            row = dataset[current_row_index % len(dataset)]
            state["current_time"] = row["NASA TIME (MM:DD:YY:HH)"]
            # Hafif gürültü ekle
            noise = random.uniform(-0.1, 0.1)
            state["chamber_temperature"] = float(row["Temperature"]) + noise
            state["chamber_humidity"] = float(row["Humidity"]) + (noise * 5)
            current_row_index += 1
        else:
            state["chamber_temperature"] += random.uniform(-0.1, 0.1)

        # --- SİMBİYOTİK EKOSİSTEM (YENİ VE KUSURSUZ) ---
        soya_n_katkisi = 0.35    # Soya azot üretir
        marul_n_tuketimi = 0.40  # Marul onu yer
        patates_k_tuketimi = 0.30 # Patates potasyum bitirir
        p_tuketimi = 0.10

        state["mineral_n"] = max(0.0, state["mineral_n"] + soya_n_katkisi - marul_n_tuketimi)
        state["mineral_p"] = max(0.0, state["mineral_p"] - p_tuketimi)
        state["mineral_k"] = max(0.0, state["mineral_k"] - patates_k_tuketimi)

        # Yapay Zeka Önerisi
        if state["mineral_n"] < 45 or state["mineral_p"] < 25 or state["mineral_k"] < 55:
            state["ai_recommendation"] = "⚠️ KRİTİK: Mineral Dengesi Bozuldu! Otonom Dozlama Bekleniyor."
        elif state["chamber_humidity"] > 65:
            state["ai_recommendation"] = "💧 Nem Yüksek: Su Geri Kazanımı Açılabilir."
        else:
            state["ai_recommendation"] = "✅ OPTİMAL: Soya-Marul-Patates Ekosistemi Stabil."

        # Cihaz Etkileri
        if devices["npk_doser"]:
            state["mineral_n"] += 8.0
            state["mineral_p"] += 4.0
            state["mineral_k"] += 10.0
            state["water_tank_liters"] -= 0.01

        # Sınırlandırmalar
        state["water_tank_liters"] = max(0.0, state["water_tank_liters"])
        state["mineral_n"] = min(200.0, state["mineral_n"])
        state["mineral_p"] = min(200.0, state["mineral_p"])
        state["mineral_k"] = min(200.0, state["mineral_k"])

        await asyncio.sleep(1)

# ---------------------------------------------------------------------------
# API ROUTES (Düzeltilen API)
# ---------------------------------------------------------------------------
@app.get("/api/sensors")
def get_sensors():
    # Arayüzün розetleri (badge) parlatması için cihazları da içine ekledik.
    return {**state, "devices": devices}

class DeviceCommand(BaseModel):
    device: str
    action: bool

@app.post("/api/device")
def control_device(cmd: DeviceCommand):
    if cmd.device not in devices:
        raise HTTPException(status_code=404, detail="Cihaz bulunamadı")
    
    devices[cmd.device] = cmd.action
    print(f"KOMUT: {cmd.device} -> {cmd.action}")
    return {"status": "ok", "device": cmd.device, "action": cmd.action}

@app.post("/api/auto")
def release_to_auto():
    # Manuel modları kapatıp kontrolü Node-RED'e bırakır.
    print("SİSTEM: Otonom kontrol aktif edildi.")
    return {"status": "ok", "message": "Autonomous mode active"}

# Sistemi Başlat
@app.on_event("startup")
async def startup_event():
    load_dataset()
    asyncio.create_task(physics_loop())

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)