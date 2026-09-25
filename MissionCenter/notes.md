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

## 2026-08-14 Impeccable 精修研究

| 搜尋前構想 | 參考來源 | 採納內容 | 授權狀態 |
| --- | --- | --- | --- |
| 四套華麗主題需要再加更多裝飾才算 BUFF | [pbakaus/impeccable](https://github.com/pbakaus/impeccable) 4.0.4 的 skill、polish 與 craft-floor 參考文件 | 工具型 UI 應優先保持掃讀性與一致性；以 bounded polish 補齊 CSS 幾何收合圖示、主題化 selection／caret／scrollbar、原生 color-scheme、disabled／selected 狀態與 40px 操作高度，並以 Chrome 實際渲染驗證；不改寫四套已核准美術方向 | Apache-2.0；僅採一般設計與驗證原則，未安裝技能、hooks、素材或程式依賴 |

## 2026-08-15 多語 TTS 研究

| 搜尋前構想 | 參考來源 | 採納內容 | 授權狀態 |
| --- | --- | --- | --- |
| 只設定 `utterance.lang` 即可讓 Chrome 自動挑本機 voice | MDN `SpeechSynthesisVoice.lang`／`localService`、`SpeechSynthesisUtterance.lang`、`voiceschanged`；W3C Web Speech API | 指定 voice 後瀏覽器必須使用該 voice；未指定 voice 的預設服務可能是遠端。因此自行從 `localService=true` 清單配對 voice，並在 `speak()` 前同步設定 `voice` 與 BCP 47 `lang` | 官方／一手規格；僅採 API 契約 |
| Web Speech API 能精準偵測聊天室文字語言 | W3C Web Speech API synthesis 介面 | 合成 API 沒有文字語言偵測功能；採無依賴 script 統計與有限常用詞提示，UI 明示「保守配對」，混合或低信心時退回預設 voice | 官方／一手規格；未加入模型、網路服務或第三方程式碼 |
| 每個 voice 都有可直接比較的公開評分 | Reddit LearnJapanese、AppleVis、Anki Forums 與 Apple 使用者討論；Chrome `tts.TtsVoice` 契約 | API 沒有 rating；採 Premium／Enhanced／Natural／Siri、系統預設與社群常見人聲加分，對 novelty／角色聲降權。日文優先 Siri／Kyoko／Otoya，韓文 Yuna，繁中 Mei-Jia，阿拉伯 Majed；其他語言證據不足時尊重系統預設 | 社群經驗僅作排序提示；未複製程式碼，未宣稱客觀音質排名 |

## 2026-08-20 P0 發布硬化研究

| 搜尋前構想 | 參考來源 | 採納內容 | 授權狀態 |
| --- | --- | --- | --- |
| MV3 可只靠記憶體記住目前聊天室 | Chrome Extensions `storage`、service worker lifecycle、`windows` API | `storage.session` 是 Chrome 102+ 且適合 SW；session 綁定 windowId＋videoId，視窗屬性與 URL 每次重新驗證 | Chrome 官方文件；僅採 API 契約 |
| `speechSynthesis.cancel()` 後 active 留言仍可自然繼續 | W3C Web Speech API、MDN `SpeechSynthesis.cancel()`／`SpeechSynthesisUtterance.lang` | cancel 會清除整個 UA 佇列並停止 active utterance；應保存 active 資料項目再重建 utterance，且明示 BCP 47 lang | W3C／MDN；僅採平台契約 |
| debounce 已足以確保關窗前設定落盤 | Chrome Storage API、內容腳本 pagehide 行為與本機測試 | 保留 250ms debounce，但 cleanup/pagehide 若仍有 pending save 立即呼叫 storage.local.set | 官方 API＋本機證據；未新增依賴 |

## 專案歷史活動（原 project.md 保留紀錄）

- 已依目標建立初始任務樹。
- Workspace synced from tasks and smoke tests. 已記錄 Smoke tests: 1.
- Workspace synced from tasks and smoke tests. 已記錄 Smoke tests: 7.
- 2026-08-12T00:00:00+08:00：完成專案整理與發布流程維護；原因是發布 ZIP 落後於根目錄原始碼；影響為清除明確垃圾、補齊朗讀時間測試並讓建置自動核對雜湊與 ZIP 清單。
- 2026-08-16T00:00:00+08:00：重繪十二套宇宙背景為近距離星體特寫；原因是原背景保留過多遠景黑色安全區，削弱畫面張力；影響為 12 張本機背景統一為 1672×941，並完成測試與 ZIP 檔案數驗證。
- 2026-08-20T00:00:00+08:00：依 2026-08-17 全樹體檢擴充 v1.0.0 首次上架的發布硬化範圍；原因是確認跨直播視窗、超寬尺寸、設定 flush、TTS 試聽、speech locale、i18n 與發布文案存在可靠度風險；影響為新增 CO-H6 至 CO-H9，並將後續智慧朗讀、DOM 韌性與暴雨壓縮保留為粗粒度 Epic。
- 2026-08-20T22:50:00+08:00：新增 CO-H10 純本機自訂背景圖片；原因是主人確認首版應允許使用者自行選擇背景；影響為新增圖片壓縮、獨立本機儲存、移除與三語錯誤狀態，不新增權限、網路傳輸或首版輪播範圍。
- 2026-08-20T21:23:09+08:00：完成 CO-H6 至 CO-H9 的 P0 實作與自動驗證；原因是跨直播視窗、關窗保存與 TTS 試聽屬上架前可靠度阻擋；影響為 57/57 測試與發布 ZIP 通過，四項任務進入 Review，Chrome 新版實機與外部審查限制如實保留。
- 2026-09-25：主人確認擴充功能早已上架；目前週期改為已上架版本維護更新，舊首次上架紀錄保留為歷史，不再視為本次驗收阻擋。
- 本機工作樹的維護版尚未載入已安裝 Chrome 擴充功能；已安裝版實機與本機 fixture 驗收需分開記錄。
