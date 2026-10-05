import type { SessionUsage } from 'claude-code'

declare module 'claude-code' {
  interface PluginState {
    'token-usage': { usage: SessionUsage | null; history: number[]; isHidden: boolean }
  }
}
