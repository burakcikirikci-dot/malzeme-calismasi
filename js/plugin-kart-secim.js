// jsPsych 8 eklentisi: dört yüzey için malzeme kartı seçimi, bütçe sayacı ve (isteğe bağlı) karbon sayacı.
var jsPsychKartSecim = (function (jspsych) {
  "use strict";

  var P = jspsych.ParameterType;

  var info = {
    name: "kart-secim",
    version: "1.0.0",
    parameters: {
      yuzeyler: { type: P.COMPLEX, default: undefined },
      karbon_goster: { type: P.BOOL, default: false },
      baslangic: { type: P.OBJECT, default: {} },
      asama_etiketi: { type: P.STRING, default: "" },
      yonerge: { type: P.HTML_STRING, default: "" },
      butce: { type: P.INT, default: 0 },
      senaryo_satiri: { type: P.HTML_STRING, default: "" },
      devam_metni: { type: P.STRING, default: "Devam" }
    },
    data: {
      secimler: { type: P.OBJECT },
      toplam_maliyet: { type: P.INT },
      toplam_karbon: { type: P.FLOAT },
      karbon_gosterildi: { type: P.BOOL },
      olaylar: { type: P.COMPLEX },
      rt: { type: P.INT }
    }
  };

  var fmt = new Intl.NumberFormat("tr-TR");
  function sayi(n) { return fmt.format(Math.round(n * 10) / 10); }
  var fmt2 = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  var fmt1 = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  function karbonM2(n) { return n < 10 ? fmt2.format(n) : fmt1.format(n); }

  function KartSecimPlugin(jsPsych) { this.jsPsych = jsPsych; }
  KartSecimPlugin.info = info;

  KartSecimPlugin.prototype.trial = function (display_element, trial) {
    var self = this;
    var t0 = performance.now();
    var yuzeyler = trial.yuzeyler;
    var secimler = Object.assign({}, trial.baslangic || {});
    var aktif = yuzeyler[0].id;
    var olaylar = [];

    function zaman() { return Math.round(performance.now() - t0); }
    function bul(yid, kod) {
      var y = yuzeyler.filter(function (s) { return s.id === yid; })[0];
      var o = y && y.secenekler.filter(function (s) { return s.kod === kod; })[0];
      return { y: y, o: o };
    }
    function toplamlar() {
      var m = 0, k = 0;
      yuzeyler.forEach(function (y) {
        var kod = secimler[y.id];
        if (!kod) return;
        var o = bul(y.id, kod).o;
        m += o.maliyet_m2 * y.alan_m2;
        k += o.karbon_m2 * y.alan_m2;
      });
      return { maliyet: m, karbon: k };
    }
    function hepsiSecili() { return yuzeyler.every(function (y) { return !!secimler[y.id]; }); }

    function kartHtml(y, o) {
      var secili = secimler[y.id] === o.kod;
      var gorsel = o.gorsel
        ? '<img class="ks-gorsel" src="' + o.gorsel + '" alt="' + o.ad + ' yüzey görseli">'
        : '<div class="ks-gorsel ' + o.doku + '" role="img" aria-label="' + o.ad + ' yüzey görseli"></div>';
      var karbonSatiri = trial.karbon_goster
        ? '<div class="ks-satir ks-son"><dt>Üretim karbonu (A1–A3)</dt><dd><span class="ks-sayi">' + karbonM2(o.karbon_m2) +
          ' kg CO₂e/m²</span><span class="ks-ikincil">Bu yüzey (' + sayi(y.alan_m2) + ' m²): ' + sayi(o.karbon_m2 * y.alan_m2) + ' kg CO₂e</span></dd></div>'
        : "";
      return '<article class="ks-kart' + (secili ? " ks-secili" : "") + '">' +
        '<header><h3>' + o.ad + '</h3><div class="ks-alt">' + o.ozellik + '</div></header>' +
        gorsel +
        '<dl>' +
        '<div class="ks-satir"><dt>Maliyet</dt><dd><span class="ks-sayi">' + sayi(o.maliyet_m2) + ' TL/m²</span><span class="ks-ikincil">Bu yüzey (' + sayi(y.alan_m2) + ' m²): ' + sayi(o.maliyet_m2 * y.alan_m2) + ' TL</span></dd></div>' +
        '<div class="ks-satir"><dt>Dayanıklılık</dt><dd>' + o.dayaniklilik + '</dd></div>' +
        '<div class="ks-satir"><dt>Kullanım ömrü</dt><dd><span class="ks-sayi">' + o.omur_yil + ' yıl</span></dd></div>' +
        '<div class="ks-satir' + (trial.karbon_goster ? "" : " ks-son") + '"><dt>Bakım</dt><dd>' + o.bakim + '</dd></div>' +
        karbonSatiri +
        '</dl>' +
        '<button type="button" class="ks-sec" data-sec="' + o.kod + '" aria-pressed="' + secili + '">' + (secili ? "Seçildi" : "Bu seçeneği seç") + '</button>' +
        '</article>';
    }

    function ciz() {
      var top = toplamlar();
      var kalan = trial.butce - top.maliyet;
      var y = yuzeyler.filter(function (s) { return s.id === aktif; })[0];
      var idx = yuzeyler.indexOf(y);
      var tamam = hepsiSecili();
      var butceAsildi = kalan < 0;
      var devamAcik = tamam && !butceAsildi;
      var mesaj = !tamam ? "Devam etmek için dört yüzeyin hepsinde bir seçenek seçin."
        : butceAsildi ? "Seçimleriniz bütçeyi " + sayi(-kalan) + " TL aşıyor. Devam etmek için bütçe içinde kalın."
        : "Tüm yüzeyler seçildi.";

      var sekmeler = yuzeyler.map(function (s) {
        var durum = secimler[s.id] ? "seçildi" : "seçilmedi";
        return '<button type="button" class="ks-sekme' + (s.id === aktif ? " ks-aktif" : "") + '" data-yuzey="' + s.id + '"' +
          (s.id === aktif ? ' aria-current="true"' : "") + '>' + s.ad + ' · ' + durum + '</button>';
      }).join("");

      var karbonKutusu = trial.karbon_goster
        ? '<div class="ks-sayac"><div class="ks-etiket">Paket üretim karbonu</div><div class="ks-buyuk">' + sayi(top.karbon) +
          ' kg CO₂e</div><div class="ks-etiket">Seçilen yüzeylerin toplamı</div></div>'
        : "";

      display_element.querySelector("#ks-kok").innerHTML =
        '<header class="ks-bas">' +
          '<div class="ks-bas-sol"><div class="ks-ust">' + trial.asama_etiketi + '</div>' +
          '<h2>' + y.ad + ' <span class="ks-alan">(' + sayi(y.alan_m2) + ' m²)</span></h2>' +
          '<div class="ks-alt">' + trial.senaryo_satiri + '</div></div>' +
          '<div class="ks-sayaclar">' +
            '<div class="ks-sayac"><div class="ks-etiket">Bütçe (harcanan / toplam)</div><div class="ks-buyuk">' + sayi(top.maliyet) + ' / ' + sayi(trial.butce) +
            ' TL</div><div class="ks-etiket">Kalan: ' + sayi(kalan) + ' TL</div></div>' +
            karbonKutusu +
          '</div>' +
        '</header>' +
        (trial.yonerge ? '<div class="ks-yonerge">' + trial.yonerge + '</div>' : "") +
        '<nav class="ks-sekmeler" aria-label="Yüzeyler">' + sekmeler + '</nav>' +
        '<section class="ks-kartlar">' + y.secenekler.map(function (o) { return kartHtml(y, o); }).join("") + '</section>' +
        '<footer class="ks-alt-bar">' +
          '<div class="ks-gezinti">' +
            '<button type="button" class="ks-ikincil-btn" data-git="-1"' + (idx === 0 ? " disabled" : "") + '>← Önceki yüzey</button>' +
            '<button type="button" class="ks-ikincil-btn" data-git="1"' + (idx === yuzeyler.length - 1 ? " disabled" : "") + '>Sonraki yüzey →</button>' +
          '</div>' +
          '<div class="ks-bitir"><p class="ks-mesaj" role="status">' + mesaj + '</p>' +
          '<button type="button" class="ks-devam" id="ks-devam"' + (devamAcik ? "" : " disabled") + '>' + trial.devam_metni + '</button></div>' +
        '</footer>' +
        (trial.karbon_goster ? '<p class="ks-tanim">Üretim karbonu: hammaddenin çıkarılmasından ürünün fabrikadan çıkışına kadar oluşan sera gazı salımı.</p>' : "");
    }

    function sekmeyeGit(id) {
      if (id === aktif) return;
      aktif = id;
      olaylar.push({ t: zaman(), tur: "sekme", yuzey: id });
      ciz();
      window.scrollTo(0, 0);
    }

    display_element.innerHTML = '<div id="ks-kok" class="ks-kok"></div>';
    olaylar.push({ t: 0, tur: "basla", yuzey: aktif });
    ciz();

    display_element.querySelector("#ks-kok").addEventListener("click", function (e) {
      var b = e.target.closest("button");
      if (!b || b.disabled) return;
      if (b.dataset.yuzey) { sekmeyeGit(b.dataset.yuzey); return; }
      if (b.dataset.git) {
        var i = yuzeyler.map(function (s) { return s.id; }).indexOf(aktif) + Number(b.dataset.git);
        if (i >= 0 && i < yuzeyler.length) sekmeyeGit(yuzeyler[i].id);
        return;
      }
      if (b.dataset.sec) {
        if (secimler[aktif] !== b.dataset.sec) {
          secimler[aktif] = b.dataset.sec;
          olaylar.push({ t: zaman(), tur: "secim", yuzey: aktif, kod: b.dataset.sec });
          ciz();
        }
        return;
      }
      if (b.id === "ks-devam") {
        var top = toplamlar();
        display_element.innerHTML = "";
        self.jsPsych.finishTrial({
          secimler: Object.assign({}, secimler),
          toplam_maliyet: top.maliyet,
          toplam_karbon: top.karbon,
          karbon_gosterildi: trial.karbon_goster,
          olaylar: olaylar,
          rt: zaman()
        });
      }
    });
  };

  return KartSecimPlugin;
})(jsPsychModule);
