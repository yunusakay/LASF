Low Atmosphere Satellite Farming (LASF)

Purpose
- Simulate and monitor a closed-loop space farming cabin.
- Use telemetry-inspired climate data for autonomous control decisions.

Project Structure
- `PhysicSimulation/`: FastAPI physics + environment engine.
- `IoTSimulation/`: Node-RED automation flow and telemetry CSV.
- `FarmingApp/`: Minimal web dashboard for live monitoring + manual override.

Core Capabilities
- Tracks temperature, humidity, pH, water, NPK-driven crop recommendation.
- Supports autonomous device control (fan, dehumidifier, dosers).
- Allows manual test commands from dashboard.

Quick Start
1) Run physics engine:
   `python PhysicSimulation/simulation.py`
2) Open dashboard:
   `FarmingApp/index.html`
3) (Optional) Import `IoTSimulation/flows.json` into Node-RED.
