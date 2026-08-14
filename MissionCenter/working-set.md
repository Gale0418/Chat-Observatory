<!-- Generated materialized view. Do not edit directly; rebuild from canonical MissionCenter files. -->
<!-- mission-center-derived schema=1.0 fingerprint-format=sha256-v2-lf source-fingerprint=941e0a20542a0f3a4d75f7768924c28fee362bb56c35eb7bc8845f4e0ec21ca7 -->
# 當前工作集

- 唯一真實來源: `tasks.md`
- 可執行項目數: 3

| ID | 標題 | 優先級 | 狀態 | 下一步 | 依賴 | 驗證方式 | 阻塞原因 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| YTCE-P2 | 填入正式聯絡資訊與公開隱私政策網址 | P0 | Blocked | 取得支援信箱與公開網址後更新商店文件 | YTCE-P1 | STORE_LISTING.md 與公開頁面資訊一致且連結可開啟 | 需要主人提供正式資料 |
| YTCE-E1 | 發布純本機大字聊天室與 TTS 擴充功能 | P0 | In Progress | 完成新版 Chrome 實機驗收與商店聯絡資訊 |  | 所有未完成子任務通過驗證 |  |
| YTCE-H5 | 完成新版 Chrome 真實聊天室驗收 | P0 | In Progress | 手動重載後確認四套主題涵蓋聊天室主體，且設定列內嵌、不遮擋訊息 | YTCE-M1, YTCE-H4 | 新版在一般 Chrome 真實直播完成注入、主題、內嵌設定列、模式與本機 TTS 驗證 |  |

## 下一步候選

- YTCE-V1 — 建立上架快照並完成收尾
- 以上僅為候選，開始前仍須在 `tasks.md` 升格為 Ready。
