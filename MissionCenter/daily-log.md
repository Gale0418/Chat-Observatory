# 每日紀錄

- 最後整理： 2026-08-15

## 2026-08-15
- 修復 INC-001：控制面板不再插入 YouTube #items，改為 BODY fixed 並以 ResizeObserver 同步聊天區 offset；補留言順序測試與真實內部 scroller fixture，Chrome 兩尺寸捲動驗收重疊 0px，37/37 tests 與 ZIP 通過。
- 修復 TTS 開啟意圖被延遲 voice 覆寫：等待語音時保留開關並顯示明確狀態，voiceschanged 後自動續讀；新增 12 則批次留言 1→12 順序朗讀測試，全套 38/38 通過。
- 新增純本機多語 voice 路由：可切換自動保守配對／固定聲音，依原始留言選 voice 且維持單一 FIFO；Chrome 實機確認 180+ 本機 voice、自動與固定狀態、四主題零溢位，46/46 tests 與 ZIP 通過。
- 依社群聽感強化每語言推薦排序：Premium／Enhanced／Natural／Siri、系統預設與常見標準人聲加分，角色／搞怪 voice 降權；日文確定由 Eddy／Flo 改選 Kyoko，47/47 tests 與 ZIP 通過。

## 2026-08-14
- MissionCenter 已遷移至最新任務模式：去除重複驗收任務、補齊工作集與重大教訓層，並重新產生摘要與 HUD。 已記錄冒煙測試: 17.
- 依 Chrome 實機截圖修正主題範圍與設定列：四套畫風涵蓋聊天室主體，面板改為訊息流內嵌 sticky 設定列。 已記錄冒煙測試: 18.
- 以 Impeccable 4.0.4 做 bounded polish：補齊四主題瀏覽器表面與狀態、CSS 幾何收合圖示，修正 430px 水平溢出及 visual fixture ready race；Chrome 四主題驗收、36/36 tests 與發布 ZIP 通過。

## 2026-08-12
- 完成 URL、MV3、TTS、Observer、無障礙、發布工具與 Chrome 實機全面強化；待手動重載新版後最終驗收 已記錄 Smoke tests: 13.
- 完成直播導播控制台視覺升級；依 taste-skill 的既有產品 redesign 原則統一單一重點色、圓角、表面與互動，並完成桌面、窄版、收合、閱讀模式與自動測試驗收。
- 新增熔岩、極光、紙墨三套可持久化畫風；完成設定白名單、跨視窗同步、桌面與窄版視覺驗收，並修正 PowerShell 在 macOS 的 IsWindows 變數碰撞。
- 依使用者決定將畫風固定為四套並全面華麗化：熔岩、極光、紙墨、星夜以材質、圓角、字體、頭像與聊天卡建立顯著差異；桌面、430px 窄版與 35 項回歸均通過。
