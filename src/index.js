/**
 * Minecraft Mod Translator
 * Main entry point for programmatic usage
 *
 * © 2024-2025 Deokwave - Tüm Hakları Saklıdır
 * Bu dosya Deokwave'e aittir ve telif hakkı koruması altındadır.
 */

export { ModHandler } from './modHandler.js';
export { TranslationEngine, SimpleTranslator } from './translator.js';
export { ConfigManager } from './config.js';

/**
 * Hızlı kullanım için yardımcı fonksiyon
 */
export async function translateMod(modPath, options = {}) {
  const { ModHandler } = await import('./modHandler.js');
  const { TranslationEngine } = await import('./translator.js');

  const modHandler = new ModHandler();
  const translator = new TranslationEngine(options);

  // Mod'u analiz et
  const modInfo = await modHandler.analyzeMod(modPath);

  // İngilizce dil dosyasını bul
  const enLang = await modHandler.extractEnglishLang(modPath);

  // Çevir
  const translated = await translator.translateLanguageFile(enLang.content, {
    modName: modInfo.name
  });

  // Geri ekle
  const outputPath = options.outputPath || modPath.replace(/\.jar$/i, '_tr.jar');
  await modHandler.injectTranslation(modPath, translated, outputPath);

  return {
    success: true,
    outputPath,
    stats: translator.getStats()
  };
}

/**
 * Toplu çeviri için yardımcı fonksiyon
 */
export async function translateBatch(directory, options = {}) {
  const { ModHandler } = await import('./modHandler.js');
  const { TranslationEngine } = await import('./translator.js');
  const path = await import('path');
  const fs = await import('fs/promises');

  const modHandler = new ModHandler();
  const translator = new TranslationEngine(options);

  // Modları bul
  const modFiles = await modHandler.findModsInDirectory(directory);

  // Çıktı klasörü
  const outputDir = options.outputDir || path.join(process.cwd(), 'translated');
  await fs.mkdir(outputDir, { recursive: true });

  const results = [];

  for (const modFile of modFiles) {
    try {
      const modName = path.basename(modFile);
      const modInfo = await modHandler.analyzeMod(modFile);

      const enLang = await modHandler.extractEnglishLang(modFile);
      const translated = await translator.translateLanguageFile(enLang.content, {
        modName: modInfo.name
      });

      const outputPath = path.join(outputDir, modName);
      await modHandler.injectTranslation(modFile, translated, outputPath);

      results.push({
        mod: modName,
        success: true,
        outputPath
      });
    } catch (error) {
      results.push({
        mod: path.basename(modFile),
        success: false,
        error: error.message
      });
    }
  }

  return {
    total: modFiles.length,
    results,
    stats: translator.getStats()
  };
}
