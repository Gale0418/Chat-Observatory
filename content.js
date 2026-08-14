(() => {
  if (!window.location.href.includes("is_popout=1")) return;
  if (document.getElementById("ytce-control-panel")) return;

  const DEFAULT_SETTINGS = Object.freeze({
    mode: "complete",
    theme: "ember",
    fontSize: 28,
    avatarSize: 48,
    isCollapsed: false,
    ttsEnabled: false,
    ttsVolume: 65,
    ttsRate: 1.05,
    ttsPitch: 1,
    ttsVoiceMode: "auto",
    ttsVoiceURI: "",
    ttsReadName: false,
    ttsReadTime: false,
    readEmoji: false,
    cleanUrls: true,
    collapseRepeats: true,
    maxMessageLength: 120,
    queueLimit: 20,
    staleAfterSeconds: 30,
    hideAvatars: false,
    hideBadges: false,
    highlightKeywords: ""
  });

  const VALID_MODES = Object.freeze(["complete", "monitor", "reader"]);
  const VALID_THEMES = Object.freeze(["ember", "aurora", "paper", "starlight"]);
  const VALID_VOICE_MODES = Object.freeze(["auto", "fixed"]);

  const RENDERER_SELECTOR = [
    "yt-live-chat-text-message-renderer",
    "yt-live-chat-paid-message-renderer",
    "yt-live-chat-paid-sticker-renderer",
    "yt-live-chat-membership-item-renderer",
    "yt-live-chat-sponsorships-gift-purchase-announcement-renderer",
    "yt-live-chat-sponsorships-gift-redemption-announcement-renderer"
  ].join(",");

  let settings = { ...DEFAULT_SETTINGS };
  let saveTimer = null;
  let isCleanedUp = false;
  let keywordList = [];
  let ttsQueue = [];
  let activeUtterance = null;
  let speechGeneration = 0;
  let watchdogTimer = null;
  const processedNodes = new WeakSet();

  let documentObserver = null;
  let messageObserver = null;
  let panelResizeObserver = null;
  let currentItemsContainer = null;
  const pendingNodes = new Set();
  let microtaskScheduled = false;

  const panel = document.createElement("section");
  panel.id = "ytce-control-panel";
  panel.setAttribute("aria-label", "YT Chat Enlarger 控制中心");
  panel.innerHTML = `
    <header class="ytce-panel-header">
      <div class="ytce-brand">
        <span class="ytce-brand-mark" aria-hidden="true"></span>
        <div>
          <strong>YT Chat Enlarger</strong>
          <span id="ytce-status-line" aria-live="polite">準備就緒</span>
        </div>
      </div>
      <button class="ytce-icon-button" id="ytce-collapse-button" type="button" aria-label="收合控制面板" aria-expanded="true">
        <span aria-hidden="true"></span>
      </button>
    </header>

    <div id="ytce-panel-body">
      <div class="ytce-mode-switch" role="group" aria-label="使用模式">
        <button type="button" data-mode="complete">完整</button>
        <button type="button" data-mode="monitor">監看</button>
        <button type="button" data-mode="reader">朗讀</button>
      </div>

      <div class="ytce-theme-switch" role="group" aria-label="介面畫風">
        <button type="button" data-theme="ember" aria-label="切換為熔岩畫風">
          <span class="ytce-theme-swatch" aria-hidden="true"></span><span>熔岩</span>
        </button>
        <button type="button" data-theme="aurora" aria-label="切換為極光畫風">
          <span class="ytce-theme-swatch" aria-hidden="true"></span><span>極光</span>
        </button>
        <button type="button" data-theme="paper" aria-label="切換為紙墨畫風">
          <span class="ytce-theme-swatch" aria-hidden="true"></span><span>紙墨</span>
        </button>
        <button type="button" data-theme="starlight" aria-label="切換為星夜畫風">
          <span class="ytce-theme-swatch" aria-hidden="true"></span><span>星夜</span>
        </button>
      </div>

      <div class="ytce-section">
        <div class="ytce-section-title">
          <span>畫面</span>
          <small>適合第二螢幕與遠距監看</small>
        </div>

        <label class="ytce-slider-row">
          <span>文字 <output id="ytce-font-value">28px</output></span>
          <input type="range" id="ytce-font-slider" min="16" max="64" step="1">
        </label>

        <label class="ytce-slider-row" id="ytce-avatar-row">
          <span>頭像 <output id="ytce-avatar-value">48px</output></span>
          <input type="range" id="ytce-avatar-slider" min="24" max="88" step="1">
        </label>

        <div class="ytce-toggle-grid">
          <label class="ytce-toggle">
            <input type="checkbox" id="ytce-hide-avatars">
            <span>隱藏頭像</span>
          </label>
          <label class="ytce-toggle">
            <input type="checkbox" id="ytce-hide-badges">
            <span>隱藏徽章</span>
          </label>
        </div>

        <label class="ytce-field">
          <span>醒目關鍵字</span>
          <input type="text" id="ytce-keywords-input" placeholder="以逗號分隔，例如：問題, 救命">
        </label>
      </div>

      <div class="ytce-section" id="ytce-tts-section">
        <div class="ytce-section-title">
          <span>語音朗讀</span>
          <label class="ytce-switch" title="開啟或關閉 TTS">
            <input type="checkbox" id="ytce-tts-toggle">
            <span aria-hidden="true"></span>
          </label>
        </div>

        <div class="ytce-two-columns">
          <label class="ytce-field">
            <span>語音模式</span>
            <select id="ytce-voice-mode-select">
              <option value="auto">自動配對語言</option>
              <option value="fixed">固定選定語音</option>
            </select>
          </label>
          <label class="ytce-field">
            <span>預設／固定語音 <small class="ytce-privacy-tip">（僅本機）</small></span>
            <select id="ytce-voice-select">
              <option value="">正在尋找本機語音…</option>
            </select>
          </label>
        </div>
        <small class="ytce-voice-hint">自動模式會依語言挑選推薦人聲；沒有公開評分，仍可切到固定語音逐一試聽。</small>

        <div class="ytce-two-columns">
          <label class="ytce-slider-row">
            <span>語速 <output id="ytce-rate-value">1.05×</output></span>
            <input type="range" id="ytce-rate-slider" min="0.7" max="1.6" step="0.05">
          </label>
          <label class="ytce-slider-row">
            <span>音量 <output id="ytce-volume-value">65%</output></span>
            <input type="range" id="ytce-volume-slider" min="0" max="100" step="1">
          </label>
        </div>

        <div class="ytce-toggle-grid">
          <label class="ytce-toggle">
            <input type="checkbox" id="ytce-read-time">
            <span>朗讀時間</span>
          </label>
          <label class="ytce-toggle">
            <input type="checkbox" id="ytce-read-name">
            <span>朗讀名字</span>
          </label>
          <label class="ytce-toggle">
            <input type="checkbox" id="ytce-read-emoji">
            <span>朗讀表情名稱</span>
          </label>
          <label class="ytce-toggle">
            <input type="checkbox" id="ytce-clean-urls">
            <span>網址改念「連結」</span>
          </label>
          <label class="ytce-toggle">
            <input type="checkbox" id="ytce-collapse-repeats">
            <span>壓縮重複文字</span>
          </label>
        </div>

        <div class="ytce-actions">
          <button type="button" id="ytce-test-voice">試聽</button>
          <button type="button" id="ytce-skip-speech">跳過</button>
          <button type="button" id="ytce-clear-speech" class="ytce-danger">清空</button>
        </div>
      </div>
    </div>
  `;

  const readerStage = document.createElement("div");
  readerStage.id = "ytce-reader-stage";
  readerStage.setAttribute("aria-live", "polite");
  readerStage.innerHTML = `
    <div class="ytce-reader-orb" aria-hidden="true"><span></span></div>
    <strong>朗讀模式</strong>
    <p id="ytce-reader-status">等待新留言</p>
  `;

  document.body.prepend(readerStage);
  document.body.prepend(panel);
  document.body.classList.add("ytce-active");
  document.documentElement.classList.add("ytce-active");

  const ui = {
    body: document.getElementById("ytce-panel-body"),
    collapseButton: document.getElementById("ytce-collapse-button"),
    statusLine: document.getElementById("ytce-status-line"),
    readerStatus: document.getElementById("ytce-reader-status"),
    modeButtons: [...panel.querySelectorAll("[data-mode]")],
    themeButtons: [...panel.querySelectorAll("[data-theme]")],
    fontSlider: document.getElementById("ytce-font-slider"),
    fontValue: document.getElementById("ytce-font-value"),
    avatarSlider: document.getElementById("ytce-avatar-slider"),
    avatarValue: document.getElementById("ytce-avatar-value"),
    avatarRow: document.getElementById("ytce-avatar-row"),
    hideAvatars: document.getElementById("ytce-hide-avatars"),
    hideBadges: document.getElementById("ytce-hide-badges"),
    keywords: document.getElementById("ytce-keywords-input"),
    ttsSection: document.getElementById("ytce-tts-section"),
    ttsToggle: document.getElementById("ytce-tts-toggle"),
    voiceModeSelect: document.getElementById("ytce-voice-mode-select"),
    voiceSelect: document.getElementById("ytce-voice-select"),
    rateSlider: document.getElementById("ytce-rate-slider"),
    rateValue: document.getElementById("ytce-rate-value"),
    volumeSlider: document.getElementById("ytce-volume-slider"),
    volumeValue: document.getElementById("ytce-volume-value"),
    readTime: document.getElementById("ytce-read-time"),
    readName: document.getElementById("ytce-read-name"),
    readEmoji: document.getElementById("ytce-read-emoji"),
    cleanUrls: document.getElementById("ytce-clean-urls"),
    collapseRepeats: document.getElementById("ytce-collapse-repeats"),
    testVoice: document.getElementById("ytce-test-voice"),
    skipSpeech: document.getElementById("ytce-skip-speech"),
    clearSpeech: document.getElementById("ytce-clear-speech")
  };

  function syncPanelOffset() {
    const panelHeight = Math.ceil(panel.getBoundingClientRect().height);
    document.documentElement.style.setProperty(
      "--ytce-panel-offset",
      `${Math.max(84, panelHeight + 16)}px`
    );
  }

  syncPanelOffset();
  if (typeof ResizeObserver === "function") {
    panelResizeObserver = new ResizeObserver(syncPanelOffset);
    panelResizeObserver.observe(panel);
  }
  window.addEventListener("resize", syncPanelOffset);

  function clampNumber(value, min, max, fallback) {
    if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
    return Math.min(max, Math.max(min, value));
  }

  function sanitizeSettings(value) {
    if (!value || typeof value !== "object") return { ...DEFAULT_SETTINGS };

    const sanitized = { ...DEFAULT_SETTINGS };

    if (typeof value.mode === "string" && VALID_MODES.includes(value.mode)) {
      sanitized.mode = value.mode;
    }
    if (typeof value.theme === "string" && VALID_THEMES.includes(value.theme)) {
      sanitized.theme = value.theme;
    }

    const boolKeys = [
      "isCollapsed",
      "ttsEnabled",
      "ttsReadName",
      "ttsReadTime",
      "readEmoji",
      "cleanUrls",
      "collapseRepeats",
      "hideAvatars",
      "hideBadges"
    ];
    boolKeys.forEach((key) => {
      if (typeof value[key] === "boolean") {
        sanitized[key] = value[key];
      }
    });

    if (typeof value.ttsVoiceMode === "string" && VALID_VOICE_MODES.includes(value.ttsVoiceMode)) {
      sanitized.ttsVoiceMode = value.ttsVoiceMode;
    }
    if (typeof value.ttsVoiceURI === "string") {
      sanitized.ttsVoiceURI = value.ttsVoiceURI.slice(0, 512);
    }
    if (typeof value.highlightKeywords === "string") {
      sanitized.highlightKeywords = value.highlightKeywords;
    }

    sanitized.fontSize = clampNumber(value.fontSize, 16, 64, DEFAULT_SETTINGS.fontSize);
    sanitized.avatarSize = clampNumber(value.avatarSize, 24, 88, DEFAULT_SETTINGS.avatarSize);
    sanitized.ttsVolume = clampNumber(value.ttsVolume, 0, 100, DEFAULT_SETTINGS.ttsVolume);
    sanitized.ttsRate = clampNumber(value.ttsRate, 0.7, 1.6, DEFAULT_SETTINGS.ttsRate);
    sanitized.ttsPitch = clampNumber(value.ttsPitch, 0.5, 2.0, DEFAULT_SETTINGS.ttsPitch);
    sanitized.maxMessageLength = clampNumber(value.maxMessageLength, 30, 300, DEFAULT_SETTINGS.maxMessageLength);
    sanitized.queueLimit = clampNumber(value.queueLimit, 3, 50, DEFAULT_SETTINGS.queueLimit);
    sanitized.staleAfterSeconds = clampNumber(value.staleAfterSeconds, 5, 120, DEFAULT_SETTINGS.staleAfterSeconds);

    return sanitized;
  }

  function scheduleSave() {
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(async () => {
      saveTimer = null;
      if (isCleanedUp || !window.chrome?.storage?.local?.set) return;
      try {
        await chrome.storage.local.set({ ...settings });
      } catch {
        updateSpeechStatus("設定暫時無法儲存");
      }
    }, 250);
  }

  function handleStorageChange(changes, areaName) {
    if (areaName !== "local" || isCleanedUp) return;

    const wasSpeaking = shouldSpeak();
    let hasChange = false;
    const nextSettings = { ...settings };

    for (const [key, change] of Object.entries(changes)) {
      if (Object.prototype.hasOwnProperty.call(DEFAULT_SETTINGS, key)) {
        if (change && "newValue" in change) {
          nextSettings[key] = change.newValue;
          hasChange = true;
        }
      }
    }

    if (hasChange) {
      settings = sanitizeSettings(nextSettings);
      applySettings({ save: false });
      populateVoices();
      if (wasSpeaking && !shouldSpeak()) {
        stopSpeech({ clearQueue: true });
      } else if (shouldSpeak()) {
        speakNext();
      }
    }
  }

  function refreshKeywords() {
    keywordList = settings.highlightKeywords
      .split(/[,，]/)
      .map((keyword) => keyword.trim().toLocaleLowerCase())
      .filter(Boolean);
  }

  function stringToColor(value) {
    let hash = 0;
    for (let index = 0; index < value.length; index += 1) {
      hash = value.charCodeAt(index) + ((hash << 5) - hash);
    }
    return `hsl(${Math.abs(hash) % 360} 72% 72%)`;
  }

  function extractText(node) {
    if (!node) return "";
    const clone = node.cloneNode(true);
    clone.querySelectorAll("img").forEach((image) => {
      image.replaceWith(settings.readEmoji ? image.alt || "" : "");
    });
    return clone.textContent.replace(/\s+/g, " ").trim();
  }

  function normalizeForSpeech(rawMessage) {
    let message = rawMessage.replace(/\s+/g, " ").trim();
    if (!message) return "";

    if (settings.cleanUrls) {
      message = message.replace(/https?:\/\/\S+|www\.\S+/gi, " 連結 ");
    }

    if (!settings.readEmoji) {
      message = message.replace(/\p{Extended_Pictographic}/gu, "");
    }

    if (settings.collapseRepeats) {
      message = message
        .replace(/(.)\1{4,}/gu, "$1$1$1")
        .replace(/([!?！？。～~])\1{2,}/gu, "$1$1");
    }

    message = message.replace(/\s+/g, " ").trim();
    if (!message) return "";

    if (message.length > settings.maxMessageLength) {
      message = `${message.slice(0, settings.maxMessageLength)}，後略`;
    }
    return message;
  }

  function getMessageData(node) {
    const tagName = node.tagName.toLowerCase();
    const timestampNode = node.querySelector("#timestamp");
    const timestamp = extractText(timestampNode);
    const authorNode = node.querySelector("#author-name");
    const author = extractText(authorNode) || "觀眾";

    let messageNode = node.querySelector("#message");
    if (!messageNode) {
      messageNode = node.querySelector("#header-subtext, #content");
    }

    let message = "";
    if (messageNode) {
      const clone = messageNode.cloneNode(true);
      clone.querySelectorAll("#timestamp, #author-name, #author-info, #chip-badges, #header").forEach((el) => el.remove());
      clone.querySelectorAll("img").forEach((image) => {
        image.replaceWith(settings.readEmoji ? image.alt || "" : "");
      });
      message = clone.textContent.replace(/\s+/g, " ").trim();
    }

    let type = "一般留言";

    if (tagName.includes("paid-message")) type = "Super Chat";
    if (tagName.includes("paid-sticker")) {
      type = "Super Sticker";
      const amount = extractText(node.querySelector("#purchase-amount"));
      message = message || `傳送了 Super Sticker${amount ? `，${amount}` : ""}`;
    }
    if (tagName.includes("membership-item")) {
      type = "會員訊息";
      message = message || "成為了頻道會員";
    }
    if (tagName.includes("gift-purchase")) {
      type = "會員贈送";
      message = message || extractText(node.querySelector("#primary-text")) || "贈送了頻道會員";
    }
    if (tagName.includes("gift-redemption")) {
      type = "會員禮物";
      message = message || "獲得了頻道會員";
    }

    return { author, message, type, timestamp };
  }

  function applyHighlight(node, message) {
    const normalized = message.toLocaleLowerCase();
    const highlighted = keywordList.some((keyword) => normalized.includes(keyword));
    node.classList.toggle("ytce-highlighted", highlighted);
  }

  function shouldSpeak() {
    return settings.ttsEnabled && settings.mode !== "monitor";
  }

  function getLocalVoices() {
    if (!window.speechSynthesis || typeof window.speechSynthesis.getVoices !== "function") {
      return [];
    }
    const voices = window.speechSynthesis.getVoices() || [];
    return voices.filter((voice) => voice && voice.localService === true);
  }

  function getSelectedVoice() {
    const localVoices = getLocalVoices();
    if (!settings.ttsVoiceURI) return null;
    return localVoices.find((voice) => voice.voiceURI === settings.ttsVoiceURI) || null;
  }

  function normalizeVoiceLang(value) {
    return String(value || "").toLowerCase().replaceAll("_", "-");
  }

  function voiceQualityScore(voice, langTag = "") {
    const name = String(voice?.name || "");
    const lowerName = name.toLocaleLowerCase();
    const voiceLang = normalizeVoiceLang(voice?.lang);
    let score = 0;

    if (voice?.default) score += 350;
    if (/premium|enhanced|natural|neural|高品質|進階|優質/iu.test(name)) score += 300;
    if (!/[()（）]/u.test(name)) score += 40;
    if (/compact/iu.test(name)) score -= 240;
    if (/eddy|flo|grandma|grandpa|reed|rocko|sandy|shelley|bahh|bells|boing|bubbles|cellos|jester|organ|trinoids|whisper|wobble|zarvox/iu.test(lowerName)) {
      score -= 260;
    }

    const standardVoiceNames = {
      ja: /siri|kyoko|otoya|響|京子/iu,
      ko: /yuna|유나/iu,
      zh: /美佳|mei[- ]?jia|meijia|sin[- ]?ji|ting[- ]?ting|tingting/iu,
      en: /siri|samantha|serena|alex|ava|daniel|karen|moira|tessa|rishi/iu,
      es: /siri|marisol|jorge|mónica|monica|paulina/iu,
      fr: /amélie|amelie|jacques/iu,
      de: /anna/iu,
      it: /alice/iu,
      pt: /luciana/iu,
      ru: /milena|yuri/iu,
      ar: /majed/iu
    };
    const baseLang = langTag === "cyrl" ? "ru" : String(langTag || voiceLang).split("-")[0];
    if (standardVoiceNames[baseLang]?.test(name)) score += 220;

    if (langTag === "zh" && /^zh-(tw|hant)/iu.test(voiceLang)) score += 160;
    if (langTag && voiceLang === normalizeVoiceLang(langTag)) score += 80;

    return score;
  }

  function pickRecommendedVoice(voices, langTag = "") {
    if (!Array.isArray(voices) || voices.length === 0) return null;
    return [...voices].sort((left, right) => {
      const scoreDifference = voiceQualityScore(right, langTag) - voiceQualityScore(left, langTag);
      if (scoreDifference !== 0) return scoreDifference;
      return String(left.name || "").localeCompare(String(right.name || ""));
    })[0] || null;
  }

  function getFallbackVoice(localVoices = getLocalVoices()) {
    const selectedVoice = localVoices.find((voice) => voice.voiceURI === settings.ttsVoiceURI);
    return selectedVoice ||
      pickRecommendedVoice(localVoices.filter((voice) => /^zh-(TW|Hant)/i.test(voice.lang)), "zh") ||
      pickRecommendedVoice(localVoices.filter((voice) => /^zh/i.test(voice.lang)), "zh") ||
      pickRecommendedVoice(localVoices) || null;
  }

  function getUsableVoice(localVoices = getLocalVoices()) {
    return settings.ttsVoiceMode === "fixed"
      ? getSelectedVoice()
      : getFallbackVoice(localVoices);
  }

  function detectLanguageTag(text) {
    if (!text || typeof text !== "string") return null;

    const clean = text
      .replace(/https?:\/\/\S+|www\.\S+/giu, "")
      .replace(/[\s\d\p{P}\p{S}\p{Extended_Pictographic}]/gu, "");
    if (clean.length === 0) return null;

    const kanaMatches = clean.match(/[\p{Script=Hiragana}\p{Script=Katakana}]/gu);
    const kanaCount = kanaMatches ? kanaMatches.length : 0;

    const hangulMatches = clean.match(/\p{Script=Hangul}/gu);
    const hangulCount = hangulMatches ? hangulMatches.length : 0;

    const hanMatches = clean.match(/\p{Script=Han}/gu);
    const hanCount = hanMatches ? hanMatches.length : 0;

    const arabicMatches = clean.match(/\p{Script=Arabic}/gu);
    const arabicCount = arabicMatches ? arabicMatches.length : 0;

    const hebrewMatches = clean.match(/\p{Script=Hebrew}/gu);
    const hebrewCount = hebrewMatches ? hebrewMatches.length : 0;

    const greekMatches = clean.match(/\p{Script=Greek}/gu);
    const greekCount = greekMatches ? greekMatches.length : 0;

    const thaiMatches = clean.match(/\p{Script=Thai}/gu);
    const thaiCount = thaiMatches ? thaiMatches.length : 0;

    const devanagariMatches = clean.match(/\p{Script=Devanagari}/gu);
    const devanagariCount = devanagariMatches ? devanagariMatches.length : 0;

    const cyrillicMatches = clean.match(/\p{Script=Cyrillic}/gu);
    const cyrillicCount = cyrillicMatches ? cyrillicMatches.length : 0;

    const latinMatches = clean.match(/\p{Script=Latin}/gu);
    const latinCount = latinMatches ? latinMatches.length : 0;

    if (kanaCount > 0) return "ja";

    if (latinCount > 0) {
      const lowerText = text.toLocaleLowerCase();
      const tokens = lowerText.match(/\p{Script=Latin}+/gu) || [];
      const hints = {
        es: ["hola", "gracias", "buenas", "amigo", "amiga", "para", "porque", "como", "usted"],
        fr: ["bonjour", "merci", "salut", "avec", "pour", "vous", "nous", "très", "être"],
        de: ["hallo", "danke", "bitte", "nicht", "guten", "ich", "du", "und", "für"],
        pt: ["olá", "obrigado", "obrigada", "você", "vocês", "não", "para", "bom", "boa"],
        it: ["ciao", "grazie", "buongiorno", "buonasera", "per", "che", "non", "come"],
        id: ["halo", "terima", "kasih", "yang", "untuk", "tidak", "apa", "dan"],
        tr: ["merhaba", "teşekkür", "için", "değil", "nasıl", "bir", "ve"],
        vi: ["xin", "chào", "cảm", "ơn", "không", "bạn", "và", "cho"]
      };
      const distinctivePatterns = [
        ["vi", /[ăâđêôơưàảãạằắẳẵặầấẩẫậèẻẽẹềếểễệìỉĩịòỏõọồốổỗộờớởỡợùủũụừứửữựỳỷỹỵ]/iu],
        ["tr", /[ğış]/iu],
        ["pt", /[ãõ]/iu],
        ["de", /ß/u],
        ["es", /[¿¡ñ]/iu],
        ["fr", /[œç]/iu]
      ];
      const distinctive = distinctivePatterns.find(([, pattern]) => pattern.test(lowerText));
      if (distinctive) return distinctive[0];

      const scored = Object.entries(hints)
        .map(([tag, words]) => ({ tag, count: tokens.filter((token) => words.includes(token)).length }))
        .sort((left, right) => right.count - left.count);
      if (scored[0]?.count >= 2 && scored[0].count > (scored[1]?.count || 0)) return scored[0].tag;
      if (tokens.length === 1) {
        const greeting = scored.find(({ count }) => count === 1);
        if (greeting) return greeting.tag;
      }
    }

    const counts = [
      { tag: "ko", count: hangulCount },
      { tag: "zh", count: hanCount },
      { tag: "ar", count: arabicCount },
      { tag: "he", count: hebrewCount },
      { tag: "el", count: greekCount },
      { tag: "th", count: thaiCount },
      { tag: "deva", count: devanagariCount },
      { tag: "cyrl", count: cyrillicCount },
      { tag: "en", count: latinCount }
    ];

    counts.sort((a, b) => b.count - a.count);

    const top = counts[0];
    const runnerUp = counts[1];
    if (!top || top.count === 0) return null;
    if (runnerUp && runnerUp.count > 0 && top.count / runnerUp.count < 1.5) return null;
    return top.tag;
  }

  function isVoiceMatchLang(voice, langTag) {
    if (!voice || !voice.lang) return false;
    const vlang = voice.lang.toLowerCase();
    switch (langTag) {
      case "zh":
        return vlang.startsWith("zh");
      case "ja":
        return vlang.startsWith("ja");
      case "ko":
        return vlang.startsWith("ko");
      case "en":
        return vlang.startsWith("en");
      case "ar":
        return vlang.startsWith("ar");
      case "he":
        return vlang.startsWith("he");
      case "el":
        return vlang.startsWith("el");
      case "th":
        return vlang.startsWith("th");
      case "deva":
        return /^(hi|mr|ne)/i.test(vlang);
      case "cyrl":
        return /^(ru|uk|bg|be|sr|mk|ky)/i.test(vlang);
      default:
        return vlang === langTag || vlang.startsWith(`${langTag}-`);
    }
  }

  function findLocalVoiceForLang(localVoices, langTag) {
    if (!Array.isArray(localVoices) || localVoices.length === 0) return null;
    const matchingVoices = localVoices.filter((voice) => isVoiceMatchLang(voice, langTag));
    return pickRecommendedVoice(matchingVoices, langTag);
  }

  function resolveVoiceForText(text, currentSettings, localVoices) {
    const selectedVoice = getSelectedVoice();
    const fallbackVoice = getFallbackVoice(localVoices);
    if (currentSettings.ttsVoiceMode !== "auto") {
      return selectedVoice;
    }

    const langTag = detectLanguageTag(text);
    if (!langTag) {
      return fallbackVoice;
    }

    if (selectedVoice && isVoiceMatchLang(selectedVoice, langTag)) {
      return selectedVoice;
    }

    const matched = findLocalVoiceForLang(localVoices, langTag);
    return matched || fallbackVoice;
  }

  function getVoicePreviewText(voice) {
    const lang = String(voice?.lang || "").toLowerCase().split("-")[0];
    const samples = {
      ar: "مرحبًا، القراءة الصوتية جاهزة.",
      de: "Hallo, die Sprachausgabe ist bereit.",
      en: "Hello, voice reading is ready.",
      es: "Hola, la lectura por voz está lista.",
      fr: "Bonjour, la lecture vocale est prête.",
      he: "שלום, ההקראה הקולית מוכנה.",
      hi: "नमस्ते, वॉइस रीडिंग तैयार है।",
      it: "Ciao, la lettura vocale è pronta.",
      ja: "こんにちは。音声読み上げの準備ができました。",
      ko: "안녕하세요. 음성 읽기가 준비되었습니다.",
      pt: "Olá, a leitura por voz está pronta.",
      ru: "Здравствуйте, голосовое чтение готово.",
      th: "สวัสดี ระบบอ่านออกเสียงพร้อมแล้ว",
      tr: "Merhaba, sesli okuma hazır.",
      vi: "Xin chào, tính năng đọc bằng giọng nói đã sẵn sàng.",
      zh: "語音朗讀已開啟。"
    };
    return samples[lang] || "Voice reading is ready.";
  }

  function updateSpeechStatus(message = "") {
    const queueText = ttsQueue.length ? ` · 等待 ${ttsQueue.length} 則` : "";
    let state = "語音未開啟";
    if (settings.ttsEnabled && settings.mode === "monitor") {
      state = "監看模式 · 語音暫停";
    } else if (shouldSpeak() && activeUtterance) {
      state = "朗讀中";
    } else if (shouldSpeak() && !getUsableVoice()) {
      state = settings.ttsVoiceMode === "fixed"
        ? "固定語音不可用 · 請重新選擇"
        : "自動配對 · 等待本機語音";
    } else if (shouldSpeak()) {
      state = settings.ttsVoiceMode === "auto" ? "自動配對 · 語音已開啟" : "固定語音 · 已開啟";
    }
    ui.statusLine.textContent = message || `${state}${queueText}`;
    ui.readerStatus.textContent = message || (activeUtterance ? "正在朗讀留言" : "等待新留言");
    readerStage.classList.toggle("is-speaking", Boolean(activeUtterance));
  }

  function clearWatchdog() {
    if (watchdogTimer) {
      window.clearTimeout(watchdogTimer);
      watchdogTimer = null;
    }
  }

  function finishUtterance(generation) {
    if (generation !== speechGeneration || isCleanedUp) return;
    clearWatchdog();
    activeUtterance = null;
    updateSpeechStatus();
    speakNext();
  }

  function safeSpeak(utterance, generation) {
    try {
      clearWatchdog();
      const textLen = (utterance.text || "").length;
      const rate = utterance.rate || 1;
      const timeoutMs = Math.min(180000, Math.max(10000, Math.round((textLen * 400) / rate + 5000)));

      watchdogTimer = window.setTimeout(() => {
        if (generation === speechGeneration) {
          try {
            window.speechSynthesis.cancel();
          } catch (_) {}
          finishUtterance(generation);
        }
      }, timeoutMs);

      window.speechSynthesis.speak(utterance);
    } catch {
      finishUtterance(generation);
    }
  }

  function startUtterance(utterance, statusMessage = "") {
    const generation = ++speechGeneration;
    activeUtterance = utterance;
    utterance.onend = () => finishUtterance(generation);
    utterance.onerror = () => finishUtterance(generation);
    updateSpeechStatus(statusMessage);
    safeSpeak(utterance, generation);
  }

  function speakNext() {
    if (activeUtterance || !shouldSpeak()) {
      updateSpeechStatus();
      return;
    }

    const staleBefore = Date.now() - settings.staleAfterSeconds * 1000;
    while (ttsQueue.length && ttsQueue[0].queuedAt < staleBefore) ttsQueue.shift();

    const localVoices = getLocalVoices();
    const usableVoice = getUsableVoice(localVoices);
    if (!usableVoice) {
      updateSpeechStatus(settings.ttsVoiceMode === "fixed"
        ? "固定語音不可用 · 請重新選擇"
        : "自動配對 · 等待本機語音");
      return;
    }

    const next = ttsQueue.shift();
    if (!next) {
      updateSpeechStatus();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(next.text);
    const voiceToUse = resolveVoiceForText(next.languageText, settings, localVoices) || usableVoice;

    utterance.voice = voiceToUse;
    utterance.lang = voiceToUse.lang;

    utterance.volume = settings.ttsVolume / 100;
    utterance.rate = settings.ttsRate;
    utterance.pitch = settings.ttsPitch;

    startUtterance(utterance);
  }

  function stopSpeech({ clearQueue = false, continueQueue = false } = {}) {
    clearWatchdog();
    speechGeneration += 1;
    activeUtterance = null;
    if (clearQueue) ttsQueue = [];
    try {
      window.speechSynthesis.cancel();
    } catch (_) {}
    updateSpeechStatus(clearQueue ? "語音佇列已清空" : "已跳過目前留言");
    if (continueQueue && shouldSpeak()) window.queueMicrotask(speakNext);
  }

  function queueSpeech(author, rawMessage, type, timestamp) {
    if (!shouldSpeak()) return;
    const message = normalizeForSpeech(rawMessage);
    if (!message) return;

    const prefix = type === "一般留言" ? "" : `${type}，`;
    const timeText = (settings.ttsReadTime && timestamp) ? `${timestamp}，` : "";
    const nameText = settings.ttsReadName ? `${author}說：` : "";
    const text = `${prefix}${timeText}${nameText}${message}`;

    while (ttsQueue.length >= settings.queueLimit) ttsQueue.shift();
    ttsQueue.push({ text, languageText: rawMessage, queuedAt: Date.now() });
    updateSpeechStatus();
    speakNext();
  }

  function processRenderer(node, { speak = true } = {}) {
    if (!(node instanceof Element) || processedNodes.has(node)) return;
    const data = getMessageData(node);
    if (!data.message) return;

    processedNodes.add(node);
    const authorNode = node.querySelector("#author-name");
    if (authorNode) {
      authorNode.style.setProperty("--ytce-author-color", stringToColor(data.author));
      authorNode.classList.add("ytce-colored-author");
    }

    applyHighlight(node, data.message);
    if (speak) queueSpeech(data.author, data.message, data.type, data.timestamp);
  }

  function collectRenderers(node) {
    if (!(node instanceof Element)) return [];
    const renderers = new Set();
    if (node.matches(RENDERER_SELECTOR)) renderers.add(node);
    const parent = node.closest(RENDERER_SELECTOR);
    if (parent) renderers.add(parent);
    node.querySelectorAll(RENDERER_SELECTOR).forEach((renderer) => renderers.add(renderer));
    return [...renderers];
  }

  function processPendingNodes() {
    if (isCleanedUp) return;
    const nodesToProcess = Array.from(pendingNodes);
    pendingNodes.clear();
    microtaskScheduled = false;

    for (const node of nodesToProcess) {
      processRenderer(node);
    }
  }

  function scheduleNodeProcessing(renderers) {
    for (const renderer of renderers) {
      if (!processedNodes.has(renderer)) {
        pendingNodes.add(renderer);
      }
    }

    if (pendingNodes.size > 0 && !microtaskScheduled) {
      microtaskScheduled = true;
      window.queueMicrotask(processPendingNodes);
    }
  }

  function refreshVisibleMessages() {
    document.querySelectorAll(RENDERER_SELECTOR).forEach((node) => {
      const data = getMessageData(node);
      if (data.message) applyHighlight(node, data.message);
    });
  }

  function populateVoices() {
    const localVoices = getLocalVoices();
    const currentValue = settings.ttsVoiceURI;
    ui.voiceSelect.replaceChildren();

    const recommendedUris = new Set();
    const languageGroups = new Map();
    localVoices.forEach((voice) => {
      const baseLang = normalizeVoiceLang(voice.lang).split("-")[0] || "und";
      if (!languageGroups.has(baseLang)) languageGroups.set(baseLang, []);
      languageGroups.get(baseLang).push(voice);
    });
    languageGroups.forEach((voices, baseLang) => {
      const recommended = pickRecommendedVoice(voices, baseLang);
      if (recommended) recommendedUris.add(recommended.voiceURI);
    });

    localVoices
      .sort((left, right) => {
        const languageDifference = normalizeVoiceLang(left.lang).localeCompare(normalizeVoiceLang(right.lang));
        if (languageDifference !== 0) return languageDifference;
        const recommendationDifference = Number(recommendedUris.has(right.voiceURI)) - Number(recommendedUris.has(left.voiceURI));
        return recommendationDifference || left.name.localeCompare(right.name);
      })
      .forEach((voice) => {
        const recommendation = recommendedUris.has(voice.voiceURI) ? " · 推薦" : "";
        const label = `${voice.name} · ${voice.lang}${recommendation}`;
        ui.voiceSelect.add(new Option(label, voice.voiceURI));
      });

    const currentVoice = localVoices.find((voice) => voice.voiceURI === currentValue);
    const preferredVoice = currentVoice || getFallbackVoice(localVoices);

    if (settings.ttsVoiceMode === "fixed" && settings.ttsVoiceURI && !currentVoice) {
      const missing = new Option("原本的固定語音已不可用，請重新選擇", "");
      missing.disabled = true;
      ui.voiceSelect.add(missing, 0);
      ui.voiceSelect.disabled = false;
      ui.voiceSelect.value = "";
    } else if (preferredVoice) {
      ui.voiceSelect.disabled = false;
      ui.voiceSelect.value = preferredVoice.voiceURI;
    } else {
      const unavailable = new Option("找不到明確標示為本機的語音", "");
      unavailable.disabled = true;
      ui.voiceSelect.add(unavailable);
      ui.voiceSelect.disabled = true;
    }

    if (shouldSpeak() && !activeUtterance) speakNext();
  }

  function syncControls() {
    ui.modeButtons.forEach((button) => {
      const selected = button.dataset.mode === settings.mode;
      button.classList.toggle("is-active", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
    ui.themeButtons.forEach((button) => {
      const selected = button.dataset.theme === settings.theme;
      button.classList.toggle("is-active", selected);
      button.setAttribute("aria-pressed", String(selected));
    });

    ui.fontSlider.value = settings.fontSize;
    ui.fontValue.value = `${settings.fontSize}px`;
    ui.avatarSlider.value = settings.avatarSize;
    ui.avatarValue.value = `${settings.avatarSize}px`;
    ui.hideAvatars.checked = settings.hideAvatars;
    ui.hideBadges.checked = settings.hideBadges;
    ui.keywords.value = settings.highlightKeywords;
    ui.ttsToggle.checked = settings.ttsEnabled;
    ui.voiceModeSelect.value = settings.ttsVoiceMode;
    const savedVoiceIsVisible = [...ui.voiceSelect.options]
      .some((option) => option.value === settings.ttsVoiceURI && option.value !== "");
    if (savedVoiceIsVisible) {
      ui.voiceSelect.value = settings.ttsVoiceURI;
    } else if (settings.ttsVoiceMode === "fixed") {
      ui.voiceSelect.value = "";
    }
    ui.rateSlider.value = settings.ttsRate;
    ui.rateValue.value = `${Number(settings.ttsRate).toFixed(2)}×`;
    ui.volumeSlider.value = settings.ttsVolume;
    ui.volumeValue.value = `${settings.ttsVolume}%`;
    ui.readTime.checked = settings.ttsReadTime;
    ui.readName.checked = settings.ttsReadName;
    ui.readEmoji.checked = settings.readEmoji;
    ui.cleanUrls.checked = settings.cleanUrls;
    ui.collapseRepeats.checked = settings.collapseRepeats;
  }

  function applySettings({ save = true } = {}) {
    const rootStyle = document.documentElement.style;
    rootStyle.setProperty("--ytce-font-size", `${settings.fontSize}px`);
    rootStyle.setProperty("--ytce-avatar-size", `${settings.avatarSize}px`);
    rootStyle.setProperty("--ytce-line-height", `${Math.round(settings.fontSize * 1.38)}px`);

    document.body.classList.toggle("ytce-hide-avatars", settings.hideAvatars);
    document.body.classList.toggle("ytce-hide-badges", settings.hideBadges);
    document.body.dataset.ytceMode = settings.mode;
    document.body.dataset.ytceTheme = settings.theme;
    document.documentElement.dataset.ytceMode = settings.mode;
    document.documentElement.dataset.ytceTheme = settings.theme;
    ui.avatarRow.hidden = settings.hideAvatars;
    ui.ttsSection.classList.toggle("is-muted", settings.mode === "monitor");

    ui.body.hidden = settings.isCollapsed;
    ui.collapseButton.setAttribute("aria-expanded", String(!settings.isCollapsed));
    ui.collapseButton.setAttribute(
      "aria-label",
      settings.isCollapsed ? "展開控制面板" : "收合控制面板"
    );
    refreshKeywords();
    syncControls();
    updateSpeechStatus();
    syncPanelOffset();
    if (save) scheduleSave();
  }

  function bindRange(input, output, key, formatter) {
    input.addEventListener("input", () => {
      settings[key] = Number(input.value);
      output.value = formatter(settings[key]);
      applySettings();
    });
  }

  ui.collapseButton.addEventListener("click", () => {
    settings.isCollapsed = !settings.isCollapsed;
    applySettings();
  });

  ui.modeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      settings.mode = button.dataset.mode;
      if (settings.mode === "reader") settings.ttsEnabled = Boolean(getUsableVoice());
      if (settings.mode === "monitor") stopSpeech({ clearQueue: true });
      applySettings();
      if (shouldSpeak()) {
        speakNext();
      } else if (settings.mode === "reader") {
        updateSpeechStatus("找不到可用的本機語音");
      }
    });
  });

  ui.themeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      settings.theme = button.dataset.theme;
      applySettings();
    });
  });

  bindRange(ui.fontSlider, ui.fontValue, "fontSize", (value) => `${value}px`);
  bindRange(ui.avatarSlider, ui.avatarValue, "avatarSize", (value) => `${value}px`);
  bindRange(ui.rateSlider, ui.rateValue, "ttsRate", (value) => `${value.toFixed(2)}×`);
  bindRange(ui.volumeSlider, ui.volumeValue, "ttsVolume", (value) => `${value}%`);

  [
    [ui.hideAvatars, "hideAvatars"],
    [ui.hideBadges, "hideBadges"],
    [ui.readTime, "ttsReadTime"],
    [ui.readName, "ttsReadName"],
    [ui.readEmoji, "readEmoji"],
    [ui.cleanUrls, "cleanUrls"],
    [ui.collapseRepeats, "collapseRepeats"]
  ].forEach(([input, key]) => {
    input.addEventListener("change", () => {
      settings[key] = input.checked;
      applySettings();
    });
  });

  ui.keywords.addEventListener("input", () => {
    settings.highlightKeywords = ui.keywords.value;
    refreshKeywords();
    refreshVisibleMessages();
    scheduleSave();
  });

  ui.ttsToggle.addEventListener("change", () => {
    settings.ttsEnabled = ui.ttsToggle.checked;
    if (!settings.ttsEnabled) {
      stopSpeech({ clearQueue: true });
    } else {
      const voice = getUsableVoice();
      if (!voice) {
        applySettings();
        updateSpeechStatus("正在等待本機語音");
        return;
      }
      const confirmation = new SpeechSynthesisUtterance(getVoicePreviewText(voice));
      confirmation.voice = voice;
      confirmation.lang = voice.lang;
      confirmation.volume = settings.ttsVolume / 100;
      confirmation.rate = settings.ttsRate;
      startUtterance(confirmation, "語音朗讀已開啟");
    }
    applySettings();
  });

  ui.voiceModeSelect.addEventListener("change", () => {
    settings.ttsVoiceMode = ui.voiceModeSelect.value;
    if (settings.ttsVoiceMode === "fixed" && !getSelectedVoice()) {
      const visibleVoice = getLocalVoices().find((voice) => voice.voiceURI === ui.voiceSelect.value);
      if (visibleVoice) settings.ttsVoiceURI = visibleVoice.voiceURI;
    }
    applySettings();
    populateVoices();
    if (shouldSpeak()) speakNext();
  });

  ui.voiceSelect.addEventListener("change", () => {
    settings.ttsVoiceURI = ui.voiceSelect.value;
    applySettings();
  });

  ui.testVoice.addEventListener("click", () => {
    const localVoices = getLocalVoices();
    const voice = localVoices.find((candidate) => candidate.voiceURI === ui.voiceSelect.value) ||
      getUsableVoice(localVoices);
    if (!voice) {
      updateSpeechStatus("找不到可用的本機語音");
      return;
    }
    stopSpeech({ clearQueue: false, continueQueue: false });
    const test = new SpeechSynthesisUtterance(getVoicePreviewText(voice));
    test.voice = voice;
    test.lang = voice.lang;
    test.volume = settings.ttsVolume / 100;
    test.rate = settings.ttsRate;
    test.pitch = settings.ttsPitch;

    startUtterance(test, "語音試聽中…");
  });

  ui.skipSpeech.addEventListener("click", () => {
    stopSpeech({ continueQueue: true });
  });

  ui.clearSpeech.addEventListener("click", () => {
    stopSpeech({ clearQueue: true });
  });

  function setupMessageObserver(itemsContainer) {
    if (currentItemsContainer === itemsContainer && messageObserver) return;

    if (messageObserver) {
      messageObserver.disconnect();
      messageObserver = null;
    }

    currentItemsContainer = itemsContainer;
    if (!itemsContainer) return;

    itemsContainer.querySelectorAll(RENDERER_SELECTOR).forEach((node) => {
      processRenderer(node, { speak: false });
    });

    messageObserver = new MutationObserver((mutations) => {
      const renderersToSchedule = [];
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          collectRenderers(node).forEach((renderer) => renderersToSchedule.push(renderer));
        });
      });
      if (renderersToSchedule.length > 0) {
        scheduleNodeProcessing(renderersToSchedule);
      }
    });

    messageObserver.observe(itemsContainer, { childList: true, subtree: true });
  }

  function startDiscoveryObserver() {
    const checkItems = () => {
      const itemsContainer = document.querySelector("#items.yt-live-chat-item-list-renderer");
      if (itemsContainer !== currentItemsContainer) {
        setupMessageObserver(itemsContainer);
      }
    };

    checkItems();

    documentObserver = new MutationObserver(() => {
      if (currentItemsContainer?.isConnected) return;
      checkItems();
    });

    if (document.documentElement || document.body) {
      documentObserver.observe(document.documentElement || document.body, {
        childList: true,
        subtree: true
      });
    }
  }

  function cleanup() {
    if (isCleanedUp) return;
    isCleanedUp = true;
    window.clearTimeout(saveTimer);
    saveTimer = null;
    clearWatchdog();

    if (documentObserver) {
      documentObserver.disconnect();
      documentObserver = null;
    }
    if (messageObserver) {
      messageObserver.disconnect();
      messageObserver = null;
    }
    if (panelResizeObserver) {
      panelResizeObserver.disconnect();
      panelResizeObserver = null;
    }
    currentItemsContainer = null;

    if (window.chrome?.storage?.onChanged?.removeListener) {
      try {
        chrome.storage.onChanged.removeListener(handleStorageChange);
      } catch (_) {}
    }

    window.speechSynthesis?.removeEventListener("voiceschanged", populateVoices);
    window.removeEventListener("resize", syncPanelOffset);
    window.removeEventListener("pagehide", cleanup);
    window.removeEventListener("unload", cleanup);

    try {
      window.speechSynthesis?.cancel();
    } catch (_) {}

    ttsQueue = [];
    activeUtterance = null;
    pendingNodes.clear();
  }

  async function initialize() {
    let stored = DEFAULT_SETTINGS;
    try {
      stored = await chrome.storage.local.get(DEFAULT_SETTINGS);
    } catch {
      updateSpeechStatus("無法讀取設定，已使用預設值");
    }
    if (isCleanedUp) return;
    settings = sanitizeSettings(stored);
    applySettings({ save: false });
    populateVoices();
    startDiscoveryObserver();
  }

  if (window.chrome?.storage?.onChanged?.addListener) {
    chrome.storage.onChanged.addListener(handleStorageChange);
  }

  window.speechSynthesis?.addEventListener("voiceschanged", populateVoices);
  window.addEventListener("pagehide", cleanup);
  window.addEventListener("unload", cleanup);
  void initialize();
})();
