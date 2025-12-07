/**
 * Configuration Manager
 * Kullanıcı ayarlarını saklar
 *
 * © 2024-2025 Deokwave - Tüm Hakları Saklıdır
 * Bu dosya Deokwave'e aittir ve telif hakkı koruması altındadır.
 */

import Conf from 'conf';

export class ConfigManager {
  constructor() {
    this.config = new Conf({
      projectName: 'minecraft-mod-translator',
      defaults: {
        translationMode: 'ai',
        concurrentJobs: 3,
        apiKey: null,
        outputDirectory: './translated',
        skipExisting: true,
        createBackup: true,
        language: {
          source: 'en_us',
          target: 'tr_tr'
        },
        cache: {
          enabled: true,
          ttl: 7 * 24 * 60 * 60 * 1000 // 7 days
        }
      }
    });
  }

  /**
   * Ayarı al
   */
  get(key) {
    return this.config.get(key);
  }

  /**
   * Ayarı kaydet
   */
  set(key, value) {
    this.config.set(key, value);
  }

  /**
   * Tüm ayarları al
   */
  getAll() {
    return this.config.store;
  }

  /**
   * Ayarı sil
   */
  delete(key) {
    this.config.delete(key);
  }

  /**
   * Tüm ayarları sıfırla
   */
  clear() {
    this.config.clear();
  }

  /**
   * Ayar var mı kontrol et
   */
  has(key) {
    return this.config.has(key);
  }
}
