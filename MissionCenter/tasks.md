# 任務

| ID | 標題 | 類型 | 父層 | 優先級 | 狀態 | 負責人 | 依賴 | 下一步 | 驗證方式 | 估時 | 標籤 | 備註 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CO-E1 | 維護已上架的純本機大字聊天室與 TTS 擴充功能 | Epic |  | P0 | In Progress | Codex |  | 完成這次修復的本機驗證、已安裝版對照與下一版 Chrome 驗收 | 所有本次修復通過回歸、建置與 Chrome 驗證 | 0 | plan, execution | 已上架；此列與舊版子任務保留歷史脈絡，目前屬維護更新，第二台聊天室電腦為主要情境 |
| CO-R1 | 研究競品並核准產品範圍 | Task | CO-E1 | P0 | Done | Codex |  | 維持純本機單一目的 | 產品方向已由使用者核准 | 2 | intake, plan | 不採用雲端中繼 |
| CO-M1 | 完成純本機核心與高雅介面 | Task | CO-E1 | P0 | Done | Codex | CO-R1 | 維持核心與視覺回歸測試 | 自動檢查及 deterministic UI 流程通過 | 0 | execution, verification | 聚合列不重複計入估時；真實聊天室驗收統一由 CO-H5 追蹤 |
| CO-S1 | 重整設定、文字清理與 TTS 佇列 | Subtask | CO-M1 | P0 | Done | Codex | CO-R1 | 維持測試綠燈 | 語法檢查與佇列行為測試通過 | 2 | execution |  |
| CO-S2 | 收斂成單一完整聊天室與 TTS 開關 | Subtask | CO-M1 | P1 | Done | Codex | CO-S1 | 維持視覺與 TTS 測試 | 完整聊天室渲染正確，TTS 開關可控制朗讀 | 1 | execution |  |
| CO-S3 | 補齊特殊訊息與巢狀節點處理 | Subtask | CO-M1 | P1 | Done | Codex | CO-S1 | 以真實直播確認選擇器 | DOM fixture 驗證通過 | 1 | execution, verification |  |
| CO-S4 | 縮減權限並改善啟動錯誤提示 | Subtask | CO-M1 | P1 | Done | Codex | CO-S1 | 以一般 Chrome 確認啟動 | manifest 與 URL 案例檢查通過 | 1 | execution, verification |  |
| CO-S5 | 加入 Chrome 自動語系與 TW／JP／EN 手動介面切換 | Subtask | CO-M1 | P1 | Done | Codex | CO-S2 | 維持三語回歸與發布包驗證 | Chrome 自動選擇、旗幟按鈕即時切換、設定持久化、locale key parity 與 ZIP 封裝通過 | 3 | execution, verification | 介面語言與留言原文分離；`auto` 會回到 Chrome 語言判斷 |
| CO-D1 | 升級直播導播控制台視覺系統 | Subtask | CO-M1 | P1 | Done | Codex | CO-S2 | 維持十二套主題 token、設定同步與響應式回歸測試 | 十二色主題於 1280×800、430×800、收合與完整畫面驗收通過 | 4 | design, execution, verification | 主題以材質、色溫、圓角、字體與聊天卡語彙拉開差異；無外部依賴 |
| CO-D2 | 重繪十二套宇宙背景為近距離星體特寫 | Subtask | CO-M1 | P1 | Done | Codex | CO-D1 | 維持背景讀取、文字對比與發布封裝驗證 | 十二張 1672×941 本機背景皆為近距離裁切構圖，遮罩不吞掉主體，且測試與 ZIP 封裝通過 | 2 | design, execution, verification | 由 ImageGen 重新產生；同步降低十二色主題背景遮罩，保留少量可讀暗部並移除大面積空黑 |
| CO-P1 | 完成商店資產、說明與隱私文件草稿 | Task | CO-E1 | P1 | Done | Codex | CO-M1 | 維持素材與發布包驗證 | 圖示、截圖、商店文案與本機隱私文件均存在且已驗證 | 3 | execution, verification | 正式聯絡資訊改由 CO-P2 獨立追蹤 |
| CO-H1 | 整理專案並強化發布驗證 | Task | CO-E1 | P1 | Done | Codex | CO-S1 | 維持建置與測試綠燈 | 34 項測試通過、ZIP 僅含 8 個允許檔案且 staging 與來源一致 | 2 | execution, verification | 已移除 Thumbs.db、過期 zip-check 與無引用 ui-review；保留商店素材與 HUD |
| CO-H2 | 強化 URL、MV3 視窗與發布安全邊界 | Task | CO-E1 | P0 | Done | Codex | CO-H1 | 維持 URL、session 與輸出邊界回歸測試 | 背景測試涵蓋主機白名單、session、尺寸合併與 API 失敗；專案外輸出被拒絕 | 4 | execution, verification | storage.session、foreign popup、action serialization、bounds debounce／flush、symlink 防護均已驗證 |
| CO-H3 | 修復 TTS、設定與聊天室重連生命週期 | Task | CO-E1 | P0 | Done | Codex | CO-H2 | 維持 TTS／設定／Observer／多語 FIFO 回歸測試 | TTS 例外／逾時能恢復，容器替換後仍處理留言，多語 voice 路由不改變 FIFO | 5 | execution, verification | 只允許 localService=true；支援自動保守配對與固定 voice；無本機語音時不朗讀 |
| CO-H4 | 完成測試 teardown、無障礙與跨平台工具強化 | Task | CO-E1 | P1 | Done | Codex | CO-H3 | 在各發布平台維持工具 smoke | Node 測試自然退出；鍵盤焦點可見；工具提供可操作的跨平台錯誤 | 3 | execution, verification | JSDOM 延遲主因為 NAS I/O；已移除 force-exit 並清理所有頁面資源 |
| CO-H5 | 完成維護版 Chrome 真實聊天室驗收 | Task | CO-E1 | P0 | In Progress | Codex | CO-M1, CO-H4, CO-H9, CO-H10 | 區分已安裝商店版與本機工作樹，於維護版載入後執行自訂背景、A→A、A→B、設定保存與 TTS 實機矩陣 | 維護版在一般 Chrome 真實直播完成注入、十二套主題、自訂背景、跨直播視窗切換、設定保存與本機 TTS 驗證 | 1 | execution, verification | 已上架版可在真實 live_chat 開啟；本機視覺 fixture 可載入最新工作樹，兩者版本不可混作同一次驗收 |
| CO-H6 | 修復跨直播聊天室視窗與第二螢幕邊界 | Task | CO-E1 | P0 | Review | Codex | CO-H4 | 由 CO-H5 在重載新版後執行 A→A、A→B、寬螢幕與失效座標實機矩陣 | session 綁定 windowId 與 videoId；相同直播聚焦、不同直播更新；8192×4320 內尺寸不被錯誤截斷，失效位置可回復 | 3 | execution, verification | 18/18 focused 與 57/57 全套測試通過；未新增權限，超出 ±8192 的污染座標直接捨棄 |
| CO-H7 | 修復設定生命週期、繁中介面與發布契約 | Task | CO-E1 | P0 | Review | Codex | CO-H4 | 由 CO-H5 在重載新版後驗證 100ms 內關窗仍保存最新設定 | 關窗前最後設定不遺失；zh-TW 無日文污染；文案只宣稱實際功能；manifest 明確限制支援版本 | 2 | execution, verification | pagehide flush、catalog parity、Chrome 111 與商店文案測試均通過；未加 fallback 的 `color-mix()` 與最低版本一致；非同步 storage 最終完成仍由 Chrome runtime 保證 |
| CO-H8 | 重構 TTS active item、試聽恢復與 speech locale | Task | CO-E1 | P0 | Review | Codex | CO-H4 | 由 CO-H5 在真實本機 voice 執行 A→試聽→A→B 與中日英模板驗收 | 試聽不吞 active 留言；queue 順序不變；UI locale 不污染朗讀模板；未知語言採中性正文 fallback | 5 | execution, verification | 39/39 focused 與 57/57 全套測試通過；維持單一 FIFO、localService=true 與 watchdog |
| CO-H9 | 完成 P0 回歸、發布建置與驗收前門檻 | Task | CO-E1 | P0 | Review | Codex | CO-H6, CO-H7, CO-H8 | 完成新版 Chrome 手動矩陣 | 所有事故案例具可重複測試；npm verify 與 build:extension 通過；Mission Center 留存證據 | 2 | verification | 60/60 與 v1.0.0 ZIP 通過；CodeRabbit 限額審查首輪 3 項均修復、末輪 19 檔 0 findings；Chrome 最新版實機仍待驗收 |
| CO-H10 | 加入純本機自訂背景圖片 | Task | CO-E1 | P1 | Review | Codex | CO-H7 | 重載最新版後以真實 JPG／PNG／WebP 驗證匯入、重載保存、移除與窄視窗操作 | JPG／PNG／WebP 可在本機匯入並壓縮保存；重載後維持；移除後回復主題；無新增權限或網路傳輸 | 3 | execution, verification | 60/60 自動測試與 v1.0.0 ZIP 通過；單張背景首版，不做輪播；圖片與一般設定分開存 |
| CO-P2 | 修復已上架商店的隱私與支援連結 | Task | CO-E1 | P2 | In Progress | Codex | CO-P1 | 將最新版 PRIVACY.md 同步至公開 main 後，把商店隱私與支援欄位改成 STORE_LISTING.md 已驗證網址 | 商店公開隱私與支援連結可開啟，內容與實際資料處理一致 | 1 | execution, verification | 2026-09-25 實查已上架 1.0.0 兩欄位仍指向失效分支；本機文件已修，公開 GitHub 與 Chrome Web Store 待外部更新 |
| CO-V1 | 建立維護更新快照並完成收尾 | Task | CO-E1 | P1 | Backlog | Codex | CO-H5 | 本次驗證完成後重建套件、快照與 closeout | 維護版建置、smoke tests、snapshot 與 closeout 一致 | 1 | verification, closeout | 已上架產品的維護收尾，不以首次上架聯絡資訊作前置條件 |
| CO-E2 | 建立可信任的多語智慧朗讀管線 | Epic |  | P1 | Backlog | Codex | CO-E1 | P0 發布硬化完成後細化短句偵測、分語言 voice、grapheme 與等待時間里程碑 | 短句與混合語言不破壞 FIFO；emoji 不被切斷；每語言 voice 可控且維持純本機 | 0 | plan | 目前保留為粗粒度 Backlog，避免第一里程碑膨脹 |
| CO-E3 | 建立 YouTube DOM Adapter 與效能韌性 | Epic |  | P1 | Backlog | Codex | CO-E1 | P0 發布硬化完成後細化 renderer 身分、Observer 重連與設定快路徑 | 虛擬節點重用、空 renderer 後補文字與高速聊天室均有可重複驗證 | 0 | plan | 遵守 CL-001：第三方資料容器只觀察，不注入自訂 UI |
| CO-E4 | 加入聊天室暴雨壓縮與進階直播操作 | Epic |  | P2 | Backlog | Codex | CO-E2, CO-E3 | 先以本機 fixture 驗證重複留言聚合與優先佇列，再決定產品化範圍 | 高速低熵洗版可壓縮；SC／會員／關鍵字優先且不製造無限延遲 | 0 | plan | 不引入 AI、後端或遠端資料傳輸 |
