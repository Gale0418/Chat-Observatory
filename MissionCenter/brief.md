<!-- Generated materialized view. Do not edit directly; rebuild from canonical MissionCenter files. -->
<!-- mission-center-derived schema=1.0 fingerprint-format=sha256-v2-lf source-fingerprint=6d12d1ccb205fb56ee4b2c3d807b432a856b136ff43493b67135251172a698e7 -->
# 任務簡報

- 最後整理: 2026-08-15
- 來源指紋: `6d12d1ccb205fb56ee4b2c3d807b432a856b136ff43493b67135251172a698e7`
- 唯一真實來源: `tasks.md`
- 專案: YT Chat Enlarger 上架版
- 北極星: 維護純本機第二電腦大字監看與 TTS 擴充功能，並保持發布產物可重建、可驗證
- 週期: v3.0.0 上架準備

## 今日摘要 · 2026-08-15
- 修復 INC-001：控制面板不再插入 YouTube #items，改為 BODY fixed 並以 ResizeObserver 同步聊天區 offset；補留言順序測試與真實內部 scroller fixture，Chrome 兩尺寸捲動驗收重疊 0px，37/37 tests 與 ZIP 通過。
- 修復 TTS 開啟意圖被延遲 voice 覆寫：等待語音時保留開關並顯示明確狀態，voiceschanged 後自動續讀；新增 12 則批次留言 1→12 順序朗讀測試，全套 38/38 通過。
- 新增純本機多語 voice 路由：可切換自動保守配對／固定聲音，依原始留言選 voice 且維持單一 FIFO；Chrome 實機確認 180+ 本機 voice、自動與固定狀態、四主題零溢位，46/46 tests 與 ZIP 通過。
- 依社群聽感強化每語言推薦排序：Premium／Enhanced／Natural／Siri、系統預設與常見標準人聲加分，角色／搞怪 voice 降權；日文確定由 Eddy／Flo 改選 Kyoko，47/47 tests 與 ZIP 通過。

## 重要護欄 (0)
- 無

## 需要時再讀
- 目前工作（3 項）→ `working-set.md`
- 修改任務生命週期／順序 → `tasks.md`
- 查閱理由／證據 → `decisions.md`、`notes.md`、`smoke-tests.md`
- 簡報／工作集過期或截斷 → 執行 `mission_maintenance.py sync` 後再讀 canonical files
