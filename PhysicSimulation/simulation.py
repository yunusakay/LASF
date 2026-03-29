"""
LASF - Low Atmosphere Satellite Farming
KOTA Physics Engine v2.0
NASA ISS VEG-01C Telemetry-Driven Autonomous Hydroponic Simulation
"""

import os
import math
import asyncio
import csv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

# ---------------------------------------------------------------------------
# APP SETUP
# ---------------------------------------------------------------------------

app = FastAPI(title="KOTA NPK Akıllı Tarım Motoru v2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# NASA DATASET LOADER
# ---------------------------------------------------------------------------

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.path.join(BASE_DIR, "..", "IoTSimulation", "VEG-01C_EDA_Telemetry_data.csv")

dataset: list[dict] = []

try:
    with open(CSV_PATH, mode="r", encoding="utf-8") as file:
        reader = csv.DictReader(file)
        last_valid_temp = 23.0
        last_valid_hum  = 40.0
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
            dataset.append({
                "time":     row["Controller_Time_GMT"],
                "iss_temp": temp,
                "iss_hum":  hum,
            })
    print(f"[BAŞARILI] {len(dataset)} satır NASA verisi yüklendi.")
except FileNotFoundError:
    print(f"[UYARI] Veri seti bulunamadı: {CSV_PATH}")
    print("[UYARI] Fallback simülasyon verisi kullanılıyor.")
    for i in range(86400):  # 24 saat fallback
        dataset.append({
            "time":     f"FALLBACK-{i:05d}",
            "iss_temp": 23.0 + 0.5 * math.sin(i / 300),
            "iss_hum":  55.0 + 5.0 * math.sin(i / 500),
        })

# ---------------------------------------------------------------------------
# SIMULATION CONSTANTS  (all physics parameters in one place)
# ---------------------------------------------------------------------------

# NPK consumption rates (ppm per tick)
NPK_CONSUME_N = 0.15
NPK_CONSUME_P = 0.05
NPK_CONSUME_K = 0.12

# Auto-restock thresholds (ppm)
NPK_RESTOCK_LOW  = 40.0   # trigger auto-dosing below this
NPK_RESTOCK_HIGH = 90.0   # stop auto-dosing above this
NPK_DOSE_N = 5.0
NPK_DOSE_P = 2.0
NPK_DOSE_K = 4.0

# pH targets
PH_DRIFT_PER_TICK  = 0.02   # natural rise per tick
PH_DOSE_PER_TICK   = 0.10   # acid doser correction per tick
PH_HIGH_THRESHOLD  = 6.5    # trigger pH doser
PH_LOW_THRESHOLD   = 5.8    # stop pH doser
PH_MIN             = 4.0
PH_MAX             = 8.0

# Water constants
WATER_CONSUME_NORMAL = 0.05  # L per tick (normal transpiration)
WATER_CONSUME_STRESS = 0.02  # L per tick (during stress — reduced uptake)
WATER_DEHUMIDIFY_HARVEST = 0.5   # L recovered per dehumidifier tick
WATER_DEHUMIDIFY_HUM_DROP = 2.0  # humidity % drop per dehumidifier tick
WATER_TANK_MIN       = 0.0
WATER_EMERGENCY_BELOW = 4.0  # force dehumidifier on below this level

# Temperature
TEMP_RISE_PER_TICK   = 0.05  # passive heat accumulation
TEMP_FAN_BLEND_RATE  = 0.4   # how fast fan equalizes with ISS ambient

# Humidity limits
HUM_RISE_NORMAL = 0.5        # per tick (normal transpiration)
HUM_RISE_STRESS = 0.2        # per tick (stress — less transpiration)

# Stress durations (ticks = seconds in this simulation)
LIGHT_STRESS_DURATION   = 120
OSMOTIC_STRESS_DURATION = 180
EC_OSMOTIC_STEP         = 0.05
EC_OSMOTIC_MAX          = 3.0
EC_RECOVERY_STEP        = 0.10
EC_RECOVERY_TARGET      = 1.8

# ---------------------------------------------------------------------------
# SIMULATION STATE
# ---------------------------------------------------------------------------

current_row_index: int = 0

# Accumulated stats for demo presentation
stats = {
    "water_harvested_total": 0.0,   # total liters recovered by dehumidifier
    "npk_doses_given": 0,           # how many times NPK was auto-dosed
    "mission_elapsed_ticks": 0,     # total ticks since start
    "stress_cycles_completed": 0,   # how many full stress→recovery cycles
}

state: dict = {
    # Time
    "current_time":           "Başlatılıyor...",
    # Environment
    "chamber_temperature":    23.0,
    "chamber_humidity":       50.0,
    # Water system
    "water_tank_liters":      20.0,
    "water_temp":             22.0,
    # Chemistry
    "ph":                     6.0,
    "ec":                     1.8,
    # NPK minerals (ppm)
    "mineral_n":              120.0,
    "mineral_p":              50.0,
    "mineral_k":              150.0,
    # AI decision
    "ai_recommendation":      "Analiz Ediliyor...",
    "ai_crop":                "NONE",  # clean enum: LETTUCE | STRAWBERRY | POTATO | DEPLETED
    # Stress state machine
    "vpd_kpa":                1.0,
    "light_ppfd":             400.0,
    "blue_light_ratio":       20.0,
    "stress_phase":           "NORMAL",
    "stress_duration_ticks":  0,
    # Aggregated stats (exposed to UI)
    "water_harvested_total":  0.0,
    "npk_doses_given":        0,
    "mission_elapsed_ticks":  0,
    "stress_cycles_completed": 0,
    # Alerts (list of active alert strings)
    "alerts":                 [],
}

devices: dict = {
    "ventilation_fan":    False,
    "dehumidifier":       False,
    "chiller":            False,
    "ph_doser":           False,
    "npk_doser":          False,
    "grow_lights":        True,
    "spectrum_controller": True,
    "ec_doser":           False,
}

# Track whether NPK doser was manually overridden so auto-logic doesn't fight it
_npk_manual_override: bool = False
_ph_manual_override:  bool  = False

# ---------------------------------------------------------------------------
# PHYSICS HELPERS
# ---------------------------------------------------------------------------

def _calc_vpd(temp_c: float, humidity_pct: float) -> float:
    """Buck equation simplified — returns VPD in kPa."""
    svp = 0.61078 * math.exp((17.27 * temp_c) / (temp_c + 237.3))
    avp = svp * (humidity_pct / 100.0)
    return round(svp - avp, 3)


def _clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))


# ---------------------------------------------------------------------------
# AUTONOMOUS NPK AUTO-RESTOCK
# ---------------------------------------------------------------------------

def _autonomous_npk_restock() -> None:
    """
    Auto-trigger NPK doser when any macro-nutrient drops critically low.
    Does not override a manual command (manual override takes 10 ticks priority).
    """
    global _npk_manual_override
    if _npk_manual_override:
        return

    n, p, k = state["mineral_n"], state["mineral_p"], state["mineral_k"]
    needs_dose = (n < NPK_RESTOCK_LOW or p < NPK_RESTOCK_LOW or k < NPK_RESTOCK_LOW)
    fully_stocked = (n >= NPK_RESTOCK_HIGH and p >= NPK_RESTOCK_HIGH and k >= NPK_RESTOCK_HIGH)

    if needs_dose and not devices["npk_doser"]:
        devices["npk_doser"] = True
        state["alerts"].append("AUTO-NPK: Besin seviyesi düşük, gübre dozlanıyor.")
    elif fully_stocked and devices["npk_doser"]:
        devices["npk_doser"] = False


# ---------------------------------------------------------------------------
# AUTONOMOUS pH CONTROL
# ---------------------------------------------------------------------------

def _autonomous_ph_control() -> None:
    """
    Auto-trigger acid doser when pH climbs above target range.
    """
    if _ph_manual_override:
        return

    ph = state["ph"]
    if ph > PH_HIGH_THRESHOLD and not devices["ph_doser"]:
        devices["ph_doser"] = True
        state["alerts"].append(f"AUTO-pH: pH {ph:.2f} — asit dozlayıcı devreye girdi.")
    elif ph <= PH_LOW_THRESHOLD and devices["ph_doser"]:
        devices["ph_doser"] = False


# ---------------------------------------------------------------------------
# WATER EMERGENCY MANAGEMENT
# ---------------------------------------------------------------------------

def _autonomous_water_management() -> None:
    """Force dehumidifier on when tank is critically low."""
    if state["water_tank_liters"] <= WATER_EMERGENCY_BELOW:
        if not devices["dehumidifier"]:
            devices["dehumidifier"] = True
            state["alerts"].append(
                f"ALARM: Su tankı kritik ({state['water_tank_liters']:.1f}L) — dehumidifier zorla açıldı!"
            )


# ---------------------------------------------------------------------------
# STRESS STATE MACHINE
# ---------------------------------------------------------------------------

def _apply_stress_algorithm(current_crop: str, temp: float, hum: float) -> None:
    """
    VPD-based mild stress protocol to improve water-use efficiency.
    NORMAL → LIGHT_STRESS (Lettuce) or OSMOTIC_STRESS (Potato) → RECOVERY → NORMAL
    """
    global state, devices

    state["vpd_kpa"] = _calc_vpd(temp, hum)
    phase = state["stress_phase"]

    if phase == "NORMAL":
        # Only enter stress when resources are sufficient and conditions are safe
        if state["water_tank_liters"] > 15.0 and temp < 25.0:
            if current_crop == "LETTUCE":
                state["stress_phase"]          = "LIGHT_STRESS"
                state["stress_duration_ticks"] = 0
            elif current_crop == "POTATO":
                state["stress_phase"]          = "OSMOTIC_STRESS"
                state["stress_duration_ticks"] = 0

    elif phase == "LIGHT_STRESS":
        # Reduce PPFD, increase blue-light ratio → thicker leaves, higher water efficiency
        state["light_ppfd"]        = 340.0
        state["blue_light_ratio"]  = 35.0
        state["stress_duration_ticks"] += 1
        if state["stress_duration_ticks"] >= LIGHT_STRESS_DURATION:
            state["stress_phase"] = "RECOVERY"

    elif phase == "OSMOTIC_STRESS":
        # Mildly elevate EC → restrict water uptake → redirect energy to tubers
        devices["ec_doser"] = True
        state["ec"] += EC_OSMOTIC_STEP
        state["stress_duration_ticks"] += 1
        if state["ec"] >= EC_OSMOTIC_MAX or state["stress_duration_ticks"] >= OSMOTIC_STRESS_DURATION:
            devices["ec_doser"] = False
            state["stress_phase"] = "RECOVERY"

    elif phase == "RECOVERY":
        # Restore optimal growth parameters
        state["light_ppfd"]       = 400.0
        state["blue_light_ratio"] = 20.0
        if state["ec"] > EC_RECOVERY_TARGET:
            state["ec"] -= EC_RECOVERY_STEP
            state["water_tank_liters"] += 0.5   # dilution refill simulation
        state["ec"] = max(EC_RECOVERY_TARGET, state["ec"])
        if state["ec"] <= EC_RECOVERY_TARGET + 0.2:
            state["stress_phase"] = "NORMAL"
            state["stress_cycles_completed"] += 1


# ---------------------------------------------------------------------------
# AI CROP RECOMMENDATION ENGINE
# ---------------------------------------------------------------------------

def _run_ai_recommendation() -> None:
    """
    Reads current NPK profile and recommends the optimal crop to plant.
    Sets both a human-readable string and a clean enum for logic use.
    """
    n, p, k = state["mineral_n"], state["mineral_p"], state["mineral_k"]
    total = n + p + k

    if total < 100:
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
# MAIN PHYSICS LOOP
# ---------------------------------------------------------------------------

async def physics_loop() -> None:
    global current_row_index

    while True:
        # Cycle through the dataset; wrap around when exhausted
        if current_row_index >= len(dataset):
            current_row_index = 0

        row_data  = dataset[current_row_index]
        iss_temp  = row_data["iss_temp"]
        iss_hum   = row_data["iss_hum"]

        state["current_time"]          = row_data["time"]
        state["mission_elapsed_ticks"] += 1
        state["alerts"]                = []   # clear per-tick alerts

        # ------------------------------------------------------------------
        # 1. MINERAL CONSUMPTION
        # ------------------------------------------------------------------
        state["mineral_n"] -= NPK_CONSUME_N
        state["mineral_p"] -= NPK_CONSUME_P
        state["mineral_k"] -= NPK_CONSUME_K

        # Floor at 0 — cannot go negative
        state["mineral_n"] = max(0.0, state["mineral_n"])
        state["mineral_p"] = max(0.0, state["mineral_p"])
        state["mineral_k"] = max(0.0, state["mineral_k"])

        # ------------------------------------------------------------------
        # 2. AI CROP RECOMMENDATION
        # ------------------------------------------------------------------
        _run_ai_recommendation()

        # ------------------------------------------------------------------
        # 3. AUTONOMOUS CONTROL RULES
        # ------------------------------------------------------------------
        _autonomous_npk_restock()
        _autonomous_ph_control()
        _autonomous_water_management()

        # ------------------------------------------------------------------
        # 4. STRESS ALGORITHM
        # ------------------------------------------------------------------
        _apply_stress_algorithm(
            current_crop=state["ai_crop"],
            temp=state["chamber_temperature"],
            hum=state["chamber_humidity"],
        )

        # ------------------------------------------------------------------
        # 5. PHYSICS: TRANSPIRATION & WATER
        # ------------------------------------------------------------------
        in_stress = state["stress_phase"] in ("LIGHT_STRESS", "OSMOTIC_STRESS")
        water_consume = WATER_CONSUME_STRESS if in_stress else WATER_CONSUME_NORMAL
        hum_rise      = HUM_RISE_STRESS      if in_stress else HUM_RISE_NORMAL

        state["chamber_humidity"]    += hum_rise
        state["water_tank_liters"]   -= water_consume

        # ------------------------------------------------------------------
        # 6. PHYSICS: pH NATURAL DRIFT
        # ------------------------------------------------------------------
        state["ph"] += PH_DRIFT_PER_TICK

        # ------------------------------------------------------------------
        # 7. PHYSICS: WATER TEMPERATURE DRIFT
        # ------------------------------------------------------------------
        if state["water_temp"] < state["chamber_temperature"]:
            state["water_temp"] += 0.05

        # ------------------------------------------------------------------
        # 8. DEVICE EFFECTS
        # ------------------------------------------------------------------
        if devices["npk_doser"]:
            state["mineral_n"] += NPK_DOSE_N
            state["mineral_p"] += NPK_DOSE_P
            state["mineral_k"] += NPK_DOSE_K
            state["npk_doses_given"] += 1

        if devices["ventilation_fan"]:
            # Blend chamber temperature toward ISS ambient
            state["chamber_temperature"] += (iss_temp - state["chamber_temperature"]) * TEMP_FAN_BLEND_RATE
        else:
            state["chamber_temperature"] += TEMP_RISE_PER_TICK

        if devices["dehumidifier"] and state["chamber_humidity"] > 40.0:
            state["chamber_humidity"]        -= WATER_DEHUMIDIFY_HUM_DROP
            state["water_tank_liters"]       += WATER_DEHUMIDIFY_HARVEST
            state["water_harvested_total"]   += WATER_DEHUMIDIFY_HARVEST

        if devices["chiller"]:
            state["water_temp"] -= 0.3

        if devices["ph_doser"]:
            state["ph"] -= PH_DOSE_PER_TICK

        # ------------------------------------------------------------------
        # 9. CLAMP ALL VALUES TO PHYSICAL BOUNDS
        # ------------------------------------------------------------------
        state["ph"]                  = _clamp(state["ph"], PH_MIN, PH_MAX)
        state["chamber_humidity"]    = _clamp(state["chamber_humidity"], 0.0, 100.0)
        state["water_tank_liters"]   = _clamp(state["water_tank_liters"], WATER_TANK_MIN, 100.0)
        state["chamber_temperature"] = _clamp(state["chamber_temperature"], 15.0, 40.0)
        state["water_temp"]          = _clamp(state["water_temp"], 10.0, 35.0)
        state["ec"]                  = _clamp(state["ec"], 0.5, 4.0)

        # ------------------------------------------------------------------
        # 10. SYNC STATS TO STATE (for API exposure)
        # ------------------------------------------------------------------
        state["water_harvested_total"]  = round(state["water_harvested_total"], 2)
        state["npk_doses_given"]        = state["npk_doses_given"]
        state["stress_cycles_completed"] = state["stress_cycles_completed"]

        # ------------------------------------------------------------------
        # 11. CONSOLE LOG
        # ------------------------------------------------------------------
        print(
            f"[{state['current_time']}] "
            f"N:{state['mineral_n']:.0f} P:{state['mineral_p']:.0f} K:{state['mineral_k']:.0f} | "
            f"pH:{state['ph']:.2f} EC:{state['ec']:.2f} | "
            f"H2O:{state['water_tank_liters']:.1f}L | "
            f"Crop:{state['ai_crop']} | "
            f"Stress:{state['stress_phase']} VPD:{state['vpd_kpa']:.2f}"
        )

        current_row_index += 1
        await asyncio.sleep(1)


# ---------------------------------------------------------------------------
# STARTUP
# ---------------------------------------------------------------------------

@app.on_event("startup")
async def startup_event() -> None:
    asyncio.create_task(physics_loop())


# ---------------------------------------------------------------------------
# API ENDPOINTS
# ---------------------------------------------------------------------------

@app.get("/api/sensors")
def get_sensors():
    """Returns the full simulation state including device statuses."""
    return {**state, "devices": devices}


@app.get("/api/stats")
def get_stats():
    """Returns aggregated mission statistics."""
    water_efficiency = 0.0
    total_consumed = state["mission_elapsed_ticks"] * WATER_CONSUME_NORMAL
    if total_consumed > 0:
        water_efficiency = round((state["water_harvested_total"] / total_consumed) * 100, 1)
    return {
        "water_harvested_total":    state["water_harvested_total"],
        "water_efficiency_pct":     water_efficiency,
        "npk_doses_given":          state["npk_doses_given"],
        "mission_elapsed_ticks":    state["mission_elapsed_ticks"],
        "stress_cycles_completed":  state["stress_cycles_completed"],
    }


class DeviceCommand(BaseModel):
    device: str
    action: bool


@app.post("/api/device")
def control_device(cmd: DeviceCommand):
    """Manually override a device. Marks it as manually controlled."""
    global _npk_manual_override, _ph_manual_override
    if cmd.device not in devices:
        return {"status": "error", "message": f"Unknown device: {cmd.device}"}
    devices[cmd.device] = cmd.action
    if cmd.device == "npk_doser":
        _npk_manual_override = True
    if cmd.device == "ph_doser":
        _ph_manual_override = True
    return {"status": "success", "device": cmd.device, "action": cmd.action}


@app.post("/api/auto")
def release_to_auto():
    """Release all manual overrides — hand full control back to autonomous logic."""
    global _npk_manual_override, _ph_manual_override
    _npk_manual_override = False
    _ph_manual_override  = False
    return {"status": "success", "message": "Tüm cihazlar otonom kontrole devredildi."}


# ---------------------------------------------------------------------------
# ENTRY POINT
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
