# 冒煙測試

| 日期 | 對應任務 ID | 測試內容 | 測試方式 | 預期結果 | 實際結果 | 通過 / 失敗 | 類型 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-07-17 | YTCE-R1 | 競品研究與產品範圍核准 | 檢查對話中的競品比較與使用者批准 | 明確選定純本機第二電腦大字監看＋TTS | 使用者回覆 OK 並指定簡潔、高雅、方便 | 通過 | manual |
| 2026-07-17 | YTCE-S2 | 桌面與窄視窗介面渲染 | Chrome headless 載入 tests/visual-fixture.html 並輸出兩張截圖 | 控制面板層次清楚、遠距聊天室高對比、窄視窗可操作與收合 | 桌面版比例與閱讀性良好；430px 寬度可操作，設定區以捲動呈現 | 通過 | automated |
| 2026-07-17 | YTCE-S1 | 語法、文字清理與 TTS 佇列 | npm run verify | JS 語法正確，網址與重複字清理、佇列限制測試通過 | 9 項測試全部通過，包含佇列上限與保留最新訊息 | 通過 | automated |
| 2026-07-17 | YTCE-S3 | 巢狀留言與特殊訊息 | jsdom 模擬巢狀一般留言與 Super Sticker | 新留言可被辨識並建立正確朗讀文字 | 一般留言、監看靜音與 Super Sticker 測試通過 | 通過 | automated |
| 2026-07-17 | YTCE-S4 | 啟動網址、錯誤提示與最小權限 | 背景服務測試＋解析 manifest.json | watch、live、Studio 可開聊天室；無效頁顯示錯誤；僅保留必要權限 | 3 項背景測試通過；manifest 僅 activeTab、storage | 通過 | automated |
| 2026-07-17 | YTCE-P1 | 圖示、商店截圖與 ZIP 內容 | 產生各尺寸 PNG、1280×800 截圖並檢查 ZIP entries | 尺寸正確且 ZIP 不含開發檔 | 圖示與兩張截圖目視正常；ZIP 僅含執行檔與 PNG | 通過 | automated |
| 2026-07-17 | YTCE-M1 | 真實 YouTube headless 嘗試 | Chrome 150 載入未封裝擴充功能並開啟 live_chat URL | YouTube 顯示聊天室並注入控制面板 | YouTube 對 headless 回傳「請更新瀏覽器」降級頁，無法驗證聊天室注入 | 失敗 | automated |
| 2026-08-12 | YTCE-H1 | 語法、核心行為與朗讀時間回歸 | `npm run verify` | 背景與內容腳本語法正確，所有測試通過 | 10 項測試全部通過，包含新增的朗讀時間案例 | 通過 | automated |
| 2026-08-12 | YTCE-H1 | 發布套件同步與白名單 | `npm run build:extension`、`unzip -Z1`、逐檔 `cmp` | ZIP 僅含 4 個執行檔與 4 個 PNG，staging 與來源一致 | 8 個允許檔案全數存在，無額外檔案，8/8 來源比對一致 | 通過 | automated |
| 2026-08-12 | YTCE-H2 | URL、MV3 視窗與發布安全邊界 | `npm run verify`、PowerShell parser、輸出路徑／symlink smoke | 僅正式 HTTPS YouTube URL；session 可跨 SW；錯誤不造成 unhandled；刪除不越界 | 背景 16 項案例通過，包含連點序列化、foreign popup、bounds debounce／flush；專案本身／外部／相鄰前綴／symlink 均拒絕 | 通過 | automated |
| 2026-08-12 | YTCE-H3 | TTS、設定與聊天室容器重連 | jsdom 模擬 speak throw／watchdog／storage reject／跨視窗監看／容器替換／無本機 voice | 佇列可恢復、壞設定不崩潰、只使用本機 voice、新容器繼續處理 | 內容與 CSS 案例全數通過；總計 34/34 tests | 通過 | automated |
| 2026-08-12 | YTCE-H4 | 自然退出、鍵盤焦點與發布工具 | 移除 `--test-force-exit` 後 `npm run verify`；Chrome fixture Tab；失敗式截圖 staging | Node 自然退出、focus-visible 可見、截圖失敗不破壞舊素材 | 自然退出成功；焦點 2px solid；故意傳 `/usr/bin/false` 後兩張素材 SHA-256 不變 | 通過 | automated |
| 2026-08-12 | YTCE-H5 | Chrome 真實 YouTube 直播聊天室 | 一般 Chrome 開啟 `live_chat`，檢查面板、items 與 renderer；本機 fixture 檢查新版 UI | 新版注入真實聊天室且顯示本機語音限制 | 已安裝舊版在真實直播找到 `#items` 與 73 則留言、監看靜音成功；新版 fixture 選中 zh-TW 本機 voice。Chrome 安全政策阻擋自動重載，待手動重驗新版 | 待重驗 | manual |
| 2026-08-12 | YTCE-D1 | 導播控制台視覺、響應式與狀態回歸 | 瀏覽器載入 deterministic fixture，檢查 1280×800、430×800、收合與閱讀模式；`npm run verify` | 無水平溢出、閱讀模式隱藏原聊天室、收合狀態正確、視覺規範有自動測試 | 桌面面板 680px、窄版 414px 且無水平溢出；閱讀模式 stage 顯示並隱藏聊天室；商店 PNG 維持 1280×800；34/34 tests 通過 | 通過 | automated |
| 2026-08-12 | YTCE-D1 | 三套畫風切換、同步與響應式回歸 | 瀏覽器逐一載入熔岩／極光／紙墨 fixture，於 1280×800 與 430×800 檢查色票、選取狀態、寬度與 console；jsdom 驗證白名單、保存及 storage change | 三套辨識清楚、無水平溢出或瀏覽器錯誤，無效主題安全回落並可跨視窗同步 | 三套桌面面板皆 680px；窄版面板 414px、三按鈕各 124px；切換後狀態正確、console 0 error；35/35 tests 通過 | 通過 | automated |
| 2026-08-12 | YTCE-D1 | 固定四套華麗畫風的差異與窄版回歸 | 瀏覽器逐一載入熔岩／極光／紙墨／星夜 fixture，檢查面板、聊天室卡與頭像圓角 token；430×800 檢查四欄切換器與 console | 四套材質與輪廓顯著不同，總數固定四套，窄版無溢出且功能回歸通過 | 面板圓角依序 20／24／8／28px，聊天卡 9／16／2／18px，頭像 30%／50%／5px／50%；窄版四按鈕各 91.5px、console 0 error；35/35 tests 通過 | 通過 | automated |
