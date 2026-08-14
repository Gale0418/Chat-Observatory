# 任務

| ID | 標題 | 類型 | 父層 | 優先級 | 狀態 | 負責人 | 依賴 | 下一步 | 驗證方式 | 估時 | 標籤 | 備註 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| YTCE-E1 | 發布純本機大字聊天室與 TTS 擴充功能 | Epic |  | P0 | In Progress | Codex |  | 完成新版 Chrome 實機驗收與商店聯絡資訊 | 所有未完成子任務通過驗證 | 0 | plan, execution | 聚合列不重複計入估時；第二台聊天室電腦為主要情境 |
| YTCE-R1 | 研究競品並核准產品範圍 | Task | YTCE-E1 | P0 | Done | Codex |  | 維持純本機單一目的 | 產品方向已由使用者核准 | 2 | intake, plan | 不採用雲端中繼 |
| YTCE-M1 | 完成純本機核心與高雅介面 | Task | YTCE-E1 | P0 | Done | Codex | YTCE-R1 | 維持核心與視覺回歸測試 | 自動檢查及 deterministic UI 流程通過 | 0 | execution, verification | 聚合列不重複計入估時；真實聊天室驗收統一由 YTCE-H5 追蹤 |
| YTCE-S1 | 重整設定、文字清理與 TTS 佇列 | Subtask | YTCE-M1 | P0 | Done | Codex | YTCE-R1 | 維持測試綠燈 | 語法檢查與佇列行為測試通過 | 2 | execution |  |
| YTCE-S2 | 建立完整／監看／朗讀三種模式 | Subtask | YTCE-M1 | P1 | Done | Codex | YTCE-S1 | 維持視覺與模式測試 | 三種模式渲染與切換正確 | 1 | execution |  |
| YTCE-S3 | 補齊特殊訊息與巢狀節點處理 | Subtask | YTCE-M1 | P1 | Done | Codex | YTCE-S1 | 以真實直播確認選擇器 | DOM fixture 驗證通過 | 1 | execution, verification |  |
| YTCE-S4 | 縮減權限並改善啟動錯誤提示 | Subtask | YTCE-M1 | P1 | Done | Codex | YTCE-S1 | 以一般 Chrome 確認啟動 | manifest 與 URL 案例檢查通過 | 1 | execution, verification |  |
| YTCE-D1 | 升級直播導播控制台視覺系統 | Subtask | YTCE-M1 | P1 | Done | Codex | YTCE-S2 | 固定四套主題並維持 token、設定同步與響應式回歸測試 | 熔岩、極光、紙墨、星夜於 1280×800、430×800、收合與閱讀模式驗收通過 | 4 | design, execution, verification | 四套以材質、色溫、圓角、字體與聊天卡語彙拉開差異；無外部依賴 |
| YTCE-P1 | 完成商店資產、說明與隱私文件草稿 | Task | YTCE-E1 | P1 | Done | Codex | YTCE-M1 | 維持素材與發布包驗證 | 圖示、截圖、商店文案與本機隱私文件均存在且已驗證 | 3 | execution, verification | 正式聯絡資訊改由 YTCE-P2 獨立追蹤 |
| YTCE-H1 | 整理專案並強化發布驗證 | Task | YTCE-E1 | P1 | Done | Codex | YTCE-S1 | 維持建置與測試綠燈 | 34 項測試通過、ZIP 僅含 8 個允許檔案且 staging 與來源一致 | 2 | execution, verification | 已移除 Thumbs.db、過期 zip-check 與無引用 ui-review；保留商店素材與 HUD |
| YTCE-H2 | 強化 URL、MV3 視窗與發布安全邊界 | Task | YTCE-E1 | P0 | Done | Codex | YTCE-H1 | 維持 URL、session 與輸出邊界回歸測試 | 背景測試涵蓋主機白名單、session、尺寸合併與 API 失敗；專案外輸出被拒絕 | 4 | execution, verification | storage.session、foreign popup、action serialization、bounds debounce／flush、symlink 防護均已驗證 |
| YTCE-H3 | 修復 TTS、設定與聊天室重連生命週期 | Task | YTCE-E1 | P0 | Done | Codex | YTCE-H2 | 維持 TTS／設定／Observer／多語 FIFO 回歸測試 | TTS 例外／逾時能恢復，容器替換後仍處理留言，多語 voice 路由不改變 FIFO | 5 | execution, verification | 只允許 localService=true；支援自動保守配對與固定 voice；無本機語音時不朗讀 |
| YTCE-H4 | 完成測試 teardown、無障礙與跨平台工具強化 | Task | YTCE-E1 | P1 | Done | Codex | YTCE-H3 | 在各發布平台維持工具 smoke | Node 測試自然退出；鍵盤焦點可見；工具提供可操作的跨平台錯誤 | 3 | execution, verification | JSDOM 延遲主因為 NAS I/O；已移除 force-exit 並清理所有頁面資源 |
| YTCE-H5 | 完成新版 Chrome 真實聊天室驗收 | Task | YTCE-E1 | P0 | In Progress | Codex | YTCE-M1, YTCE-H4 | 手動重載後確認四套主題涵蓋聊天室主體，且設定列內嵌、不遮擋訊息 | 新版在一般 Chrome 真實直播完成注入、主題、內嵌設定列、模式與本機 TTS 驗證 | 1 | execution, verification | 已依實機截圖修正面板浮島與主體未套主題；待主人手動重載新版確認 |
| YTCE-P2 | 填入正式聯絡資訊與公開隱私政策網址 | Task | YTCE-E1 | P0 | Blocked | Codex | YTCE-P1 | 取得支援信箱與公開網址後更新商店文件 | STORE_LISTING.md 與公開頁面資訊一致且連結可開啟 | 1 | execution, verification, blocked | 需要主人提供正式資料 |
| YTCE-V1 | 建立上架快照並完成收尾 | Task | YTCE-E1 | P1 | Backlog | Codex | YTCE-H5, YTCE-P2 | 前置任務完成後重建套件、快照與 closeout | 發布包、smoke tests、snapshot 與 closeout 一致 | 1 | verification, closeout | 不再重複追蹤實機驗收 |
