// Deney akışı. Ayarlar: config.js · Kartlar: stimuli.js · Kart ekranı: plugin-kart-secim.js
(function () {
  "use strict";

  var A = window.AYARLAR;
  var K = window.KARTLAR;
  var YUZEYLER = K.yuzeyler;
  var onizleme = !A.DATAPIPE_ID;
  var url = new URLSearchParams(window.location.search);
  var fmt = new Intl.NumberFormat("tr-TR");
  var grup = null;          // "A" = geç bilgi, "B" = erken bilgi
  var grupKaynagi = null;   // datapipe | rastgele | url

  function rastgeleId(n) {
    var h = "abcdefghjkmnpqrstuvwxyz23456789", s = "";
    var r = new Uint32Array(n);
    window.crypto.getRandomValues(r);
    for (var i = 0; i < n; i++) s += h[r[i] % h.length];
    return s;
  }
  var katilimciId = rastgeleId(10);

  // ---------- Ekran kontrolü ----------
  if (!onizleme && window.innerWidth < A.MIN_EKRAN_GENISLIGI) {
    document.body.innerHTML = '<main class="uyari-ekran"><h1>Lütfen bilgisayardan katılın</h1>' +
      '<p>Bu çalışmada malzeme kartlarının herkese aynı biçimde görünmesi gerekiyor. ' +
      'Lütfen bağlantıyı en az ' + A.MIN_EKRAN_GENISLIGI + ' piksel genişliğinde bir bilgisayar ekranında, tarayıcı penceresi tam ekranken açın.</p></main>';
    return;
  }

  // ---------- Kart sırası: her katılımcı için yüzey başına rastgele, iki aşamada aynı ----------
  function karistir(dizi) {
    var a = dizi.slice(), r = new Uint32Array(a.length);
    window.crypto.getRandomValues(r);
    for (var i = a.length - 1; i > 0; i--) { var j = r[i] % (i + 1); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  var SIRALI = YUZEYLER.map(function (y) { return Object.assign({}, y, { secenekler: karistir(y.secenekler) }); });
  var kartSirasi = SIRALI.map(function (y) { return y.id + ":" + y.secenekler.map(function (o) { return o.kod; }).join(""); }).join(";");

  // ---------- Yardımcılar ----------
  function yuzey(id) { return YUZEYLER.filter(function (y) { return y.id === id; })[0]; }
  function secenek(yid, kod) { return yuzey(yid).secenekler.filter(function (o) { return o.kod === kod; })[0]; }
  function paket(secimler) {
    var m = 0, k = 0, r = 0;
    YUZEYLER.forEach(function (y) {
      var o = secenek(y.id, secimler[y.id]);
      m += o.maliyet_m2 * y.alan_m2;
      k += o.karbon_m2 * y.alan_m2;
      r += o.karbon_m2 * y.alan_m2 * Math.ceil(K.referans_sure_yil / o.omur_yil);
    });
    return { maliyet: m, karbon: k, referans_karbon: r };
  }
  // Tüm olası paketlerin (4 yüzey × 4 seçenek = 256) karbon aralığı (normalize endeks için)
  var KARBON_ARALIK = (function () {
    var min = Infinity, max = -Infinity;
    (function gez(i, s) {
      if (i === YUZEYLER.length) { var k = paket(s).karbon; min = Math.min(min, k); max = Math.max(max, k); return; }
      YUZEYLER[i].secenekler.forEach(function (o) { var t = Object.assign({}, s); t[YUZEYLER[i].id] = o.kod; gez(i + 1, t); });
    })(0, {});
    return { min: min, max: max };
  })();
  function endeks(k) { return Math.round(((k - KARBON_ARALIK.min) / (KARBON_ARALIK.max - KARBON_ARALIK.min)) * 1000) / 1000; }

  var senaryoSatiri = A.SENARYO.baslik + " · Konsept: " + A.SENARYO.konsept;

  // ---------- jsPsych ----------
  var uzantilar = [];
  if (!onizleme) {
    uzantilar.push({
      type: jsPsychExtensionPipe,
      params: {
        experiment_id: A.DATAPIPE_ID,
        filename: function () { return katilimciId + ".csv"; },
        wait_message: '<div class="metin-ekran"><p>Yanıtlarınız kaydediliyor. Lütfen sayfayı kapatmayın.</p></div>',
        done_message: '<div class="metin-ekran"><h1>Teşekkürler</h1><p>Yanıtlarınız kaydedildi. Bu sayfayı kapatabilirsiniz.</p>' +
          '<p class="kucuk">Katılımcı kodunuz: <strong>' + katilimciId + '</strong>. Verilerinizin silinmesini isterseniz bu kodu ' + A.ONAM.eposta + ' adresine iletin.</p>' +
          '</div>',
        on_save: function (sonuc) {
          if (!sonuc.ok) {
            jsPsych.getDisplayElement().innerHTML = '<div class="metin-ekran"><h1>Kayıt sırasında bir sorun oluştu</h1>' +
              '<p>Lütfen sayfayı kapatmadan araştırmacıya (' + A.ONAM.eposta + ') katılımcı kodunuzu iletin: <strong>' + katilimciId + '</strong></p></div>';
          }
        }
      }
    });
  }

  var jsPsych = initJsPsych({
    extensions: uzantilar,
    on_finish: function () { if (onizleme) onizlemeSonu(); }
  });
  jsPsych.data.addProperties({
    katilimci_id: katilimciId, onizleme: onizleme, ekran_genisligi: window.innerWidth, kart_sirasi: kartSirasi,
    baslangic_zamani: new Date().toISOString(),           // oturum (ders saati) bilgisi için
    deneme: url.has("deneme")                            // araştırmacının kendi denemeleri: linkin sonuna ?deneme
  });

  function veri(bolum) { return jsPsych.data.get().filter({ bolum: bolum }).values()[0]; }

  var zaman = [];

  // 1. Onam
  zaman.push({
    type: jsPsychSurveyHtmlForm,
    data: { bolum: "onam" },
    html: '<div class="metin-ekran">' +
      (onizleme ? '<p class="onizleme-bandi">ÖNİZLEME MODU · veri gönderilmez</p>' : "") +
      '<h1>' + A.ONAM.calisma_adi + '</h1>' +
      '<p>Bu çalışma ' + A.ONAM.kurum + ' bünyesinde ' + A.ONAM.arastirmaci + ' tarafından yürütülmektedir. ' +
      'Çalışmada bir ofis iç mekânı için malzeme seçecek ve birkaç kısa soruyu yanıtlayacaksınız. Toplam süre yaklaşık 30 dakikadır.</p>' +
      '<ul><li>Katılım gönüllüdür; istediğiniz anda sayfayı kapatarak ayrılabilirsiniz.</li>' +
      '<li>Katılmak ya da katılmamak hiçbir dersinizin notunu etkilemez.</li>' +
      '<li>Doğru ya da yanlış yanıt yoktur; kendi tasarım yargınızla seçim yapın.</li>' +
      '<li>' + A.ONAM.veri_saklama + '</li>' +
      '<li>Görevin sonunda kısa bir görüşmeye gönüllü olup olmadığınız sorulur. Gönüllü olursanız e-posta adresiniz istenir; bu durumda yanıtlarınız anonim değil gizli tutulur ve adresiniz çalışma bitince silinir. Gönüllü olmak zorunlu değildir.</li>' +
      '<li>Çalışma ' + A.ONAM.etik_kurul + ' onayı ile yürütülmektedir.</li>' +
      '<li>Sorularınız için: ' + A.ONAM.eposta + '</li></ul>' +
      '<label class="onay"><input type="checkbox" name="onam" value="evet" required> Bilgilendirme metnini okudum, gönüllü olarak katılmayı kabul ediyorum.</label>' +
      '</div>',
    button_label: "Başla"
  });

  // 2. Grup ataması (onamdan sonra: onam vermeyenler sayaçtan düşmez)
  zaman.push({
    type: jsPsychCallFunction,
    async: true,
    data: { bolum: "atama" },
    func: function (bitti) {
      var zorla = url.get("grup") || (window.location.hash.match(/^#grup([AB])$/) || [])[1];
      if (onizleme && (zorla === "A" || zorla === "B")) { grup = zorla; grupKaynagi = "url"; return son(); }
      if (!onizleme && A.KOSUL_ATAMASI_DATAPIPE) {
        jsPsychExtensionPipe.getCondition(A.DATAPIPE_ID).then(function (k) {
          grup = Number(k) === 0 ? "A" : "B"; grupKaynagi = "datapipe"; son();
        }).catch(function () {
          jsPsych.abortExperiment('<div class="metin-ekran"><h1>Çalışma şu anda başlatılamadı</h1><p>Lütfen birkaç dakika sonra bağlantıyı yeniden açın. Sorun sürerse ' + A.ONAM.eposta + ' adresine yazın.</p></div>');
        });
        return;
      }
      grup = Math.random() < 0.5 ? "A" : "B"; grupKaynagi = "rastgele"; son();
      function son() {
        jsPsych.data.addProperties({ grup: grup, grup_kaynagi: grupKaynagi });
        bitti({ grup: grup });
      }
    }
  });

  // 3. Senaryo
  zaman.push({
    type: jsPsychHtmlButtonResponse,
    data: { bolum: "senaryo" },
    stimulus: function () {
      var satirlar = YUZEYLER.map(function (y) { return "<tr><td>" + y.ad + "</td><td>" + fmt.format(y.alan_m2) + " m²</td></tr>"; }).join("");
      return '<div class="metin-ekran">' +
        (onizleme ? '<p class="onizleme-bandi">ÖNİZLEME · ' + (grup === "A" ? "Grup A: karbon bilgisi 2. aşamada" : "Grup B: karbon bilgisi baştan") + ' · 11 kalemin fiyatı geçici</p>' : "") +
        '<h1>Senaryo: ' + A.SENARYO.baslik + '</h1>' +
        '<p><strong>Kullanıcı:</strong> ' + A.SENARYO.kullanici + '</p>' +
        '<p><strong>Konsept:</strong> ' + A.SENARYO.konsept + '</p>' +
        '<p>Bu ofisin dört yüzeyi için malzeme seçeceksiniz. Her yüzey için dört seçenek göreceksiniz; kartlarda her malzemenin özellikleri yer alıyor.</p>' +
        '<table class="alan-tablosu"><thead><tr><th>Yüzey</th><th>Alan</th></tr></thead><tbody>' + satirlar + '</tbody></table>' +
        '<p><strong>Toplam malzeme bütçesi:</strong> ' + fmt.format(K.butce_tl) + ' TL. Seçimlerinizi bu bütçe içinde tamamlamanız gerekiyor.</p>' +
        '</div>';
    },
    choices: ["Seçime başla"]
  });

  // 4. Aşama 1: seçim
  zaman.push({
    type: jsPsychKartSecim,
    data: { bolum: "a1" },
    yuzeyler: SIRALI,
    karbon_goster: function () { return grup === "B"; },
    butce: K.butce_tl,
    asama_etiketi: "AŞAMA 1 · MALZEME SEÇİMİ",
    senaryo_satiri: senaryoSatiri,
    yonerge: "Her yüzey için bir seçenek seçin. Yüzeyler arasında sekmelerle geçebilirsiniz.",
    devam_metni: "Seçimlerimi tamamladım"
  });

  // 5. Paket özeti: dört seçim bir arada + yüzey başına en belirleyici ölçüt (yalnızca seçenek, yazı yok)
  var OLCUTLER = ["Estetik ve konsept uyumu", "Maliyet", "Dayanıklılık", "Kullanım ömrü", "Bakım kolaylığı", "Çevresel etki", "Diğer"];
  function olcutSecenekleri(ad) {
    return OLCUTLER.map(function (x, i) {
      return '<label class="olcut-secenek"><input type="radio" name="' + ad + '" value="' + x + '"' + (i === 0 ? " required" : "") + '><span>' + x + '</span></label>';
    }).join("");
  }
  zaman.push({
    type: jsPsychSurveyHtmlForm,
    data: { bolum: "paket_ozeti" },
    css_classes: ["genis-form"],
    html: function () {
      var s = veri("a1").secimler, p = paket(s), karbonVar = grup === "B";
      var kartlar = YUZEYLER.map(function (y) {
        var o = secenek(y.id, s[y.id]);
        var gorsel = o.gorsel ? '<img class="ks-gorsel" src="' + o.gorsel + '" alt="' + o.ad + ' yüzey görseli">'
          : '<div class="ks-gorsel ' + o.doku + '" role="img" aria-label="' + o.ad + ' yüzey görseli"></div>';
        return '<section class="ozet-kart">' +
          '<div class="ks-ust">' + y.ad.toLocaleUpperCase("tr-TR") + ' · ' + fmt.format(y.alan_m2) + ' m²</div>' + gorsel +
          '<h3>' + o.ad + '</h3><div class="ks-alt">' + o.ozellik + '</div>' +
          '<dl class="ozet-degerler"><div><dt>Bu yüzey maliyeti</dt><dd>' + fmt.format(o.maliyet_m2 * y.alan_m2) + ' TL</dd></div>' +
          (karbonVar ? '<div><dt>Bu yüzey üretim karbonu</dt><dd>' + fmt.format(Math.round(o.karbon_m2 * y.alan_m2 * 10) / 10) + ' kg CO₂e</dd></div>' : '') +
          '</dl><fieldset class="olcut"><legend>Bu seçimde en belirleyici olan neydi?</legend>' + olcutSecenekleri("olcut_" + y.id) + '</fieldset></section>';
      }).join("");
      return '<div class="ozet-ekran"><div class="ks-ust">AŞAMA 1 TAMAMLANDI</div><h1>Seçtiğiniz malzeme paketi</h1>' +
        '<p>Dört yüzey için yaptığınız seçimler aşağıda bir arada. Her malzemenin altında, o seçimde sizin için en belirleyici olan ölçütü işaretleyin.</p>' +
        '<div class="ozet-toplamlar"><div><span>Toplam maliyet</span><strong>' + fmt.format(p.maliyet) + ' / ' + fmt.format(K.butce_tl) + ' TL</strong></div>' +
        '<div><span>Kalan bütçe</span><strong>' + fmt.format(K.butce_tl - p.maliyet) + ' TL</strong></div>' +
        (karbonVar ? '<div><span>Paket üretim karbonu</span><strong>' + fmt.format(Math.round(p.karbon * 10) / 10) + ' kg CO₂e</strong></div>' : '') +
        '</div><div class="ozet-kartlar">' + kartlar + '</div></div>';
    },
    button_label: "Devam"
  });

  // 6. Aşama 2: gözden geçirme (Grup A karbon bilgisini ilk kez burada görür)
  zaman.push({
    type: jsPsychKartSecim,
    data: { bolum: "a2" },
    yuzeyler: SIRALI,
    karbon_goster: true,
    baslangic: function () { return veri("a1").secimler; },
    butce: K.butce_tl,
    asama_etiketi: "AŞAMA 2 · GÖZDEN GEÇİRME",
    senaryo_satiri: senaryoSatiri,
    yonerge: "Seçimlerinizi son kez gözden geçirebilirsiniz. İsterseniz herhangi bir yüzeydeki seçiminizi değiştirebilir, istemezseniz doğrudan devam edebilirsiniz.",
    devam_metni: "Seçimlerimi onaylıyorum"
  });

  // 7. Değişiklik gerekçesi (yalnızca değişen yüzey varsa)
  function degisenler() {
    var a = veri("a1").secimler, b = veri("a2").secimler;
    return YUZEYLER.filter(function (y) { return a[y.id] !== b[y.id]; });
  }
  zaman.push({
    timeline: [{
      type: jsPsychSurveyHtmlForm,
      data: { bolum: "degisim" },
      html: function () {
        var a = veri("a1").secimler, b = veri("a2").secimler;
        return '<div class="metin-ekran"><h1>Yaptığınız değişiklikler</h1><p>Aşağıdaki yüzeylerde seçiminizi değiştirdiniz. Her biri için bu değişiklikte en belirleyici olanı işaretleyin.</p>' +
          degisenler().map(function (y) {
            return '<fieldset class="olcut"><legend>' + y.ad + ': ' + secenek(y.id, a[y.id]).ad + ' → ' + secenek(y.id, b[y.id]).ad + '</legend>' +
              olcutSecenekleri("degisim_olcut_" + y.id) + '</fieldset>';
          }).join("") + '</div>';
      },
      button_label: "Devam"
    }],
    conditional_function: function () { return degisenler().length > 0; }
  });

  // 8. Hipotez farkındalığı (karbonu anan sorulardan ÖNCE)
  zaman.push({
    type: jsPsychSurveyHtmlForm,
    data: { bolum: "farkindalik" },
    html: '<div class="metin-ekran"><h1>Kısa bir soru</h1>' +
      '<label class="blok">Sizce bu çalışma neyi inceliyordu? <span class="kucuk">(İsteğe bağlı; birkaç kelime yeterli.)</span><textarea name="farkindalik" rows="3" maxlength="500"></textarea></label></div>',
    button_label: "Devam"
  });

  // 9. 100 puan dağıtımı
  var PUANLAR = [["estetik", "Estetik ve konsept uyumu"], ["maliyet", "Maliyet"], ["dayaniklilik", "Dayanıklılık"], ["omur", "Kullanım ömrü"], ["bakim", "Bakım kolaylığı"], ["cevre", "Çevresel etki"]];
  zaman.push({
    type: jsPsychSurveyHtmlForm,
    data: { bolum: "puanlar" },
    html: '<div class="metin-ekran"><h1>Öncelikleriniz</h1><p>Bu görevde seçim yaparken aşağıdaki ölçütlere ne kadar önem verdiniz? Toplam 100 puanı ölçütler arasında dağıtın.</p>' +
      '<div class="puanlar">' + PUANLAR.map(function (p) {
        return '<label><span>' + p[1] + '</span><input type="number" name="puan_' + p[0] + '" min="0" max="100" step="1" value="0" required></label>';
      }).join("") + '</div><p class="puan-toplam" role="status">Toplam: <strong id="puan-toplam">0</strong> / 100</p></div>',
    button_label: "Devam",
    on_load: function () {
      var form = document.querySelector("#jspsych-survey-html-form");
      var dugme = document.querySelector("#jspsych-survey-html-form-next");
      function guncelle() {
        var t = 0;
        form.querySelectorAll('input[type="number"]').forEach(function (i) { t += Number(i.value) || 0; });
        document.getElementById("puan-toplam").textContent = t;
        dugme.disabled = t !== 100;
      }
      form.addEventListener("input", guncelle);
      guncelle();
    }
  });

  // 10. Kavrama ve dikkat
  zaman.push({
    type: jsPsychSurveyHtmlForm,
    data: { bolum: "kavrama" },
    html: function () {
      var z = yuzey("zemin");
      return '<div class="metin-ekran"><h1>İki kısa soru daha</h1>' +
        '<fieldset class="secenekler"><legend>Zemin seçeneklerinden hangisinin üretim karbonu en yüksekti?</legend>' +
        z.secenekler.map(function (o, i) { return '<label><input type="radio" name="kavrama" value="' + o.kod + '"' + (i === 0 ? " required" : "") + '> ' + o.ad + '</label>'; }).join("") +
        '<label><input type="radio" name="kavrama" value="X"> Hatırlamıyorum</label></fieldset>' +
        '<fieldset class="secenekler"><legend>Bu soruyu dikkatle okuduğunuzu göstermek için lütfen “Turuncu” seçeneğini işaretleyin.</legend>' +
        ["Mavi", "Yeşil", "Turuncu", "Mor"].map(function (r, i) { return '<label><input type="radio" name="dikkat" value="' + r + '"' + (i === 0 ? " required" : "") + '> ' + r + '</label>'; }).join("") +
        '</fieldset></div>';
    },
    button_label: "Devam"
  });

  // 11. Demografi
  zaman.push({
    type: jsPsychSurveyHtmlForm,
    data: { bolum: "demografi" },
    html: '<div class="metin-ekran"><h1>Son olarak</h1>' +
      '<label class="blok">Sınıfınız <select name="sinif" required><option value="">Seçin</option><option>1</option><option>2</option><option>3</option><option>4</option><option>Yüksek lisans</option></select></label>' +
      '<fieldset class="secenekler"><legend>Malzeme bilgisi dersi aldınız mı?</legend><label><input type="radio" name="malzeme_dersi" value="Evet" required> Evet</label><label><input type="radio" name="malzeme_dersi" value="Hayır"> Hayır</label></fieldset>' +
      '<fieldset class="secenekler"><legend>Sürdürülebilirlik veya çevre konulu bir ders aldınız mı?</legend><label><input type="radio" name="cevre_dersi" value="Evet" required> Evet</label><label><input type="radio" name="cevre_dersi" value="Hayır"> Hayır</label><label><input type="radio" name="cevre_dersi" value="Emin değilim"> Emin değilim</label></fieldset>' +
      '<fieldset class="secenekler"><legend>Seçimleriniz hakkında araştırmacıyla 20–25 dakikalık kısa bir görüşme yapmak ister misiniz?</legend>' +
      '<label><input type="radio" name="gorusme" value="Evet" required> Evet, görüşmeye gönüllüyüm</label><label><input type="radio" name="gorusme" value="Hayır"> Hayır</label>' +
      '<div id="gorusme-iletisim" hidden><label class="blok">Size ulaşabileceğimiz e-posta adresi <input type="email" name="gorusme_eposta" maxlength="120" autocomplete="email"></label>' +
      '<p class="kucuk">Adresiniz yalnızca görüşme daveti için kullanılır, yanıtlarınızdan ayrı bir listede tutulur ve çalışma bitince silinir. Adres verdiğinizde yanıtlarınız anonim değil gizli olur: kimliğiniz yalnızca araştırmacı tarafından bilinir, hiçbir yerde açıklanmaz. Her profilden yalnızca birkaç kişi görüşmeye davet edilecektir.</p></div>' +
      '<p class="kucuk">“Hayır” derseniz yanıtlarınız tamamen anonim kalır.</p></fieldset>' +
      '</div>',
    button_label: "Bitir",
    on_load: function () {
      var kutu = document.getElementById("gorusme-iletisim");
      var eposta = kutu.querySelector('input[name="gorusme_eposta"]');
      document.querySelectorAll('input[name="gorusme"]').forEach(function (r) {
        r.addEventListener("change", function () {
          var evet = r.value === "Evet" && r.checked;
          kutu.hidden = !evet; eposta.required = evet;
          if (!evet) eposta.value = "";
        });
      });
    }
  });

  // 12. Özet satırı (analiz için tek satır)
  zaman.push({
    type: jsPsychCallFunction,
    data: { bolum: "ozet" },
    func: function () { return null; },
    on_finish: function (d) {
      var a1 = veri("a1"), a2 = veri("a2"), g = veri("paket_ozeti").response, dg = veri("degisim");
      var fk = veri("farkindalik").response, pu = veri("puanlar").response, kv = veri("kavrama").response, dm = veri("demografi").response;
      var p1 = paket(a1.secimler), p2 = paket(a2.secimler);
      var zemin = yuzey("zemin").secenekler.slice().sort(function (x, y) { return y.karbon_m2 - x.karbon_m2; });
      var o = {
        grup: grup, grup_kaynagi: grupKaynagi,
        a1_maliyet: p1.maliyet, a1_karbon: p1.karbon, a1_karbon_endeks: endeks(p1.karbon), a1_referans_karbon: p1.referans_karbon,
        a2_maliyet: p2.maliyet, a2_karbon: p2.karbon, a2_karbon_endeks: endeks(p2.karbon), a2_referans_karbon: p2.referans_karbon,
        karbon_farki_a2_a1: p2.karbon - p1.karbon,
        degisen_yuzey_sayisi: degisenler().length,
        degisen_yuzeyler: degisenler().map(function (y) { return y.id; }).join(";"),
        sure_a1_sn: Math.round(a1.rt / 1000), sure_a2_sn: Math.round(a2.rt / 1000),
        toplam_sure_sn: Math.round(jsPsych.getTotalTime() / 1000),
        farkindalik: fk.farkindalik,
        kavrama_yanit: kv.kavrama, kavrama_dogru: kv.kavrama === zemin[0].kod,
        dikkat_yanit: kv.dikkat, dikkat_gecti: kv.dikkat === "Turuncu",
        sinif: dm.sinif, malzeme_dersi: dm.malzeme_dersi, cevre_dersi: dm.cevre_dersi, gorusme_gonullu: dm.gorusme, gorusme_eposta: dm.gorusme === "Evet" ? (dm.gorusme_eposta || "").trim() : ""
      };
      YUZEYLER.forEach(function (y) {
        var en = y.secenekler.slice().sort(function (x, z) { return x.karbon_m2 - z.karbon_m2; })[0].kod;
        o["a1_" + y.id] = a1.secimler[y.id];
        o["a2_" + y.id] = a2.secimler[y.id];
        o["a1_" + y.id + "_en_dusuk_karbon"] = a1.secimler[y.id] === en;
        o["a2_" + y.id + "_en_dusuk_karbon"] = a2.secimler[y.id] === en;
        o["olcut_" + y.id] = g["olcut_" + y.id];
        o["degisim_olcut_" + y.id] = dg && dg.response["degisim_olcut_" + y.id] ? dg.response["degisim_olcut_" + y.id] : "";
      });
      PUANLAR.forEach(function (p) { o["puan_" + p[0]] = Number(pu["puan_" + p[0]]); });
      Object.assign(d, o);
    }
  });

  // ---------- Önizleme sonu ----------
  function onizlemeSonu() {
    var oz = jsPsych.data.get().filter({ bolum: "ozet" }).values()[0];
    var gizle = { trial_type: 1, trial_index: 1, time_elapsed: 1, internal_node_id: 1, bolum: 1, value: 1, rt: 1 };
    var satirlar = Object.keys(oz).filter(function (k) { return !gizle[k]; }).map(function (k) {
      var v = oz[k]; if (typeof v === "number" && Math.abs(v) >= 1000) v = fmt.format(v);
      return "<tr><th>" + k + "</th><td>" + String(v).replace(/</g, "&lt;") + "</td></tr>";
    }).join("");
    var el = jsPsych.getDisplayElement();
    el.innerHTML = '<div class="metin-ekran genis"><p class="onizleme-bandi">ÖNİZLEME MODU · veri gönderilmedi</p>' +
      '<h1>Önizleme tamamlandı</h1><p>Gerçek çalışmada bu satır DataPipe ile Google Drive klasörünüze kaydedilir. Aşağıda analizde kullanılacak özet satırı var.</p>' +
      '<p><button type="button" id="csv-indir" class="jspsych-btn">Tüm veriyi CSV olarak indir</button></p>' +
      '<table class="ozet-tablosu"><tbody>' + satirlar + '</tbody></table></div>';
    document.getElementById("csv-indir").addEventListener("click", function () {
      jsPsych.data.get().localSave("csv", "onizleme_" + katilimciId + ".csv");
    });
  }

  jsPsych.run(zaman);
})();
