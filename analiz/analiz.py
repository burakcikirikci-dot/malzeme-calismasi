"""Ön-kayıtlı analizler (H1–H3, duyarlılık, keşifsel) ve makale tabloları.

Kullanım:
    python analiz/analiz.py <ozet_tablosu.csv> [--min-sure DAKIKA] [--farkindalik KODLAMA.csv] [--cikti KLASOR]

Girdi:
    ozet_tablosu.csv      birlestir.py'nin ürettiği tablo (her katılımcı bir satır)
    --min-sure            Bu süreden (dakika) kısa tamamlayanlar dışlanır. Pilottan sonra ön-kayda yazılan değer.
    --farkindalik         İsteğe bağlı: "katilimci_id,farkindalik_dogru" (0/1) sütunlu kodlama dosyası.
                          "Sizce çalışma neyi inceliyordu?" yanıtlarını okuyup karbon/çevre bilgisini
                          tahmin edenleri 1 olarak işaretleyin. Yalnızca duyarlılık analizinde kullanılır.
Çıktı (varsayılan: girdi dosyasının yanında "sonuclar/" klasörü):
    rapor.md              Tüm testlerin sonuçları, makaleye aktarılacak sayılarla
    tablo_denge.csv       Gruplar arası denge tablosu (makalede Tablo 2)
    tablo_yuzey.csv       Yüzey başına en düşük karbonlu seçim oranları (H2a)
    katilimci_akisi.csv   Dışlama sayıları (CONSORT şeması için)
    sekil3_secilen_paketler.png/.pdf
"""
import argparse, json, pathlib, sys
import numpy as np
import pandas as pd
from scipy import stats
import statsmodels.api as sm
import statsmodels.formula.api as smf
from statsmodels.stats.multitest import multipletests

KOK = pathlib.Path(__file__).resolve().parent.parent
YUZEYLER = ["zemin", "duvar", "tavan", "tezgah"]
RNG = np.random.default_rng(20261015)


def stimuli():
    s = (KOK / "js" / "stimuli.js").read_text(encoding="utf-8")
    return json.loads(s[s.index("{"): s.rindex("}") + 1])


def bool_sutun(x):
    return x.astype(str).str.lower().map({"true": True, "false": False, "1": True, "0": False})


def cohen_d(a, b):
    """b − a farkı için Cohen d (havuzlanmış SS) ve yaklaşık %95 GA."""
    na, nb = len(a), len(b)
    sp = np.sqrt(((na - 1) * a.var(ddof=1) + (nb - 1) * b.var(ddof=1)) / (na + nb - 2))
    d = (b.mean() - a.mean()) / sp
    se = np.sqrt((na + nb) / (na * nb) + d ** 2 / (2 * (na + nb)))
    return d, d - 1.96 * se, d + 1.96 * se


def hodges_lehmann(a, b, n_boot=2000):
    """b − a için Hodges–Lehmann medyan farkı ve bootstrap %95 GA."""
    def hl(x, y):
        return np.median(np.subtract.outer(y, x))
    est = hl(a, b)
    boots = [hl(RNG.choice(a, len(a)), RNG.choice(b, len(b))) for _ in range(n_boot)]
    return est, np.percentile(boots, 2.5), np.percentile(boots, 97.5)


def welch(a, b):
    t = stats.ttest_ind(b, a, equal_var=False)
    return t.statistic, t.pvalue, t.df


def fmt_p(p):
    return "< 0.001" if p < 0.001 else f"{p:.3f}"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("tablo")
    ap.add_argument("--min-sure", type=float, default=None, help="dakika")
    ap.add_argument("--farkindalik", default=None)
    ap.add_argument("--cikti", default=None)
    arg = ap.parse_args()

    girdi = pathlib.Path(arg.tablo)
    cikti = pathlib.Path(arg.cikti) if arg.cikti else girdi.parent / "sonuclar"
    cikti.mkdir(parents=True, exist_ok=True)
    K = stimuli()

    df = pd.read_csv(girdi, encoding="utf-8-sig")
    for c in ["dikkat_gecti", "kavrama_dogru"] + [f"a{i}_{y}_en_dusuk_karbon" for i in (1, 2) for y in YUZEYLER]:
        if c in df:
            df[c] = bool_sutun(df[c])
    df["B"] = (df["grup"] == "B").astype(int)

    # ---------- Dışlamalar (ön-kayıt) ----------
    akis = [("Tamamlayan", df.groupby("grup").size())]
    d0 = df[df["dikkat_gecti"] == True]
    akis.append(("Dikkat sorusunu geçen", d0.groupby("grup").size()))
    if arg.min_sure is not None:
        d0 = d0[d0["toplam_sure_sn"] >= arg.min_sure * 60]
        akis.append((f"Süre ≥ {arg.min_sure:g} dk", d0.groupby("grup").size()))
    d = d0.copy()
    akis_df = pd.DataFrame({k: v for k, v in akis}).T.fillna(0).astype(int)
    akis_df.to_csv(cikti / "katilimci_akisi.csv", encoding="utf-8-sig")
    A, B = d[d.grup == "A"], d[d.grup == "B"]

    # Oturum: başlangıç zamanının günü ve saati (aynı ders saatinde başlayanlar aynı oturum)
    if "baslangic_zamani" in d and d["baslangic_zamani"].notna().all():
        t = pd.to_datetime(d["baslangic_zamani"], utc=True).dt.tz_convert("Europe/Istanbul")
        d["oturum"] = t.dt.strftime("%Y-%m-%d %H")
    else:
        d["oturum"] = "tek"

    R = []  # rapor satırları
    R.append("# Analiz raporu\n")
    R.append(f"Analize giren: {len(d)} (A: {len(A)}, B: {len(B)}). Akış: `katilimci_akisi.csv`.\n")

    # ---------- Denge tablosu ----------
    satir = []
    for ad, sut in [("Sınıf", "sinif"), ("Malzeme dersi aldı", "malzeme_dersi"), ("Sürdürülebilirlik dersi aldı", "cevre_dersi")]:
        for deger in sorted(d[sut].dropna().astype(str).unique()):
            satir.append({"Değişken": f"{ad}: {deger}",
                          "A": f"{(A[sut].astype(str) == deger).sum()} ({(A[sut].astype(str) == deger).mean():.0%})",
                          "B": f"{(B[sut].astype(str) == deger).sum()} ({(B[sut].astype(str) == deger).mean():.0%})"})
    satir.append({"Değişken": "Toplam süre, dk (medyan)", "A": f"{A.toplam_sure_sn.median() / 60:.1f}", "B": f"{B.toplam_sure_sn.median() / 60:.1f}"})
    pd.DataFrame(satir).to_csv(cikti / "tablo_denge.csv", index=False, encoding="utf-8-sig")

    # ---------- H1 (birincil) ----------
    a, b = A.a1_karbon.values, B.a1_karbon.values
    t, p, df_t = welch(a, b)
    dd, dlo, dhi = cohen_d(a, b)
    hl, hlo, hhi = hodges_lehmann(a, b)
    mw = stats.mannwhitneyu(b, a, alternative="two-sided")
    R.append("## H1 · Aşama 1 paket karbonu (birincil)\n")
    R.append(f"- Ortalama (SS): A = {a.mean():.1f} ({a.std(ddof=1):.1f}), B = {b.mean():.1f} ({b.std(ddof=1):.1f}) kg CO₂e")
    R.append(f"- Welch t({df_t:.1f}) = {t:.2f}, p = {fmt_p(p)}")
    R.append(f"- Cohen d (B − A) = {dd:.2f} [%95 GA {dlo:.2f}, {dhi:.2f}]")
    R.append(f"- Hodges–Lehmann medyan farkı = {hl:.1f} kg CO₂e [%95 GA {hlo:.1f}, {hhi:.1f}]")
    R.append(f"- Sağlamlık 1 · Mann–Whitney U = {mw.statistic:.0f}, p = {fmt_p(mw.pvalue)}")
    form = "a1_karbon ~ B + C(sinif) + C(malzeme_dersi) + C(cevre_dersi)" + (" + C(oturum)" if d.oturum.nunique() > 1 else "")
    ols = smf.ols(form, data=d).fit(cov_type="HC3")
    R.append(f"- Sağlamlık 2 · Kovaryatlı regresyon (HC3): B katsayısı = {ols.params['B']:.1f} kg CO₂e "
             f"[%95 GA {ols.conf_int().loc['B', 0]:.1f}, {ols.conf_int().loc['B', 1]:.1f}], p = {fmt_p(ols.pvalues['B'])}")
    t2, p2, _ = welch(A.a1_karbon_endeks.values, B.a1_karbon_endeks.values)
    R.append(f"- Sağlamlık 3 · Normalize endeks: A = {A.a1_karbon_endeks.mean():.3f}, B = {B.a1_karbon_endeks.mean():.3f}, Welch t = {t2:.2f}, p = {fmt_p(p2)}")
    if "a1_referans_karbon" in d:
        t3, p3, _ = welch(A.a1_referans_karbon.values, B.a1_referans_karbon.values)
        R.append(f"- İkincil sonuç · 15 yıllık referans karbon: A = {A.a1_referans_karbon.mean():.1f}, B = {B.a1_referans_karbon.mean():.1f}, Welch t = {t3:.2f}, p = {fmt_p(p3)}")
    R.append("")

    ikincil = {}

    # ---------- H2a ----------
    uzun = pd.DataFrame([{"kid": r.katilimci_id, "B": r.B, "yuzey": y, "en_dusuk": int(r[f"a1_{y}_en_dusuk_karbon"])}
                         for _, r in d.iterrows() for y in YUZEYLER])
    gee = smf.gee("en_dusuk ~ B * C(yuzey, Treatment('zemin'))", groups="kid", data=uzun,
                  family=sm.families.Binomial(), cov_struct=sm.cov_struct.Exchangeable()).fit()
    gee_ana = smf.gee("en_dusuk ~ B + C(yuzey)", groups="kid", data=uzun,
                      family=sm.families.Binomial(), cov_struct=sm.cov_struct.Exchangeable()).fit()
    or_b = np.exp(gee_ana.params["B"]); ci = np.exp(gee_ana.conf_int().loc["B"])
    ikincil["H2a"] = gee_ana.pvalues["B"]
    ys = []
    for y in YUZEYLER:
        pa, pb = A[f"a1_{y}_en_dusuk_karbon"].mean(), B[f"a1_{y}_en_dusuk_karbon"].mean()
        tab = [[B[f"a1_{y}_en_dusuk_karbon"].sum(), (~B[f"a1_{y}_en_dusuk_karbon"]).sum()],
               [A[f"a1_{y}_en_dusuk_karbon"].sum(), (~A[f"a1_{y}_en_dusuk_karbon"]).sum()]]
        ys.append({"Yüzey": y, "A (%)": round(100 * pa, 1), "B (%)": round(100 * pb, 1),
                   "Fark (puan)": round(100 * (pb - pa), 1), "Fisher p": round(stats.fisher_exact(tab).pvalue, 4)})
    pd.DataFrame(ys).to_csv(cikti / "tablo_yuzey.csv", index=False, encoding="utf-8-sig")
    etk = [k for k in gee.params.index if k.startswith("B:")]
    R.append("## H2a · Yüzey başına en düşük karbonlu seçim\n")
    R.append(f"- GEE lojistik (katılımcıya göre kümelenmiş): grup etkisi OR = {or_b:.2f} [%95 GA {ci[0]:.2f}, {ci[1]:.2f}], p = {fmt_p(gee_ana.pvalues['B'])}")
    R.append("- Grup × yüzey etkileşimi (referans: zemin): " + "; ".join(f"{k.split('[T.')[1].rstrip(']')}: p = {fmt_p(gee.pvalues[k])}" for k in etk))
    R.append("- Yüzey başına oranlar: `tablo_yuzey.csv`\n")

    # ---------- H2b ----------
    tc, pc, _ = welch(A.a1_maliyet.values, B.a1_maliyet.values)
    ikincil["H2b"] = pc

    def ortuk(xa, xb):
        dk = xa.a1_karbon.mean() - xb.a1_karbon.mean()
        return (xb.a1_maliyet.mean() - xa.a1_maliyet.mean()) / dk if dk != 0 else np.nan
    est = ortuk(A, B)
    boots = [ortuk(A.sample(len(A), replace=True, random_state=int(RNG.integers(1e9))),
                   B.sample(len(B), replace=True, random_state=int(RNG.integers(1e9)))) for _ in range(2000)]
    R.append("## H2b · Maliyet ve örtük karbon fiyatı\n")
    R.append(f"- Paket maliyeti: A = {A.a1_maliyet.mean():,.0f} TL, B = {B.a1_maliyet.mean():,.0f} TL; Welch t = {tc:.2f}, p = {fmt_p(pc)}")
    R.append(f"- Örtük fiyat (ΔTL / Δkg CO₂e) = {est:,.1f} TL/kg [bootstrap %95 GA {np.nanpercentile(boots, 2.5):,.1f}, {np.nanpercentile(boots, 97.5):,.1f}]")
    R.append("  (Karbon farkı sıfıra yakınsa bu oran kararsızdır; GA çok genişse yorumlanmamalı.)\n")

    # ---------- H3a ----------
    d["degisti"] = (d.degisen_yuzey_sayisi > 0).astype(int)
    R.append("## H3a · Aşama 2'de en az bir yüzeyi değiştirme\n")
    R.append(f"- Oran: A = {d[d.grup == 'A'].degisti.mean():.1%}, B = {d[d.grup == 'B'].degisti.mean():.1%}")
    sayilar = d.groupby("grup").degisti.agg(["sum", "count"])
    if (sayilar["sum"] == 0).any() or (sayilar["sum"] == sayilar["count"]).any():
        # Bir grupta hiç (ya da herkes) değiştirmediyse lojistik regresyon kestirilemez: Fisher kesin testi
        tab = [[sayilar.loc[g, "sum"], sayilar.loc[g, "count"] - sayilar.loc[g, "sum"]] for g in ("B", "A")]
        fp = stats.fisher_exact(tab).pvalue
        ikincil["H3a"] = fp
        R.append(f"- Bir grupta değişiklik oranı %0 ya da %100 olduğu için Fisher kesin testi: p = {fmt_p(fp)}")
    else:
        lg = smf.logit("degisti ~ B", data=d).fit(disp=0)
        ikincil["H3a"] = lg.pvalues["B"]
        R.append(f"- Lojistik regresyon: OR (A'ya göre B) = {np.exp(lg.params['B']):.2f} "
                 f"[%95 GA {np.exp(lg.conf_int().loc['B', 0]):.2f}, {np.exp(lg.conf_int().loc['B', 1]):.2f}], p = {fmt_p(lg.pvalues['B'])}")
    R.append(f"- Aşama 2'de karbon değişimi (ortalama): A = {(A.a2_karbon - A.a1_karbon).mean():.1f}, B = {(B.a2_karbon - B.a1_karbon).mean():.1f} kg CO₂e\n")

    # ---------- H3b ----------
    t4, p4, df4 = welch(A.a2_karbon.values, B.a2_karbon.values)
    d4, d4lo, d4hi = cohen_d(A.a2_karbon.values, B.a2_karbon.values)
    diff = B.a2_karbon.mean() - A.a2_karbon.mean()
    se = np.sqrt(A.a2_karbon.var(ddof=1) / len(A) + B.a2_karbon.var(ddof=1) / len(B))
    ikincil["H3b"] = p4
    R.append("## H3b · Aşama 2 (son) paket karbonu\n")
    R.append(f"- A = {A.a2_karbon.mean():.1f}, B = {B.a2_karbon.mean():.1f} kg CO₂e; fark (B − A) = {diff:.1f} [%95 GA {diff - 1.96 * se:.1f}, {diff + 1.96 * se:.1f}]")
    R.append(f"- Welch t({df4:.1f}) = {t4:.2f}, p = {fmt_p(p4)}; Cohen d = {d4:.2f} [{d4lo:.2f}, {d4hi:.2f}]\n")

    # ---------- Holm ----------
    adlar = list(ikincil)
    _, p_holm, _, _ = multipletests([ikincil[k] for k in adlar], method="holm")
    R.append("## İkincil hipotezler · Holm düzeltmesi\n")
    R.append("| Hipotez | p | Holm p |\n|---|---|---|")
    for k, ph in zip(adlar, p_holm):
        R.append(f"| {k} | {fmt_p(ikincil[k])} | {fmt_p(ph)} |")
    R.append("")

    # ---------- Duyarlılık ----------
    R.append("## Duyarlılık analizleri (H1)\n")
    def h1_satir(x, etiket):
        xa, xb = x[x.grup == "A"].a1_karbon.values, x[x.grup == "B"].a1_karbon.values
        if min(len(xa), len(xb)) < 3:
            return f"- {etiket}: yeterli veri yok"
        tt, pp, _ = welch(xa, xb); dd2, _, _ = cohen_d(xa, xb)
        return f"- {etiket}: n = {len(xa)}/{len(xb)}, d = {dd2:.2f}, Welch t = {tt:.2f}, p = {fmt_p(pp)}"
    if "kavrama_dogru" in d:
        R.append(h1_satir(d[d.kavrama_dogru == True], "Kavrama sorusunu doğru yanıtlayanlar"))
    if arg.farkindalik:
        k = pd.read_csv(arg.farkindalik, encoding="utf-8-sig")
        dk = d.merge(k[["katilimci_id", "farkindalik_dogru"]], on="katilimci_id", how="left")
        R.append(h1_satir(dk[dk.farkindalik_dogru != 1], "Çalışmanın amacını tahmin etmeyenler"))
    else:
        R.append("- Farkındalık kodlaması verilmedi (--farkindalik); bu duyarlılık analizi atlandı.")
    R.append("")

    # ---------- Keşifsel ----------
    R.append("## Keşifsel (RQ4)\n")
    if "puan_cevre" in d:
        for g, x in d.groupby("grup"):
            r, pr = stats.spearmanr(x.puan_cevre, x.a1_karbon)
            R.append(f"- Grup {g}: çevresel etkiye verilen puan ile Aşama 1 karbonu, Spearman ρ = {r:.2f}, p = {fmt_p(pr)}")
        R.append(f"- Çevresel etkiye verilen ortalama puan: A = {A.puan_cevre.mean():.1f}, B = {B.puan_cevre.mean():.1f}")
    olc = [c for c in d.columns if c.startswith("olcut_")]
    if olc:
        u = d.melt(id_vars="grup", value_vars=olc, value_name="olcut")
        R.append("\nEn belirleyici ölçüt dağılımı (Aşama 1, tüm yüzeyler, %):\n")
        R.append(pd.crosstab(u.olcut, u.grup, normalize="columns").mul(100).round(1).to_markdown())
    (cikti / "rapor.md").write_text("\n".join(R), encoding="utf-8")

    # ---------- Şekil 3: seçilen paketler ----------
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    tum = pd.read_csv(KOK / "analiz" / "paket_tablosu.csv", encoding="utf-8-sig")
    plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 9})
    fig, ax = plt.subplots(figsize=(6.3, 4.5), dpi=300)
    ax.grid(True, color="#e6e5e1", linewidth=0.6); ax.set_axisbelow(True)
    for s_ in ["top", "right"]:
        ax.spines[s_].set_visible(False)
    ax.scatter(tum.maliyet_tl / 1000, tum.karbon_kg, s=10, c="#d9d8d3", linewidths=0, label="All possible packages", zorder=1)
    for g, renk, ad in [("A", "#eb6834", "Group A (late information)"), ("B", "#2a78d6", "Group B (early information)")]:
        x = d[d.grup == g]
        j = RNG.normal(0, 4, len(x))
        ax.scatter(x.a1_maliyet / 1000 + j, x.a1_karbon, s=22, c=renk, edgecolors="white", linewidths=0.8,
                   alpha=0.85, label=f"{ad}, n = {len(x)}", zorder=3)
        ax.axhline(x.a1_karbon.mean(), color=renk, linewidth=1.2, linestyle=(0, (4, 3)), zorder=2)
    ax.axvline(K["butce_tl"] / 1000, color="#0b0b0b", linewidth=1, zorder=2)
    ax.set_xlabel("Package cost (thousand TL)"); ax.set_ylabel("Package carbon, A1–A3 (kg CO$_2$e)")
    ax.legend(loc="upper center", bbox_to_anchor=(0.5, -0.13), ncol=2, frameon=False, fontsize=8)
    fig.tight_layout()
    fig.savefig(cikti / "sekil3_secilen_paketler.png", dpi=300); fig.savefig(cikti / "sekil3_secilen_paketler.pdf")
    print(f"Bitti. Rapor: {cikti / 'rapor.md'}")


if __name__ == "__main__":
    main()
