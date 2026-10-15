"""DataPipe'ın Google Drive klasörüne kaydettiği katılımcı dosyalarını tek tabloya çevirir.

Kullanım:  python analiz/birlestir.py <veri_klasoru>
Çıktı:     <veri_klasoru>/ozet_tablosu.csv  (her katılımcı için bir satır)

- Tamamlanan her katılımcının dosyasında bölümü "ozet" olan bir satır vardır; analiz o satırdan yapılır.
- Önizleme modunda alınan veriler ("onizleme" = true) ayrıca işaretlenir.
- Yarıda bırakılan oturumlar DataPipe tarafından ".partial.json" olarak yazılır; bunlar yalnızca sayılır
  (CONSORT akış şemasındaki "başladı ama bitirmedi" kutusu için).
"""
import csv, pathlib, sys

if len(sys.argv) != 2:
    sys.exit("Kullanım: python analiz/birlestir.py <veri_klasoru>")
klasor = pathlib.Path(sys.argv[1])
csv.field_size_limit(10_000_000)

ozetler, eksik = [], []
for dosya in sorted(klasor.glob("*.csv")):
    if dosya.name == "ozet_tablosu.csv":
        continue
    with dosya.open(encoding="utf-8-sig", newline="") as f:
        satirlar = list(csv.DictReader(f))
    oz = [s for s in satirlar if s.get("bolum") == "ozet"]
    if oz:
        s = oz[0]
        s["dosya"] = dosya.name
        ozetler.append(s)
    else:
        eksik.append(dosya.name)

if not ozetler:
    sys.exit("Özet satırı bulunamadı. Klasörde tamamlanmış katılımcı dosyası var mı?")

atla = {"trial_type", "trial_index", "time_elapsed", "internal_node_id", "value", "rt", "plugin_version", "bolum"}
alanlar = []
for s in ozetler:
    for k in s:
        if k not in atla and k not in alanlar:
            alanlar.append(k)
# Başka denemelere ait, özet satırında hep boş kalan sütunları çıkar
alanlar = [k for k in alanlar if any((s.get(k) or "") != "" for s in ozetler)]

cikti = klasor / "ozet_tablosu.csv"
with cikti.open("w", newline="", encoding="utf-8-sig") as f:
    w = csv.DictWriter(f, fieldnames=alanlar, extrasaction="ignore")
    w.writeheader(); w.writerows(ozetler)

gruplar = {}
for s in ozetler:
    gruplar[s.get("grup", "?")] = gruplar.get(s.get("grup", "?"), 0) + 1
kismi = len(list(klasor.glob("*.partial.json")))
print(f"{len(ozetler)} tamamlanmış katılımcı yazıldı: {cikti}")
print("Grup dağılımı: " + ", ".join(f"{g}: {n}" for g, n in sorted(gruplar.items())))
print(f"Önizleme verisi: {sum(1 for s in ozetler if s.get('onizleme') == 'true')}")
print(f"Özet satırı olmayan CSV: {len(eksik)} · Yarıda kalan oturum (.partial.json): {kismi}")
