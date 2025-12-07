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
      'assets/*/lang/',           // Standart mod konumu
      'data/*/lang/',             // Bazı modlar data klasörü kullanır
      'assets/*/localization/',   // Alternatif isim
      'lang/',                    // Eski format
      'resources/assets/*/lang/'  // Bazı modpacks
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
   * Dosyanın dil dosyası olup olmadığını kontrol et
   */
  isLanguageFile(filePath) {
    if (!filePath.endsWith('.json')) return false;

    const normalized = filePath.toLowerCase();

    // Lang klasörü içinde mi?
    if (normalized.includes('/lang/') || normalized.includes('/localization/')) {
      return true;
    }

    return false;
  }

  /**
   * Moddan İngilizce dil dosyasını çıkar
   */
  async extractEnglishLang(modPath) {
    const zip = new AdmZip(modPath);
    const zipEntries = zip.getEntries();

    for (const entry of zipEntries) {
      if (this.isLanguageFile(entry.entryName)) {
        const langCode = this.extractLanguageCode(entry.entryName);
        if (langCode === 'en_us') {
          return {
            path: entry.entryName,
            content: zip.readAsText(entry)
          };
        }
      }
    }

    throw new Error('en_us.json dosyası bulunamadı');
  }

  /**
   * Çevrilmiş dosyayı moda geri ekle
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
