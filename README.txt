Yunus AKAY
Yunus Emre GÜNAY
Emir Samet YALÇINKAYA
TÜM HAKLARI SAKLIDIR
================================================================================
Low Atmosphere Satellite Farming (LASF)
NASA ISS Telemetrisi Destekli Otonom Uzay Tarımı ve Kapalı Döngü Yaşam Destek Sistemi
Sürüm: 2.0 (Final)
================================================================================

🎯 GÖREVİMİZ
Alçak Dünya Yörüngesindeki (LEO) bir uydu veya uzay istasyonu modülü içinde, bitkisel üretkenliği ve su verimliliğini maksimize eden tam otonom bir "Software-in-the-Loop (SITL)" dijital ikiz tasarlamak. Sistemimiz, gerçek NASA ISS VEG-01C (Zinnia) telemetri verilerini referans alarak çalışır.

⚠️ ÇÖZÜLEN SORUNLAR (Odak Noktalarımız)
Uzay tarımının en kritik 3 sorununa odaklanılmıştır:
1. Su Kıtlığı ve İsrafı: Bitki terlemesiyle (transpirasyon) havaya karışan suyun uzayda kaybolması.
2. Kapalı Ortam İklimlendirmesi: ISS ortamındaki tehlikeli nem ve sıcaklık dalgalanmaları (2 Astronotun ortama yaydığı vücut ısısı ve solunum nemi dahil edilerek modellenmiştir).
3. Besin (Mineral) Yönetimi: Kısıtlı kaynaklarla hangi bitkinin ne zaman ekileceğinin bilinmemesi ve NPK toksisitesi.

⚙️ GELİŞTİRİLEN TEKNOLOJİLER VE ALGORİTMALAR
Projenin ana omurgasını oluşturan yenilikçi yazılım ve donanım mimarileri:

1. Biyolojik Stres ve Su Verimliliği Algoritması (YENİ)
Sistemimiz, bitkilerin terleme oranlarını (VPD) analiz ederek su tasarrufu sağlamak için kontrollü stres uygular:
- Marul (Işık Stresi): Işık şiddeti (PPFD) düşürülür ve Mavi Işık oranı artırılarak yaprakların kalınlaşması, böylece yüzey alanından kaybedilen suyun azaltılması sağlanır.
- Patates (Ozmotik Stres): Hidroponik suyunun EC (İletkenlik) değeri artırılarak bitkinin suyu yapraklara değil, yüksek kalorili yumrularına (patatese) yönlendirmesi sağlanır.

2. Yapay Zeka NPK Ekim Öneri Motoru
Hidroponik suyundaki Azot (N), Fosfor (P) ve Potasyum (K) miktarlarını anlık (0-250 ppm sınırlarında) analiz ederek o anki su profiline en uygun bitkiyi astronotlara öneren karar destek algoritması.

3. Otonom İklim Zekası ve Su Hasadı (Dehumidifier)
Simülasyon motoru; kabin sıcaklığı 26°C'yi aştığında soğutucu fanları, nem oranı %60'ı aştığında ise Nem Toplayıcıyı (Dehumidifier) otonom olarak devreye sokar. Havadaki tehlikeli nem emilerek sıvı suya dönüştürülür ve su tankına geri kazandırılır.

4. Digital Twin Validation (Dijital İkiz Doğrulaması)
Sistemimiz "compare.html" sayfası üzerinden, uyguladığımız otonom müdahalelerin ve 2 astronotun yarattığı etkinin, orijinal NASA ISS telemetri verileriyle (Zinnia bitkisi kontrol grubu) anlık karşılaştırmasını ve doğrulamasını sunar.

🌱 SİSTEM EKOSİSTEMİ (3'lü Döngü)
Sistemimiz mineral tüketim profillerine göre 3 ana bitki üzerinden optimize edilmiştir:
- Marul (Lettuce): Yüksek Azot (N) tüketici. Hızlı yetişen yapraklı yeşillik. Işık stresi ile su verimliliği sağlanır.
- Patates (Potato): Yüksek Potasyum (K) tüketici. Temel karbonhidrat ve yüksek kalori kaynağı. Ozmotik stres ile yumru gelişimi maksimize edilir.
- Çilek / Soya (Strawberry/Soybean): Dengeli Fosfor (P) tüketici.

🚀 NASIL ÇALIŞTIRILIR?
1. Backend (Fizik Motoru): Terminal veya PowerShell üzerinden `simulation.py` dosyasını çalıştırın. (Örn: `python PhysicSimulation/simulation.py`)
   - Sunucu `http://127.0.0.1:8000` adresinde 80.388 satırlık NASA verisiyle ayağa kalkacaktır.
2. Ana Kontrol Paneli: Tarayıcınızda `FarmingApp/index.html` dosyasını açarak otonom sistemleri, NPK durumunu ve stres fazlarını canlı izleyin.
3. NASA Doğrulama Ekranı: Tarayıcınızda `FarmingApp/compare.html` dosyasını açarak fizik motorumuzun gerçek uzay verileriyle olan matematiksel karşılaştırmasını jüriye sunun.

🌍 NEDEN UZAY TARIMCILIĞI?
İnsan biyolojisi ve psikolojisi, Dünya'nın bitki örtüsüyle birlikte evrimleşmiştir. Derin uzay görevleri, Dünya'dan sürekli gıda ikmali alamazlar. Kendi yiyeceğimizi üretmek sadece biyolojik bir hayatta kalma zorunluluğu değil, aynı zamanda kapalı uzay ortamında astronotların ruh sağlığını korumak için kritik bir ihtiyaçtır.
