const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const backgroundScript = fs.readFileSync(path.join(__dirname, "..", "background.js"), "utf8");

function createHarness() {
  let actionHandler;
  const createdWindows = [];
  const badgeTexts = [];
  const boundsHandlers = [];
  const removedHandlers = [];

  const chrome = {
    action: {
      onClicked: {
        addListener: (handler) => {
          actionHandler = handler;
        }
      },
      setBadgeBackgroundColor: async () => {},
      setBadgeText: async (value) => badgeTexts.push(value),
      setTitle: async () => {}
    },
    storage: {
      local: {
        get: async (defaults) => defaults,
        set: async () => {}
      }
    },
    windows: {
      create: async (value) => {
        createdWindows.push(value);
        return { id: 42, ...value };
      },
      onBoundsChanged: {
        addListener: (handler) => boundsHandlers.push(handler)
      },
      onRemoved: {
        addListener: (handler) => removedHandlers.push(handler)
      }
    }
  };

  vm.runInNewContext(backgroundScript, {
    chrome,
    URL,
    encodeURIComponent,
    setTimeout: () => 1
  });

  return { actionHandler, createdWindows, badgeTexts, boundsHandlers, removedHandlers };
}

test("可從一般觀看頁取得影片 ID", async () => {
  const harness = createHarness();
  await harness.actionHandler({
    id: 1,
    url: "https://www.youtube.com/watch?v=abcDEF_1234"
  });

  assert.equal(harness.createdWindows.length, 1);
  assert.match(harness.createdWindows[0].url, /v=abcDEF_1234/);
});

test("可從 YouTube Studio 與 live 路徑取得影片 ID", async () => {
  const studio = createHarness();
  await studio.actionHandler({
    id: 1,
    url: "https://studio.youtube.com/video/abcDEF_1234/livestreaming"
  });
  assert.match(studio.createdWindows[0].url, /v=abcDEF_1234/);

  const live = createHarness();
  await live.actionHandler({
    id: 2,
    url: "https://www.youtube.com/live/abcDEF_1234"
  });
  assert.match(live.createdWindows[0].url, /v=abcDEF_1234/);
});

test("非直播頁不開視窗並顯示錯誤徽章", async () => {
  const harness = createHarness();
  await harness.actionHandler({
    id: 1,
    url: "https://www.youtube.com/"
  });

  assert.equal(harness.createdWindows.length, 0);
  assert.equal(harness.badgeTexts[0].text, "!");
});
