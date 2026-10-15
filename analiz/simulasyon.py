"""Analiz kodunu sınamak için sahte veri üretir (gerçek veri DEĞİLDİR).

Kullanım:  python analiz/simulasyon.py <cikti.csv> [--n 175] [--etki 1.0] [--tohum 1]
  --etki 0 verilirse karbon bilgisinin hiç etkisi olmayan bir veri üretir (yanlış alarm denetimi).
Seçimler gerçek kartlardan (stimuli.js) ve bütçe kuralından türetilir.
"""
import argparse, json, pathlib
import numpy as np
import pandas as pd

KOK = pathlib.Path(__file__).resolve().parent.parent
YUZEYLER = ["zemin", "duvar", "tavan", "tezgah"]
OLCUTLER = ["Estetik ve konsept uyumu", "Maliyet", "Dayanıklılık", "Kullanım ömrü", "Bakım kolaylığı", "Çevresel etki", "Diğer"]

ap = argparse.ArgumentParser()
ap.add_argument("cikti"); ap.add_argument("--n", type=int, default=175)
ap.add_argument("--etki", type=float, default=1.0); ap.add_argument("--tohum", type=int, default=1)
arg = ap.parse_args()
rng = np.random.default_rng(arg.tohum)

s = (KOK / "js" / "stimuli.js").read_text(encoding="utf-8")
K = json.loads(s[s.index("{"): s.rindex("}") + 1])
Y = {y["id"]: y for y in K["yuzeyler"]}
EN = {y: min(Y[y]["secenekler"], key=lambda o: o["karbon_m2"])["kod"] for y in YUZEYLER}


def paket(sec):
    m = k = r = 0
    for y in YUZEYLER:
        o = next(o for o in Y[y]["secenekler"] if o["kod"] == sec[y])
        m += o["maliyet_m2"] * Y[y]["alan_m2"]; k += o["karbon_m2"] * Y[y]["alan_m2"]
        r += o["karbon_m2"] * Y[y]["alan_m2"] * int(np.ceil(K["referans_sure_yil"] / o["omur_yil"]))
    return m, k, r


tum = [paket(dict(zip(YUZEYLER, p))) for p in pd.read_csv(KOK / "analiz" / "paket_tablosu.csv", encoding="utf-8-sig")[YUZEYLER].values]
kmin, kmax = min(t[1] for t in tum), max(t[1] for t in tum)


def sec(estetik, karbon_agirlik, maliyet_agirlik):
    """Bütçe içinde kalana kadar çok terimli logit ile seçim."""
    for _ in range(200):
        out = {}
        for y in YUZEYLER:
            ops = Y[y]["secenekler"]
            km = np.array([o["karbon_m2"] for o in ops]); mm = np.array([o["maliyet_m2"] for o in ops])
            u = estetik[y] - maliyet_agirlik * (mm - mm.mean()) / mm.std() - karbon_agirlik * (km - km.mean()) / km.std()
            p = np.exp(u - u.max()); p /= p.sum()
            out[y] = ops[rng.choice(len(ops), p=p)]["kod"]
        if paket(out)[0] <= K["butce_tl"]:
            return out
    return {y: EN[y] for y in YUZEYLER}


satir = []
for i in range(arg.n):
    grup = "A" if i % 2 == 0 else "B"
    estetik = {y: rng.normal(0, 1.0, 4) for y in YUZEYLER}
    cevre_ilgi = rng.uniform(0.2, 1.0)
    maliyet_w = rng.uniform(0.2, 0.8)
    a1 = sec(estetik, arg.etki * cevre_ilgi if grup == "B" else 0.0, maliyet_w)
    # Aşama 2: Grup A karbonu ilk kez görür; ilk seçime bağlılık nedeniyle yalnızca bazıları değiştirir
    a2 = dict(a1)
    for y in YUZEYLER:
        degistir = rng.random() < (0.25 * arg.etki * cevre_ilgi if grup == "A" else 0.05)
        if degistir:
            aday = dict(a2); aday[y] = EN[y]
            if paket(aday)[0] <= K["butce_tl"]:
                a2 = aday
    m1, k1, r1 = paket(a1); m2, k2, r2 = paket(a2)
    puan = rng.dirichlet([4, 3, 2, 2, 1, 1 + 2 * cevre_ilgi]) * 100
    puan = np.round(puan).astype(int); puan[0] += 100 - puan.sum()
    sat = {
        "katilimci_id": f"sim{i:03d}", "grup": grup, "grup_kaynagi": "datapipe", "onizleme": "false", "deneme": "false",
        "baslangic_zamani": f"2026-11-{10 + i // 60:02d}T{9 + (i // 30) % 3:02d}:05:00+03:00",
        "a1_maliyet": m1, "a1_karbon": round(k1, 2), "a1_karbon_endeks": round((k1 - kmin) / (kmax - kmin), 3), "a1_referans_karbon": round(r1, 2),
        "a2_maliyet": m2, "a2_karbon": round(k2, 2), "a2_karbon_endeks": round((k2 - kmin) / (kmax - kmin), 3), "a2_referans_karbon": round(r2, 2),
        "degisen_yuzey_sayisi": sum(a1[y] != a2[y] for y in YUZEYLER),
        "toplam_sure_sn": int(rng.normal(1500, 300)),
        "farkindalik": "", "kavrama_dogru": str(rng.random() < 0.7).lower(), "dikkat_gecti": str(rng.random() < 0.96).lower(),
        "sinif": rng.choice(["3", "4"]), "malzeme_dersi": rng.choice(["Evet", "Hayır"], p=[0.85, 0.15]),
        "cevre_dersi": rng.choice(["Evet", "Hayır", "Emin değilim"], p=[0.5, 0.35, 0.15]),
        "gorusme_gonullu": rng.choice(["Evet", "Hayır"], p=[0.2, 0.8]),
    }
    for y in YUZEYLER:
        sat[f"a1_{y}"] = a1[y]; sat[f"a2_{y}"] = a2[y]
        sat[f"a1_{y}_en_dusuk_karbon"] = str(a1[y] == EN[y]).lower(); sat[f"a2_{y}_en_dusuk_karbon"] = str(a2[y] == EN[y]).lower()
        pr = np.array([0.35, 0.25, 0.12, 0.08, 0.07, 0.18 if grup == "B" else 0.10, 0.03]); sat[f"olcut_{y}"] = rng.choice(OLCUTLER, p=pr / pr.sum())
    for k, v in zip(["estetik", "maliyet", "dayaniklilik", "omur", "bakim", "cevre"], puan):
        sat[f"puan_{k}"] = int(v)
    satir.append(sat)

pd.DataFrame(satir).to_csv(arg.cikti, index=False, encoding="utf-8-sig")
print(f"{len(satir)} sahte katılımcı yazıldı: {arg.cikti}")
