# 本輪正式評審已完成初稿，limited checkpoint

初稿來源release-20261002-335fc7620c22；最終本機修正版release-final-20261002-9a828401ed4e。全席final closure未派送，詳細預算／能力與處置見release-3.1.0-2026-10-02.md；以下保留已派送席位的原始準備提詞，不代表最終passed。

# 維護版正式專家驗收封包（預算已核准、分席唯讀驗收中）

## 任務與共同規則

- 任務：CO-E1／CO-H9，已上架 Chat Observatory 維護版；auto 同語言女聲優先、localService=true、FIFO、跨視窗設定安全。
- 凍結來源：`/Volumes/NASDisk/MYAPP/ChatObservatory/output/mission-center-audit/release-20261002-335fc7620c22/`。
- 檔案與 ZIP SHA-256：該資料夾的 `manifest.json.snapshot`。先核對 hash；不讀正在變動的工作樹冒充相同快照。
- 前次runtime處置見product-quality-2026-10-02.md，本輪文案見marketing-quality-2026-10-02.md。前輪15+3與本輪完整20檔／focused5檔證據留存；本輪2minor均重現修復、focused0issues，STORE與英文guide已涵蓋。尚無正式評論初稿。
- 本機證據：快照內 `evidence/chatobs-release-verify-final.log`（124/124）、`evidence/chatobs-release-build-final.log`；封裝 23 項與來源／staging 逐 byte 一致。
- 使用繁體中文、唯讀，不修改程式、任務狀態、證據或其他評論；不要啟動 CodeRabbit。
- 初稿彼此隔離，禁止閱讀其他評論者報告；仲裁者於所有初稿封存後進場。
- 每個 finding 須列 P0–P3、category、observation、精確檔案／行號、重現或讀取路徑、impact、confidence、unknown、最小建議與建議處置。主代理決定是否採用。
- 嚴重度依可觸發影響判斷。偏好、未知與範圍外改善分開列；沒有證據不能製造 finding。
- 沒有 P0/P1 後停止廣泛挑剔，修完所有已確認 P2/P3，再做針對修復與既定驗收的收尾檢查。只有新 P0/P1 才重開挑剔輪次。
- 可讀快照內 evidence/desktop.jpg 及 IAB 合成流程證據，但不能將合成voice/storage或測試入口視為真實YouTube注入。
- 不宣稱聽過語音或完成 Chrome 操作驗收。Chrome 分頁清單可讀，但管理頁遭工具 URL 安全政策拒絕，商店頁回傳 Not allowed，尚無載入修正版的實機證據；對實際渲染／聽感標 unknown，不能用讀碼填成 covered。
- 預算：使用者已核准。總額總計24,000 tokens／40次工具／20分鐘，每席6,000 tokens／10次工具／5分鐘；核准涵蓋本輪及可能delta，總額不重置；不擴張授權額度。

## 席位一：TTS 與資料一致性專家

你負責 content.js 與相關回歸中的 TTS 錯誤恢復、試聽→原留言→後續留言順序、失效回呼、佇列上限與過期、設定 dirty revisions 與延遲寫入，以及已移除／已換容器的 renderer。重點挑戰失敗與成功交錯的時間序列，而非只看 happy path。請嘗試提出最小反例，或核對已存證測試是否真的覆蓋該反例。同時核對隨機換景debounce、外部更新取消未送dirty/queued、保存失敗提示清除；不評論背景視窗或美術風格。

## 席位二：擴充功能安全與可靠性專家

你負責 background.js、manifest、build-extension.ps1 與背景測試：URL／content probe 信任邊界、popup 所有權、session 序列化、bounds 有上限重試與新舊寫入交錯、純本機與封裝白名單／路徑安全。不要把使用者已導向他站的視窗當成本程式可任意關閉的資源。不替不存在的權限或未重現的 Chrome 行為造問題，也不重複 TTS 內部與 CSS 席位。

## 席位三：直播操作與可及性專家

你負責從「直播主在第二螢幕監看」的任務流程檢查控制面板：開啟／關閉語音、失敗提示與手動試聽／跳過、三語文案、鍵盤焦點、收合控制關聯、文字與選中漸層對比、極端字級／窄視窗的可驗證風險。只依提供的 DOM／CSS／測試提出靜態結論。請明列 real Chrome、原生選單與語音聽感未驗證，不把 code review 當成視覺或音訊驗收；核對新換景/返回ARIA、三語文字與隱藏頭像slider；不擴張成新功能或改美術方向。

## 獨立證據仲裁者

你不能兼任前三席。等待前三份初稿封存，逐項對照同一快照、hash、實測輸出與重現方式；去除重複根因，保留有根據的少數意見。對每項指出支持／反證／仍未知與原因；檢查 severity、驗收範圍、缺漏的真實操作能力。提出剩餘有效問題清單與覆蓋矩陣。不能以多數決替代驗證，也不能替使用者接受尚未修復的風險。三席最後的 closure report 與仲裁回條須對應修復後同一快照，才能建議正式通過。
