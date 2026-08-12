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
| YTCE-H1 | 整理專案並強化發布驗證 | Task | YTCE-E1 | P1 | Done | Codex | YTCE-S1 | 維持建置與測試綠燈 | 10 項測試通過、ZIP 僅含 8 個允許檔案且 staging 與來源一致 | 2 | execution, verification | 已移除 Thumbs.db 與過期 zip-check；低風險非感知改動，Completion Critic 依規則略過 |
| YTCE-V1 | 執行實機驗證與上架前收尾 | Task | YTCE-E1 | P0 | Backlog | Codex | YTCE-P1 | Chrome 載入並跑完整流程 | smoke tests 與上架檢查已記錄 | 3 | verification, closeout |  |
