@echo off
color 0A
echo ===================================================
echo  KOTA - UZAY TARIMI SISTEMI v2.0 BASLATILIYOR...
echo ===================================================

echo [0/4] 8000 portu temizleniyor...
FOR /F "tokens=5" %%T IN ('netstat -a -n -o ^| findstr :8000') DO taskkill /F /PID %%T >nul 2>&1

echo [1/4] Python kutuphaneleri kontrol ediliyor...
pip install fastapi uvicorn pydantic >nul 2>&1

echo [2/4] Otonom Zeka (Node-RED) baslatiliyor...
start cmd /k "title KOTA Node-RED && node-red"

echo [3/4] Fizik Motoru (FastAPI) baslatiliyor...
cd PhysicSimulation
start cmd /k "title KOTA Fizik Motoru && python simulation.py"
cd ..

echo [SİSTEM BEKLEMESİ] Servisler baslatiliyor (5 saniye)...
timeout /t 5 /nobreak >nul

echo [4/4] Astronot Arayuzu aciliyor...
start FarmingApp\index.html

echo ===================================================
echo  TUM SISTEMLER AKTIF - LASF v2.0 HAZIR!
echo ===================================================
pause
