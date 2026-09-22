import { computed, onMounted, ref, watch } from 'vue'

import { useAccount } from '@/api/account'
import { buildPreflightChecks } from '@/apps/client/components/live-manage/preflight'
import { useBiliCookie } from '@/apps/client/store/useBiliCookie'
import { useSettings } from '@/apps/client/store/useSettings'
import { useDanmakuClient } from '@/store/useDanmakuClient'
import { useWebFetcher } from '@/store/useWebFetcher'

import type { LiveControl } from './useLiveControl'

export function useLivePreflight(control: LiveControl) {
  const account = useAccount()
  const cookie = useBiliCookie()
  const settings = useSettings()
  const fetcher = useWebFetcher()
  const danmaku = useDanmakuClient()
  const obs = control.obsStore
  const refreshing = ref(false)
  const error = ref('')
  const checkedAt = ref<number>()
  const inspection = ref<Awaited<ReturnType<typeof obs.inspectPreflight>>>()
  const checks = computed(() =>
    buildPreflightChecks({
      cookieValid: cookie.isCookieValid,
      roomId: account.value.biliRoomId || account.value.streamerInfo?.roomId || 0,
      areaId: control.liveAreaId.value,
      title: control.liveTitle.value,
      hasStreamKey: Boolean(control.rtmpServer.value && control.rtmpCode.value),
      fetcherEnabled: settings.settings.enableEventFetcher,
      fetcherConnected: fetcher.state === 'connected',
      danmakuConnected: danmaku.connected,
      // 默认地址与默认自动推流开关不代表用户已经启用 OBS。
    obsEnabled: obs.obsAutoReconnect || obs.obsConnected || obs.obsConnecting || Boolean(obs.obsError) || obs.obsSceneConfig.autoSwitchEnabled,
      obsConnected: obs.obsConnected,
      obsStreamReady: inspection.value?.streamReady,
      autoSwitch: obs.obsSceneConfig.autoSwitchEnabled,
      startScene: obs.obsSceneConfig.startScene,
      scenes: inspection.value?.scenes,
    }),
  )

  async function refresh() {
    refreshing.value = true
    error.value = ''
    inspection.value = undefined
    try {
      const [, result] = await Promise.all([cookie.check(), obs.obsConnected ? obs.inspectPreflight() : undefined])
      if (obs.obsConnected) inspection.value = result
      checkedAt.value = Date.now()
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : String(cause)
      throw cause
    } finally {
      refreshing.value = false
    }
  }

  watch(
    () => obs.obsConnected,
    () => {
      inspection.value = undefined
    },
  )
  onMounted(refresh)
  return { checks, refreshing, error, checkedAt, refresh }
}
