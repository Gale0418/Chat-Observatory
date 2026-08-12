const VIDEO_ID_PATTERN = /^[a-zA-Z0-9_-]{6,20}$/;
let chatWindowId = null;

function extractVideoId(rawUrl = "") {
  try {
    const url = new URL(rawUrl);
    const studioMatch = url.pathname.match(/^\/video\/([a-zA-Z0-9_-]+)\//);
    const pathMatch = url.pathname.match(/^\/(?:live|shorts|embed)\/([a-zA-Z0-9_-]+)/);
    const candidate =
      (url.hostname === "studio.youtube.com" && studioMatch?.[1]) ||
      (url.hostname === "youtu.be" && url.pathname.slice(1).split("/")[0]) ||
      url.searchParams.get("v") ||
      pathMatch?.[1];

    return candidate && VIDEO_ID_PATTERN.test(candidate) ? candidate : null;
  } catch {
    return null;
  }
}

async function showActionError(tabId) {
  await chrome.action.setBadgeBackgroundColor({ tabId, color: "#C83F49" });
  await chrome.action.setBadgeText({ tabId, text: "!" });
  await chrome.action.setTitle({
    tabId,
    title: "找不到直播聊天室，請先開啟 YouTube 直播或直播控制台。"
  });

  setTimeout(() => {
    chrome.action.setBadgeText({ tabId, text: "" }).catch(() => {});
    chrome.action.setTitle({ tabId, title: "彈出聊天室控制中心" }).catch(() => {});
  }, 4500);
}

chrome.action.onClicked.addListener(async (tab) => {
  const videoId = extractVideoId(tab.url);

  if (!videoId) {
    await showActionError(tab.id);
    return;
  }

  const saved = await chrome.storage.local.get({
    popupWidth: 520,
    popupHeight: 820,
    popupLeft: null,
    popupTop: null
  });

  const createData = {
    url: `https://www.youtube.com/live_chat?is_popout=1&v=${encodeURIComponent(videoId)}`,
    type: "popup",
    width: Math.max(380, Number(saved.popupWidth) || 520),
    height: Math.max(560, Number(saved.popupHeight) || 820)
  };

  if (Number.isInteger(saved.popupLeft)) createData.left = saved.popupLeft;
  if (Number.isInteger(saved.popupTop)) createData.top = saved.popupTop;

  const chatWindow = await chrome.windows.create(createData);
  chatWindowId = chatWindow.id;
});

chrome.windows.onBoundsChanged.addListener((window) => {
  if (window.id !== chatWindowId || window.type !== "popup") return;
  chrome.storage.local.set({
    popupWidth: window.width,
    popupHeight: window.height,
    popupLeft: window.left,
    popupTop: window.top
  });
});

chrome.windows.onRemoved.addListener((windowId) => {
  if (windowId === chatWindowId) chatWindowId = null;
});
