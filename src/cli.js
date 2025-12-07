#!/usr/bin/env node

/**
 * Minecraft Mod Translator - CLI Interface
 * Kullanıcı dostu komut satırı arayüzü
 *
 * © 2024-2025 Deokwave - Tüm Hakları Saklıdır
 * Bu dosya Deokwave'e aittir ve telif hakkı koruması altındadır.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs/promises';
import path from 'path';
import { ModHandler } from './modHandler.js';
import { TranslationEngine, SimpleTranslator } from './translator.js';
import { AdvancedTranslator } from './advancedTranslator.js';
import { GeminiTranslator } from './geminiTranslator.js';
import { ConfigManager } from './config.js';
import pLimit from 'p-limit';

const program = new Command();
const config = new ConfigManager();

// ASCII Art Banner
const banner = `
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🎮  Minecraft Mod Türkçe Çeviri Aracı  🇹🇷              ║
║                                                           ║
║   Minecraft modlarınızı profesyonel şekilde              ║
║   Türkçe'ye çevirin!                                      ║
║                                                           ║
║   © 2024-2025 Deokwave - Tüm Hakları Saklıdır           ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`;

program
  .name('mc-translate')
  .description('Minecraft modlarını ve modpacklerini Türkçe\'ye çevir')
  .version('1.0.0');

/**
 * Tek mod çeviri komutu
 */
program
  .command('translate <modFile>')
  .description('Tek bir mod dosyasını çevirir')
  .option('-o, --output <path>', 'Çıktı dosya yolu (varsayılan: orijinal_dosya_tr.jar)')
  .option('-m, --mode <mode>', 'Çeviri modu: gemini|ai|advanced|simple (varsayılan: gemini)', 'gemini')
  .option('--api-key <key>', 'Claude API anahtarı (ortam değişkeninden okunur)')
  .option('--no-backup', 'Orijinal dosyayı yedekleme')
  .action(async (modFile, options) => {
    console.log(chalk.cyan(banner));

    const spinner = ora('Mod dosyası analiz ediliyor...').start();

    try {
      const modHandler = new ModHandler();

      // Dosya kontrolü
      if (!(await modHandler.exists(modFile))) {
        spinner.fail(chalk.red('Hata: Mod dosyası bulunamadı!'));
        process.exit(1);
      }

      // Mod bilgilerini al
      const modInfo = await modHandler.analyzeMod(modFile);
      spinner.succeed(chalk.green('Mod analiz edildi'));

      // Mod bilgilerini göster
      console.log(chalk.yellow('\n📦 Mod Bilgileri:'));
      console.log(chalk.white(`   Dosya: ${modInfo.name}`));
      console.log(chalk.white(`   Mod ID: ${modInfo.modId || 'Bilinmiyor'}`));
      console.log(chalk.white(`   Versiyon: ${modInfo.version || 'Bilinmiyor'}`));
      console.log(chalk.white(`   Boyut: ${modHandler.formatFileSize(modInfo.size)}`));
      console.log(chalk.white(`   Dil dosyaları: ${modInfo.languageFiles.length}`));

      // İngilizce dil dosyası kontrolü
      const enLang = modInfo.languageFiles.find(l => l.language === 'en_us');
      if (!enLang) {
        console.log(chalk.red('\n❌ Hata: en_us.json dosyası bulunamadı!'));
        process.exit(1);
      }

      // Türkçe zaten var mı?
      const trLang = modInfo.languageFiles.find(l => l.language === 'tr_tr');
      if (trLang) {
        console.log(chalk.yellow('\n⚠️  Bu mod zaten Türkçe dil dosyasına sahip!'));
      }

      // Çeviri anahtarı sayısı
      let keyCount = 0;
      try {
        const parsed = JSON.parse(enLang.content);
        keyCount = Object.keys(parsed).length;
        console.log(chalk.white(`   Çevrilecek anahtar: ${keyCount}`));
      } catch (e) {
        // JSON bozuk veya boş - sessizce atla
        console.log(chalk.yellow(`\n⚠️  JSON dosyası bozuk veya boş - atlanıyor`));
        console.log(chalk.gray(`   Hata: ${e.message}\n`));
        process.exit(0); // Hata vermeden çık
      }

      // Çeviri işlemi
      spinner.start('Çeviri yapılıyor...');

      let translator;
      if (options.mode === 'gemini') {
        translator = new GeminiTranslator();
        console.log(chalk.green('\n🤖 Gemini AI çeviri modu (MÜKEMMEL TÜRKÇE - ÜCRETSİZ)'));
      } else if (options.mode === 'ai') {
        const apiKey = options.apiKey || process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
          spinner.fail(chalk.red('Hata: ANTHROPIC_API_KEY ortam değişkeni ayarlanmamış!'));
          console.log(chalk.yellow('\n💡 İpucu: --mode gemini ile ücretsiz AI çeviri kullanın\n'));
          process.exit(1);
        }
        translator = new TranslationEngine({ apiKey });
      } else if (options.mode === 'advanced') {
        translator = new AdvancedTranslator({ useGoogle: true });
        console.log(chalk.green('\n✨ Gelişmiş çeviri modu (Sözlük + Google Translate)'));
      } else {
        translator = new SimpleTranslator();
        console.log(chalk.yellow('\n⚠️  Basit çeviri modu kullanılıyor (sınırlı kalite)'));
      }

      const translatedContent = await translator.translateLanguageFile(
        enLang.content,
        { modName: modInfo.name }
      );

      spinner.succeed(chalk.green('Çeviri tamamlandı'));

      // İstatistikleri göster
      if (translator.getStats) {
        const stats = translator.getStats();
        console.log(chalk.cyan('\n📊 Çeviri İstatistikleri:'));
        console.log(chalk.white(`   Toplam: ${stats.total}`));
        console.log(chalk.white(`   Çevrildi: ${stats.translated}`));
        console.log(chalk.white(`   Cache'den: ${stats.cached}`));
        if (stats.errors > 0) {
          console.log(chalk.yellow(`   Hatalar: ${stats.errors}`));
        }
      }

      // Çıktı dosya yolu
      const outputPath = options.output || modFile.replace(/\.jar$/i, '_tr.jar');

      // Çeviriyi JAR'a ekle
      spinner.start('Çeviri mod dosyasına ekleniyor...');
      await modHandler.injectTranslation(modFile, translatedContent, outputPath);
      spinner.succeed(chalk.green('Çeviri başarıyla eklendi'));

      console.log(chalk.green(`\n✅ Başarılı! Çevrilmiş mod: ${path.basename(outputPath)}`));
      console.log(chalk.cyan(`   Dosya yolu: ${outputPath}\n`));

    } catch (error) {
      spinner.fail(chalk.red('Hata oluştu'));
      console.error(chalk.red(`\n❌ ${error.message}\n`));
      if (process.env.DEBUG) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  });

/**
 * Toplu çeviri komutu (modpack için)
 */
program
  .command('batch <directory>')
  .description('Bir klasördeki tüm modları toplu olarak çevirir')
  .option('-o, --output <path>', 'Çıktı klasörü (varsayılan: ./translated)')
  .option('-m, --mode <mode>', 'Çeviri modu: gemini|ai|advanced|simple (varsayılan: gemini)', 'gemini')
  .option('-c, --concurrent <number>', 'Aynı anda çevrilecek mod sayısı (varsayılan: 3)', '3')
  .option('--api-key <key>', 'Claude API anahtarı')
  .option('--skip-existing', 'Zaten Türkçe olan modları atla')
  .action(async (directory, options) => {
    console.log(chalk.cyan(banner));

    const spinner = ora('Modlar taranıyor...').start();

    try {
      const modHandler = new ModHandler();

      // Klasör kontrolü
      if (!(await modHandler.exists(directory))) {
        spinner.fail(chalk.red('Hata: Klasör bulunamadı!'));
        process.exit(1);
      }

      if (!(await modHandler.isDirectory(directory))) {
        spinner.fail(chalk.red('Hata: Belirtilen yol bir klasör değil!'));
        process.exit(1);
      }

      // Modları bul
      const modFiles = await modHandler.findModsInDirectory(directory);
      spinner.succeed(chalk.green(`${modFiles.length} mod bulundu`));

      if (modFiles.length === 0) {
        console.log(chalk.yellow('\n⚠️  Klasörde hiç mod dosyası bulunamadı!\n'));
        process.exit(0);
      }

      // Çıktı klasörünü oluştur
      const outputDir = options.output || path.join(process.cwd(), 'translated');
      await fs.mkdir(outputDir, { recursive: true });

      console.log(chalk.cyan(`\n📁 Çıktı klasörü: ${outputDir}\n`));

      // Çeviri motorunu hazırla
      let translator;
      if (options.mode === 'gemini') {
        translator = new GeminiTranslator();
        console.log(chalk.green('🤖 Gemini AI çeviri modu\n'));
        console.log(chalk.cyan('✨ MÜKEMMEL TÜRKÇE - DOĞAL CÜMLELER - ÜCRETSİZ!\n'));
      } else if (options.mode === 'ai') {
        const apiKey = options.apiKey || process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
          console.log(chalk.red('❌ Hata: ANTHROPIC_API_KEY ortam değişkeni ayarlanmamış!'));
          console.log(chalk.yellow('\n💡 İpucu: --mode gemini ile ücretsiz AI çeviri kullanın\n'));
          process.exit(1);
        }
        translator = new TranslationEngine({ apiKey });
      } else if (options.mode === 'advanced') {
        translator = new AdvancedTranslator({ useGoogle: true });
        console.log(chalk.green('✨ Gelişmiş çeviri modu (Sözlük + Google Translate)\n'));
      } else {
        translator = new SimpleTranslator();
        console.log(chalk.yellow('⚠️  Basit çeviri modu kullanılıyor (sınırlı kalite)\n'));
      }

      // İstatistikler
      const stats = {
        total: modFiles.length,
        success: 0,
        skipped: 0,
        failed: 0,
        errors: []
      };

      // Paralel işleme için limit
      const limit = pLimit(parseInt(options.concurrent));

      // Her mod için çeviri görevi oluştur
      const tasks = modFiles.map((modFile, index) =>
        limit(async () => {
          const modName = path.basename(modFile);
          const currentSpinner = ora(`[${index + 1}/${modFiles.length}] ${modName}`).start();

          try {
            // Mod analizi
            const modInfo = await modHandler.analyzeMod(modFile);

            // İngilizce dil dosyası var mı?
            const enLang = modInfo.languageFiles.find(l => l.language === 'en_us');
            if (!enLang) {
              currentSpinner.warn(chalk.yellow(`${modName} - İngilizce dil dosyası yok`));
              stats.skipped++;
              return;
            }

            // JSON bozuk mu?
            if (enLang.error) {
              currentSpinner.warn(chalk.yellow(`${modName} - JSON bozuk/boş`));
              stats.skipped++;
              return;
            }

            // Türkçe zaten var mı?
            if (options.skipExisting) {
              const trLang = modInfo.languageFiles.find(l => l.language === 'tr_tr');
              if (trLang) {
                currentSpinner.info(chalk.blue(`${modName} - Zaten Türkçe var`));
                stats.skipped++;
                return;
              }
            }

            // Çeviri
            const translatedContent = await translator.translateLanguageFile(
              enLang.content,
              { modName: modInfo.name }
            );

            // Kaydet
            const outputPath = path.join(outputDir, modName);
            await modHandler.injectTranslation(modFile, translatedContent, outputPath);

            currentSpinner.succeed(chalk.green(`${modName} ✓`));
            stats.success++;

          } catch (error) {
            currentSpinner.fail(chalk.red(`${modName} ✗`));
            stats.failed++;
            stats.errors.push({ mod: modName, error: error.message });
          }
        })
      );

      // Tüm görevleri çalıştır
      await Promise.all(tasks);

      // Özet rapor
      console.log(chalk.cyan('\n' + '='.repeat(60)));
      console.log(chalk.cyan.bold('📊 TOPLU ÇEVİRİ RAPORU'));
      console.log(chalk.cyan('='.repeat(60)));
      console.log(chalk.white(`Toplam mod: ${stats.total}`));
      console.log(chalk.green(`✓ Başarılı: ${stats.success}`));
      console.log(chalk.yellow(`⊘ Atlanan: ${stats.skipped}`));
      console.log(chalk.red(`✗ Başarısız: ${stats.failed}`));

      if (stats.errors.length > 0) {
        console.log(chalk.red('\n❌ Hatalar:'));
        stats.errors.forEach(({ mod, error }) => {
          console.log(chalk.red(`   • ${mod}: ${error}`));
        });
      }

      if (translator.getStats) {
        const translatorStats = translator.getStats();
        console.log(chalk.cyan('\n📈 Çeviri Detayları:'));
        console.log(chalk.white(`   Toplam anahtar: ${translatorStats.total}`));
        console.log(chalk.white(`   Çevrildi: ${translatorStats.translated}`));
        console.log(chalk.white(`   Cache: ${translatorStats.cached}`));
      }

      console.log(chalk.cyan('\n' + '='.repeat(60) + '\n'));

      if (stats.success > 0) {
        console.log(chalk.green(`✅ ${stats.success} mod başarıyla çevrildi!`));
        console.log(chalk.cyan(`📁 Çevrilmiş modlar: ${outputDir}\n`));
      }

    } catch (error) {
      spinner.fail(chalk.red('Hata oluştu'));
      console.error(chalk.red(`\n❌ ${error.message}\n`));
      if (process.env.DEBUG) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  });

/**
 * Mod bilgisi göster
 */
program
  .command('info <modFile>')
  .description('Mod hakkında detaylı bilgi gösterir')
  .action(async (modFile) => {
    const spinner = ora('Mod analiz ediliyor...').start();

    try {
      const modHandler = new ModHandler();

      if (!(await modHandler.exists(modFile))) {
        spinner.fail(chalk.red('Hata: Mod dosyası bulunamadı!'));
        process.exit(1);
      }

      const modInfo = await modHandler.analyzeMod(modFile);
      spinner.succeed(chalk.green('Analiz tamamlandı'));

      console.log(chalk.cyan('\n' + '='.repeat(60)));
      console.log(chalk.cyan.bold('📦 MOD BİLGİLERİ'));
      console.log(chalk.cyan('='.repeat(60)));

      console.log(chalk.yellow('\nGenel Bilgiler:'));
      console.log(chalk.white(`  Dosya adı: ${modInfo.name}`));
      console.log(chalk.white(`  Mod ID: ${modInfo.modId || 'Bilinmiyor'}`));
      console.log(chalk.white(`  Versiyon: ${modInfo.version || 'Bilinmiyor'}`));
      console.log(chalk.white(`  Boyut: ${modHandler.formatFileSize(modInfo.size)}`));

      console.log(chalk.yellow('\nDil Dosyaları:'));
      if (modInfo.languageFiles.length === 0) {
        console.log(chalk.red('  Dil dosyası bulunamadı!'));
      } else {
        modInfo.languageFiles.forEach(lang => {
          const icon = lang.language === 'en_us' ? '🇺🇸' :
                       lang.language === 'tr_tr' ? '🇹🇷' : '🌍';
          let status = `${icon} ${lang.language}`;

          if (lang.content) {
            try {
              const keys = Object.keys(JSON.parse(lang.content)).length;
              status += ` (${keys} anahtar)`;
            } catch (e) {
              status += chalk.red(' (hatalı JSON)');
            }
          }

          console.log(chalk.white(`  ${status}`));
        });
      }

      // Çeviri durumu
      const hasEn = modInfo.languageFiles.some(l => l.language === 'en_us');
      const hasTr = modInfo.languageFiles.some(l => l.language === 'tr_tr');

      console.log(chalk.yellow('\nÇeviri Durumu:'));
      if (!hasEn) {
        console.log(chalk.red('  ✗ İngilizce dil dosyası yok - çeviri yapılamaz'));
      } else if (hasTr) {
        console.log(chalk.green('  ✓ Türkçe çeviri mevcut'));
      } else {
        console.log(chalk.yellow('  ⊘ Türkçe çeviri yok - çeviri yapılabilir'));
      }

      console.log(chalk.cyan('\n' + '='.repeat(60) + '\n'));

    } catch (error) {
      spinner.fail(chalk.red('Hata oluştu'));
      console.error(chalk.red(`\n❌ ${error.message}\n`));
      process.exit(1);
    }
  });

/**
 * Konfigürasyon yönetimi
 */
program
  .command('config <key> [value]')
  .description('Konfigürasyon ayarlarını yönet')
  .action(async (key, value) => {
    if (value) {
      config.set(key, value);
      console.log(chalk.green(`✓ ${key} = ${value}`));
    } else {
      const val = config.get(key);
      if (val !== undefined) {
        console.log(chalk.cyan(`${key} = ${val}`));
      } else {
        console.log(chalk.yellow(`${key} ayarlanmamış`));
      }
    }
  });

// Hata yakalama
process.on('uncaughtException', (error) => {
  console.error(chalk.red('\n❌ Beklenmeyen hata:'), error.message);
  if (process.env.DEBUG) {
    console.error(error.stack);
  }
  process.exit(1);
});

process.on('unhandledRejection', (error) => {
  console.error(chalk.red('\n❌ İşlenemeyen promise reddi:'), error.message);
  if (process.env.DEBUG) {
    console.error(error.stack);
  }
  process.exit(1);
});

// Programı çalıştır
program.parse(process.argv);

// Argüman verilmemişse yardımı göster
if (!process.argv.slice(2).length) {
  console.log(chalk.cyan(banner));
  program.outputHelp();
}
