# 每日紀錄

- 最後整理： 2026-09-25

## 2026-08-20
- 完成 CodeRabbit 修正版外部審查：只送出 19 個小型文字檔，排除主題圖片、商店截圖、ZIP、`dist` 與鎖檔；首輪 3 個有效 finding 已修復（Chrome/CSS 相容門檻、TTS 試聽後過期計時、視覺 fixture 節點防呆），最後一輪 0 findings。本小時共使用 3 次額度，未超過 150 檔限制。
- 新增 CO-H10 純本機自訂背景：支援 JPG／PNG／WebP，匯入時依橫直向縮至 2560×1440 或 1440×2560 並轉 WebP；圖片以獨立 storage key 保存，不新增權限或網路傳輸。60/60 測試與 v1.0.0 ZIP 通過，待 Chrome 真圖實機驗收。
- 完成 CO-H6 至 CO-H8：跨直播 session／視窗切換、8192×4320 與失效座標、pagehide 設定 flush、繁中／發布契約、TTS active item／試聽／speech locale 均已補測與修正。
- CO-H9 自動門檻通過：`npm run verify` 60/60、`npm run build:extension` 與 ZIP 清單驗證成功；CodeRabbit 修正版最終審查 0 findings。Antigravity delta RPC 與 Chrome 最新版實機仍保留為 Review／手動驗收證據，不冒充通過。

## 2026-08-16
- 依使用者回饋重繪十二套宇宙背景：由寬幅遠景改為星體／星雲近距離特寫，主體可裁切出畫面邊緣，僅保留少量文字可讀暗部；12 張統一為 1672×941 JPEG，並降低十二色主題的背景遮罩避免重新壓黑。
- 重新執行 `npm run verify`：51/51 通過；`npm run build:extension` 完成，ZIP 與來源各包含 12 張 `cosmic-spectrum-*.jpg`。

## 2026-08-15
- 修復 INC-001：控制面板不再插入 YouTube #items，改為 BODY fixed 並以 ResizeObserver 同步聊天區 offset；補留言順序測試與真實內部 scroller fixture，Chrome 兩尺寸捲動驗收重疊 0px，37/37 tests 與 ZIP 通過。
- 修復 TTS 開啟意圖被延遲 voice 覆寫：等待語音時保留開關並顯示明確狀態，voiceschanged 後自動續讀；新增 12 則批次留言 1→12 順序朗讀測試，全套 38/38 通過。
- 新增純本機多語 voice 路由：可切換自動保守配對／固定聲音，依原始留言選 voice 且維持單一 FIFO；Chrome 實機確認 180+ 本機 voice、自動與固定狀態、四主題零溢位，46/46 tests 與 ZIP 通過。
- 依社群聽感強化每語言推薦排序：Premium／Enhanced／Natural／Siri、系統預設與常見標準人聲加分，角色／搞怪 voice 降權；日文確定由 Eddy／Flo 改選 Kyoko，47/47 tests 與 ZIP 通過。
- 四套畫風重製為赤曜／玄曜／翠曜／金曜：加入紅晶、碳纖鍍鉻、祖母綠玻璃與香檳金拉絲材質，強化大片方向性漸層、內框流光與啟用按鈕高光掃過；Chrome 桌面與 430px 驗收零溢位，50/50 tests 與 ZIP 通過。
- 四主題升級為宇宙材質：赤曜超新星、玄曜黑洞、翠曜星雲晶礦、金曜恆星熔爐；生成背景壓縮後隨套件封裝，延伸至聊天室外層畫布，並加入主題文字色、暗／亮反色描邊。Chrome 四主題與 430px 驗收零溢位，50/50 tests 與 12 檔 ZIP 通過。

## 2026-08-14
- MissionCenter 已遷移至最新任務模式：去除重複驗收任務、補齊工作集與重大教訓層，並重新產生摘要與 HUD。 已記錄冒煙測試: 17.
- 依 Chrome 實機截圖修正主題範圍與設定列：四套畫風涵蓋聊天室主體，面板改為訊息流內嵌 sticky 設定列。 已記錄冒煙測試: 18.
- 以 Impeccable 4.0.4 做 bounded polish：補齊四主題瀏覽器表面與狀態、CSS 幾何收合圖示，修正 430px 水平溢出及 visual fixture ready race；Chrome 四主題驗收、36/36 tests 與發布 ZIP 通過。

## 2026-08-12
- 完成 URL、MV3、TTS、Observer、無障礙、發布工具與 Chrome 實機全面強化；待手動重載新版後最終驗收 已記錄 Smoke tests: 13.
- 完成直播導播控制台視覺升級；依 taste-skill 的既有產品 redesign 原則統一單一重點色、圓角、表面與互動，並完成桌面、窄版、收合、閱讀模式與自動測試驗收。
- 新增熔岩、極光、紙墨三套可持久化畫風；完成設定白名單、跨視窗同步、桌面與窄版視覺驗收，並修正 PowerShell 在 macOS 的 IsWindows 變數碰撞。
- 依使用者決定將畫風固定為四套並全面華麗化：熔岩、極光、紙墨、星夜以材質、圓角、字體、頭像與聊天卡建立顯著差異；桌面、430px 窄版與 35 項回歸均通過。
