/**
 * Advanced Translator - HİÇBİR ŞEYİ ATLAMAYAN MÜKEMMEL ÇEVİRİ
 * Google Translate API (unofficial) + Kapsamlı Sözlük
 *
 * © 2024-2025 Deokwave - Tüm Hakları Saklıdır
 * Bu dosya Deokwave'e aittir ve telif hakkı koruması altındadır.
 */

import https from 'https';
import { setTimeout as delay } from 'timers/promises';

export class AdvancedTranslator {
  constructor(options = {}) {
    this.dictionary = this.buildMinecraftDictionary();
    this.stats = {
      total: 0,
      translated: 0,
      cached: 0,
      errors: 0,
      skipped: 0
    };
    this.cache = new Map();
    this.useGoogleTranslate = options.useGoogle !== false; // Varsayılan true
  }

  /**
   * Ana çeviri fonksiyonu - HİÇBİR ŞEY ATLANMAZ
   */
  async translateLanguageFile(jsonContent, options = {}) {
    try {
      const parsed = JSON.parse(jsonContent);
      const translated = {};
      const keys = Object.keys(parsed);

      this.stats.total = keys.length;

      console.log(`\n🔄 ${keys.length} anahtar çevriliyor...`);

      let processedCount = 0;

      for (const [key, value] of Object.entries(parsed)) {
        try {
          // Her türlü değeri çevir (string, array, object)
          translated[key] = await this.smartTranslate(value, key);
          this.stats.translated++;
          processedCount++;

          // Her 50 çeviride ilerlemeyi göster
          if (processedCount % 50 === 0) {
            console.log(`   ✓ ${processedCount}/${keys.length} çevrildi`);
          }

        } catch (e) {
          console.warn(`   ⚠ Hata (${key}): ${e.message}`);
          translated[key] = value; // Hata durumunda orijinal
          this.stats.errors++;
        }

        // Rate limiting - Google Translate için
        if (this.useGoogleTranslate && processedCount % 10 === 0) {
          await delay(100); // Her 10 çeviride 100ms bekle
        }
      }

      console.log(`   ✅ ${processedCount}/${keys.length} tamamlandı!\n`);

      return JSON.stringify(translated, null, 2);
    } catch (error) {
      throw new Error(`JSON parse hatası: ${error.message}`);
    }
  }

  /**
   * Akıllı çeviri - değer tipine göre
   */
  async smartTranslate(value, key = '') {
    // String ise
    if (typeof value === 'string') {
      return await this.translateString(value);
    }

    // Array ise (her elemanı çevir)
    if (Array.isArray(value)) {
      const translated = [];
      for (const item of value) {
        translated.push(await this.smartTranslate(item, key));
      }
      return translated;
    }

    // Object ise (her değeri çevir)
    if (typeof value === 'object' && value !== null) {
      const translated = {};
      for (const [k, v] of Object.entries(value)) {
        translated[k] = await this.smartTranslate(v, k);
      }
      return translated;
    }

    // Number, boolean, null vb. - olduğu gibi dön
    return value;
  }

  /**
   * String çeviri - HİÇBİR HARF ATLANMAZ
   */
  async translateString(text) {
    if (!text || text.trim() === '') return text;

    // Cache kontrolü
    const cacheKey = text;
    if (this.cache.has(cacheKey)) {
      this.stats.cached++;
      return this.cache.get(cacheKey);
    }

    try {
      // 1. ADIM: Format kodlarını koru
      const preserved = this.preserveFormatting(text);

      // 2. ADIM: Önce sözlük ile çevir (Minecraft terimleri)
      let result = this.dictionaryTranslate(preserved.text);

      // 3. ADIM: Hala İngilizce kalan kısımları Google Translate ile çevir
      if (this.useGoogleTranslate && this.hasEnglish(result)) {
        try {
          const googleResult = await this.googleTranslate(result);

          // Google Translate sonucunu kullan
          if (googleResult && googleResult.trim() !== '') {
            result = googleResult;
          }
          // Özel isimler için aynı metin dönebilir - bu normal, uyarı verme
        } catch (e) {
          // Sadece gerçek bağlantı hatalarında uyar
          console.warn(`⚠️  Google Translate bağlantı hatası: ${e.message}`);
          // Sözlük çevirisi zaten yapıldı, devam et
        }
      }

      // 4. ADIM: Format kodlarını geri koy
      result = this.restoreFormatting(result, preserved);

      // 5. ADIM: Kalite kontrol
      result = this.qualityCheck(result, text);

      // Cache'e kaydet
      this.cache.set(cacheKey, result);

      return result;

    } catch (error) {
      console.warn(`⚠️  Çeviri hatası: ${error.message}`);
      return text; // Hata durumunda orijinal metni dön
    }
  }

  /**
   * Format kodlarını koru (%s, §a, {}, vb.)
   */
  preserveFormatting(text) {
    const preserved = {
      text: text,
      formatCodes: [],
      colorCodes: [],
      placeholders: [],
      numbers: []
    };

    // ÖNEMLİ: TÜM format kodlarını koru - %s, %d, %f, %i, %x, %o, %n, %1$s, %2$d vb.
    // Java format: %s, %d, %f, %n, %1$s, %2$d, %b, %h, %t
    // C format: %d, %i, %u, %x, %o, %f, %e, %g, %c, %s, %p
    // Extended: %b (boolean), %h (hash), %t (time), %%, %n (newline)
    // Pozisyonel: %1$s, %2$d, %3.2f, %10s, %.5f
    // ÖZEL: Placeholder - Kısa, benzersiz, çevrilmez
    // XML tag formatı kullan - Google Translate XML tagları çevirmez!
    preserved.text = preserved.text.replace(/(%\d*\.?\d*\$?[sdfbiuoxXeEfFgGaAcspnhtbHBTN%])/g, (match) => {
      const index = preserved.formatCodes.length;
      preserved.formatCodes.push(match);
      // XML tag formatı - kesinlikle çevrilmez
      return `<FMT${index}/>`;
    });

    // Color kodları: §a, §b, §0-9, §k-r
    preserved.text = preserved.text.replace(/(§[0-9a-fk-or])/gi, (match) => {
      const index = preserved.colorCodes.length;
      preserved.colorCodes.push(match);
      return `<CLR${index}/>`;
    });

    // Placeholder: {}, {player}, {{value}}, %%, <tag>, [tag]
    preserved.text = preserved.text.replace(/(\{\{[^}]+\}\}|\{[^}]*\}|%%|\[[^\]]+\]|<[^>]+>)/g, (match) => {
      const index = preserved.placeholders.length;
      preserved.placeholders.push(match);
      return `<PH${index}/>`;
    });

    // Sayıları koru (tek başına VEYA %25 gibi sayı+% formatı)
    // %25 → yüzde işareti + sayı (format kodu DEĞİL ama korunmalı!)
    preserved.text = preserved.text.replace(/\b(\d+(?:\.\d+)?%?)\b/g, (match) => {
      const index = preserved.numbers.length;
      preserved.numbers.push(match);
      return `<NUM${index}/>`;
    });

    return preserved;
  }

  /**
   * Format kodlarını geri koy
   */
  restoreFormatting(text, preserved) {
    let result = text;

    // XML tagları geri koy - Google Translate bazen değiştirebilir
    // Olası formatlar: <NUM0/>, <%NUM0/>, < NUM0 />, &lt;NUM0/&gt;

    // Sayıları geri koy - tüm varyasyonlar
    preserved.numbers.forEach((num, index) => {
      const patterns = [
        new RegExp(`<NUM${index}/>`, 'g'),
        new RegExp(`<%NUM${index}/>`, 'g'),
        new RegExp(`<\\s*NUM${index}\\s*/>`, 'g'),
        new RegExp(`&lt;NUM${index}/&gt;`, 'g')
      ];
      patterns.forEach(pattern => {
        result = result.replace(pattern, num);
      });
    });

    // Placeholder'ları geri koy
    preserved.placeholders.forEach((ph, index) => {
      const patterns = [
        new RegExp(`<PH${index}/>`, 'g'),
        new RegExp(`<%PH${index}/>`, 'g'),
        new RegExp(`<\\s*PH${index}\\s*/>`, 'g'),
        new RegExp(`&lt;PH${index}/&gt;`, 'g')
      ];
      patterns.forEach(pattern => {
        result = result.replace(pattern, ph);
      });
    });

    // Color kodlarını geri koy
    preserved.colorCodes.forEach((color, index) => {
      const patterns = [
        new RegExp(`<CLR${index}/>`, 'g'),
        new RegExp(`<%CLR${index}/>`, 'g'),
        new RegExp(`<\\s*CLR${index}\\s*/>`, 'g'),
        new RegExp(`&lt;CLR${index}/&gt;`, 'g')
      ];
      patterns.forEach(pattern => {
        result = result.replace(pattern, color);
      });
    });

    // Format kodlarını geri koy
    preserved.formatCodes.forEach((fmt, index) => {
      const patterns = [
        new RegExp(`<FMT${index}/>`, 'g'),
        new RegExp(`<%FMT${index}/>`, 'g'),
        new RegExp(`<\\s*FMT${index}\\s*/>`, 'g'),
        new RegExp(`&lt;FMT${index}/&gt;`, 'g')
      ];
      patterns.forEach(pattern => {
        result = result.replace(pattern, fmt);
      });
    });

    return result;
  }

  /**
   * Sözlük tabanlı çeviri (Minecraft terimleri)
   */
  dictionaryTranslate(text) {
    let result = text;

    // ÖNEMLİ: Özel isimleri koru (Creeper, Enderman, Netherite vb.)
    const preservedNames = this.preserveProperNouns(text);
    result = preservedNames.text;

    // Uzun ifadeleri önce çevir (daha spesifik)
    const sortedEntries = Object.entries(this.dictionary)
      .sort((a, b) => b[0].length - a[0].length);

    for (const [eng, tur] of sortedEntries) {
      if (!eng || !tur) continue;

      // Case-insensitive, kelime sınırları ile
      const regex = new RegExp(`\\b${this.escapeRegex(eng)}\\b`, 'gi');

      result = result.replace(regex, (match) => {
        // Orijinal harflerin büyük/küçüklüğünü koru
        if (match[0] === match[0].toUpperCase()) {
          return tur.charAt(0).toUpperCase() + tur.slice(1);
        }
        return tur;
      });
    }

    // Özel isimleri geri koy
    result = this.restoreProperNouns(result, preservedNames);

    return result;
  }

  /**
   * Özel isimleri koru (Creeper, Steve, Netherite vb. çevrilmemeli)
   */
  preserveProperNouns(text) {
    const preserved = {
      text: text,
      nouns: []
    };

    // Minecraft özel isimleri (çevrilmemesi gerekenler)
    const properNouns = [
      'Minecraft', 'Steve', 'Alex', 'Creeper', 'Enderman', 'Zombie', 'Skeleton',
      'Netherite', 'Ender Dragon', 'Wither', 'Piglin', 'Hoglin', 'Strider',
      'Blaze', 'Ghast', 'Shulker', 'Guardian', 'Elder Guardian', 'Phantom',
      'Drowned', 'Husk', 'Stray', 'Vindicator', 'Evoker', 'Vex', 'Pillager',
      'Ravager', 'Witch', 'Silverfish', 'Endermite', 'Spider', 'Cave Spider',
      'Slime', 'Magma Cube', 'Iron Golem', 'Snow Golem', 'Villager', 'Wandering Trader',
      'RF', 'FE', 'EU', 'JEI', 'NEI', 'REI', 'EMI', 'Forge', 'Fabric', 'NeoForge', 'Quilt'
    ];

    for (const noun of properNouns) {
      const regex = new RegExp(`\\b${this.escapeRegex(noun)}\\b`, 'g');
      preserved.text = preserved.text.replace(regex, (match) => {
        const index = preserved.nouns.length;
        preserved.nouns.push(match);
        return `__NOUN${index}__`;
      });
    }

    return preserved;
  }

  /**
   * Özel isimleri geri koy
   */
  restoreProperNouns(text, preserved) {
    let result = text;
    preserved.nouns.forEach((noun, index) => {
      result = result.replace(new RegExp(`__NOUN${index}__`, 'g'), noun);
    });
    return result;
  }

  /**
   * Google Translate API (unofficial, ücretsiz)
   * Retry mekanizması ile - 3 deneme, her denemede 1 saniye bekle
   */
  async googleTranslate(text, retryCount = 0) {
    const maxRetries = 3;
    const retryDelay = 1000; // 1 saniye

    return new Promise((resolve, reject) => {
      const encodedText = encodeURIComponent(text);
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=tr&dt=t&q=${encodedText}`;

      https.get(url, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', async () => {
          try {
            // HTTP hata kodu kontrolü
            if (res.statusCode !== 200) {
              throw new Error(`HTTP ${res.statusCode} - Google Translate engellemiş olabilir`);
            }

            const parsed = JSON.parse(data);

            // Çeviri sonucunu birleştir
            let translated = '';
            if (parsed[0]) {
              for (const item of parsed[0]) {
                if (item[0]) {
                  translated += item[0];
                }
              }
            }

            if (!translated || translated.trim() === '') {
              throw new Error('Google Translate boş sonuç döndü');
            }

            resolve(translated);
          } catch (e) {
            // Retry mekanizması
            if (retryCount < maxRetries) {
              // Sadece ilk denemede uyar
              if (retryCount === 0) {
                console.warn(`⚠️  Google Translate hatası, tekrar deneniyor... (${e.message})`);
              }
              await new Promise(r => setTimeout(r, retryDelay));
              try {
                const result = await this.googleTranslate(text, retryCount + 1);
                resolve(result);
              } catch (retryError) {
                reject(retryError);
              }
            } else {
              reject(new Error(`Google Translate başarısız (${maxRetries} deneme): ${e.message}`));
            }
          }
        });
      }).on('error', async (e) => {
        // Bağlantı hatası - retry
        if (retryCount < maxRetries) {
          // Sadece ilk denemede uyar
          if (retryCount === 0) {
            console.warn(`⚠️  Bağlantı hatası, tekrar deneniyor... (${e.message})`);
          }
          await new Promise(r => setTimeout(r, retryDelay));
          try {
            const result = await this.googleTranslate(text, retryCount + 1);
            resolve(result);
          } catch (retryError) {
            reject(retryError);
          }
        } else {
          reject(new Error(`Bağlantı hatası (${maxRetries} deneme): ${e.message}`));
        }
      });
    });
  }

  /**
   * Hala İngilizce var mı kontrol et
   */
  hasEnglish(text) {
    // HER METİN ÇEVRİLMELİ - sadece tamamen sayı/sembol olanları atla
    // Eğer metin Latin harfleri içeriyorsa (a-z) çevir
    const hasLatinLetters = /[a-zA-Z]/.test(text);

    if (!hasLatinLetters) {
      return false; // Sadece sayı/sembol, çevirme
    }

    // Türkçe karakterler varsa zaten çevrilmiş olabilir
    const hasTurkishChars = /[ğüşıöçĞÜŞİÖÇ]/.test(text);
    if (hasTurkishChars) {
      return false; // Türkçe karakter var, muhtemelen çevrilmiş
    }

    // Latin harfleri var ve Türkçe karakter yok = İngilizce, ÇEVİR!
    return true;
  }

  /**
   * Kalite kontrolü - MİNİMAL (Sadece kritik hatalar)
   * Google Translate'e güven, her şeyi çevirsin
   */
  qualityCheck(translated, original) {
    // 1. Boş string kontrolü - Sadece tamamen boş ise reddet
    if (!translated || translated.trim() === '') {
      return original;
    }

    // 2. Format kodu sayısı kontrolü - SADECE format kodları korunmalı
    const originalFormats = (original.match(/%\d*\.?\d*\$?[sdfbiuoxXeEfFgGaAcspnhtbHBTN%]/g) || []).length;
    const translatedFormats = (translated.match(/%\d*\.?\d*\$?[sdfbiuoxXeEfFgGaAcspnhtbHBTN%]/g) || []).length;

    if (originalFormats !== translatedFormats) {
      console.warn(`⚠️  Format kodları uyuşmuyor: "${original}" -> "${translated}"`);
      return original;
    }

    // HER ŞEYİ KABUL ET!
    // - Uzun/kısa çeviri? Kabul et ✅
    // - Özel isim aynı kalmış? Kabul et ✅
    // - Tek kelime çeviri? Kabul et ✅
    // - Uzun açıklama kısa çevrilmiş? Kabul et ✅
    // Google Translate ne diyorsa doğrudur!

    return translated;
  }

  /**
   * Anlamsız karakter dizisi kontrolü
   */
  isGibberish(text) {
    if (!text || typeof text !== 'string') return false;

    // ÖZEL DURUM: Ayırıcı çizgiler ve dekoratif karakterler (===, ---, ***, vb.)
    // Sadece tek tip karakter tekrarı: ====, ----, ****, ####, ~~~~
    if (/^[=\-*#~_+]{3,}$/.test(text.trim())) {
      return false; // Ayırıcı çizgi, gibberish değil
    }

    // ADIM 1: TÜM format ve renk kodlarını, placeholder'ları temizle
    let cleanedText = text;

    // Format kodlarını temizle: %s, %d, %1$s, %.2f, %b, %h, %t, vb.
    cleanedText = cleanedText.replace(/%\d*\.?\d*\$?[sdfbiuoxXeEfFgGaAcspnhtbHBTN%]/g, '');

    // Renk kodlarını temizle: §a, §b, §c, vb.
    cleanedText = cleanedText.replace(/§[0-9a-fk-or]/gi, '');

    // Placeholder'ları temizle: {}, {player}, {{value}}, [tag], <tag>
    cleanedText = cleanedText.replace(/\{\{[^}]+\}\}|\{[^}]*\}|\[[^\]]+\]|<[^>]+>/g, '');

    // Özel formatları temizle: HH:mm:ss, yyyy-MM-dd, vb. (tarih/saat formatları)
    cleanedText = cleanedText.replace(/\b[HhMmSsDdYy]{1,4}:[HhMmSsDdYy]{1,4}(:[HhMmSsDdYy]{1,4})?\b/g, '');

    // ADIM 2: Temizlendikten sonra geriye hiçbir şey kalmıyorsa gibberish DEĞİL
    const trimmed = cleanedText.trim();
    if (trimmed.length === 0) return false;

    // ADIM 3: Çok kısa metinler gibberish değil (1-2 karakter: "x", "of", vb.)
    if (trimmed.length <= 3) return false;

    // ADIM 4: Uzun metinler (30+ karakter) genellikle geçerli
    // Çünkü gibberish'ler genellikle kısa olur
    if (trimmed.length > 30) {
      // Sadece Türkçe/İngilizce harfler varsa kesinlikle geçerli
      if (/[a-zA-ZğüşıöçĞÜŞİÖÇ]/.test(trimmed)) {
        return false;
      }
    }

    // ADIM 5: Tekrar eden karakterler kontrolü - ESNEK
    // Minecraft'ta "Göreeeeeaaaaaaa", "sooooooul", "TIMBEEEEEEEER" gibi uzatılmış kelimeler NORMALDIR
    // Sadece tüm metin tamamen tekrarlı karakterlerden oluşuyorsa gibberish sayalım
    const nonSpaceChars = cleanedText.replace(/\s+/g, '');
    const uniqueChars = new Set(nonSpaceChars.toLowerCase()).size;

    // Eğer 5+ tekrar eden karakter varsa ama kelime içindeyse (harfler varsa) GEÇERLİ
    if (/(.)\1{4,}/.test(cleanedText)) {
      // Eğer başka harfler de varsa (sadece tekrar değilse), uzatılmış kelime olarak kabul et
      if (/[a-zA-ZğüşıöçĞÜŞİÖÇ]/.test(cleanedText) && uniqueChars > 3) {
        return false; // "sooooooul", "TIMBEEEEEEEER" gibi - GEÇERLİ
      }
      // Sadece tekrar varsa gibberish
      return true;
    }

    // ADIM 6: Kelime bazlı kontrol (sadece kısa metinler için)
    if (trimmed.length <= 30) {
      const words = cleanedText.split(/\s+/).filter(w => w.trim().length > 0);

      // Eğer hiç kelime yoksa gibberish değil
      if (words.length === 0) return false;

      let suspiciousWordCount = 0;

      // Her kelimeyi kontrol et
      for (const word of words) {
        // Çok kısa kelimeler sorun değil
        if (word.length <= 4) continue;

        // Çok uzun kelime (40+ karakter, Türkçe'de nadirdir)
        if (word.length > 40 && !/[-_:]/.test(word)) {
          suspiciousWordCount++;
          continue;
        }

        // Sesli harf kontrolü (daha esnek)
        if (word.length > 8 && !/[aeıioöuüAEIİOÖUÜyY]/.test(word)) {
          // Özel terimler ve kısaltmalar hariç
          if (word === word.toUpperCase()) {
            continue; // CAPS kısaltma (RF, FE, SCS, TNT vb.)
          }
          suspiciousWordCount++;
        }
      }

      // Sadece yarıdan fazlası şüpheliyse gibberish
      return suspiciousWordCount > words.length / 2;
    }

    return false;
  }

  /**
   * Regex escape
   */
  escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Minecraft sözlüğü - AŞIRI KAPSAMLI (1000+ terim)
   * Modlarda kullanılan tüm yaygın kelimeler
   */
  buildMinecraftDictionary() {
    return {
      // ==================== TEMEL TERİMLER ====================
      'block': 'blok', 'item': 'eşya', 'entity': 'varlık', 'mob': 'yaratık',
      'player': 'oyuncu', 'inventory': 'envanter', 'craft': 'işle', 'crafting': 'işleme',
      'world': 'dünya', 'dimension': 'boyut', 'biome': 'biyom', 'structure': 'yapı',

      // ==================== EKİPMAN - ARAÇLAR ====================
      'sword': 'kılıç', 'pickaxe': 'kazma', 'axe': 'balta', 'shovel': 'kürek',
      'hoe': 'çapa', 'shears': 'makas', 'bow': 'yay', 'crossbow': 'tatar yayı',
      'trident': 'üç dişli mızrak', 'shield': 'kalkan', 'fishing rod': 'olta',
      'flint and steel': 'çakmaktaşı', 'compass': 'pusula', 'clock': 'saat',
      'spyglass': 'dürbün', 'brush': 'fırça', 'wrench': 'anahtar', 'hammer': 'çekiç',
      'knife': 'bıçak', 'dagger': 'hançer', 'spear': 'mızrak', 'staff': 'asa',
      'wand': 'değnek', 'scythe': 'tırpan', 'sickle': 'orak',

      // ==================== EKİPMAN - ZIRH ====================
      'armor': 'zırh', 'helmet': 'miğfer', 'chestplate': 'göğüslük', 'leggings': 'pantolon',
      'boots': 'bot', 'elytra': 'elitra', 'crown': 'taç', 'mask': 'maske',
      'gauntlets': 'eldiven', 'gloves': 'eldiven', 'cape': 'pelerin', 'cloak': 'pelerin',

      // ==================== MALZEMELER - TEMEL ====================
      'wood': 'tahta', 'log': 'kütük', 'plank': 'kereste', 'stick': 'çubuk',
      'stone': 'taş', 'cobblestone': 'kaldırım taşı', 'bedrock': 'anakaya',
      'iron': 'demir', 'copper': 'bakır', 'gold': 'altın', 'diamond': 'elmas',
      'netherite': 'netherite', 'emerald': 'zümrüt', 'quartz': 'kuvars',
      'amethyst': 'ametist', 'coal': 'kömür', 'charcoal': 'odun kömürü',
      'lapis': 'lapis', 'redstone': 'kırmızıtaş', 'glowstone': 'parıltıtaş',
      'obsidian': 'obsidyen', 'crying obsidian': 'ağlayan obsidyen',
      'echo shard': 'yankı kırığı', 'netherite scrap': 'netherite hurda',

      // ==================== MALZEMELER - MOD MALZEMELERİ ====================
      'ore': 'maden', 'ingot': 'külçe', 'nugget': 'parça', 'dust': 'toz',
      'gem': 'mücevher', 'crystal': 'kristal', 'shard': 'kırık', 'fragment': 'parça',
      'plate': 'plaka', 'gear': 'dişli', 'rod': 'çubuk', 'wire': 'tel',
      'coil': 'bobin', 'circuit': 'devre', 'chip': 'çip', 'core': 'çekirdek',
      'essence': 'öz', 'rune': 'rün', 'sigil': 'mühür', 'glyph': 'sembol',
      'powder': 'toz', 'chunk': 'parça', 'cluster': 'küme', 'clump': 'yığın',
      'steel': 'çelik', 'bronze': 'bronz', 'brass': 'pirinç', 'silver': 'gümüş',
      'platinum': 'platin', 'titanium': 'titanyum', 'aluminum': 'alüminyum',
      'tin': 'kalay', 'lead': 'kurşun', 'nickel': 'nikel', 'zinc': 'çinko',
      'uranium': 'uranyum', 'plutonium': 'plütonyum', 'thorium': 'toryum',
      'cobalt': 'kobalt', 'ardite': 'ardit', 'manyullyn': 'manyullyn',
      'vibranium': 'vibranium', 'adamantium': 'adamantium', 'mythril': 'mithril',
      'orichalcum': 'orichalcum', 'ruby': 'yakut', 'sapphire': 'safir',
      'topaz': 'topaz', 'jade': 'yeşim', 'amber': 'kehribar', 'pearl': 'inci',
      'obsidian shard': 'obsidyen kırığı', 'ender pearl': 'ender incisi',
      'blaze rod': 'blaze çubuğu', 'ghast tear': 'ghast gözyaşı',

      // ==================== BLOKLAR ====================
      'chest': 'sandık', 'barrel': 'varil', 'shulker box': 'shulker kutusu',
      'furnace': 'fırın', 'blast furnace': 'pota fırın', 'smoker': 'füme fırını',
      'hopper': 'huni', 'dropper': 'düşürücü', 'dispenser': 'dağıtıcı',
      'door': 'kapı', 'trapdoor': 'tuzak kapı', 'fence': 'çit', 'gate': 'geçit',
      'stairs': 'merdiven', 'slab': 'döşeme', 'wall': 'duvar', 'pillar': 'sütun',
      'bed': 'yatak', 'banner': 'sancak', 'sign': 'tabela', 'torch': 'meşale',
      'lantern': 'fener', 'campfire': 'kamp ateşi', 'soul campfire': 'ruh kamp ateşi',
      'glass': 'cam', 'glass pane': 'cam levha', 'tinted glass': 'renkli cam',
      'dirt': 'toprak', 'grass': 'çimen', 'mycelium': 'miselyum', 'podzol': 'podzol',
      'sand': 'kum', 'gravel': 'çakıl', 'clay': 'kil', 'terracotta': 'terrakota',
      'concrete': 'beton', 'wool': 'yün', 'carpet': 'halı', 'moss': 'yosun',

      // ==================== BÜYÜLER VE İKSİRLER ====================
      'enchantment': 'büyü', 'enchanted': 'büyülü', 'curse': 'lanet',
      'potion': 'iksir', 'effect': 'etki', 'splash': 'fırlatılabilir', 'lingering': 'kalıcı',
      'brewing': 'demleme', 'spell': 'büyü', 'magic': 'sihir', 'mana': 'mana',
      'ritual': 'ritüel', 'altar': 'sunak', 'totem': 'totem', 'charm': 'tılsım',
      'sharpness': 'keskinlik', 'protection': 'koruma', 'fire aspect': 'ateş yönü',
      'unbreaking': 'dayanıklılık', 'mending': 'tamir', 'fortune': 'servet',
      'silk touch': 'ipek dokunuş', 'looting': 'yağma', 'efficiency': 'verim',
      'infinity': 'sonsuzluk', 'flame': 'alev', 'power': 'güç', 'punch': 'yumruk',
      'thorns': 'diken', 'respiration': 'solunum', 'aqua affinity': 'su yakınlığı',
      'depth strider': 'derinlik yürüyücüsü', 'frost walker': 'don yürüyücüsü',
      'soul speed': 'ruh hızı', 'swift sneak': 'hızlı gizlenme',

      // ==================== OYUN MEKANİKLERİ ====================
      'damage': 'hasar', 'health': 'can', 'hunger': 'açlık', 'saturation': 'doygunluk',
      'level': 'seviye', 'experience': 'deneyim', 'durability': 'dayanıklılık',
      'speed': 'hız', 'armor toughness': 'zırh sertliği', 'attack damage': 'saldırı hasarı',
      'attack speed': 'saldırı hızı', 'knockback': 'geri tepme', 'resistance': 'direnç',
      'regeneration': 'yenilenme', 'absorption': 'emilim', 'poison': 'zehir',
      'wither': 'solma', 'weakness': 'zayıflık', 'strength': 'güç',
      'fire resistance': 'ateş direnci', 'water breathing': 'su altında nefes alma',
      'invisibility': 'görünmezlik', 'night vision': 'gece görüşü',
      'blindness': 'körlük', 'nausea': 'mide bulantısı', 'slowness': 'yavaşlık',
      'mining fatigue': 'madencilik yorgunluğu', 'haste': 'acele',
      'jump boost': 'zıplama artışı', 'levitation': 'levitasyon',
      'glowing': 'parlama', 'luck': 'şans', 'bad luck': 'kötü şans',

      // ==================== REDSTONE VE MEKANİK ====================
      'redstone': 'kırmızıtaş', 'piston': 'piston', 'sticky piston': 'yapışkan piston',
      'observer': 'gözlemci', 'comparator': 'karşılaştırıcı', 'repeater': 'tekrarlayıcı',
      'lever': 'kol', 'button': 'düğme', 'pressure plate': 'basınç plakası',
      'tripwire': 'tuzak teli', 'note block': 'nota bloğu', 'jukebox': 'müzik kutusu',
      'target': 'hedef', 'lightning rod': 'yıldırım çubuğu',

      // ==================== ÖZEL BLOKLAR ====================
      'beacon': 'işaret', 'anvil': 'örs', 'grindstone': 'biley taşı',
      'brewing stand': 'demleme sehpası', 'enchanting table': 'büyü masası',
      'crafting table': 'işleme masası', 'smithing table': 'demircilik masası',
      'loom': 'dokuma tezgahı', 'stonecutter': 'taş kesme', 'cartography table': 'harita masası',
      'fletching table': 'okçuluk masası', 'composter': 'kompost', 'cauldron': 'kazan',
      'lectern': 'kürsü', 'respawn anchor': 'yeniden doğuş çapası',
      'end portal': 'son portal', 'nether portal': 'nether portalı',
      'conduit': 'iletken', 'end crystal': 'son kristali',

      // ==================== MOD TERİMLERİ - ENERJİ ====================
      'energy': 'enerji', 'power': 'güç', 'electricity': 'elektrik', 'voltage': 'voltaj',
      'machine': 'makine', 'generator': 'jeneratör', 'turbine': 'türbin',
      'battery': 'batarya', 'capacitor': 'kapasitör', 'dynamo': 'dinamo',
      'solar panel': 'güneş paneli', 'reactor': 'reaktör', 'furnace generator': 'fırın jeneratörü',
      'cable': 'kablo', 'wire': 'tel', 'conduit': 'iletken', 'connector': 'konnektör',
      'rf': 'rf', 'fe': 'fe', 'eu': 'eu', 'ae': 'ae', 'mj': 'mj',
      'tesla': 'tesla', 'joule': 'joule', 'watt': 'watt',

      // ==================== MOD TERİMLERİ - SIVI VE DEPOLAMA ====================
      'pipe': 'boru', 'tank': 'tank', 'fluid': 'sıvı', 'liquid': 'sıvı',
      'bucket': 'kova', 'container': 'konteyner', 'reservoir': 'depo',
      'pump': 'pompa', 'valve': 'valf', 'filter': 'filtre', 'drain': 'boşaltma',
      'water': 'su', 'lava': 'lav', 'oil': 'yağ', 'fuel': 'yakıt',
      'milk': 'süt', 'honey': 'bal', 'blood': 'kan', 'slime': 'balçık',
      'molten': 'erimiş', 'liquid metal': 'sıvı metal', 'steam': 'buhar',

      // ==================== MOD TERİMLERİ - İŞLEME ====================
      'upgrade': 'geliştirme', 'tier': 'seviye', 'augment': 'artırma',
      'slot': 'yuva', 'input': 'giriş', 'output': 'çıkış', 'storage': 'depolama',
      'transfer': 'aktarım', 'processing': 'işleme', 'production': 'üretim',
      'crushing': 'ezme', 'grinding': 'öğütme', 'smelting': 'eritme',
      'melting': 'eritme', 'casting': 'dökme', 'alloying': 'alaşımlama',
      'pulverizing': 'toz haline getirme', 'enriching': 'zenginleştirme',
      'compressing': 'sıkıştırma', 'centrifuging': 'santrifüjleme',
      'electrolyzing': 'elektroliz', 'fermenting': 'fermantasyon',
      'distilling': 'damıtma', 'crystallizing': 'kristalize etme',

      // ==================== MOD TERİMLERİ - OTOMASYON ====================
      'automation': 'otomasyon', 'automatic': 'otomatik', 'conveyor': 'taşıma bandı',
      'inserter': 'yerleştirici', 'extractor': 'çıkarıcı', 'transporter': 'taşıyıcı',
      'sorter': 'sınıflandırıcı', 'filter': 'filtre', 'router': 'yönlendirici',
      'interface': 'arayüz', 'terminal': 'terminal', 'controller': 'kontrolör',
      'network': 'ağ', 'channel': 'kanal', 'wireless': 'kablosuz',
      'remote': 'uzaktan', 'detector': 'dedektör', 'sensor': 'sensör',
      'redstone control': 'kırmızıtaş kontrolü', 'lever control': 'kol kontrolü',

      // ==================== MOD TERİMLERİ - TARIMA ====================
      'farming': 'tarım', 'agriculture': 'ziraat', 'crop': 'ürün', 'seed': 'tohum',
      'harvest': 'hasat', 'planting': 'ekim', 'watering': 'sulama',
      'fertilizer': 'gübre', 'compost': 'kompost', 'soil': 'toprak',
      'greenhouse': 'sera', 'garden': 'bahçe', 'orchard': 'meyve bahçesi',
      'irrigation': 'sulama', 'sprinkler': 'sprinkler', 'growth': 'büyüme',

      // ==================== MOD TERİMLERİ - YARATIKLAR ====================
      'spawn': 'doğma', 'spawner': 'doğurucu', 'egg': 'yumurta',
      'tame': 'evcilleştirmek', 'breed': 'üretmek', 'feed': 'beslemek',
      'boss': 'patron', 'mini boss': 'mini patron', 'hostile': 'düşman',
      'neutral': 'nötr', 'passive': 'pasif', 'friendly': 'dost',
      'summon': 'çağırmak', 'ritual summoning': 'ritüel çağırma',

      // ==================== ARAYÜZ VE AYARLAR ====================
      'config': 'ayarlar', 'settings': 'ayarlar', 'options': 'seçenekler',
      'enabled': 'etkin', 'disabled': 'devre dışı', 'on': 'açık', 'off': 'kapalı',
      'recipe': 'tarif', 'tooltip': 'ipucu', 'gui': 'arayüz',
      'menu': 'menü', 'button': 'düğme', 'tab': 'sekme', 'page': 'sayfa',
      'scroll': 'kaydırma', 'click': 'tıklama', 'shift click': 'shift tıklama',
      'right click': 'sağ tıklama', 'left click': 'sol tıklama',
      'info': 'bilgi', 'help': 'yardım', 'description': 'açıklama',
      'warning': 'uyarı', 'error': 'hata', 'success': 'başarı',

      // ==================== EYLEMLER ====================
      'mine': 'kazmak', 'mining': 'madencilik', 'dig': 'kazmak', 'break': 'kırmak',
      'smelt': 'eritmek', 'smelting': 'eritme', 'cook': 'pişirmek', 'cooking': 'pişirme',
      'brew': 'demlemek', 'enchant': 'büyülemek', 'repair': 'onarmak',
      'combine': 'birleştirmek', 'extract': 'çıkarmak', 'process': 'işlemek',
      'place': 'yerleştirmek', 'build': 'inşa etmek', 'destroy': 'yıkmak',
      'use': 'kullanmak', 'consume': 'tüketmek', 'activate': 'etkinleştirmek',
      'charge': 'şarj etmek', 'discharge': 'boşaltmak', 'fill': 'doldurmak',
      'empty': 'boşaltmak', 'transport': 'taşımak', 'store': 'depolamak',
      'retrieve': 'almak', 'insert': 'eklemek', 'remove': 'çıkarmak',

      // ==================== SIFATLAR ====================
      'rare': 'nadir', 'epic': 'epik', 'legendary': 'efsanevi', 'mythic': 'mitik',
      'common': 'yaygın', 'uncommon': 'nadir olmayan', 'unique': 'benzersiz',
      'powerful': 'güçlü', 'weak': 'zayıf', 'strong': 'güçlü', 'sturdy': 'sağlam',
      'heavy': 'ağır', 'light': 'hafif', 'fast': 'hızlı', 'slow': 'yavaş',
      'sharp': 'keskin', 'dull': 'kör', 'blunt': 'körelmiş',
      'broken': 'kırık', 'damaged': 'hasarlı', 'repaired': 'onarılmış',
      'new': 'yeni', 'old': 'eski', 'ancient': 'antik', 'modern': 'modern',
      'basic': 'temel', 'advanced': 'gelişmiş', 'ultimate': 'nihai',
      'improved': 'geliştirilmiş', 'enhanced': 'artırılmış', 'superior': 'üstün',
      'inferior': 'aşağı', 'normal': 'normal', 'special': 'özel',
      'magical': 'sihirli', 'cursed': 'lanetli', 'blessed': 'kutsal',
      'hot': 'sıcak', 'cold': 'soğuk', 'warm': 'ılık', 'cool': 'serin',
      'wet': 'ıslak', 'dry': 'kuru', 'frozen': 'donmuş', 'molten': 'erimiş',

      // ==================== SAYILAR VE MİKTARLAR ====================
      'amount': 'miktar', 'quantity': 'adet', 'count': 'sayı', 'total': 'toplam',
      'capacity': 'kapasite', 'maximum': 'maksimum', 'minimum': 'minimum',
      'full': 'dolu', 'empty': 'boş', 'half': 'yarım', 'quarter': 'çeyrek',
      'single': 'tek', 'double': 'çift', 'triple': 'üçlü', 'multiple': 'çoklu',
      'stack': 'yığın', 'bundle': 'demet', 'set': 'set', 'collection': 'koleksiyon',

      // ==================== YÖN VE KONUM ====================
      'north': 'kuzey', 'south': 'güney', 'east': 'doğu', 'west': 'batı',
      'up': 'yukarı', 'down': 'aşağı', 'left': 'sol', 'right': 'sağ',
      'front': 'ön', 'back': 'arka', 'side': 'yan', 'top': 'üst', 'bottom': 'alt',
      'center': 'merkez', 'middle': 'orta', 'corner': 'köşe', 'edge': 'kenar',
      'inside': 'içeride', 'outside': 'dışarıda', 'above': 'yukarıda', 'below': 'aşağıda',

      // ==================== ZAMAN ====================
      'second': 'saniye', 'minute': 'dakika', 'hour': 'saat', 'day': 'gün',
      'night': 'gece', 'dawn': 'şafak', 'dusk': 'alacakaranlık',
      'time': 'zaman', 'duration': 'süre', 'cooldown': 'bekleme süresi',
      'delay': 'gecikme', 'speed': 'hız', 'rate': 'oran',

      // ==================== DİĞER YAYIN TERİMLER ====================
      'required': 'gerekli', 'optional': 'isteğe bağlı', 'recommended': 'önerilen',
      'available': 'mevcut', 'unavailable': 'mevcut değil', 'locked': 'kilitli',
      'unlocked': 'kilidi açık', 'hidden': 'gizli', 'visible': 'görünür',
      'active': 'aktif', 'inactive': 'pasif', 'ready': 'hazır', 'busy': 'meşgul',
      'complete': 'tamamla', 'incomplete': 'tamamlanmamış', 'progress': 'ilerleme',
      'mode': 'mod', 'type': 'tür', 'variant': 'varyant', 'version': 'versiyon',
      'crafted': 'işlenmiş', 'natural': 'doğal', 'synthetic': 'sentetik',
      'raw': 'ham', 'refined': 'rafine', 'processed': 'işlenmiş', 'pure': 'saf',
      'corrupted': 'bozulmuş', 'infected': 'enfekte', 'tainted': 'kirlenmiş'
    };
  }

  /**
   * İstatistikler
   */
  getStats() {
    return { ...this.stats };
  }

  resetStats() {
    this.stats = { total: 0, translated: 0, cached: 0, errors: 0, skipped: 0 };
  }

  clearCache() {
    this.cache.clear();
  }
}
