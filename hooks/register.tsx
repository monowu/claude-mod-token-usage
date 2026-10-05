// token-usage v0.3.0: quota pace delta, narrow layout, token deltas (history lives in $.state)
import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

const PANE = 'token-usage'
const usage = atom({ plugin: 'token-usage', key: 'usage' } as const, null)
const history = atom({ plugin: 'token-usage', key: 'history' } as const, [])
const isHidden = atom({ plugin: 'token-usage', key: 'isHidden' } as const, false)
let frame = 0
// U+FE0E asks for text presentation, so the desktop app doesn't draw ⚡ as a color emoji
const T = '\uFE0E'
const weather = (pct: number, f: number) => {
  const i = f % 4
  if (pct >= 92) return i % 2 === 0 ? '↯ ' : '  '
  if (pct < 40) return [`☀${T} `, '☼ ', `☀${T} `, '☼ '][i]
  if (pct < 65) return [`☁${T}  `, ` ☁${T} `, `  ☁${T}`, ` ☁${T} `][i]
  if (pct < 85) return [`☂${T} ·`, `☂${T} ˙`, `☂${T} ·`, `☂${T} .`][i]
  return i % 2 === 0 ? `⛈${T} ` : `⚡${T} `
}
const tone = (pct: number) => (pct >= 85 ? '#ef4444' : pct >= 65 ? '#f97316' : pct >= 40 ? '#eab308' : '#22c55e')

const fmt = (n: number) =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`
    : n >= 1000
      ? `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`
      : String(n)
// Pace: how far the window's used share is ahead (+) or behind (-) the share of its time already elapsed.
const WINDOW_MS: Record<string, number> = { five_hour: 5 * 3600_000, seven_day: 7 * 86_400_000 }
const pace = (r: any) => {
  const len = WINDOW_MS[r.kind]
  if (!len || !r.resetsAt) return undefined
  const left = new Date(r.resetsAt).getTime() - Date.now()
  if (Number.isNaN(left)) return undefined
  const elapsed = Math.min(100, Math.max(0, (1 - left / len) * 100))
  return { elapsed, delta: r.percentUsed - elapsed }
}
const paceMark = (d: number) => (d >= 3 ? '⇡' : d <= -3 ? '⇣' : '≈')
const paceColor = (d: number) => (d >= 3 ? '#ef4444' : d <= -3 ? '#22c55e' : '#9ca3af')
const statusText = (u: any) => {
  const rl = u.rateLimits as any[]
  const worst = rl.length ? rl.reduce((a, b) => (b.percentUsed > a.percentUsed ? b : a)) : undefined
  if (!worst) return `tokens: ctx ${Math.round(u.context.percent ?? 0)}%`
  const p = pace(worst)
  return `tokens: ${Math.round(Math.max(0, 100 - worst.percentUsed))}% left${p ? ` ${paceMark(p.delta)}` : ''}`
}
const label = (kind: string) =>
  kind === 'five_hour' ? '5-hour window' : kind === 'seven_day' ? '7-day window' : kind

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    $.clock.every(500, () => {
      frame += 1
      $.ui.invalidate('ui.render')
    })
    await $.command.register({ name: 'usage-detail', description: 'Show remaining token usage in a pane' })
    await $.command.register({ name: 'usage-band', description: 'Toggle the token trend band above the prompt' })
    let u: any
    try {
      u = await $.session.usage({ breakdown: 'summary' })
    } catch {
      u = await $.session.usage()
    }
    await update($, usage, () => u)
    $.ui.status(statusText(u))
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (!e.agentId) {
      const u = await $.session.usage()
      const tokens = u.context.tokens ?? 0
      const percent = Math.round(u.context.percent ?? 0)
      if (tokens > 0) {
        await update($, history, list => [...list.filter(x => typeof x === 'object'), { tokens, percent }].slice(-12))
      }
    }
    return next(e)
  })

  // After a compaction the next response hasn't come yet, so context.tokens is empty;
  // record the post-compaction size so the band drops to it instead of going blank.
  on('session.compact', async ($, e, next) => {
    const r = await next(e)
    if (!e.agentId && e.trigger !== 'precompute' && r.messages) {
      const { window } = (await $.session.usage()).context
      const tokens = r.tokensAfter ?? 0
      const percent = window ? Math.round((tokens / window) * 100) : 0
      await update($, history, list => [...list.filter(x => typeof x === 'object'), { tokens, percent }].slice(-12))
    }
    return r
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const u = await read($, usage)
    const hist = (await read($, history)).filter(x => typeof x === 'object')
    if (e.props.hasSurvey || (await read($, isHidden))) return next(e)
    const { Box, Button, Text } = $.ui.resolve(e)
    const last = hist[hist.length - 1]
    if (!u || (u.context.tokens === undefined && !last))
      return (
        <Box>
          <Text dimColor>token-usage: waiting for data (send a message) </Text>
          <Button key="details" label="Details" onPress={() => $.ui.open({ id: PANE, title: 'Token usage' })} />
        </Box>
      )
    const isLive = u.context.tokens !== undefined
    const pct = isLive ? Math.round(u.context.percent ?? 0) : last.percent
    const shown = hist
    const tokens = isLive ? u.context.tokens : last.tokens
    const icon = weather(pct, frame)
    const delta = shown.length > 1 ? shown[shown.length - 1].tokens - shown[shown.length - 2].tokens : 0
    const isWide = (e.props.bodyColumns ?? 80) >= 60
    return (
      <Box>
        <Box width={4}>
          <Text color={tone(pct)} bold>
            {icon}
          </Text>
        </Box>
        <Text color={tone(pct)} bold>
          {pct}%
        </Text>
        <Text dimColor> · {fmt(tokens)} / {fmt(u.context.window)} </Text>
        {isWide &&
          shown.map(x => (
            <Text color={tone(x.percent)}>■ </Text>
          ))}
        {isWide && (
          <Text color={delta > 0 ? '#f97316' : '#22c55e'}>
            {delta === 0 ? '' : ` ${delta > 0 ? '▲ +' : '▼ '}${fmt(Math.abs(delta))}`}
          </Text>
        )}
        <Text color="#ef4444" bold>
          {pct >= 92 ? ' · Compact soon' : ''}
        </Text>
        <Text> </Text>
        <Button key="details" label="Details" onPress={() => $.ui.open({ id: PANE, title: 'Token usage' })} />
        <Text> </Text>
        <Button key="hide" label="Hide" onPress={() => update($, isHidden, () => true)} />
      </Box>
    )
  })

  on('session.measure', async ($, e, next) => {
    let u: any
    try {
      u = await $.session.usage({ breakdown: 'summary' })
    } catch {
      u = await $.session.usage()
    }
    await update($, usage, () => u)
    $.ui.status(statusText(u))
    return next(e)
  })

  on('command.run', { command: 'usage-band' }, async $ => {
    const wasHidden = await read($, isHidden)
    await update($, isHidden, () => !wasHidden)

    return { text: wasHidden ? 'Token band shown.' : 'Token band hidden.' }
  })

  on('command.run', { command: 'usage-detail' }, async $ => {
    await update($, isHidden, () => false)
    let u: any
    try {
      u = await $.session.usage({ breakdown: 'summary' })
    } catch {
      u = await $.session.usage()
    }
    await update($, usage, () => u)
    $.ui.status(statusText(u))
    await $.ui.open({ id: PANE, title: 'Token usage' })
    return { text: 'Token usage pane opened.' }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const u = await read($, usage)
    if (!u) return <Text dimColor>No data yet.</Text>
    const ctx = u.context
    const b = ctx.breakdown
    const used = Math.round(ctx.percent ?? 0)
    const cells = (pct: number) => Math.round((Math.min(100, Math.max(0, pct)) / 100) * 24)
    return (
      <Box flexDirection="column">
        <Text bold color="#60a5fa">Context window</Text>
        <Box>
          <Text color={tone(used)}>{'█'.repeat(cells(used))}</Text>
          <Text dimColor>{'░'.repeat(24 - cells(used))}</Text>
          <Text color={tone(used)} bold> {used}%</Text>
          <Text> · {fmt(ctx.tokens ?? 0)} / {fmt(ctx.window)} </Text>
          <Text color="#22c55e">(left {fmt(ctx.window - (ctx.tokens ?? 0))})</Text>
        </Box>
        {b && (
          <Box flexDirection="column" marginTop={1}>
            <Text color="#a78bfa">model {b.model}</Text>
            {b.categories
              .filter(c => c.kind === 'used' || c.kind === 'deferred')
              .map(c => (
                <Box>
                  <Box width={26}>
                    <Text color={c.isDeferred ? undefined : c.color} dimColor={c.isDeferred}>{c.name}</Text>
                  </Box>
                  <Text bold>{fmt(c.tokens)}</Text>
                </Box>
              ))}
            {b.apiUsage && (
              <Box marginTop={1}>
                <Text dimColor>last call: </Text>
                <Text color="#60a5fa">in {fmt(b.apiUsage.input_tokens)}</Text>
                <Text dimColor> · </Text>
                <Text color="#f97316">out {fmt(b.apiUsage.output_tokens)}</Text>
                <Text dimColor> · </Text>
                <Text color="#22c55e">cache read {fmt(b.apiUsage.cache_read_input_tokens)}</Text>
                <Text dimColor> · </Text>
                <Text color="#eab308">cache write {fmt(b.apiUsage.cache_creation_input_tokens)}</Text>
              </Box>
            )}
          </Box>
        )}
        <Box flexDirection="column" marginTop={1}>
          <Text bold color="#60a5fa">Rate limits</Text>
          {u.rateLimits.length === 0 && <Text dimColor>None reported (not a subscription, or no response yet).</Text>}
          {u.rateLimits.map(r => (
            <Box flexDirection="column">
              <Box>
                <Box width={15}>
                  <Text>{label(r.kind)}</Text>
                </Box>
                <Text color={tone(r.percentUsed)}>{'█'.repeat(cells(r.percentUsed))}</Text>
                <Text dimColor>{'░'.repeat(24 - cells(r.percentUsed))}</Text>
                <Text color={tone(r.percentUsed)} bold> {Math.round(r.percentUsed)}% used</Text>
                <Text color="#22c55e"> · {Math.round(100 - r.percentUsed)}% left</Text>
              </Box>
              {r.resetsAt && <Text dimColor>  resets {new Date(r.resetsAt).toLocaleString()}</Text>}
              {pace(r) && (
                <Box>
                  <Text dimColor>  pace </Text>
                  <Text color={paceColor(pace(r)!.delta)} bold>
                    {paceMark(pace(r)!.delta)} {pace(r)!.delta >= 0 ? '+' : '-'}{Math.abs(Math.round(pace(r)!.delta))}%
                  </Text>
                  <Text dimColor> ({Math.round(pace(r)!.elapsed)}% of the window elapsed)</Text>
                </Box>
              )}
            </Box>
          ))}
        </Box>
        {u.cost && (
          <Box marginTop={1}>
            <Text bold color="#60a5fa">Session cost </Text>
            <Text color="#eab308" bold>${u.cost.usd.toFixed(2)}</Text>
          </Box>
        )}
      </Box>
    )
  })
}
