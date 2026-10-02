# 換景樂趣與可靠性修補驗收

## 更新內容

- 自動語音依可辨識語言優先挑選已知女聲，保留固定模式；顏文字不因符號或日文樣式字元誤判。
- 常駐朗讀開關、獨立儲存／語音錯誤提示與重試、三語操作文案與小視窗修復。
- 隨機換不同主題與返回上一款；有界記憶，設定載入後才啟用，自訂背景與TTS FIFO保留。
- 設定的dirty／queued／in-flight寫入與外部通知邊界修復；已送出舊值完成後用同一保存佇列還原最新設定，中途本地新操作優先。
- 舊tab ID／loading狀態不再作導航身分證明；只重用URL/pendingUrl/probe確認的聊天室，保留無法確認的舊頁並另開聊天室。
- 隱藏頭像時尺寸滑桿真正隱藏；待存值被外部取代後清除過期儲存失敗提示與恢復焦點。

## 驗證與外部審查

- `npm run verify`最終**129/129**，0fail；新回歸先重現再修復。最終log `chatobs-reconcile-verify-final.log`。
- IAB合成桌面1280×800與380×800/24px，中英日換景／返回、Space/Enter與焦點，無水平溢出；**不是實際Chrome注入／音訊聽感驗收**。
- CodeRabbit本輪full20產品檔：2minor，均重現修復；focused5檔：0issues；council修補6檔：1major（storage殘留舊值），已本機重現補修。每次actual reviewedFiles都包含全部prepared產品檔，STORE與英文guide漏審已補足。
- 最後major補修及歧義通知實值讀回未再經CodeRabbit：本小時3次額度已用完。明確保存外部覆核缺口，不宣稱最終0issues。
- 正式critic_full：3位隔離Luna初稿＋獨立仲裁完成；兩P2經仲裁確認並修復。storage後由Rabbit major升為P1處置，同一finding ID保留，最終129本機驗證已修復。
- 正式gate **limited**：required real-chrome-audio未知；TTS席11tools超10上限1次，security8、operator8、仲裁6，合計33。修正版完成前總20分鐘已到，final全席closure未派送，不補造passed/Done。已安裝package缺少技能引用的scripts/critic_contract.py，沒有宣稱該validator通過。
- Impeccable沒有新增設計finding；既有頂部主題光帶窄例外保留，未新增ignore。

## 快照與交接

最終來源：`output/mission-center-audit/release-final-20261002-9a828401ed4e/`，parent `release-20261002-335fc7620c22`，manifest.json.snapshot列37來源及證據SHA。初稿與穩定finding ledger、limited chair record在`output/mission-center-critique/CO-H9-release-20261002-335fc7620c22/`。原始回條／hash／負向與正向回歸保持區別。

[Chrome官方更新流程](https://developer.chrome.com/docs/webstore/update)：開發者控制台選既有item `fibmebmihidnbhfajjagfnhoncokdnhf`，Package→Upload New Package選上述ZIP，核對3.1.0，再Submit for Review並選通過後自動發布。商店可採STORE_LISTING.md三語核心草稿，取得實際回條後才更新送審狀態。

本次自建server PID55232已核對命令/cwd/port後SIGINT exit0；IAB預覽與自建空白Chrome頁已關閉、viewport reset。沒有關閉工具的Luna程序不宣稱已回收。
