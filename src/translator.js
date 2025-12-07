/**
 * Minecraft Mod Translator - Translation Engine
 * Profesyonel kalitede çeviri yapan motor
 *
 * © 2024-2025 Deokwave - Tüm Hakları Saklıdır
 * Bu dosya Deokwave'e aittir ve telif hakkı koruması altındadır.
 */

import https from 'https';
import { setTimeout } from 'timers/promises';

export class TranslationEngine {
  constructor(options = {}) {
    this.apiKey = options.apiKey || process.env.ANTHROPIC_API_KEY;
    this.model = options.model || 'claude-3-5-sonnet-20241022';
    this.rateLimit = options.rateLimit || 50; // Requests per minute
    this.cache = new Map();
    this.stats = {
      total: 0,
      cached: 0,
      translated: 0,
      errors: 0
    };
  }

  /**
   * Ana çeviri fonksiyonu - JSON formatını korur
   */
  async translateLanguageFile(jsonContent, options = {}) {
    const sourceLang = options.sourceLang || 'en_us';
    const targetLang = options.targetLang || 'tr_tr';

    try {
      const parsed = JSON.parse(jsonContent);
      const translated = {};

      const keys = Object.keys(parsed);
      this.stats.total += keys.length;

      // Batch çeviri için grupla (her grup max 50 key)
      const batches = this.createBatches(keys, 50);

      for (const batch of batches) {
        const batchData = {};
        batch.forEach(key => {
          batchData[key] = parsed[key];
        });

        const translatedBatch = await this.translateBatch(batchData, {
          sourceLang,
          targetLang,
          context: options.modName || 'Minecraft Mod'
        });

        Object.assign(translated, translatedBatch);

        // Rate limiting
        await setTimeout(1200); // 50 requests/min = ~1.2s delay
      }

      return JSON.stringify(translated, null, 2);
    } catch (error) {
      throw new Error(`Çeviri hatası: ${error.message}`);
    }
  }

  /**
   * Batch çeviri - Birden fazla key'i aynı anda çevirir
   */
  async translateBatch(data, context) {
    const cacheKey = JSON.stringify({ data, context });

    if (this.cache.has(cacheKey)) {
      this.stats.cached += Object.keys(data).length;
      return this.cache.get(cacheKey);
    }

    const prompt = this.buildTranslationPrompt(data, context);

    try {
      const result = await this.callClaudeAPI(prompt);
      const translated = this.parseTranslationResult(result);

      this.cache.set(cacheKey, translated);
      this.stats.translated += Object.keys(data).length;

      return translated;
    } catch (error) {
      this.stats.errors += Object.keys(data).length;
      console.error('Batch çeviri hatası:', error.message);
      // Hata durumunda orijinal değerleri döndür
      return data;
    }
  }

  /**
   * Claude API çağrısı
   */
  async callClaudeAPI(prompt) {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify({
        model: this.model,
        max_tokens: 4096,
        messages: [{
          role: 'user',
          content: prompt
        }],
        temperature: 0.3 // Tutarlı çeviri için düşük temperature
      });

      const options = {
        hostname: 'api.anthropic.com',
        port: 443,
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
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
              resolve(response.content[0].text);
            } catch (e) {
              reject(new Error('API yanıtı parse edilemedi'));
            }
          } else {
            reject(new Error(`API hatası: ${res.statusCode} - ${body}`));
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
   * Çeviri prompt'unu oluştur
   */
  buildTranslationPrompt(data, context) {
    return `Sen profesyonel bir Minecraft mod çevirmenisisin. Aşağıdaki ${context.context} modundan gelen İngilizce metinleri Türkçe'ye çevir.

KURALLAR:
1. JSON formatını TAM OLARAK koru - sadece değerleri çevir, key'leri asla değiştirme
2. Minecraft terminolojisine sadık kal (örn: "block" -> "blok", "item" -> "eşya")
3. %s, %d, %1$s gibi format kodlarını AYNEN koru
4. Color code'ları (§a, §b vb.) AYNEN koru
5. Placeholder'ları ({}, %%, vb.) AYNEN koru
6. Doğal ve akıcı Türkçe kullan
7. Teknik terimleri uygun şekilde çevir
8. Tooltip ve UI metinleri için kısa ve net çeviriler yap

SADECE çevrilmiş JSON objesini döndür, başka hiçbir açıklama yazma.

Çevrilecek JSON:
${JSON.stringify(data, null, 2)}

Çevrilmiş JSON:`;
  }

  /**
   * Claude'dan gelen yanıtı parse et
   */
  parseTranslationResult(result) {
    try {
      // Markdown code block'larını temizle
      let cleaned = result.trim();
      cleaned = cleaned.replace(/^```json?\n?/i, '');
      cleaned = cleaned.replace(/\n?```$/, '');
      cleaned = cleaned.trim();

      return JSON.parse(cleaned);
    } catch (error) {
      throw new Error(`Çeviri yanıtı parse edilemedi: ${error.message}\n\nYanıt: ${result}`);
    }
  }

  /**
   * Array'i batch'lere böl
   */
  createBatches(array, size) {
    const batches = [];
    for (let i = 0; i < array.length; i += size) {
      batches.push(array.slice(i, i + size));
    }
    return batches;
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
      cached: 0,
      translated: 0,
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

/**
 * Offline/Yüksek Kaliteli çeviri motoru - API key olmadan kullanım için
 * Kapsamlı sözlük ve akıllı çeviri kuralları
 */
export class SimpleTranslator {
  constructor() {
    // Kapsamlı Minecraft terminolojisi sözlüğü
    this.dictionary = this.buildDictionary();
    this.stats = {
      total: 0,
      translated: 0,
      cached: 0,
      errors: 0
    };
  }

  buildDictionary() {
    return {
      // ===== TEMEL KELİMELER =====
      'the': '',
      'a': 'bir',
      'an': 'bir',
      'and': 've',
      'or': 'veya',
      'of': '',
      'in': 'içinde',
      'on': 'üzerinde',
      'at': 'de',
      'to': 'e',
      'for': 'için',
      'with': 'ile',
      'from': 'den',
      'by': 'tarafından',
      'this': 'bu',
      'that': 'şu',
      'all': 'tüm',
      'your': 'senin',
      'you': 'sen',
      'can': 'yapabilir',
      'will': 'olacak',
      'has': 'sahip',
      'have': 'sahip',
      'is': 'dir',
      'are': 'dır',
      'be': 'olmak',
      'not': 'değil',
      'no': 'hayır',
      'yes': 'evet',

      // ===== MINECRAFT TEMEL TERİMLER =====
      'block': 'blok',
      'blocks': 'bloklar',
      'item': 'eşya',
      'items': 'eşyalar',
      'entity': 'varlık',
      'entities': 'varlıklar',
      'mob': 'yaratık',
      'mobs': 'yaratıklar',
      'player': 'oyuncu',
      'players': 'oyuncular',
      'world': 'dünya',
      'dimension': 'boyut',
      'biome': 'biyom',

      // ===== EYLEMLER =====
      'craft': 'işle',
      'crafted': 'işlendi',
      'crafting': 'işleme',
      'smelt': 'erit',
      'smelting': 'eritme',
      'smelted': 'eritildi',
      'mine': 'kazmak',
      'mining': 'kazma',
      'mined': 'kazıldı',
      'break': 'kır',
      'breaking': 'kırma',
      'broken': 'kırıldı',
      'place': 'yerleştir',
      'placing': 'yerleştirme',
      'placed': 'yerleştirildi',
      'use': 'kullan',
      'using': 'kullanma',
      'used': 'kullanıldı',
      'click': 'tıkla',
      'right click': 'sağ tıkla',
      'left click': 'sol tıkla',
      'shift click': 'shift tıkla',
      'open': 'aç',
      'close': 'kapat',
      'brew': 'demle',
      'brewing': 'demleme',
      'brewed': 'demlendi',
      'enchant': 'büyüle',
      'enchanting': 'büyüleme',
      'enchanted': 'büyülendi',
      'repair': 'onar',
      'repairing': 'onarma',
      'repaired': 'onarıldı',
      'upgrade': 'geliştir',
      'upgraded': 'geliştirildi',
      'attack': 'saldır',
      'attacking': 'saldırma',
      'defend': 'savun',
      'kill': 'öldür',
      'die': 'öl',
      'spawn': 'doğ',
      'respawn': 'yeniden doğ',
      'teleport': 'ışınlan',
      'fly': 'uç',
      'swim': 'yüz',
      'walk': 'yürü',
      'run': 'koş',
      'jump': 'zıpla',
      'sneak': 'sinsice',
      'crouch': 'çömel',

      // ===== EŞİT VE ARAÇLAR =====
      'sword': 'kılıç',
      'pickaxe': 'kazma',
      'axe': 'balta',
      'shovel': 'kürek',
      'hoe': 'çapa',
      'bow': 'yay',
      'arrow': 'ok',
      'arrows': 'oklar',
      'crossbow': 'tatar yayı',
      'trident': 'zıpkın',
      'shield': 'kalkan',
      'shears': 'makas',
      'flint and steel': 'çakmaktaşı',
      'fishing rod': 'olta',
      'bucket': 'kova',
      'compass': 'pusula',
      'clock': 'saat',
      'map': 'harita',
      'spyglass': 'dürbün',
      'brush': 'fırça',

      // ===== ZIRH =====
      'armor': 'zırh',
      'helmet': 'miğfer',
      'chestplate': 'göğüslük',
      'leggings': 'pantolon',
      'boots': 'bot',
      'elytra': 'elytra',
      'turtle shell': 'kaplumbağa kabuğu',

      // ===== MATERYALLER =====
      'wood': 'tahta',
      'wooden': 'tahta',
      'oak': 'meşe',
      'birch': 'huş',
      'spruce': 'ladin',
      'jungle': 'orman',
      'acacia': 'akasya',
      'dark oak': 'koyu meşe',
      'mangrove': 'mangrov',
      'cherry': 'kiraz',
      'bamboo': 'bambu',
      'crimson': 'kızıl',
      'warped': 'çarpık',
      'stone': 'taş',
      'cobblestone': 'kaldırımtaşı',
      'iron': 'demir',
      'gold': 'altın',
      'golden': 'altın',
      'diamond': 'elmas',
      'emerald': 'zümrüt',
      'netherite': 'netherite',
      'copper': 'bakır',
      'amethyst': 'ametist',
      'quartz': 'kuvars',
      'obsidian': 'obsidyen',
      'leather': 'deri',
      'coal': 'kömür',
      'charcoal': 'odun kömürü',
      'redstone': 'kırmızıtaş',
      'lapis': 'lapis',
      'lapis lazuli': 'lapis lazuli',
      'glowstone': 'parıltıtaşı',
      'prismarine': 'prizmarin',

      // ===== ÜRETİM İTEMLERİ =====
      'ingot': 'külçe',
      'nugget': 'parça',
      'dust': 'toz',
      'powder': 'toz',
      'gem': 'mücevher',
      'shard': 'kırık',
      'scrap': 'hurda',
      'ore': 'maden',
      'raw': 'ham',
      'deepslate': 'derinarduvaz',
      'crystal': 'kristal',
      'pearl': 'inci',
      'stick': 'çubuk',
      'string': 'ip',
      'paper': 'kağıt',
      'book': 'kitap',
      'enchanted book': 'büyülü kitap',
      'feather': 'tüy',
      'bone': 'kemik',
      'slime ball': 'balçık topu',
      'gunpowder': 'barut',
      'blaze rod': 'kor çubuğu',
      'blaze powder': 'kor tozu',
      'ender pearl': 'ender incisi',
      'eye of ender': 'ender gözü',
      'dragon egg': 'ejderha yumurtası',
      'nether star': 'nether yıldızı',
      'heart of the sea': 'deniz kalbi',
      'nautilus shell': 'nautilus kabuğu',
      'phantom membrane': 'hayalet zarı',
      'rabbit hide': 'tavşan postu',
      'rabbit foot': 'tavşan ayağı',
      'turtle egg': 'kaplumbağa yumurtası',
      'scute': 'kabuk levhası',
      'honeycomb': 'bal peteği',
      'honey bottle': 'bal şişesi',

      // ===== YİYECEKLER =====
      'food': 'yiyecek',
      'bread': 'ekmek',
      'apple': 'elma',
      'golden apple': 'altın elma',
      'carrot': 'havuç',
      'golden carrot': 'altın havuç',
      'potato': 'patates',
      'baked potato': 'pişmiş patates',
      'poisonous potato': 'zehirli patates',
      'beetroot': 'pancar',
      'melon': 'karpuz',
      'sweet berries': 'tatlı yemişler',
      'glow berries': 'parlak yemişler',
      'cookie': 'kurabiye',
      'cake': 'pasta',
      'pumpkin pie': 'balkabağı turtası',
      'mushroom stew': 'mantar çorbası',
      'rabbit stew': 'tavşan güveci',
      'suspicious stew': 'şüpheli güveç',
      'beef': 'sığır eti',
      'cooked beef': 'pişmiş sığır eti',
      'porkchop': 'domuz pirzolası',
      'cooked porkchop': 'pişmiş domuz pirzolası',
      'mutton': 'koyun eti',
      'cooked mutton': 'pişmiş koyun eti',
      'chicken': 'tavuk',
      'cooked chicken': 'pişmiş tavuk',
      'rabbit': 'tavşan eti',
      'cooked rabbit': 'pişmiş tavşan eti',
      'cod': 'morina',
      'cooked cod': 'pişmiş morina',
      'salmon': 'somon',
      'cooked salmon': 'pişmiş somon',
      'tropical fish': 'tropikal balık',
      'pufferfish': 'balon balığı',
      'rotten flesh': 'çürük et',
      'spider eye': 'örümcek gözü',
      'milk': 'süt',
      'water bottle': 'su şişesi',

      // ===== İKSİRLER VE ETKİLER =====
      'potion': 'iksir',
      'splash potion': 'sıçrayan iksir',
      'lingering potion': 'kalıcı iksir',
      'effect': 'etki',
      'status effect': 'durum etkisi',
      'regeneration': 'yenilenme',
      'speed': 'hız',
      'slowness': 'yavaşlık',
      'haste': 'çabukluk',
      'mining fatigue': 'kazma yorgunluğu',
      'strength': 'güç',
      'instant health': 'ani iyileşme',
      'instant damage': 'ani hasar',
      'jump boost': 'zıplama artışı',
      'nausea': 'mide bulantısı',
      'resistance': 'direnç',
      'fire resistance': 'ateş direnci',
      'water breathing': 'su altında nefes alma',
      'invisibility': 'görünmezlik',
      'blindness': 'körlük',
      'night vision': 'gece görüşü',
      'hunger': 'açlık',
      'weakness': 'zayıflık',
      'poison': 'zehir',
      'wither': 'solar',
      'absorption': 'emilim',
      'saturation': 'doygunluk',
      'glowing': 'parlama',
      'levitation': 'levitasyon',
      'luck': 'şans',
      'bad luck': 'kötü şans',
      'slow falling': 'yavaş düşme',
      'conduit power': 'kanal gücü',
      'dolphin\'s grace': 'yunus lütfu',
      'bad omen': 'kötü belirti',
      'hero of the village': 'köyün kahramanı',
      'darkness': 'karanlık',

      // ===== BÜYÜLER =====
      'enchantment': 'büyü',
      'curse': 'lanet',
      'protection': 'koruma',
      'fire protection': 'ateş koruması',
      'blast protection': 'patlama koruması',
      'projectile protection': 'mermi koruması',
      'feather falling': 'tüy gibi düşme',
      'thorns': 'diken',
      'respiration': 'solunum',
      'aqua affinity': 'su yakınlığı',
      'depth strider': 'derinlik yürüyücüsü',
      'frost walker': 'don yürüyücüsü',
      'soul speed': 'ruh hızı',
      'swift sneak': 'hızlı sinsice',
      'sharpness': 'keskinlik',
      'smite': 'kutsal öfke',
      'bane of arthropods': 'eklembacaklı düşmanı',
      'knockback': 'geri tepme',
      'fire aspect': 'ateş yönü',
      'looting': 'yağma',
      'sweeping edge': 'süpüren kenar',
      'efficiency': 'verimlilik',
      'silk touch': 'hassas dokunuş',
      'unbreaking': 'dayanıklılık',
      'fortune': 'servet',
      'power': 'güç',
      'punch': 'yumruk',
      'flame': 'alev',
      'infinity': 'sonsuzluk',
      'luck of the sea': 'deniz şansı',
      'lure': 'yem',
      'loyalty': 'sadakat',
      'impaling': 'deşme',
      'riptide': 'fırtına',
      'channeling': 'yönlendirme',
      'multishot': 'çoklu atış',
      'quick charge': 'hızlı şarj',
      'piercing': 'delme',
      'mending': 'onarım',
      'vanishing': 'kaybolma',
      'binding': 'bağlama',

      // ===== BLOKLAR =====
      'dirt': 'toprak',
      'grass': 'çimen',
      'grass block': 'çimen bloğu',
      'sand': 'kum',
      'gravel': 'çakıl',
      'clay': 'kil',
      'terracotta': 'pişmiş toprak',
      'glazed terracotta': 'sırlı pişmiş toprak',
      'concrete': 'beton',
      'concrete powder': 'beton tozu',
      'glass': 'cam',
      'stained glass': 'boyalı cam',
      'glass pane': 'cam levha',
      'ice': 'buz',
      'packed ice': 'sıkıştırılmış buz',
      'blue ice': 'mavi buz',
      'snow': 'kar',
      'snow block': 'kar bloğu',
      'netherrack': 'nether kayası',
      'soul sand': 'ruh kumu',
      'soul soil': 'ruh toprağı',
      'basalt': 'bazalt',
      'blackstone': 'kara taş',
      'end stone': 'son taşı',
      'purpur': 'purpur',
      'bedrock': 'anakayanası',
      'barrier': 'bariyer',
      'spawner': 'doğurucu',
      'chest': 'sandık',
      'trapped chest': 'tuzaklı sandık',
      'ender chest': 'ender sandık',
      'barrel': 'varil',
      'shulker box': 'shulker kutusu',
      'furnace': 'fırın',
      'blast furnace': 'pota fırını',
      'smoker': 'füme fırını',
      'crafting table': 'işleme masası',
      'smithing table': 'demircilik masası',
      'cartography table': 'haritacılık masası',
      'fletching table': 'okçuluk masası',
      'brewing stand': 'demleme sehpası',
      'enchanting table': 'büyü masası',
      'anvil': 'örs',
      'grindstone': 'biley taşı',
      'stonecutter': 'taş kesici',
      'loom': 'dokuma tezgahı',
      'composter': 'kompost yapıcı',
      'cauldron': 'kazan',
      'beacon': 'işaret',
      'conduit': 'kanal',
      'bell': 'çan',
      'lectern': 'kürsü',
      'bed': 'yatak',
      'respawn anchor': 'yeniden doğma çapası',
      'door': 'kapı',
      'trapdoor': 'tuzak kapısı',
      'fence': 'çit',
      'fence gate': 'çit kapısı',
      'wall': 'duvar',
      'stairs': 'merdiven',
      'slab': 'levha',
      'pressure plate': 'basınç levhası',
      'button': 'buton',
      'lever': 'kol',
      'torch': 'meşale',
      'lantern': 'fener',
      'campfire': 'kamp ateşi',
      'soul torch': 'ruh meşalesi',
      'soul lantern': 'ruh feneri',
      'soul campfire': 'ruh kamp ateşi',
      'redstone torch': 'kırmızıtaş meşalesi',
      'redstone lamp': 'kırmızıtaş lambası',
      'sea lantern': 'deniz feneri',
      'shroomlight': 'mantar ışığı',
      'froglight': 'kurbağa ışığı',
      'piston': 'piston',
      'sticky piston': 'yapışkan piston',
      'slime block': 'balçık bloğu',
      'honey block': 'bal bloğu',
      'tnt': 'tnt',
      'dispenser': 'dağıtıcı',
      'dropper': 'bırakıcı',
      'hopper': 'huni',
      'observer': 'gözlemci',
      'repeater': 'tekrarlayıcı',
      'comparator': 'karşılaştırıcı',
      'daylight detector': 'gün ışığı algılayıcı',
      'target': 'hedef',
      'lightning rod': 'yıldırım çubuğu',
      'sculk sensor': 'sculk algılayıcı',
      'sculk shrieker': 'sculk çığlıkçı',
      'calibrated sculk sensor': 'kalibre edilmiş sculk algılayıcı',

      // ===== OYUN MODLARI =====
      'gamemode': 'oyun modu',
      'survival': 'hayatta kalma',
      'creative': 'yaratıcı',
      'adventure': 'macera',
      'spectator': 'izleyici',
      'hardcore': 'zor mod',

      // ===== ZORLUK =====
      'difficulty': 'zorluk',
      'peaceful': 'barışçıl',
      'easy': 'kolay',
      'normal': 'normal',
      'hard': 'zor',

      // ===== BOYUTLAR =====
      'overworld': 'ana dünya',
      'nether': 'nether',
      'the nether': 'nether',
      'end': 'son',
      'the end': 'son',

      // ===== YARATIKLAR =====
      'creeper': 'creeper',
      'skeleton': 'iskelet',
      'zombie': 'zombi',
      'spider': 'örümcek',
      'enderman': 'enderman',
      'slime': 'balçık',
      'witch': 'cadı',
      'blaze': 'kor',
      'ghast': 'ghast',
      'piglin': 'piglin',
      'hoglin': 'hoglin',
      'wither skeleton': 'solar iskeleti',
      'ender dragon': 'ender ejderhası',
      'wither': 'solar',
      'elder guardian': 'yaşlı koruyucu',
      'guardian': 'koruyucu',
      'shulker': 'shulker',
      'phantom': 'hayalet',
      'drowned': 'boğulmuş',
      'husk': 'kabuk',
      'stray': 'sokak köpeği',
      'vex': 'vex',
      'vindicator': 'vindicator',
      'evoker': 'evoker',
      'pillager': 'yağmacı',
      'ravager': 'ravager',
      'villager': 'köylü',
      'wandering trader': 'gezgin tüccar',
      'iron golem': 'demir golem',
      'snow golem': 'kar golemi',
      'cat': 'kedi',
      'dog': 'köpek',
      'wolf': 'kurt',
      'horse': 'at',
      'donkey': 'eşek',
      'mule': 'katır',
      'pig': 'domuz',
      'cow': 'inek',
      'sheep': 'koyun',
      'chicken': 'tavuk',
      'rabbit': 'tavşan',
      'turtle': 'kaplumbağa',
      'dolphin': 'yunus',
      'squid': 'mürekkep balığı',
      'glow squid': 'parlayan mürekkep balığı',
      'bat': 'yarasa',
      'parrot': 'papağan',
      'panda': 'panda',
      'fox': 'tilki',
      'bee': 'arı',
      'goat': 'keçi',
      'axolotl': 'axolotl',
      'frog': 'kurbağa',
      'tadpole': 'iribaş',
      'allay': 'allay',
      'warden': 'gardiyan',

      // ===== GENEL OYUN TERİMLERİ =====
      'inventory': 'envanter',
      'hotbar': 'hızlı çubuk',
      'health': 'can',
      'hunger': 'açlık',
      'experience': 'deneyim',
      'level': 'seviye',
      'damage': 'hasar',
      'durability': 'dayanıklılık',
      'armor': 'zırh',
      'armor value': 'zırh değeri',
      'attack': 'saldırı',
      'attack speed': 'saldırı hızı',
      'defense': 'savunma',
      'tooltip': 'ipucu',
      'description': 'açıklama',
      'info': 'bilgi',
      'information': 'bilgi',
      'recipe': 'tarif',
      'shaped': 'şekilli',
      'shapeless': 'şekilsiz',
      'ingredient': 'malzeme',
      'result': 'sonuç',
      'output': 'çıktı',
      'input': 'girdi',
      'fuel': 'yakıt',
      'burn time': 'yanma süresi',
      'cooking time': 'pişirme süresi',
      'experience points': 'deneyim puanı',

      // ===== MOD ÖZEL TERİMLER =====
      'machine': 'makine',
      'generator': 'jeneratör',
      'energy': 'enerji',
      'power': 'güç',
      'rf': 'rf',
      'fe': 'fe',
      'eu': 'eu',
      'capacity': 'kapasite',
      'storage': 'depolama',
      'transfer': 'aktarım',
      'rate': 'oran',
      'cable': 'kablo',
      'wire': 'tel',
      'pipe': 'boru',
      'conduit': 'kanal',
      'duct': 'kanal',
      'tank': 'tank',
      'fluid': 'sıvı',
      'liquid': 'sıvı',
      'gas': 'gaz',
      'mekanism': 'mekanizma',
      'thermal': 'termal',
      'industrial': 'endüstriyel',
      'automation': 'otomasyon',
      'mechanism': 'mekanizma',
      'processor': 'işlemci',
      'factory': 'fabrika',
      'foundry': 'dökümhane',
      'smeltery': 'eritme ocağı',
      'crusher': 'ezici',
      'grinder': 'öğütücü',
      'pulverizer': 'toz haline getirici',
      'compressor': 'sıkıştırıcı',
      'centrifuge': 'santrifüj',
      'electro': 'elektro',
      'magnetic': 'manyetik',
      'advanced': 'gelişmiş',
      'basic': 'temel',
      'elite': 'elit',
      'ultimate': 'nihai',
      'creative': 'yaratıcı',
      'infinite': 'sonsuz',
      'unlimited': 'sınırsız',
      'auto': 'otomatik',
      'manual': 'manuel',
      'mode': 'mod',
      'setting': 'ayar',
      'settings': 'ayarlar',
      'config': 'yapılandırma',
      'configuration': 'yapılandırma',
      'option': 'seçenek',
      'options': 'seçenekler',
      'toggle': 'değiştir',
      'enable': 'etkinleştir',
      'enabled': 'etkin',
      'disable': 'devre dışı bırak',
      'disabled': 'devre dışı',
      'on': 'açık',
      'off': 'kapalı',
      'active': 'aktif',
      'inactive': 'inaktif',
      'status': 'durum',
      'progress': 'ilerleme',
      'processing': 'işleniyor',
      'complete': 'tamamlandı',
      'incomplete': 'tamamlanmadı',
      'ready': 'hazır',
      'waiting': 'bekliyor',
      'idle': 'boşta',
      'working': 'çalışıyor',
      'gui': 'arayüz',
      'interface': 'arayüz',
      'screen': 'ekran',
      'menu': 'menü',
      'slot': 'yuva',
      'slots': 'yuvalar',
      'side': 'yan',
      'top': 'üst',
      'bottom': 'alt',
      'left': 'sol',
      'right': 'sağ',
      'front': 'ön',
      'back': 'arka',
      'north': 'kuzey',
      'south': 'güney',
      'east': 'doğu',
      'west': 'batı',
      'up': 'yukarı',
      'down': 'aşağı',
      'tier': 'seviye',
      'upgrade': 'geliştirme',
      'upgrades': 'geliştirmeler',
      'blueprint': 'plan',
      'schematic': 'şema',
      'pattern': 'desen',
      'template': 'şablon',
      'tool': 'alet',
      'tools': 'aletler',
      'part': 'parça',
      'parts': 'parçalar',
      'component': 'bileşen',
      'components': 'bileşenler',
      'modifier': 'değiştirici',
      'modifiers': 'değiştiriciler',
      'trait': 'özellik',
      'traits': 'özellikler',
      'ability': 'yetenek',
      'abilities': 'yetenekler',
      'skill': 'beceri',
      'skills': 'beceriler',
      'spell': 'büyü',
      'spells': 'büyüler',
      'magic': 'sihir',
      'mana': 'mana',
      'ritual': 'ritüel',
      'rune': 'rün',
      'runes': 'rünler',
      'crystal': 'kristal',
      'essence': 'öz',
      'soul': 'ruh',
      'spirit': 'ruh',
      'dimension': 'boyut',
      'portal': 'portal',
      'teleport': 'ışınlanma',
      'teleporter': 'ışınlayıcı',
      'waypoint': 'yol noktası',
      'warp': 'sıçrama',
      'chunk': 'bölge',
      'claim': 'talep et',
      'protection': 'koruma',
      'owner': 'sahip',
      'member': 'üye',
      'permission': 'izin',
      'permissions': 'izinler',
      'rank': 'rütbe',
      'team': 'takım',
      'party': 'parti',
      'guild': 'lonca',
      'quest': 'görev',
      'quests': 'görevler',
      'task': 'görev',
      'tasks': 'görevler',
      'objective': 'hedef',
      'reward': 'ödül',
      'rewards': 'ödüller',
      'currency': 'para birimi',
      'money': 'para',
      'coin': 'jeton',
      'coins': 'jetonlar',
      'credit': 'kredi',
      'credits': 'krediler',
      'shop': 'dükkan',
      'store': 'mağaza',
      'trade': 'takas',
      'trading': 'takas',
      'buy': 'satın al',
      'sell': 'sat',
      'price': 'fiyat',
      'cost': 'maliyet',
      'value': 'değer',
      'amount': 'miktar',
      'quantity': 'miktar',
      'count': 'sayı',
      'stack': 'yığın',
      'max': 'maksimum',
      'min': 'minimum',
      'current': 'mevcut',
      'maximum': 'maksimum',
      'minimum': 'minimum',
      'total': 'toplam',
      'per': 'başına',
      'every': 'her',
      'chance': 'şans',
      'probability': 'olasılık',
      'random': 'rastgele',
      'rare': 'nadir',
      'common': 'yaygın',
      'uncommon': 'seyrek',
      'epic': 'destansı',
      'legendary': 'efsanevi',
      'mythic': 'mitik',
      'unique': 'benzersiz',
      'special': 'özel',
      'bonus': 'bonus',
      'extra': 'ekstra',
      'additional': 'ek',
      'multiplier': 'çarpan',
      'increase': 'artır',
      'decrease': 'azalt',
      'boost': 'artış',
      'reduction': 'azalma',
      'buff': 'güçlendirme',
      'debuff': 'zayıflatma',
      'cooldown': 'bekleme süresi',
      'duration': 'süre',
      'time': 'zaman',
      'tick': 'tik',
      'second': 'saniye',
      'seconds': 'saniye',
      'minute': 'dakika',
      'minutes': 'dakika',
      'hour': 'saat',
      'hours': 'saat',
      'day': 'gün',
      'days': 'gün',
      'instant': 'anında',
      'permanent': 'kalıcı',
      'temporary': 'geçici'
    };
  }

  /**
   * Yüksek kaliteli sözlük tabanlı çeviri
   */
  async translateLanguageFile(jsonContent, options = {}) {
    try {
      const parsed = JSON.parse(jsonContent);
      const translated = {};
      const keys = Object.keys(parsed);

      this.stats.total = keys.length;

      for (const [key, value] of Object.entries(parsed)) {
        try {
          translated[key] = this.translateText(value);
          this.stats.translated++;
        } catch (e) {
          console.warn(`Çeviri hatası (${key}):`, e.message);
          translated[key] = value; // Hata durumunda orijinali kullan
          this.stats.errors++;
        }
      }

      return JSON.stringify(translated, null, 2);
    } catch (error) {
      throw new Error(`Çeviri hatası: ${error.message}`);
    }
  }

  /**
   * Tek bir metni akıllı şekilde çevir
   */
  translateText(text) {
    if (typeof text !== 'string') return text;

    // Boş string kontrolü
    if (!text.trim()) return text;

    // Format kodlarını koru (%s, %d, %1$s, vb.)
    const formatCodes = [];
    let result = text.replace(/(%[sd\d$]+)/g, (match) => {
      formatCodes.push(match);
      return `__FORMAT_${formatCodes.length - 1}__`;
    });

    // Color kodlarını koru (§a, §b, vb.)
    const colorCodes = [];
    result = result.replace(/(§[0-9a-fk-or])/gi, (match) => {
      colorCodes.push(match);
      return `__COLOR_${colorCodes.length - 1}__`;
    });

    // Placeholder'ları koru ({}, %%, {{...}}, vb.)
    const placeholders = [];
    result = result.replace(/(\{\{[^}]+\}\}|\{[^}]*\}|%%)/g, (match) => {
      placeholders.push(match);
      return `__PLACEHOLDER_${placeholders.length - 1}__`;
    });

    // Önce uzun ifadeleri çevir (daha spesifik)
    const sortedDict = Object.entries(this.dictionary)
      .sort((a, b) => b[0].length - a[0].length); // Uzundan kısaya

    for (const [eng, tur] of sortedDict) {
      if (!eng || eng.trim() === '') continue;
      if (!tur) continue; // Boş çeviriler için

      // Kelime sınırları ile regex
      const regex = new RegExp(`\\b${this.escapeRegex(eng)}\\b`, 'gi');
      result = result.replace(regex, tur);
    }

    // Temizlik: Çift boşlukları tek yap
    result = result.replace(/\s{2,}/g, ' ');

    // Format kodlarını geri koy
    formatCodes.forEach((code, index) => {
      result = result.replace(`__FORMAT_${index}__`, code);
    });

    // Color kodlarını geri koy
    colorCodes.forEach((code, index) => {
      result = result.replace(`__COLOR_${index}__`, code);
    });

    // Placeholder'ları geri koy
    placeholders.forEach((ph, index) => {
      result = result.replace(`__PLACEHOLDER_${index}__`, ph);
    });

    // İlk harfi büyüt (eğer orijinal de büyükse)
    if (text.charAt(0) === text.charAt(0).toUpperCase() && result.length > 0) {
      result = result.charAt(0).toUpperCase() + result.slice(1);
    }

    return result.trim();
  }

  /**
   * Regex için özel karakterleri escape et
   */
  escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
}
