(() => {
  if (!window.location.href.includes("is_popout=1")) return;
  if (document.getElementById("chatobs-control-panel")) return;

  const DEFAULT_SETTINGS = Object.freeze({
    uiLocale: "auto",
    theme: "black",
    fontSize: 28,
    panelFontSize: 20,
    avatarSize: 48,
    isCollapsed: false,
    ttsEnabled: false,
    ttsVolume: 65,
    ttsRate: 1.05,
    ttsPitch: 1,
    ttsVoiceMode: "auto",
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

  const VALID_UI_LOCALES = Object.freeze(["auto", "zh-TW", "ja", "en"]);
  const VALID_THEMES = Object.freeze([
    "black", "red", "orange", "yellow", "green", "blue",
    "purple", "gray", "white", "gold", "silver", "rainbow"
  ]);
  const LEGACY_THEME_MAP = Object.freeze({
    ember: "red",
    aurora: "blue",
    paper: "green",
    starlight: "gold"
  });
  const VALID_VOICE_MODES = Object.freeze(["auto", "fixed"]);
  const UI_COPY = Object.freeze({
    "zh-TW": Object.freeze({
      interfaceLanguage: "介面語言",
      themeGroup: "介面畫風",
      themeBlack: "玄曜奇點",
      themeRed: "赤曜超新星",
      themeOrange: "橙燼日冕",
      themeYellow: "炫陽星暴",
      themeGreen: "翠晶星雲",
      themeBlue: "蒼穹冰潮",
      themePurple: "紫宸雙星",
      themeGray: "銀蝕隕痕",
      themeWhite: "霜華白矮",
      themeGold: "金鑄熔爐",
      themeSilver: "銀河星環",
      themeRainbow: "虹渦光譜",
      themeBlackAria: "切換為玄曜奇點主題",
      themeRedAria: "切換為赤曜超新星主題",
      themeOrangeAria: "切換為橙燼日冕主題",
      themeYellowAria: "切換為炫陽星暴主題",
      themeGreenAria: "切換為翠晶星雲主題",
      themeBlueAria: "切換為蒼穹冰潮主題",
      themePurpleAria: "切換為紫宸雙星主題",
      themeGrayAria: "切換為銀蝕隕痕主題",
      themeWhiteAria: "切換為霜華白矮主題",
      themeGoldAria: "切換為金鑄熔爐主題",
      themeSilverAria: "切換為銀河星環主題",
      themeRainbowAria: "切換為虹渦光譜主題",
      collapsePanel: "收合控制面板",
      expandPanel: "展開控制面板",
      ready: "準備就緒",
      displaySection: "畫面",
      displayHint: "適合第二螢幕與遠距監看",
      textSize: "文字",
      panelTextSize: "パネル文字",
      avatarSize: "頭像",
      hideAvatars: "隱藏頭像",
      hideBadges: "隱藏徽章",
      keywords: "醒目關鍵字",
      keywordPlaceholder: "以逗號分隔，例如：問題, 救命",
      speechSection: "語音朗讀",
      ttsToggleTitle: "開啟或關閉 TTS",
      voiceMode: "語音模式",
      voiceAuto: "自動配對語言",
      voiceFixed: "固定選定語音",
      voiceSelect: "預設／固定語音",
      localOnly: "（僅本機）",
      voiceHint: "自動模式會依語言挑選推薦人聲；沒有公開評分，仍可切到固定語音逐一試聽。",
      rate: "語速",
      volume: "音量",
      readTime: "朗讀時間",
      readName: "朗讀名字",
      readEmoji: "朗讀表情名稱",
      cleanUrls: "網址改念「連結」",
      collapseRepeats: "壓縮重複文字",
      testVoice: "試聽",
      skipSpeech: "跳過",
      clearSpeech: "清空",
      statusOff: "語音未開啟",
      statusSpeaking: "朗讀中",
      statusFixedUnavailable: "固定語音不可用 · 請重新選擇",
      statusAutoWaiting: "自動配對 · 等待本機語音",
      statusAutoOn: "自動配對 · 語音已開啟",
      statusFixedOn: "固定語音 · 已開啟",
      queueWaiting: " · 等待 {count} 則",
      statusSaveFailed: "設定暫時無法儲存",
      statusLoadFailed: "無法讀取設定，已使用預設值",
      statusWaitingVoice: "正在等待本機語音",
      statusEnabled: "語音朗讀已開啟",
      statusNoVoice: "找不到可用的本機語音",
      statusTest: "語音試聽中…",
      statusQueueCleared: "語音佇列已清空",
      statusSkipped: "已跳過目前留言",
      voiceMissing: "原本的固定語音已不可用，請重新選擇",
      voiceUnavailable: "找不到明確標示為本機的語音",
      recommended: " · 推薦",
      speechLink: "連結",
      speechTruncated: "後略",
      speechViewer: "觀眾",
      speechSuperChat: "Super Chat",
      speechSuperSticker: "Super Sticker",
      speechMembership: "會員訊息",
      speechGiftPurchase: "會員贈送",
      speechGiftRedemption: "會員禮物",
      speechStickerMessage: "傳送了 Super Sticker",
      speechJoinedMembership: "成為了頻道會員",
      speechGiftedMembership: "贈送了頻道會員",
      speechReceivedMembership: "獲得了頻道會員",
      speechNameSuffix: "{author}說：",
      speechSeparator: "{label}，"
    }),
    ja: Object.freeze({
      interfaceLanguage: "表示言語",
      themeGroup: "テーマ",
      themeBlack: "玄曜・特異点",
      themeRed: "赤曜・超新星",
      themeOrange: "橙燼・コロナ",
      themeYellow: "炫陽・星嵐",
      themeGreen: "翠晶・星雲",
      themeBlue: "蒼穹・氷潮",
      themePurple: "紫宸・双星",
      themeGray: "銀蝕・隕痕",
      themeWhite: "霜華・白矮星",
      themeGold: "金鋳・炉心",
      themeSilver: "銀河・星環",
      themeRainbow: "虹渦・スペクトル",
      themeBlackAria: "玄曜・特異点テーマに切り替え",
      themeRedAria: "赤曜・超新星テーマに切り替え",
      themeOrangeAria: "橙燼・コロナテーマに切り替え",
      themeYellowAria: "炫陽・星嵐テーマに切り替え",
      themeGreenAria: "翠晶・星雲テーマに切り替え",
      themeBlueAria: "蒼穹・氷潮テーマに切り替え",
      themePurpleAria: "紫宸・双星テーマに切り替え",
      themeGrayAria: "銀蝕・隕痕テーマに切り替え",
      themeWhiteAria: "霜華・白矮星テーマに切り替え",
      themeGoldAria: "金鋳・炉心テーマに切り替え",
      themeSilverAria: "銀河・星環テーマに切り替え",
      themeRainbowAria: "虹渦・スペクトルテーマに切り替え",
      collapsePanel: "コントロールパネルを閉じる",
      expandPanel: "コントロールパネルを開く",
      ready: "準備完了",
      displaySection: "表示",
      displayHint: "セカンドスクリーンや遠距離視聴に最適",
      textSize: "文字",
      panelTextSize: "パネル文字",
      avatarSize: "アバター",
      hideAvatars: "アバターを隠す",
      hideBadges: "バッジを隠す",
      keywords: "ハイライトキーワード",
      keywordPlaceholder: "カンマ区切り（例：質問, 助けて）",
      speechSection: "音声読み上げ",
      ttsToggleTitle: "TTS のオン／オフ",
      voiceMode: "音声モード",
      voiceAuto: "言語に合わせて自動選択",
      voiceFixed: "選択した音声を固定",
      voiceSelect: "既定／固定音声",
      localOnly: "（ローカルのみ）",
      voiceHint: "自動モードは言語に合う推奨音声を選びます。評価情報は公開されていないため、固定モードで試聴できます。",
      rate: "読み上げ速度",
      volume: "音量",
      readTime: "時刻を読み上げ",
      readName: "名前を読み上げ",
      readEmoji: "絵文字名を読み上げ",
      cleanUrls: "URLを「リンク」と読む",
      collapseRepeats: "繰り返し文字を圧縮",
      testVoice: "試聴",
      skipSpeech: "スキップ",
      clearSpeech: "クリア",
      statusOff: "音声オフ",
      statusSpeaking: "読み上げ中",
      statusFixedUnavailable: "固定音声を利用できません · 再選択してください",
      statusAutoWaiting: "自動選択 · ローカル音声を待機中",
      statusAutoOn: "自動選択 · 音声オン",
      statusFixedOn: "固定音声 · オン",
      queueWaiting: " · {count}件待機",
      statusSaveFailed: "設定を一時保存できません",
      statusLoadFailed: "設定を読み込めないため既定値を使用",
      statusWaitingVoice: "ローカル音声を待っています",
      statusEnabled: "音声読み上げを開始しました",
      statusNoVoice: "利用可能なローカル音声が見つかりません",
      statusTest: "音声を試聴中…",
      statusQueueCleared: "音声キューをクリアしました",
      statusSkipped: "現在のメッセージをスキップしました",
      voiceMissing: "以前の固定音声を利用できません。再選択してください",
      voiceUnavailable: "ローカル音声が見つかりません",
      recommended: " · 推奨",
      speechLink: "リンク",
      speechTruncated: "以下略",
      speechViewer: "視聴者",
      speechSuperChat: "Super Chat",
      speechSuperSticker: "Super Sticker",
      speechMembership: "メンバーシップ",
      speechGiftPurchase: "メンバーギフト",
      speechGiftRedemption: "メンバーギフト",
      speechStickerMessage: "Super Stickerを送信",
      speechJoinedMembership: "チャンネルメンバーになりました",
      speechGiftedMembership: "チャンネルメンバーを贈りました",
      speechReceivedMembership: "チャンネルメンバーを獲得しました",
      speechNameSuffix: "{author}さん：",
      speechSeparator: "{label}、"
    }),
    en: Object.freeze({
      interfaceLanguage: "Interface language",
      themeGroup: "Theme",
      themeBlack: "Umbra Singularity",
      themeRed: "Crimson Nova",
      themeOrange: "Ember Corona",
      themeYellow: "Helios Storm",
      themeGreen: "Verdant Prism",
      themeBlue: "Azure Icefall",
      themePurple: "Amethyst Binary",
      themeGray: "Ashen Impact",
      themeWhite: "Frostlight Dwarf",
      themeGold: "Aureate Forge",
      themeSilver: "Argent Halo",
      themeRainbow: "Prism Maelstrom",
      themeBlackAria: "Switch to Umbra Singularity theme",
      themeRedAria: "Switch to Crimson Nova theme",
      themeOrangeAria: "Switch to Ember Corona theme",
      themeYellowAria: "Switch to Helios Storm theme",
      themeGreenAria: "Switch to Verdant Prism theme",
      themeBlueAria: "Switch to Azure Icefall theme",
      themePurpleAria: "Switch to Amethyst Binary theme",
      themeGrayAria: "Switch to Ashen Impact theme",
      themeWhiteAria: "Switch to Frostlight Dwarf theme",
      themeGoldAria: "Switch to Aureate Forge theme",
      themeSilverAria: "Switch to Argent Halo theme",
      themeRainbowAria: "Switch to Prism Maelstrom theme",
      collapsePanel: "Collapse control panel",
      expandPanel: "Expand control panel",
      ready: "Ready",
      displaySection: "Display",
      displayHint: "Designed for second screens and distance viewing",
      textSize: "Text",
      panelTextSize: "Panel text",
      avatarSize: "Avatars",
      hideAvatars: "Hide avatars",
      hideBadges: "Hide badges",
      keywords: "Highlight keywords",
      keywordPlaceholder: "Separate with commas, e.g. question, help",
      speechSection: "Voice reading",
      ttsToggleTitle: "Turn TTS on or off",
      voiceMode: "Voice mode",
      voiceAuto: "Match language automatically",
      voiceFixed: "Use selected voice",
      voiceSelect: "Default / fixed voice",
      localOnly: "(local only)",
      voiceHint: "Auto mode selects a recommended voice for each language. Ratings are not public, so use fixed mode to try voices one by one.",
      rate: "Speech rate",
      volume: "Volume",
      readTime: "Read time",
      readName: "Read names",
      readEmoji: "Read emoji names",
      cleanUrls: "Read URLs as “link”",
      collapseRepeats: "Collapse repeated text",
      testVoice: "Test",
      skipSpeech: "Skip",
      clearSpeech: "Clear",
      statusOff: "Voice off",
      statusSpeaking: "Speaking",
      statusFixedUnavailable: "Fixed voice unavailable · Choose again",
      statusAutoWaiting: "Auto match · Waiting for local voice",
      statusAutoOn: "Auto match · Voice on",
      statusFixedOn: "Fixed voice · On",
      queueWaiting: " · {count} queued",
      statusSaveFailed: "Settings could not be saved temporarily",
      statusLoadFailed: "Could not load settings; using defaults",
      statusWaitingVoice: "Waiting for a local voice",
      statusEnabled: "Voice reading enabled",
      statusNoVoice: "No usable local voice found",
      statusTest: "Testing voice…",
      statusQueueCleared: "Voice queue cleared",
      statusSkipped: "Skipped the current message",
      voiceMissing: "The previous fixed voice is unavailable. Choose another.",
      voiceUnavailable: "No clearly local voice found",
      recommended: " · Recommended",
      speechLink: "link",
      speechTruncated: "continued",
      speechViewer: "viewer",
      speechSuperChat: "Super Chat",
      speechSuperSticker: "Super Sticker",
      speechMembership: "Membership",
      speechGiftPurchase: "Membership gift",
      speechGiftRedemption: "Membership gift",
      speechStickerMessage: "sent a Super Sticker",
      speechJoinedMembership: "joined the channel membership",
      speechGiftedMembership: "gifted a channel membership",
      speechReceivedMembership: "received a channel membership",
      speechNameSuffix: "{author} says: ",
      speechSeparator: "{label}, "
    })
  });
  const THEME_IMAGE_PATHS = Object.freeze({
    black: "assets/themes/cosmic-spectrum-black.jpg",
    red: "assets/themes/cosmic-spectrum-red.jpg",
    orange: "assets/themes/cosmic-spectrum-orange.jpg",
    yellow: "assets/themes/cosmic-spectrum-yellow.jpg",
    green: "assets/themes/cosmic-spectrum-green.jpg",
    blue: "assets/themes/cosmic-spectrum-blue.jpg",
    purple: "assets/themes/cosmic-spectrum-purple.jpg",
    gray: "assets/themes/cosmic-spectrum-gray.jpg",
    white: "assets/themes/cosmic-spectrum-white.jpg",
    gold: "assets/themes/cosmic-spectrum-gold.jpg",
    silver: "assets/themes/cosmic-spectrum-silver.jpg",
    rainbow: "assets/themes/cosmic-spectrum-rainbow.jpg"
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
  let isCleanedUp = false;
  let keywordList = [];
  let ttsQueue = [];
  let activeUtterance = null;
  let speechGeneration = 0;
  let watchdogTimer = null;
  let themeChangeTimer = null;
  const processedNodes = new WeakSet();

  function detectBrowserLocale() {
    let browserLocale = "";
    try {
      browserLocale = window.chrome?.i18n?.getMessage?.("@@ui_locale") || "";
    } catch (_) {}
    browserLocale = browserLocale || navigator.language || "en";
    const normalized = String(browserLocale).replaceAll("_", "-").toLowerCase();
    if (normalized.startsWith("zh")) return "zh-TW";
    if (normalized.startsWith("ja")) return "ja";
    return "en";
  }

  function getEffectiveLocale() {
    const requested = settings.uiLocale;
    return requested === "zh-TW" || requested === "ja" || requested === "en"
      ? requested
      : detectBrowserLocale();
  }

  function t(key, values = {}) {
    const locale = getEffectiveLocale();
    const template = UI_COPY[locale]?.[key] || UI_COPY.en[key] || key;
    return Object.entries(values).reduce(
      (message, [name, value]) => message.replaceAll(`{${name}}`, String(value)),
      template
    );
  }

  let documentObserver = null;
  let messageObserver = null;
  let panelResizeObserver = null;
  let currentItemsContainer = null;
  const pendingNodes = new Set();
  let microtaskScheduled = false;

  const panel = document.createElement("section");
  panel.id = "chatobs-control-panel";
  panel.setAttribute("aria-label", "Chat Observatory 控制中心");
  panel.innerHTML = `
      <header class="chatobs-panel-header">
      <div class="chatobs-brand">
        <span class="chatobs-brand-mark" aria-hidden="true"></span>
        <div>
          <strong>Chat Observatory</strong>
          <span id="chatobs-status-line" aria-live="polite"></span>
        </div>
      </div>
      <button class="chatobs-icon-button" id="chatobs-collapse-button" type="button" aria-label="收合控制面板" aria-expanded="true">
        <span aria-hidden="true"></span>
      </button>
    </header>

    <div id="chatobs-panel-body">
      <div class="chatobs-quick-switches">
        <div class="chatobs-language-switch" role="group" aria-label="介面語言">
          <button type="button" data-locale="zh-TW" aria-pressed="false">
            <span class="chatobs-language-flag" aria-hidden="true">🇹🇼</span><span>純正中文</span>
          </button>
          <button type="button" data-locale="ja" aria-pressed="false">
            <span class="chatobs-language-flag" aria-hidden="true">🇯🇵</span><span>日本語</span>
          </button>
          <button type="button" data-locale="en" aria-pressed="false">
            <span class="chatobs-language-flag" aria-hidden="true">🇺🇸</span><span>English</span>
          </button>
        </div>

        <label class="chatobs-theme-select-control">
          <span class="chatobs-theme-select-icon" aria-hidden="true">✦</span>
          <span class="chatobs-sr-only" data-i18n="themeGroup">介面畫風</span>
          <select id="chatobs-theme-select" aria-label="介面畫風">
            <option value="black" data-i18n="themeBlack">玄曜奇點</option>
            <option value="red" data-i18n="themeRed">赤曜超新星</option>
            <option value="orange" data-i18n="themeOrange">橙燼日冕</option>
            <option value="yellow" data-i18n="themeYellow">炫陽星暴</option>
            <option value="green" data-i18n="themeGreen">翠晶星雲</option>
            <option value="blue" data-i18n="themeBlue">蒼穹冰潮</option>
            <option value="purple" data-i18n="themePurple">紫宸雙星</option>
            <option value="gray" data-i18n="themeGray">銀蝕隕痕</option>
            <option value="white" data-i18n="themeWhite">霜華白矮</option>
            <option value="gold" data-i18n="themeGold">金鑄熔爐</option>
            <option value="silver" data-i18n="themeSilver">銀河星環</option>
            <option value="rainbow" data-i18n="themeRainbow">虹渦光譜</option>
          </select>
        </label>
      </div>

      <div class="chatobs-section">
        <div class="chatobs-section-title">
          <span data-i18n="displaySection">畫面</span>
          <small data-i18n="displayHint">適合第二螢幕與遠距監看</small>
        </div>

        <label class="chatobs-slider-row">
          <span><span data-i18n="textSize">文字</span> <output id="chatobs-font-value">28px</output></span>
          <input type="range" id="chatobs-font-slider" min="16" max="64" step="1">
        </label>

        <label class="chatobs-slider-row">
          <span><span data-i18n="panelTextSize">面板文字</span> <output id="chatobs-panel-font-value">20px</output></span>
          <input type="range" id="chatobs-panel-font-slider" min="14" max="24" step="1">
        </label>

        <label class="chatobs-slider-row" id="chatobs-avatar-row">
          <span><span data-i18n="avatarSize">頭像</span> <output id="chatobs-avatar-value">48px</output></span>
          <input type="range" id="chatobs-avatar-slider" min="24" max="88" step="1">
        </label>

        <div class="chatobs-toggle-grid">
          <label class="chatobs-toggle">
            <input type="checkbox" id="chatobs-hide-avatars">
            <span data-i18n="hideAvatars">隱藏頭像</span>
          </label>
          <label class="chatobs-toggle">
            <input type="checkbox" id="chatobs-hide-badges">
            <span data-i18n="hideBadges">隱藏徽章</span>
          </label>
        </div>

        <label class="chatobs-field">
          <span data-i18n="keywords">醒目關鍵字</span>
          <input type="text" id="chatobs-keywords-input" placeholder="以逗號分隔，例如：問題, 救命">
        </label>
      </div>

      <div class="chatobs-section" id="chatobs-tts-section">
        <div class="chatobs-section-title">
          <span data-i18n="speechSection">語音朗讀</span>
          <label class="chatobs-switch" title="開啟或關閉 TTS" data-i18n-title="ttsToggleTitle">
            <input type="checkbox" id="chatobs-tts-toggle">
            <span aria-hidden="true"></span>
          </label>
        </div>

        <div class="chatobs-two-columns">
          <label class="chatobs-field">
            <span data-i18n="voiceMode">語音模式</span>
            <select id="chatobs-voice-mode-select">
              <option value="auto" data-i18n="voiceAuto">自動配對語言</option>
              <option value="fixed" data-i18n="voiceFixed">固定選定語音</option>
            </select>
          </label>
          <label class="chatobs-field">
            <span><span data-i18n="voiceSelect">預設／固定語音</span> <small class="chatobs-privacy-tip" data-i18n="localOnly">（僅本機）</small></span>
            <select id="chatobs-voice-select">
              <option value="">正在尋找本機語音…</option>
            </select>
          </label>
        </div>
        <small class="chatobs-voice-hint" data-i18n="voiceHint">自動模式會依語言挑選推薦人聲；沒有公開評分，仍可切到固定語音逐一試聽。</small>

        <div class="chatobs-two-columns">
          <label class="chatobs-slider-row">
            <span><span data-i18n="rate">語速</span> <output id="chatobs-rate-value">1.05×</output></span>
            <input type="range" id="chatobs-rate-slider" min="0.7" max="1.6" step="0.05">
          </label>
          <label class="chatobs-slider-row">
            <span><span data-i18n="volume">音量</span> <output id="chatobs-volume-value">65%</output></span>
            <input type="range" id="chatobs-volume-slider" min="0" max="100" step="1">
          </label>
        </div>

        <div class="chatobs-toggle-grid">
          <label class="chatobs-toggle">
            <input type="checkbox" id="chatobs-read-time">
            <span data-i18n="readTime">朗讀時間</span>
          </label>
          <label class="chatobs-toggle">
            <input type="checkbox" id="chatobs-read-name">
            <span data-i18n="readName">朗讀名字</span>
          </label>
          <label class="chatobs-toggle">
            <input type="checkbox" id="chatobs-read-emoji">
            <span data-i18n="readEmoji">朗讀表情名稱</span>
          </label>
          <label class="chatobs-toggle">
            <input type="checkbox" id="chatobs-clean-urls">
            <span data-i18n="cleanUrls">網址改念「連結」</span>
          </label>
          <label class="chatobs-toggle">
            <input type="checkbox" id="chatobs-collapse-repeats">
            <span data-i18n="collapseRepeats">壓縮重複文字</span>
          </label>
        </div>

        <div class="chatobs-actions">
          <button type="button" id="chatobs-test-voice" data-i18n="testVoice">試聽</button>
          <button type="button" id="chatobs-skip-speech" data-i18n="skipSpeech">跳過</button>
          <button type="button" id="chatobs-clear-speech" class="chatobs-danger" data-i18n="clearSpeech">清空</button>
        </div>
      </div>
    </div>
  `;

  document.body.prepend(panel);
  document.body.classList.add("chatobs-active");
  document.documentElement.classList.add("chatobs-active");

  const ui = {
    body: document.getElementById("chatobs-panel-body"),
    collapseButton: document.getElementById("chatobs-collapse-button"),
    statusLine: document.getElementById("chatobs-status-line"),
    languageButtons: [...panel.querySelectorAll("[data-locale]")],
    themeSelect: document.getElementById("chatobs-theme-select"),
    fontSlider: document.getElementById("chatobs-font-slider"),
    fontValue: document.getElementById("chatobs-font-value"),
    panelFontSlider: document.getElementById("chatobs-panel-font-slider"),
    panelFontValue: document.getElementById("chatobs-panel-font-value"),
    avatarSlider: document.getElementById("chatobs-avatar-slider"),
    avatarValue: document.getElementById("chatobs-avatar-value"),
    avatarRow: document.getElementById("chatobs-avatar-row"),
    hideAvatars: document.getElementById("chatobs-hide-avatars"),
    hideBadges: document.getElementById("chatobs-hide-badges"),
    keywords: document.getElementById("chatobs-keywords-input"),
    ttsSection: document.getElementById("chatobs-tts-section"),
    ttsToggle: document.getElementById("chatobs-tts-toggle"),
    voiceModeSelect: document.getElementById("chatobs-voice-mode-select"),
    voiceSelect: document.getElementById("chatobs-voice-select"),
    rateSlider: document.getElementById("chatobs-rate-slider"),
    rateValue: document.getElementById("chatobs-rate-value"),
    volumeSlider: document.getElementById("chatobs-volume-slider"),
    volumeValue: document.getElementById("chatobs-volume-value"),
    readTime: document.getElementById("chatobs-read-time"),
    readName: document.getElementById("chatobs-read-name"),
    readEmoji: document.getElementById("chatobs-read-emoji"),
    cleanUrls: document.getElementById("chatobs-clean-urls"),
    collapseRepeats: document.getElementById("chatobs-collapse-repeats"),
    testVoice: document.getElementById("chatobs-test-voice"),
    skipSpeech: document.getElementById("chatobs-skip-speech"),
    clearSpeech: document.getElementById("chatobs-clear-speech")
  };

  function applyLocale() {
    const locale = getEffectiveLocale();
    panel.lang = locale;
    document.body.dataset.chatobsLocale = locale;
    panel.querySelectorAll("[data-i18n]").forEach((element) => {
      element.textContent = t(element.dataset.i18n);
    });
    panel.querySelectorAll("[data-i18n-title]").forEach((element) => {
      element.title = t(element.dataset.i18nTitle);
    });
    ui.keywords.placeholder = t("keywordPlaceholder");
    panel.querySelector(".chatobs-language-switch").setAttribute("aria-label", t("interfaceLanguage"));
    ui.themeSelect.setAttribute("aria-label", t("themeGroup"));
    ui.languageButtons.forEach((button) => {
      const selected = button.dataset.locale === locale;
      button.classList.toggle("is-active", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
  }

  function syncPanelOffset() {
    const panelHeader = panel.querySelector(".chatobs-panel-header");
    const nativeChatHeader = document.querySelector("yt-live-chat-header-renderer");
    const panelHeaderHeight = Math.ceil(panelHeader?.getBoundingClientRect().height || 0);
    const nativeChatHeaderHeight = Math.ceil(nativeChatHeader?.getBoundingClientRect().height || 0);
    document.documentElement.style.setProperty(
      "--chatobs-native-header-offset",
      `${nativeChatHeaderHeight}px`
    );
    document.documentElement.style.setProperty(
      "--chatobs-panel-offset",
      `${Math.max(84, panelHeaderHeight + 16)}px`
    );
  }

  syncPanelOffset();
  if (typeof ResizeObserver === "function") {
    panelResizeObserver = new ResizeObserver(syncPanelOffset);
    panelResizeObserver.observe(panel);
    const nativeChatHeader = document.querySelector("yt-live-chat-header-renderer");
    if (nativeChatHeader) panelResizeObserver.observe(nativeChatHeader);
  }
  window.addEventListener("resize", syncPanelOffset);

  function clampNumber(value, min, max, fallback) {
    if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
    return Math.min(max, Math.max(min, value));
  }

  function sanitizeSettings(value) {
    if (!value || typeof value !== "object") return { ...DEFAULT_SETTINGS };

    const sanitized = { ...DEFAULT_SETTINGS };

    if (typeof value.uiLocale === "string" && VALID_UI_LOCALES.includes(value.uiLocale)) {
      sanitized.uiLocale = value.uiLocale;
    }
    if (typeof value.theme === "string") {
      const migratedTheme = LEGACY_THEME_MAP[value.theme] || value.theme;
      if (VALID_THEMES.includes(migratedTheme)) {
        sanitized.theme = migratedTheme;
      }
    }

    const boolKeys = [
      "isCollapsed",
      "ttsEnabled",
      "ttsReadName",
      "ttsReadTime",
      "readEmoji",
      "cleanUrls",
      "collapseRepeats",
      "hideAvatars",
      "hideBadges"
    ];
    boolKeys.forEach((key) => {
      if (typeof value[key] === "boolean") {
        sanitized[key] = value[key];
      }
    });

    if (typeof value.ttsVoiceMode === "string" && VALID_VOICE_MODES.includes(value.ttsVoiceMode)) {
      sanitized.ttsVoiceMode = value.ttsVoiceMode;
    }
    if (typeof value.ttsVoiceURI === "string") {
      sanitized.ttsVoiceURI = value.ttsVoiceURI.slice(0, 512);
    }
    if (typeof value.highlightKeywords === "string") {
      sanitized.highlightKeywords = value.highlightKeywords;
    }

    sanitized.fontSize = clampNumber(value.fontSize, 16, 64, DEFAULT_SETTINGS.fontSize);
    sanitized.panelFontSize = clampNumber(value.panelFontSize, 14, 24, DEFAULT_SETTINGS.panelFontSize);
    sanitized.avatarSize = clampNumber(value.avatarSize, 24, 88, DEFAULT_SETTINGS.avatarSize);
    sanitized.ttsVolume = clampNumber(value.ttsVolume, 0, 100, DEFAULT_SETTINGS.ttsVolume);
    sanitized.ttsRate = clampNumber(value.ttsRate, 0.7, 1.6, DEFAULT_SETTINGS.ttsRate);
    sanitized.ttsPitch = clampNumber(value.ttsPitch, 0.5, 2.0, DEFAULT_SETTINGS.ttsPitch);
    sanitized.maxMessageLength = clampNumber(value.maxMessageLength, 30, 300, DEFAULT_SETTINGS.maxMessageLength);
    sanitized.queueLimit = clampNumber(value.queueLimit, 3, 50, DEFAULT_SETTINGS.queueLimit);
    sanitized.staleAfterSeconds = clampNumber(value.staleAfterSeconds, 5, 120, DEFAULT_SETTINGS.staleAfterSeconds);

    return sanitized;
  }

  function scheduleSave() {
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(async () => {
      saveTimer = null;
      if (isCleanedUp || !window.chrome?.storage?.local?.set) return;
      try {
        await chrome.storage.local.set({ ...settings });
      } catch {
        updateSpeechStatus(t("statusSaveFailed"));
      }
    }, 250);
  }

  function handleStorageChange(changes, areaName) {
    if (areaName !== "local" || isCleanedUp) return;

    const wasSpeaking = shouldSpeak();
    let hasChange = false;
    const nextSettings = { ...settings };

    for (const [key, change] of Object.entries(changes)) {
      if (Object.prototype.hasOwnProperty.call(DEFAULT_SETTINGS, key)) {
        if (change && "newValue" in change) {
          nextSettings[key] = change.newValue;
          hasChange = true;
        }
      }
    }

    if (hasChange) {
      settings = sanitizeSettings(nextSettings);
      applySettings({ save: false });
      populateVoices();
      if (wasSpeaking && !shouldSpeak()) {
        stopSpeech({ clearQueue: true });
      } else if (shouldSpeak()) {
        speakNext();
      }
    }
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
      message = message.replace(/https?:\/\/\S+|www\.\S+/gi, ` ${t("speechLink")} `);
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
      message = `${message.slice(0, settings.maxMessageLength)}，${t("speechTruncated")}`;
    }
    return message;
  }

  function getMessageData(node) {
    const tagName = node.tagName.toLowerCase();
    const timestampNode = node.querySelector("#timestamp");
    const timestamp = extractText(timestampNode);
    const authorNode = node.querySelector("#author-name");
    const author = extractText(authorNode) || t("speechViewer");

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

    let type = "general";

    if (tagName.includes("paid-message")) type = "superChat";
    if (tagName.includes("paid-sticker")) {
      type = "superSticker";
      const amount = extractText(node.querySelector("#purchase-amount"));
      message = message || `${t("speechStickerMessage")}${amount ? `，${amount}` : ""}`;
    }
    if (tagName.includes("membership-item")) {
      type = "membership";
      message = message || t("speechJoinedMembership");
    }
    if (tagName.includes("gift-purchase")) {
      type = "giftPurchase";
      message = message || extractText(node.querySelector("#primary-text")) || t("speechGiftedMembership");
    }
    if (tagName.includes("gift-redemption")) {
      type = "giftRedemption";
      message = message || t("speechReceivedMembership");
    }

    return { author, message, type, timestamp };
  }

  function applyHighlight(node, message) {
    const normalized = message.toLocaleLowerCase();
    const highlighted = keywordList.some((keyword) => normalized.includes(keyword));
    node.classList.toggle("chatobs-highlighted", highlighted);
  }

  function shouldSpeak() {
    return settings.ttsEnabled;
  }

  function getLocalVoices() {
    if (!window.speechSynthesis || typeof window.speechSynthesis.getVoices !== "function") {
      return [];
    }
    const voices = window.speechSynthesis.getVoices() || [];
    return voices.filter((voice) => voice && voice.localService === true);
  }

  function getSelectedVoice() {
    const localVoices = getLocalVoices();
    if (!settings.ttsVoiceURI) return null;
    return localVoices.find((voice) => voice.voiceURI === settings.ttsVoiceURI) || null;
  }

  function normalizeVoiceLang(value) {
    return String(value || "").toLowerCase().replaceAll("_", "-");
  }

  function voiceQualityScore(voice, langTag = "") {
    const name = String(voice?.name || "");
    const lowerName = name.toLocaleLowerCase();
    const voiceLang = normalizeVoiceLang(voice?.lang);
    let score = 0;

    if (voice?.default) score += 350;
    if (/premium|enhanced|natural|neural|高品質|進階|優質/iu.test(name)) score += 300;
    if (!/[()（）]/u.test(name)) score += 40;
    if (/compact/iu.test(name)) score -= 240;
    if (/eddy|flo|grandma|grandpa|reed|rocko|sandy|shelley|bahh|bells|boing|bubbles|cellos|jester|organ|trinoids|whisper|wobble|zarvox/iu.test(lowerName)) {
      score -= 260;
    }

    const standardVoiceNames = {
      ja: /siri|kyoko|otoya|響|京子/iu,
      ko: /yuna|유나/iu,
      zh: /美佳|mei[- ]?jia|meijia|sin[- ]?ji|ting[- ]?ting|tingting/iu,
      en: /siri|samantha|serena|alex|ava|daniel|karen|moira|tessa|rishi/iu,
      es: /siri|marisol|jorge|mónica|monica|paulina/iu,
      fr: /amélie|amelie|jacques/iu,
      de: /anna/iu,
      it: /alice/iu,
      pt: /luciana/iu,
      ru: /milena|yuri/iu,
      ar: /majed/iu
    };
    const baseLang = langTag === "cyrl" ? "ru" : String(langTag || voiceLang).split("-")[0];
    if (standardVoiceNames[baseLang]?.test(name)) score += 220;

    if (langTag === "zh" && /^zh-(tw|hant)/iu.test(voiceLang)) score += 160;
    if (langTag && voiceLang === normalizeVoiceLang(langTag)) score += 80;

    return score;
  }

  function pickRecommendedVoice(voices, langTag = "") {
    if (!Array.isArray(voices) || voices.length === 0) return null;
    return [...voices].sort((left, right) => {
      const scoreDifference = voiceQualityScore(right, langTag) - voiceQualityScore(left, langTag);
      if (scoreDifference !== 0) return scoreDifference;
      return String(left.name || "").localeCompare(String(right.name || ""));
    })[0] || null;
  }

  function getFallbackVoice(localVoices = getLocalVoices()) {
    const selectedVoice = localVoices.find((voice) => voice.voiceURI === settings.ttsVoiceURI);
    return selectedVoice ||
      pickRecommendedVoice(localVoices.filter((voice) => /^zh-(TW|Hant)/i.test(voice.lang)), "zh") ||
      pickRecommendedVoice(localVoices.filter((voice) => /^zh/i.test(voice.lang)), "zh") ||
      pickRecommendedVoice(localVoices) || null;
  }

  function getUsableVoice(localVoices = getLocalVoices()) {
    return settings.ttsVoiceMode === "fixed"
      ? getSelectedVoice()
      : getFallbackVoice(localVoices);
  }

  function detectLanguageTag(text) {
    if (!text || typeof text !== "string") return null;

    const clean = text
      .replace(/https?:\/\/\S+|www\.\S+/giu, "")
      .replace(/[\s\d\p{P}\p{S}\p{Extended_Pictographic}]/gu, "");
    if (clean.length === 0) return null;

    const kanaMatches = clean.match(/[\p{Script=Hiragana}\p{Script=Katakana}]/gu);
    const kanaCount = kanaMatches ? kanaMatches.length : 0;

    const hangulMatches = clean.match(/\p{Script=Hangul}/gu);
    const hangulCount = hangulMatches ? hangulMatches.length : 0;

    const hanMatches = clean.match(/\p{Script=Han}/gu);
    const hanCount = hanMatches ? hanMatches.length : 0;

    const arabicMatches = clean.match(/\p{Script=Arabic}/gu);
    const arabicCount = arabicMatches ? arabicMatches.length : 0;

    const hebrewMatches = clean.match(/\p{Script=Hebrew}/gu);
    const hebrewCount = hebrewMatches ? hebrewMatches.length : 0;

    const greekMatches = clean.match(/\p{Script=Greek}/gu);
    const greekCount = greekMatches ? greekMatches.length : 0;

    const thaiMatches = clean.match(/\p{Script=Thai}/gu);
    const thaiCount = thaiMatches ? thaiMatches.length : 0;

    const devanagariMatches = clean.match(/\p{Script=Devanagari}/gu);
    const devanagariCount = devanagariMatches ? devanagariMatches.length : 0;

    const cyrillicMatches = clean.match(/\p{Script=Cyrillic}/gu);
    const cyrillicCount = cyrillicMatches ? cyrillicMatches.length : 0;

    const latinMatches = clean.match(/\p{Script=Latin}/gu);
    const latinCount = latinMatches ? latinMatches.length : 0;

    if (kanaCount > 0) return "ja";

    if (latinCount > 0) {
      const lowerText = text.toLocaleLowerCase();
      const tokens = lowerText.match(/\p{Script=Latin}+/gu) || [];
      const hints = {
        es: ["hola", "gracias", "buenas", "amigo", "amiga", "para", "porque", "como", "usted"],
        fr: ["bonjour", "merci", "salut", "avec", "pour", "vous", "nous", "très", "être"],
        de: ["hallo", "danke", "bitte", "nicht", "guten", "ich", "du", "und", "für"],
        pt: ["olá", "obrigado", "obrigada", "você", "vocês", "não", "para", "bom", "boa"],
        it: ["ciao", "grazie", "buongiorno", "buonasera", "per", "che", "non", "come"],
        id: ["halo", "terima", "kasih", "yang", "untuk", "tidak", "apa", "dan"],
        tr: ["merhaba", "teşekkür", "için", "değil", "nasıl", "bir", "ve"],
        vi: ["xin", "chào", "cảm", "ơn", "không", "bạn", "và", "cho"]
      };
      const distinctivePatterns = [
        ["vi", /[ăâđêôơưàảãạằắẳẵặầấẩẫậèẻẽẹềếểễệìỉĩịòỏõọồốổỗộờớởỡợùủũụừứửữựỳỷỹỵ]/iu],
        ["tr", /[ğış]/iu],
        ["pt", /[ãõ]/iu],
        ["de", /ß/u],
        ["es", /[¿¡ñ]/iu],
        ["fr", /[œç]/iu]
      ];
      const distinctive = distinctivePatterns.find(([, pattern]) => pattern.test(lowerText));
      if (distinctive) return distinctive[0];

      const scored = Object.entries(hints)
        .map(([tag, words]) => ({ tag, count: tokens.filter((token) => words.includes(token)).length }))
        .sort((left, right) => right.count - left.count);
      if (scored[0]?.count >= 2 && scored[0].count > (scored[1]?.count || 0)) return scored[0].tag;
      if (tokens.length === 1) {
        const greeting = scored.find(({ count }) => count === 1);
        if (greeting) return greeting.tag;
      }
    }

    const counts = [
      { tag: "ko", count: hangulCount },
      { tag: "zh", count: hanCount },
      { tag: "ar", count: arabicCount },
      { tag: "he", count: hebrewCount },
      { tag: "el", count: greekCount },
      { tag: "th", count: thaiCount },
      { tag: "deva", count: devanagariCount },
      { tag: "cyrl", count: cyrillicCount },
      { tag: "en", count: latinCount }
    ];

    counts.sort((a, b) => b.count - a.count);

    const top = counts[0];
    const runnerUp = counts[1];
    if (!top || top.count === 0) return null;
    if (runnerUp && runnerUp.count > 0 && top.count / runnerUp.count < 1.5) return null;
    return top.tag;
  }

  function isVoiceMatchLang(voice, langTag) {
    if (!voice || !voice.lang) return false;
    const vlang = voice.lang.toLowerCase();
    switch (langTag) {
      case "zh":
        return vlang.startsWith("zh");
      case "ja":
        return vlang.startsWith("ja");
      case "ko":
        return vlang.startsWith("ko");
      case "en":
        return vlang.startsWith("en");
      case "ar":
        return vlang.startsWith("ar");
      case "he":
        return vlang.startsWith("he");
      case "el":
        return vlang.startsWith("el");
      case "th":
        return vlang.startsWith("th");
      case "deva":
        return /^(hi|mr|ne)/i.test(vlang);
      case "cyrl":
        return /^(ru|uk|bg|be|sr|mk|ky)/i.test(vlang);
      default:
        return vlang === langTag || vlang.startsWith(`${langTag}-`);
    }
  }

  function findLocalVoiceForLang(localVoices, langTag) {
    if (!Array.isArray(localVoices) || localVoices.length === 0) return null;
    const matchingVoices = localVoices.filter((voice) => isVoiceMatchLang(voice, langTag));
    return pickRecommendedVoice(matchingVoices, langTag);
  }

  function resolveVoiceForText(text, currentSettings, localVoices) {
    const selectedVoice = getSelectedVoice();
    const fallbackVoice = getFallbackVoice(localVoices);
    if (currentSettings.ttsVoiceMode !== "auto") {
      return selectedVoice;
    }

    const langTag = detectLanguageTag(text);
    if (!langTag) {
      return fallbackVoice;
    }

    if (selectedVoice && isVoiceMatchLang(selectedVoice, langTag)) {
      return selectedVoice;
    }

    const matched = findLocalVoiceForLang(localVoices, langTag);
    return matched || fallbackVoice;
  }

  function getVoicePreviewText(voice) {
    const lang = String(voice?.lang || "").toLowerCase().split("-")[0];
    const samples = {
      ar: "مرحبًا، القراءة الصوتية جاهزة.",
      de: "Hallo, die Sprachausgabe ist bereit.",
      en: "Hello, voice reading is ready.",
      es: "Hola, la lectura por voz está lista.",
      fr: "Bonjour, la lecture vocale est prête.",
      he: "שלום, ההקראה הקולית מוכנה.",
      hi: "नमस्ते, वॉइस रीडिंग तैयार है।",
      it: "Ciao, la lettura vocale è pronta.",
      ja: "こんにちは。音声読み上げの準備ができました。",
      ko: "안녕하세요. 음성 읽기가 준비되었습니다.",
      pt: "Olá, a leitura por voz está pronta.",
      ru: "Здравствуйте, голосовое чтение готово.",
      th: "สวัสดี ระบบอ่านออกเสียงพร้อมแล้ว",
      tr: "Merhaba, sesli okuma hazır.",
      vi: "Xin chào, tính năng đọc bằng giọng nói đã sẵn sàng.",
      zh: "語音朗讀已開啟。"
    };
    return samples[lang] || "Voice reading is ready.";
  }

  function updateSpeechStatus(message = "") {
    const queueText = ttsQueue.length ? t("queueWaiting", { count: ttsQueue.length }) : "";
    let state = t("statusOff");
    if (shouldSpeak() && activeUtterance) {
      state = t("statusSpeaking");
    } else if (shouldSpeak() && !getUsableVoice()) {
      state = settings.ttsVoiceMode === "fixed"
        ? t("statusFixedUnavailable")
        : t("statusAutoWaiting");
    } else if (shouldSpeak()) {
      state = settings.ttsVoiceMode === "auto" ? t("statusAutoOn") : t("statusFixedOn");
    }
    ui.statusLine.textContent = message || `${state}${queueText}`;
  }

  function clearWatchdog() {
    if (watchdogTimer) {
      window.clearTimeout(watchdogTimer);
      watchdogTimer = null;
    }
  }

  function finishUtterance(generation) {
    if (generation !== speechGeneration || isCleanedUp) return;
    clearWatchdog();
    activeUtterance = null;
    updateSpeechStatus();
    speakNext();
  }

  function safeSpeak(utterance, generation) {
    try {
      clearWatchdog();
      const textLen = (utterance.text || "").length;
      const rate = utterance.rate || 1;
      const timeoutMs = Math.min(180000, Math.max(10000, Math.round((textLen * 400) / rate + 5000)));

      watchdogTimer = window.setTimeout(() => {
        if (generation === speechGeneration) {
          try {
            window.speechSynthesis.cancel();
          } catch (_) {}
          finishUtterance(generation);
        }
      }, timeoutMs);

      window.speechSynthesis.speak(utterance);
    } catch {
      finishUtterance(generation);
    }
  }

  function startUtterance(utterance, statusMessage = "") {
    const generation = ++speechGeneration;
    activeUtterance = utterance;
    utterance.onend = () => finishUtterance(generation);
    utterance.onerror = () => finishUtterance(generation);
    updateSpeechStatus(statusMessage);
    safeSpeak(utterance, generation);
  }

  function speakNext() {
    if (activeUtterance || !shouldSpeak()) {
      updateSpeechStatus();
      return;
    }

    const staleBefore = Date.now() - settings.staleAfterSeconds * 1000;
    while (ttsQueue.length && ttsQueue[0].queuedAt < staleBefore) ttsQueue.shift();

    const localVoices = getLocalVoices();
    const usableVoice = getUsableVoice(localVoices);
    if (!usableVoice) {
      updateSpeechStatus(settings.ttsVoiceMode === "fixed"
        ? t("statusFixedUnavailable")
        : t("statusAutoWaiting"));
      return;
    }

    const next = ttsQueue.shift();
    if (!next) {
      updateSpeechStatus();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(next.text);
    const voiceToUse = resolveVoiceForText(next.languageText, settings, localVoices) || usableVoice;

    utterance.voice = voiceToUse;
    utterance.lang = voiceToUse.lang;

    utterance.volume = settings.ttsVolume / 100;
    utterance.rate = settings.ttsRate;
    utterance.pitch = settings.ttsPitch;

    startUtterance(utterance);
  }

  function stopSpeech({ clearQueue = false, continueQueue = false } = {}) {
    clearWatchdog();
    speechGeneration += 1;
    activeUtterance = null;
    if (clearQueue) ttsQueue = [];
    try {
      window.speechSynthesis.cancel();
    } catch (_) {}
    updateSpeechStatus(clearQueue ? t("statusQueueCleared") : t("statusSkipped"));
    if (continueQueue && shouldSpeak()) window.queueMicrotask(speakNext);
  }

  function queueSpeech(author, rawMessage, type, timestamp) {
    if (!shouldSpeak()) return;
    const message = normalizeForSpeech(rawMessage);
    if (!message) return;

    const speechTypeKeys = {
      superChat: "speechSuperChat",
      superSticker: "speechSuperSticker",
      membership: "speechMembership",
      giftPurchase: "speechGiftPurchase",
      giftRedemption: "speechGiftRedemption"
    };
    const prefix = type === "general"
      ? ""
      : t("speechSeparator", { label: t(speechTypeKeys[type]) });
    const timeText = (settings.ttsReadTime && timestamp) ? `${timestamp}，` : "";
    const nameText = settings.ttsReadName ? t("speechNameSuffix", { author }) : "";
    const text = `${prefix}${timeText}${nameText}${message}`;

    while (ttsQueue.length >= settings.queueLimit) ttsQueue.shift();
    ttsQueue.push({ text, languageText: rawMessage, queuedAt: Date.now() });
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
      authorNode.style.setProperty("--chatobs-author-color", stringToColor(data.author));
      authorNode.classList.add("chatobs-colored-author");
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

  function processPendingNodes() {
    if (isCleanedUp) return;
    const nodesToProcess = Array.from(pendingNodes);
    pendingNodes.clear();
    microtaskScheduled = false;

    for (const node of nodesToProcess) {
      processRenderer(node);
    }
  }

  function scheduleNodeProcessing(renderers) {
    for (const renderer of renderers) {
      if (!processedNodes.has(renderer)) {
        pendingNodes.add(renderer);
      }
    }

    if (pendingNodes.size > 0 && !microtaskScheduled) {
      microtaskScheduled = true;
      window.queueMicrotask(processPendingNodes);
    }
  }

  function refreshVisibleMessages() {
    document.querySelectorAll(RENDERER_SELECTOR).forEach((node) => {
      const data = getMessageData(node);
      if (data.message) applyHighlight(node, data.message);
    });
  }

  function populateVoices() {
    const localVoices = getLocalVoices();
    const currentValue = settings.ttsVoiceURI;
    ui.voiceSelect.replaceChildren();

    const recommendedUris = new Set();
    const languageGroups = new Map();
    localVoices.forEach((voice) => {
      const baseLang = normalizeVoiceLang(voice.lang).split("-")[0] || "und";
      if (!languageGroups.has(baseLang)) languageGroups.set(baseLang, []);
      languageGroups.get(baseLang).push(voice);
    });
    languageGroups.forEach((voices, baseLang) => {
      const recommended = pickRecommendedVoice(voices, baseLang);
      if (recommended) recommendedUris.add(recommended.voiceURI);
    });

    localVoices
      .sort((left, right) => {
        const languageDifference = normalizeVoiceLang(left.lang).localeCompare(normalizeVoiceLang(right.lang));
        if (languageDifference !== 0) return languageDifference;
        const recommendationDifference = Number(recommendedUris.has(right.voiceURI)) - Number(recommendedUris.has(left.voiceURI));
        return recommendationDifference || left.name.localeCompare(right.name);
      })
      .forEach((voice) => {
        const recommendation = recommendedUris.has(voice.voiceURI) ? t("recommended") : "";
        const label = `${voice.name} · ${voice.lang}${recommendation}`;
        ui.voiceSelect.add(new Option(label, voice.voiceURI));
      });

    const currentVoice = localVoices.find((voice) => voice.voiceURI === currentValue);
    const preferredVoice = currentVoice || getFallbackVoice(localVoices);

    if (settings.ttsVoiceMode === "fixed" && settings.ttsVoiceURI && !currentVoice) {
      const missing = new Option(t("voiceMissing"), "");
      missing.disabled = true;
      ui.voiceSelect.add(missing, 0);
      ui.voiceSelect.disabled = false;
      ui.voiceSelect.value = "";
    } else if (preferredVoice) {
      ui.voiceSelect.disabled = false;
      ui.voiceSelect.value = preferredVoice.voiceURI;
    } else {
      const unavailable = new Option(t("voiceUnavailable"), "");
      unavailable.disabled = true;
      ui.voiceSelect.add(unavailable);
      ui.voiceSelect.disabled = true;
    }

    if (shouldSpeak() && !activeUtterance) speakNext();
  }

  function syncControls() {
    ui.themeSelect.value = settings.theme;

    ui.fontSlider.value = settings.fontSize;
    ui.fontValue.value = `${settings.fontSize}px`;
    ui.panelFontSlider.value = settings.panelFontSize;
    ui.panelFontValue.value = `${settings.panelFontSize}px`;
    ui.avatarSlider.value = settings.avatarSize;
    ui.avatarValue.value = `${settings.avatarSize}px`;
    ui.hideAvatars.checked = settings.hideAvatars;
    ui.hideBadges.checked = settings.hideBadges;
    ui.keywords.value = settings.highlightKeywords;
    ui.ttsToggle.checked = settings.ttsEnabled;
    ui.voiceModeSelect.value = settings.ttsVoiceMode;
    const savedVoiceIsVisible = [...ui.voiceSelect.options]
      .some((option) => option.value === settings.ttsVoiceURI && option.value !== "");
    if (savedVoiceIsVisible) {
      ui.voiceSelect.value = settings.ttsVoiceURI;
    } else if (settings.ttsVoiceMode === "fixed") {
      ui.voiceSelect.value = "";
    }
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
    rootStyle.setProperty("--chatobs-font-size", `${settings.fontSize}px`);
    rootStyle.setProperty("--chatobs-avatar-size", `${settings.avatarSize}px`);
    rootStyle.setProperty("--chatobs-line-height", `${Math.round(settings.fontSize * 1.38)}px`);
    rootStyle.setProperty("--chatobs-panel-body-size", `${settings.panelFontSize}px`);
    rootStyle.setProperty("--chatobs-panel-heading-size", `${Math.round(settings.panelFontSize * 1.05)}px`);
    rootStyle.setProperty("--chatobs-panel-title-size", `${Math.round(settings.panelFontSize * 1.1)}px`);
    rootStyle.setProperty("--chatobs-panel-control-size", `${Math.round(settings.panelFontSize * 0.9)}px`);
    rootStyle.setProperty("--chatobs-panel-caption-size", `${Math.max(12, Math.round(settings.panelFontSize * 0.7))}px`);

    const themeImagePath = THEME_IMAGE_PATHS[settings.theme] || THEME_IMAGE_PATHS.black;
    let themeImageUrl = themeImagePath;
    try {
      if (typeof window.chrome?.runtime?.getURL === "function") {
        themeImageUrl = window.chrome.runtime.getURL(themeImagePath);
      }
    } catch {
      // 一般網頁視覺 fixture 沒有 extension runtime，保留相對路徑作為離線預覽備援。
    }
    document.body.style.setProperty("--chatobs-panel-image", `url("${themeImageUrl}")`);

    document.body.classList.toggle("chatobs-hide-avatars", settings.hideAvatars);
    document.body.classList.toggle("chatobs-hide-badges", settings.hideBadges);
    document.body.dataset.chatobsTheme = settings.theme;
    document.documentElement.dataset.chatobsTheme = settings.theme;
    ui.avatarRow.hidden = settings.hideAvatars;

    ui.body.hidden = settings.isCollapsed;
    ui.collapseButton.setAttribute("aria-expanded", String(!settings.isCollapsed));
    ui.collapseButton.setAttribute(
      "aria-label",
      settings.isCollapsed ? t("expandPanel") : t("collapsePanel")
    );
    applyLocale();
    refreshKeywords();
    syncControls();
    updateSpeechStatus();
    syncPanelOffset();
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

  ui.languageButtons.forEach((button) => {
    button.addEventListener("click", () => {
      settings.uiLocale = button.dataset.locale;
      applySettings();
    });
  });

  ui.themeSelect.addEventListener("change", () => {
    settings.theme = ui.themeSelect.value;
    applySettings();
    const themeControl = ui.themeSelect.closest(".chatobs-theme-select-control");
    if (themeControl) {
      window.clearTimeout(themeChangeTimer);
      themeChangeTimer = null;
      themeControl.classList.remove("is-changing");
      void themeControl.offsetWidth;
      themeControl.classList.add("is-changing");
      themeChangeTimer = window.setTimeout(() => {
        themeControl.classList.remove("is-changing");
        themeChangeTimer = null;
      }, 650);
    }
  });

  bindRange(ui.fontSlider, ui.fontValue, "fontSize", (value) => `${value}px`);
  bindRange(ui.panelFontSlider, ui.panelFontValue, "panelFontSize", (value) => `${value}px`);
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
      const voice = getUsableVoice();
      if (!voice) {
        applySettings();
        updateSpeechStatus(t("statusWaitingVoice"));
        return;
      }
      const confirmation = new SpeechSynthesisUtterance(getVoicePreviewText(voice));
      confirmation.voice = voice;
      confirmation.lang = voice.lang;
      confirmation.volume = settings.ttsVolume / 100;
      confirmation.rate = settings.ttsRate;
      startUtterance(confirmation, t("statusEnabled"));
    }
    applySettings();
  });

  ui.voiceModeSelect.addEventListener("change", () => {
    settings.ttsVoiceMode = ui.voiceModeSelect.value;
    if (settings.ttsVoiceMode === "fixed" && !getSelectedVoice()) {
      const visibleVoice = getLocalVoices().find((voice) => voice.voiceURI === ui.voiceSelect.value);
      if (visibleVoice) settings.ttsVoiceURI = visibleVoice.voiceURI;
    }
    applySettings();
    populateVoices();
    if (shouldSpeak()) speakNext();
  });

  ui.voiceSelect.addEventListener("change", () => {
    settings.ttsVoiceURI = ui.voiceSelect.value;
    applySettings();
  });

  ui.testVoice.addEventListener("click", () => {
    const localVoices = getLocalVoices();
    const voice = localVoices.find((candidate) => candidate.voiceURI === ui.voiceSelect.value) ||
      getUsableVoice(localVoices);
    if (!voice) {
      updateSpeechStatus(t("statusNoVoice"));
      return;
    }
    stopSpeech({ clearQueue: false, continueQueue: false });
    const test = new SpeechSynthesisUtterance(getVoicePreviewText(voice));
    test.voice = voice;
    test.lang = voice.lang;
    test.volume = settings.ttsVolume / 100;
    test.rate = settings.ttsRate;
    test.pitch = settings.ttsPitch;

    startUtterance(test, t("statusTest"));
  });

  ui.skipSpeech.addEventListener("click", () => {
    stopSpeech({ continueQueue: true });
  });

  ui.clearSpeech.addEventListener("click", () => {
    stopSpeech({ clearQueue: true });
  });

  function setupMessageObserver(itemsContainer) {
    if (currentItemsContainer === itemsContainer && messageObserver) return;

    if (messageObserver) {
      messageObserver.disconnect();
      messageObserver = null;
    }

    currentItemsContainer = itemsContainer;
    if (!itemsContainer) return;

    itemsContainer.querySelectorAll(RENDERER_SELECTOR).forEach((node) => {
      processRenderer(node, { speak: false });
    });

    messageObserver = new MutationObserver((mutations) => {
      const renderersToSchedule = [];
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          collectRenderers(node).forEach((renderer) => renderersToSchedule.push(renderer));
        });
      });
      if (renderersToSchedule.length > 0) {
        scheduleNodeProcessing(renderersToSchedule);
      }
    });

    messageObserver.observe(itemsContainer, { childList: true, subtree: true });
  }

  function startDiscoveryObserver() {
    const checkItems = () => {
      const itemsContainer = document.querySelector("#items.yt-live-chat-item-list-renderer");
      if (itemsContainer !== currentItemsContainer) {
        setupMessageObserver(itemsContainer);
      }
    };

    checkItems();

    documentObserver = new MutationObserver(() => {
      if (currentItemsContainer?.isConnected) return;
      checkItems();
    });

    if (document.documentElement || document.body) {
      documentObserver.observe(document.documentElement || document.body, {
        childList: true,
        subtree: true
      });
    }
  }

  function cleanup() {
    if (isCleanedUp) return;
    isCleanedUp = true;
    window.clearTimeout(saveTimer);
    saveTimer = null;
    window.clearTimeout(themeChangeTimer);
    themeChangeTimer = null;
    clearWatchdog();

    if (documentObserver) {
      documentObserver.disconnect();
      documentObserver = null;
    }
    if (messageObserver) {
      messageObserver.disconnect();
      messageObserver = null;
    }
    if (panelResizeObserver) {
      panelResizeObserver.disconnect();
      panelResizeObserver = null;
    }
    currentItemsContainer = null;

    if (window.chrome?.storage?.onChanged?.removeListener) {
      try {
        chrome.storage.onChanged.removeListener(handleStorageChange);
      } catch (_) {}
    }

    window.speechSynthesis?.removeEventListener("voiceschanged", populateVoices);
    window.removeEventListener("resize", syncPanelOffset);
    window.removeEventListener("pagehide", cleanup);
    window.removeEventListener("unload", cleanup);

    try {
      window.speechSynthesis?.cancel();
    } catch (_) {}

    ttsQueue = [];
    activeUtterance = null;
    pendingNodes.clear();
  }

  async function initialize() {
    let stored = DEFAULT_SETTINGS;
    try {
      stored = await chrome.storage.local.get(DEFAULT_SETTINGS);
    } catch {
      updateSpeechStatus(t("statusLoadFailed"));
    }
    if (isCleanedUp) return;
    settings = sanitizeSettings(stored);
    applySettings({ save: false });
    populateVoices();
    startDiscoveryObserver();
  }

  if (window.chrome?.storage?.onChanged?.addListener) {
    chrome.storage.onChanged.addListener(handleStorageChange);
  }

  window.speechSynthesis?.addEventListener("voiceschanged", populateVoices);
  window.addEventListener("pagehide", cleanup);
  window.addEventListener("unload", cleanup);
  void initialize();
})();
