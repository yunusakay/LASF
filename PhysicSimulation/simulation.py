import asyncio
import csv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

app = FastAPI(title="KOTA Hidroponik SITL Fizik Motoru")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 1. NASA VERİ SETİNİ YÜKLE
dataset = []
with open("../IoTSimulation/VEG-01C_EDA_Telemetry_data.csv", mode="r", encoding="utf-8") as file:
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
        dataset.append({"time": row["Controller_Time_GMT"], "iss_temp": temp, "iss_hum": hum})

# 2. HİDROPONİK KABİN DURUMU (State)
current_row_index = 0
state = {
    "current_time": "Başlatılıyor...",
    "chamber_temperature": 23.0,
    "chamber_humidity": 50.0,
    "water_tank_liters": 20.0,
    "water_temp": 22.0,  # Hidroponik su sıcaklığı
    "ph": 6.0,           # İdeal pH
    "ec": 1.8,           # İdeal besin değeri
    "do": 8.5,           # Çözünmüş oksijen
    "system_status": "AKTIF"
}

# 3. IOT CİHAZLARI
devices = {
    "ventilation_fan": False, # Ortam havasını karıştırır
    "dehumidifier": False,    # Havadaki nemi toplar, suya çevirir
    "chiller": False,         # Suyu soğutur
    "ph_doser": False         # pH'ı düşürür (Asit pompası)
}

async def physics_loop():
    global current_row_index
    while current_row_index < len(dataset):
        row_data = dataset[current_row_index]
        state["current_time"] = row_data["time"]
        iss_temp = row_data["iss_temp"]
        iss_hum = row_data["iss_hum"]
        
        # BİYOLOJİ VE KİMYA SİMÜLASYONU
        state["chamber_humidity"] += 0.5  # Bitkiler terler, nem artar
        state["water_tank_liters"] -= 0.05 # Bitkiler su içer
        state["ph"] += 0.02 # Bitkiler besin yedikçe suyun pH'ı doğal olarak yükselir
        
        # Su sıcaklığı ortam sıcaklığına doğru yavaşça ısınır
        if state["water_temp"] < state["chamber_temperature"]:
            state["water_temp"] += 0.05
            
        # Oksijen (DO) su ısındıkça düşer (Fizik kuralı)
        state["do"] = max(4.0, 12.5 - (state["water_temp"] * 0.15))

        # CİHAZLARIN ETKİSİ
        if devices["ventilation_fan"]: 
            state["chamber_temperature"] += (iss_temp - state["chamber_temperature"]) * 0.4
        else:
            state["chamber_temperature"] += 0.05
            
        if devices["dehumidifier"]:
            if state["chamber_humidity"] > 40.0:
                harvested = 0.5
                state["chamber_humidity"] -= 2.0 # Nemi havadan çeker
                state["water_tank_liters"] += harvested # Tanka sıvı su olarak döner!
                
        if devices["chiller"]:
            state["water_temp"] -= 0.3 # Su soğutucu aktiftir
            
        if devices["ph_doser"]:
            state["ph"] -= 0.1 # pH düşürücü solüsyon sıkılır

        # Limitler
        state["ph"] = max(0.0, min(14.0, state["ph"]))
        state["chamber_humidity"] = max(0.0, min(100.0, state["chamber_humidity"]))
        
        current_row_index += 1
        await asyncio.sleep(1)

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(physics_loop())

@app.get("/api/sensors")
def get_data(): return state

class Command(BaseModel):
    device: str
    action: bool

@app.post("/api/device")
def control_device(cmd: Command):
    if cmd.device in devices:
        devices[cmd.device] = cmd.action
        return {"status": "success"}
    return {"status": "error"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)