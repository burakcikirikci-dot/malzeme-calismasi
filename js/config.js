// Deney ayarları. Yayına almadan önce bu dosyadaki köşeli parantezli alanları doldurun.
window.AYARLAR = {
  // DataPipe panelindeki deneyin kimliği. Boş bırakılırsa sayfa ÖNİZLEME modunda çalışır:
  // veri gönderilmez, grup rastgele atanır, sonda özet ekranda gösterilir.
  DATAPIPE_ID: "OTPdcbycRFsw",

  // DataPipe'ta "condition assignment" açıksa ve koşul sayısı 2 ise true yapın.
  // 0 = Grup A (geç bilgi), 1 = Grup B (erken bilgi). DataPipe sırayla dağıtır: 0, 1, 0, 1...
  KOSUL_ATAMASI_DATAPIPE: true,

  // Bu genişliğin altındaki ekranlarda deney başlamaz (kartların herkese aynı görünmesi için).
  // Önizleme modunda bu kontrol uygulanmaz.
  MIN_EKRAN_GENISLIGI: 1000,

  SENARYO: {
    baslik: "120 m² ofis",
    konsept: "Odaklanmayı destekleyen, sakin ve sıcak bir çalışma ortamı",
    kullanici: "12 kişilik bir mimarlık ofisi"
  },

  ONAM: {
    calisma_adi: "Ofis İç Mekânlarında Malzeme Kararları",
    kurum: "Haliç Üniversitesi İç Mimarlık ve Çevre Tasarımı Bölümü",
    arastirmaci: "Prof. Dr. Füsun Seçer Kariptaş ve araştırma ekibi",
    eposta: "burakcikirikci@halic.edu.tr",
    etik_kurul: "Haliç Üniversitesi Sosyal ve Beşeri Bilimler Etik Kurulu'nun 21.10.2026 tarihli ve 12/2026 sayılı kararı",
    veri_saklama: "Yanıtlarınız adınız alınmadan, rastgele bir kodla kaydedilir. Veriler DataPipe servisi aracılığıyla araştırmacının Google Drive hesabında saklanır."
  }
};
