# Karbon bilgisi ve malzeme seçimi · çevrimiçi deney

Öğrencilerin tarayıcıda tamamladığı deney sayfası. Akış: onam → grup ataması → senaryo → 1. aşama seçim → paket özeti (dört seçim bir arada + her yüzey için en belirleyici ölçüt) → 2. aşama gözden geçirme → değişiklik ölçütü (varsa) → hipotez farkındalığı → 100 puan dağıtımı → kavrama ve dikkat soruları → demografi.

Katılımcıdan zorunlu yazı istenmez: ölçüt soruları tek tıkla seçilir. Tek açık uçlu soru hipotez farkındalığıdır ("Sizce bu çalışma neyi inceliyordu?") ve o da isteğe bağlıdır. Çalışma tek kurumda yürütülür, bu yüzden kurum sorusu yoktur.

- **Grup A (geç bilgi):** karbon bilgisini ilk kez 2. aşamada görür.
- **Grup B (erken bilgi):** karbon bilgisini baştan görür.

Her şey ücretsiz araçlarla çalışır: sayfa **GitHub Pages**'te yayınlanır, veriler **DataPipe** üzerinden **Google Drive** klasörünüze kaydedilir. jsPsych kütüphaneleri `lib/` klasöründe hazır gelir; deney sırasında dış bir kütüphane sunucusuna bağımlı değildir.

## 1. Bilgisayarınızda deneyin (kurulum gerekmez)

`index.html` dosyasını çift tıklayıp tarayıcıda açın. `config.js` içinde `DATAPIPE_ID` boş olduğu sürece sayfa **önizleme modunda** çalışır: veri gönderilmez, grup rastgele atanır, sonda analizde kullanılacak özet satırı ekranda görünür ve CSV olarak indirilebilir.

Belirli bir grubu denemek için adres çubuğundaki dosya yolunun sonuna `?grup=A` veya `?grup=B` ekleyin.

## 2. İçeriği doldurun

| Dosya | Ne yapılacak |
| --- | --- |
| `js/stimuli.js` | 16 kartın verileri: karbon ve ömür değerleri kaynaklı (`karbon_kaynak`); **11 kalemin fiyatı geçici** (`fiyat_kaynak` alanında "GEÇİCİ" yazanlar), teklif gelince değiştirilecek. Dosya geçerli JSON kalmalı (tırnaklar, virgüller). |
| `js/config.js` | Köşeli parantezli tüm alanlar: konsept, kullanıcı tanımı, onam metni bilgileri (üniversite/bölüm adı dahil), etik kurul kararı, e-posta. |
| `img/` (yeni klasör) | Gerçek malzeme fotoğrafları. Kartta `"gorsel": "img/zemin-a.jpg"` yazın. Önerilen boyut 1200 × 520 piksel, hepsi aynı ışık ve ölçekte. |

Kartları değiştirdikten sonra bütçeyi kontrol edin:

```
python analiz/paket_tablosu.py
```

Betik 256 paketin tablosunu `analiz/paket_tablosu.csv` dosyasına yazar ve iki koşulu denetler: en düşük karbonlu paket bütçe içinde olmalı, en pahalı paket bütçeyi aşmalı. Bütçe, fiyatlar kesinleşince yeniden ayarlanmalı.

## 3. Sayfayı yayınlayın (GitHub Pages)

1. [github.com](https://github.com) üzerinde ücretsiz bir hesap açın.
2. **New repository** ile yeni bir depo oluşturun (ör. `malzeme-calismasi`), **Public** seçin.
3. Depo sayfasında **Add file → Upload files** ile bu klasörün tüm içeriğini sürükleyip bırakın, **Commit changes** deyin. (`analiz/` klasörünü yüklemek zorunlu değil.)
4. **Settings → Pages** bölümünde kaynak olarak `main` dalını ve `/ (root)` klasörünü seçip kaydedin.
5. Birkaç dakika sonra sayfanın adresi aynı bölümde görünür (`https://<kullanıcı-adınız>.github.io/malzeme-calismasi/`).

Depo herkese açıktır ama yalnızca deney kodu ve kartlar oradadır; öğrenci verisi asla depoya yazılmaz. Sayfa arama motorlarına kapalıdır (`noindex`).

## 4. Veri kaydını bağlayın (DataPipe + Google Drive)

1. [pipe.jspsych.org](https://pipe.jspsych.org) üzerinde hesap açın ve depolama olarak **Google Drive**'ı bağlayın. (DataPipe'ın OSF desteği 16 Kasım 2026'da sona eriyor; OSF seçmeyin.)
2. Yeni bir deney oluşturun ve deney kimliğini (experiment ID) kopyalayın.
3. Deney panelinde veri toplamayı açın. Oturum sınırını katılımcı sayısının biraz üstüne (ör. 220) ayarlayın.
4. **Koşul atamasını açın ve koşul sayısını 2 yapın.** Sayfa grubu buradan alır (0 = Grup A, 1 = Grup B, sırayla dağıtılır). Bu açık değilse sayfa "Çalışma şu anda başlatılamadı" der ve kimse başlayamaz.
5. `js/config.js` içinde `DATAPIPE_ID: ""` satırına kimliği yazın ve dosyayı GitHub'da güncelleyin.

Kontrol: yayındaki adresi açıp deneyi iki kez sonuna kadar tamamlayın. Google Drive klasörünüzde iki CSV dosyası görünmeli ve gruplar A ile B olmalı. Ardından bu iki deneme dosyasını silin.

## 5. Veriyi toplayıp birleştirin

Google Drive'daki veri klasörünü bilgisayarınıza indirin ve çalıştırın:

```
python analiz/birlestir.py <indirilen_klasör>
```

Her katılımcı için tek satırlık `ozet_tablosu.csv` oluşur. Başlıca sütunlar:

| Sütun | Anlamı |
| --- | --- |
| `grup` | A (geç bilgi) veya B (erken bilgi) |
| `a1_karbon`, `a2_karbon` | 1. ve 2. aşamada seçilen paketin üretim karbonu (A1–A3, kg CO₂e) |
| `a1_karbon_endeks` | 256 paket içinde 0 (en düşük) ile 1 (en yüksek) arası karbon |
| `a1_referans_karbon` | 15 yıllık süre içinde yenilemelerle birlikte karbon |
| `a1_maliyet`, `a2_maliyet` | Paket maliyeti (TL) |
| `a1_<yüzey>`, `a2_<yüzey>` | Yüzey başına seçilen kart (A–D) ve en düşük karbonlu kartın seçilip seçilmediği |
| `kart_sirasi` | Kartların bu katılımcıya gösterildiği sıra (ör. `zemin:CADB;...`); konum etkisini kontrol için |
| `degisen_yuzey_sayisi` | 2. aşamada değiştirilen yüzey sayısı |
| `olcut_<yüzey>` | Paket özeti ekranında o yüzey için seçilen en belirleyici ölçüt (estetik ve konsept uyumu, maliyet, dayanıklılık, kullanım ömrü, bakım kolaylığı, çevresel etki, diğer) |
| `degisim_olcut_<yüzey>` | 2. aşamada değiştirilen yüzeyde değişikliğin en belirleyici ölçütü (değişmeyenlerde boş) |
| `puan_*` | 100 puanlık öncelik dağılımı |
| `farkindalik` | Hipotez farkındalığı (açık uçlu, tek soru) |
| `kavrama_dogru`, `dikkat_gecti` | Kavrama ve dikkat kontrolleri |
| `sinif`, `malzeme_dersi`, `cevre_dersi` | Kovaryatlar |
| `gorusme_gonullu` | Görüşmeye gönüllü olup olmadığı (iletişim için katılımcının kodunu e-postayla göndermesi gerekir) |

Ayrıca `gorusme_gonullu` (görüşmeye gönüllü mü), `baslangic_zamani` (oturumu belirlemek için) ve `deneme` sütunları vardır.

**Kendi denemeleriniz:** Linkin sonuna `?deneme` ekleyerek açtığınız oturumlar "deneme" olarak işaretlenir; `birlestir.py` bunları ana tabloya almaz, `deneme_kayitlari.csv` dosyasına ayırır.

### Analiz

```
python analiz/analiz.py <klasor>/ozet_tablosu.csv --min-sure 8 [--farkindalik kodlama.csv]
```

Ön-kayıttaki bütün analizleri (H1 birincil; H2a, H2b, H3a, H3b ikincil, Holm düzeltmeli; duyarlılık ve keşifsel analizler) çalıştırır ve `sonuclar/` klasörüne `rapor.md`, denge tablosu, yüzey tablosu, katılımcı akışı ve Şekil 3'ü yazar. `--min-sure` pilottan sonra ön-kayda yazılan süre eşiğidir (dakika). Farkındalık duyarlılık analizi için "katilimci_id,farkindalik_dogru" sütunlu bir kodlama dosyası verilir.

Kodu veri gelmeden sınamak için: `python analiz/simulasyon.py sahte.csv` (sahte veri üretir; `--etki 0` ile etkisiz veri).

Sayfayı yarıda bırakan katılımcıların verisi DataPipe tarafından 24 saat içinde `.partial.json` olarak yazılır; birleştirme betiği bunları sayar (CONSORT akış şeması için).

## 6. Pilottan önce kontrol listesi

- [ ] `stimuli.js` içinde "GEÇİCİ" yazan fiyat kalmadı ve `paket_tablosu.py` uyarı vermiyor.
- [ ] LCA uzmanı karbon değerlerini kontrol etti (raporun "LCA uzmanına sorulacaklar" bölümü).
- [ ] `config.js` içinde köşeli parantezli alan kalmadı.
- [ ] Onam metni etik kurulun onayladığı metinle birebir aynı.
- [ ] Gerçek fotoğraflar eklendi.
- [ ] DataPipe koşul ataması açık, iki deneme kaydı Drive'da görüldü ve silindi.
- [ ] Deney kurgusu ve analiz planı OSF'de ön-kayda alındı.

## Notlar

- Paket özeti ekranında Grup A yalnızca maliyeti görür; karbon değerleri yalnızca Grup B'ye gösterilir (Grup A karbonu ilk kez 2. aşamada görür).
- Tek kurumda gruplar arası bilgi sızıntısını azaltmak için oturumları olabildiğince kısa bir zaman aralığında (aynı gün ya da aynı hafta) yapın ve katılımcılardan çalışmayı arkadaşlarıyla konuşmamalarını isteyin.
- 1000 pikselden dar ekranlarda deney başlamaz; kartların herkese aynı görünmesi için. Sınırı `config.js` içindeki `MIN_EKRAN_GENISLIGI` ile değiştirebilirsiniz.
- Katılımcıya rastgele bir kod verilir; ad, e-posta veya IP adresi kaydedilmez. Katılımcı bitiş ekranında kodunu görür ve veri silme talebinde bu kodu kullanabilir.
- Sayfa arayüzü bilerek tek ve açık bir tema kullanır (koyu mod yok), uyaranlar herkese aynı görünsün diye.
- Kütüphaneler: jsPsych 8.3.0, eklentiler 2.1.0 ve `@jspsych/extension-pipe` 0.2.0, MIT lisanslı (`lib/`).

## Dosya yapısı

```
index.html                     sayfa
css/style.css                  görünüm ve yer tutucu yüzey dokuları
js/config.js                   ayarlar ve metinler
js/stimuli.js                  kartlar, alanlar, bütçe (JSON)
js/plugin-kart-secim.js        kart seçim ekranı (jsPsych eklentisi)
js/experiment.js               deney akışı ve özet satırı
lib/                           jsPsych kütüphaneleri
analiz/paket_tablosu.py        256 paket tablosu ve bütçe kontrolü
analiz/birlestir.py            katılımcı dosyalarını tek tabloya çevirir
analiz/analiz.py               ön-kayıtlı analizler, tablolar, Şekil 3
analiz/simulasyon.py           analiz kodunu sınamak için sahte veri
```
