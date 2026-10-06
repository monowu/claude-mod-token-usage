declare module 'claude-code' {
  interface PluginState {
    'token-usage': {
      usage: unknown
      history: { tokens: number; percent: number }[]
      isHidden: boolean
      showQuota: boolean
    }
  }
}
