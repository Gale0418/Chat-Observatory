const VIDEO_ID_PATTERN = /^[a-zA-Z0-9_-]{6,20}$/;
const ALLOWED_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "studio.youtube.com",
  "youtu.be"
]);
const DEFAULT_BOUNDS = {
  popupWidth: 520,
  popupHeight: 820,
  popupLeft: null,
  popupTop: null
};
const BOUNDS_LIMITS = {
  width: [380, 8192],
  height: [560, 4320],
  position: [-8192, 8192]
};

function getLocalizedMessage(key, fallback, substitutions) {
  try {
    const message = chrome.i18n?.getMessage?.(key, substitutions);
    return message || fallback;
  } catch {
    return fallback;
  }
}

let chatWindowId = null;
let chatVideoId = null;
let chatTabId = null;
let sessionWritePending = false;
let actionQueue = Promise.resolve();
let pendingBounds = null;
let boundsSaveTimer = null;
let boundsSaveInFlight = false;
let boundsSaveGeneration = 0;
let boundsSaveRetryCount = 0;
const actionErrorTimers = new Map();
const BOUNDS_SAVE_DELAY_MS = 250;
const BOUNDS_SAVE_MAX_RETRIES = 3;

function extractVideoId(rawUrl = "") {
  try {
    const url = new URL(rawUrl);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || !ALLOWED_HOSTS.has(host) || !["", "443"].includes(url.port)) {
      return null;
    }

    let candidate = null;
    if (["youtube.com", "www.youtube.com", "m.youtube.com"].includes(host)) {
      if (/^\/(?:watch|live_chat)\/?$/.test(url.pathname)) {
        candidate = url.searchParams.get("v");
      } else {
        candidate = url.pathname.match(/^\/(?:live|shorts|embed)\/([a-zA-Z0-9_-]+)\/?$/)?.[1] || null;
      }
    } else if (host === "studio.youtube.com") {
      candidate = url.pathname.match(/^\/video\/([a-zA-Z0-9_-]+)(?:\/[^/]+)?\/?$/)?.[1] || null;
    } else if (host === "youtu.be") {
      candidate = url.pathname.match(/^\/([a-zA-Z0-9_-]+)\/?$/)?.[1] || null;
    }

    return candidate && VIDEO_ID_PATTERN.test(candidate) ? candidate : null;
  } catch {
    return null;
  }
}

function safeCall(fn, ...args) {
  try {
    return Promise.resolve(typeof fn === "function" ? fn(...args) : undefined).catch(() => undefined);
  } catch {
    return Promise.resolve(undefined);
  }
}

function sessionStorage() {
  return chrome.storage?.session;
}

async function readChatSession() {
  const session = sessionStorage();
  if (session?.get) {
    try {
      const saved = await session.get({ chatWindowId: null, chatVideoId: null, chatTabId: null });
      if (sessionWritePending && chatWindowId !== null) {
        try {
          await session.set({ chatWindowId, chatVideoId, chatTabId });
          sessionWritePending = false;
        } catch {
          // Keep the in-memory session until storage is available again.
        }
      } else {
        chatWindowId = Number.isInteger(saved?.chatWindowId) ? saved.chatWindowId : null;
        chatVideoId = typeof saved?.chatVideoId === "string" && VIDEO_ID_PATTERN.test(saved.chatVideoId)
          ? saved.chatVideoId
          : null;
        chatTabId = Number.isInteger(saved?.chatTabId) ? saved.chatTabId : null;
      }
    } catch {
      // chrome.storage.session may be unavailable during startup; use memory fallback.
    }
  } else if (chatWindowId !== null) {
    sessionWritePending = true;
  }
  return {
    windowId: Number.isInteger(chatWindowId) ? chatWindowId : null,
    videoId: chatVideoId,
    tabId: chatTabId
  };
}

async function saveChatSession(id, videoId, tabId = null) {
  chatWindowId = Number.isInteger(id) ? id : null;
  chatVideoId = typeof videoId === "string" && VIDEO_ID_PATTERN.test(videoId) ? videoId : null;
  chatTabId = Number.isInteger(tabId) ? tabId : null;
  const session = sessionStorage();
  if (session?.set) {
    try {
      await session.set({ chatWindowId, chatVideoId, chatTabId });
      sessionWritePending = false;
    } catch {
      sessionWritePending = true;
    }
  } else if (chatWindowId !== null) {
    sessionWritePending = true;
  }
}

async function clearChatSession() {
  chatWindowId = null;
  chatVideoId = null;
  chatTabId = null;
  sessionWritePending = false;
  const session = sessionStorage();
  if (session?.remove) {
    await Promise.all([
      safeCall(session.remove.bind(session), "chatWindowId"),
      safeCall(session.remove.bind(session), "chatVideoId"),
      safeCall(session.remove.bind(session), "chatTabId")
    ]);
  } else if (session?.set) {
    await safeCall(session.set.bind(session), { chatWindowId: null, chatVideoId: null, chatTabId: null });
  }
}

function sanitizeDimension(value, fallback, [minimum, maximum]) {
  const numeric = typeof value === "number" || typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.floor(numeric)));
}

function sanitizePosition(value) {
  const numeric = typeof value === "number" || typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(numeric)) return null;
  const rounded = Math.round(numeric);
  return rounded < BOUNDS_LIMITS.position[0] || rounded > BOUNDS_LIMITS.position[1] ? null : rounded;
}

function getChatUrl(videoId) {
  return `https://www.youtube.com/live_chat?is_popout=1&v=${encodeURIComponent(videoId)}`;
}

function isChatTabUrl(rawUrl) {
  try {
    const url = new URL(rawUrl || "");
    return url.protocol === "https:" &&
      url.hostname === "www.youtube.com" &&
      url.pathname === "/live_chat" &&
      url.searchParams.get("is_popout") === "1";
  } catch {
    return false;
  }
}

async function getChatTab(window) {
  for (const tab of window?.tabs || []) {
    if (!Number.isInteger(tab?.id)) continue;
    let url = tab.pendingUrl || tab.url || "";
    if (!url && chrome.tabs?.sendMessage) {
      try {
        const response = await chrome.tabs.sendMessage(tab.id, { type: "chatobs:probe" });
        url = response?.url || "";
      } catch {
        // Missing content script: this tab is not a verified chat.
      }
    }
    if (isChatTabUrl(url)) return { ...tab, url };
  }
  return null;
}

async function updateChatTab(tab, videoId) {
  if (!Number.isInteger(tab?.id) || !chrome.tabs?.update) return false;
  try {
    await chrome.tabs.update(tab.id, { url: getChatUrl(videoId) });
    return true;
  } catch {
    return false;
  }
}

async function clearActionError(tabId) {
  const timer = actionErrorTimers.get(tabId);
  if (timer !== undefined) {
    clearTimeout(timer);
    actionErrorTimers.delete(tabId);
  }
  await Promise.all([
    safeCall(chrome.action?.setBadgeText?.bind(chrome.action), { tabId, text: "" }),
    safeCall(chrome.action?.setTitle?.bind(chrome.action), {
      tabId,
      title: getLocalizedMessage("actionTitle", "開啟獨立直播聊天室")
    })
  ]);
}

async function showActionError(tabId, title = getLocalizedMessage(
  "actionErrorNoChat",
  "找不到直播聊天室，請先開啟 YouTube 直播或直播控制台。"
)) {
  await Promise.all([
    safeCall(chrome.action?.setBadgeBackgroundColor?.bind(chrome.action), { tabId, color: "#C83F49" }),
    safeCall(chrome.action?.setBadgeText?.bind(chrome.action), { tabId, text: "!" }),
    safeCall(chrome.action?.setTitle?.bind(chrome.action), {
      tabId,
      title
    })
  ]);

  const previousTimer = actionErrorTimers.get(tabId);
  if (previousTimer !== undefined) clearTimeout(previousTimer);
  actionErrorTimers.set(tabId, setTimeout(() => { void clearActionError(tabId); }, 4500));
}

async function getWindow(id) {
  if (!Number.isInteger(id) || !chrome.windows?.get) return null;
  try {
    const window = await chrome.windows.get(id, { populate: true });
    return window?.type === "popup" ? window : null;
  } catch {
    return null;
  }
}

async function createChatWindow(createData) {
  let created;
  try {
    created = await chrome.windows.create(createData);
  } catch {
    created = null;
  }
  if (created?.id !== undefined) return created;

  if (!("left" in createData) && !("top" in createData)) return null;
  const fallback = { ...createData };
  delete fallback.left;
  delete fallback.top;
  try {
    created = await chrome.windows.create(fallback);
  } catch {
    created = null;
  }
  return created?.id !== undefined ? created : null;
}

async function handleActionClick(tab = {}) {
  await clearActionError(tab.id);
  const videoId = extractVideoId(tab.url);
  if (!videoId) {
    await showActionError(tab.id);
    return;
  }

  const existingSession = await readChatSession();
  if (existingSession.windowId !== null) {
    const existing = await getWindow(existingSession.windowId);
    if (existing && chrome.windows?.update) {
      const existingTab = await getChatTab(existing);
      // A saved ID or loading status does not prove the tab still hosts our chat.
      // Preserve unverified pages; only URL/probe-confirmed chats can be navigated.
      const chatTab = existingTab;
      const sameChat = existingTab && extractVideoId(existingTab.url) === videoId;
      if (chatTab) {
        if (!sameChat && !(await updateChatTab(chatTab, videoId))) {
          await showActionError(tab.id, getLocalizedMessage("actionErrorOpen", "無法開啟直播聊天室，請稍後再試。"));
          return;
        }
        try {
          await chrome.windows.update(existingSession.windowId, { focused: true });
          await saveChatSession(existingSession.windowId, videoId, chatTab.id);
          return;
        } catch {
          await showActionError(tab.id, getLocalizedMessage("actionErrorOpen", "無法開啟直播聊天室，請稍後再試。"));
          return;
        }
      }
    }
    await clearChatSession();
  }

  let saved = DEFAULT_BOUNDS;
  try {
    saved = await chrome.storage.local.get(DEFAULT_BOUNDS);
  } catch {
    // Defaults are safe if storage is unavailable.
  }

  const createData = {
    url: getChatUrl(videoId),
    type: "popup",
    width: sanitizeDimension(saved?.popupWidth, DEFAULT_BOUNDS.popupWidth, BOUNDS_LIMITS.width),
    height: sanitizeDimension(saved?.popupHeight, DEFAULT_BOUNDS.popupHeight, BOUNDS_LIMITS.height)
  };
  const left = sanitizePosition(saved?.popupLeft);
  const top = sanitizePosition(saved?.popupTop);
  if (left !== null) createData.left = left;
  if (top !== null) createData.top = top;

  const chatWindow = await createChatWindow(createData);
  if (chatWindow?.id !== undefined) {
    await saveChatSession(chatWindow.id, videoId, chatWindow.tabs?.[0]?.id);
  } else {
    await showActionError(tab.id, getLocalizedMessage("actionErrorOpen", "無法開啟直播聊天室，請稍後再試。"));
  }
}

function serializeSessionOperation(operation) {
  const current = actionQueue.then(operation);
  actionQueue = current.catch(() => undefined);
  return current;
}

chrome.action.onClicked.addListener((tab = {}) => serializeSessionOperation(() => handleActionClick(tab)));

function clearBoundsSaveTimer() {
  if (boundsSaveTimer !== null) {
    clearTimeout(boundsSaveTimer);
    boundsSaveTimer = null;
  }
}

function scheduleBoundsSave(delay = BOUNDS_SAVE_DELAY_MS) {
  if (!pendingBounds || boundsSaveInFlight) return;
  clearBoundsSaveTimer();
  boundsSaveTimer = setTimeout(() => {
    boundsSaveTimer = null;
    void flushPendingBounds();
  }, delay);
}

async function flushPendingBounds() {
  clearBoundsSaveTimer();
  if (!pendingBounds || boundsSaveInFlight) return;

  const bounds = pendingBounds;
  const generation = boundsSaveGeneration;
  boundsSaveInFlight = true;
  let saved = false;
  try {
    const setter = chrome.storage.local?.set;
    if (typeof setter === "function") {
      await setter.call(chrome.storage.local, bounds);
      saved = true;
    }
  } catch {
    // Keep the latest bounds for a bounded retry.
  } finally {
    boundsSaveInFlight = false;
  }

  const isCurrent = pendingBounds === bounds && boundsSaveGeneration === generation;
  if (saved && isCurrent) {
    pendingBounds = null;
    boundsSaveRetryCount = 0;
  } else if (saved || !isCurrent) {
    // A newer bounds snapshot arrived while this write was in flight.
    boundsSaveRetryCount = 0;
    scheduleBoundsSave();
  } else if (boundsSaveRetryCount < BOUNDS_SAVE_MAX_RETRIES) {
    boundsSaveRetryCount += 1;
    scheduleBoundsSave(BOUNDS_SAVE_DELAY_MS * (2 ** (boundsSaveRetryCount - 1)));
  }
}

chrome.windows.onBoundsChanged.addListener((window) => serializeSessionOperation(async () => {
  if (!window || window.type !== "popup") return;
  const ownWindowId = (await readChatSession()).windowId;
  if (window.id !== ownWindowId) return;
  pendingBounds = {
    popupWidth: sanitizeDimension(window.width, DEFAULT_BOUNDS.popupWidth, BOUNDS_LIMITS.width),
    popupHeight: sanitizeDimension(window.height, DEFAULT_BOUNDS.popupHeight, BOUNDS_LIMITS.height),
    popupLeft: sanitizePosition(window.left),
    popupTop: sanitizePosition(window.top)
  };
  boundsSaveGeneration += 1;
  boundsSaveRetryCount = 0;
  scheduleBoundsSave();
}));

chrome.windows.onRemoved.addListener((windowId) => serializeSessionOperation(async () => {
  const ownWindowId = (await readChatSession()).windowId;
  if (windowId === ownWindowId) {
    await flushPendingBounds();
    await clearChatSession();
  }
}));
