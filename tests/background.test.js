const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const backgroundScript = fs.readFileSync(path.join(__dirname, "..", "background.js"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "manifest.json"), "utf8"));

function createHarness(options = {}) {
  let actionHandler;
  const createdWindows = [];
  const updatedWindows = [];
  const updatedTabs = [];
  const badgeTexts = [];
  const badgeBackgrounds = [];
  const titles = [];
  const boundsHandlers = [];
  const removedHandlers = [];
  const localSets = [];
  const timers = new Map();
  let nextTimerId = 1;
  const sessionData = { ...(options.sessionData || {}) };
  const localData = {
    popupWidth: 520,
    popupHeight: 820,
    popupLeft: null,
    popupTop: null,
    ...(options.localData || {})
  };
  const windowsById = new Map(Object.entries(options.windowsById || {}).map(([id, value]) => [Number(id), value]));
  let nextWindowId = options.nextWindowId || 42;
  let nextTabId = 1000;
  let sessionSetCalls = 0;
  let windowUpdateCalls = 0;
  let tabUpdateCalls = 0;
  let releaseLocalSet = null;
  const localSetGate = options.delayLocalSet
    ? new Promise((resolve) => { releaseLocalSet = resolve; })
    : null;
  const reject = (value, message = "API failure") => options.reject?.includes(value) ? Promise.reject(new Error(message)) : Promise.resolve(value);

  const chrome = {
    action: {
      onClicked: { addListener: (handler) => { actionHandler = handler; } },
      setBadgeBackgroundColor: async (value) => { badgeBackgrounds.push(value); return reject(undefined, "badge color"); },
      setBadgeText: async (value) => { badgeTexts.push(value); return reject(undefined, "badge text"); },
      setTitle: async (value) => { titles.push(value); return reject(undefined, "title"); }
    },
    storage: {
      local: {
        get: async (defaults) => ({ ...defaults, ...localData }),
        set: async (value) => {
          if (localSetGate) await localSetGate;
          localSets.push(value);
          Object.assign(localData, value);
          return reject(undefined, "local set");
        }
      },
      ...(options.noSession ? {} : {
        session: {
          get: async (defaults) => {
            if (options.sessionGetFailures > 0) {
              options.sessionGetFailures -= 1;
              throw new Error("session get unavailable");
            }
            return { ...defaults, ...sessionData };
          },
          set: async (value) => {
            sessionSetCalls += 1;
            if (sessionSetCalls <= (options.sessionSetFailures || 0)) throw new Error("session set unavailable");
            Object.assign(sessionData, value);
            return reject(undefined, "session set");
          },
          remove: async (key) => { delete sessionData[key]; return reject(undefined, "session remove"); }
        }
      })
    },
    windows: {
      create: async (value) => {
        createdWindows.push(value);
        if (options.createResults?.length) {
          const result = options.createResults.shift();
          if (result instanceof Error) return Promise.reject(result);
          return result;
        }
        const window = { id: nextWindowId++, type: "popup", ...value, tabs: [{ id: nextTabId++, url: value.url }] };
        windowsById.set(window.id, window);
        return window;
      },
      get: async (id) => {
        if (options.getWindowError) return Promise.reject(new Error("stale window"));
        return windowsById.get(id);
      },
      update: async (id, value) => {
        windowUpdateCalls += 1;
        updatedWindows.push({ id, value });
        if (windowUpdateCalls <= (options.windowUpdateFailures || 0)) throw new Error("window update unavailable");
        return reject(undefined, "window update");
      },
      onBoundsChanged: { addListener: (handler) => boundsHandlers.push(handler) },
      onRemoved: { addListener: (handler) => removedHandlers.push(handler) }
    },
    tabs: {
      sendMessage: async (id, message) => {
        assert.equal(message.type, "chatobs:probe");
        if (!(id in (options.probeResponses || {}))) throw new Error("no content script");
        return { url: options.probeResponses[id] };
      },
      update: async (id, value) => {
        tabUpdateCalls += 1;
        updatedTabs.push({ id, value });
        if (tabUpdateCalls <= (options.tabUpdateFailures || 0)) throw new Error("tab update unavailable");
        for (const window of windowsById.values()) {
          const target = (window.tabs || []).find((tab) => tab?.id === id);
          if (target) Object.assign(target, value);
        }
        return reject(undefined, "tab update");
      }
    }
  };

  vm.runInNewContext(backgroundScript, {
    chrome,
    URL,
    encodeURIComponent,
    Number,
    setTimeout: (fn) => { const id = nextTimerId++; timers.set(id, fn); return id; },
    clearTimeout: (id) => { timers.delete(id); }
  });

  return {
    chrome, actionHandler, createdWindows, updatedWindows, badgeTexts, badgeBackgrounds, titles,
    boundsHandlers, removedHandlers, sessionData, localData, localSets, windowsById, updatedTabs,
    getTimerCount: () => timers.size,
    releaseLocalSet: () => releaseLocalSet?.(),
    runTimers: async () => {
      const callbacks = [...timers.values()];
      timers.clear();
      callbacks.forEach((callback) => callback());
      await Promise.resolve();
    }
  };
}

test("可從一般觀看頁取得影片 ID", async () => {
  const harness = createHarness();
  await harness.actionHandler({ id: 1, url: "https://www.youtube.com/watch?v=abcDEF_1234" });
  assert.equal(harness.createdWindows.length, 1);
  assert.match(harness.createdWindows[0].url, /v=abcDEF_1234/);
  assert.equal(harness.sessionData.chatVideoId, "abcDEF_1234");
});

test("可從 YouTube Studio 與 live 路徑取得影片 ID", async () => {
  const studio = createHarness();
  await studio.actionHandler({ id: 1, url: "https://studio.youtube.com/video/abcDEF_1234/livestreaming" });
  assert.match(studio.createdWindows[0].url, /v=abcDEF_1234/);

  const live = createHarness();
  await live.actionHandler({ id: 2, url: "https://www.youtube.com/live/abcDEF_1234" });
  assert.match(live.createdWindows[0].url, /v=abcDEF_1234/);
});

test("嚴格拒絕 evil host、http、非預期 port 與不合理路徑", async () => {
  for (const url of [
    "https://www.youtube.com.evil.test/watch?v=abcDEF_1234",
    "http://www.youtube.com/watch?v=abcDEF_1234",
    "https://www.youtube.com:8443/watch?v=abcDEF_1234",
    "https://youtube.com.evil.test/live/abcDEF_1234",
    "https://youtu.be/abcDEF_1234/extra",
    "https://studio.youtube.com/watch?v=abcDEF_1234"
  ]) {
    const harness = createHarness();
    await harness.actionHandler({ id: 1, url });
    assert.equal(harness.createdWindows.length, 0, url);
  }
});

test("非直播頁不開視窗並顯示錯誤徽章", async () => {
  const harness = createHarness();
  await harness.actionHandler({ id: 1, url: "https://www.youtube.com/" });
  assert.equal(harness.createdWindows.length, 0);
  assert.ok(harness.badgeTexts.some((value) => value.text === "!"));
});

test("重複錯誤只保留最新的徽章清除計時器", async () => {
  const harness = createHarness();
  await harness.actionHandler({ id: 1, url: "https://www.youtube.com/" });
  await harness.actionHandler({ id: 1, url: "https://www.youtube.com/" });
  assert.equal(harness.getTimerCount(), 1);
});

test("使用 session 記住聊天室視窗，重複 action 只聚焦既有視窗", async () => {
  const harness = createHarness({
    sessionData: { chatWindowId: 99, chatVideoId: "abcDEF_1234" },
    windowsById: {
      99: {
        id: 99,
        type: "popup",
        tabs: [{ id: 100, url: "https://www.youtube.com/live_chat?is_popout=1&v=abcDEF_1234" }]
      }
    }
  });
  await harness.actionHandler({ id: 1, url: "https://www.youtube.com/live/abcDEF_1234" });
  assert.equal(harness.createdWindows.length, 0);
  assert.equal(harness.updatedTabs.length, 0);
  assert.equal(harness.updatedWindows[0].id, 99);
  assert.equal(harness.updatedWindows[0].value.focused, true);
});

test("不同直播會更新原聊天室 tab，而不是另開視窗", async () => {
  const harness = createHarness({
    sessionData: { chatWindowId: 99, chatVideoId: "abcDEF_1234" },
    windowsById: {
      99: {
        id: 99,
        type: "popup",
        tabs: [{ id: 100, url: "https://www.youtube.com/live_chat?is_popout=1&v=abcDEF_1234" }]
      }
    }
  });
  await harness.actionHandler({ id: 1, url: "https://www.youtube.com/live/xyzXYZ_5678" });
  assert.equal(harness.createdWindows.length, 0);
  assert.equal(harness.updatedTabs.length, 1);
  assert.equal(harness.updatedTabs[0].id, 100);
  assert.equal(harness.updatedTabs[0].value.url, "https://www.youtube.com/live_chat?is_popout=1&v=xyzXYZ_5678");
  assert.equal(harness.updatedWindows[0].id, 99);
  assert.equal(harness.sessionData.chatVideoId, "xyzXYZ_5678");
});

test("沒有 tabs URL 權限時仍可由 content script 確認並重用聊天室", async () => {
  const harness = createHarness({
    sessionData: { chatWindowId: 99, chatVideoId: "abcDEF_1234" },
    windowsById: { 99: { id: 99, type: "popup", tabs: [{ id: 100 }] } },
    probeResponses: { 100: "https://www.youtube.com/live_chat?is_popout=1&v=abcDEF_1234" }
  });
  await harness.actionHandler({ id: 1, url: "https://www.youtube.com/live/xyzXYZ_5678" });
  assert.equal(harness.createdWindows.length, 0);
  assert.equal(harness.updatedTabs[0].id, 100);
  assert.equal(harness.sessionData.chatVideoId, "xyzXYZ_5678");
});

test("URL 不可見且 content script 無回應時不會誤聚焦別人的 popup", async () => {
  const harness = createHarness({
    sessionData: { chatWindowId: 99, chatVideoId: "abcDEF_1234" },
    windowsById: { 99: { id: 99, type: "popup", tabs: [{ id: 100 }] } }
  });
  await harness.actionHandler({ id: 1, url: "https://www.youtube.com/live/abcDEF_1234" });
  assert.equal(harness.updatedWindows.length, 0);
  assert.equal(harness.createdWindows.length, 1);
});

test("已記錄的聊天室 tab 無法 probe 時重新導向同一分頁並重用視窗", async () => {
  const probeResponses = {};
  const harness = createHarness({
    sessionData: { chatWindowId: 99, chatVideoId: "abcDEF_1234", chatTabId: 100 },
    windowsById: { 99: { id: 99, type: "popup", tabs: [{ id: 100, status: "complete" }] } },
    probeResponses
  });
  const live = { id: 1, url: "https://www.youtube.com/live/abcDEF_1234" };
  await harness.actionHandler(live);
  assert.equal(harness.createdWindows.length, 0);
  assert.equal(harness.updatedTabs.length, 1);
  assert.equal(harness.updatedTabs[0].id, 100);
  assert.equal(harness.updatedWindows.length, 1);
  assert.equal(harness.sessionData.chatWindowId, 99);
  probeResponses[100] = "https://www.youtube.com/live_chat?is_popout=1&v=abcDEF_1234";
  await harness.actionHandler(live);
  assert.equal(harness.createdWindows.length, 0);
  assert.equal(harness.updatedWindows.length, 2);
});

test("無法 probe 且第一次重新導向失敗時保留原視窗供重試", async () => {
  const harness = createHarness({
    sessionData: { chatWindowId: 99, chatVideoId: "abcDEF_1234", chatTabId: 100 },
    windowsById: { 99: { id: 99, type: "popup", tabs: [{ id: 100, status: "complete" }] } },
    tabUpdateFailures: 1
  });
  const live = { id: 1, url: "https://www.youtube.com/live/abcDEF_1234" };
  await harness.actionHandler(live);
  assert.equal(harness.createdWindows.length, 0);
  assert.equal(harness.sessionData.chatWindowId, 99);
  assert.equal(harness.updatedWindows.length, 0);
  await harness.actionHandler(live);
  assert.equal(harness.createdWindows.length, 0);
  assert.equal(harness.updatedTabs.length, 2);
  assert.equal(harness.updatedWindows.length, 1);
});

test("剛建立且仍載入中的自家分頁可重用，不會因 probe 尚未就緒重開視窗", async () => {
  const harness = createHarness({
    sessionData: { chatWindowId: 99, chatVideoId: "abcDEF_1234", chatTabId: 100 },
    windowsById: { 99: { id: 99, type: "popup", tabs: [{ id: 100, status: "loading" }] } }
  });
  await harness.actionHandler({ id: 1, url: "https://www.youtube.com/live/abcDEF_1234" });
  assert.equal(harness.createdWindows.length, 0);
  assert.equal(harness.updatedTabs[0].id, 100);
  assert.equal(harness.updatedWindows[0].id, 99);
});

test("聊天室分頁正在導向其他網站時不會沿用舊 URL", async () => {
  const harness = createHarness({
    sessionData: { chatWindowId: 99, chatVideoId: "abcDEF_1234" },
    windowsById: {
      99: {
        id: 99,
        type: "popup",
        tabs: [{
          id: 100,
          url: "https://www.youtube.com/live_chat?is_popout=1&v=abcDEF_1234",
          pendingUrl: "https://example.com/"
        }]
      }
    }
  });
  await harness.actionHandler({ id: 1, url: "https://www.youtube.com/live/abcDEF_1234" });
  assert.equal(harness.updatedWindows.length, 0);
  assert.equal(harness.createdWindows.length, 1);
});

test("沒有 session API 時仍以記憶體 fallback 避免重複開窗", async () => {
  const harness = createHarness({ noSession: true });
  await harness.actionHandler({ id: 1, url: "https://www.youtube.com/live/abcDEF_1234" });
  await harness.actionHandler({ id: 1, url: "https://www.youtube.com/live/abcDEF_1234" });
  assert.equal(harness.createdWindows.length, 1);
  assert.equal(harness.updatedWindows[0].value.focused, true);
});

test("快速連點 action 會序列化，避免競態建立兩個聊天室", async () => {
  const harness = createHarness();
  await Promise.all([
    harness.actionHandler({ id: 1, url: "https://www.youtube.com/live/abcDEF_1234" }),
    harness.actionHandler({ id: 1, url: "https://www.youtube.com/live/abcDEF_1234" })
  ]);
  assert.equal(harness.createdWindows.length, 1);
  assert.equal(harness.updatedWindows.length, 1);
});

test("session 中的 stale ID 會清除並重新建立聊天室", async () => {
  const harness = createHarness({ sessionData: { chatWindowId: 99 } });
  await harness.actionHandler({ id: 1, url: "https://www.youtube.com/live/abcDEF_1234" });
  assert.equal(harness.createdWindows.length, 1);
  assert.notEqual(harness.sessionData.chatWindowId, 99);
});

test("session 明確回傳 null 時會清除記憶體 fallback", async () => {
  const harness = createHarness();
  await harness.actionHandler({ id: 1, url: "https://www.youtube.com/live/abcDEF_1234" });
  harness.sessionData.chatWindowId = null;
  await harness.actionHandler({ id: 1, url: "https://www.youtube.com/live/abcDEF_1234" });
  assert.equal(harness.createdWindows.length, 2);
});

test("session 首次讀寫失敗後恢復時仍重用記憶體中的聊天室", async () => {
  const harness = createHarness({ sessionGetFailures: 1, sessionSetFailures: 1 });
  await harness.actionHandler({ id: 1, url: "https://www.youtube.com/live/abcDEF_1234" });
  assert.equal(harness.sessionData.chatWindowId, undefined);
  await harness.actionHandler({ id: 1, url: "https://www.youtube.com/live/abcDEF_1234" });
  assert.equal(harness.createdWindows.length, 1);
  assert.equal(harness.updatedWindows.length, 1);
  assert.equal(harness.sessionData.chatWindowId, 42);
});

test("session API 啟動時缺席、稍後恢復也不會遺失既有視窗", async () => {
  const harness = createHarness({ noSession: true });
  const live = { id: 1, url: "https://www.youtube.com/live/abcDEF_1234" };
  await harness.actionHandler(live);
  harness.chrome.storage.session = {
    get: async (defaults) => ({ ...defaults, ...harness.sessionData }),
    set: async (value) => { Object.assign(harness.sessionData, value); },
    remove: async (key) => { delete harness.sessionData[key]; }
  };
  await harness.actionHandler(live);
  assert.equal(harness.createdWindows.length, 1);
  assert.equal(harness.sessionData.chatWindowId, 42);
});

test("暫時無法更新聊天室分頁時保留既有視窗供下一次重試", async () => {
  const harness = createHarness({
    tabUpdateFailures: 1,
    sessionData: { chatWindowId: 99, chatVideoId: "abcDEF_1234", chatTabId: 100 },
    windowsById: {
      99: { id: 99, type: "popup", tabs: [{ id: 100, url: "https://www.youtube.com/live_chat?is_popout=1&v=abcDEF_1234" }] }
    }
  });
  const nextLive = { id: 1, url: "https://www.youtube.com/live/zyxWVU_9876" };
  await harness.actionHandler(nextLive);
  assert.equal(harness.createdWindows.length, 0);
  assert.equal(harness.sessionData.chatWindowId, 99);
  await harness.actionHandler(nextLive);
  assert.equal(harness.createdWindows.length, 0);
  assert.equal(harness.updatedWindows.length, 1);
  assert.equal(harness.sessionData.chatVideoId, "zyxWVU_9876");
});

test("暫時無法聚焦既有聊天室時不另開重複視窗", async () => {
  const harness = createHarness({
    windowUpdateFailures: 1,
    sessionData: { chatWindowId: 99, chatVideoId: "abcDEF_1234", chatTabId: 100 },
    windowsById: {
      99: { id: 99, type: "popup", tabs: [{ id: 100, url: "https://www.youtube.com/live_chat?is_popout=1&v=abcDEF_1234" }] }
    }
  });
  const live = { id: 1, url: "https://www.youtube.com/live/abcDEF_1234" };
  await harness.actionHandler(live);
  assert.equal(harness.createdWindows.length, 0);
  assert.equal(harness.sessionData.chatWindowId, 99);
  await harness.actionHandler(live);
  assert.equal(harness.createdWindows.length, 0);
  assert.equal(harness.updatedWindows.length, 2);
});

test("舊視窗關閉事件不會在新 action 建立視窗後清掉新 session", async () => {
  const harness = createHarness({
    delayLocalSet: true,
    sessionData: { chatWindowId: 99, chatVideoId: "abcDEF_1234", chatTabId: 100 },
    windowsById: {
      99: { id: 99, type: "popup", tabs: [{ id: 100, url: "https://www.youtube.com/live_chat?is_popout=1&v=abcDEF_1234" }] }
    }
  });
  await harness.boundsHandlers[0]({ id: 99, type: "popup", width: 550, height: 800, left: 10, top: 10 });
  harness.windowsById.delete(99);
  const removed = harness.removedHandlers[0](99);
  await Promise.resolve();
  const created = harness.actionHandler({ id: 1, url: "https://www.youtube.com/live/zyxWVU_9876" });
  harness.releaseLocalSet();
  await Promise.all([removed, created]);
  assert.equal(harness.createdWindows.length, 1);
  assert.equal(harness.sessionData.chatWindowId, 42);
  assert.equal(harness.sessionData.chatVideoId, "zyxWVU_9876");
});

test("session 指向其他 popup 時不會誤聚焦", async () => {
  const harness = createHarness({
    sessionData: { chatWindowId: 99 },
    windowsById: { 99: { id: 99, type: "popup", tabs: [{ url: "https://example.com/popup" }] } }
  });
  await harness.actionHandler({ id: 1, url: "https://www.youtube.com/live/abcDEF_1234" });
  assert.equal(harness.updatedWindows.length, 0);
  assert.equal(harness.createdWindows.length, 1);
});

test("尺寸與失效座標會被清洗，建立失敗時去座標重試一次", async () => {
  const harness = createHarness({
    localData: { popupWidth: "999999", popupHeight: -1, popupLeft: 100, popupTop: 999999 },
    createResults: [new Error("position rejected"), { id: 88, type: "popup" }]
  });
  await harness.actionHandler({ id: 1, url: "https://www.youtube.com/live/abcDEF_1234" });
  assert.equal(harness.createdWindows.length, 2);
  assert.equal(harness.createdWindows[0].width, 8192);
  assert.equal(harness.createdWindows[0].height, 560);
  assert.equal(harness.createdWindows[0].left, 100);
  assert.equal("top" in harness.createdWindows[0], false);
  assert.equal("left" in harness.createdWindows[1], false);
  assert.equal("top" in harness.createdWindows[1], false);
});

test("第二螢幕的 8192×4320 bounds 會完整保留", async () => {
  const harness = createHarness({
    localData: { popupWidth: 8192, popupHeight: 4320, popupLeft: -4800, popupTop: 120 },
    createResults: [{ id: 88, type: "popup" }]
  });
  await harness.actionHandler({ id: 1, url: "https://www.youtube.com/live/abcDEF_1234" });
  assert.equal(harness.createdWindows[0].width, 8192);
  assert.equal(harness.createdWindows[0].height, 4320);
  assert.equal(harness.createdWindows[0].left, -4800);
  assert.equal(harness.createdWindows[0].top, 120);
});

test("create 回傳 undefined 或 rejection 不造成 unhandled，且最多重試一次", async () => {
  const undefinedResult = createHarness({ createResults: [undefined, undefined] });
  await assert.doesNotReject(undefinedResult.actionHandler({ id: 1, url: "https://www.youtube.com/live/abcDEF_1234" }));
  assert.equal(undefinedResult.createdWindows.length, 1);
  assert.ok(undefinedResult.titles.some(({ title }) => title.includes("無法開啟")));

  const rejected = createHarness({ createResults: [new Error("create failed"), new Error("retry failed")] });
  await assert.doesNotReject(rejected.actionHandler({ id: 1, url: "https://www.youtube.com/live/abcDEF_1234" }));
  assert.equal(rejected.createdWindows.length, 1);
});

test("content script 只注入正式 HTTPS 直播聊天室", () => {
  assert.deepEqual(manifest.content_scripts[0].matches, ["https://www.youtube.com/live_chat*"]);
});

test("徽章 API rejection 仍不會讓 action 產生 unhandled", async () => {
  const harness = createHarness({ reject: [undefined] });
  await assert.doesNotReject(harness.actionHandler({ id: 1, url: "https://www.youtube.com/" }));
});

test("bounds 只合併保存自家 popup，關窗前會 flush 最新尺寸", async () => {
  const harness = createHarness({ sessionData: { chatWindowId: 42 } });
  await assert.doesNotReject(harness.boundsHandlers[0]({ id: 42, type: "popup", width: 600, height: 700, left: 10, top: 20 }));
  await assert.doesNotReject(harness.boundsHandlers[0]({ id: 42, type: "popup", width: 640, height: 740, left: 30, top: 40 }));
  await assert.doesNotReject(harness.boundsHandlers[0]({ id: 77, type: "popup", width: 1, height: 1 }));
  await assert.doesNotReject(harness.boundsHandlers[0]({ id: 42, type: "normal", width: 1, height: 1 }));
  assert.equal(harness.localSets.length, 0);

  await harness.removedHandlers[0](42);
  assert.equal(harness.localSets.length, 1);
  assert.equal(harness.localSets[0].popupWidth, 640);
  assert.equal(harness.localSets[0].popupHeight, 740);
  assert.equal(harness.localSets[0].popupLeft, 30);
  assert.equal(harness.localSets[0].popupTop, 40);
});

test("bounds debounce 在連續事件後只寫入最後一次", async () => {
  const harness = createHarness({ sessionData: { chatWindowId: 42 } });
  await harness.boundsHandlers[0]({ id: 42, type: "popup", width: 500, height: 600, left: 1, top: 2 });
  await harness.boundsHandlers[0]({ id: 42, type: "popup", width: 700, height: 800, left: 3, top: 4 });
  await harness.runTimers();

  assert.equal(harness.localSets.length, 1);
  assert.equal(harness.localSets[0].popupWidth, 700);
  assert.equal(harness.localSets[0].popupHeight, 800);
});
