<!-- Generated materialized view. Do not edit directly; rebuild from canonical MissionCenter files. -->
<!-- mission-center-derived schema=1.0 fingerprint-format=sha256-v2-lf source-fingerprint=98282853ba348e8fb9641d6c1985f15729ccd501215c34b325c472a1e272e0cd -->
# P0 焦點

- 唯一真實來源: `tasks.md`
- 未完成 P0: 4

| ID | 標題 | 狀態 | 下一步 | 依賴 | 驗證方式 |
| --- | --- | --- | --- | --- | --- |
| YTCE-E1 | 發布純本機大字聊天室與 TTS 擴充功能 | In Progress | 完成 M1 核心並準備上架 |  | 所有子任務通過驗證 |
| YTCE-M1 | 完成純本機核心與高雅介面 | Review | 在一般 Chrome 執行真實直播驗收 | YTCE-R1 | 自動檢查及手動 UI 流程通過 |
| YTCE-H5 | 對齊隱私、商店文件與 Chrome 實機驗收 | Review | 在 chrome://extensions 手動重新載入後重跑真實聊天室 smoke | YTCE-H4 | 自動化、Chrome 實機與發布包驗證均有證據；未解 blocker 明列 |
| YTCE-V1 | 執行實機驗證與上架前收尾 | Backlog | Chrome 載入並跑完整流程 | YTCE-P1 | smoke tests 與上架檢查已記錄 |
