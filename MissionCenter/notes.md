# 筆記

## 研究紀錄

| 搜尋前構想 | 參考來源 | 採納內容 | 授權狀態 |
| --- | --- | --- | --- |
| 自用 TTS 插件可能缺少成熟功能 | Livestream Chat Reader（Chrome Web Store / MIT GitHub） | 語音選擇、語速、模板、快捷開關、Emoji 控制 | 僅採概念；MIT，未複製程式碼 |
| 第二螢幕顯示可能是差異化 | YouTube Chat in Fullscreen（GPL-3.0 GitHub） | 可調字體、位置、透明度與訊息類型的產品需求 | 僅採概念；GPL 程式碼未使用 |
| 大型直播工具可能提供更多功能 | Social Stream Ninja、SleepyChat | 反洗版、共享佇列、特殊訊息分類 | 僅採需求概念；未複製內容 |

## 2026-08-12 維護稽核

| 搜尋前構想 | 參考來源 | 採納內容 | 授權狀態 |
| --- | --- | --- | --- |
| 全面重整資料夾可能最乾淨 | 本機 README、建置腳本、檔案引用與測試結果 | 保留現有小型原生架構；用用途說明與發布白名單取代大搬家 | 本機專案，不涉及外部授權 |
| `dist/` 可能可直接沿用 | 根目錄與 staging 檔案時間、內容比較 | 發現 `content.js` 已過期，重建並加入逐檔一致性驗證 | 本機專案，不涉及外部授權 |

## 2026-08-12 全面強化研究

| 搜尋前構想 | 參考來源 | 採納內容 | 授權狀態 |
| --- | --- | --- | --- |
| MV3 可用全域變數追蹤視窗 | Chrome Extensions：service worker lifecycle、storage、windows | SW 休眠會遺失全域狀態；採 `storage.session` 並重新驗證視窗 | 官方文件；僅採 API 契約 |
| 短延遲工作可改 `chrome.alarms` | Chrome Extensions：alarms | alarms 最短週期不適合 4.5 秒提示；保留最佳努力並於下次 action 清理 | 官方文件；僅採 API 契約 |
| 所有系統語音都能算純本機 | MDN：SpeechSynthesisVoice.localService | `false` 代表遠端服務；只列明確本機 voice，沒有本機語音就不朗讀 | MDN；僅採平台契約 |
| Observer 綁一次即可 | MDN：MutationObserver.observe/disconnect | 容器移除後需重新 discover／disconnect／observe，並批次處理新增節點 | MDN；僅採平台契約 |
| `--test-force-exit` 是正常 teardown | Node.js CLI／test runner | force-exit 會掩蓋 event-loop 殘留；修正 fixture cleanup 後移除 | 官方文件；僅採測試契約 |

## 2026-08-12 視覺升級研究

| 搜尋前構想 | 參考來源 | 採納內容 | 授權狀態 |
| --- | --- | --- | --- |
| 原有深色控制台可再強化層次與個性 | [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) 的 README、redesign skill 與 changelog | 採既有產品 scan／diagnose／fix、單一重點色、圓角層級、觸感互動、減少動態與反雜亂原則；拒絕落地頁式 AIDA／Hero／GSAP | MIT；僅採一般原則，未複製程式碼、文字或素材，無新增依賴 |
