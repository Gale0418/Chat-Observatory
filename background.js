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
  width: [380, 1600],
  height: [560, 1400],
  position: [-10000, 10000]
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
let actionQueue = Promise.resolve();
let pendingBounds = null;
let boundsSaveTimer = null;

function extractVideoId(rawUrl = "") {
  try {
    const url = new URL(rawUrl);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || !ALLOWED_HOSTS.has(host) || !["", "443"].includes(url.port)) {
      return null;
    }

    let candidate = null;
    if (["youtube.com", "www.youtube.com", "m.youtube.com"].includes(host)) {
      if (/^\/watch\/?$/.test(url.pathname)) {
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

async function readChatWindowId() {
  const session = sessionStorage();
  if (session?.get) {
    try {
      const saved = await session.get({ chatWindowId: null });
      chatWindowId = Number.isInteger(saved?.chatWindowId) ? saved.chatWindowId : null;
    } catch {
      // chrome.storage.session may be unavailable during startup; use memory fallback.
    }
  }
  return Number.isInteger(chatWindowId) ? chatWindowId : null;
}

async function saveChatWindowId(id) {
  chatWindowId = Number.isInteger(id) ? id : null;
  const session = sessionStorage();
  if (session?.set) await safeCall(session.set.bind(session), { chatWindowId });
}

async function clearChatWindowId() {
  chatWindowId = null;
  const session = sessionStorage();
  if (session?.remove) {
    await safeCall(session.remove.bind(session), "chatWindowId");
  } else if (session?.set) {
    await safeCall(session.set.bind(session), { chatWindowId: null });
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
  return Math.min(BOUNDS_LIMITS.position[1], Math.max(BOUNDS_LIMITS.position[0], Math.round(numeric)));
}

async function clearActionError(tabId) {
  await Promise.all([
    safeCall(chrome.action?.setBadgeText?.bind(chrome.action), { tabId, text: "" }),
    safeCall(chrome.action?.setTitle?.bind(chrome.action), {
      tabId,
      title: getLocalizedMessage("actionTitle", "彈出聊天室控制中心")
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

  setTimeout(() => { void clearActionError(tabId); }, 4500);
}

async function getWindow(id) {
  if (!Number.isInteger(id) || !chrome.windows?.get) return null;
  try {
    const window = await chrome.windows.get(id, { populate: true });
    if (!window || (window.type && window.type !== "popup")) return null;
    const visibleTabUrls = (window.tabs || []).map((tab) => tab?.url).filter(Boolean);
    if (visibleTabUrls.length > 0 && !visibleTabUrls.some((url) => {
      try {
        const parsed = new URL(url);
        return parsed.protocol === "https:" &&
          parsed.hostname === "www.youtube.com" &&
          parsed.pathname === "/live_chat" &&
          parsed.searchParams.get("is_popout") === "1";
      } catch {
        return false;
      }
    })) return null;
    return window;
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

  const existingId = await readChatWindowId();
  if (existingId !== null) {
    const existing = await getWindow(existingId);
    if (existing && chrome.windows?.update) {
      try {
        await chrome.windows.update(existingId, { focused: true });
        return;
      } catch {
        // Treat a failed update as stale, then make one clean window below.
      }
    }
    await clearChatWindowId();
  }

  let saved = DEFAULT_BOUNDS;
  try {
    saved = await chrome.storage.local.get(DEFAULT_BOUNDS);
  } catch {
    // Defaults are safe if storage is unavailable.
  }

  const createData = {
    url: `https://www.youtube.com/live_chat?is_popout=1&v=${encodeURIComponent(videoId)}`,
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
    await saveChatWindowId(chatWindow.id);
  } else {
    await showActionError(tab.id, getLocalizedMessage("actionErrorOpen", "無法開啟直播聊天室，請稍後再試。"));
  }
}

chrome.action.onClicked.addListener((tab = {}) => {
  const currentAction = actionQueue.then(() => handleActionClick(tab));
  actionQueue = currentAction.catch(() => undefined);
  return currentAction;
});

function clearBoundsSaveTimer() {
  if (boundsSaveTimer !== null) {
    clearTimeout(boundsSaveTimer);
    boundsSaveTimer = null;
  }
}

async function flushPendingBounds() {
  clearBoundsSaveTimer();
  const bounds = pendingBounds;
  pendingBounds = null;
  if (bounds) {
    await safeCall(chrome.storage.local?.set?.bind(chrome.storage.local), bounds);
  }
}

chrome.windows.onBoundsChanged.addListener(async (window) => {
  if (!window || window.type !== "popup") return;
  const ownWindowId = await readChatWindowId();
  if (window.id !== ownWindowId) return;
  pendingBounds = {
    popupWidth: sanitizeDimension(window.width, DEFAULT_BOUNDS.popupWidth, BOUNDS_LIMITS.width),
    popupHeight: sanitizeDimension(window.height, DEFAULT_BOUNDS.popupHeight, BOUNDS_LIMITS.height),
    popupLeft: sanitizePosition(window.left),
    popupTop: sanitizePosition(window.top)
  };
  clearBoundsSaveTimer();
  boundsSaveTimer = setTimeout(() => { void flushPendingBounds(); }, 250);
});

chrome.windows.onRemoved.addListener(async (windowId) => {
  const ownWindowId = await readChatWindowId();
  if (windowId === ownWindowId) {
    await flushPendingBounds();
    await clearChatWindowId();
  }
});
