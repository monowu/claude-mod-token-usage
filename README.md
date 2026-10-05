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
- **按鈕**：`Details` 開啟詳情面板，`Hide` 隱藏趨勢帶

### 狀態列

顯示 `tokens: N% left`：5 小時與 7 天額度中剩餘最少的那個。沒有額度資料時（非訂閱帳號）改顯示 `ctx N%`。

### `/usage-detail` 詳情面板

- **Context window**：進度條、已用 / 總量 / 剩餘
- **各類別明細**：system prompt、tools、MCP、skills、messages 等的 token 數（顏色與 `/context` 一致）
- **最近一次呼叫**：input / output / cache read / cache write
- **Rate limits**：5 小時與 7 天視窗的已用 / 剩餘百分比與重置時間（僅訂閱帳號有）
- **Session cost**：這個 session 目前的花費

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
    "CLAUDE_CODE_PLUGIN_DIRS": "/絕對路徑/claude-mod-token-usage"
  }
}
```

存檔後**開新的 session** 才會生效。

## 使用

載入後：

1. 送出任一則訊息，提示框上方會出現趨勢帶（第一個回合結束前會先顯示 `waiting for data`）。
2. 按趨勢帶的 `Details`，或輸入 `/usage-detail` 開啟詳情面板。
3. 不想看到趨勢帶就按 `Hide`，要再顯示輸入 `/usage-band`。

## 注意事項

- 資料來源是 `$.session.usage()`，與狀態列的數字一致；不連網、不讀寫檔案。
- Rate limits 只有訂閱帳號會有，其他帳號面板會顯示 `None reported`。
- `Compact soon` 的 92% 門檻是寫死的，不是引擎真正的自動壓縮門檻。
- 顏色為固定色碼，未跟隨主題；深色主題下看起來最合適。
- 每 0.5 秒重畫一次趨勢帶來做動畫。
- 提示框可用寬度小於 60 欄時，趨勢帶會省略色塊和差值，只留圖示、百分比、token 數與按鈕。
- 趨勢紀錄（最近 12 回合）會跨 plugin 重新載入保留，但不跨 session。

## 檔案結構

```
.claude-plugin/plugin.json   plugin 描述
hooks/hooks.json             指向 register.tsx
hooks/register.tsx           所有邏輯：趨勢帶、狀態列、面板、指令
types/index.d.ts             mod 儲存狀態的型別宣告
```

## 授權

[MIT](LICENSE)
