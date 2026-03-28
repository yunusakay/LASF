@echo off
color 0A
echo ===================================================
echo 🚀 KOTA - UZAY TARIMI SISTEMI BASLATILIYOR...
echo ===================================================

echo [0/4] Eski acik sunucular temizleniyor (Port 8000 aciliyor)...
taskkill /F /IM python.exe /T >nul 2>&1

echo [1/4] Gerekli Python kutuphaneleri kontrol ediliyor...
pip install fastapi uvicorn pydantic >nul 2>&1

echo [2/4] Otonom Zeka (Node-RED) baslatiliyor...
start cmd /k "title KOTA Node-RED && node-red"

echo [3/4] Fizik Motoru (FastAPI) baslatiliyor...
cd PhysicSimulation
start cmd /k "title KOTA Fizik Motoru && python simulation.py"
cd ..

echo [SISTEM BEKLEMESI] Servislerin ayaga kalkmasi icin 4 saniye bekleniyor...
timeout /t 4 /nobreak >nul

echo [4/4] Astronot Arayuzu (Dashboard) aciliyor...
start FarmingApp\index.html

echo ===================================================
echo ✅ TUM SISTEMLER AKTIF! BASARILAR TAKIM!
echo ===================================================
pause