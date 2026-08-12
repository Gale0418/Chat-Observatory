# 任務

| ID | 標題 | 類型 | 父層 | 優先級 | 狀態 | 負責人 | 依賴 | 下一步 | 驗證方式 | 估時 | 標籤 | 備註 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| YTCE-E1 | 發布純本機大字聊天室與 TTS 擴充功能 | Epic |  | P0 | In Progress | Codex |  | 完成 M1 核心並準備上架 | 所有子任務通過驗證 | 13 | plan, execution | 第二台聊天室電腦為主要情境 |
| YTCE-R1 | 研究競品並核准產品範圍 | Task | YTCE-E1 | P0 | Done | Codex |  | 維持純本機單一目的 | 產品方向已由使用者核准 | 2 | intake, plan | 不採用雲端中繼 |
| YTCE-M1 | 完成純本機核心與高雅介面 | Task | YTCE-E1 | P0 | Review | Codex | YTCE-R1 | 在一般 Chrome 執行真實直播驗收 | 自動檢查及手動 UI 流程通過 | 5 | execution, verification | 自動化已通過，待實機 |
| YTCE-S1 | 重整設定、文字清理與 TTS 佇列 | Subtask | YTCE-M1 | P0 | Done | Codex | YTCE-R1 | 維持測試綠燈 | 語法檢查與佇列行為測試通過 | 2 | execution |  |
| YTCE-S2 | 建立完整／監看／朗讀三種模式 | Subtask | YTCE-M1 | P1 | Done | Codex | YTCE-S1 | 維持視覺與模式測試 | 三種模式渲染與切換正確 | 1 | execution |  |
| YTCE-S3 | 補齊特殊訊息與巢狀節點處理 | Subtask | YTCE-M1 | P1 | Done | Codex | YTCE-S1 | 以真實直播確認選擇器 | DOM fixture 驗證通過 | 1 | execution, verification |  |
| YTCE-S4 | 縮減權限並改善啟動錯誤提示 | Subtask | YTCE-M1 | P1 | Done | Codex | YTCE-S1 | 以一般 Chrome 確認啟動 | manifest 與 URL 案例檢查通過 | 1 | execution, verification |  |
| YTCE-P1 | 完成商店圖示、說明與隱私文件 | Task | YTCE-E1 | P1 | In Progress | Codex | YTCE-M1 | 補支援信箱與公開隱私政策網址 | 商店必要素材清單完整 | 3 | execution, verification | 圖示、截圖與文案已完成 |
| YTCE-H1 | 整理專案並強化發布驗證 | Task | YTCE-E1 | P1 | Done | Codex | YTCE-S1 | 維持建置與測試綠燈 | 34 項測試通過、ZIP 僅含 8 個允許檔案且 staging 與來源一致 | 2 | execution, verification | 已移除 Thumbs.db、過期 zip-check 與無引用 ui-review；保留商店素材與 HUD |
| YTCE-H2 | 強化 URL、MV3 視窗與發布安全邊界 | Task | YTCE-E1 | P0 | Done | Codex | YTCE-H1 | 維持 URL、session 與輸出邊界回歸測試 | 背景測試涵蓋主機白名單、session、尺寸合併與 API 失敗；專案外輸出被拒絕 | 4 | execution, verification | storage.session、foreign popup、action serialization、bounds debounce／flush、symlink 防護均已驗證 |
| YTCE-H3 | 修復 TTS、設定與聊天室重連生命週期 | Task | YTCE-E1 | P0 | Done | Codex | YTCE-H2 | 維持 TTS／設定／Observer 回歸測試 | TTS 例外／逾時能恢復，容器替換後仍處理留言，設定異常不崩潰 | 5 | execution, verification | 只允許 localService=true；無本機語音時不朗讀 |
| YTCE-H4 | 完成測試 teardown、無障礙與跨平台工具強化 | Task | YTCE-E1 | P1 | Done | Codex | YTCE-H3 | 在各發布平台維持工具 smoke | Node 測試自然退出；鍵盤焦點可見；工具提供可操作的跨平台錯誤 | 3 | execution, verification | JSDOM 延遲主因為 NAS I/O；已移除 force-exit 並清理所有頁面資源 |
| YTCE-H5 | 對齊隱私、商店文件與 Chrome 實機驗收 | Task | YTCE-E1 | P0 | Review | Codex | YTCE-H4 | 在 chrome://extensions 手動重新載入後重跑真實聊天室 smoke | 自動化、Chrome 實機與發布包驗證均有證據；未解 blocker 明列 | 4 | verification, closeout | 新版 fixture 通過；Chrome 安全政策禁止自動重載既有未封裝擴充功能 |
| YTCE-V1 | 執行實機驗證與上架前收尾 | Task | YTCE-E1 | P0 | Backlog | Codex | YTCE-P1 | Chrome 載入並跑完整流程 | smoke tests 與上架檢查已記錄 | 3 | verification, closeout |  |
