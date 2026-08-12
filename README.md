# YT Chat Enlarger

YT Chat Enlarger 是一個純本機的 Chrome 擴充功能，適合把另一台電腦或第二螢幕當作 YouTube 直播聊天室監看器。

## 核心功能

- 從 YouTube 直播頁或 YouTube Studio 一鍵開啟獨立聊天室。
- 放大留言、作者名稱與頭像，適合遠距離閱讀。
- 完整、監看、朗讀三種模式。
- 熔岩、極光、紙墨三套可即時切換並保存在本機的介面畫風。
- 只使用瀏覽器明確標示為本機的語音朗讀留言；找不到本機語音時不會退回線上服務。
- 可選本機聲音、語速、音量，以及是否朗讀名字與時間。
- 清理網址、過長內容與重複文字，降低機械朗讀干擾。
- 支援一般留言、Super Chat、Super Sticker 與會員訊息。
- 隱藏頭像、徽章及醒目標示關鍵字。
- 設定只儲存在本機，不需要帳號或外部伺服器。

## 使用方式

1. 在 Chrome 的擴充功能頁面載入此資料夾。
2. 在 YouTube 開啟直播觀看頁或直播控制台。
3. 點擊工具列上的 YT Chat Enlarger 圖示。
4. 在彈出的聊天室選擇模式並調整顯示或朗讀設定。
5. 設定完成後可收合控制面板，保留乾淨的大字聊天室。

## 三種模式

- `完整`：顯示大字聊天室，並依 TTS 開關朗讀留言。
- `監看`：只顯示聊天室，不進行語音朗讀。
- `朗讀`：隱藏聊天室內容，保留簡潔的朗讀狀態畫面。

## 三套畫風

- `熔岩`：暖黑石墨底搭配珊瑚重點色，適合一般直播環境。
- `極光`：深海藍黑搭配青綠重點色，呈現清晰的科技感。
- `紙墨`：暖白紙張搭配深色墨字，適合白天或明亮房間。

畫風與其他設定一樣只保存在本機，並會同步至同一擴充功能開啟的其他聊天室視窗。

## 隱私

本擴充功能不建立帳號、不使用外部後端，也不收集或傳送聊天室內容。詳細內容請參閱 [PRIVACY.md](PRIVACY.md)。

## 開發驗證

```powershell
npm ci
npm run verify
npm run build:extension
```

`npm run build:extension` 會重建 `dist/yt-chat-enlarger/` 與 ZIP，並核對來源雜湊及封裝清單。`node_modules`、測試檔案、MissionCenter 與開發文件不會放入商店套件。

建置套件可在 PowerShell 7 執行。商店截圖工具會自動尋找 Windows、macOS 或 Linux 的 Chrome，也可傳入 `-ChromePath`；圖示縮放目前使用 Windows 的 `System.Drawing`，因此只支援 Windows，其他平台請保留已驗證的 `icons/icon-*.png`。

## 資料夾用途

- `icons/`：擴充功能圖示與可重新產生圖示的 SVG 來源。
- `scripts/`：圖示、商店截圖與發布套件的產生工具。
- `store-assets/`：Chrome Web Store 使用的正式截圖，需保留。
- `tests/`：背景服務、內容腳本與視覺 fixture。
- `dist/`：可重建的發布產物，不應直接手動修改。
- `MissionCenter/`：專案決策、任務與驗證紀錄。
- `output/`：Mission Center HUD 產物；不會打包進擴充功能。一次性的 UI 截圖不留在專案內。
