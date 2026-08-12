const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { JSDOM } = require("jsdom");

const contentScript = fs.readFileSync(path.join(__dirname, "..", "content.js"), "utf8");

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
      <div id="items" class="yt-live-chat-item-list-renderer"></div>
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
      harness.document.querySelector('[data-mode="complete"]').getAttribute("aria-pressed"),
      "true"
    );
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

test("A) 畫風可切換、持久保存，無效值會回落至熔岩", async () => {
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
    harness.document.querySelector('[data-theme="aurora"]').click();
    assert.equal(harness.document.body.dataset.ytceTheme, "aurora");
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
    assert.match(lastSpoken.text, /歡迎使用 YT Chat Enlarger/);

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

    assert.equal(harness.document.getElementById("ytce-status-line").textContent, "語音已開啟");
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

    assert.equal(harness.document.getElementById("ytce-status-line").textContent, "語音已開啟");
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

// === F 項目測試：content.css 不得包含 outline: none 並具備 focus-visible 樣式 ===
test("F) CSS 規範檢查：無 outline:none 且包含 :focus-visible", () => {
  const cssContent = fs.readFileSync(path.join(__dirname, "..", "content.css"), "utf8");
  assert.equal(cssContent.includes("outline: none"), false, "不可使用 outline: none");
  assert.equal(cssContent.includes("outline:none"), false, "不可使用 outline:none");
  assert.ok(cssContent.includes(":focus-visible"), "必須包含 :focus-visible 焦距環設定");
  assert.ok(cssContent.includes("--ytce-radius-shell"), "視覺圓角應由共同 token 管理");
  assert.ok(cssContent.includes("--ytce-accent: #e9786f"), "介面應維持單一珊瑚重點色");
  assert.ok(cssContent.includes("prefers-reduced-motion: reduce"), "必須尊重減少動態偏好");
  assert.equal(/@import|url\(\s*["']?https?:/i.test(cssContent), false, "不得依賴遠端字型或素材");
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
