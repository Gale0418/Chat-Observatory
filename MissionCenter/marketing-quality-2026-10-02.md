# 推薦與入門品質改善 · 2026-10-02

## 目的與範圍

依使用者「極致行銷奧格威」要求，讓首次接觸者能理解用途、找到安裝入口、完成第一次觀看／試聽，且推薦內容對得上程式能力。主要受眾是用第二螢幕或另一台聊天室電腦監看 YouTube 直播的使用者。

本輪改善現有文案、安裝指南、三語描述及操作文字，不新增雲端服務、分析追蹤、廣告投放或產品功能。已準備可直接使用的商店／推薦草稿，但尚未代發貼文、修改公開商店、提交 Git 或上傳新版本。

## 已修正

| ID | 確認問題 | 修正 |
| --- | --- | --- |
| MK-01 | README 首頁缺公開商店安裝入口，開發者安裝與資料揭露比首次成功流程更突出 | 繁中主頁改為用途→安裝→三步操作；英文指南保留獨立入口與支援連結 |
| MK-02 | 「另一台電腦」容易被理解為跨裝置中繼 | 說清楚每台各自安裝、開同一直播與保存設定；保留使用者原本的第二台電腦情境 |
| MK-03 | 短說明未交代朗讀是選用、本機 voice 可用性與新留言範圍 | 三語商店短說明與 locale 描述一致，明列有本機語音才可選擇朗讀新留言 |
| MK-04 | 只提自動配對，容易造成保證全語言或全女聲的期待 | 指南說明嘗試辨識語言、備援、已知女聲優先與裝置限制；候選改善未當成已發布 |
| MK-05 | 忙碌時「漏念」可能被當成與宣傳不符 | 指南、FAQ 與詳細商店說明揭露舊／過量等待留言可能略過，以畫面確認重要留言 |
| MK-06 | 首次使用者需猜 TTS、Test 與 Clear 的意思 | 三語 TTS 改成新留言朗讀、試聽明示語音，清空提示說明停止當下／清除等待但不關閉開關 |
| MK-07 | 商店文件仍寫 3.0.1 待審查、公開1.0.0 | 公開頁本輪成功讀到3.0.1、2026-09-25更新；文案區與維護者核對保留當前published/candidate界線 |
| MK-08 | 商店內容功能堆疊、主題全名與工程字詞擠壓用途 | 三語詳細文案改為使用情境、三步開始、主要選項、隱私與必要限制；另備短版／情境版推薦範本 |

沒有使用虛構的用戶見證、評分、成長百分比、效能數字，或「不漏留言／完全離線」等無法保證的承諾。品牌名稱與既有視覺維持不變。PRIVACY.md 法律／資料處理內容未修改。

## 已核對的公開證據

- [公開商店](https://chromewebstore.google.com/detail/chat-observatory/fibmebmihidnbhfajjagfnhoncokdnhf)：2026-10-02 取得公開3.0.1、更新2026-09-25；隱私與支援欄位分別指向 main/PRIVACY.md 與 Issues。
- [Issues](https://github.com/Gale0418/Chat-Observatory/issues)：本輪可讀，未代發問題。
- 政策 HTML 取得503；改讀[同一公開main的原始檔](https://raw.githubusercontent.com/Gale0418/Chat-Observatory/main/PRIVACY.md)成功，資料處理內容與本機政策一致。HTML 回應是否恢復尚未知，不把503宣稱已修好。
- 參照[Chrome官方商店頁建議](https://developer.chrome.com/docs/webstore/best-listing)：核心用途、準確承諾與最新功能截圖；不把早期docs截圖作為最新候選商店素材。

## 實作診斷與反證

- 一位隔離 Luna 完成唯讀文案／runtime 查證，再只修改英文指南；最終核對上述文案範圍沒有已確認的不實承諾或首次操作缺漏。
- 「移除另一台電腦」不是唯一正確修法；使用者的主要情境就是第二台電腦，因此採各自安裝說明，未移除情境。
- 短說明不堆入所有詳細限制：保留最會影響試用決策的本機語音可用性與新留言；忙碌聊天室、語音辨識、網路等限制放詳細說明與指南。
- 全套回歸第一次114/115：舊語系測試仍期待「試聴」；依本輪明確改字更新日／英既有斷言，修後115/115。沒有把這個測試期待值差異當runtime bug或另造重複測試。
- 最終content.js Impeccable detector為[]；既有content.css side-tab窄例外維持，未新增抑制。

## 驗證

- npm run verify：115/115、0fail；/tmp/chatobs-marketing-verify-final.log。
- 三語描述41／127／63字元，皆≤132，與STORE_LISTING一致；三份文件的本機Markdown連結目標存在。
- IAB合成：英文與日文380×800、面板24px，新試聽文字與按鈕可用，無水平溢出；繁中1280×800、20px。只驗證文案與合成操作，不是Chrome注入或本機音訊聆聽。
- 合成預覽位於output/marketing-preview/：desktop-zh.jpg、en-380.jpg、ja-380.jpg；本輪server PID48300已確認來源後SIGINT結束(exit0)。測試分頁已不在本輪inventory，viewport已reset。
- 建置完成；ZIP23項逐byte與來源/staging一致。SHA-256：7f512c2a28a87a41e92f476179b91807de8c3783f95c08e4951e57f991876df0。
- CodeRabbit raised 0 issues. 本輪準備9個產品檔案，CLI實際列出7個產品檔案＋.review-context.md。STORE_LISTING.md與docs/README.en.md未列入：兩者在暫存repo當時為untracked，未把7檔結果當成9檔通過。兩文件已加入暫存repo staging，保留下次額度的補審入口；本小時已完成3次，未再發第4次。兩文件已有Luna與本機查核，但不是CodeRabbit coverage。coverage.json與NDJSON留存；review packet與根目錄hash已核對。

## 原先驗收仍保留

真實Chrome修正版注入、音訊與正式critic_full未完成。本輪Luna為實作診斷助手，不當成正式席位或宣稱評審收斂。正式gate仍待先前總額、各席、工具與時間預算答覆；見Mission Center技能references/completion-critic-council.md。最終快照output/mission-center-audit/marketing-20261002-faaa22282de4/，以product-20261002-35d5458e8da5為parent，保留前輪runtime驗證脈絡。
