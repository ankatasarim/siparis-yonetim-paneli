# 🪶 Anka Tasarım · Sipariş Takip Paneli

Instagram'dan gelen siparişleri tek panelden yönetmek için hazırlanmış, **Next.js + Tailwind** ile yazılmış sipariş takip uygulaması. Veriler **Supabase**'de (REST API ile okunup yazılır), uygulama **Vercel**'de çalışır; ikisi de ücretsiz planla yeter. Instagram mesajlaşma ve DHL eCommerce ile entegre.

**Akış:** Instagram'dan sipariş → Hazırlık → DHL kargo kaydı → Müşteriye "kargoya verildi" mesajı (otomatik) → Teslim → Memnuniyet sorusu (tek tıkla) → Cevaba göre siparişi kapatma (otomatik)

## Neler var?

- **Giriş (panel):** Durum sayaçları, bu ayki ciro, yeni / kargo bekleyen / kargodaki siparişler, dikkat gerektiren işler, son hareketler.
- **Siparişler:** ikas'taki gibi tablo, arama, durum ve ödeme filtreleri, sayfalama, CSV dışa aktarma. Durum rozetine tıklayınca detaya girmeden durum değiştirilir (kargoya verirken takip numarası sorulur).
- **Sipariş detayı:** Siyah üst barlı tam ekran sayfa; ürün tablosu, müşteri ve sevkiyat adresi, zaman çizelgesi + iç yorumlar, sağda sipariş özeti, ödeme, durum işlemleri, memnuniyet ve bildirimler.
- **Sipariş oluşturma:** Ürün satırları, kayıtlı müşteri arama veya yeni müşteri, etiket / kişiselleştirme notu, ödeme durumu ve yöntemi, kargo ücreti, desi, parça, kargo ödeyen.
- **DHL kargo:** Manuel mod (Online Şube + takip numarası, hemen kullanılabilir), API modu (şubeden gelen bilgilerle), Unified Tracking API ile otomatik teslimat algılama.
- **Gelen Kutusu:** Instagram DM'leri panele düşer (webhook), panelden cevap yazılır, mesajdan tek tıkla sipariş oluşturulur.
- **Memnuniyet:** Teslim sonrası soruyu uygun gördüğünüzde tek tıkla gönderirsiniz (Ayarlar'dan otomatiğe alınabilir). Müşterinin cevabı otomatik işlenir.
- **Ayarlar:** Entegrasyon durumu, yedek indirme, cron adresi, elle gönderilecek bildirimler, mesaj şablonları ve otomatik gönderim anahtarları, Instagram'sız test aracı.

## Yerelde çalıştırma

Gereksinim: **Node.js 18 veya üstü** (bu bilgisayarda `nvm use 22`). Supabase anahtarı yoksa veriler `data/local.json` dosyasında tutulur (yerel deneme).

```bash
cd siparis-takip
nvm use 22
npm install
cp .env.example .env      # PANEL_PASSWORD, CRON_SECRET, Supabase bilgileri
npm run build
npm start                 # http://localhost:3000
```

Geliştirme için `npm run dev`. Testler: `npm test` (bellek içi depo, internet gerekmez).

## Canlıya alma: Supabase + Vercel (ücretsiz)

### 1) Supabase: tablolar ve anahtar
1. https://supabase.com → projeniz (bölge Avrupa önerilir).
2. **SQL Editor › New query** → [supabase/schema.sql](supabase/schema.sql) dosyasının tamamını yapıştırın → **Run**. Tablolar, güvenlik kuralları (RLS) ve yedek kovası oluşur. Bir kez yapılır.
3. **Project Settings › Data API › Project URL** = `SUPABASE_URL`. Anahtar için iki seçenek:
   - **Publishable anahtar** (`sb_publishable_...`, Project Settings › API Keys) → `SUPABASE_PUBLISHABLE_KEY`. `schema.sql` bu anahtara tablo erişimi verir. Anahtar herkese açık sayıldığından proje klasörünü paylaşırken `.env` dosyasını dışarıda tutun.
   - **Gizli anahtar** (`sb_secret_...`, Secret keys sekmesi) → `SUPABASE_SECRET_KEY`. Daha güvenli; girildiğinde publishable anahtar kullanılmaz ve `schema.sql` içindeki `anka_anon_*` politikalarını silebilirsiniz.
4. İsterseniz önce yerelde deneyin: `.env` içine iki değeri yazıp `npm run build && npm start`. Oluşturduğunuz siparişler Supabase › Table Editor'da görünmeli.

### 2) Vercel'e yayın
```bash
npx vercel login          # tarayıcıdan giriş
npx vercel                # klasörü yükler (GitHub gerekmez); sorulara Enter ile geçin
```
Vercel panelinde **Settings › Environment Variables** (Production):

| Değişken | Değer |
|---|---|
| `SUPABASE_URL` | Project URL |
| `SUPABASE_PUBLISHABLE_KEY` veya `SUPABASE_SECRET_KEY` | Supabase anahtarı |
| `PANEL_PASSWORD` | güçlü bir şifre (**zorunlu**; tanımsızsa panel açılmaz) |
| `SESSION_SECRET` | rastgele uzun metin |
| `CRON_SECRET` | rastgele uzun metin |
| `BASE_URL` | `https://uygulama-adi.vercel.app` |
| `ALLOW_SIMULATION` | `false` |
| `IG_*`, `DHL_*` | ilgili bölümlere göre |

Sonra `npx vercel --prod` ile yeniden yayınlayın. `vercel.json` içinde bölge Frankfurt (`fra1`) ve günlük cron tanımlıdır.

### 3) 30 dakikalık cron (DHL takibi)
Vercel'in ücretsiz planı cron'u günde bir çalıştırır. Kargo takibi için https://cron-job.org (ücretsiz) üzerinde görev açın:
- Adres: Ayarlar sayfasındaki "Adresi kopyala" düğmesiyle alın (`https://.../api/cron?secret=...`)
- Sıklık: her 30 dakika
Aynı adres cevapsız memnuniyet kapatma, Instagram token yenileme ve günlük yedeği de çalıştırır. Ayarlar › "İşleri şimdi çalıştır" ile elle tetikleyebilirsiniz.

### Ücretsiz plan notları
- **Yedek:** Supabase'in ücretsiz planında yedek yoktur. Uygulama her gün JSON yedeği Supabase Storage'daki `yedek` kovasına yükler (son 30 gün) ve Ayarlar'dan "Yedek indir" ile elle alabilirsiniz. Geri yükleme: `npm run restore -- yedek.json --evet` (mevcut verileri siler).
- **Uyutma:** Supabase, 7 gün istek gelmezse projeyi uyutur. Günlük cron ve panel kullanımı bunu önler; yine de uyursa Supabase panelinden "Restore" ile uyandırılır, veri silinmez.
- **Kapasite:** 500 MB veritabanı; sipariş başına birkaç KB. Yıllarca yeter.

## Günlük kullanım

1. **Sipariş geldi:** Gelen Kutusu'nda müşterinin DM'ini açın → "Sipariş oluştur". Instagram bağlı değilse "Sipariş Oluştur" ile elle girin.
2. **Ödeme:** Havale gelince "Ödeme alındı" deyin. Kapıda ödeme için ödeme durumunu "Kapıda Ödeme" seçin.
3. **Hazırlık:** "Hazırlığa al". Koli hazır olunca desi / parça / kargo ödeyen bilgisini girin.
4. **Kargo:** "Kopyala" ile alıcı bilgilerini alın, DHL Online Şube'de gönderiyi oluşturun, takip numarasını listeden veya detaydan girin. Müşteriye takip linkli mesaj otomatik gider.
5. **Teslim:** Takip API'si varsa otomatik algılanır; yoksa "Teslim edildi" deyin.
6. **Memnuniyet ve kapanış:** Uygun gördüğünüzde "Memnuniyet sorusunu gönder". Olumlu cevapta sipariş kendiliğinden kapanır; olumsuz cevaplar uyarı olarak görünür.

Instagram'a gönderilemeyen mesajlar **Ayarlar › Elle gönderilmesi gereken bildirimler** listesine düşer; kopyalayıp elle gönderip "Elle gönderdim" diyebilirsiniz.

## Instagram bağlantısı

Meta'nın **Instagram API with Instagram Login** ürünü kullanılır. Gerekenler: Instagram **profesyonel (işletme)** hesap ve bir Meta geliştirici uygulaması.

1. https://developers.facebook.com → **My Apps → Create App** → "Business" tipinde uygulama oluşturun.
2. Uygulamaya **Instagram** ürününü ekleyin (Instagram API with Instagram Login).
3. **API setup with Instagram login** adımlarında Instagram hesabınızı ekleyin ve **Generate token** ile uzun ömürlü token alın → `IG_ACCESS_TOKEN` (ya da Ayarlar sayfasından yapıştırın).
4. **App settings → Basic** → App Secret'ı `IG_APP_SECRET` olarak ekleyin.
5. **Webhooks** bölümünde: Callback URL `https://ADRESINIZ/webhooks/instagram`, Verify token `IG_VERIFY_TOKEN`, alan **messages**.
6. Instagram uygulamasında **Ayarlar › Mesajlar ve hikâye yanıtları › Mesaj kontrolleri › Bağlı araçlara erişime izin ver** açık olmalı.
7. Tüm müşterilerden mesaj almak için `instagram_business_manage_messages` izni için **App Review** başvurusu yapın.

**24 saat kuralı:** Müşterinin son mesajından 24 saat sonra gönderilen mesajlar reddedilebilir; uygulama `HUMAN_AGENT` etiketiyle dener, olmazsa mesaj elle gönderilecekler listesine düşer.

## DHL eCommerce

- **Manuel mod** (`DHL_MODE=manual`, varsayılan): Gönderiyi https://onlinesube.dhlecommerce.com.tr üzerinden siz oluşturursunuz.
- **Takip:** https://developer.dhl.com "Shipment Tracking – Unified" anahtarını `DHL_TRACKING_API_KEY` olarak ekleyin; cron her çalıştığında kargodaki siparişler sorgulanır.
- **API modu:** Şubenizden web servis bilgilerini alınca `DHL_MODE=api` ve `DHL_API_*` değişkenleri; alan adlarını [lib/integrations/dhl/api.ts](lib/integrations/dhl/api.ts) içinde uyarlayın.

## Proje yapısı

```
app/
  (panel)/               Kenar çubuklu sayfalar: giriş, siparişler, müşteriler, gelen kutusu, ayarlar
  siparisler/[id]/       Tam ekran sipariş detayı ve düzenleme; siparisler/yeni: oluşturma
  api/                   Route handler'lar; api/cron zamanlanmış işler; api/backup JSON yedek
  webhooks/instagram/    Meta webhook (doğrulama + gelen mesaj)
components/              Arayüz bileşenleri (Tailwind)
lib/
  store.ts               Veri deposu arayüzü (filtre/sıralama/sayfalama)
  store/supabase.ts      Supabase REST API (supabase-js, gizli anahtar)
  store/local.ts         Yerel JSON deposu (geliştirme/test)
  services/              orders, customers, messaging, inbox, automation, backup
  integrations/          instagram, dhl (tracking + API adaptörü)
  session.ts             Oturum imzası (Web Crypto), middleware.ts ile korunur
supabase/schema.sql      Supabase SQL Editor'de bir kez çalıştırılacak şema
instrumentation.ts       Kendi sunucunuzda zamanlayıcılar (Vercel'de cron kullanılır)
scripts/restore.ts       Yedekten geri yükleme
test/run.ts              Servis testleri
vercel.json              Bölge (fra1) ve günlük cron
```
