const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { JSDOM } = require("jsdom");

const contentScript = fs.readFileSync(path.join(__dirname, "..", "content.js"), "utf8");

function waitForMutations(window) {
  return new Promise((resolve) => window.setTimeout(resolve, 0));
}

async function createHarness(overrides = {}) {
  const spoken = [];
  const saved = [];
  const dom = new JSDOM(
    `<!doctype html><html><body>
      <div id="items" class="yt-live-chat-item-list-renderer"></div>
    </body></html>`,
    {
      url: "https://www.youtube.com/live_chat?is_popout=1&v=test123",
      runScripts: "dangerously"
    }
  );

  class MockUtterance {
    constructor(text) {
      this.text = text;
      this.volume = 1;
      this.rate = 1;
      this.pitch = 1;
      this.voice = null;
      this.lang = "";
    }
  }

  dom.window.SpeechSynthesisUtterance = MockUtterance;
  dom.window.speechSynthesis = {
    getVoices: () => [
      {
        name: "測試中文",
        lang: "zh-TW",
        voiceURI: "test-zh-tw",
        localService: true
      }
    ],
    addEventListener: () => {},
    speak: (utterance) => spoken.push(utterance),
    cancel: () => {}
  };

  dom.window.chrome = {
    storage: {
      local: {
        get: (defaults, callback) => callback({ ...defaults, ...overrides }),
        set: (value) => saved.push(value)
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
    items: dom.window.document.getElementById("items")
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
  const modes = [...harness.document.querySelectorAll("[data-mode]")].map(
    (button) => button.dataset.mode
  );

  assert.deepEqual(modes, ["complete", "monitor", "reader"]);
  assert.ok(harness.document.getElementById("ytce-reader-stage"));
  assert.equal(
    harness.document.querySelector('[data-mode="complete"]').getAttribute("aria-pressed"),
    "true"
  );
  harness.dom.window.close();
});

test("巢狀新增的一般留言會清理網址與重複字後朗讀", async () => {
  const harness = await createHarness({ ttsEnabled: true });
  const wrapper = harness.document.createElement("div");
  wrapper.append(createTextMessage(harness.document, "小明", "看 https://example.com 哈哈哈哈哈哈"));
  harness.items.append(wrapper);
  await waitForMutations(harness.window);

  assert.equal(harness.spoken.length, 1);
  assert.equal(harness.spoken[0].text, "看 連結 哈哈哈");
  harness.dom.window.close();
});

test("開啟朗讀時間後會把時間放在留言前方", async () => {
  const harness = await createHarness({ ttsEnabled: true, ttsReadTime: true });
  harness.items.append(
    createTextMessage(harness.document, "小明", "準備開台", "下午 8:05")
  );
  await waitForMutations(harness.window);

  assert.equal(harness.spoken.length, 1);
  assert.equal(harness.spoken[0].text, "下午 8:05，準備開台");
  harness.dom.window.close();
});

test("監看模式不會朗讀新留言", async () => {
  const harness = await createHarness({ mode: "monitor", ttsEnabled: true });
  harness.items.append(createTextMessage(harness.document, "小華", "這句不應該被念出來"));
  await waitForMutations(harness.window);

  assert.equal(harness.spoken.length, 0);
  harness.dom.window.close();
});

test("Super Sticker 沒有正文時仍會產生可朗讀內容", async () => {
  const harness = await createHarness({ ttsEnabled: true, ttsReadName: true });
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
  harness.dom.window.close();
});

test("朗讀模式會隱藏聊天室並自動開啟 TTS", async () => {
  const harness = await createHarness({ mode: "reader", ttsEnabled: false });

  assert.equal(harness.document.body.dataset.ytceMode, "reader");
  assert.equal(harness.document.getElementById("ytce-tts-toggle").checked, false);

  harness.document.querySelector('[data-mode="reader"]').click();
  assert.equal(harness.document.getElementById("ytce-tts-toggle").checked, true);
  harness.dom.window.close();
});

test("語音忙碌時只保留最近二十則等待訊息", async () => {
  const harness = await createHarness({ ttsEnabled: true, queueLimit: 20 });

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
  harness.dom.window.close();
});
