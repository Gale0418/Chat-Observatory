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
  const VALID_THEMES = Object.freeze(["ember", "aurora", "paper"]);

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
          <span id="ytce-status-line">準備就緒</span>
        </div>
      </div>
      <button class="ytce-icon-button" id="ytce-collapse-button" type="button" aria-label="收合控制面板" aria-expanded="true">
        <span aria-hidden="true">⌃</span>
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

        <label class="ytce-field">
          <span>聲音 <small class="ytce-privacy-tip">（僅列出本機語音）</small></span>
          <select id="ytce-voice-select">
            <option value="">正在尋找本機語音…</option>
          </select>
        </label>

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

    if (typeof value.ttsVoiceURI === "string") {
      sanitized.ttsVoiceURI = value.ttsVoiceURI;
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

  function updateSpeechStatus(message = "") {
    const queueText = ttsQueue.length ? ` · 等待 ${ttsQueue.length} 則` : "";
    const state = shouldSpeak() ? (activeUtterance ? "朗讀中" : "語音已開啟") : "語音已暫停";
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

    const selectedVoice = getSelectedVoice();
    if (!selectedVoice) {
      updateSpeechStatus("找不到可用的本機語音");
      return;
    }

    const next = ttsQueue.shift();
    if (!next) {
      updateSpeechStatus();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(next.text);
    utterance.voice = selectedVoice;
    utterance.lang = selectedVoice.lang;

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
    ttsQueue.push({ text, queuedAt: Date.now() });
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

    localVoices
      .sort((left, right) => left.lang.localeCompare(right.lang) || left.name.localeCompare(right.name))
      .forEach((voice) => {
        const label = `${voice.name} · ${voice.lang}`;
        ui.voiceSelect.add(new Option(label, voice.voiceURI));
      });

    const currentVoice = localVoices.find((voice) => voice.voiceURI === currentValue);
    const preferredVoice = currentVoice ||
      localVoices.find((voice) => /^zh-(TW|Hant)/i.test(voice.lang)) ||
      localVoices.find((voice) => /^zh/i.test(voice.lang)) ||
      localVoices[0] || null;

    if (preferredVoice) {
      ui.voiceSelect.disabled = false;
      ui.voiceSelect.value = preferredVoice.voiceURI;
      if (settings.ttsVoiceURI !== preferredVoice.voiceURI) {
        settings.ttsVoiceURI = preferredVoice.voiceURI;
        scheduleSave();
      }
    } else {
      const unavailable = new Option("找不到明確標示為本機的語音", "");
      unavailable.disabled = true;
      ui.voiceSelect.add(unavailable);
      ui.voiceSelect.disabled = true;
      if (settings.ttsVoiceURI !== "") {
        settings.ttsVoiceURI = "";
        scheduleSave();
      }
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
    ui.voiceSelect.value = settings.ttsVoiceURI;
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
    ui.avatarRow.hidden = settings.hideAvatars;
    ui.ttsSection.classList.toggle("is-muted", settings.mode === "monitor");

    ui.body.hidden = settings.isCollapsed;
    ui.collapseButton.setAttribute("aria-expanded", String(!settings.isCollapsed));
    ui.collapseButton.setAttribute(
      "aria-label",
      settings.isCollapsed ? "展開控制面板" : "收合控制面板"
    );
    ui.collapseButton.firstElementChild.textContent = settings.isCollapsed ? "⌄" : "⌃";

    refreshKeywords();
    syncControls();
    updateSpeechStatus();
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
      if (settings.mode === "reader") settings.ttsEnabled = Boolean(getSelectedVoice());
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
      const voice = getSelectedVoice();
      if (!voice) {
        settings.ttsEnabled = false;
        applySettings();
        updateSpeechStatus("找不到可用的本機語音");
        return;
      }
      const confirmation = new SpeechSynthesisUtterance("語音朗讀已開啟");
      confirmation.voice = voice;
      confirmation.lang = voice.lang;
      confirmation.volume = settings.ttsVolume / 100;
      confirmation.rate = settings.ttsRate;
      startUtterance(confirmation, "語音朗讀已開啟");
    }
    applySettings();
  });

  ui.voiceSelect.addEventListener("change", () => {
    settings.ttsVoiceURI = ui.voiceSelect.value;
    applySettings();
  });

  ui.testVoice.addEventListener("click", () => {
    const voice = getSelectedVoice();
    if (!voice) {
      updateSpeechStatus("找不到可用的本機語音");
      return;
    }
    stopSpeech({ clearQueue: false, continueQueue: false });
    const test = new SpeechSynthesisUtterance("歡迎使用 YT Chat Enlarger，這是目前的語音效果。");
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
    currentItemsContainer = null;

    if (window.chrome?.storage?.onChanged?.removeListener) {
      try {
        chrome.storage.onChanged.removeListener(handleStorageChange);
      } catch (_) {}
    }

    window.speechSynthesis?.removeEventListener("voiceschanged", populateVoices);
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
