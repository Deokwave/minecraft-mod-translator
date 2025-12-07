# 🎮 Minecraft Mod Türkçe Çeviri Aracı

**Geliştirici:** Deokwave
**Telif Hakkı:** © 2024 Deokwave - Tüm hakları saklıdır.

---

## 📋 Gereksinimler

- **Node.js** (v18 veya üzeri) - [İndir](https://nodejs.org/)
- **NPM** (Node.js ile birlikte gelir)

---

## 🚀 Kurulum

### 1. Bağımlılıkları Yükle

CMD veya PowerShell'i aç ve proje klasöründe şu komutu çalıştır:

```bash
npm install
```

Bu komut otomatik olarak şu paketleri yükler:

- `adm-zip` - JAR dosyalarını okumak için
- `p-limit` - Paralel işleme için
- `commander` - CLI komutları için
- `chalk` - Renkli terminal çıktısı için
- `ora` - Yükleme animasyonları için

### 2. Kurulum Tamamlandı

Kurulum bittikten sonra aracı kullanmaya hazırsınız.

---

## 💻 Kullanım

### Toplu Çeviri (Tüm Modlar)

Bir klasördeki tüm modları çevirmek için:

```bash
node src/cli.js batch "C:\Path\To\Mods\Folder" --mode advanced -c 3
```

**Parametreler:**

- `batch` - Toplu çeviri modu
- `"C:\Path\To\Mods\Folder"` - Mod klasörünün yolu (tırnak içinde!)
- `--mode advanced` - Gelişmiş çeviri modu (Ücretsiz, Google Translate + Sözlük)
- `-c 3` - Aynı anda 3 mod çevir (paralel işleme)

**Alternatif Modlar:**

- `--mode simple` - Basit sözlük çevirisi (hızlı ama sınırlı)
- `--mode gemini` - Gemini AI (ücretsiz, yavaş)
- `--mode ai` - Claude AI (API key gerekli)

### Tek Mod Çevirisi

Sadece bir modu çevirmek için:

```bash
node src/cli.js translate "C:\Path\To\Mod.jar" --mode advanced
```

### Mod Bilgilerini Görüntüle

Bir modun bilgilerini görmek için:

```bash
node src/cli.js info "C:\Path\To\Mod.jar"
```

---

## 📂 Çıktı

Çevrilen modlar varsayılan olarak `translated` klasörüne kaydedilir.

Farklı bir klasöre kaydetmek için:

```bash
node src/cli.js batch "C:\Mods" --mode advanced -o "C:\CevrilmisModlar"
```

---

## 🎯 Özellikler

✅ **Her Şey Çevriliyor** - Hiçbir satır atlanmaz
✅ **Format Kodları Korunuyor** - `%s, %d, %f, %1$s` vb. tüm kodlar korunur
✅ **Renk Kodları Korunuyor** - `§a, §b, §c` vb. Minecraft renk kodları bozulmaz
✅ **Kaliteli Türkçe** - Doğal cümleler, profesyonel çeviri
✅ **Hızlı** - Paralel işleme ile 3-5 mod aynı anda
✅ **Güvenli** - Orijinal modlar değiştirilmez, yeni dosya oluşturulur

---

## ⚙️ Gelişmiş Ayarlar

### Paralel İşleme Sayısı

Daha hızlı çeviri için aynı anda daha fazla mod işleyin:

```bash
node src/cli.js batch "C:\Mods" --mode advanced -c 5
```

> **Not:** Çok yüksek değerler (10+) Google Translate tarafından engellenebilir.

### Zaten Türkçe Olan Modları Atla

```bash
node src/cli.js batch "C:\Mods" --mode advanced --skip-existing
```

---

## 🐛 Sorun Giderme

### "Node.js bulunamadı" hatası

Node.js kurulu değil. [Buradan](https://nodejs.org/) indirin ve kurun.

### "npm: command not found"

CMD'yi kapatıp tekrar açın. Sorun devam ederse Node.js'i yeniden yükleyin.

### "ENOENT: no such file or directory"

Mod klasörü yolu yanlış veya tırnak içinde değil. Yolu tırnak içinde yazın:

```bash
node src/cli.js batch "C:\Users\Name\Desktop\Mods"
```

### Çeviri çok yavaş

`-c` değerini artırın:

```bash
node src/cli.js batch "C:\Mods" --mode advanced -c 5
```

### "Too many requests" hatası

Google Translate sizi engelledi. 10-20 dakika bekleyin veya `-c` değerini düşürün:

```bash
node src/cli.js batch "C:\Mods" --mode advanced -c 2
```

---

## 📝 Örnek Kullanım

### Örnek 1: Basit Kullanım

```bash
node src/cli.js batch "C:\Users\zsiz3\curseforge\minecraft\Instances\Solo Leveling - Reawakening\mods" --mode advanced -c 3
```

### Örnek 2: Hızlı Çeviri (Daha Fazla Paralel)

```bash
node src/cli.js batch "C:\Mods" --mode advanced -c 5
```

### Örnek 3: Tek Mod Test

```bash
node src/cli.js translate "C:\Mods\alexsmobs-1.22.9.jar" --mode advanced
```

### Örnek 4: Özel Çıktı Klasörü

```bash
node src/cli.js batch "C:\Mods" --mode advanced -o "D:\TurkceModlar"
```

---

## 📄 Lisans

**© 2024 Deokwave - Tüm hakları saklıdır.**

Bu yazılım Deokwave tarafından geliştirilmiştir.
Bu araç, kişisel ve eğitim amaçlı kullanım için ücretsizdir.
Ticari kullanım için izin alınması gerekmektedir.

**Bu yazı asla silinemez, değiştirilemez veya kaldırılamaz.**

---

## 🆘 Destek

Sorun yaşıyorsanız veya öneriniz varsa:

- GitHub: https://github.com/deokwave/
- İletişim: Deokwave

---

**Deokwave** tarafından ❤️ ile geliştirilmiştir.
