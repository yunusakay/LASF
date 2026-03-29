"""
LASF — Low Atmosphere Satellite Farming
KOTA Physics Engine v2.0
NASA ISS VEG-01C Telemetry-Driven Autonomous Hydroponic Simulation
"""

import os
import math
import asyncio
import csv
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

# ---------------------------------------------------------------------------
# SIMULATION CONSTANTS
# ---------------------------------------------------------------------------

NPK_CONSUME_N, NPK_CONSUME_P, NPK_CONSUME_K = 0.15, 0.05, 0.12
NPK_RESTOCK_LOW, NPK_RESTOCK_HIGH           = 40.0, 90.0
NPK_DOSE_N, NPK_DOSE_P, NPK_DOSE_K         = 5.0, 2.0, 4.0

PH_DRIFT_PER_TICK                          = 0.02
PH_DOSE_PER_TICK                           = 0.10
PH_HIGH_THRESHOLD, PH_LOW_THRESHOLD       = 6.5, 5.8
PH_MIN, PH_MAX                             = 4.0, 8.0

WATER_CONSUME_NORMAL                       = 0.05
WATER_CONSUME_STRESS                       = 0.02
WATER_DEHUMIDIFY_HARVEST                   = 0.5
WATER_DEHUMIDIFY_HUM_DROP                  = 2.0
WATER_TANK_MIN                             = 0.0
WATER_EMERGENCY_BELOW                      = 4.0

TEMP_RISE_PER_TICK                         = 0.05
TEMP_FAN_BLEND_RATE                        = 0.4

HUM_RISE_NORMAL, HUM_RISE_STRESS          = 0.5, 0.2

LIGHT_STRESS_DURATION                      = 120
OSMOTIC_STRESS_DURATION                    = 180
EC_OSMOTIC_STEP, EC_OSMOTIC_MAX           = 0.05, 3.0
EC_RECOVERY_STEP, EC_RECOVERY_TARGET      = 0.10, 1.8

# ---------------------------------------------------------------------------
# NASA DATASET
# ---------------------------------------------------------------------------

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.path.join(BASE_DIR, "..", "IoTSimulation", "VEG-01C_EDA_Telemetry_data.csv")

dataset: list[dict] = []

try:
    with open(CSV_PATH, encoding="utf-8") as f:
        last_temp, last_hum = 23.0, 40.0
        for row in csv.DictReader(f):
            try:    last_temp = float(row["Temp_degC_ISS"])
            except: pass
            try:    last_hum = float(row["RH_percent_ISS"])
            except: pass
            dataset.append({"time": row["Controller_Time_GMT"], "iss_temp": last_temp, "iss_hum": last_hum})
    print(f"[OK] {len(dataset)} NASA rows loaded.")
except FileNotFoundError:
    print("[WARN] Dataset not found — using fallback sine-wave data.")
    for i in range(86400):
        dataset.append({
            "time":     f"FALLBACK-{i:05d}",
            "iss_temp": 23.0 + 0.5 * math.sin(i / 300),
            "iss_hum":  55.0 + 5.0 * math.sin(i / 500),
        })

# ---------------------------------------------------------------------------
# STATE
# ---------------------------------------------------------------------------

current_row_index: int = 0

state: dict = {
    "current_time":            "Başlatılıyor...",
    "chamber_temperature":     23.0,
    "chamber_humidity":        50.0,
    "water_tank_liters":       20.0,
    "water_temp":              22.0,
    "ph":                      6.0,
    "ec":                      1.8,
    "mineral_n":               120.0,
    "mineral_p":               50.0,
    "mineral_k":               150.0,
    "ai_recommendation":       "Analiz Ediliyor...",
    "ai_crop":                 "NONE",
    "vpd_kpa":                 1.0,
    "light_ppfd":              400.0,
    "blue_light_ratio":        20.0,
    "stress_phase":            "NORMAL",
    "stress_duration_ticks":   0,
    "water_harvested_total":   0.0,
    "npk_doses_given":         0,
    "mission_elapsed_ticks":   0,
    "stress_cycles_completed": 0,
    "alerts":                  [],
}

devices: dict = {
    "ventilation_fan":     False,
    "dehumidifier":        False,
    "chiller":             False,
    "ph_doser":            False,
    "npk_doser":           False,
    "grow_lights":         True,
    "spectrum_controller": True,
    "ec_doser":            False,
}

_npk_manual_override = False
_ph_manual_override  = False

# ---------------------------------------------------------------------------
# HELPERS
# ---------------------------------------------------------------------------

def _vpd(temp: float, hum: float) -> float:
    svp = 0.61078 * math.exp((17.27 * temp) / (temp + 237.3))
    return round(svp - svp * (hum / 100.0), 3)

def _clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))

# ---------------------------------------------------------------------------
# AUTONOMOUS CONTROLLERS
# ---------------------------------------------------------------------------

def _ctrl_npk() -> None:
    if _npk_manual_override:
        return
    n, p, k = state["mineral_n"], state["mineral_p"], state["mineral_k"]
    if (n < NPK_RESTOCK_LOW or p < NPK_RESTOCK_LOW or k < NPK_RESTOCK_LOW) and not devices["npk_doser"]:
        devices["npk_doser"] = True
        state["alerts"].append("AUTO-NPK: Besin seviyesi düşük, gübre dozlanıyor.")
    elif n >= NPK_RESTOCK_HIGH and p >= NPK_RESTOCK_HIGH and k >= NPK_RESTOCK_HIGH and devices["npk_doser"]:
        devices["npk_doser"] = False

def _ctrl_ph() -> None:
    if _ph_manual_override:
        return
    ph = state["ph"]
    if ph > PH_HIGH_THRESHOLD and not devices["ph_doser"]:
        devices["ph_doser"] = True
        state["alerts"].append(f"AUTO-pH: pH {ph:.2f} — asit dozlayıcı devreye girdi.")
    elif ph <= PH_LOW_THRESHOLD and devices["ph_doser"]:
        devices["ph_doser"] = False

def _ctrl_water() -> None:
    if state["water_tank_liters"] <= WATER_EMERGENCY_BELOW and not devices["dehumidifier"]:
        devices["dehumidifier"] = True
        state["alerts"].append(f"ALARM: Su tankı kritik ({state['water_tank_liters']:.1f}L) — dehumidifier zorla açıldı!")

# ---------------------------------------------------------------------------
# STRESS STATE MACHINE
# ---------------------------------------------------------------------------

def _stress(crop: str, temp: float, hum: float) -> None:
    state["vpd_kpa"] = _vpd(temp, hum)
    phase = state["stress_phase"]

    if phase == "NORMAL":
        if state["water_tank_liters"] > 15.0 and temp < 25.0:
            if crop == "LETTUCE":
                state["stress_phase"], state["stress_duration_ticks"] = "LIGHT_STRESS", 0
            elif crop == "POTATO":
                state["stress_phase"], state["stress_duration_ticks"] = "OSMOTIC_STRESS", 0

    elif phase == "LIGHT_STRESS":
        state["light_ppfd"]            = 340.0
        state["blue_light_ratio"]      = 35.0
        state["stress_duration_ticks"] += 1
        if state["stress_duration_ticks"] >= LIGHT_STRESS_DURATION:
            state["stress_phase"] = "RECOVERY"

    elif phase == "OSMOTIC_STRESS":
        devices["ec_doser"] = True
        state["ec"]                    += EC_OSMOTIC_STEP
        state["stress_duration_ticks"] += 1
        if state["ec"] >= EC_OSMOTIC_MAX or state["stress_duration_ticks"] >= OSMOTIC_STRESS_DURATION:
            devices["ec_doser"]    = False
            state["stress_phase"]  = "RECOVERY"

    elif phase == "RECOVERY":
        state["light_ppfd"]       = 400.0
        state["blue_light_ratio"] = 20.0
        if state["ec"] > EC_RECOVERY_TARGET:
            state["ec"]                  -= EC_RECOVERY_STEP
            state["water_tank_liters"]   += 0.5
        state["ec"] = max(EC_RECOVERY_TARGET, state["ec"])
        if state["ec"] <= EC_RECOVERY_TARGET + 0.2:
            state["stress_phase"]              = "NORMAL"
            state["stress_cycles_completed"]   += 1

# ---------------------------------------------------------------------------
# AI CROP RECOMMENDATION
# ---------------------------------------------------------------------------

def _ai_recommend() -> None:
    n, p, k = state["mineral_n"], state["mineral_p"], state["mineral_k"]
    if n + p + k < 100:
        state["ai_recommendation"] = "⚠️ Mineraller Tükendi: Besin Ekleyin!"
        state["ai_crop"] = "DEPLETED"
    elif n >= k and n >= p:
        state["ai_recommendation"] = "🥬 Marul Ekin (Yüksek Azot Tespit Edildi)"
        state["ai_crop"] = "LETTUCE"
    elif k > n and k >= p:
        state["ai_recommendation"] = "🥔 Patates Ekin (Yüksek Potasyum Tespit Edildi)"
        state["ai_crop"] = "POTATO"
    else:
        state["ai_recommendation"] = "🍓 Çilek Ekin (Dengeli / Fosfor Uygun)"
        state["ai_crop"] = "STRAWBERRY"

# ---------------------------------------------------------------------------
# PHYSICS LOOP
# ---------------------------------------------------------------------------

async def physics_loop() -> None:
    global current_row_index
    while True:
        if current_row_index >= len(dataset):
            current_row_index = 0

        row = dataset[current_row_index]
        state["current_time"]          = row["time"]
        state["mission_elapsed_ticks"] += 1
        state["alerts"]                = []

        # --- SİMBİYOTİK EKOSİSTEM MİNERAL DÖNGÜSÜ ---
        # Soya azot üretir, marul tüketir, patates potasyum çeker
        soya_n_katkisi = 0.30     
        marul_n_tuketimi = 0.35   
        patates_k_tuketimi = 0.25 
        genel_p_tuketimi = 0.10   

        state["mineral_n"] = max(0.0, state["mineral_n"] + soya_n_katkisi - marul_n_tuketimi)
        state["mineral_p"] = max(0.0, state["mineral_p"] - genel_p_tuketimi)
        state["mineral_k"] = max(0.0, state["mineral_k"] - patates_k_tuketimi)

        _ai_recommend()
        _ctrl_npk()
        _ctrl_ph()
        _ctrl_water()
        _stress(state["ai_crop"], state["chamber_temperature"], state["chamber_humidity"])

        in_stress = state["stress_phase"] in ("LIGHT_STRESS", "OSMOTIC_STRESS")
        state["chamber_humidity"]  += HUM_RISE_STRESS  if in_stress else HUM_RISE_NORMAL
        state["water_tank_liters"] -= WATER_CONSUME_STRESS if in_stress else WATER_CONSUME_NORMAL

        state["ph"] += PH_DRIFT_PER_TICK
        if state["water_temp"] < state["chamber_temperature"]:
            state["water_temp"] += 0.05

        if devices["npk_doser"]:
            state["mineral_n"]       += NPK_DOSE_N
            state["mineral_p"]       += NPK_DOSE_P
            state["mineral_k"]       += NPK_DOSE_K
            state["npk_doses_given"] += 1

        if devices["ventilation_fan"]:
            state["chamber_temperature"] += (row["iss_temp"] - state["chamber_temperature"]) * TEMP_FAN_BLEND_RATE
        else:
            state["chamber_temperature"] += TEMP_RISE_PER_TICK

        if devices["dehumidifier"] and state["chamber_humidity"] > 40.0:
            state["chamber_humidity"]      -= WATER_DEHUMIDIFY_HUM_DROP
            state["water_tank_liters"]     += WATER_DEHUMIDIFY_HARVEST
            state["water_harvested_total"] += WATER_DEHUMIDIFY_HARVEST

        if devices["chiller"]:
            state["water_temp"] -= 0.3
        if devices["ph_doser"]:
            state["ph"] -= PH_DOSE_PER_TICK

        # Clamp (Sınırlandırmalar)
        state["ph"]                    = _clamp(state["ph"], PH_MIN, PH_MAX)
        state["chamber_humidity"]      = _clamp(state["chamber_humidity"], 0.0, 100.0)
        state["water_tank_liters"]     = _clamp(state["water_tank_liters"], WATER_TANK_MIN, 100.0)
        state["chamber_temperature"]   = _clamp(state["chamber_temperature"], 15.0, 40.0)
        state["water_temp"]            = _clamp(state["water_temp"], 10.0, 35.0)
        state["ec"]                    = _clamp(state["ec"], 0.5, 4.0)
        state["water_harvested_total"] = round(state["water_harvested_total"], 2)

        print(
            f"[{state['current_time']}] "
            f"N:{state['mineral_n']:.0f} P:{state['mineral_p']:.0f} K:{state['mineral_k']:.0f} | "
            f"pH:{state['ph']:.2f} EC:{state['ec']:.2f} | "
            f"H2O:{state['water_tank_liters']:.1f}L | "
            f"Crop:{state['ai_crop']} Stress:{state['stress_phase']}"
        )

        current_row_index += 1
        await asyncio.sleep(1)

# ---------------------------------------------------------------------------
# APP
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    asyncio.create_task(physics_loop())
    yield

app = FastAPI(title="KOTA NPK Akıllı Tarım Motoru v2.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/sensors")
def get_sensors():
    return {**state, "devices": devices}

@app.get("/api/stats")
def get_stats():
    total_consumed = state["mission_elapsed_ticks"] * WATER_CONSUME_NORMAL
    efficiency = round((state["water_harvested_total"] / total_consumed) * 100, 1) if total_consumed else 0.0
    return {
        "water_harvested_total":   state["water_harvested_total"],
        "water_efficiency_pct":    efficiency,
        "npk_doses_given":         state["npk_doses_given"],
        "mission_elapsed_ticks":   state["mission_elapsed_ticks"],
        "stress_cycles_completed": state["stress_cycles_completed"],
    }

class DeviceCommand(BaseModel):
    device: str
    action: bool

@app.post("/api/device")
def control_device(cmd: DeviceCommand):
    global _npk_manual_override, _ph_manual_override
    if cmd.device not in devices:
        return {"status": "error", "message": f"Unknown device: {cmd.device}"}
    devices[cmd.device] = cmd.action
    if cmd.device == "npk_doser": _npk_manual_override = True
    if cmd.device == "ph_doser":  _ph_manual_override  = True
    return {"status": "success", "device": cmd.device, "action": cmd.action}

@app.post("/api/auto")
def release_to_auto():
    global _npk_manual_override, _ph_manual_override
    _npk_manual_override = False
    _ph_manual_override  = False
    return {"status": "success", "message": "Tüm cihazlar otonom kontrole devredildi."}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
