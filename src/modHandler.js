/**
 * Minecraft Mod Handler
 * JAR dosyalarını okur ve dil dosyalarını işler
 *
 * © 2024-2025 Deokwave - Tüm Hakları Saklıdır
 * Bu dosya Deokwave'e aittir ve telif hakkı koruması altındadır.
 */

import AdmZip from 'adm-zip';
import fs from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

export class ModHandler {
  constructor() {
    this.supportedFormats = ['.jar', '.zip'];
    this.languagePaths = [
      'assets/*/lang/',                      // Standart mod konumu
      'data/*/lang/',                        // Bazı modlar data klasörü kullanır
      'assets/*/localization/',              // Alternatif isim
      'lang/',                               // Eski format
      'resources/assets/*/lang/',            // Bazı modpacks
      'data/*/patchouli_books/*/en_us/',     // Patchouli kitapları
      'data/*/patchouli_books/*/en_us/entries/',     // Patchouli giriş sayfaları
      'data/*/patchouli_books/*/en_us/categories/',  // Patchouli kategoriler
      'data/*/quests/',                      // Quest modları
      'assets/*/texts/',                     // Özel metin dosyaları
      'assets/*/books/',                     // Kitap dosyaları
      'data/*/advancements/',                // İlerlemeler
      'data/*/recipes/',                     // Tarifler (açıklamalar için)
    ];
  }

  /**
   * Mod dosyasını analiz et ve dil dosyalarını bul
   */
  async analyzeMod(modPath) {
    try {
      const modInfo = {
        path: modPath,
        name: path.basename(modPath, path.extname(modPath)),
        size: (await fs.stat(modPath)).size,
        languageFiles: [],
        modId: null,
        version: null,
        error: null
      };

      // JAR dosyasını aç
      const zip = new AdmZip(modPath);
      const zipEntries = zip.getEntries();

      // Mod bilgilerini bul (mcmod.info, mods.toml, fabric.mod.json)
      const modMeta = this.findModMetadata(zipEntries, zip);
      if (modMeta) {
        modInfo.modId = modMeta.modId;
        modInfo.version = modMeta.version;
        modInfo.name = modMeta.name || modInfo.name;
      }

      // Dil dosyalarını bul
      for (const entry of zipEntries) {
        if (this.isLanguageFile(entry.entryName)) {
          const langInfo = {
            path: entry.entryName,
            language: this.extractLanguageCode(entry.entryName),
            size: entry.header.size,
            content: null
          };

          // en_us.json dosyalarını oku
          if (langInfo.language === 'en_us') {
            try {
              langInfo.content = zip.readAsText(entry);
              // JSON geçerliliğini kontrol et
              JSON.parse(langInfo.content);
            } catch (e) {
              langInfo.error = `JSON parse hatası: ${e.message}`;
            }
          }

          modInfo.languageFiles.push(langInfo);
        }
      }

      return modInfo;
    } catch (error) {
      throw new Error(`Mod analiz hatası (${path.basename(modPath)}): ${error.message}`);
    }
  }

  /**
   * Mod metadata dosyasını bul ve parse et
   */
  findModMetadata(zipEntries, zip) {
    // Fabric mods (fabric.mod.json)
    const fabricMod = zipEntries.find(e => e.entryName === 'fabric.mod.json');
    if (fabricMod) {
      try {
        const data = JSON.parse(zip.readAsText(fabricMod));
        return {
          modId: data.id,
          name: data.name,
          version: data.version,
          loader: 'fabric'
        };
      } catch (e) {
        console.warn('fabric.mod.json parse hatası:', e.message);
      }
    }

    // Forge mods (mods.toml)
    const forgeMod = zipEntries.find(e => e.entryName === 'META-INF/mods.toml');
    if (forgeMod) {
      try {
        const content = zip.readAsText(forgeMod);
        return this.parseToml(content);
      } catch (e) {
        console.warn('mods.toml parse hatası:', e.message);
      }
    }

    // Eski Forge mods (mcmod.info)
    const mcmodInfo = zipEntries.find(e => e.entryName === 'mcmod.info');
    if (mcmodInfo) {
      try {
        const data = JSON.parse(zip.readAsText(mcmodInfo));
        const modData = Array.isArray(data) ? data[0] : data.modList?.[0] || data;
        return {
          modId: modData.modid,
          name: modData.name,
          version: modData.version,
          loader: 'forge'
        };
      } catch (e) {
        console.warn('mcmod.info parse hatası:', e.message);
      }
    }

    return null;
  }

  /**
   * Basit TOML parser (sadece temel bilgiler için)
   */
  parseToml(content) {
    const modIdMatch = content.match(/modId\s*=\s*"([^"]+)"/);
    const versionMatch = content.match(/version\s*=\s*"([^"]+)"/);
    const nameMatch = content.match(/displayName\s*=\s*"([^"]+)"/);

    return {
      modId: modIdMatch?.[1],
      version: versionMatch?.[1],
      name: nameMatch?.[1],
      loader: 'forge'
    };
  }

  /**
   * Dosya adından dil kodunu çıkar
   */
  extractLanguageCode(filePath) {
    const fileName = path.basename(filePath, '.json');
    return fileName.toLowerCase();
  }

  /**
   * Dosyanın çevrilmesi gereken JSON dosyası olup olmadığını kontrol et
   * EVRENSEL ÇÖZÜM: Tüm modlarda çalışır (Patchouli, Quest, JEI, vb.)
   */
  isLanguageFile(filePath) {
    if (!filePath.endsWith('.json')) return false;

    const normalized = filePath.toLowerCase();

    // ÇEVRİLMESİ GEREKEN DOSYALAR:
    // 1. Lang klasörleri (standart)
    if (normalized.includes('/lang/') || normalized.includes('/localization/')) {
      return true;
    }

    // 2. Patchouli kitapları
    if (normalized.includes('patchouli_books/') && normalized.includes('/en_us/')) {
      return true;
    }

    // 3. Quest dosyaları
    if (normalized.includes('/quests/') || normalized.includes('/questbook/')) {
      return true;
    }

    // 4. Advancement dosyaları (ilerleme açıklamaları)
    if (normalized.includes('/advancements/')) {
      return true;
    }

    // 5. Özel kitap/metin dosyaları
    if (normalized.includes('/books/') || normalized.includes('/texts/')) {
      return true;
    }

    // 6. JEI açıklamaları
    if (normalized.includes('/jei/') || normalized.includes('/descriptions/')) {
      return true;
    }

    // ÇEVRİLMEMESİ GEREKEN DOSYALAR (hariç tut):
    // - Tarifler (recipes) - sadece sayısal değerler
    // - Loot tables - oyun mekaniği
    // - Model/texture JSON'ları
    const excludePaths = [
      '/models/',
      '/blockstates/',
      '/loot_tables/',
      '/structures/',
      '/tags/',
      '/dimension/',
      '/worldgen/'
    ];

    for (const exclude of excludePaths) {
      if (normalized.includes(exclude)) {
        return false;
      }
    }

    return false;
  }

  /**
   * Moddan TÜM çevrilecek dosyaları çıkar (lang, Patchouli, quest, vb.)
   * EVRENSEL ÇÖZÜM: Tüm modlarda çalışır
   */
  async extractEnglishLang(modPath) {
    const zip = new AdmZip(modPath);
    const zipEntries = zip.getEntries();

    // TÜM çevrilecek JSON dosyalarını topla
    const allTranslatableFiles = [];

    for (const entry of zipEntries) {
      if (this.isLanguageFile(entry.entryName)) {
        try {
          const content = zip.readAsText(entry);

          // JSON geçerliliğini kontrol et
          JSON.parse(content);

          allTranslatableFiles.push({
            path: entry.entryName,
            content: content,
            type: this.getFileType(entry.entryName)
          });
        } catch (e) {
          // JSON parse hatası - atla
          console.warn(`⚠️  JSON parse hatası (${entry.entryName}): ${e.message}`);
        }
      }
    }

    if (allTranslatableFiles.length === 0) {
      throw new Error('Çevrilecek dosya bulunamadı');
    }

    // İlk dosyayı döndür (geriye uyumluluk için)
    // Gerçek çeviri işleminde tüm dosyalar kullanılacak
    return allTranslatableFiles[0];
  }

  /**
   * Dosya tipini belirle (lang, patchouli, quest, vb.)
   */
  getFileType(filePath) {
    const normalized = filePath.toLowerCase();

    if (normalized.includes('/lang/')) return 'lang';
    if (normalized.includes('patchouli_books/')) return 'patchouli';
    if (normalized.includes('/quests/')) return 'quest';
    if (normalized.includes('/advancements/')) return 'advancement';
    if (normalized.includes('/jei/')) return 'jei';
    if (normalized.includes('/books/')) return 'book';

    return 'unknown';
  }

  /**
   * Moddan TÜM çevrilecek dosyaları çıkar ve array olarak döndür
   * EVRENSEL ÇÖZÜM: Patchouli, Quest, JEI, Lang - hepsi
   */
  async extractAllTranslatableFiles(modPath) {
    const zip = new AdmZip(modPath);
    const zipEntries = zip.getEntries();

    const allFiles = [];

    for (const entry of zipEntries) {
      if (this.isLanguageFile(entry.entryName)) {
        try {
          const content = zip.readAsText(entry);
          JSON.parse(content); // Geçerlilik kontrolü

          allFiles.push({
            path: entry.entryName,
            content: content,
            type: this.getFileType(entry.entryName)
          });
        } catch (e) {
          // JSON hatalı - atla
        }
      }
    }

    return allFiles;
  }

  /**
   * Çevrilmiş dosyayı moda geri ekle (ESKİ - geriye uyumluluk için)
   */
  async injectTranslation(modPath, translatedContent, outputPath) {
    try {
      const zip = new AdmZip(modPath);
      const zipEntries = zip.getEntries();

      // en_us.json dosyasının yolunu bul
      let langFilePath = null;
      for (const entry of zipEntries) {
        if (this.isLanguageFile(entry.entryName)) {
          const langCode = this.extractLanguageCode(entry.entryName);
          if (langCode === 'en_us') {
            langFilePath = entry.entryName;
            break;
          }
        }
      }

      if (!langFilePath) {
        throw new Error('en_us.json dosyası bulunamadı');
      }

      // tr_tr.json yolunu oluştur
      const trPath = langFilePath.replace('en_us.json', 'tr_tr.json');

      // tr_tr.json dosyasını ekle veya güncelle
      zip.deleteFile(trPath); // Varsa önce sil
      zip.addFile(trPath, Buffer.from(translatedContent, 'utf8'));

      // Yeni JAR dosyasını kaydet
      zip.writeZip(outputPath);

      return {
        success: true,
        outputPath,
        translatedFilePath: trPath
      };
    } catch (error) {
      throw new Error(`Çeviri enjekte hatası: ${error.message}`);
    }
  }

  /**
   * TÜM çevrilmiş dosyaları moda ekle (EVRENSEL ÇÖZÜM)
   * Patchouli, Quest, JEI, Lang - hepsini ekler
   */
  async injectAllTranslations(modPath, translatedFiles, outputPath) {
    try {
      const zip = new AdmZip(modPath);

      let addedCount = 0;

      for (const file of translatedFiles) {
        // Türkçe dosya yolu oluştur
        let trPath = file.path;

        // en_us.json → tr_tr.json
        if (trPath.includes('en_us.json')) {
          trPath = trPath.replace('en_us.json', 'tr_tr.json');
        }
        // /en_us/ klasörü → /tr_tr/ (Patchouli için)
        else if (trPath.includes('/en_us/')) {
          trPath = trPath.replace('/en_us/', '/tr_tr/');
        }

        // Varsa önce sil
        zip.deleteFile(trPath);

        // Yeni dosyayı ekle
        zip.addFile(trPath, Buffer.from(file.content, 'utf8'));
        addedCount++;
      }

      // Yeni JAR dosyasını kaydet
      zip.writeZip(outputPath);

      return {
        success: true,
        outputPath,
        filesAdded: addedCount
      };
    } catch (error) {
      throw new Error(`Çeviri enjekte hatası: ${error.message}`);
    }
  }

  /**
   * Modpack klasöründeki tüm modları bul
   */
  async findModsInDirectory(dirPath, recursive = true) {
    const mods = [];

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (this.supportedFormats.includes(ext)) {
            mods.push(fullPath);
          }
        } else if (entry.isDirectory() && recursive) {
          // Alt klasörleri de tara
          const subMods = await this.findModsInDirectory(fullPath, recursive);
          mods.push(...subMods);
        }
      }
    } catch (error) {
      throw new Error(`Klasör tarama hatası: ${error.message}`);
    }

    return mods;
  }

  /**
   * Mod bilgilerini özet olarak döndür
   */
  async getModSummary(modPath) {
    const info = await this.analyzeMod(modPath);

    const enLang = info.languageFiles.find(l => l.language === 'en_us');
    const trLang = info.languageFiles.find(l => l.language === 'tr_tr');

    let keyCount = 0;
    if (enLang?.content) {
      try {
        keyCount = Object.keys(JSON.parse(enLang.content)).length;
      } catch (e) {
        // Ignore
      }
    }

    return {
      name: info.name,
      modId: info.modId,
      version: info.version,
      hasEnglish: !!enLang,
      hasTurkish: !!trLang,
      translationKeyCount: keyCount,
      size: this.formatFileSize(info.size)
    };
  }

  /**
   * Dosya boyutunu okunabilir formata çevir
   */
  formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }

  /**
   * Dosya/klasör var mı kontrol et
   */
  async exists(filePath) {
    return existsSync(filePath);
  }

  /**
   * Dosya mı klasör mü kontrol et
   */
  async isDirectory(filePath) {
    try {
      const stats = await fs.stat(filePath);
      return stats.isDirectory();
    } catch (error) {
      return false;
    }
  }
}
