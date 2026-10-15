// Deney ayarları. Yayına almadan önce bu dosyadaki köşeli parantezli alanları doldurun.
window.AYARLAR = {
  // DataPipe panelindeki deneyin kimliği. Boş bırakılırsa sayfa ÖNİZLEME modunda çalışır:
  // veri gönderilmez, grup rastgele atanır, sonda özet ekranda gösterilir.
  DATAPIPE_ID: "",

  // DataPipe'ta "condition assignment" açıksa ve koşul sayısı 2 ise true yapın.
  // 0 = Grup A (geç bilgi), 1 = Grup B (erken bilgi). DataPipe sırayla dağıtır: 0, 1, 0, 1...
  KOSUL_ATAMASI_DATAPIPE: true,

  // Bu genişliğin altındaki ekranlarda deney başlamaz (kartların herkese aynı görünmesi için).
  // Önizleme modunda bu kontrol uygulanmaz.
  MIN_EKRAN_GENISLIGI: 1000,

  SENARYO: {
    baslik: "120 m² ofis",
    konsept: "[KONSEPT METNİ: örneğin 'Odaklanmayı destekleyen, sakin ve sıcak bir çalışma ortamı']",
    kullanici: "[KULLANICI TANIMI: örneğin '12 kişilik bir mimarlık ofisi']"
  },

  ONAM: {
    calisma_adi: "Ofis İç Mekânlarında Malzeme Kararları",
    kurum: "[ÜNİVERSİTE / BÖLÜM]",
    arastirmaci: "[ARAŞTIRMACI ADI]",
    eposta: "[E-POSTA]",
    etik_kurul: "[ETİK KURUL ADI], karar tarihi [GG.AA.YYYY], karar no [NO]",
    veri_saklama: "Yanıtlarınız adınız alınmadan, rastgele bir kodla kaydedilir. Veriler DataPipe servisi aracılığıyla araştırmacının Google Drive hesabında saklanır."
  }
};
