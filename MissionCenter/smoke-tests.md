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
