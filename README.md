# claude-mod-token-usage

一個 Claude Code mod，讓你隨時看到 context 與額度還剩多少。支援終端機與桌面版（Code 分頁）。

## 功能

### 提示框上方的趨勢帶

每回合結束後更新，一行顯示：

- **天氣圖示**（會動）：依 context 用量變化

  | 用量 | 圖示 | 顏色 |
  |---|---|---|
  | < 40% | ☀ | 綠 |
  | 40–65% | ☁ | 黃 |
  | 65–85% | ☂ | 橘 |
  | ≥ 85% | ⛈ / ⚡ | 紅 |
  | ≥ 92% | ↯ 並顯示 `Compact soon` | 紅 |

- **百分比與 token 數**：例如 `48% · 96.2k / 200k`
- **最近 12 回合的色塊**：每回合一個大小相同的方塊，顏色代表當時的用量（綠、黃、橘、紅），可看出 context 怎麼漲
- **與上一回合的差值**：以 token 數表示，例如 `▲ +98.3k` / `▼ 12.1k`
- **按鈕**：`Compact` 緊接在讀數後面（只在 context 視圖）；右側依序是視圖切換、`Details`、`Hide`

**兩個視圖**：用右側按鈕在 `Context` 與 `5h quota` 之間切換，兩者不會同時顯示。`5h quota` 視圖顯示 5 小時額度的進度條、已用 / 剩餘、步調與重置時間；寬度 ≥ 110 欄顯示完整，60–109 欄精簡，更窄只留重點。

**Compact 按鈕**：能直接壓縮的環境（終端機）一鍵完成。桌面版 app 不允許外掛直接壓縮，所以按鈕會把 `/compact` 填進輸入框，再按 Enter 執行（外掛無法替你移動輸入焦點）。壓縮後趨勢帶會立刻降到壓縮後的大小。

### 狀態列

顯示 `tokens: N% left`：5 小時與 7 天額度中剩餘最少的那個。沒有額度資料時（非訂閱帳號）改顯示 `ctx N%`。

後面會多一個**步調**箭頭，見下方「額度步調」。

### `/usage-detail` 詳情面板

- **Context window**：進度條、已用 / 總量 / 剩餘
- **各類別明細**：system prompt、tools、MCP、skills、messages 等的 token 數（顏色與 `/context` 一致）
- **最近一次呼叫**：input / output / cache read / cache write
- **Rate limits**：5 小時與 7 天視窗的已用 / 剩餘百分比、重置時間與步調（僅訂閱帳號有）
- **Session cost**：這個 session 目前的花費

### 額度步調

額度剩 60% 不代表安全：重點是離視窗重置還有多久。步調 = 視窗已用的百分比 − 視窗已經過的時間百分比。例如 5 小時視窗用了 40%，但時間只過了 25%，步調就是 `+15%`，表示燒得比時間快，照這樣下去撐不到重置。

| 符號 | 條件 | 顏色 |
|---|---|---|
| ⇡ | 步調 ≥ +3%（比時間快） | 紅 |
| ≈ | 在 ±3% 之間 | 灰 |
| ⇣ | 步調 ≤ −3%（比時間慢） | 綠 |

- **狀態列**：顯示用量最高的那個視窗的箭頭，例如 `tokens: 62% left ⇡`。
- **`/usage-detail`**：每個視窗在重置時間下面多一行，例如 `pace ⇡ +15% (25% of the window elapsed)`。
- 沒有重置時間，或不是 5 小時與 7 天視窗（例如 `spend_limit`）時不顯示步調。

### `/usage-band`

切換趨勢帶的顯示與隱藏。按過 `Hide` 之後，用這個指令叫回來。（`/usage-detail` 也會順便取消隱藏。）

## 安裝

### 終端機

```bash
git clone https://github.com/monowu/claude-mod-token-usage.git
claude --plugin-dir ./claude-mod-token-usage
```

### 桌面版 app

桌面版沒辦法加命令列參數，改在 `~/.claude/settings.json` 設定環境變數，指向 clone 下來的資料夾：

```json
{
  "env": {
    "CLAUDE_CODE_PLUGIN_DIRS": "/絕對路徑/claude-mod-token-usage",
    "CLAUDE_CODE_PLUGIN_DIR_WATCH": "1"
  }
}
```

存檔後**開新的 session** 才會生效。

`CLAUDE_CODE_PLUGIN_DIR_WATCH` 是選填的，開發時才需要：設了之後，改動 plugin 資料夾內的檔案會自動重載，不必開新 session（已在桌面版實測）。

## 使用

載入後：

1. 送出任一則訊息，提示框上方會出現趨勢帶（第一個回合結束前會先顯示 `waiting for data`）。
2. 按趨勢帶的 `Details`，或輸入 `/usage-detail` 開啟詳情面板。
3. 不想看到趨勢帶就按 `Hide`，要再顯示輸入 `/usage-band`。

## 注意事項

- 資料來源是 `$.session.usage()`，與狀態列的數字一致；不連網、不讀寫檔案。
- Rate limits 只有訂閱帳號會有，其他帳號面板會顯示 `None reported`。
- `Compact soon` 的 92% 門檻是寫死的，不是引擎真正的自動壓縮門檻。
- 顏色為固定色碼，未跟隨主題；深色主題下看起來最合適。終端機與桌面版都會顯示顏色。
- 天氣圖示加了 U+FE0E（文字樣式選擇符），避免桌面版把 `⚡` 畫成彩色 emoji。
- 每 0.5 秒重畫一次趨勢帶來做動畫。
- 提示框可用寬度小於 60 欄時，趨勢帶會省略色塊和差值，只留圖示、百分比、token 數與按鈕。
- 趨勢紀錄（最近 12 回合）存在 session 狀態裡：plugin 重新載入時會保留（已實測），開新 session 則從空的開始（已實測）。
- compact 之後會補一筆紀錄，趨勢帶降到 compact 後的大小（不含 system prompt 與工具定義，所以略低於下一回合的實際值），下一回合結束後再改回即時數字。

## 檔案結構

```
.claude-plugin/plugin.json   plugin 描述
hooks/hooks.json             指向 register.tsx
hooks/register.tsx           所有邏輯：趨勢帶、狀態列、面板、指令
types/index.d.ts             mod 儲存狀態的型別宣告
```

## 授權

[MIT](LICENSE)
