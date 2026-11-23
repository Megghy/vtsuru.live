import { watch } from 'vue'

import { useOBSStore } from '@/apps/client/store/useOBSStore'

import type { VtsConfig } from './config'
import type { VtsConnection } from './connection'
import type { VtsOperations } from './operations'

/** OBS 切场景 → 应用映射的 VTS 机位预设; 随 store 常驻, 不依赖面板是否打开 */
export function startVtsObsLink(config: VtsConfig, conn: VtsConnection, ops: VtsOperations) {
  const obs = useOBSStore()
  let timer: number | undefined

  function clearTimer() {
    window.clearTimeout(timer)
    timer = undefined
  }

  watch(
    () => config.obsLinkConfig.value.enabled,
    (enabled) => {
      if (!enabled) clearTimer()
    },
  )

  watch(
    () => obs.currentObsScene,
    (scene) => {
      clearTimer()
      const { enabled, sceneToPresetId, debounceMs } = config.obsLinkConfig.value
      const presetId = scene && sceneToPresetId[scene]
      if (!enabled || !presetId || !conn.connected.value) return
      timer = window.setTimeout(() => {
        timer = undefined
        if (!config.obsLinkConfig.value.enabled || !conn.connected.value) return
        ops.applyPreset(presetId).catch((err) => {
          conn.lastError.value = err instanceof Error ? err.message : String(err)
        })
      }, debounceMs)
    },
    { immediate: true },
  )
}
