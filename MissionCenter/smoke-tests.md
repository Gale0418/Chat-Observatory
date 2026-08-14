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
| 2026-08-12 | YTCE-H5 | Chrome 真實 YouTube 直播聊天室 | 一般 Chrome 開啟 `live_chat`，檢查面板、items 與 renderer；本機 fixture 檢查新版 UI | 新版注入真實聊天室且顯示本機語音限制 | 已安裝舊版在真實直播找到 `#items` 與 73 則留言，但 Chrome 安全政策阻擋自動重載，未能證明新版注入 | 失敗 | manual |
| 2026-08-12 | YTCE-D1 | 導播控制台視覺、響應式與狀態回歸 | 瀏覽器載入 deterministic fixture，檢查 1280×800、430×800、收合與閱讀模式；`npm run verify` | 無水平溢出、閱讀模式隱藏原聊天室、收合狀態正確、視覺規範有自動測試 | 桌面面板 680px、窄版 414px 且無水平溢出；閱讀模式 stage 顯示並隱藏聊天室；商店 PNG 維持 1280×800；34/34 tests 通過 | 通過 | automated |
| 2026-08-12 | YTCE-D1 | 三套畫風切換、同步與響應式回歸 | 瀏覽器逐一載入熔岩／極光／紙墨 fixture，於 1280×800 與 430×800 檢查色票、選取狀態、寬度與 console；jsdom 驗證白名單、保存及 storage change | 三套辨識清楚、無水平溢出或瀏覽器錯誤，無效主題安全回落並可跨視窗同步 | 三套桌面面板皆 680px；窄版面板 414px、三按鈕各 124px；切換後狀態正確、console 0 error；35/35 tests 通過 | 通過 | automated |
| 2026-08-12 | YTCE-D1 | 固定四套華麗畫風的差異與窄版回歸 | 瀏覽器逐一載入熔岩／極光／紙墨／星夜 fixture，檢查面板、聊天室卡與頭像圓角 token；430×800 檢查四欄切換器與 console | 四套材質與輪廓顯著不同，總數固定四套，窄版無溢出且功能回歸通過 | 面板圓角依序 20／24／8／28px，聊天卡 9／16／2／18px，頭像 30%／50%／5px／50%；窄版四按鈕各 91.5px、console 0 error；35/35 tests 通過 | 通過 | automated |
| 2026-08-14 | YTCE-M1 | 核心功能與介面自動回歸 | `npm run verify` | JavaScript 語法正確，背景與內容腳本所有測試通過 | 35/35 tests 通過，0 fail、0 skipped | 通過 | automated |
| 2026-08-14 | YTCE-H5 | 聊天主體主題與內嵌設定列回歸 | 以真實 live_chat 階層 fixture 測試 DOM/CSS，並用 Chrome headless 檢查紙墨展開與收合畫面 | 畫風涵蓋聊天 canvas 與訊息卡；設定列在訊息流內且不遮擋；輸入與 emoji 不受 blanket selector 影響 | 36/36 tests 通過；紙墨主體為象牙 canvas，設定列與訊息同寬，Super Chat／會員卡保留辨識層級 | 通過 | automated |
| 2026-08-14 | YTCE-D1 | Impeccable bounded polish 與窄版盒模型回歸 | 一般 Chrome 載入 deterministic live_chat fixture，逐一切換四主題並檢查 1280×800、430×800、展開／收合、color-scheme、圖示 transform、操作高度與水平 overflow；執行 `npm run verify`、`npm run build:extension` | 四主題維持明顯差異；紙墨使用 light、其餘 dark；收合圖示無 Unicode 字元；窄版無水平溢出；測試與發布包通過 | 四主題與 html/body 狀態同步；主題按鈕 40px；430px overflow 由 4px 修至 0；fixture 改為等待 UI ready；36/36 tests 與 ZIP 建置通過 | 通過 | automated |
| 2026-08-15 | YTCE-H5 | 留言順序與固定控制面板回歸 | jsdom 斷言 `#items` 只含 renderer 且新增順序不變；Chrome 於 430×500、1280×800 的內部 scroller 捲動並切換展開／收合；執行 `npm run verify`、`npm run build:extension` | 控制面板不污染虛擬清單、捲動後固定頂端、內容區依面板高度保留空間、無水平溢出 | 面板留在 BODY 且捲動前後 `top: 8px`；面板與 scroller 重疊 0px；三則留言順序不變；37/37 tests 與 ZIP 建置通過 | 通過 | automated |
| 2026-08-15 | YTCE-H3 | 本機語音延遲載入與連續留言朗讀順序 | 模擬 voice 暫時為空、稍後觸發 `voiceschanged`；一次批次加入 12 則留言並逐一觸發 utterance `onend`；執行 `npm run verify` | 開啟意圖不因 voice 尚未載入而被關閉；voice 出現後自動朗讀等待留言；SpeechSynthesis 接收順序與 DOM 完全一致 | 等待時開關保持開啟並顯示「正在等待本機語音」；voice 出現後轉為「朗讀中」；12 則依 1→12 無跳號、倒序或重複；38/38 tests 通過 | 通過 | automated |
| 2026-08-15 | YTCE-H3 | 純本機多語 voice 路由與 FIFO | jsdom 依序加入中／日／韓／英／阿拉伯／西里爾／希伯來／希臘／泰／天城文留言；測試中文作者與時間前綴、混合句、voice 延遲／消失、auto／fixed；一般 Chrome 載入真實系統 voice 清單並切換四主題；執行 `npm run verify`、`npm run build:extension` | 只使用 `localService=true`；voice 配對不改留言順序；無法判定安全 fallback；固定 voice 消失不偷換；控制面板固定且無水平溢位 | 單一 utterance FIFO 與原 DOM 順序一致；原始留言偵測不受作者／時間污染；Chrome 顯示 180+ 本機 voice、繁中「美佳」可用、auto↔fixed 狀態正確；四主題 overflow 0、panel top 8px；46/46 tests 與 ZIP 通過 | 通過 | automated |
| 2026-08-15 | YTCE-H3 | 社群推薦 voice 排序 | 模擬日文 voice 清單依序含 Eddy、Flo、Kyoko 與遠端 Google 日本語；執行 `npm run verify`、`npm run build:extension` | 自動模式避開角色聲、選 Kyoko 並標示推薦；遠端 voice 不進純本機選單 | 實際選擇 `voice-ja-kyoko`，Kyoko 標示推薦，Remote Google 不出現在選單；47/47 tests 與 ZIP 通過 | 通過 | automated |
