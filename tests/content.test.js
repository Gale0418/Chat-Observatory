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
  const selector = theme === "ember" ? ":root" : `body[data-ytce-theme="${theme}"]`;
  const block = contentStyles.match(new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([\\s\\S]*?)\\n\\}`));
  assert.ok(block, `${theme} 應有畫風色票`);
  const value = block[1].match(new RegExp(`${token}:\\s*(#[\\da-f]{6})`, "i"));
  assert.ok(value, `${theme} 的 ${token} 應使用可驗證的實色`);
  return value[1];
}

function getThemeGradientColors(theme, token) {
  const selector = theme === "ember" ? ":root" : `body[data-ytce-theme="${theme}"]`;
  const block = contentStyles.match(new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([\\s\\S]*?)\\n\\}`));
  assert.ok(block, `${theme} 應有畫風色票`);
  const value = block[1].match(new RegExp(`${token}:\\s*linear-gradient\\([^;]+`, "i"));
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

async function createHarness(overrides = {}, options = {}) {
  const spoken = [];
  const saved = [];
  const storageListeners = [];
  const voiceListeners = [];
  const activeTimers = new Set();
  let cancelCalls = 0;
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
      url: "https://www.youtube.com/live_chat?is_popout=1&v=test123",
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

  dom.window.chrome = {
    storage: {
      local: {
        get: async (defaults) => {
          if (options.storageGetRejects) throw new Error("mock storage get failure");
          return { ...defaults, ...overrides };
        },
        set: async (value) => {
          if (options.storageSetRejects) throw new Error("mock storage set failure");
          saved.push(value);
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
      storageListeners.forEach((fn) => fn(changes, "local"));
    },
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

test("建立三種模式與高雅控制面板", async () => {
  const harness = await createHarness();
  try {
    const modes = [...harness.document.querySelectorAll("[data-mode]")].map(
      (button) => button.dataset.mode
    );

    assert.deepEqual(modes, ["complete", "monitor", "reader"]);
    assert.ok(harness.document.getElementById("ytce-reader-stage"));
    assert.equal(
      harness.document.querySelector("#ytce-collapse-button span").textContent,
      "",
      "收合鍵應使用不受字型影響的 CSS 幾何圖示"
    );
    assert.equal(
      harness.document.getElementById("ytce-control-panel").parentElement,
      harness.document.body,
      "固定面板應留在擴充功能自己的 body 層，不能插入 YouTube 虛擬留言清單"
    );
    assert.equal(
      harness.items.querySelector("#ytce-control-panel"),
      null,
      "#items 的直接子節點必須只由 YouTube 管理"
    );
    assert.equal(
      harness.document.documentElement.style.getPropertyValue("--ytce-panel-offset"),
      "84px",
      "面板應為聊天室保留固定頂部空間"
    );
    assert.equal(
      harness.document.querySelector('[data-mode="complete"]').getAttribute("aria-pressed"),
      "true"
    );
  } finally {
    harness.cleanup();
  }
});

test("聊天室主體使用畫風 canvas，且不以全域規則覆蓋輸入與表情面板", () => {
  assert.match(contentStyles, /body\.ytce-active\s*\{[\s\S]*var\(--ytce-panel-image\) center \/ cover no-repeat,[\s\S]*var\(--ytce-canvas\) !important;/);
  assert.match(contentStyles, /body\.ytce-active yt-live-chat-app,[\s\S]*background-color: transparent !important;/);
  assert.match(contentStyles, /yt-live-chat-renderer #chat-messages/);
  assert.match(contentStyles, /#item-scroller\.yt-live-chat-item-list-renderer/);
  assert.doesNotMatch(contentStyles, /yt-live-chat-renderer \*/);
  assert.doesNotMatch(contentStyles, /#input-panel[^,{]*,[\s\S]*--ytce-canvas/);
  assert.doesNotMatch(contentStyles, /yt-emoji-picker-renderer[^,{]*,[\s\S]*--ytce-canvas/);
  assert.match(contentStyles, /#ytce-control-panel\s*\{[\s\S]*position: fixed;/);
  assert.match(contentStyles, /padding-top: var\(--ytce-panel-offset, 84px\) !important;/);
});

test("輸入列與表情面板使用各畫風的高對比語意色票", () => {
  for (const token of [
    "--ytce-input-surface",
    "--ytce-input-text",
    "--ytce-input-placeholder",
    "--ytce-input-icon",
    "--ytce-input-icon-hover",
    "--ytce-picker-surface",
    "--ytce-picker-hover",
    "--ytce-input-gradient",
    "--ytce-picker-gradient"
  ]) {
    assert.match(contentStyles, new RegExp(`${token}:`), `${token} 應有預設值`);
  }

  assert.match(contentStyles, /yt-live-chat-message-input-renderer\s*\{[\s\S]*--yt-live-chat-text-input-field-placeholder-color: var\(--ytce-input-placeholder\);/);
  assert.match(contentStyles, /yt-live-chat-message-input-renderer #input-container,[\s\S]*background: var\(--ytce-input-gradient\) !important;/);
  assert.match(contentStyles, /yt-emoji-picker-renderer\s*\{[\s\S]*--yt-live-chat-picker-button-active-color: var\(--ytce-accent\);/);
  assert.match(contentStyles, /yt-emoji-picker-renderer #categories,[\s\S]*background: var\(--ytce-picker-gradient\) !important;/);
  assert.doesNotMatch(contentStyles, /body\.ytce-active\s+yt-live-chat-renderer\s+\*/);
});

test("四套畫風以紅黑綠黃順序顯示且保留既有儲存 ID", async () => {
  const harness = await createHarness();
  try {
    assert.deepEqual(
      [...harness.document.querySelectorAll(".ytce-theme-switch button")].map((button) => ({
        id: button.dataset.theme,
        label: button.querySelector("span:last-child").textContent,
        ariaLabel: button.getAttribute("aria-label")
      })),
      [
        { id: "ember", label: "赤曜", ariaLabel: "切換為赤曜畫風" },
        { id: "aurora", label: "玄曜", ariaLabel: "切換為玄曜畫風" },
        { id: "paper", label: "翠曜", ariaLabel: "切換為翠曜畫風" },
        { id: "starlight", label: "金曜", ariaLabel: "切換為金曜畫風" }
      ]
    );
  } finally {
    harness.cleanup();
  }
});

test("四套畫風的輸入文字與表情圖示皆符合對比門檻", () => {
  for (const theme of ["ember", "aurora", "paper", "starlight"]) {
    const inputText = getThemeToken(theme, "--ytce-input-text");
    const inputIcon = getThemeToken(theme, "--ytce-input-icon");
    const inputSurfaces = getThemeGradientColors(theme, "--ytce-input-gradient");
    const pickerSurfaces = getThemeGradientColors(theme, "--ytce-picker-gradient");

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
    assert.equal(harness.document.getElementById("ytce-control-panel").parentElement, harness.document.body);
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

test("監看模式不會朗讀新留言", async () => {
  const harness = await createHarness({ mode: "monitor", ttsEnabled: true });
  try {
    harness.items.append(createTextMessage(harness.document, "小華", "這句不應該被念出來"));
    await waitForMutations(harness.window);

    assert.equal(harness.spoken.length, 0);
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

test("朗讀模式會隱藏聊天室並自動開啟 TTS", async () => {
  const harness = await createHarness({ mode: "reader", ttsEnabled: false });
  try {
    assert.equal(harness.document.body.dataset.ytceMode, "reader");
    assert.equal(harness.document.getElementById("ytce-tts-toggle").checked, false);

    harness.document.querySelector('[data-mode="reader"]').click();
    assert.equal(harness.document.getElementById("ytce-tts-toggle").checked, true);
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
    harness.document.getElementById("ytce-skip-speech").click();
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
    mode: "invalid_mode",
    ttsVolume: 9999,
    ttsEnabled: "not_boolean",
    unknownField: "hacker"
  });
  try {
    const fontInput = harness.document.getElementById("ytce-font-slider");
    assert.equal(fontInput.value, "28"); // fallback default fontSize
    assert.equal(harness.document.body.dataset.ytceMode, "complete"); // fallback default mode
  } finally {
    harness.cleanup();
  }
});

test("A) 畫風可切換、持久保存，無效值會回落至赤曜", async () => {
  const invalidHarness = await createHarness({ theme: "rainbow-hacker" });
  try {
    assert.equal(invalidHarness.document.body.dataset.ytceTheme, "ember");
    assert.equal(
      invalidHarness.document.querySelector('[data-theme="ember"]').getAttribute("aria-pressed"),
      "true"
    );
  } finally {
    invalidHarness.cleanup();
  }

  const harness = await createHarness({ theme: "ember" });
  try {
    assert.equal(harness.document.querySelectorAll(".ytce-theme-switch button").length, 4);
    harness.document.querySelector('[data-theme="aurora"]').click();
    assert.equal(harness.document.body.dataset.ytceTheme, "aurora");
    assert.equal(harness.document.documentElement.dataset.ytceTheme, "aurora");
    assert.equal(
      harness.document.querySelector('[data-theme="aurora"]').getAttribute("aria-pressed"),
      "true"
    );
    await new Promise((resolve) => harness.window.setTimeout(resolve, 300));
    assert.equal(harness.saved.at(-1).theme, "aurora");
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
      theme: { oldValue: "ember", newValue: "paper" }
    });
    await waitForMutations(harness.window);

    const volumeSlider = harness.document.getElementById("ytce-volume-slider");
    assert.equal(volumeSlider.value, "80");
    assert.equal(harness.document.body.dataset.ytceTheme, "paper");
    assert.equal(harness.saved.length, initialSavedCount, "不應二次觸發 storage.set 造成 save loop");
  } finally {
    harness.cleanup();
  }
});

test("A) 外部切換監看模式會立即停止語音並清空等待佇列", async () => {
  const harness = await createHarness({ ttsEnabled: true });
  try {
    harness.items.append(createTextMessage(harness.document, "小華", "正在朗讀"));
    harness.items.append(createTextMessage(harness.document, "小華", "等待中的留言"));
    await waitForMutations(harness.window);

    harness.triggerStorageChange({ mode: { oldValue: "complete", newValue: "monitor" } });
    await waitForMutations(harness.window);
    assert.ok(harness.getCancelCalls() >= 1);

    harness.document.querySelector('[data-mode="complete"]').click();
    await waitForMutations(harness.window);
    assert.equal(harness.spoken.length, 1, "回到完整模式後不應朗讀監看前留下的舊佇列");
  } finally {
    harness.cleanup();
  }
});

// === B 項目測試：TTS safeSpeak, throw/onerror, watchdog, test voice queue restoration ===
test("B) 試聽按鈕完成後恢復原隊列內容", async () => {
  const harness = await createHarness({ ttsEnabled: true });
  try {
    // 先加入一則訊息至佇列（當前在 Speak 訊息 1）
    harness.items.append(createTextMessage(harness.document, "小華", "訊息 1"));
    harness.items.append(createTextMessage(harness.document, "小華", "隊列中的訊息 2"));
    await waitForMutations(harness.window);

    // 點擊試聽
    const testBtn = harness.document.getElementById("ytce-test-voice");
    testBtn.click();
    await waitForMutations(harness.window);

    const lastSpoken = harness.spoken[harness.spoken.length - 1];
    assert.match(lastSpoken.text, /語音朗讀已開啟/);

    // 模擬試聽 spoken utterance 觸發 onend
    if (typeof lastSpoken.onend === "function") {
      lastSpoken.onend();
    }
    await waitForMutations(harness.window);

    // 試聽完畢後應該繼續念 隊列中的訊息 2
    const currentSpoken = harness.spoken[harness.spoken.length - 1];
    assert.equal(currentSpoken.text, "隊列中的訊息 2");
  } finally {
    harness.cleanup();
  }
});

test("B) speechSynthesis.speak 拋錯時不會卡住佇列", async () => {
  const harness = await createHarness({ ttsEnabled: true }, { speakThrows: true });
  try {
    harness.items.append(createTextMessage(harness.document, "小華", "第一則"));
    harness.items.append(createTextMessage(harness.document, "小華", "第二則"));
    await waitForMutations(harness.window);

    assert.match(harness.document.getElementById("ytce-status-line").textContent, /語音已開啟/);
  } finally {
    harness.cleanup();
  }
});

test("B) 語音未回報完成時 watchdog 會解除 active 狀態", async () => {
  const harness = await createHarness(
    { ttsEnabled: true },
    { accelerateWatchdog: true }
  );
  try {
    harness.items.append(createTextMessage(harness.document, "小華", "可能卡住的留言"));
    await waitForMutations(harness.window);
    await waitForMutations(harness.window);

    assert.match(harness.document.getElementById("ytce-status-line").textContent, /語音已開啟/);
  } finally {
    harness.cleanup();
  }
});

// === C 項目測試：Voice 選單只列 localService=true，遠端回落預設 & UI 隱私提示 ===
test("C) Voice 選單只提供 localService=true，遠端設定會回落至本機語音", async () => {
  const harness = await createHarness({ ttsVoiceURI: "test-remote-zh-tw" });
  try {
    const select = harness.document.getElementById("ytce-voice-select");
    const options = [...select.options].map((opt) => opt.value);

    assert.deepEqual(options, ["test-local-zh-tw"]);
    assert.equal(select.value, "test-local-zh-tw", "遠端 voiceURI 應回落至明確的本機語音");

    // UI 檢查本機隱私提示
    const privacyTip = harness.document.querySelector(".ytce-privacy-tip");
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
    const toggle = harness.document.getElementById("ytce-tts-toggle");
    toggle.checked = true;
    toggle.dispatchEvent(
      new harness.window.Event("change", { bubbles: true })
    );
    harness.items.append(createTextMessage(harness.document, "小華", "不得交給未知語音"));
    await waitForMutations(harness.window);

    assert.equal(harness.spoken.length, 0);
    assert.equal(toggle.checked, true, "等待語音載入時應保留使用者的開啟意圖");
    assert.match(
      harness.document.getElementById("ytce-status-line").textContent,
      /等待本機語音/
    );

    harness.setVoices([{ name: "稍後載入的語音", lang: "zh-TW", voiceURI: "late-local", localService: true }]);
    harness.triggerVoicesChanged();
    await waitForMutations(harness.window);

    assert.equal(toggle.checked, true);
    assert.equal(harness.document.getElementById("ytce-voice-select").value, "late-local");
    assert.equal(harness.document.getElementById("ytce-status-line").textContent, "朗讀中");
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
    const modeSelect = harness.document.getElementById("ytce-voice-mode-select");
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

    assert.equal(harness.document.getElementById("ytce-voice-select").value, "voice-zh");
    harness.document.querySelector('[data-theme="paper"]').click();
    assert.equal(
      harness.document.getElementById("ytce-voice-select").value,
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
    const labels = [...harness.document.getElementById("ytce-voice-select").options]
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
    assert.equal(harness.spoken.at(-1).text, "12:34，小明說：bonjour merci");
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
    assert.match(harness.document.getElementById("ytce-status-line").textContent, /固定語音不可用/);
    assert.equal(harness.document.getElementById("ytce-voice-select").value, "");
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
  assert.ok(cssContent.includes("--ytce-radius-shell"), "視覺圓角應由共同 token 管理");
  assert.ok(cssContent.includes("--ytce-accent: #ff4d5a"), "赤曜應維持鮮紅重點色");
  assert.ok(cssContent.includes("--ytce-active-text: #200208"), "赤曜亮紅啟用面應使用高對比深色文字");
  assert.ok(cssContent.includes("--ytce-accent: #b9d8ff"), "玄曜應維持黑鉻冷光重點色");
  assert.ok(cssContent.includes("--ytce-accent: #35e6a3"), "翠曜應維持祖母綠重點色");
  assert.ok(cssContent.includes("--ytce-accent: #ffd15a"), "金曜應維持亮金黃重點色");
  assert.ok(cssContent.includes("prefers-reduced-motion: reduce"), "必須尊重減少動態偏好");
  assert.ok(cssContent.includes("@keyframes ytce-flow-line"), "精品電競畫風應包含流光飾線");
  assert.ok(cssContent.includes("@keyframes ytce-energy-sweep"), "啟用模式應包含能量掃光");
  assert.ok(cssContent.includes("@keyframes ytce-specular-sweep"), "精品材質應包含高光掃過效果");
  assert.ok(cssContent.includes("--ytce-material-art"), "四套畫風應包含獨立材質紋理");
  assert.ok(cssContent.includes("--ytce-specular"), "面板內框應包含金屬高光色票");
  assert.ok(cssContent.includes("--ytce-panel-gradient"), "控制面板應使用明顯主題漸層");
  assert.ok(cssContent.includes("--ytce-chat-gradient"), "聊天室卡片應使用方向性漸層");
  assert.ok(cssContent.includes("--ytce-input-gradient"), "輸入區應使用主題漸層");
  for (const asset of ["cosmic-crimson.jpg", "cosmic-black-hole.jpg", "cosmic-emerald.jpg", "cosmic-gold.jpg"]) {
    assert.ok(cssContent.includes(`assets/themes/${asset}`), `CSS 應引用宇宙背景 ${asset}`);
    assert.ok(fs.existsSync(path.join(__dirname, "..", "assets", "themes", asset)), `應封裝宇宙背景 ${asset}`);
  }
  assert.ok(cssContent.includes("--ytce-title-text"), "四套主題應提供標題文字色");
  assert.ok(cssContent.includes("--ytce-text-outline"), "文字應提供反色描邊 token");
  assert.ok(cssContent.includes("--ytce-active-outline"), "深色啟用文字應提供亮色反描邊 token");
  assert.ok(cssContent.includes("--ytce-text-glow"), "文字應提供主題柔光 token");
  assert.match(cssContent, /text-shadow:[\s\S]*var\(--ytce-text-outline\)/, "面板與留言文字應套用反色描邊");
  assert.match(cssContent, /body\.ytce-active \{[\s\S]*var\(--ytce-chat-image-overlay\),[\s\S]*var\(--ytce-panel-image\) center \/ cover no-repeat/, "聊天室外層畫布應延伸主題背景");
  assert.equal(cssContent.includes("body.ytce-active yt-live-chat-renderer *"), false, "不可用全域後代選擇器破壞 YouTube 元件背景");
  assert.match(cssContent, /prefers-reduced-motion: reduce[\s\S]*#ytce-control-panel::before,[\s\S]*animation: none !important;/, "減少動態偏好必須停用流光偽元素");
  assert.equal(/@import|url\(\s*["']?https?:/i.test(cssContent), false, "不得依賴遠端字型或素材");
  assert.match(cssContent, /body\.ytce-active ::selection/, "文字選取色應納入主題系統");
  assert.match(cssContent, /caret-color: var\(--ytce-accent\)/, "文字游標應納入主題系統");
  assert.equal(cssContent.includes("color-scheme: light"), false, "四套精品深色畫風皆應使用 dark 原生表面");
  assert.match(cssContent, /#ytce-panel-body::\-webkit-scrollbar-thumb/, "面板捲軸應納入主題系統");

  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "manifest.json"), "utf8"));
  assert.deepEqual(manifest.web_accessible_resources, [{
    resources: [
      "assets/themes/cosmic-crimson.jpg",
      "assets/themes/cosmic-black-hole.jpg",
      "assets/themes/cosmic-emerald.jpg",
      "assets/themes/cosmic-gold.jpg"
    ],
    matches: ["https://www.youtube.com/*"]
  }], "僅應向 YouTube 來源暴露四張本機主題背景，WAR match pattern 的 path 必須使用 /*");
});

test("E) Storage API 拒絕時仍可啟動並安全清理", async () => {
  const harness = await createHarness({}, { storageGetRejects: true, storageSetRejects: true });
  try {
    assert.ok(harness.document.getElementById("ytce-control-panel"));
    harness.document.getElementById("ytce-font-slider").value = "32";
    harness.document.getElementById("ytce-font-slider").dispatchEvent(
      new harness.window.Event("input", { bubbles: true })
    );
    await new Promise((resolve) => harness.window.setTimeout(resolve, 300));
    assert.match(harness.document.getElementById("ytce-status-line").textContent, /設定/);
  } finally {
    harness.cleanup();
  }
});
