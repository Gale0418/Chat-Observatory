const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { JSDOM } = require("jsdom");

const contentScript = fs.readFileSync(path.join(__dirname, "..", "content.js"), "utf8");
const contentStyles = fs.readFileSync(path.join(__dirname, "..", "content.css"), "utf8");

function colorContrast(foreground, background) {
  const luminance = (hex) => {
    const channels = hex.match(/[\da-f]{2}/gi).map((value) => parseInt(value, 16) / 255);
    const linear = channels.map((value) => value <= 0.04045
      ? value / 12.92
      : ((value + 0.055) / 1.055) ** 2.4);
    return (0.2126 * linear[0]) + (0.7152 * linear[1]) + (0.0722 * linear[2]);
  };
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

function getThemeToken(theme, token) {
  const selector = `body[data-chatobs-theme="${theme}"]`;
  const block = [...contentStyles.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .find(([, selectors, declarations]) => selectors.includes(selector) && declarations.includes(`${token}:`));
  assert.ok(block, `${theme} 應有畫風色票`);
  const value = block[2].match(new RegExp(`${token}:\\s*(#[\\da-f]{6})`, "i"));
  assert.ok(value, `${theme} 的 ${token} 應使用可驗證的實色`);
  return value[1];
}

function getThemeGradientColors(theme, token) {
  const selector = `body[data-chatobs-theme="${theme}"]`;
  const block = [...contentStyles.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .find(([, selectors, declarations]) => selectors.includes(selector) && declarations.includes(`${token}:`));
  assert.ok(block, `${theme} 應有畫風色票`);
  const value = block[2].match(new RegExp(`${token}:\\s*linear-gradient\\([^;]+`, "i"));
  assert.ok(value, `${theme} 的 ${token} 應使用明顯線性漸層`);
  return value[0].match(/#[\da-f]{6}/gi);
}

function waitForMutations(window) {
  return new Promise((resolve) => {
    window.queueMicrotask(() => {
      window.setTimeout(resolve, 10);
    });
  });
}

async function waitForCondition(window, predicate, attempts = 50) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (predicate()) return true;
    await new Promise((resolve) => window.setTimeout(resolve, 10));
  }
  return predicate();
}

async function createHarness(overrides = {}, options = {}) {
  const spoken = [];
  const saved = [];
  const storageListeners = [];
  const runtimeMessageListeners = [];
  const voiceListeners = [];
  const activeTimers = new Set();
  let cancelCalls = 0;
  let releaseStorageGet = null;
  let releaseFirstStorageSet = null;
  let releaseSecondStorageSet = null;
  let storageSetCalls = 0;
  let storageSetFailuresRemaining = options.storageSetFailures || 0;
  const storedValues = { ...overrides };
  const storageGetGate = options.delayStorageGet
    ? new Promise((resolve) => { releaseStorageGet = resolve; })
    : null;
  const firstStorageSetGate = options.blockFirstStorageSet
    ? new Promise((resolve) => { releaseFirstStorageSet = resolve; })
    : null;
  const secondStorageSetGate = options.blockSecondStorageSet
    ? new Promise((resolve) => { releaseSecondStorageSet = resolve; })
    : null;
  let currentVoices = [
    {
      name: "測試本機中文",
      lang: "zh-TW",
      voiceURI: "test-local-zh-tw",
      localService: true
    },
    {
      name: "測試遠端中文",
      lang: "zh-TW",
      voiceURI: "test-remote-zh-tw",
      localService: false
    }
  ];

  const dom = new JSDOM(
    `<!doctype html><html><body>
      <yt-live-chat-app>
        <yt-live-chat-renderer id="chat">
          <div id="chat-messages">
            <div id="contents">
              <yt-live-chat-item-list-renderer>
                <div id="item-scroller" class="yt-live-chat-item-list-renderer">
                  <div id="items" class="yt-live-chat-item-list-renderer"></div>
                </div>
              </yt-live-chat-item-list-renderer>
            </div>
          </div>
          <div id="input-panel"><yt-live-chat-message-input-renderer></yt-live-chat-message-input-renderer></div>
        </yt-live-chat-renderer>
      </yt-live-chat-app>
    </body></html>`,
    {
      url: options.url || "https://www.youtube.com/live_chat?is_popout=1&v=test123",
      runScripts: "dangerously"
    }
  );

  const nativeSetTimeout = dom.window.setTimeout.bind(dom.window);
  const nativeClearTimeout = dom.window.clearTimeout.bind(dom.window);
  dom.window.setTimeout = (callback, delay, ...args) => {
    let timerId;
    timerId = nativeSetTimeout(() => {
      activeTimers.delete(timerId);
      callback(...args);
    }, options.accelerateWatchdog && delay >= 5000 ? 0 : delay);
    activeTimers.add(timerId);
    return timerId;
  };
  dom.window.clearTimeout = (timerId) => {
    activeTimers.delete(timerId);
    nativeClearTimeout(timerId);
  };

  class MockUtterance {
    constructor(text) {
      this.text = text;
      this.volume = 1;
      this.rate = 1;
      this.pitch = 1;
      this.voice = null;
      this.lang = "";
      this.onend = null;
      this.onerror = null;
    }
  }

  dom.window.SpeechSynthesisUtterance = MockUtterance;
  dom.window.speechSynthesis = {
    getVoices: () => currentVoices,
    addEventListener: (name, listener) => {
      if (name === "voiceschanged") voiceListeners.push(listener);
    },
    removeEventListener: (name, listener) => {
      if (name !== "voiceschanged") return;
      const index = voiceListeners.indexOf(listener);
      if (index !== -1) voiceListeners.splice(index, 1);
    },
    speak: (utterance) => {
      if (options.speakThrows) throw new Error("mock speak failure");
      spoken.push(utterance);
    },
    cancel: () => { cancelCalls += 1; }
  };

  dom.window.createImageBitmap = async () => ({
    width: options.customImageWidth || 3200,
    height: options.customImageHeight || 1800,
    close: () => {}
  });
  dom.window.HTMLCanvasElement.prototype.getContext = () => ({
    drawImage: () => {}
  });
  dom.window.HTMLCanvasElement.prototype.toBlob = function toBlob(callback, type) {
    callback(new dom.window.Blob([options.customImagePayload || "mock-image"], { type }));
  };

  dom.window.chrome = {
    i18n: {
      getMessage: (key) => key === "@@ui_locale" ? "zh_TW" : ""
    },
    runtime: {
      getURL: (resourcePath) => `chrome-extension://test-extension/${resourcePath}`,
      onMessage: {
        addListener: (fn) => runtimeMessageListeners.push(fn),
        removeListener: (fn) => {
          const index = runtimeMessageListeners.indexOf(fn);
          if (index !== -1) runtimeMessageListeners.splice(index, 1);
        }
      }
    },
    storage: {
      local: {
        get: async (defaults) => {
          if (options.storageGetRejects) throw new Error("mock storage get failure");
          if (storageGetGate) await storageGetGate;
          return { ...defaults, ...(options.liveStorageGet ? storedValues : overrides) };
        },
        set: async (value) => {
          if (options.storageSetRejects || storageSetFailuresRemaining > 0) {
            if (storageSetFailuresRemaining > 0) storageSetFailuresRemaining -= 1;
            throw new Error("mock storage set failure");
          }
          storageSetCalls += 1;
          if (storageSetCalls === 1 && firstStorageSetGate) await firstStorageSetGate;
          if (storageSetCalls === 2 && secondStorageSetGate) await secondStorageSetGate;
          saved.push(value);
          const changes = {};
          Object.entries(value).forEach(([key, newValue]) => {
            if (Object.is(storedValues[key], newValue)) return;
            changes[key] = { oldValue: storedValues[key], newValue };
            storedValues[key] = newValue;
          });
          if (options.emitStorageChangeOnSet && Object.keys(changes).length > 0) {
            storageListeners.forEach((listener) => listener(changes, "local"));
          }
        }
      },
      onChanged: {
        addListener: (fn) => storageListeners.push(fn),
        removeListener: (fn) => {
          const idx = storageListeners.indexOf(fn);
          if (idx !== -1) storageListeners.splice(idx, 1);
        }
      }
    }
  };

  dom.window.eval(contentScript);
  await waitForMutations(dom.window);

  return {
    dom,
    window: dom.window,
    document: dom.window.document,
    spoken,
    saved,
    getCancelCalls: () => cancelCalls,
    storageListeners,
    setVoices: (voices) => {
      currentVoices = voices;
    },
    triggerVoicesChanged: () => {
      voiceListeners.forEach((listener) => listener());
    },
    triggerStorageChange: (changes) => {
      Object.entries(changes).forEach(([key, change]) => {
        if (change && "newValue" in change) storedValues[key] = change.newValue;
        else delete storedValues[key];
      });
      storageListeners.forEach((fn) => fn(changes, "local"));
    },
    getStoredValue: (key) => storedValues[key],
    triggerStorageNotification: (changes) => storageListeners.forEach((fn) => fn(changes, "local")),
    probe: (message) => {
      let response;
      runtimeMessageListeners.forEach((fn) => fn(message, {}, (value) => { response = value; }));
      return response;
    },
    releaseStorageGet: () => releaseStorageGet?.(),
    releaseFirstStorageSet: () => releaseFirstStorageSet?.(),
    releaseSecondStorageSet: () => releaseSecondStorageSet?.(),
    storageSetCallCount: () => storageSetCalls,
    items: dom.window.document.getElementById("items"),
    cleanup: () => {
      dom.window.dispatchEvent(new dom.window.Event("pagehide"));
      assert.equal(activeTimers.size, 0, "頁面清理後不應殘留計時器");
      dom.window.close();
    }
  };
}

function createTextMessage(document, author, message, timestamp = "") {
  const renderer = document.createElement("yt-live-chat-text-message-renderer");
  renderer.innerHTML = `
    ${timestamp ? `<span id="timestamp">${timestamp}</span>` : ""}
    <span id="author-name">${author}</span>
    <span id="message">${message}</span>
  `;
  return renderer;
}

test("chatobs:probe 只回傳目前 popout 頁面的 URL", async () => {
  const harness = await createHarness();
  try {
    assert.equal(
      harness.probe({ type: "chatobs:probe" })?.url,
      "https://www.youtube.com/live_chat?is_popout=1&v=test123"
    );
    assert.equal(harness.probe({ type: "other-message" }), undefined);
  } finally {
    harness.cleanup();
  }
});

test("離線 visual fixture 仍可載入面板，其他 file 頁面維持 gate", async () => {
  const fixtureHarness = await createHarness({}, {
    url: "file:///Volumes/NASDisk/MYAPP/ChatObservatory/tests/visual-fixture.html?is_popout=1"
  });
  try {
    assert.ok(fixtureHarness.document.getElementById("chatobs-control-panel"));
  } finally {
    fixtureHarness.cleanup();
  }

  const otherFileHarness = await createHarness({}, {
    url: "file:///tmp/other.html?is_popout=1"
  });
  try {
    assert.equal(otherFileHarness.document.getElementById("chatobs-control-panel"), null);
  } finally {
    otherFileHarness.cleanup();
  }
});

test("storage 載入期間新增的留言不會被 observer 漏掉", async () => {
  const harness = await createHarness({ ttsEnabled: true }, { delayStorageGet: true });
  try {
    harness.items.append(createTextMessage(harness.document, "等待中的觀眾", "載入期間的留言"));
    await waitForMutations(harness.window);
    assert.equal(harness.spoken.length, 0, "storage 尚未完成時不應用預設設定朗讀");

    harness.releaseStorageGet();
    await waitForMutations(harness.window);
    assert.equal(harness.spoken.at(-1).text, "載入期間的留言");
  } finally {
    harness.releaseStorageGet();
    harness.cleanup();
  }
});

test("storage 載入完成後會把已存在留言套用保存的關鍵字高亮", async () => {
  const harness = await createHarness(
    { highlightKeywords: "重要" },
    { delayStorageGet: true }
  );
  try {
    const renderer = createTextMessage(harness.document, "觀眾", "這是重要通知");
    harness.items.append(renderer);
    await waitForMutations(harness.window);
    assert.equal(renderer.classList.contains("chatobs-highlighted"), false);

    harness.releaseStorageGet();
    await waitForMutations(harness.window);
    assert.equal(renderer.classList.contains("chatobs-highlighted"), true);
  } finally {
    harness.releaseStorageGet();
    harness.cleanup();
  }
});

test("storage 載入期間的 UI 修改不會被舊 snapshot 覆寫", async () => {
  const harness = await createHarness(
    { theme: "red", highlightKeywords: "保存的關鍵字" },
    { delayStorageGet: true }
  );
  try {
    const themeSelect = harness.document.getElementById("chatobs-theme-select");
    themeSelect.value = "blue";
    themeSelect.dispatchEvent(new harness.window.Event("change", { bubbles: true }));
    const keywordInput = harness.document.getElementById("chatobs-keywords-input");
    keywordInput.value = "本地修改";
    keywordInput.dispatchEvent(new harness.window.Event("input", { bubbles: true }));
    await new Promise((resolve) => harness.window.setTimeout(resolve, 300));
    assert.equal(harness.saved.length, 0, "storage 尚未完成時不可把 defaults 提前寫回");

    harness.releaseStorageGet();
    assert.equal(
      await waitForCondition(harness.window, () => harness.saved.length > 0),
      true,
      "storage 完成後應落盤使用者修改"
    );
    assert.equal(themeSelect.value, "blue");
    assert.equal(keywordInput.value, "本地修改");
    assert.equal(harness.document.body.dataset.chatobsTheme, "blue");
    assert.equal(harness.saved.at(-1).theme, "blue");
    assert.equal(harness.saved.at(-1).highlightKeywords, "本地修改");
  } finally {
    harness.releaseStorageGet();
    harness.cleanup();
  }
});

test("storage 載入期間本地修改的 theme 優先於外部 onChanged", async () => {
  const harness = await createHarness({ theme: "green" }, { delayStorageGet: true });
  try {
    const themeSelect = harness.document.getElementById("chatobs-theme-select");
    themeSelect.value = "blue";
    themeSelect.dispatchEvent(new harness.window.Event("change", { bubbles: true }));
    harness.triggerStorageChange({
      theme: { oldValue: "green", newValue: "red" }
    });

    harness.releaseStorageGet();
    await waitForMutations(harness.window);
    assert.equal(themeSelect.value, "blue");
    assert.equal(harness.document.body.dataset.chatobsTheme, "blue");
  } finally {
    harness.releaseStorageGet();
    harness.cleanup();
  }
});

test("storage get 尚未完成時外部 onChanged 的關鍵字與背景不會被舊 snapshot 覆寫", async () => {
  const externalBackground = "data:image/webp;base64,ZXh0ZXJuYWw=";
  const harness = await createHarness(
    { highlightKeywords: "snapshot", customBackgroundDataUrl: "data:image/webp;base64,c25hcHNob3Q=" },
    { delayStorageGet: true }
  );
  try {
    const renderer = createTextMessage(harness.document, "觀眾", "外部關鍵字命中");
    harness.items.append(renderer);
    harness.triggerStorageChange({
      highlightKeywords: { newValue: "外部關鍵字" },
      customBackgroundDataUrl: { newValue: externalBackground }
    });
    await waitForMutations(harness.window);

    harness.releaseStorageGet();
    await waitForMutations(harness.window);
    assert.equal(renderer.classList.contains("chatobs-highlighted"), true);
    assert.equal(
      harness.document.body.style.getPropertyValue("--chatobs-panel-image"),
      `url("${externalBackground}")`
    );
  } finally {
    harness.releaseStorageGet();
    harness.cleanup();
  }
});

test("建立單一完整聊天室與高雅控制面板", async () => {
  const harness = await createHarness();
  try {
    assert.equal(
      harness.document.getElementById("chatobs-panel-body").hidden,
      true,
      "新安裝預設應收合控制面板，避免遮住聊天室"
    );
    assert.equal(harness.document.querySelectorAll("[data-mode]").length, 0);
    assert.equal(harness.document.getElementById("chatobs-reader-stage"), null);
    assert.equal(
      harness.document.querySelector("#chatobs-collapse-button span").textContent,
      "",
      "收合鍵應使用不受字型影響的 CSS 幾何圖示"
    );
    assert.equal(
      harness.document.getElementById("chatobs-control-panel").parentElement,
      harness.document.body,
      "固定面板應留在擴充功能自己的 body 層，不能插入 YouTube 虛擬留言清單"
    );
    assert.equal(
      harness.items.querySelector("#chatobs-control-panel"),
      null,
      "#items 的直接子節點必須只由 YouTube 管理"
    );
    assert.equal(
      harness.document.documentElement.style.getPropertyValue("--chatobs-panel-offset"),
      "84px",
      "面板應為聊天室保留固定頂部空間"
    );
    assert.equal(harness.document.body.dataset.chatobsMode, undefined);
  } finally {
    harness.cleanup();
  }
});

test("既有 isCollapsed 設定為 false 時仍維持展開面板", async () => {
  const harness = await createHarness({ isCollapsed: false });
  try {
    assert.equal(harness.document.getElementById("chatobs-panel-body").hidden, false);
  } finally {
    harness.cleanup();
  }
});

test("Chrome 語系自動偵測並可用旗幟按鈕手動切換介面語言", async () => {
  const harness = await createHarness();
  try {
    const languageButtons = [...harness.document.querySelectorAll("[data-locale]")];
    assert.deepEqual(languageButtons.map((button) => button.dataset.locale), ["zh-TW", "ja", "en"]);
    assert.deepEqual(
      languageButtons.map((button) => button.querySelector("span:last-child").textContent),
      ["純正中文", "日本語", "English"]
    );
    assert.deepEqual(
      languageButtons.map((button) => button.querySelector(".chatobs-language-flag").textContent),
      ["🇹🇼", "🇯🇵", "🇺🇸"]
    );
    assert.equal(harness.document.body.dataset.chatobsLocale, "zh-TW");
    assert.equal(harness.document.querySelector("#chatobs-control-panel").lang, "zh-TW");
    assert.equal(languageButtons[0].getAttribute("aria-pressed"), "true");
    assert.deepEqual(languageButtons.map((button) => button.classList.contains("is-active")), [true, false, false]);
    assert.equal(harness.document.querySelector("[data-i18n='displaySection']").textContent, "畫面");
    const ttsToggle = harness.document.getElementById("chatobs-tts-toggle");
    assert.equal(ttsToggle.getAttribute("aria-label"), "開啟或關閉新留言朗讀");
    const themeLabels = () => [...harness.document.querySelectorAll("#chatobs-theme-select option")].map((option) => option.textContent);
    assert.deepEqual(themeLabels(), [
      "玄曜奇點", "赤曜超新星", "橙燼日冕", "炫陽星暴", "翠晶星雲", "蒼穹冰潮",
      "紫宸雙星", "銀蝕隕痕", "霜華白矮", "金鑄熔爐", "銀河星環", "虹渦光譜"
    ]);

    languageButtons[1].click();
    assert.equal(harness.document.body.dataset.chatobsLocale, "ja");
    assert.equal(harness.document.querySelector("#chatobs-control-panel").lang, "ja");
    assert.equal(languageButtons[1].getAttribute("aria-pressed"), "true");
    assert.deepEqual(languageButtons.map((button) => button.classList.contains("is-active")), [false, true, false]);
    assert.equal(harness.document.querySelector("[data-i18n='displaySection']").textContent, "表示");
    assert.equal(harness.document.querySelector("[data-i18n='testVoice']").textContent, "音声を試聴");
    assert.equal(ttsToggle.getAttribute("aria-label"), "新しいメッセージの読み上げをオン／オフ");
    assert.deepEqual(themeLabels(), [
      "玄曜・特異点", "赤曜・超新星", "橙燼・コロナ", "炫陽・星嵐", "翠晶・星雲", "蒼穹・氷潮",
      "紫宸・双星", "銀蝕・隕痕", "霜華・白矮星", "金鋳・炉心", "銀河・星環", "虹渦・スペクトル"
    ]);

    languageButtons[2].click();
    assert.equal(harness.document.body.dataset.chatobsLocale, "en");
    assert.equal(harness.document.querySelector("[data-i18n='displaySection']").textContent, "Display");
    assert.equal(harness.document.querySelector("[data-i18n='testVoice']").textContent, "Test voice");
    assert.equal(ttsToggle.getAttribute("aria-label"), "Turn reading of new messages on or off");
    assert.deepEqual(languageButtons.map((button) => button.classList.contains("is-active")), [false, false, true]);
    assert.deepEqual(themeLabels(), [
      "Umbra Singularity", "Crimson Nova", "Ember Corona", "Helios Storm", "Verdant Prism", "Azure Icefall",
      "Amethyst Binary", "Ashen Impact", "Frostlight Dwarf", "Aureate Forge", "Argent Halo", "Prism Maelstrom"
    ]);
    await new Promise((resolve) => harness.window.setTimeout(resolve, 300));
    assert.equal(harness.saved.at(-1).uiLocale, "en");
  } finally {
    harness.cleanup();
  }
});

test("聊天室主體使用畫風 canvas，且不以全域規則覆蓋輸入與表情面板", () => {
  assert.match(contentStyles, /body\.chatobs-active\s*\{[\s\S]*background: var\(--chatobs-canvas\) !important;/);
  assert.match(contentStyles, /yt-live-chat-renderer #chat-messages\s*\{[\s\S]*var\(--chatobs-panel-image\) center \/ cover no-repeat/);
  assert.match(contentStyles, /body\.chatobs-active yt-live-chat-app,[\s\S]*background-color: var\(--chatobs-canvas\) !important;/);
  assert.match(contentStyles, /#item-scroller\.yt-live-chat-item-list-renderer/);
  assert.doesNotMatch(contentStyles, /yt-live-chat-renderer \*/);
  assert.match(contentStyles, /#input-panel\.yt-live-chat-renderer,[\s\S]*background: var\(--chatobs-input-gradient\) !important;/);
  assert.match(contentStyles, /yt-live-chat-header-renderer yt-icon[\s\S]*fill: currentColor !important;/);
  assert.doesNotMatch(contentStyles, /yt-emoji-picker-renderer[^,{]*,[\s\S]*--chatobs-canvas/);
  assert.match(contentStyles, /#chatobs-control-panel\s*\{[\s\S]*position: fixed;/);
  assert.match(contentStyles, /top: calc\(var\(--chatobs-native-header-offset, 0px\) \+ 8px\);/);
  assert.match(contentStyles, /padding-top: var\(--chatobs-panel-offset, 84px\) !important;/);
});

test("輸入列與表情面板使用各畫風的高對比語意色票", () => {
  for (const token of [
    "--chatobs-input-surface",
    "--chatobs-input-text",
    "--chatobs-input-placeholder",
    "--chatobs-input-icon",
    "--chatobs-input-icon-hover",
    "--chatobs-picker-surface",
    "--chatobs-picker-hover",
    "--chatobs-input-gradient",
    "--chatobs-picker-gradient"
  ]) {
    assert.match(contentStyles, new RegExp(`${token}:`), `${token} 應有預設值`);
  }

  assert.match(contentStyles, /yt-live-chat-message-input-renderer\s*\{[\s\S]*--yt-live-chat-text-input-field-placeholder-color: var\(--chatobs-input-placeholder\);/);
  assert.match(contentStyles, /yt-live-chat-message-input-renderer #input-container,[\s\S]*background: var\(--chatobs-input-gradient\) !important;/);
  assert.match(contentStyles, /yt-live-chat-message-input-renderer #emoji-button,[\s\S]*background: var\(--chatobs-picker-gradient\) !important;/, "輸入列按鈕應使用主題表情面板漸層");
  assert.match(contentStyles, /yt-live-chat-message-input-renderer #buttons yt-icon-button,[\s\S]*border: 1px solid var\(--chatobs-border-strong\) !important;/, "輸入列圖示按鈕應使用主題邊框");
  assert.match(contentStyles, /yt-live-chat-message-input-renderer #send-button:focus-visible,[\s\S]*border-color: var\(--chatobs-accent\) !important;/, "輸入列按鈕 focus 應使用主題 accent");
  assert.match(contentStyles, /yt-emoji-picker-renderer\s*\{[\s\S]*--yt-live-chat-picker-button-active-color: var\(--chatobs-accent\);/);
  assert.match(contentStyles, /yt-emoji-picker-renderer #categories,[\s\S]*background: var\(--chatobs-picker-gradient\) !important;/);
  assert.doesNotMatch(contentStyles, /body\.chatobs-active\s+yt-live-chat-renderer\s+\*/);
});

test("語言三按鈕旁提供第四格主題下拉選單與三語選項", async () => {
  const harness = await createHarness();
  try {
    assert.deepEqual(
      [...harness.document.querySelectorAll(".chatobs-language-switch button")].map((button) => ({
        id: button.dataset.locale,
        label: button.querySelector("span:last-child").textContent
      })),
      [
        { id: "zh-TW", label: "純正中文" },
        { id: "ja", label: "日本語" },
        { id: "en", label: "English" }
      ]
    );
    const themeSelect = harness.document.getElementById("chatobs-theme-select");
    assert.equal(themeSelect.getAttribute("aria-label"), "介面畫風");
    assert.deepEqual(
      [...themeSelect.options].map((option) => ({ id: option.value, label: option.textContent })),
      [
        { id: "black", label: "玄曜奇點" },
        { id: "red", label: "赤曜超新星" },
        { id: "orange", label: "橙燼日冕" },
        { id: "yellow", label: "炫陽星暴" },
        { id: "green", label: "翠晶星雲" },
        { id: "blue", label: "蒼穹冰潮" },
        { id: "purple", label: "紫宸雙星" },
        { id: "gray", label: "銀蝕隕痕" },
        { id: "white", label: "霜華白矮" },
        { id: "gold", label: "金鑄熔爐" },
        { id: "silver", label: "銀河星環" },
        { id: "rainbow", label: "虹渦光譜" }
      ]
    );
  } finally {
    harness.cleanup();
  }
});

test("十二套畫風的輸入文字與表情圖示皆符合對比門檻", () => {
  for (const theme of ["black", "red", "orange", "yellow", "green", "blue", "purple", "gray", "white", "gold", "silver", "rainbow"]) {
    const inputText = getThemeToken(theme, "--chatobs-input-text");
    const inputIcon = getThemeToken(theme, "--chatobs-input-icon");
    const inputSurfaces = getThemeGradientColors(theme, "--chatobs-input-gradient");
    const pickerSurfaces = getThemeGradientColors(theme, "--chatobs-picker-gradient");

    for (const surface of inputSurfaces) {
      assert.ok(colorContrast(inputText, surface) >= 4.5, `${theme} 輸入文字在 ${surface} 對比不足`);
      assert.ok(colorContrast(inputIcon, surface) >= 3, `${theme} 表情按鈕在 ${surface} 對比不足`);
    }
    for (const surface of pickerSurfaces) {
      assert.ok(colorContrast(inputText, surface) >= 4.5, `${theme} 表情面板文字在 ${surface} 對比不足`);
      assert.ok(colorContrast(inputIcon, surface) >= 3, `${theme} 表情面板圖示在 ${surface} 對比不足`);
    }
  }
});

test("固定控制面板不會污染 YouTube 留言子節點順序", async () => {
  const harness = await createHarness();
  try {
    const first = createTextMessage(harness.document, "甲", "第一則");
    const second = createTextMessage(harness.document, "乙", "第二則");
    harness.items.append(first, second);
    await waitForMutations(harness.window);

    assert.deepEqual(
      [...harness.items.children].map((node) => node.querySelector("#message")?.textContent),
      ["第一則", "第二則"]
    );
    assert.equal(harness.document.getElementById("chatobs-control-panel").parentElement, harness.document.body);
  } finally {
    harness.cleanup();
  }
});

test("巢狀新增的一般留言會清理網址與重複字後朗讀", async () => {
  const harness = await createHarness({ ttsEnabled: true });
  try {
    const wrapper = harness.document.createElement("div");
    wrapper.append(createTextMessage(harness.document, "小明", "看 https://example.com 哈哈哈哈哈哈"));
    harness.items.append(wrapper);
    await waitForMutations(harness.window);

    assert.equal(harness.spoken.length, 1);
    assert.equal(harness.spoken[0].text, "看 連結 哈哈哈");
  } finally {
    harness.cleanup();
  }
});

test("待處理 mutation 中已移除的 renderer 不會被朗讀", async () => {
  const harness = await createHarness({ ttsEnabled: true });
  try {
    const renderer = createTextMessage(harness.document, "小明", "已移除的留言");
    harness.items.append(renderer);
    renderer.remove();
    await waitForMutations(harness.window);

    assert.equal(harness.spoken.length, 0, "已離開聊天室的 renderer 不應進入 TTS");
  } finally {
    harness.cleanup();
  }
});

test("關閉朗讀表情時不會把 variation selector 或 ZWJ 當成空白 TTS", async () => {
  const harness = await createHarness({ ttsEnabled: true, readEmoji: false });
  try {
    harness.items.append(createTextMessage(harness.document, "小明", "❤️‍🔥"));
    await waitForMutations(harness.window);
    assert.equal(harness.spoken.length, 0);
  } finally {
    harness.cleanup();
  }
});

test("renderer 重用時只在正文指紋變更後重新朗讀", async () => {
  const harness = await createHarness({ ttsEnabled: true });
  try {
    const renderer = createTextMessage(harness.document, "小明", "第一版");
    harness.items.append(renderer);
    await waitForMutations(harness.window);
    assert.equal(harness.spoken.map((item) => item.text).join("|"), "第一版");

    renderer.querySelector("#author-name").textContent = "換名字";
    await waitForMutations(harness.window);
    assert.equal(harness.spoken.length, 1, "只有作者更新時不應重複朗讀相同正文");
    assert.equal(
      renderer.querySelector("#author-name").style.getPropertyValue("--chatobs-author-color"),
      "hsl(293 72% 72%)",
      "作者更新後仍應重新套用作者色"
    );

    renderer.querySelector("#message").textContent = "第二版";
    await waitForMutations(harness.window);
    harness.spoken[0].onend?.();
    await waitForMutations(harness.window);
    assert.deepEqual(harness.spoken.map((item) => item.text), ["第一版", "第二版"]);
  } finally {
    harness.cleanup();
  }
});

test("renderer 重用時同正文但穩定訊息 ID 改變仍會朗讀新留言", async () => {
  const harness = await createHarness({ ttsEnabled: true });
  try {
    const renderer = createTextMessage(harness.document, "甲", "相同正文");
    renderer.setAttribute("data-message-id", "message-1");
    harness.items.append(renderer);
    await waitForMutations(harness.window);
    assert.equal(harness.spoken.length, 1);
    harness.spoken[0].onend?.();

    renderer.setAttribute("data-message-id", "message-2");
    renderer.querySelector("#author-name").textContent = "乙";
    renderer.querySelector("#message").textContent = "相同正文";
    await waitForMutations(harness.window);

    assert.deepEqual(harness.spoken.map((item) => item.text), ["相同正文", "相同正文"]);
  } finally {
    harness.cleanup();
  }
});

test("關鍵字輸入會 debounce 高亮更新", async () => {
  const harness = await createHarness();
  try {
    const renderer = createTextMessage(harness.document, "小明", "這是重要通知");
    harness.items.append(renderer);
    await waitForMutations(harness.window);

    const input = harness.document.getElementById("chatobs-keywords-input");
    input.value = "重要";
    input.dispatchEvent(new harness.window.Event("input", { bubbles: true }));
    assert.equal(renderer.classList.contains("chatobs-highlighted"), false);
    await new Promise((resolve) => harness.window.setTimeout(resolve, 120));
    assert.equal(renderer.classList.contains("chatobs-highlighted"), true);
  } finally {
    harness.cleanup();
  }
});

test("開啟朗讀時間後會把時間放在留言前方", async () => {
  const harness = await createHarness({ ttsEnabled: true, ttsReadTime: true });
  try {
    harness.items.append(
      createTextMessage(harness.document, "小明", "準備開台", "下午 8:05")
    );
    await waitForMutations(harness.window);

    assert.equal(harness.spoken.length, 1);
    assert.equal(harness.spoken[0].text, "下午 8:05，準備開台");
  } finally {
    harness.cleanup();
  }
});

test("舊版模式設定會回落到唯一的完整聊天室", async () => {
  const harness = await createHarness({ mode: "monitor", ttsEnabled: true });
  try {
    assert.equal(harness.document.querySelectorAll("[data-mode]").length, 0);
    assert.equal(harness.document.body.dataset.chatobsMode, undefined);
    harness.items.append(createTextMessage(harness.document, "小華", "完整模式會朗讀這句"));
    await waitForMutations(harness.window);

    assert.equal(harness.spoken.length, 1);
  } finally {
    harness.cleanup();
  }
});

test("UI 語言切換也會翻譯擴充功能產生的朗讀前綴", async () => {
  const harness = await createHarness({ uiLocale: "en", ttsEnabled: true, ttsReadName: true });
  try {
    const renderer = harness.document.createElement("yt-live-chat-paid-sticker-renderer");
    renderer.innerHTML = `
      <span id="author-name">Alex</span>
      <span id="purchase-amount">$5</span>
    `;
    harness.items.append(renderer);
    await waitForMutations(harness.window);

    assert.equal(harness.spoken.length, 1);
    assert.match(harness.spoken[0].text, /Super Sticker/);
    assert.match(harness.spoken[0].text, /Alex says/);
    assert.doesNotMatch(harness.spoken[0].text, /說：|連結|會員/);
  } finally {
    harness.cleanup();
  }
});

test("Super Sticker 沒有正文時仍會產生可朗讀內容", async () => {
  const harness = await createHarness({ ttsEnabled: true, ttsReadName: true });
  try {
    const renderer = harness.document.createElement("yt-live-chat-paid-sticker-renderer");
    renderer.innerHTML = `
      <span id="author-name">支持者</span>
      <span id="purchase-amount">NT$150</span>
    `;
    harness.items.append(renderer);
    await waitForMutations(harness.window);

    assert.equal(harness.spoken.length, 1);
    assert.match(harness.spoken[0].text, /Super Sticker/);
    assert.match(harness.spoken[0].text, /支持者說/);
  } finally {
    harness.cleanup();
  }
});

test("語音忙碌時只保留最近二十則等待訊息", async () => {
  const harness = await createHarness({ ttsEnabled: true, queueLimit: 20 });
  try {
    for (let index = 1; index <= 25; index += 1) {
      harness.items.append(
        createTextMessage(harness.document, "觀眾", `訊息 ${index}`)
      );
    }
    await waitForMutations(harness.window);

    assert.equal(harness.spoken[0].text, "訊息 1");
    harness.document.getElementById("chatobs-skip-speech").click();
    await waitForMutations(harness.window);
    assert.equal(harness.spoken[1].text, "訊息 6");
  } finally {
    harness.cleanup();
  }
});

test("連續湧入的十二則留言會依 DOM 順序逐則朗讀", async () => {
  const harness = await createHarness({ ttsEnabled: true, queueLimit: 20 });
  try {
    const expected = Array.from({ length: 12 }, (_, index) => `順序測試 ${index + 1}`);
    const batch = harness.document.createDocumentFragment();
    expected.forEach((message, index) => {
      batch.append(createTextMessage(harness.document, `觀眾 ${index + 1}`, message));
    });

    harness.items.append(batch);
    await waitForMutations(harness.window);

    for (let index = 0; index < expected.length - 1; index += 1) {
      const current = harness.spoken.at(-1);
      assert.equal(current.text, expected[index], `第 ${index + 1} 則應先進入朗讀`);
      current.onend();
      await waitForMutations(harness.window);
    }

    assert.deepEqual(
      harness.spoken.map((utterance) => utterance.text),
      expected,
      "SpeechSynthesis 收到的文字順序必須與聊天室 DOM 順序完全一致"
    );
  } finally {
    harness.cleanup();
  }
});

// === A 項目測試：Settings sanitize, whitelist & storage onChanged partial merge without save loop ===
test("A) Settings sanitize 遇到壞資料會 fallback 預設值且 Whitelist", async () => {
  const harness = await createHarness({
    fontSize: "bad_number",
    panelFontSize: "bad_number",
    mode: "invalid_mode",
    ttsVolume: 9999,
    ttsEnabled: "not_boolean",
    unknownField: "hacker"
  });
  try {
    const fontInput = harness.document.getElementById("chatobs-font-slider");
    assert.equal(fontInput.value, "28"); // fallback default fontSize
    const panelFontInput = harness.document.getElementById("chatobs-panel-font-slider");
    assert.equal(panelFontInput.value, "20"); // fallback default panelFontSize
    assert.equal(harness.document.body.dataset.chatobsMode, undefined); // 不再暴露模式狀態
  } finally {
    harness.cleanup();
  }
});

test("A) 面板文字大小可即時調整並同步 CSS token", async () => {
  const harness = await createHarness();
  try {
    const panelFontInput = harness.document.getElementById("chatobs-panel-font-slider");
    assert.equal(panelFontInput.value, "20");
    assert.equal(
      harness.document.documentElement.style.getPropertyValue("--chatobs-panel-body-size"),
      "20px"
    );

    panelFontInput.value = "24";
    panelFontInput.dispatchEvent(new harness.window.Event("input", { bubbles: true }));
    assert.equal(
      harness.document.documentElement.style.getPropertyValue("--chatobs-panel-body-size"),
      "24px"
    );
    assert.equal(harness.document.getElementById("chatobs-panel-font-value").value, "24px");
  } finally {
    harness.cleanup();
  }
});

test("A) 畫風可切換、持久保存，無效值會回落至黑色", async () => {
  const invalidHarness = await createHarness({ theme: "rainbow-hacker" });
  try {
    assert.equal(invalidHarness.document.body.dataset.chatobsTheme, "black");
    assert.equal(
      invalidHarness.document.body.style.getPropertyValue("--chatobs-panel-image"),
      'url("chrome-extension://test-extension/assets/themes/cosmic-spectrum-black.jpg")'
    );
    assert.equal(invalidHarness.document.getElementById("chatobs-theme-select").value, "black");
  } finally {
    invalidHarness.cleanup();
  }

  const harness = await createHarness({ theme: "black" });
  try {
    assert.equal(harness.document.querySelectorAll(".chatobs-theme-select-control option").length, 12);
    const themeImages = {
      black: "cosmic-spectrum-black.jpg",
      red: "cosmic-spectrum-red.jpg",
      orange: "cosmic-spectrum-orange.jpg",
      yellow: "cosmic-spectrum-yellow.jpg",
      green: "cosmic-spectrum-green.jpg",
      blue: "cosmic-spectrum-blue.jpg",
      purple: "cosmic-spectrum-purple.jpg",
      gray: "cosmic-spectrum-gray.jpg",
      white: "cosmic-spectrum-white.jpg",
      gold: "cosmic-spectrum-gold.jpg",
      silver: "cosmic-spectrum-silver.jpg",
      rainbow: "cosmic-spectrum-rainbow.jpg"
    };
    for (const [theme, image] of Object.entries(themeImages)) {
      const themeSelect = harness.document.getElementById("chatobs-theme-select");
      themeSelect.value = theme;
      themeSelect.dispatchEvent(new harness.window.Event("change", { bubbles: true }));
      assert.equal(
        harness.document.querySelector(".chatobs-theme-select-control").classList.contains("is-changing"),
        true
      );
      assert.equal(harness.document.body.dataset.chatobsTheme, theme);
      assert.equal(harness.document.documentElement.dataset.chatobsTheme, theme);
      assert.equal(
        harness.document.body.style.getPropertyValue("--chatobs-panel-image"),
        `url("chrome-extension://test-extension/assets/themes/${image}")`
      );
    }
    assert.equal(
      harness.document.getElementById("chatobs-theme-select").value,
      "rainbow"
    );
    await new Promise((resolve) => harness.window.setTimeout(resolve, 300));
    assert.equal(harness.saved.at(-1).theme, "rainbow");
  } finally {
    harness.cleanup();
  }
});

test("A) 自訂背景會壓縮後獨立保存，移除時恢復主題圖片", async () => {
  const harness = await createHarness({ theme: "blue" });
  try {
    const input = harness.document.getElementById("chatobs-background-input");
    const choose = harness.document.getElementById("chatobs-background-choose");
    const remove = harness.document.getElementById("chatobs-background-remove");
    const status = harness.document.getElementById("chatobs-background-status");

    assert.equal(input.accept.includes("image/webp"), true);
    assert.equal(choose.textContent, "選擇圖片");
    assert.equal(remove.disabled, true);

    const file = new harness.window.File(["source-image"], "space.png", { type: "image/png" });
    Object.defineProperty(input, "files", { configurable: true, value: [file] });
    input.dispatchEvent(new harness.window.Event("change", { bubbles: true }));
    await waitForCondition(
      harness.window,
      () => harness.saved.some((value) => value.customBackgroundDataUrl)
    );

    const backgroundSave = harness.saved.find((value) => value.customBackgroundDataUrl);
    assert.ok(backgroundSave, "處理後圖片應使用獨立 storage key 保存");
    assert.match(backgroundSave.customBackgroundDataUrl, /^data:image\/webp;base64,/);
    assert.equal(
      harness.document.body.style.getPropertyValue("--chatobs-panel-image"),
      `url("${backgroundSave.customBackgroundDataUrl}")`
    );
    assert.equal(harness.document.body.dataset.chatobsCustomBackground, "true");
    assert.equal(remove.disabled, false);
    assert.equal(status.textContent, "自訂背景已套用並儲存在本機");

    const fontSlider = harness.document.getElementById("chatobs-font-slider");
    fontSlider.value = "32";
    fontSlider.dispatchEvent(new harness.window.Event("input", { bubbles: true }));
    await new Promise((resolve) => harness.window.setTimeout(resolve, 300));
    const settingsSave = harness.saved.find((value) => value.fontSize === 32);
    assert.ok(settingsSave, "一般設定仍應正常保存");
    assert.equal(
      Object.prototype.hasOwnProperty.call(settingsSave, "customBackgroundDataUrl"),
      false,
      "一般設定變更不應重寫大型背景資料"
    );

    remove.click();
    await new Promise((resolve) => harness.window.setTimeout(resolve, 10));
    assert.equal(harness.saved.at(-1).customBackgroundDataUrl, "");
    assert.equal(
      harness.document.body.style.getPropertyValue("--chatobs-panel-image"),
      'url("chrome-extension://test-extension/assets/themes/cosmic-spectrum-blue.jpg")'
    );
    assert.equal(harness.document.body.dataset.chatobsCustomBackground, "false");
    assert.equal(remove.disabled, true);
  } finally {
    harness.cleanup();
  }
});

test("A) 自訂背景只接受安全 WebP data URL，過大輸入會顯示可復原錯誤", async () => {
  const invalidHarness = await createHarness({
    theme: "black",
    customBackgroundDataUrl: 'url("javascript:alert(1)")'
  });
  try {
    assert.equal(invalidHarness.document.body.dataset.chatobsCustomBackground, "false");
    assert.match(
      invalidHarness.document.body.style.getPropertyValue("--chatobs-panel-image"),
      /cosmic-spectrum-black\.jpg/
    );

    const input = invalidHarness.document.getElementById("chatobs-background-input");
    Object.defineProperty(input, "files", {
      configurable: true,
      value: [{ type: "image/png", size: (20 * 1024 * 1024) + 1 }]
    });
    input.dispatchEvent(new invalidHarness.window.Event("change", { bubbles: true }));
    await new Promise((resolve) => invalidHarness.window.setTimeout(resolve, 10));
    assert.equal(
      invalidHarness.document.getElementById("chatobs-background-status").textContent,
      "圖片太大，請選擇 20 MB 以下或較低解析度的檔案"
    );
    assert.equal(invalidHarness.document.getElementById("chatobs-background-choose").disabled, false);
  } finally {
    invalidHarness.cleanup();
  }
});

test("A) 已保存的自訂背景會在重載後自動恢復", async () => {
  const savedBackground = "data:image/webp;base64,bW9jay1pbWFnZQ==";
  const harness = await createHarness({ customBackgroundDataUrl: savedBackground });
  try {
    assert.equal(
      harness.document.body.style.getPropertyValue("--chatobs-panel-image"),
      `url("${savedBackground}")`
    );
    assert.equal(harness.document.body.dataset.chatobsCustomBackground, "true");
    assert.equal(harness.document.getElementById("chatobs-background-remove").disabled, false);
    assert.equal(
      harness.document.getElementById("chatobs-background-status").textContent,
      "自訂背景已套用並儲存在本機"
    );
  } finally {
    harness.cleanup();
  }
});

test("A) Storage onChanged 進行 partial merge 且不造成 save loop", async () => {
  const harness = await createHarness({ ttsVolume: 50 });
  try {
    await new Promise((resolve) => harness.window.setTimeout(resolve, 300));
    const initialSavedCount = harness.saved.length;
    harness.triggerStorageChange({
      ttsVolume: { oldValue: 50, newValue: 80 },
      theme: { oldValue: "red", newValue: "green" }
    });
    await waitForMutations(harness.window);

    const volumeSlider = harness.document.getElementById("chatobs-volume-slider");
    assert.equal(volumeSlider.value, "80");
    assert.equal(harness.document.body.dataset.chatobsTheme, "green");
    assert.equal(harness.saved.length, initialSavedCount, "不應二次觸發 storage.set 造成 save loop");
  } finally {
    harness.cleanup();
  }
});

test("外部 storage onChanged 更新關鍵字後會刷新既有留言高亮", async () => {
  const harness = await createHarness();
  try {
    const renderer = createTextMessage(harness.document, "觀眾", "外部命中詞");
    harness.items.append(renderer);
    await waitForMutations(harness.window);
    assert.equal(renderer.classList.contains("chatobs-highlighted"), false);

    harness.triggerStorageChange({
      highlightKeywords: { oldValue: "", newValue: "命中詞" }
    });
    await waitForMutations(harness.window);
    assert.equal(renderer.classList.contains("chatobs-highlighted"), true);
  } finally {
    harness.cleanup();
  }
});

test("外部 storage onChanged 刪除設定鍵後會回到預設值", async () => {
  const harness = await createHarness({ theme: "red", highlightKeywords: "命中詞" });
  try {
    const renderer = createTextMessage(harness.document, "觀眾", "命中詞");
    harness.items.append(renderer);
    await waitForMutations(harness.window);
    assert.equal(renderer.classList.contains("chatobs-highlighted"), true);

    harness.triggerStorageChange({
      theme: { oldValue: "red" },
      highlightKeywords: { oldValue: "命中詞" }
    });
    await waitForMutations(harness.window);
    assert.equal(harness.document.body.dataset.chatobsTheme, "black");
    assert.equal(renderer.classList.contains("chatobs-highlighted"), false);
  } finally {
    harness.cleanup();
  }
});

test("storage get 延遲期間外部刪除設定鍵也會套用預設值", async () => {
  const harness = await createHarness(
    { theme: "red", highlightKeywords: "命中詞" },
    { delayStorageGet: true }
  );
  try {
    const renderer = createTextMessage(harness.document, "觀眾", "命中詞");
    harness.items.append(renderer);
    harness.triggerStorageChange({
      theme: { oldValue: "red" },
      highlightKeywords: { oldValue: "命中詞" }
    });
    harness.releaseStorageGet();
    await waitForMutations(harness.window);
    assert.equal(harness.document.body.dataset.chatobsTheme, "black");
    assert.equal(renderer.classList.contains("chatobs-highlighted"), false);
  } finally {
    harness.releaseStorageGet();
    harness.cleanup();
  }
});

// === B 項目測試：TTS safeSpeak, throw/onerror, watchdog, test voice queue restoration ===
test("B) 試聽按鈕完成後恢復 active 留言並維持 FIFO", async () => {
  const harness = await createHarness({ ttsEnabled: true, staleAfterSeconds: 5 });
  try {
    let now = 1_000;
    harness.window.Date.now = () => now;

    // A 正在朗讀；即使稍後超過原始過期時間，試聽也不可吞掉 active A。
    harness.items.append(createTextMessage(harness.document, "小華", "訊息 1"));
    await waitForMutations(harness.window);
    assert.equal(harness.spoken[0].text, "訊息 1");

    // 超過 staleAfterSeconds 後點擊試聽；被中斷的 active A 應以現在時間重新入列。
    now = 7_000;
    const testBtn = harness.document.getElementById("chatobs-test-voice");
    testBtn.click();
    await waitForMutations(harness.window);

    const lastSpoken = harness.spoken[harness.spoken.length - 1];
    assert.match(lastSpoken.text, /語音朗讀已開啟/);

    // 試聽期間抵達的 B 應排在恢復的 A 後面。
    harness.items.append(createTextMessage(harness.document, "小華", "隊列中的訊息 2"));
    await waitForMutations(harness.window);

    // 模擬試聽 spoken utterance 觸發 onend
    if (typeof lastSpoken.onend === "function") {
      lastSpoken.onend();
    }
    await waitForMutations(harness.window);

    // 試聽完畢後應該先恢復 active A，再依 FIFO 念 B。
    let currentSpoken = harness.spoken[harness.spoken.length - 1];
    assert.equal(currentSpoken.text, "訊息 1");
    currentSpoken.onend?.();
    await waitForMutations(harness.window);
    currentSpoken = harness.spoken[harness.spoken.length - 1];
    assert.equal(currentSpoken.text, "隊列中的訊息 2");
  } finally {
    harness.cleanup();
  }
});

test("B) 試聽恢復 active 留言時仍遵守 queueLimit", async () => {
  const harness = await createHarness({ ttsEnabled: true, queueLimit: 3 });
  try {
    for (let index = 1; index <= 4; index += 1) {
      harness.items.append(createTextMessage(harness.document, "觀眾", `限制測試 ${index}`));
    }
    await waitForMutations(harness.window);
    assert.equal(harness.spoken[0].text, "限制測試 1");

    const testButton = harness.document.getElementById("chatobs-test-voice");
    testButton.click();
    await waitForMutations(harness.window);
    const testUtterance = harness.spoken.at(-1);
    testUtterance.onend?.();
    await waitForMutations(harness.window);
    assert.equal(harness.spoken.at(-1).text, "限制測試 1");

    harness.spoken.at(-1).onend?.();
    await waitForMutations(harness.window);
    assert.equal(harness.spoken.at(-1).text, "限制測試 2");
    assert.equal(harness.spoken.some((item) => item.text === "限制測試 4"), false);
  } finally {
    harness.cleanup();
  }
});

test("B) speech template 依留言語言選擇，不受 uiLocale 污染", async () => {
  const harness = await createHarness({
    uiLocale: "zh-TW",
    ttsEnabled: true,
    ttsReadName: true
  });
  try {
    const renderer = harness.document.createElement("yt-live-chat-paid-message-renderer");
    renderer.innerHTML = `
      <span id="author-name">太郎</span>
      <span id="message">こんにちは</span>
    `;
    harness.items.append(renderer);
    await waitForMutations(harness.window);

    assert.equal(harness.spoken[0].text, "Super Chat、太郎さん：こんにちは");
  } finally {
    harness.cleanup();
  }
});

test("B) 未知語言只朗讀中性正文，不套用錯誤語系前綴", async () => {
  const harness = await createHarness({
    uiLocale: "zh-TW",
    ttsEnabled: true,
    ttsReadName: true
  });
  try {
    const renderer = harness.document.createElement("yt-live-chat-paid-message-renderer");
    renderer.innerHTML = `
      <span id="author-name">Viewer</span>
      <span id="message">12345</span>
    `;
    harness.items.append(renderer);
    await waitForMutations(harness.window);

    assert.equal(harness.spoken[0].text, "12345");
  } finally {
    harness.cleanup();
  }
});

test("B) speechSynthesis.speak 拋錯時保留佇列並提供重試提示", async () => {
  const harness = await createHarness({ ttsEnabled: true }, { speakThrows: true });
  try {
    harness.items.append(createTextMessage(harness.document, "小華", "第一則"));
    harness.items.append(createTextMessage(harness.document, "小華", "第二則"));
    await waitForMutations(harness.window);

    assert.match(harness.document.getElementById("chatobs-status-line").textContent, /語音播放失敗/);
    harness.window.speechSynthesis.speak = (utterance) => harness.spoken.push(utterance);
    harness.document.getElementById("chatobs-test-voice").click();
    harness.spoken.at(-1).onend();
    assert.equal(harness.spoken.at(-1).text, "第一則");
    harness.spoken.at(-1).onend();
    assert.equal(harness.spoken.at(-1).text, "第二則");
  } finally {
    harness.cleanup();
  }
});

test("B) 語音未回報完成時 watchdog 會解除 active 並提示重試", async () => {
  const harness = await createHarness(
    { ttsEnabled: true },
    { accelerateWatchdog: true }
  );
  try {
    harness.items.append(createTextMessage(harness.document, "小華", "可能卡住的留言"));
    await waitForMutations(harness.window);
    await waitForMutations(harness.window);

    assert.match(harness.document.getElementById("chatobs-status-line").textContent, /語音播放失敗/);
  } finally {
    harness.cleanup();
  }
});

test("B) 引擎錯誤不吞後續留言，跳過失敗項可恢復佇列且舊回呼不干擾", async () => {
  const harness = await createHarness({ ttsEnabled: true });
  try {
    harness.items.append(createTextMessage(harness.document, "A", "第一則"));
    harness.items.append(createTextMessage(harness.document, "B", "第二則"));
    await waitForMutations(harness.window);
    const failed = harness.spoken[0];
    failed.onerror({ error: "not-allowed" });
    harness.items.append(createTextMessage(harness.document, "C", "第三則"));
    await waitForMutations(harness.window);
    assert.equal(harness.spoken.length, 1);
    assert.match(harness.document.getElementById("chatobs-status-line").textContent, /語音播放失敗/);
    harness.document.getElementById("chatobs-skip-speech").click();
    await waitForMutations(harness.window);
    assert.equal(harness.spoken.at(-1).text, "第二則");
    failed.onerror({ error: "interrupted" });
    assert.equal(harness.spoken.length, 2);
    harness.spoken.at(-1).onend();
    assert.equal(harness.spoken.at(-1).text, "第三則");
  } finally {
    harness.cleanup();
  }
});

// === C 項目測試：Voice 選單只列 localService=true，遠端回落預設 & UI 隱私提示 ===
test("C) Voice 選單只提供 localService=true，遠端設定會回落至本機語音", async () => {
  const harness = await createHarness({ ttsVoiceURI: "test-remote-zh-tw" });
  try {
    const select = harness.document.getElementById("chatobs-voice-select");
    const options = [...select.options].map((opt) => opt.value);

    assert.deepEqual(options, ["test-local-zh-tw"]);
    assert.equal(select.value, "test-local-zh-tw", "遠端 voiceURI 應回落至明確的本機語音");

    // UI 檢查本機隱私提示
    const privacyTip = harness.document.querySelector(".chatobs-privacy-tip");
    assert.ok(privacyTip, "應包含 UI 本機隱私提示元素");
  } finally {
    harness.cleanup();
  }
});

test("C) 沒有明確本機語音時不會把聊天室文字交給系統預設語音", async () => {
  const harness = await createHarness({ ttsEnabled: true });
  try {
    harness.setVoices([]);
    harness.triggerVoicesChanged();
    const toggle = harness.document.getElementById("chatobs-tts-toggle");
    toggle.checked = true;
    toggle.dispatchEvent(
      new harness.window.Event("change", { bubbles: true })
    );
    harness.items.append(createTextMessage(harness.document, "小華", "不得交給未知語音"));
    await waitForMutations(harness.window);

    assert.equal(harness.spoken.length, 0);
    assert.equal(toggle.checked, true, "等待語音載入時應保留使用者的開啟意圖");
    assert.match(
      harness.document.getElementById("chatobs-status-line").textContent,
      /等待本機語音/
    );

    harness.setVoices([{ name: "稍後載入的語音", lang: "zh-TW", voiceURI: "late-local", localService: true }]);
    harness.triggerVoicesChanged();
    await waitForMutations(harness.window);

    assert.equal(toggle.checked, true);
    assert.equal(harness.document.getElementById("chatobs-voice-select").value, "late-local");
    assert.equal(harness.document.getElementById("chatobs-status-line").textContent, "朗讀中");
    assert.equal(harness.spoken.at(-1).text, "不得交給未知語音");
  } finally {
    harness.cleanup();
  }
});

// === D 項目測試：Document-level Discovery observer & items 動態替換 ===
test("D) Document observer 支援 #items 延遲出現與替換", async () => {
  const harness = await createHarness({ ttsEnabled: true });
  try {
    // 移除舊 items，建立新 items 容器
    harness.items.remove();
    await waitForMutations(harness.window);

    const newItems = harness.document.createElement("div");
    newItems.id = "items";
    newItems.className = "yt-live-chat-item-list-renderer";
    harness.document.body.append(newItems);
    await waitForMutations(harness.window);

    newItems.append(createTextMessage(harness.document, "阿強", "新容器的測試訊息"));
    await waitForMutations(harness.window);

    const lastSpoken = harness.spoken[harness.spoken.length - 1];
    assert.equal(lastSpoken.text, "新容器的測試訊息");
  } finally {
    harness.cleanup();
  }
});

// === Multilingual TTS Mode & Voice Routing Tests ===
test("TTS 模式切換與預設值 sanitize 驗證", async () => {
  const harness = await createHarness({ ttsVoiceMode: "invalid-mode" });
  try {
    const modeSelect = harness.document.getElementById("chatobs-voice-mode-select");
    assert.ok(modeSelect, "應包含語音模式選擇下拉選單");
    assert.equal(modeSelect.value, "auto", "無效的 ttsVoiceMode 應 fallback 至 auto");

    modeSelect.value = "fixed";
    modeSelect.dispatchEvent(new harness.window.Event("change", { bubbles: true }));
    await new Promise((resolve) => harness.window.setTimeout(resolve, 300));

    assert.equal(harness.saved.at(-1).ttsVoiceMode, "fixed", "切換為 fixed 模式時應持久保存");
  } finally {
    harness.cleanup();
  }
});

test("自動模式不會在 voiceschanged 時偷偷覆寫預設語音設定", async () => {
  const harness = await createHarness({ ttsVoiceMode: "auto", ttsVoiceURI: "" });
  try {
    harness.setVoices([
      { name: "Local TW", lang: "zh-TW", voiceURI: "voice-zh", localService: true },
      { name: "Local EN", lang: "en-US", voiceURI: "voice-en", localService: true }
    ]);
    harness.triggerVoicesChanged();
    await new Promise((resolve) => harness.window.setTimeout(resolve, 300));

    assert.equal(harness.document.getElementById("chatobs-voice-select").value, "voice-zh");
    const themeSelect = harness.document.getElementById("chatobs-theme-select");
    themeSelect.value = "green";
    themeSelect.dispatchEvent(new harness.window.Event("change", { bubbles: true }));
    assert.equal(
      harness.document.getElementById("chatobs-voice-select").value,
      "voice-zh",
      "切換主題或同步其他控制項時不可清空 auto fallback 的可見選項"
    );
    assert.equal(harness.saved.length, 0, "載入 voice 清單只可更新 UI，不可反向改寫設定");
  } finally {
    harness.cleanup();
  }
});

test("自動模式依社群品質訊號避開日文角色聲並推薦 Kyoko", async () => {
  const harness = await createHarness({ ttsEnabled: true, ttsVoiceMode: "auto" });
  try {
    harness.setVoices([
      { name: "Eddy (日文（日本）)", lang: "ja-JP", voiceURI: "voice-ja-eddy", localService: true },
      { name: "Flo (日文（日本）)", lang: "ja-JP", voiceURI: "voice-ja-flo", localService: true },
      { name: "Kyoko", lang: "ja-JP", voiceURI: "voice-ja-kyoko", localService: true },
      { name: "Remote Google 日本語", lang: "ja-JP", voiceURI: "voice-ja-google", localService: false }
    ]);
    harness.triggerVoicesChanged();

    harness.items.append(createTextMessage(harness.document, "User", "こんにちは、今日もよろしくお願いします"));
    await waitForMutations(harness.window);

    assert.equal(harness.spoken.at(-1).voice.voiceURI, "voice-ja-kyoko");
    const labels = [...harness.document.getElementById("chatobs-voice-select").options]
      .map((option) => option.textContent);
    assert.ok(labels.some((label) => /Kyoko.+推薦/.test(label)));
    assert.equal(labels.some((label) => /Remote Google/.test(label)), false, "遠端 voice 不得混入純本機推薦");
  } finally {
    harness.cleanup();
  }
});

test("自動模式下依語言挑選本機 voice，且多語留言仍維持 FIFO", async () => {
  const harness = await createHarness({ ttsEnabled: true, ttsVoiceMode: "auto" });
  try {
    harness.setVoices([
      { name: "Local TW", lang: "zh-TW", voiceURI: "voice-zh", localService: true },
      { name: "Local JA", lang: "ja-JP", voiceURI: "voice-ja", localService: true },
      { name: "Local KO", lang: "ko-KR", voiceURI: "voice-ko", localService: true },
      { name: "Local EN", lang: "en-US", voiceURI: "voice-en", localService: true },
      { name: "Local AR", lang: "ar-SA", voiceURI: "voice-ar", localService: true },
      { name: "Local HE", lang: "he-IL", voiceURI: "voice-he", localService: true },
      { name: "Local EL", lang: "el-GR", voiceURI: "voice-el", localService: true },
      { name: "Local TH", lang: "th-TH", voiceURI: "voice-th", localService: true },
      { name: "Local HI", lang: "hi-IN", voiceURI: "voice-hi", localService: true },
      { name: "Local RU", lang: "ru-RU", voiceURI: "voice-ru", localService: true },
      { name: "Remote JA", lang: "ja-JP", voiceURI: "voice-remote-ja", localService: false }
    ]);
    harness.triggerVoicesChanged();

    // 1. 中文
    harness.items.append(createTextMessage(harness.document, "A", "主人晚安"));
    await waitForMutations(harness.window);
    assert.equal(harness.spoken.at(-1).voice.voiceURI, "voice-zh");
    harness.spoken.at(-1).onend?.();

    // 2. 日文
    harness.items.append(createTextMessage(harness.document, "B", "こんにちは、元気ですか"));
    await waitForMutations(harness.window);
    assert.equal(harness.spoken.at(-1).voice.voiceURI, "voice-ja");
    harness.spoken.at(-1).onend?.();

    // 3. 韓文
    harness.items.append(createTextMessage(harness.document, "C", "안녕하세요 반갑습니다"));
    await waitForMutations(harness.window);
    assert.equal(harness.spoken.at(-1).voice.voiceURI, "voice-ko");
    harness.spoken.at(-1).onend?.();

    // 4. 英文
    harness.items.append(createTextMessage(harness.document, "D", "Hello world this is awesome"));
    await waitForMutations(harness.window);
    assert.equal(harness.spoken.at(-1).voice.voiceURI, "voice-en");
    harness.spoken.at(-1).onend?.();

    // 5. 阿拉伯文
    harness.items.append(createTextMessage(harness.document, "E", "مرحبا بك"));
    await waitForMutations(harness.window);
    assert.equal(harness.spoken.at(-1).voice.voiceURI, "voice-ar");
    harness.spoken.at(-1).onend?.();

    // 6. 西里爾文 (俄文)
    harness.items.append(createTextMessage(harness.document, "F", "Привет друзья"));
    await waitForMutations(harness.window);
    assert.equal(harness.spoken.at(-1).voice.voiceURI, "voice-ru");
    harness.spoken.at(-1).onend?.();

    const moreLanguages = [
      ["שלום חברים", "voice-he"],
      ["Γεια σας φίλοι", "voice-el"],
      ["สวัสดีครับ", "voice-th"],
      ["नमस्ते दोस्तों", "voice-hi"]
    ];
    for (const [message, voiceURI] of moreLanguages) {
      harness.items.append(createTextMessage(harness.document, "G", message));
      await waitForMutations(harness.window);
      assert.equal(harness.spoken.at(-1).voice.voiceURI, voiceURI);
      harness.spoken.at(-1).onend?.();
    }

    assert.deepEqual(
      harness.spoken.map((utterance) => utterance.text),
      [
        "主人晚安",
        "こんにちは、元気ですか",
        "안녕하세요 반갑습니다",
        "Hello world this is awesome",
        "مرحبا بك",
        "Привет друзья",
        ...moreLanguages.map(([message]) => message)
      ],
      "voice 路由只能改每則 voice，不得重排單一 TTS queue"
    );
  } finally {
    harness.cleanup();
  }
});

test("自動模式以原始留言偵測語言，不受中文作者、時間與類型前綴污染", async () => {
  const harness = await createHarness({
    ttsEnabled: true,
    ttsVoiceMode: "auto",
    ttsReadName: true,
    ttsReadTime: true
  });
  try {
    harness.setVoices([
      { name: "Local TW", lang: "zh-TW", voiceURI: "voice-zh", localService: true },
      { name: "Local FR", lang: "fr-FR", voiceURI: "voice-fr", localService: true },
      { name: "Local ES", lang: "es-ES", voiceURI: "voice-es", localService: true }
    ]);
    harness.triggerVoicesChanged();

    harness.items.append(createTextMessage(harness.document, "小明", "bonjour merci", "12:34"));
    await waitForMutations(harness.window);
    assert.equal(harness.spoken.at(-1).voice.voiceURI, "voice-fr");
    assert.equal(harness.spoken.at(-1).text, "12:34, 小明 says: bonjour merci");
    harness.spoken.at(-1).onend?.();

    harness.items.append(createTextMessage(harness.document, "小華", "¡Hola!", "12:35"));
    await waitForMutations(harness.window);
    assert.equal(harness.spoken.at(-1).voice.voiceURI, "voice-es");
  } finally {
    harness.cleanup();
  }
});

test("自動模式遭遇短句／純符號／無相應本機語音時回退至選定語音", async () => {
  const harness = await createHarness({ ttsEnabled: true, ttsVoiceMode: "auto", ttsVoiceURI: "voice-zh" });
  try {
    harness.setVoices([
      { name: "Local TW", lang: "zh-TW", voiceURI: "voice-zh", localService: true },
      { name: "Local EN", lang: "en-US", voiceURI: "voice-en", localService: true }
    ]);
    harness.triggerVoicesChanged();

    // 1. 純數字與標點
    harness.items.append(createTextMessage(harness.document, "User", "12345 !!!"));
    await waitForMutations(harness.window);
    assert.equal(harness.spoken.at(-1).voice.voiceURI, "voice-zh");
    harness.spoken.at(-1).onend?.();

    // 2. 只有日文留言，但沒有日文本機語音 -> 回退至選定語音 (voice-zh)
    harness.items.append(createTextMessage(harness.document, "User", "こんにちは"));
    await waitForMutations(harness.window);
    assert.equal(harness.spoken.at(-1).voice.voiceURI, "voice-zh");
  } finally {
    harness.cleanup();
  }
});

test("固定語音模式 (fixed) 恆定使用選定語音且不跳過 Queue 順序", async () => {
  const harness = await createHarness({ ttsEnabled: true, ttsVoiceMode: "fixed", ttsVoiceURI: "voice-zh" });
  try {
    harness.setVoices([
      { name: "Local TW", lang: "zh-TW", voiceURI: "voice-zh", localService: true },
      { name: "Local JA", lang: "ja-JP", voiceURI: "voice-ja", localService: true }
    ]);
    harness.triggerVoicesChanged();

    harness.items.append(createTextMessage(harness.document, "User1", "こんにちは"));
    harness.items.append(createTextMessage(harness.document, "User2", "Hello World"));
    await waitForMutations(harness.window);

    assert.equal(harness.spoken.length, 1);
    assert.equal(harness.spoken[0].voice.voiceURI, "voice-zh");
    harness.spoken[0].onend?.();
    await waitForMutations(harness.window);

    assert.equal(harness.spoken.length, 2);
    assert.equal(harness.spoken[1].voice.voiceURI, "voice-zh");
  } finally {
    harness.cleanup();
  }
});

test("固定模式指定 voice 消失時會保留等待留言，不會偷換其他語音", async () => {
  const harness = await createHarness({
    ttsEnabled: true,
    ttsVoiceMode: "fixed",
    ttsVoiceURI: "missing-voice"
  });
  try {
    harness.setVoices([
      { name: "Local TW", lang: "zh-TW", voiceURI: "voice-zh", localService: true }
    ]);
    harness.triggerVoicesChanged();
    harness.items.append(createTextMessage(harness.document, "User", "不能插隊的留言"));
    await waitForMutations(harness.window);

    assert.equal(harness.spoken.length, 0);
    assert.match(harness.document.getElementById("chatobs-status-line").textContent, /固定語音不可用/);
    assert.equal(harness.document.getElementById("chatobs-voice-select").value, "");
  } finally {
    harness.cleanup();
  }
});

test("中文留言的顏文字不會誤切日文語音", async () => {
  const harness = await createHarness({ ttsEnabled: true, ttsVoiceMode: "auto" });
  try {
    harness.setVoices([
      { name: "Local TW", lang: "zh-TW", voiceURI: "voice-zh", localService: true },
      { name: "Local JA", lang: "ja-JP", voiceURI: "voice-ja", localService: true }
    ]);
    harness.triggerVoicesChanged();

    for (const message of ["主人晚安 ヾ(。￣□￣)ﾂ", "大家好 (っ´ω`)っ", "ヾ(。￣□￣)ﾂ"]) {
      harness.items.append(createTextMessage(harness.document, "User", message));
      await waitForMutations(harness.window);
      assert.equal(harness.spoken.at(-1).voice.voiceURI, "voice-zh", message);
      harness.spoken.at(-1).onend?.();
    }
  } finally {
    harness.cleanup();
  }
});

test("英文留言優先使用較明亮的本機語音，只有已知男聲時回到中文語音", async () => {
  const harness = await createHarness({ ttsEnabled: true, ttsVoiceMode: "auto" });
  try {
    const chineseVoice = { name: "Local TW", lang: "zh-TW", voiceURI: "voice-zh", localService: true };
    harness.setVoices([
      chineseVoice,
      { name: "Alex", lang: "en-US", voiceURI: "voice-en-alex", localService: true, default: true },
      { name: "Samantha", lang: "en-US", voiceURI: "voice-en-samantha", localService: true }
    ]);
    harness.triggerVoicesChanged();
    harness.items.append(createTextMessage(harness.document, "User", "Hello everyone"));
    await waitForMutations(harness.window);
    assert.equal(harness.spoken.at(-1).voice.voiceURI, "voice-en-samantha");
    harness.spoken.at(-1).onend?.();

    harness.setVoices([
      chineseVoice,
      { name: "Daniel", lang: "en-US", voiceURI: "voice-en-daniel", localService: true, default: true }
    ]);
    harness.triggerVoicesChanged();
    harness.items.append(createTextMessage(harness.document, "User", "Good evening"));
    await waitForMutations(harness.window);
    assert.equal(harness.spoken.at(-1).voice.voiceURI, "voice-zh");
  } finally {
    harness.cleanup();
  }
});

test("自動切換中日英文時女聲優先於高品質預設男聲與已選男聲", async () => {
  const cases = [
    ["zh-TW", "Zhiwei", "Meijia (Compact)", "大家晚安"],
    ["ja-JP", "Otoya", "Kyoko (Compact)", "みなさん、こんにちは"],
    ["en-US", "Daniel", "Samantha (Compact)", "Hello everyone"],
    ["zh-TW", "Zhiwei", "Microsoft Hanhan Desktop", "歡迎回來"],
    ["ja-JP", "Ichiro", "Microsoft Haruka Desktop", "こんにちは、元気ですか"]
  ];
  for (const [lang, maleName, femaleName, message] of cases) {
    const harness = await createHarness({ ttsEnabled: true, ttsVoiceMode: "auto", ttsVoiceURI: "male" });
    try {
      harness.setVoices([
        { name: `${maleName} (Enhanced)`, lang, voiceURI: "male", localService: true, default: true },
        { name: femaleName, lang, voiceURI: "female", localService: true }
      ]);
      harness.triggerVoicesChanged();
      harness.items.append(createTextMessage(harness.document, "User", message));
      await waitForMutations(harness.window);
      assert.equal(harness.spoken.at(-1).voice.voiceURI, "female", `${lang}: ${femaleName}`);
    } finally {
      harness.cleanup();
    }
  }
});

test("固定模式保留手選男聲，不套用自動模式女聲偏好", async () => {
  const harness = await createHarness({ ttsEnabled: true, ttsVoiceMode: "fixed", ttsVoiceURI: "male" });
  try {
    harness.setVoices([
      { name: "Daniel", lang: "en-GB", voiceURI: "male", localService: true },
      { name: "Samantha", lang: "en-US", voiceURI: "female", localService: true }
    ]);
    harness.triggerVoicesChanged();
    harness.items.append(createTextMessage(harness.document, "User", "Hello everyone"));
    await waitForMutations(harness.window);
    assert.equal(harness.spoken.at(-1).voice.voiceURI, "male");
  } finally {
    harness.cleanup();
  }
});

test("混合語言留言保持單一 Utterance，佇列維持 FIFO 順序", async () => {
  const harness = await createHarness({ ttsEnabled: true, ttsVoiceMode: "auto" });
  try {
    harness.setVoices([
      { name: "Local TW", lang: "zh-TW", voiceURI: "voice-zh", localService: true },
      { name: "Local JA", lang: "ja-JP", voiceURI: "voice-ja", localService: true }
    ]);
    harness.triggerVoicesChanged();

    harness.items.append(createTextMessage(harness.document, "User", "Hello 主人 こんにちは"));
    await waitForMutations(harness.window);

    assert.equal(harness.spoken.length, 1, "混合語言留言不可被拆分成多個 utterance");
    assert.equal(harness.spoken[0].voice.voiceURI, "voice-ja", "含假名的混合句應優先交給日文 voice");
  } finally {
    harness.cleanup();
  }
});

// === F 項目測試：content.css 不得包含 outline: none 並具備 focus-visible 樣式 ===
test("F) CSS 規範檢查：無 outline:none 且包含 :focus-visible", () => {
  const cssContent = fs.readFileSync(path.join(__dirname, "..", "content.css"), "utf8");
  assert.equal(cssContent.includes("outline: none"), false, "不可使用 outline: none");
  assert.equal(cssContent.includes("outline:none"), false, "不可使用 outline:none");
  assert.ok(cssContent.includes(":focus-visible"), "必須包含 :focus-visible 焦距環設定");
  assert.ok(cssContent.includes("--chatobs-radius-shell"), "視覺圓角應由共同 token 管理");
  assert.ok(cssContent.includes("--chatobs-accent: #ff4d5a"), "紅色應維持鮮紅重點色");
  assert.ok(cssContent.includes("--chatobs-active-text: #200208"), "紅色亮面應使用高對比深色文字");
  assert.ok(cssContent.includes("--chatobs-accent: #b9d8ff"), "黑色應維持黑鉻冷光重點色");
  assert.ok(cssContent.includes("--chatobs-accent: #4ee6a8"), "綠色應維持祖母綠重點色");
  assert.ok(cssContent.includes("--chatobs-accent: #ffd15a"), "金色應維持亮金黃重點色");
  assert.ok(cssContent.includes("prefers-reduced-motion: reduce"), "必須尊重減少動態偏好");
  assert.equal(cssContent.includes("chatobs-mode-switch"), false, "不應保留多餘的模式選擇器");
  assert.equal(cssContent.includes("chatobs-reader-stage"), false, "不應保留朗讀專用全螢幕畫面");
  assert.ok(cssContent.includes("@keyframes chatobs-flow-line"), "精品電競畫風應包含流光飾線");
  assert.ok(cssContent.includes("@keyframes chatobs-specular-sweep"), "精品材質應包含高光掃過效果");
  assert.ok(cssContent.includes("--chatobs-material-art"), "十二套畫風應包含材質紋理");
  assert.ok(cssContent.includes("--chatobs-specular"), "面板內框應包含金屬高光色票");
  assert.ok(cssContent.includes("--chatobs-panel-gradient"), "控制面板應使用明顯主題漸層");
  assert.ok(cssContent.includes("--chatobs-chat-gradient"), "聊天室卡片應使用方向性漸層");
  for (const theme of ["black", "red", "orange", "yellow", "green", "blue", "purple", "gray", "gold", "silver", "rainbow"]) {
    const themeBlocks = [...cssContent.matchAll(new RegExp(`body\\[data-chatobs-theme="${theme}"\\] \\{([\\s\\S]*?)\\n\\}`, "g"))];
    const themeBlock = themeBlocks.at(-1)?.[1] || "";
    assert.match(themeBlock, /--chatobs-chat-gradient:[^;]*transparent 50%/, `${theme} 留言卡中央不得再覆蓋深色遮罩`);
  }
  assert.ok(cssContent.includes("--chatobs-input-gradient"), "輸入區應使用主題漸層");
  for (const asset of [
    "cosmic-spectrum-black.jpg", "cosmic-spectrum-red.jpg", "cosmic-spectrum-orange.jpg",
    "cosmic-spectrum-yellow.jpg", "cosmic-spectrum-green.jpg", "cosmic-spectrum-blue.jpg",
    "cosmic-spectrum-purple.jpg", "cosmic-spectrum-gray.jpg", "cosmic-spectrum-white.jpg",
    "cosmic-spectrum-gold.jpg", "cosmic-spectrum-silver.jpg", "cosmic-spectrum-rainbow.jpg"
  ]) {
    assert.ok(cssContent.includes(`assets/themes/${asset}`), `CSS 應引用宇宙背景 ${asset}`);
    assert.ok(fs.existsSync(path.join(__dirname, "..", "assets", "themes", asset)), `應封裝宇宙背景 ${asset}`);
  }
  assert.ok(cssContent.includes("--chatobs-title-text"), "十二套主題應提供標題文字色");
  assert.ok(cssContent.includes("--chatobs-text-outline"), "文字應提供反色描邊 token");
  assert.ok(cssContent.includes("--chatobs-text-shadow"), "所有文字應共用反色描邊 token");
  assert.ok(cssContent.includes("--chatobs-active-outline"), "深色啟用文字應提供亮色反描邊 token");
  assert.ok(cssContent.includes("--chatobs-text-glow"), "文字應提供主題柔光 token");
  assert.match(cssContent, /\.chatobs-language-switch button\s*\{[\s\S]*font-weight: 800 !important;/, "語言按鈕文字應使用明確粗體");
  assert.match(cssContent, /\.chatobs-language-switch button > span:not\(\.chatobs-language-flag\)[\s\S]*-webkit-text-stroke: 0\.3px color-mix\(in srgb, var\(--chatobs-text-outline\) 58%, transparent\);/, "語言文字應使用向外的超細描邊");
  assert.match(cssContent, /\.chatobs-language-switch button > span:not\(\.chatobs-language-flag\)[\s\S]*paint-order: stroke fill;/, "文字填色應覆蓋描邊內側");
  assert.match(cssContent, /\.chatobs-language-switch button\.is-active\s*\{[\s\S]*font-weight: 800 !important;/, "所有選中語言都應維持粗體");
  assert.match(cssContent, /\.chatobs-language-switch button\.is-active\s*\{[\s\S]*color: var\(--chatobs-text\);/, "選中語言應跟隨目前主題主要文字色");
  assert.match(cssContent, /\.chatobs-language-switch button\.is-active\s*\{[\s\S]*chatobs-language-select 560ms ease-out/, "選中語言應有短暫點擊後光效");
  assert.match(cssContent, /@keyframes chatobs-language-select\s*\{[\s\S]*filter: brightness\(1\.28\) saturate\(1\.2\);/, "語言選中光效應先提高亮度與飽和度");
  assert.match(cssContent, /\.chatobs-language-switch button\s*\{[\s\S]*white-space: nowrap;/, "語言名稱不可在窄欄位中斷行");
  assert.match(cssContent, /text-shadow:[\s\S]*var\(--chatobs-text-outline\)/, "面板與留言文字應套用反色描邊");
  assert.match(cssContent, /#chatobs-control-panel,\n#chatobs-control-panel \* \{[\s\S]*text-shadow: var\(--chatobs-text-shadow\);/, "控制面板所有文字應套用共用描邊");
  assert.match(cssContent, /body\.chatobs-active yt-live-chat-header-renderer,[\s\S]*body\.chatobs-active yt-live-chat-sponsorships-gift-redemption-announcement-renderer \{[\s\S]*text-shadow: var\(--chatobs-text-shadow\) !important;/, "聊天室各類文字容器應套用共用描邊");
  assert.match(cssContent, /\.chatobs-theme-select-control \{[\s\S]*color: var\(--chatobs-text\);/, "主題下拉文字應跟隨目前主題主要文字色");
  assert.match(cssContent, /\.chatobs-theme-select-control\s*\{[\s\S]*animation: chatobs-accent-breathe 3\.8s ease-in-out infinite;/, "主題下拉應維持穩定呼吸光");
  assert.match(cssContent, /\.chatobs-theme-select-control\.is-changing\s*\{[\s\S]*chatobs-language-select 560ms ease-out,[\s\S]*chatobs-accent-breathe 3\.8s ease-in-out 560ms infinite;/, "主題下拉選擇後應先脈衝再回到呼吸光");
  assert.match(cssContent, /\.chatobs-theme-select-control select\s*\{[\s\S]*font-weight: 800;/, "主題名稱應維持粗體");
  assert.match(cssContent, /body\.chatobs-active \.chatobs-colored-author\s*\{[\s\S]*color: color-mix\(in srgb, var\(--chatobs-author-color\) 68%, var\(--chatobs-accent\) 32%\)/, "留言作者色應與目前佈景強調色融合");
  assert.match(cssContent, /body\.chatobs-active yt-live-chat-text-message-renderer,[\s\S]*linear-gradient\(115deg, var\(--chatobs-accent-soft\), transparent 52%, var\(--chatobs-chat-surface-hover\)\)/, "聊天室留言卡片應使用目前佈景的強調色漸層");
  assert.match(cssContent, /body\.chatobs-active yt-live-chat-text-message-renderer,[\s\S]*0 8px 20px var\(--chatobs-accent-shadow\)/, "聊天室留言卡片應有主題色陰影");
  assert.match(cssContent, /#chatobs-control-panel::before \{[\s\S]*animation: chatobs-flow-line 6\.4s/, "頂部流光應降低速度");
  assert.match(cssContent, /#chatobs-control-panel::after \{[\s\S]*animation: chatobs-flow-line 8\.8s/, "面板內框流光應降低速度");
  assert.match(cssContent, /yt-live-chat-renderer #chat-messages \{[\s\S]*var\(--chatobs-chat-image-overlay\),[\s\S]*var\(--chatobs-panel-image\) center \/ cover no-repeat/, "主題背景應限制在留言畫布，不可污染原生頂欄與輸入列");
  assert.equal(cssContent.includes("body.chatobs-active yt-live-chat-renderer *"), false, "不可用全域後代選擇器破壞 YouTube 元件背景");
  assert.match(cssContent, /prefers-reduced-motion: reduce[\s\S]*#chatobs-control-panel::before,[\s\S]*animation: none !important;/, "減少動態偏好必須停用流光偽元素");
  assert.equal(/@import|url\(\s*["']?https?:/i.test(cssContent), false, "不得依賴遠端字型或素材");
  assert.match(cssContent, /body\.chatobs-active ::selection/, "文字選取色應納入主題系統");
  assert.match(cssContent, /caret-color: var\(--chatobs-accent\)/, "文字游標應納入主題系統");
  assert.ok(cssContent.includes("color-scheme: light"), "白色主題應明確使用淺色原生控制表面");
  assert.match(cssContent, /#chatobs-panel-body::\-webkit-scrollbar-thumb/, "面板捲軸應納入主題系統");

  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "manifest.json"), "utf8"));
  assert.equal(manifest.default_locale, "en", "使用 Chrome i18n 時必須指定預設語系");
  assert.equal(manifest.minimum_chrome_version, "111", "未加 fallback 的 color-mix() 需要 Chrome 111 以上");
  assert.equal(manifest.name, "__MSG_extName__", "擴充功能名稱應由 Chrome i18n 提供");
  assert.equal(manifest.description, "__MSG_extDescription__", "擴充功能描述應由 Chrome i18n 提供");
  assert.equal(manifest.action.default_title, "__MSG_actionTitle__", "工具列標題應由 Chrome i18n 提供");
  const localeKeys = [];
  for (const locale of ["en", "ja", "zh_TW"]) {
    const localePath = path.join(__dirname, "..", "_locales", locale, "messages.json");
    assert.ok(fs.existsSync(localePath), `${locale} locale 檔案應存在`);
    const messages = JSON.parse(fs.readFileSync(localePath, "utf8"));
    localeKeys.push(Object.keys(messages).sort());
  }
  assert.deepEqual(localeKeys[1], localeKeys[0], "日文 locale key 應與英文完整一致");
  assert.deepEqual(localeKeys[2], localeKeys[0], "繁中 locale key 應與英文完整一致");
  assert.deepEqual(manifest.web_accessible_resources, [{
    resources: [
      "assets/themes/cosmic-spectrum-black.jpg",
      "assets/themes/cosmic-spectrum-red.jpg",
      "assets/themes/cosmic-spectrum-orange.jpg",
      "assets/themes/cosmic-spectrum-yellow.jpg",
      "assets/themes/cosmic-spectrum-green.jpg",
      "assets/themes/cosmic-spectrum-blue.jpg",
      "assets/themes/cosmic-spectrum-purple.jpg",
      "assets/themes/cosmic-spectrum-gray.jpg",
      "assets/themes/cosmic-spectrum-white.jpg",
      "assets/themes/cosmic-spectrum-gold.jpg",
      "assets/themes/cosmic-spectrum-silver.jpg",
      "assets/themes/cosmic-spectrum-rainbow.jpg"
    ],
    matches: ["https://www.youtube.com/*"]
  }], "僅應向 YouTube 來源暴露十二張本機主題背景，WAR match pattern 的 path 必須使用 /*");
});

test("E) Storage API 拒絕時仍可啟動並安全清理", async () => {
  const harness = await createHarness({}, { storageGetRejects: true, storageSetRejects: true });
  try {
    assert.ok(harness.document.getElementById("chatobs-control-panel"));
    harness.document.getElementById("chatobs-font-slider").value = "32";
    harness.document.getElementById("chatobs-font-slider").dispatchEvent(
      new harness.window.Event("input", { bubbles: true })
    );
    await new Promise((resolve) => harness.window.setTimeout(resolve, 300));
    assert.match(harness.document.getElementById("chatobs-save-status").textContent, /設定尚未儲存/);
    assert.equal(harness.document.getElementById("chatobs-save-feedback").hidden, false);
  } finally {
    harness.cleanup();
  }
});

test("收合面板仍可開關朗讀，並保留使用者的收合偏好", async () => {
  const harness = await createHarness();
  try {
    const body = harness.document.getElementById("chatobs-panel-body");
    const toggle = harness.document.getElementById("chatobs-tts-toggle");
    assert.equal(body.hidden, true);
    assert.equal(body.contains(toggle), false, "主要操作必須在收合內容以外");
    toggle.checked = true;
    toggle.dispatchEvent(new harness.window.Event("change", { bubbles: true }));
    assert.equal(harness.spoken.length, 1, "收合時仍可啟動本機語音確認");
    assert.equal(body.hidden, true);
    toggle.checked = false;
    toggle.dispatchEvent(new harness.window.Event("change", { bubbles: true }));
    assert.equal(harness.document.getElementById("chatobs-status-line").textContent, "語音未開啟");
  } finally {
    harness.cleanup();
  }
});

test("儲存失敗提示不被語音狀態蓋掉，可直接重試尚未儲存的欄位", async () => {
  const harness = await createHarness({}, { storageSetFailures: 1 });
  try {
    const slider = harness.document.getElementById("chatobs-font-slider");
    slider.value = "32";
    slider.dispatchEvent(new harness.window.Event("input", { bubbles: true }));
    const feedback = harness.document.getElementById("chatobs-save-feedback");
    assert.equal(await waitForCondition(harness.window, () => !feedback.hidden), true);
    harness.document.getElementById("chatobs-test-voice").click();
    harness.triggerVoicesChanged();
    assert.equal(feedback.hidden, false, "試聽與語音清單更新不能消除未儲存警告");
    const retry = harness.document.getElementById("chatobs-retry-save");
    retry.focus();
    retry.click();
    assert.equal(await waitForCondition(harness.window, () => feedback.hidden), true);
    assert.deepEqual(Object.fromEntries(Object.entries(harness.saved[0])), { fontSize: 32 });
    assert.equal(harness.document.activeElement.id, "chatobs-collapse-button", "成功隱藏重試區後保留可操作焦點");
  } finally {
    harness.cleanup();
  }
});

test("讀取與儲存同時失敗後成功重試，隱藏按鈕會把焦點移回可操作控制", async () => {
  const harness = await createHarness({}, { storageGetRejects: true, storageSetFailures: 1 });
  try {
    const slider = harness.document.getElementById("chatobs-font-slider");
    slider.value = "32";
    slider.dispatchEvent(new harness.window.Event("input", { bubbles: true }));
    const retry = harness.document.getElementById("chatobs-retry-save");
    assert.equal(await waitForCondition(harness.window, () => !retry.hidden), true);
    retry.focus();
    retry.click();
    assert.equal(await waitForCondition(harness.window, () => harness.saved.length === 1), true);
    assert.equal(harness.document.getElementById("chatobs-save-feedback").hidden, false,
      "其餘原本偏好尚未重新讀回，載入警告仍須保留");
    assert.equal(retry.hidden, true);
    assert.equal(harness.document.activeElement.id, "chatobs-collapse-button");
  } finally {
    harness.cleanup();
  }
});

test("外部更新取代最後未儲存欄位後清除失敗提示，其他欄位更新不清除", async () => {
  const harness = await createHarness({}, { storageSetFailures: 1 });
  try {
    const slider = harness.document.getElementById("chatobs-font-slider");
    const feedback = harness.document.getElementById("chatobs-save-feedback");
    const retry = harness.document.getElementById("chatobs-retry-save");
    slider.value = "32";
    slider.dispatchEvent(new harness.window.Event("input", { bubbles: true }));
    assert.equal(await waitForCondition(harness.window, () => !retry.hidden), true);
    harness.triggerStorageChange({ theme: { newValue: "blue" } });
    assert.equal(feedback.hidden, false, "fontSize 尚未儲存，其他欄位更新不應消除警告");
    retry.focus();
    harness.triggerStorageChange({ fontSize: { newValue: 50 } });
    assert.equal(slider.value, "50");
    assert.equal(feedback.hidden, true, "外部更新已取代最後一個未儲存欄位");
    assert.equal(retry.hidden, true);
    assert.equal(harness.document.activeElement.id, "chatobs-collapse-button");
    retry.click();
    harness.window.dispatchEvent(new harness.window.Event("pagehide"));
    await waitForMutations(harness.window);
    assert.equal(harness.saved.length, 0, "不可補存失敗的舊值");
  } finally {
    harness.cleanup();
  }
});

test("隱藏頭像時尺寸滑桿真正不顯示，再開啟會恢復", async () => {
  const harness = await createHarness({ isCollapsed: false });
  try {
    const style = harness.document.createElement("style");
    style.textContent = contentStyles;
    harness.document.head.append(style);
    const toggle = harness.document.getElementById("chatobs-hide-avatars");
    const row = harness.document.getElementById("chatobs-avatar-row");
    assert.equal(harness.window.getComputedStyle(row).display, "grid");
    toggle.checked = true;
    toggle.dispatchEvent(new harness.window.Event("change", { bubbles: true }));
    assert.equal(row.hidden, true);
    assert.equal(harness.window.getComputedStyle(row).display, "none");
    toggle.checked = false;
    toggle.dispatchEvent(new harness.window.Event("change", { bubbles: true }));
    assert.equal(row.hidden, false);
    assert.equal(harness.window.getComputedStyle(row).display, "grid");
  } finally {
    harness.cleanup();
  }
});

test("設定載入失敗後持續說明預設值來源，不被朗讀狀態掩蓋", async () => {
  const harness = await createHarness({}, { storageGetRejects: true });
  try {
    const feedback = harness.document.getElementById("chatobs-save-feedback");
    assert.equal(feedback.hidden, false);
    harness.document.getElementById("chatobs-test-voice").click();
    harness.spoken.at(-1).onend();
    assert.match(harness.document.getElementById("chatobs-save-status").textContent, /無法讀取設定.*預設值/);
    assert.equal(feedback.hidden, false);
    assert.equal(harness.document.getElementById("chatobs-retry-save").hidden, true);
  } finally {
    harness.cleanup();
  }
});

test("語音關閉時試聽失敗仍有正確提示與重試，不誤稱留言失敗", async () => {
  const harness = await createHarness();
  try {
    harness.document.getElementById("chatobs-test-voice").click();
    const preview = harness.spoken[0];
    preview.onerror({ error: "audio-busy" });
    const feedback = harness.document.getElementById("chatobs-speech-feedback");
    assert.equal(feedback.hidden, false);
    assert.equal(harness.document.getElementById("chatobs-status-line").textContent, "語音試聽失敗");
    assert.match(harness.document.getElementById("chatobs-speech-error").textContent, /所選語音/);
    assert.equal(harness.document.getElementById("chatobs-skip-failed").textContent, "關閉提示");
    harness.document.getElementById("chatobs-retry-speech").click();
    assert.equal(harness.spoken.length, 2);
    assert.equal(harness.spoken[1].text, preview.text);
    harness.spoken[1].onend();
    assert.equal(feedback.hidden, true);
    assert.equal(harness.document.getElementById("chatobs-tts-toggle").checked, false);
  } finally {
    harness.cleanup();
  }
});

test("收合時可直接重試失敗留言，長時間等待與佇列溢位不丟失該留言", async () => {
  const harness = await createHarness({ ttsEnabled: true, queueLimit: 3 });
  try {
    harness.items.append(createTextMessage(harness.document, "A", "未讀完的留言"));
    await waitForMutations(harness.window);
    harness.spoken[0].onerror({ error: "audio-busy" });
    const now = harness.window.Date.now();
    harness.window.Date.now = () => now + 60000;
    for (let index = 1; index <= 5; index += 1) {
      harness.items.append(createTextMessage(harness.document, "B", `新留言 ${index}`));
    }
    await waitForMutations(harness.window);
    assert.equal(harness.spoken.length, 1);
    const retry = harness.document.getElementById("chatobs-retry-speech");
    assert.equal(harness.document.getElementById("chatobs-panel-body").hidden, true);
    retry.focus();
    retry.click();
    assert.equal(harness.spoken.at(-1).text, "未讀完的留言");
    assert.equal(harness.document.activeElement.id, "chatobs-tts-toggle");
    harness.spoken.at(-1).onend();
    assert.equal(harness.spoken.at(-1).text, "新留言 4", "僅移除最舊的等待項，保留最後兩則");
    harness.spoken.at(-1).onend();
    assert.equal(harness.spoken.at(-1).text, "新留言 5");
  } finally {
    harness.cleanup();
  }
});

test("切換介面語言同步更新動態語音選項與模式說明，保持選定語音", async () => {
  const harness = await createHarness({ ttsVoiceURI: "test-local-zh-tw" });
  try {
    const select = harness.document.getElementById("chatobs-voice-select");
    assert.match(select.selectedOptions[0].textContent, /推薦/);
    harness.document.querySelector('[data-locale="en"]').click();
    assert.match(select.selectedOptions[0].textContent, /Recommended/);
    assert.doesNotMatch(select.selectedOptions[0].textContent, /推薦/);
    assert.equal(select.value, "test-local-zh-tw");
    assert.match(harness.document.getElementById("chatobs-voice-label").textContent, /fallback/);
    const mode = harness.document.getElementById("chatobs-voice-mode-select");
    mode.value = "fixed";
    mode.dispatchEvent(new harness.window.Event("change", { bubbles: true }));
    assert.equal(harness.document.getElementById("chatobs-voice-label").textContent, "Fixed voice");
    assert.match(harness.document.getElementById("chatobs-voice-hint").textContent, /Every message/);
  } finally {
    harness.cleanup();
  }
});

test("語音載入與無可用語音時停用試聽，延遲語音到達後恢復操作", async () => {
  const harness = await createHarness({}, { delayStorageGet: true });
  try {
    const select = harness.document.getElementById("chatobs-voice-select");
    const preview = harness.document.getElementById("chatobs-test-voice");
    assert.equal(select.disabled, true);
    assert.equal(select.getAttribute("aria-busy"), "true");
    assert.equal(preview.disabled, true);
    harness.setVoices([]);
    harness.releaseStorageGet();
    await waitForMutations(harness.window);
    assert.equal(select.getAttribute("aria-busy"), "false");
    assert.equal(preview.disabled, true);
    assert.match(harness.document.getElementById("chatobs-voice-hint").textContent, /系統加入語音/);
    preview.click();
    assert.equal(harness.spoken.length, 0);
    harness.setVoices([{ name: "Local", lang: "zh-TW", voiceURI: "late", localService: true }]);
    harness.triggerVoicesChanged();
    assert.equal(select.disabled, false);
    assert.equal(preview.disabled, false);
    preview.click();
    assert.equal(harness.spoken.length, 1);
  } finally {
    harness.cleanup();
  }
});

test("UI copy catalog 維持三語 parity 且繁中沒有日文污染", () => {
  const markers = {
    "zh-TW": '"zh-TW": Object.freeze({',
    ja: "ja: Object.freeze({",
    en: "en: Object.freeze({"
  };
  const starts = Object.fromEntries(Object.entries(markers).map(([locale, marker]) => [
    locale,
    contentScript.indexOf(marker)
  ]));
  const endMarkers = {
    "zh-TW": "    }),\n    ja:",
    ja: "    }),\n    en:",
    en: "    })\n  });"
  };
  const catalogKeys = Object.fromEntries(Object.entries(starts).map(([locale, start]) => {
    assert.notEqual(start, -1, `${locale} UI copy catalog 應存在`);
    const end = contentScript.indexOf(endMarkers[locale], start);
    assert.notEqual(end, -1, `${locale} UI copy catalog 應有明確結尾`);
    const section = contentScript.slice(start, end);
    return [locale, [...section.matchAll(/^      ([A-Za-z][A-Za-z0-9]*)\s*:/gm)].map(([, key]) => key).sort()];
  }));

  assert.deepEqual(catalogKeys.ja, catalogKeys.en, "日文 UI copy key 應與英文完整一致");
  assert.deepEqual(catalogKeys["zh-TW"], catalogKeys.en, "繁中 UI copy key 應與英文完整一致");
  const zhCatalog = contentScript.slice(starts["zh-TW"], contentScript.indexOf(endMarkers["zh-TW"], starts["zh-TW"]));
  assert.match(zhCatalog, /panelTextSize: "面板文字"/);
  assert.match(zhCatalog, /keywordPlaceholder: "以逗號分隔，例如：初見, 問題"/);
  assert.doesNotMatch(zhCatalog, /救命/);
  assert.doesNotMatch(zhCatalog, /[\u3040-\u30ff]/, "繁中 UI copy 不應混入日文假名");
});

test("pagehide 會在 debounce 尚未落盤時 flush 最新設定", async () => {
  const harness = await createHarness();
  try {
    const slider = harness.document.getElementById("chatobs-font-slider");
    slider.value = "44";
    slider.dispatchEvent(new harness.window.Event("input", { bubbles: true }));
    assert.equal(harness.saved.length, 0, "debounce 尚未到期時不應先寫入");

    harness.window.dispatchEvent(new harness.window.Event("pagehide"));
    await new Promise((resolve) => harness.window.queueMicrotask(resolve));

    assert.equal(harness.saved.length, 1, "pagehide 應立即寫入最新設定");
    assert.equal(harness.saved[0].fontSize, 44);
  } finally {
    harness.cleanup();
  }
});

test("storage.set 會依呼叫順序序列化，避免慢寫入覆蓋新設定", async () => {
  const harness = await createHarness({}, { blockFirstStorageSet: true });
  try {
    const slider = harness.document.getElementById("chatobs-font-slider");
    slider.value = "32";
    slider.dispatchEvent(new harness.window.Event("input", { bubbles: true }));
    assert.equal(
      await waitForCondition(harness.window, () => harness.storageSetCallCount() >= 1),
      true,
      "第一次設定應進入 storage.set"
    );

    slider.value = "36";
    slider.dispatchEvent(new harness.window.Event("input", { bubbles: true }));
    await new Promise((resolve) => harness.window.setTimeout(resolve, 400));
    assert.equal(harness.saved.length, 0, "第一筆未完成時不應先完成第二筆");

    harness.releaseFirstStorageSet();
    assert.equal(
      await waitForCondition(harness.window, () => harness.saved.length === 2, 150),
      true,
      "兩筆保存都應依序完成"
    );
    assert.deepEqual(harness.saved.map((value) => value.fontSize), [32, 36]);
  } finally {
    harness.releaseFirstStorageSet();
    harness.cleanup();
  }
});

test("storage.set 只保存目前 dirty 欄位，成功後清除對應 revision", async () => {
  const harness = await createHarness({ theme: "red" });
  try {
    const slider = harness.document.getElementById("chatobs-font-slider");
    slider.value = "32";
    slider.dispatchEvent(new harness.window.Event("input", { bubbles: true }));
    assert.equal(
      await waitForCondition(harness.window, () => harness.saved.length === 1),
      true,
      "第一次 dirty 設定應保存"
    );
    assert.deepEqual(Object.fromEntries(Object.entries(harness.saved[0])), { fontSize: 32 });

    const themeSelect = harness.document.getElementById("chatobs-theme-select");
    themeSelect.value = "blue";
    themeSelect.dispatchEvent(new harness.window.Event("change", { bubbles: true }));
    assert.equal(
      await waitForCondition(harness.window, () => harness.saved.length === 2),
      true,
      "第二次 dirty 設定應保存"
    );
    assert.deepEqual(Object.fromEntries(Object.entries(harness.saved[1])), { theme: "blue" });
  } finally {
    harness.cleanup();
  }
});

test("storage.set 失敗時 dirty revision 會保留到下一次保存", async () => {
  const harness = await createHarness({}, { storageSetFailures: 1 });
  try {
    const slider = harness.document.getElementById("chatobs-font-slider");
    slider.value = "32";
    slider.dispatchEvent(new harness.window.Event("input", { bubbles: true }));
    await new Promise((resolve) => harness.window.setTimeout(resolve, 300));
    assert.equal(harness.saved.length, 0, "第一次保存預期失敗");

    const themeSelect = harness.document.getElementById("chatobs-theme-select");
    themeSelect.value = "blue";
    themeSelect.dispatchEvent(new harness.window.Event("change", { bubbles: true }));
    assert.equal(
      await waitForCondition(harness.window, () => harness.saved.length === 1),
      true,
      "下一次保存應成功"
    );
    assert.deepEqual(Object.fromEntries(Object.entries(harness.saved[0])), { fontSize: 32, theme: "blue" });
  } finally {
    harness.cleanup();
  }
});

test("排隊中的保存不會用已完成 revision 的舊欄位覆寫外部更新", async () => {
  const harness = await createHarness({}, {
    blockFirstStorageSet: true,
    blockSecondStorageSet: true,
    emitStorageChangeOnSet: true
  });
  try {
    const fontSlider = harness.document.getElementById("chatobs-font-slider");
    fontSlider.value = "32";
    fontSlider.dispatchEvent(new harness.window.Event("input", { bubbles: true }));
    assert.equal(
      await waitForCondition(harness.window, () => harness.storageSetCallCount() >= 1),
      true,
      "第一筆 fontSize 保存應開始"
    );

    const rateSlider = harness.document.getElementById("chatobs-rate-slider");
    rateSlider.value = "1.10";
    rateSlider.dispatchEvent(new harness.window.Event("input", { bubbles: true }));
    await new Promise((resolve) => harness.window.setTimeout(resolve, 300));

    harness.releaseFirstStorageSet();
    assert.equal(
      await waitForCondition(harness.window, () => harness.saved.length === 1),
      true,
      "第一筆保存應完成"
    );
    harness.triggerStorageChange({ fontSize: { oldValue: 32, newValue: 50 } });
    harness.releaseSecondStorageSet();
    assert.equal(
      await waitForCondition(harness.window, () => harness.saved.length === 2),
      true,
      "第二筆保存應完成"
    );

    assert.deepEqual(
      Object.fromEntries(Object.entries(harness.saved[1])),
      { ttsRate: 1.1 },
      "第二筆不可帶入已完成的舊 fontSize revision"
    );
    assert.equal(fontSlider.value, "50", "外部 fontSize 更新不可被舊 queued snapshot 蓋回");
  } finally {
    harness.releaseFirstStorageSet();
    harness.releaseSecondStorageSet();
    harness.cleanup();
  }
});

test("storage 自寫入的落後 onChanged 不會覆寫較新的本地滑桿值", async () => {
  const harness = await createHarness({}, {
    blockFirstStorageSet: true,
    emitStorageChangeOnSet: true
  });
  try {
    const slider = harness.document.getElementById("chatobs-font-slider");
    slider.value = "32";
    slider.dispatchEvent(new harness.window.Event("input", { bubbles: true }));
    assert.equal(
      await waitForCondition(harness.window, () => harness.storageSetCallCount() >= 1),
      true,
      "第一筆設定應進入 storage.set"
    );

    slider.value = "36";
    slider.dispatchEvent(new harness.window.Event("input", { bubbles: true }));
    harness.releaseFirstStorageSet();
    assert.equal(
      await waitForCondition(harness.window, () => harness.saved.length === 2),
      true,
      "落後事件後仍應保存第二筆設定"
    );
    assert.equal(slider.value, "36");
    assert.deepEqual(harness.saved.map((value) => value.fontSize), [32, 36]);
  } finally {
    harness.releaseFirstStorageSet();
    harness.cleanup();
  }
});

test("歷史自寫入值不會吞掉真正外部的相同值更新", async () => {
  const harness = await createHarness();
  try {
    const slider = harness.document.getElementById("chatobs-font-slider");
    slider.value = "32";
    slider.dispatchEvent(new harness.window.Event("input", { bubbles: true }));
    assert.equal(
      await waitForCondition(harness.window, () => harness.saved.length === 1),
      true,
      "本地 32 應先完成保存"
    );

    harness.triggerStorageChange({ fontSize: { oldValue: 32, newValue: 40 } });
    await waitForMutations(harness.window);
    assert.equal(slider.value, "40");
    harness.triggerStorageChange({ fontSize: { oldValue: 40, newValue: 32 } });
    await waitForMutations(harness.window);
    assert.equal(slider.value, "32");
  } finally {
    harness.cleanup();
  }
});

test("storage get 延遲期間 pagehide 仍會保存本地 UI 修改", async () => {
  const harness = await createHarness({}, { delayStorageGet: true });
  try {
    const slider = harness.document.getElementById("chatobs-font-slider");
    slider.value = "44";
    slider.dispatchEvent(new harness.window.Event("input", { bubbles: true }));
    harness.window.dispatchEvent(new harness.window.Event("pagehide"));
    await new Promise((resolve) => harness.window.queueMicrotask(resolve));

    assert.equal(harness.saved.length, 1);
    assert.equal(harness.saved[0].fontSize, 44);
  } finally {
    harness.releaseStorageGet();
    harness.cleanup();
  }
});

test("storage get 延遲期間 pending external 設定會重新 sanitize", async () => {
  const harness = await createHarness(
    { theme: "red", fontSize: 40, highlightKeywords: "既有關鍵字" },
    { delayStorageGet: true }
  );
  try {
    harness.triggerStorageChange({
      highlightKeywords: { oldValue: "既有關鍵字", newValue: 123 },
      fontSize: { oldValue: 40, newValue: 999 }
    });
    harness.releaseStorageGet();
    await waitForMutations(harness.window);

    assert.equal(harness.document.getElementById("chatobs-keywords-input").value, "");
    assert.equal(harness.document.getElementById("chatobs-font-slider").value, "64");
    assert.equal(harness.document.body.dataset.chatobsTheme, "red");
  } finally {
    harness.releaseStorageGet();
    harness.cleanup();
  }
});

test("storage get 延遲期間 pagehide 只保存本地變更欄位", async () => {
  const harness = await createHarness(
    { theme: "red", highlightKeywords: "既有關鍵字" },
    { delayStorageGet: true }
  );
  try {
    const slider = harness.document.getElementById("chatobs-font-slider");
    slider.value = "44";
    slider.dispatchEvent(new harness.window.Event("input", { bubbles: true }));
    harness.window.dispatchEvent(new harness.window.Event("pagehide"));
    await new Promise((resolve) => harness.window.queueMicrotask(resolve));

    assert.equal(harness.saved.length, 1);
    assert.equal(harness.saved[0].fontSize, 44);
    assert.equal(Object.hasOwn(harness.saved[0], "theme"), false);
    assert.equal(Object.hasOwn(harness.saved[0], "highlightKeywords"), false);
  } finally {
    harness.releaseStorageGet();
    harness.cleanup();
  }
});

test("主題探索可隨機換景並往返上一款，不改變收合或啟用語音", async () => {
  const harness = await createHarness({ theme: "red" });
  try {
    const random = harness.document.getElementById("chatobs-random-theme");
    const previous = harness.document.getElementById("chatobs-previous-theme");
    const theme = () => harness.document.body.dataset.chatobsTheme;
    assert.equal(harness.document.getElementById("chatobs-panel-body").hidden, true);
    assert.equal(random.disabled, false);
    assert.equal(previous.disabled, true);
    previous.click();
    assert.equal(theme(), "red");
    random.click();
    const picked = theme();
    assert.notEqual(picked, "red");
    assert.equal(previous.disabled, false);
    assert.match(previous.getAttribute("aria-label"), /赤曜超新星/);
    previous.click();
    assert.equal(theme(), "red");
    previous.click();
    assert.equal(theme(), picked);
    assert.equal(harness.document.getElementById("chatobs-panel-body").hidden, true);
    assert.equal(harness.spoken.length, 0, "換景不應自行播放聲音");
  } finally {
    harness.cleanup();
  }
});

test("主題探索在隨機索引兩端都不重抽目前主題", async () => {
  const harness = await createHarness();
  const originalRandom = harness.window.Math.random;
  try {
    const select = harness.document.getElementById("chatobs-theme-select");
    const random = harness.document.getElementById("chatobs-random-theme");
    const themes = [...select.options].map((option) => option.value);
    for (const current of themes) {
      for (const value of [0, 1 - Number.EPSILON]) {
        select.value = current;
        select.dispatchEvent(new harness.window.Event("change", { bubbles: true }));
        harness.window.Math.random = () => value;
        random.click();
        assert.ok(themes.includes(select.value));
        assert.notEqual(select.value, current);
      }
    }
  } finally {
    harness.window.Math.random = originalRandom;
    harness.cleanup();
  }
});

test("主題探索快速往返只保存最後主題，自寫入回聲保留返回記憶", async () => {
  const harness = await createHarness({ theme: "gold" }, { emitStorageChangeOnSet: true });
  try {
    const random = harness.document.getElementById("chatobs-random-theme");
    const previous = harness.document.getElementById("chatobs-previous-theme");
    random.click();
    random.click();
    previous.click();
    const finalTheme = harness.document.body.dataset.chatobsTheme;
    assert.equal(await waitForCondition(harness.window, () => harness.saved.length > 0), true);
    assert.deepEqual(Object.fromEntries(Object.entries(harness.saved.at(-1))), { theme: finalTheme });
    assert.equal(harness.saved.length, 1, "連點應沿用既有debounce");
    assert.equal(previous.disabled, false, "自己的保存回聲不應被當成外部換景");
    previous.click();
    assert.notEqual(harness.document.body.dataset.chatobsTheme, finalTheme);
  } finally {
    harness.cleanup();
  }
});

test("主題探索的返回記憶跟隨語系，其他設定保留記憶，外部換景清除記憶", async () => {
  const harness = await createHarness({ theme: "red" });
  try {
    const previous = harness.document.getElementById("chatobs-previous-theme");
    harness.document.getElementById("chatobs-random-theme").click();
    harness.document.querySelector('[data-locale="ja"]').click();
    assert.match(previous.title, /赤曜・超新星/);
    assert.match(harness.document.getElementById("chatobs-theme-feedback").textContent, /変更しました/);
    harness.triggerStorageChange({ fontSize: { newValue: 40 } });
    assert.equal(previous.disabled, false);
    const current = harness.document.body.dataset.chatobsTheme;
    const external = current === "blue" ? "purple" : "blue";
    harness.triggerStorageChange({ theme: { newValue: external } });
    assert.equal(harness.document.body.dataset.chatobsTheme, external);
    assert.equal(previous.disabled, true);
    assert.equal(harness.document.getElementById("chatobs-theme-feedback").textContent, "");
    previous.click();
    assert.equal(harness.document.body.dataset.chatobsTheme, external);
    await new Promise((resolve) => harness.window.setTimeout(resolve, 300));
    assert.equal(harness.document.body.dataset.chatobsTheme, external);
    assert.ok(harness.saved.every((snapshot) => !("theme" in snapshot)), "外部換景後不可補存已過期的本地主題");
  } finally {
    harness.cleanup();
  }
});

test("主題探索等設定載入後才啟用，返回的是裝置保存的主題", async () => {
  const harness = await createHarness({ theme: "silver" }, { delayStorageGet: true });
  try {
    const random = harness.document.getElementById("chatobs-random-theme");
    const previous = harness.document.getElementById("chatobs-previous-theme");
    assert.equal(random.disabled, true);
    assert.equal(previous.disabled, true);
    random.click();
    assert.equal(harness.saved.length, 0);
    harness.releaseStorageGet();
    await waitForMutations(harness.window);
    assert.equal(random.disabled, false);
    assert.equal(harness.document.body.dataset.chatobsTheme, "silver");
    random.click();
    previous.click();
    assert.equal(harness.document.body.dataset.chatobsTheme, "silver");
  } finally {
    harness.releaseStorageGet();
    harness.cleanup();
  }
});

test("主題探索保留自訂背景與正在朗讀的留言，佇列仍接續播放", async () => {
  const background = "data:image/webp;base64,bW9jay1pbWFnZQ==";
  const harness = await createHarness({ theme: "black", ttsEnabled: true, customBackgroundDataUrl: background });
  try {
    harness.items.append(createTextMessage(harness.document, "A", "第一則留言"));
    harness.items.append(createTextMessage(harness.document, "B", "第二則留言"));
    await waitForMutations(harness.window);
    const active = harness.spoken[0];
    const cancellations = harness.getCancelCalls();
    harness.document.getElementById("chatobs-random-theme").click();
    harness.document.getElementById("chatobs-previous-theme").click();
    assert.equal(harness.document.body.style.getPropertyValue("--chatobs-panel-image"), `url("${background}")`);
    assert.equal(harness.document.body.dataset.chatobsCustomBackground, "true");
    assert.equal(harness.spoken.length, 1);
    assert.equal(harness.spoken[0], active);
    assert.equal(harness.getCancelCalls(), cancellations);
    active.onend();
    await waitForMutations(harness.window);
    assert.equal(harness.spoken.at(-1).text, "第二則留言");
  } finally {
    harness.cleanup();
  }
});

test("主題探索在pagehide後不新增換景或計時器", async () => {
  const harness = await createHarness();
  try {
    const random = harness.document.getElementById("chatobs-random-theme");
    random.click();
    const current = harness.document.body.dataset.chatobsTheme;
    harness.window.dispatchEvent(new harness.window.Event("pagehide"));
    random.click();
    assert.equal(harness.document.body.dataset.chatobsTheme, current);
  } finally {
    harness.cleanup();
  }
});


test("外部設定取代已送出寫入後，落後自身通知不會把 UI 蓋回舊值", async () => {
  const harness = await createHarness({}, { blockFirstStorageSet: true, emitStorageChangeOnSet: true });
  try {
    const slider = harness.document.getElementById("chatobs-font-slider");
    slider.value = "32";
    slider.dispatchEvent(new harness.window.Event("input", { bubbles: true }));
    assert.equal(await waitForCondition(harness.window, () => harness.storageSetCallCount() === 1), true);
    harness.triggerStorageChange({ fontSize: { newValue: 50 } });
    assert.equal(slider.value, "50");
    harness.releaseFirstStorageSet();
    assert.equal(await waitForCondition(harness.window, () => harness.saved.length >= 1), true);
    assert.equal(slider.value, "50", "已被取代的自身寫入回聲應消費並忽略");
    assert.equal(await waitForCondition(harness.window, () => harness.getStoredValue("fontSize") === 50), true,
      "已送出的舊寫入完成後，storage 也必須恢復最新外部值");
    harness.triggerStorageChange({ fontSize: { newValue: 32 } });
    assert.equal(slider.value, "32", "已消費回聲不能吞掉之後真正的外部相同值更新");
  } finally {
    harness.releaseFirstStorageSet();
    harness.cleanup();
  }
});

test("外部值修復寫入會保留中途最新本地操作，不把設定還原成較舊外部值", async () => {
  const harness = await createHarness({}, { blockFirstStorageSet: true, emitStorageChangeOnSet: true });
  try {
    const slider = harness.document.getElementById("chatobs-font-slider");
    slider.value = "32";
    slider.dispatchEvent(new harness.window.Event("input", { bubbles: true }));
    assert.equal(await waitForCondition(harness.window, () => harness.storageSetCallCount() === 1), true);
    harness.triggerStorageChange({ fontSize: { newValue: 50 } });
    slider.value = "40";
    slider.dispatchEvent(new harness.window.Event("input", { bubbles: true }));
    harness.releaseFirstStorageSet();
    assert.equal(await waitForCondition(harness.window, () => harness.getStoredValue("fontSize") === 40), true);
    assert.equal(slider.value, "40");
    assert.ok(harness.saved.every((snapshot) => snapshot.fontSize !== 50), "不得補存較舊的外部選擇");
  } finally {
    harness.releaseFirstStorageSet();
    harness.cleanup();
  }
});


test("被取代的寫入未收到回聲時，真正外部相同值更新仍會讀回並套用", async () => {
  const harness = await createHarness({}, { blockFirstStorageSet: true, liveStorageGet: true });
  try {
    const slider = harness.document.getElementById("chatobs-font-slider");
    slider.value = "32";
    slider.dispatchEvent(new harness.window.Event("input", { bubbles: true }));
    assert.equal(await waitForCondition(harness.window, () => harness.storageSetCallCount() === 1), true);
    harness.triggerStorageChange({ fontSize: { newValue: 50 } });
    harness.releaseFirstStorageSet();
    assert.equal(await waitForCondition(harness.window, () =>
      harness.saved.length >= 2 && harness.getStoredValue("fontSize") === 50), true);
    harness.triggerStorageChange({ fontSize: { newValue: 32 } });
    assert.equal(await waitForCondition(harness.window, () => slider.value === "32"), true);
    assert.equal(harness.getStoredValue("fontSize"), 32);
  } finally {
    harness.releaseFirstStorageSet();
    harness.cleanup();
  }
});

test("已還原 storage 後才收到舊通知，讀回實值而不回復舊 UI", async () => {
  const harness = await createHarness({}, { blockFirstStorageSet: true, liveStorageGet: true });
  try {
    const slider = harness.document.getElementById("chatobs-font-slider");
    slider.value = "32";
    slider.dispatchEvent(new harness.window.Event("input", { bubbles: true }));
    assert.equal(await waitForCondition(harness.window, () => harness.storageSetCallCount() === 1), true);
    harness.triggerStorageChange({ fontSize: { newValue: 50 } });
    harness.releaseFirstStorageSet();
    assert.equal(await waitForCondition(harness.window, () =>
      harness.saved.length >= 2 && harness.getStoredValue("fontSize") === 50), true);
    harness.triggerStorageNotification({ fontSize: { newValue: 32 } });
    await waitForMutations(harness.window);
    assert.equal(slider.value, "50");
    assert.equal(harness.getStoredValue("fontSize"), 50);
    harness.triggerStorageChange({ fontSize: { newValue: 32 } });
    assert.equal(slider.value, "32", "舊回聲消費後不能吞掉真正外部更新");
  } finally {
    harness.releaseFirstStorageSet();
    harness.cleanup();
  }
});
