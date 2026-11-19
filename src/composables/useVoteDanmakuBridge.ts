import { type MaybeRefOrGetter, onScopeDispose, toValue, watch } from 'vue'

import { useAccount } from '@/api/account'
import type { EventModel } from '@/api/client-types'
import type { ResponseVoteSession, VoteConfig } from '@/api/generated/model'
import { getVoteConfig, tryVoteEvent } from '@/api/vote'
import { useDanmakuClient } from '@/store/useDanmakuClient'

export interface UseVoteDanmakuBridgeOptions {
  config?: MaybeRefOrGetter<VoteConfig | undefined>
  enabled?: MaybeRefOrGetter<boolean>
  onUpdate?: (status: string, session: ResponseVoteSession | null) => void
}

function isPotentialVoteMessage(message: string, session: ResponseVoteSession, config?: VoteConfig): boolean {
  const clean = message.trim()
  if (!clean) return false

  const voteCommand = config?.voteCommand?.trim() || '投票'
  const voteEndCommand = config?.voteEndCommand?.trim() || '结束投票'
  const lower = clean.toLowerCase()

  if (voteEndCommand && lower === voteEndCommand.toLowerCase()) return true
  if (voteCommand && lower.startsWith(voteCommand.toLowerCase())) return true

  if (/^\d+$/.test(clean)) {
    const idx = Number(clean)
    if (idx >= 1 && idx <= (session.options?.length ?? 0)) return true
  }

  return (session.options ?? []).some((opt) => opt.text.trim().toLowerCase() === lower)
}

/**
 * 当未运行桌面端/Web EventFetcher 时，通过网页端已连接的弹幕客户端将投票事件上报给服务端。
 */
export function useVoteDanmakuBridge(
  session: MaybeRefOrGetter<ResponseVoteSession | null | undefined>,
  options: UseVoteDanmakuBridgeOptions = {},
) {
  const accountInfo = useAccount()
  const client = useDanmakuClient()

  let fallbackConfig: VoteConfig | undefined
  let loadedSessionId: number | undefined
  let configLoading: Promise<void> | undefined

  function resolveConfig(): VoteConfig | undefined {
    return toValue(options.config) ?? fallbackConfig
  }

  function ensureConfigLoaded(sessionId?: number) {
    if (toValue(options.config) || configLoading) return
    if (fallbackConfig && loadedSessionId === sessionId) return
    configLoading = getVoteConfig()
      .then((cfg) => {
        fallbackConfig = cfg
        loadedSessionId = sessionId
      })
      .catch(() => undefined)
      .finally(() => {
        configLoading = undefined
      })
  }

  watch(
    () => {
      const current = toValue(session)
      return current?.isActive ? current.id : undefined
    },
    (activeId) => {
      if (activeId !== undefined) ensureConfigLoaded(activeId)
    },
    { immediate: true },
  )

  function shouldForward(): ResponseVoteSession | null {
    if (toValue(options.enabled) === false) return null
    if (accountInfo.value?.eventFetcherState?.online) return null

    const current = toValue(session)
    if (!current?.isActive) return null

    const cfg = resolveConfig()
    if (cfg && !cfg.isEnabled) return null

    return current
  }

  async function forwardEvent(event: EventModel) {
    try {
      const res = await tryVoteEvent(event)
      if (res.status === 'voted' || res.status === 'ended') {
        options.onUpdate?.(res.status, res.session)
      }
    } catch (err) {
      console.warn('[VoteDanmakuBridge] 上报投票弹幕失败:', err)
    }
  }

  function onDanmaku(event: EventModel) {
    const current = shouldForward()
    if (!current) return

    const cfg = resolveConfig()
    if (!isPotentialVoteMessage(event.msg ?? '', current, cfg)) return
    void forwardEvent(event)
  }

  function onPaidEvent(event: EventModel) {
    const current = shouldForward()
    if (!current) return

    const cfg = resolveConfig()
    if (!cfg?.allowGiftVoting) return
    if (event.price <= 0) return
    if (cfg.minGiftPrice != null && event.price < cfg.minGiftPrice) return

    void forwardEvent(event)
  }

  client.onEvent('danmaku', onDanmaku)
  client.onEvent('gift', onPaidEvent)
  client.onEvent('sc', onPaidEvent)

  onScopeDispose(() => {
    client.offEvent('danmaku', onDanmaku)
    client.offEvent('gift', onPaidEvent)
    client.offEvent('sc', onPaidEvent)
  })

  return {
    client,
  }
}
