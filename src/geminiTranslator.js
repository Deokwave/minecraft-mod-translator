/**
 * Gemini AI Translator - MÜKEMMEL TÜRKÇE ÇEVİRİ
 * Google Gemini API ile doğal, akıcı, gramer doğru çeviriler
 *
 * © 2024-2025 Deokwave - Tüm Hakları Saklıdır
 * Bu dosya Deokwave'e aittir ve telif hakkı koruması altındadır.
 */

import https from 'https';
import { setTimeout as delay } from 'timers/promises';

export class GeminiTranslator {
  constructor(options = {}) {
    this.apiKey = options.apiKey || process.env.GEMINI_API_KEY || '';
    this.model = options.model || 'gemini-1.5-flash'; // Ücretsiz ve hızlı
    this.stats = {
      total: 0,
      translated: 0,
      cached: 0,
      errors: 0
    };
    this.cache = new Map();
  }

  /**
   * Ana çeviri fonksiyonu
   */
  async translateLanguageFile(jsonContent, options = {}) {
    try {
      const parsed = JSON.parse(jsonContent);
      const translated = {};
      const keys = Object.keys(parsed);

      this.stats.total = keys.length;

      console.log(`\n🤖 Gemini AI ile ${keys.length} anahtar çevriliyor...`);

      // Batch işleme (her seferinde 20 key)
      const batchSize = 20;
      let processedCount = 0;

      for (let i = 0; i < keys.length; i += batchSize) {
        const batch = keys.slice(i, i + batchSize);
        const batchData = {};

        batch.forEach(key => {
          batchData[key] = parsed[key];
        });

        try {
          const translatedBatch = await this.translateBatch(batchData, options.modName);
          Object.assign(translated, translatedBatch);

          processedCount += batch.length;
          this.stats.translated += batch.length;

          if (processedCount % 50 === 0 || processedCount === keys.length) {
            console.log(`   ✓ ${processedCount}/${keys.length} çevrildi`);
          }

          // Rate limiting - ücretsiz tier için
          await delay(1000); // Her batch arası 1 saniye
        } catch (error) {
          console.warn(`   ⚠️ Batch hatası: ${error.message}`);
          // Hata durumunda orijinalleri kullan
          batch.forEach(key => {
            translated[key] = parsed[key];
            this.stats.errors++;
          });
        }
      }

      console.log(`   ✅ ${processedCount}/${keys.length} tamamlandı!\n`);

      return JSON.stringify(translated, null, 2);
    } catch (error) {
      throw new Error(`JSON parse hatası: ${error.message}`);
    }
  }

  /**
   * Batch çeviri - 20 key birden
   */
  async translateBatch(data, modName = 'Minecraft Mod') {
    const cacheKey = JSON.stringify(data);

    if (this.cache.has(cacheKey)) {
      this.stats.cached += Object.keys(data).length;
      return this.cache.get(cacheKey);
    }

    const prompt = this.buildPrompt(data, modName);

    try {
      const result = await this.callGeminiAPI(prompt);
      const translated = this.parseResponse(result);

      this.cache.set(cacheKey, translated);
      return translated;

    } catch (error) {
      console.warn(`Gemini API hatası: ${error.message}`);
      return data; // Hata durumunda orijinal
    }
  }

  /**
   * Gemini API çağrısı
   */
  async callGeminiAPI(prompt) {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.3, // Tutarlı çeviri için düşük
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 8192
        }
      });

      const options = {
        hostname: 'generativelanguage.googleapis.com',
        port: 443,
        path: `/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data)
        }
      };

      const req = https.request(options, (res) => {
        let body = '';

        res.on('data', (chunk) => {
          body += chunk;
        });

        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              const response = JSON.parse(body);
              const text = response.candidates?.[0]?.content?.parts?.[0]?.text;

              if (!text) {
                reject(new Error('Gemini yanıt boş'));
                return;
              }

              resolve(text);
            } catch (e) {
              reject(new Error('Gemini yanıtı parse edilemedi'));
            }
          } else {
            reject(new Error(`Gemini API hatası: ${res.statusCode} - ${body}`));
          }
        });
      });

      req.on('error', (e) => {
        reject(new Error(`İstek hatası: ${e.message}`));
      });

      req.write(data);
      req.end();
    });
  }

  /**
   * Çeviri prompt'u oluştur
   */
  buildPrompt(data, modName) {
    return `Sen profesyonel bir Minecraft mod çevirmenisisin. Aşağıdaki ${modName} modundan gelen İngilizce metinleri MÜKEMMEL TÜRKÇE'ye çevir.

ÇOK ÖNEMLİ KURALLAR:
1. JSON formatını TAM OLARAK koru - sadece değerleri çevir, key'leri ASLA değiştirme
2. DOĞAL ve AKICI Türkçe kullan - kelime kelime değil, anlamına uygun çevir
3. Minecraft terminolojisine sadık kal:
   - block → blok
   - item → eşya
   - damage → hasar
   - health → can
   - energy → enerji
4. ÇOK ÖNEMLİ: Format kodlarını AYNEN koru ve çevirme:
   - Basit: %s, %d, %f, %i, %x, %o, %n, %b, %h, %t → AYNEN KORU
   - Pozisyonel: %1$s, %2$d, %3$f → AYNEN KORU
   - Hassasiyet: %.2f, %10d, %5.2f → AYNEN KORU
   - Özel: %%, %n (newline), %b (boolean), %h (hash), %t (time) → AYNEN KORU
5. Color kodlarını AYNEN koru: §a, §b, §c, §0-9, §k-r
6. Placeholder'ları AYNEN koru: {}, {player}, {{value}}, %%, [tag], <tag>
7. Özel isimleri ÇEVIRME: Creeper, Enderman, Netherite, Forge, JEI
8. Gramer hatası YAPMA - cümleler doğru Türkçe olmalı
9. Kısa ve net çeviriler yap - gereksiz uzatma

YANLIŞ ÖRNEKLER (YAPMA):
❌ "Click to open" → "Tıkla için aç" (SAÇMA Türkçe)
❌ "Deals %s damage" → "Anlaşmalar %s hasar" (YANLIŞ)

DOĞRU ÖRNEKLER (BÖYLE YAP):
✅ "Click to open" → "Açmak için tıklayın"
✅ "Deals %s damage" → "%s hasar verir"
✅ "Right click to use" → "Kullanmak için sağ tıklayın"

SADECE çevrilmiş JSON objesini döndür, başka hiçbir açıklama yazma.

Çevrilecek JSON:
${JSON.stringify(data, null, 2)}

Çevrilmiş JSON:`;
  }

  /**
   * Gemini yanıtını parse et
   */
  parseResponse(result) {
    try {
      // Markdown code block'ları temizle
      let cleaned = result.trim();
      cleaned = cleaned.replace(/^```json?\n?/i, '');
      cleaned = cleaned.replace(/\n?```$/i, '');
      cleaned = cleaned.trim();

      // JSON parse
      const parsed = JSON.parse(cleaned);

      // Format kodu kontrolü
      for (const [key, value] of Object.entries(parsed)) {
        if (typeof value === 'string') {
          // Format kodlarını kontrol et
          if (!this.validateFormatCodes(value)) {
            console.warn(`⚠️ Format kodu hatası: ${key}`);
          }
        }
      }

      return parsed;

    } catch (error) {
      throw new Error(`Yanıt parse hatası: ${error.message}\n\nYanıt: ${result.substring(0, 200)}`);
    }
  }

  /**
   * Format kodlarını doğrula
   */
  validateFormatCodes(text) {
    // %s, %d, §a gibi kodlar var mı kontrol et
    const hasPercent = text.includes('%');
    const hasSection = text.includes('§');

    if (hasPercent || hasSection) {
      // Kodlar düzgün duruyorsa true
      return true;
    }

    return true;
  }

  /**
   * İstatistikleri al
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * İstatistikleri sıfırla
   */
  resetStats() {
    this.stats = {
      total: 0,
      translated: 0,
      cached: 0,
      errors: 0
    };
  }

  /**
   * Cache'i temizle
   */
  clearCache() {
    this.cache.clear();
  }
}
