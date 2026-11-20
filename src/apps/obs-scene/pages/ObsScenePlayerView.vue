<script setup lang="ts">
import { useWindowSize } from '@vueuse/core'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import type { ObsPublicSceneSnapshot } from '@/api/obs-scene'
import { getPublicObsScene } from '@/api/obs-scene'
import { firstQueryValue } from '@/shared/obs/obsUrl'
import { useRealtimeTopic } from '@/shared/realtime'

import ObsSceneRenderer from '../components/ObsSceneRenderer.vue'
import type { ObsSceneDocument } from '../types'
import { normalizeSceneDocument } from '../types'

const route = useRoute()
const shareKey = computed(() => (firstQueryValue(route.query.key) ?? '').trim().toLowerCase())
const authToken = computed(() => (firstQueryValue(route.query.token) ?? '').trim())

const doc = ref<ObsSceneDocument | null>(null)
const ownerUserId = ref<number | undefined>(undefined)
const activeSceneId = ref<string | undefined>(undefined)
const publishedHash = ref('')
const layerVisibilityOverride = ref<Record<string, boolean>>({})
const loadError = ref('')

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
  }
})

onEvent('ActiveSceneChanged', (payload) => {
  const data = payload as { activeSceneId?: string } | null
  if (data?.activeSceneId) {
    activeSceneId.value = data.activeSceneId
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
