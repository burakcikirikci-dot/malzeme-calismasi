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

# Araştırmacının kendi denemeleri (?deneme) ve önizleme kayıtları ana tabloya girmez, ayrı dosyaya yazılır
denemeler = [s for s in ozetler if s.get("deneme") == "true" or s.get("onizleme") == "true"]
ozetler = [s for s in ozetler if s not in denemeler]
if denemeler:
    with (klasor / "deneme_kayitlari.csv").open("w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=alanlar, extrasaction="ignore"); w.writeheader(); w.writerows(denemeler)

# Görüşme gönüllülerinin e-posta adresleri analiz tablosundan ayrılır, ayrı bir listeye yazılır
iletisim = [{"katilimci_id": s.get("katilimci_id"), "grup": s.get("grup"), "degisen_yuzey_sayisi": s.get("degisen_yuzey_sayisi"),
             "a1_karbon": s.get("a1_karbon"), "gorusme_eposta": s.get("gorusme_eposta")}
            for s in ozetler if (s.get("gorusme_eposta") or "").strip()]
if iletisim:
    with (klasor / "gorusme_iletisim_GIZLI.csv").open("w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=list(iletisim[0])); w.writeheader(); w.writerows(iletisim)
alanlar = [k for k in alanlar if k != "gorusme_eposta"]

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
print(f"Ayrılan deneme/önizleme kaydı: {len(denemeler)} (deneme_kayitlari.csv)")
print(f"Görüşme gönüllüsü (e-posta bırakan): {len(iletisim)} (gorusme_iletisim_GIZLI.csv; analiz tablosunda e-posta yok)")
print(f"Özet satırı olmayan CSV: {len(eksik)} · Yarıda kalan oturum (.partial.json): {kismi}")
