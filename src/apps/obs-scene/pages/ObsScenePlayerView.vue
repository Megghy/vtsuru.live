<script setup lang="ts">
import { useWindowSize } from '@vueuse/core'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import type { ObsPublicSceneSnapshot } from '@/api/obs-scene'
import { getPublicObsScene } from '@/api/obs-scene'
import { firstQueryValue } from '@/shared/obs/obsUrl'
import { useRealtimeTopic } from '@/shared/realtime'
import type { RpcClient } from '@/shared/rpc/client'
import { connectLocalFetcher, probeLocalFetcher } from '@/shared/rpc/client'

import ObsSceneRenderer from '../components/ObsSceneRenderer.vue'
import type { ObsSceneDocument } from '../types'
import { normalizeSceneDocument } from '../types'
import {
  buildSceneCompositionPlan,
  buildSyncLayoutParamsForScene,
  documentHasObsSources,
  extractSceneVtsActions,
  isPrimaryPlayerSlot,
} from '../utils/sceneSlices'
import { documentHasAnyObsNativeFilters, syncActiveSceneObsNativeFilters } from '../vfx/obsFilterSync'

const route = useRoute()
const shareKey = computed(() => (firstQueryValue(route.query.key) ?? '').trim().toLowerCase())
const authToken = computed(() => (firstQueryValue(route.query.token) ?? '').trim())
const slotParam = computed(() => (firstQueryValue(route.query.slot) ?? '').trim() || undefined)

const doc = ref<ObsSceneDocument | null>(null)
const projectName = ref('OBS 场景')
const ownerUserId = ref<number | undefined>(undefined)
const activeSceneId = ref<string | undefined>(undefined)
const publishedHash = ref('')
const layerVisibilityOverride = ref<Record<string, boolean>>({})
const loadError = ref('')

let localRpcClient: RpcClient | null = null
let lastSyncedSceneKey = ''

async function ensureLocalRpcClient(): Promise<RpcClient | null> {
  if (localRpcClient) return localRpcClient
  try {
    const health = await probeLocalFetcher(500)
    if (!health) return null
    const client = await connectLocalFetcher(
      {
        onDanmakuEvent: () => {},
      },
      () => {
        if (localRpcClient === client) localRpcClient = null
      },
    )
    localRpcClient = client
    return client
  } catch {
    return null
  }
}

/**
 * 直播态单点驱动：仅由主槽位实例通知本地桌面客户端
 * 同步 OBS 原生源的 Z 序/Transform/显隐，切子场景时按需执行绑定的 VTS 动作。
 */
async function syncLiveSceneToLocalClient(targetSceneId: string, triggerVtsActions: boolean) {
  const currentDoc = doc.value
  if (!currentDoc || !shareKey.value) return
  const hasObsSources = documentHasObsSources(currentDoc)
  const hasObsFilters = documentHasAnyObsNativeFilters(currentDoc)
  if (!hasObsSources && !hasObsFilters) return

  const plan = buildSceneCompositionPlan(currentDoc, targetSceneId)
  if (!isPrimaryPlayerSlot(plan, slotParam.value)) return

  const dedupeKey = `${publishedHash.value}:${targetSceneId}:${triggerVtsActions ? 'vts' : 'layout'}`
  if (lastSyncedSceneKey === dedupeKey) return
  lastSyncedSceneKey = dedupeKey

  const client = await ensureLocalRpcClient()
  if (!client) return

  // 1. 若本地 OBS 已连，同步当前子场景的分层顺序、原生源 Transform 与原生画面滤镜
  try {
    const obsStatus = await client.rpc.obsGetStatus()
    if (obsStatus.connected) {
      const targetObsScene =
        currentDoc.scenes[targetSceneId]?.obsSceneBinding?.trim() || obsStatus.currentScene
      if (targetObsScene) {
        if (hasObsSources) {
          const params = buildSyncLayoutParamsForScene({
            doc: currentDoc,
            sceneId: targetSceneId,
            obsSceneName: targetObsScene,
            baseSourceName: `VTsuru - ${projectName.value}`,
            shareKey: shareKey.value,
            authToken: authToken.value || undefined,
          })
          await client.rpc.obsSyncSceneLayout(params)
        }
        if (hasObsFilters) {
          const capabilities = await client.rpc.obsGetFilterCapabilities().catch(() => ({
            filterKinds: [],
            hasShaderFilter: false,
            hasCompositeBlur: false,
            canStageLocalAssets: false,
          }))
          await syncActiveSceneObsNativeFilters({
            doc: currentDoc,
            sceneId: targetSceneId,
            obsSceneName: targetObsScene,
            executor: {
              capabilities,
              syncSourceFilters: (p) => client.rpc.obsSyncSourceFilters(p),
              stageFilterAsset: (p) => client.rpc.obsStageFilterAsset(p),
            },
          })
        }
      }
    }
  } catch {
    // 播放器内静默降级，避免无 OBS 连接时干扰画面渲染
  }

  // 2. 仅切入子场景时触发当前子场景中所有可见 VTS 控制器的联动动作（避免保存发布布局误触发热键/宏）
  if (!triggerVtsActions) return
  const vtsActions = extractSceneVtsActions(currentDoc, targetSceneId)
  for (const action of vtsActions) {
    try {
      await client.rpc.vtsRunSceneAction(action)
    } catch {
      // VTS 未连或单步失败时继续执行后续动作
    }
  }
}

const { width: winW, height: winH } = useWindowSize()

const stageScaleStyle = computed(() => {
  if (!doc.value) return {}
  const sx = winW.value / Math.max(1, doc.value.canvas.width)
  const sy = winH.value / Math.max(1, doc.value.canvas.height)
  const scale = Math.min(sx, sy)
  return {
    width: `${doc.value.canvas.width}px`,
    height: `${doc.value.canvas.height}px`,
    transform: `translate(-50%, -50%) scale(${scale})`,
    position: 'absolute' as const,
    left: '50%',
    top: '50%',
    transformOrigin: 'center center',
  }
})

function applySnapshot(snap: ObsPublicSceneSnapshot) {
  if (snap.ownerUserId > 0) ownerUserId.value = snap.ownerUserId
  if (snap.name) projectName.value = snap.name
  if (snap.activeSceneId) activeSceneId.value = snap.activeSceneId
  if (snap.publishedHash) publishedHash.value = snap.publishedHash

  if (snap.changed && snap.data) {
    try {
      const parsed = JSON.parse(snap.data)
      doc.value = normalizeSceneDocument(parsed)
      if (!activeSceneId.value) activeSceneId.value = doc.value.activeSceneId
      layerVisibilityOverride.value = {}
      loadError.value = ''
    } catch {
      loadError.value = '场景配置解析失败'
    }
  }
}

async function fetchLatest(checkHash = false) {
  if (!shareKey.value) {
    loadError.value = '缺少场景参数 key'
    return
  }
  try {
    const snap = await getPublicObsScene(shareKey.value, checkHash ? publishedHash.value : undefined)
    applySnapshot(snap)
  } catch (err) {
    if (!doc.value) {
      loadError.value = err instanceof Error ? err.message : '加载场景失败'
    }
  }
}

const topic = computed(() => (shareKey.value ? `obs:scene:${shareKey.value}` : ''))
const { on: onEvent, status: realtimeStatus } = useRealtimeTopic(topic)

onEvent('SceneSnapshot', (payload) => {
  if (payload && typeof payload === 'object') {
    applySnapshot(payload as ObsPublicSceneSnapshot)
  }
})

onEvent('ScenePublished', (payload) => {
  if (payload && typeof payload === 'object') {
    applySnapshot(payload as ObsPublicSceneSnapshot)
    const targetSceneId = activeSceneId.value || doc.value?.activeSceneId
    if (targetSceneId) {
      void syncLiveSceneToLocalClient(targetSceneId, false)
    }
  }
})

onEvent('ActiveSceneChanged', (payload) => {
  const data = payload as { activeSceneId?: string } | null
  if (data?.activeSceneId) {
    activeSceneId.value = data.activeSceneId
    void syncLiveSceneToLocalClient(data.activeSceneId, true)
  }
})

onEvent('LayerPatch', (payload) => {
  const data = payload as { layerId?: string; visible?: boolean } | null
  if (data?.layerId && typeof data.visible === 'boolean') {
    layerVisibilityOverride.value = {
      ...layerVisibilityOverride.value,
      [data.layerId]: data.visible,
    }
  }
})

let fallbackTimer: ReturnType<typeof setInterval> | null = null

watch(shareKey, () => {
  publishedHash.value = ''
  doc.value = null
  void fetchLatest(false)
})

onMounted(() => {
  void fetchLatest(false)
  fallbackTimer = setInterval(() => {
    if (!realtimeStatus.value.connected) {
      void fetchLatest(true)
    }
  }, 15000)
})

onBeforeUnmount(() => {
  if (fallbackTimer) {
    clearInterval(fallbackTimer)
    fallbackTimer = null
  }
  if (localRpcClient) {
    localRpcClient.close()
    localRpcClient = null
  }
})
</script>

<template>
  <div class="relative w-screen h-screen overflow-hidden bg-transparent">
    <div v-if="doc" :style="stageScaleStyle">
      <ObsSceneRenderer
        :doc="doc"
        :owner-user-id="ownerUserId"
        :auth-token="authToken"
        mode="live"
        :slot="slotParam"
        :active-scene-override="activeSceneId"
        :layer-visibility-override="layerVisibilityOverride"
      />
    </div>
    <div
      v-else-if="loadError"
      class="w-full h-full flex-center text-sm text-white/80 bg-black/40 px-4 text-center"
    >
      {{ loadError }}
    </div>
  </div>
</template>
