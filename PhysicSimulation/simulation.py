import os
import asyncio
import csv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

app = FastAPI(title="KOTA NPK Akıllı Tarım Motoru")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.path.join(BASE_DIR, "..", "IoTSimulation", "VEG-01C_EDA_Telemetry_data.csv")

dataset = []
try:
    with open(CSV_PATH, mode="r", encoding="utf-8") as file:
        reader = csv.DictReader(file)
        last_valid_temp = 23.0
        last_valid_hum = 40.0
        for row in reader:
            try:
                temp = float(row["Temp_degC_ISS"])
                last_valid_temp = temp
            except (ValueError, KeyError):
                temp = last_valid_temp
            try:
                hum = float(row["RH_percent_ISS"])
                last_valid_hum = hum
            except (ValueError, KeyError):
                hum = last_valid_hum
            dataset.append({"time": row["Controller_Time_GMT"], "iss_temp": temp, "iss_hum": hum})
    print(f"[BAŞARILI] {len(dataset)} satır NASA verisi yüklendi!")
except FileNotFoundError:
    print(f"⚠️ KRİTİK HATA: Veri seti bulunamadı! Aranan yol: {CSV_PATH}")
    dataset.append({"time": "DOSYA HATASI", "iss_temp": 23.0, "iss_hum": 40.0})

# 2. HİDROPONİK & MİNERAL (NPK) DURUMU
current_row_index = 0
state = {
    "current_time": "Başlatılıyor...",
    "chamber_temperature": 23.0,
    "chamber_humidity": 50.0,
    "water_tank_liters": 20.0,
    "water_temp": 22.0,  
    "ph": 6.0,           
    "ec": 1.8, 
    # NPK Mineralleri (PPM cinsinden)
    "mineral_n": 120.0, # Azot (Nitrogen)
    "mineral_p": 50.0,  # Fosfor (Phosphorus)
    "mineral_k": 150.0, # Potasyum (Potassium)
    "ai_recommendation": "Analiz Ediliyor..." # Yapay Zeka Önerisi
}

devices = {
    "ventilation_fan": False, 
    "dehumidifier": False,    
    "chiller": False,         
    "ph_doser": False,
    "npk_doser": False  # <-- Bu satırı ekledik
}

async def physics_loop():
    global current_row_index
    while current_row_index < len(dataset):
        row_data = dataset[current_row_index]
        state["current_time"] = row_data["time"]
        iss_temp = row_data["iss_temp"]
        iss_hum = row_data["iss_hum"]
        
        # SİMÜLASYON: Bitkiler mineralleri tüketir (Değişken hızlarda)
        state["mineral_n"] -= 0.15
        state["mineral_p"] -= 0.05
        state["mineral_k"] -= 0.12

        # AI ÖNERİ ALGORİTMASI: Suda hangi mineral yoğunluktaysa, o minerali seven bitkiyi öner
        total_minerals = state["mineral_n"] + state["mineral_p"] + state["mineral_k"]
        
        if total_minerals < 100:
            state["ai_recommendation"] = "⚠️ Mineraller Tükendi: Besin Ekleyin!"
        elif state["mineral_n"] > state["mineral_k"] and state["mineral_n"] > state["mineral_p"]:
            state["ai_recommendation"] = "🥬 Marul Ekin (Yüksek Azot Tespit Edildi)"
        elif state["mineral_k"] > state["mineral_n"] and state["mineral_k"] > state["mineral_p"]:
            state["ai_recommendation"] = "🥔 Patates Ekin (Yüksek Potasyum Tespit Edildi)"
        else:
            state["ai_recommendation"] = "🍓 Çilek Ekin (Dengeli / Fosfor Uygun)"

        # Temel Fizik ve Kimya
        state["chamber_humidity"] += 0.5  
        state["water_tank_liters"] -= 0.05 
        state["ph"] += 0.02 
        
        if state["water_temp"] < state["chamber_temperature"]:
            state["water_temp"] += 0.05

        # CİHAZLARIN ETKİSİ
        if devices["npk_doser"]:
            state["mineral_n"] += 5.0
            state["mineral_p"] += 2.0
            state["mineral_k"] += 4.0

        if devices["ventilation_fan"]: 
            state["chamber_temperature"] += (iss_temp - state["chamber_temperature"]) * 0.4
        else:
            state["chamber_temperature"] += 0.05
            
        if devices["dehumidifier"]:
            if state["chamber_humidity"] > 40.0:
                harvested = 0.5
                state["chamber_humidity"] -= 2.0 
                state["water_tank_liters"] += harvested 
                
        if devices["chiller"]: state["water_temp"] -= 0.3 
        if devices["ph_doser"]: state["ph"] -= 0.1 

        state["ph"] = max(0.0, min(14.0, state["ph"]))
        state["chamber_humidity"] = max(0.0, min(100.0, state["chamber_humidity"])) 
        
        current_row_index += 1
        print(f"[{state['current_time']}] N:{state['mineral_n']:.0f} P:{state['mineral_p']:.0f} K:{state['mineral_k']:.0f} | Öneri: {state['ai_recommendation']}")
        await asyncio.sleep(1)

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(physics_loop())

@app.get("/api/sensors")
def get_data(): return state

class Command(BaseModel):
    device: str; action: bool

@app.post("/api/device")
def control_device(cmd: Command):
    if cmd.device in devices:
        devices[cmd.device] = cmd.action
        return {"status": "success"}
    return {"status": "error"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)