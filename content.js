(() => {
  if (!window.location.href.includes("is_popout=1")) return;
  if (document.getElementById("ytce-control-panel")) return;

  const DEFAULT_SETTINGS = Object.freeze({
    mode: "complete",
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
  let keywordList = [];
  let ttsQueue = [];
  let activeUtterance = null;
  let speechGeneration = 0;
  const processedNodes = new WeakSet();

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
          <span>聲音</span>
          <select id="ytce-voice-select">
            <option value="">系統預設</option>
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
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
  }

  function sanitizeSettings(value) {
    const mode = ["complete", "monitor", "reader"].includes(value.mode)
      ? value.mode
      : DEFAULT_SETTINGS.mode;

    return {
      ...DEFAULT_SETTINGS,
      ...value,
      mode,
      fontSize: clampNumber(value.fontSize, 16, 64, DEFAULT_SETTINGS.fontSize),
      avatarSize: clampNumber(value.avatarSize, 24, 88, DEFAULT_SETTINGS.avatarSize),
      ttsVolume: clampNumber(value.ttsVolume, 0, 100, DEFAULT_SETTINGS.ttsVolume),
      ttsRate: clampNumber(value.ttsRate, 0.7, 1.6, DEFAULT_SETTINGS.ttsRate),
      ttsPitch: clampNumber(value.ttsPitch, 0.5, 2, DEFAULT_SETTINGS.ttsPitch),
      maxMessageLength: clampNumber(value.maxMessageLength, 30, 300, DEFAULT_SETTINGS.maxMessageLength),
      queueLimit: clampNumber(value.queueLimit, 3, 50, DEFAULT_SETTINGS.queueLimit),
      staleAfterSeconds: clampNumber(value.staleAfterSeconds, 5, 120, DEFAULT_SETTINGS.staleAfterSeconds)
    };
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => chrome.storage.local.set(settings), 250);
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

  function getSelectedVoice() {
    return window.speechSynthesis
      .getVoices()
      .find((voice) => voice.voiceURI === settings.ttsVoiceURI);
  }

  function updateSpeechStatus(message = "") {
    const queueText = ttsQueue.length ? ` · 等待 ${ttsQueue.length} 則` : "";
    const state = shouldSpeak() ? (activeUtterance ? "朗讀中" : "語音已開啟") : "語音已暫停";
    ui.statusLine.textContent = message || `${state}${queueText}`;
    ui.readerStatus.textContent = message || (activeUtterance ? "正在朗讀留言" : "等待新留言");
    readerStage.classList.toggle("is-speaking", Boolean(activeUtterance));
  }

  function finishUtterance(generation) {
    if (generation !== speechGeneration) return;
    activeUtterance = null;
    updateSpeechStatus();
    speakNext();
  }

  function speakNext() {
    if (activeUtterance || !shouldSpeak()) {
      updateSpeechStatus();
      return;
    }

    const staleBefore = Date.now() - settings.staleAfterSeconds * 1000;
    while (ttsQueue.length && ttsQueue[0].queuedAt < staleBefore) ttsQueue.shift();

    const next = ttsQueue.shift();
    if (!next) {
      updateSpeechStatus();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(next.text);
    const selectedVoice = getSelectedVoice();
    if (selectedVoice) {
      utterance.voice = selectedVoice;
      utterance.lang = selectedVoice.lang;
    } else {
      utterance.lang = "zh-TW";
    }

    utterance.volume = settings.ttsVolume / 100;
    utterance.rate = settings.ttsRate;
    utterance.pitch = settings.ttsPitch;

    const generation = ++speechGeneration;
    activeUtterance = utterance;
    utterance.onend = () => finishUtterance(generation);
    utterance.onerror = () => finishUtterance(generation);
    updateSpeechStatus();
    window.speechSynthesis.speak(utterance);
  }

  function stopSpeech({ clearQueue = false, continueQueue = false } = {}) {
    speechGeneration += 1;
    activeUtterance = null;
    if (clearQueue) ttsQueue = [];
    window.speechSynthesis.cancel();
    updateSpeechStatus(clearQueue ? "語音佇列已清空" : "已跳過目前留言");
    if (continueQueue && shouldSpeak()) queueMicrotask(speakNext);
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

  function refreshVisibleMessages() {
    document.querySelectorAll(RENDERER_SELECTOR).forEach((node) => {
      const data = getMessageData(node);
      if (data.message) applyHighlight(node, data.message);
    });
  }

  function populateVoices() {
    const voices = window.speechSynthesis.getVoices();
    const currentValue = settings.ttsVoiceURI;
    ui.voiceSelect.replaceChildren(new Option("系統預設", ""));

    voices
      .sort((left, right) => left.lang.localeCompare(right.lang) || left.name.localeCompare(right.name))
      .forEach((voice) => {
        const label = `${voice.name} · ${voice.lang}${voice.localService ? "" : " · 線上"}`;
        ui.voiceSelect.add(new Option(label, voice.voiceURI));
      });

    ui.voiceSelect.value = voices.some((voice) => voice.voiceURI === currentValue)
      ? currentValue
      : "";
  }

  function syncControls() {
    ui.modeButtons.forEach((button) => {
      const selected = button.dataset.mode === settings.mode;
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
      if (settings.mode === "reader") settings.ttsEnabled = true;
      if (settings.mode === "monitor" && activeUtterance) stopSpeech({ clearQueue: true });
      applySettings();
      if (shouldSpeak()) speakNext();
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
      applySettings();
      const confirmation = new SpeechSynthesisUtterance("語音朗讀已開啟");
      const voice = getSelectedVoice();
      if (voice) confirmation.voice = voice;
      confirmation.volume = settings.ttsVolume / 100;
      confirmation.rate = settings.ttsRate;
      window.speechSynthesis.speak(confirmation);
    }
    applySettings();
  });

  ui.voiceSelect.addEventListener("change", () => {
    settings.ttsVoiceURI = ui.voiceSelect.value;
    applySettings();
  });

  ui.testVoice.addEventListener("click", () => {
    stopSpeech();
    const test = new SpeechSynthesisUtterance("歡迎使用 YT Chat Enlarger，這是目前的語音效果。");
    const voice = getSelectedVoice();
    if (voice) test.voice = voice;
    test.volume = settings.ttsVolume / 100;
    test.rate = settings.ttsRate;
    test.pitch = settings.ttsPitch;
    window.speechSynthesis.speak(test);
  });

  ui.skipSpeech.addEventListener("click", () => {
    stopSpeech({ continueQueue: true });
  });

  ui.clearSpeech.addEventListener("click", () => {
    stopSpeech({ clearQueue: true });
  });

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        collectRenderers(node).forEach((renderer) => processRenderer(renderer));
      });
    });
  });

  function startObserver() {
    const itemsContainer = document.querySelector("#items.yt-live-chat-item-list-renderer");
    if (!itemsContainer) {
      setTimeout(startObserver, 750);
      return;
    }

    itemsContainer.querySelectorAll(RENDERER_SELECTOR).forEach((node) => {
      processRenderer(node, { speak: false });
    });
    observer.observe(itemsContainer, { childList: true, subtree: true });
  }

  chrome.storage.local.get(DEFAULT_SETTINGS, (stored) => {
    settings = sanitizeSettings(stored);
    applySettings({ save: false });
    populateVoices();
    startObserver();
  });

  window.speechSynthesis.addEventListener("voiceschanged", populateVoices);
})();
