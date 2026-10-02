# 日常操作與錯誤恢復品質修復

使用者要求以可供付費使用者每天使用的標準改善既有產品。本輪承接 CO-E1 的維護更新，保留十二套主題、純本機語音與既有收合偏好。任務仍在 Review，未發布新版本。

## 已完成

| ID | 等級 | 使用者遇到的問題 | 修復與證據 |
| --- | --- | --- | --- |
| UX-01 | P2 | 收合面板時找不到主要朗讀開關 | 開關常駐 header；保留收合偏好，收合按鈕提供三語 tooltip；回歸驗證收合時可啟停 |
| UX-02 | P2 | 切換介面語言後，語音選單推薦／缺少語音文字仍是舊語言 | 語系變更後重建語音選項，保持選定 URI；三語 parity 與行為回歸通過 |
| UX-03 | P2 | 自動模式仍可選語音，卻不明白何時生效 | 改成模式對應的「偏好／備援語音」與「固定語音」，說明自動女聲規則及跨語言限制 |
| UX-04 | P2 | 語音關閉時試聽失敗被一般 off 狀態蓋掉，且錯誤文案誤稱留言失敗 | 區分試聽與留言失敗，常駐錯誤區提供對應重試／跳過／繼續或關閉；回歸涵蓋 off 狀態試聽 |
| UX-05 | P2 | 儲存／載入失敗被語音狀態覆蓋，未儲存設定不能直接救回 | 獨立持續提示與手動儲存重試，只保存 dirty 欄位；讀取失敗說明暫用預設值並要求重開 |
| UX-06 | P3 | 載入中的語音選單可操作，無本機語音時試聽仍可按 | 初始 disabled、disabled placeholder 與 aria-busy；依可用本機 voice 啟用試聽，提供系統加入語音的引導 |
| UX-07 | P2 | 小視窗／最大字級／錯誤提示令設定面板超出畫面 | IAB 合成 380×560、日文、24px 面板字級實測 panelBottom 844.42px；修復後 529.23px、無水平溢位。設定區依剩餘高度縮減，外層可捲動 |
| UX-08 | P2 | 故障期間佇列溢位會移除仍提供重試的失敗留言 | 保留失敗項，淘汰最舊等待項；手動重試刷新失敗項時間，其他等待項仍依既有過期規則處理；長等待＋overflow 回歸通過 |
| UX-09 | P2 | 同時讀取與儲存失敗，重試儲存成功後焦點仍留在隱藏按鈕 | 修前回歸失敗（actual retry-save、expected collapse-button）；補主動移焦與 disabled 後 body fallback，尊重使用者另選焦點；最終回歸通過 |

## 獨立診斷與採用判斷

- A：`/root/product_experience_a`，負責產品流程、模式語意、文案與 ARIA；B：`/root/product_evidence_b`，負責機械證據與新修復的時間序列。使用隔離上下文與唯讀責任範圍，修後做針對性覆核；不是正式 completion council。
- B 的「queueLimit 20→3 後留下4筆」撤回：實際 `while(length >= limit)` 會減到 limit−1，再 push 至 limit。
- 「第一次成功 set 就清除讀取失敗提示」不採用：set 僅寫 dirty 欄位，其他原本偏好仍未成功讀回；清除會掩蓋仍在使用 defaults 的差異。持續顯示重開說明符合實際狀態。
- 語音 placeholder 寫入「文字」的說法缺乏證據（其 value 本來就是空字串）；只修確認存在的載入狀態可操作性。
- 首次自動展開屬偏好，沒有改動使用者的收合設定；主要朗讀控制與設定入口已可見。
- Impeccable 對既有頂部光帶的 side-tab 提示已經人工判讀，僅對 content.css 持久化該規則例外。此次最終 CSS／JS detector 回傳 `[]`。

## 驗證與可重開快照

- `npm run verify`：115/115、0 fail，包含語法檢查。日誌 `/tmp/chatobs-product-verify-final.log`。
- CodeRabbit：15 個小型原始碼／測試檔完整審查 0 issues；焦點修復與操作文件的3檔 delta 審查 0 issues。圖片、ZIP、產物與 lockfile 排除，未為湊150檔而加入無關資料。
- 首次 CodeRabbit 資料夾缺 base branch 的前置失敗，已依明確錯誤補 `--base main`；未將失敗算成通過。
- build-extension.ps1 完成；ZIP 23項與來源／staging逐 byte 一致，SHA-256 `8507b928891cc59e5b54a2f929a5c4804ca6708e4ebbf4a57bec16fd64845ed0`。
- 最終快照 `output/mission-center-audit/product-20261002-35d5458e8da5/`，36份來源、封裝、日誌、截圖與預覽 harness 的 hash 均留在 manifest；parent 為 `audit-20261002-38c0e9e1ba15`。
- 內建瀏覽器合成預覽：1280×800 繁中收合；380×800 英文、24px、展開；380×560 日文語音錯誤與英文儲存錯誤。成功點選 retry saving 後警告隱藏；鍵盤混合錯誤焦點以 JSDOM 回歸驗證，未冒充 native Chrome 焦點實測。
- 本機 preview 只更改測試入口守衛，使用明確的假 voice／storage；實際 CSS 與其餘產品邏輯來自當前來源。不是 YouTube 擴充功能注入或真實語音聽感驗收。
- 最終畫面 `output/product-preview/desktop.jpg`。臨時分頁已關閉、viewport override已還原；預覽 server 僅限 127.0.0.1，收尾停止本輪所建程序。

## 尚待正式驗收

- 真實 Chrome 修正版注入、直播聊天室與音訊；擴充功能管理 URL 仍遭工具安全政策拒絕，不能以 IAB 合成畫面當成 covered。
- Mission Center 正式 critic_full 的3席＋獨立仲裁與收斂記錄，仍待此前資源預算答覆。既有提詞需改用本輪最終快照。
- main 仍為原始 HEAD 加未提交修改，manifest／package 3.0.1；本輪未做 Git push、商店上傳或宣稱商用品質已正式驗收。
