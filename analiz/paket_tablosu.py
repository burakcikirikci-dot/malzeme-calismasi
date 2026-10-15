"""Tüm olası paketlerin (4 yüzey × 4 seçenek = 256) maliyet ve karbon tablosu.

Kullanım:  python analiz/paket_tablosu.py
Çıktı:     analiz/paket_tablosu.csv  (bütçe ayarı ve normalize endeks için)

Kartlar js/stimuli.js dosyasından okunur; kartları değiştirdiğinizde betiği yeniden çalıştırın.
"""
import csv, itertools, json, math, pathlib

KOK = pathlib.Path(__file__).resolve().parent.parent
metin = (KOK / "js" / "stimuli.js").read_text(encoding="utf-8")
K = json.loads(metin[metin.index("{"): metin.rindex("}") + 1])
yuzeyler = K["yuzeyler"]
butce, T = K["butce_tl"], K["referans_sure_yil"]

satirlar = []
for kombin in itertools.product(*[y["secenekler"] for y in yuzeyler]):
    m = sum(o["maliyet_m2"] * y["alan_m2"] for y, o in zip(yuzeyler, kombin))
    k = sum(o["karbon_m2"] * y["alan_m2"] for y, o in zip(yuzeyler, kombin))
    r = sum(o["karbon_m2"] * y["alan_m2"] * math.ceil(T / o["omur_yil"]) for y, o in zip(yuzeyler, kombin))
    s = {y["id"]: o["kod"] for y, o in zip(yuzeyler, kombin)}
    s.update(paket="".join(o["kod"] for o in kombin), maliyet_tl=m, karbon_kg=k, referans_karbon_kg=r, butce_icinde=m <= butce)
    satirlar.append(s)

kmin, kmax = min(s["karbon_kg"] for s in satirlar), max(s["karbon_kg"] for s in satirlar)
for s in satirlar:
    s["karbon_endeks"] = round((s["karbon_kg"] - kmin) / (kmax - kmin), 3)
satirlar.sort(key=lambda s: (s["karbon_kg"], s["maliyet_tl"]))

cikti = KOK / "analiz" / "paket_tablosu.csv"
with cikti.open("w", newline="", encoding="utf-8-sig") as f:
    w = csv.DictWriter(f, fieldnames=list(satirlar[0].keys()))
    w.writeheader(); w.writerows(satirlar)

icinde = [s for s in satirlar if s["butce_icinde"]]
en_dusuk = satirlar[0]
en_iyi = max(satirlar, key=lambda s: s["maliyet_tl"])
print(f"{len(satirlar)} paket yazıldı: {cikti}")
print(f"Bütçe {butce:,} TL · bütçe içinde {len(icinde)} paket")
print(f"Karbon aralığı: {kmin:,} – {kmax:,} kg CO2e")
print(f"En düşük karbonlu paket {en_dusuk['paket']}: {en_dusuk['maliyet_tl']:,} TL, bütçe içinde: {en_dusuk['butce_icinde']}")
print(f"En pahalı paket {en_iyi['paket']}: {en_iyi['maliyet_tl']:,} TL, bütçe içinde: {en_iyi['butce_icinde']}")
if not en_dusuk["butce_icinde"]:
    print("UYARI: en düşük karbonlu paket bütçeyi aşıyor; bütçeyi artırın.")
if en_iyi["butce_icinde"]:
    print("UYARI: en pahalı paket bütçe içinde; bütçe hiçbir ödünleşim yaratmıyor.")
