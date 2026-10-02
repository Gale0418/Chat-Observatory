<!-- Generated materialized view. Do not edit directly; rebuild from canonical MissionCenter files. -->
<!-- Deprecated compatibility view: focus.md is generated from tasks.md only and must never be edited or treated as a second lifecycle source. -->
<!-- mission-center-derived schema=1.0 fingerprint-format=sha256-v2-lf source-fingerprint=a1ab46209155f1a13c0f34607eeff4b6dc51093b932e02a40589771d64d8a002 -->
# P0 焦點

- 唯一真實來源: `tasks.md`
- 未完成 P0: 6

| ID | 標題 | 狀態 | 下一步 | 依賴 | 驗證方式 |
| --- | --- | --- | --- | --- | --- |
| CO-E1 | 維護已上架的純本機大字聊天室與 TTS 擴充功能 | In Progress | 交接商店Not allowed；補真Chrome/audio與正式gate limited覆核缺口 |  | 所有本次修復通過回歸、建置與 Chrome 驗證 |
| CO-H5 | 完成維護版 Chrome 真實聊天室驗收 | In Progress | 由使用者重載候選版後完成真實 Chrome 直播矩陣；管理頁遭工具安全政策阻擋 | CO-M1, CO-H4, CO-H9, CO-H10 | 維護版在一般 Chrome 真實直播完成注入、十二套主題、自訂背景、跨直播視窗切換、設定保存與本機 TTS 驗證 |
| CO-H6 | 修復跨直播聊天室視窗與第二螢幕邊界 | Review | 由 CO-H5 在重載新版後執行 A→A、A→B、寬螢幕與失效座標實機矩陣 | CO-H4 | session 綁定 windowId 與 videoId；相同直播聚焦、不同直播更新；8192×4320 內尺寸不被錯誤截斷，失效位置可回復 |
| CO-H7 | 修復設定生命週期、繁中介面與發布契約 | Review | 由 CO-H5 在重載新版後驗證 100ms 內關窗仍保存最新設定 | CO-H4 | 關窗前最後設定不遺失；zh-TW 無日文污染；文案只宣稱實際功能；manifest 明確限制支援版本 |
| CO-H8 | 重構 TTS active item、試聽恢復與 speech locale | Review | 由 CO-H5 在真實本機 voice 執行 A→試聽→A→B 與中日英模板驗收 | CO-H4 | 試聽不吞 active 留言；queue 順序不變；UI locale 不污染朗讀模板；未知語言採中性正文 fallback |
| CO-H9 | 完成 P0 回歸、發布建置與驗收前門檻 | Review | 交接商店Not allowed；補真Chrome/audio與正式gate limited覆核缺口 | CO-H6, CO-H7, CO-H8 | 所有事故案例具可重複測試；npm verify 與 build:extension 通過；Mission Center 留存證據 |
