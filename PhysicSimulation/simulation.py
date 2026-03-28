import asyncio
import csv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

app = FastAPI(title="KOTA Yüksek Çözünürlüklü Fizik Motoru")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 1. NASA VERİ SETİNİ YÜKLE (ISS AMBİYANS VERİSİ)
dataset = []
with open("VEG-01C_EDA_Telemetry_data.csv", mode="r", encoding="utf-8") as file:
    reader = csv.DictReader(file)
    last_valid_temp = 23.0
    last_valid_hum = 40.0
    
    for row in reader:
        try:
            temp = float(row["Temp_degC_ISS"])
            last_valid_temp = temp
        except ValueError:
            temp = last_valid_temp
            
        try:
            hum = float(row["RH_percent_ISS"])
            last_valid_hum = hum
        except ValueError:
            hum = last_valid_hum

        dataset.append({
            "time": row["Controller_Time_GMT"],
            "iss_temp": temp,
            "iss_hum": hum
        })

# 2. KAPALI KABİN SİSTEM DURUMU (CHAMBER STATE)
current_row_index = 0

state = {
    "current_time": "Başlatılıyor...",
    "chamber_temperature": 23.0,
    "chamber_humidity": 50.0,
    "water_tank_liters": 15.0,
    "plant_biomass_kg": 0.5, # Bitki kütlesi (büyüdükçe su tüketimi artar)
    "system_status": "AKTIF"
}

devices = {
    "water_pump": False,
    "fan": False, # Fan, kabin havası ile ISS havasını karıştırır
    "aerogel_collector": False 
}

# 3. TERMODİNAMİK VE BİYOLOJİK SİMÜLASYON DÖNGÜSÜ
async def physics_loop():
    global current_row_index
    
    while current_row_index < len(dataset):
        if state["water_tank_liters"] <= 0.0:
            state["water_tank_liters"] = 0.0
            state["system_status"] = "SISTEM COKTU: Su Tukendi"
            await asyncio.sleep(1)
            continue

        # NASA Verisini Al (ISS Ortam Değerleri)
        row_data = dataset[current_row_index]
        state["current_time"] = row_data["time"]
        iss_temp = row_data["iss_temp"]
        iss_hum = row_data["iss_hum"]
        
        # --- BİYOLOJİ: Transpirasyon (Terleme) Denklemi ---
        # Bitki kütlesi ve ortam sıcaklığına bağlı dinamik su tüketimi
        transpiration_rate = 0.002 * state["plant_biomass_kg"] * (state["chamber_temperature"] / 20.0)
        
        # Köklerden su çekilir ve havaya nem olarak karışır (Kütle Korunumu)
        state["water_tank_liters"] -= transpiration_rate
        # 1 litre su buharlaştığında kapalı kabindeki nem orantısal olarak artar
        state["chamber_humidity"] += (transpiration_rate * 50.0) 
        
        # Bitki çok yavaş büyür
        state["plant_biomass_kg"] += 0.0001

        # --- FİZİK: IoT Cihazlarının Etkileri ---
        
        # Fan çalışırsa ISS ortam havası (NASA verisi) kabin içine girer (Isı ve Kütle Transferi)
        if devices["fan"]: 
            state["chamber_temperature"] += (iss_temp - state["chamber_temperature"]) * 0.4
            state["chamber_humidity"] += (iss_hum - state["chamber_humidity"]) * 0.4
        else:
            # Fan kapalıyken bile yalıtım kusursuz değildir, yavaş bir termal eşitleme olur
            state["chamber_temperature"] += (iss_temp - state["chamber_temperature"]) * 0.05
            
        if devices["water_pump"]: 
            # Pompa doğrudan köklere ve toprağa su basar, anlık buharlaşma yaratır
            state["chamber_humidity"] += 1.5
            state["water_tank_liters"] -= 0.1
            
        if devices["aerogel_collector"]:
            # Yoğuşma Fiziği: Ortam nemi %40'ın üzerindeyse aerogel suyu hasat edebilir
            if state["chamber_humidity"] > 40.0:
                # Nem ne kadar yüksekse, çekilen su o kadar fazladır
                harvested_water = (state["chamber_humidity"] - 40.0) * 0.005
                state["chamber_humidity"] -= (harvested_water * 50.0) # Havadan nem eksilir
                state["water_tank_liters"] += harvested_water         # Su tankına eklenir

        # Fiziksel Limitleri Koru
        state["chamber_humidity"] = max(0.0, min(100.0, state["chamber_humidity"]))
        
        current_row_index += 1
        await asyncio.sleep(1) # Saniyede 1 dakika (satır) atlar

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(physics_loop())

@app.get("/api/sensors")
def get_data():
    return state

class Command(BaseModel):
    device: str
    action: bool

@app.post("/api/device")
def control_device(cmd: Command):
    if state["system_status"] != "AKTIF":
        return {"status": "error", "message": "Sistem çöktü."}
        
    if cmd.device in devices:
        devices[cmd.device] = cmd.action
        return {"status": "success"}
    return {"status": "error"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)