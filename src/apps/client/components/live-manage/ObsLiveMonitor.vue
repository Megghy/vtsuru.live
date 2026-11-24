<script setup lang="ts">
import { Camera, Monitor, Pause, Play, Radio, RefreshCw } from 'lucide-vue-next'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { useOBSStore } from '@/apps/client/store/useOBSStore'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'

const props = withDefaults(
  defineProps<{
    /** 是否展示场景缩略图切换墙 */
    showSceneWall?: boolean
    /** 是否默认开启实时抓帧监视 */
    defaultLive?: boolean
    /** 紧凑模式（用于工具总览等区域） */
    compact?: boolean
  }>(),
  {
    showSceneWall: true,
    defaultLive: false,
    compact: false,
  },
)

const obs = useOBSStore()

const liveEnabled = ref(props.defaultLive)
const refreshRate = ref<'1' | '2' | 'manual'>('1')
const currentFrameUrl = ref('')
const lastUpdatedAt = ref<number>(0)
const capturingFrame = ref(false)

const sceneThumbs = ref<Record<string, string>>({})
const loadingThumbs = ref(false)
let pollTimer: ReturnType<typeof setInterval> | null = null
let isDisposed = false

const intervalMs = computed(() => {
  if (refreshRate.value === '2') return 500
  if (refreshRate.value === '1') return 1000
  return 0
})

async function captureCurrentFrame() {
  if (isDisposed || capturingFrame.value || !obs.obsConnected || !obs.currentObsScene) return
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
  capturingFrame.value = true
  try {
    const res = await obs.getSourceScreenshot({
      sourceName: obs.currentObsScene,
      width: props.compact ? 480 : 640,
      height: props.compact ? 270 : 360,
    })
    if (res.ok && res.imageData) {
      currentFrameUrl.value = res.imageData
      lastUpdatedAt.value = Date.now()
      sceneThumbs.value = {
        ...sceneThumbs.value,
        [obs.currentObsScene]: res.imageData,
      }
    }
  } finally {
    capturingFrame.value = false
  }
}

async function refreshAllSceneThumbs() {
  if (isDisposed || loadingThumbs.value || !obs.obsConnected || obs.obsScenes.length === 0) return
  loadingThumbs.value = true
  try {
    const nextThumbs: Record<string, string> = { ...sceneThumbs.value }
    for (const sceneName of obs.obsScenes) {
      if (isDisposed || !obs.obsConnected) break
      const res = await obs.getSourceScreenshot({
        sourceName: sceneName,
        width: 320,
        height: 180,
      })
      if (res.ok && res.imageData) {
        nextThumbs[sceneName] = res.imageData
      }
    }
    sceneThumbs.value = nextThumbs
  } finally {
    loadingThumbs.value = false
  }
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

function restartPolling() {
  stopPolling()
  if (!obs.obsConnected || !liveEnabled.value) return
  void captureCurrentFrame()
  if (intervalMs.value > 0) {
    pollTimer = setInterval(() => {
      void captureCurrentFrame()
    }, intervalMs.value)
  }
}

function toggleLive() {
  liveEnabled.value = !liveEnabled.value
}

watch([() => obs.obsConnected, liveEnabled, refreshRate], () => {
  if (!obs.obsConnected) {
    stopPolling()
    return
  }
  restartPolling()
})

watch(
  () => obs.currentObsScene,
  () => {
    if (obs.obsConnected && (liveEnabled.value || currentFrameUrl.value)) {
      void captureCurrentFrame()
    }
  },
)

watch(
  () => [obs.obsConnected, obs.obsScenes.join('|')] as const,
  ([connected]) => {
    if (connected && props.showSceneWall && obs.obsScenes.length > 0) {
      void refreshAllSceneThumbs()
    }
  },
  { immediate: true },
)

onMounted(() => {
  if (obs.obsConnected && liveEnabled.value) {
    restartPolling()
  }
})

onBeforeUnmount(() => {
  isDisposed = true
  stopPolling()
})
</script>

<template>
  <div class="space-y-3">
    <!-- 实时节目监看画面 -->
    <div class="rounded-lg border border-border bg-card overflow-hidden">
      <div class="px-3 py-2 border-b border-border flex-between gap-2 flex-wrap bg-muted/20">
        <div class="flex items-center gap-2 min-w-0">
          <Monitor class="size-3.5 text-primary shrink-0" />
          <span class="text-xs font-semibold text-foreground truncate">OBS 画面监视器</span>
          <Badge
            v-if="obs.obsConnected && obs.currentObsScene"
            variant="outline"
            size="xs"
            class="truncate max-w-[160px]"
          >
            {{ obs.currentObsScene }}
          </Badge>
          <Badge
            v-if="obs.obsStreamActive"
            variant="destructive"
            size="xs"
            class="gap-1"
          >
            <Radio class="size-2.5" />
            LIVE
          </Badge>
        </div>

        <div class="flex items-center gap-1.5 flex-wrap">
          <ToggleGroup
            v-if="obs.obsConnected && liveEnabled"
            type="single"
            :model-value="refreshRate"
            @update:model-value="(v) => v && (refreshRate = v as '1' | '2' | 'manual')"
          >
            <ToggleGroupItem value="1">1 FPS</ToggleGroupItem>
            <ToggleGroupItem value="2">2 FPS</ToggleGroupItem>
            <ToggleGroupItem value="manual">手动</ToggleGroupItem>
          </ToggleGroup>

          <Button
            type="button"
            size="xs"
            :variant="liveEnabled ? 'default' : 'outline'"
            :disabled="!obs.obsConnected"
            class="gap-1"
            @click="toggleLive"
          >
            <Pause
              v-if="liveEnabled"
              class="size-3"
            />
            <Play
              v-else
              class="size-3"
            />
            {{ liveEnabled ? '暂停监看' : '开启实时监看' }}
          </Button>

          <Button
            type="button"
            size="icon-xs"
            variant="outline"
            :disabled="!obs.obsConnected || capturingFrame"
            title="抓取单帧画面"
            @click="captureCurrentFrame"
          >
            <Camera class="size-3.5" />
          </Button>
        </div>
      </div>

      <div
        class="relative aspect-video w-full bg-black/90 flex-center overflow-hidden"
        :class="compact ? 'max-h-[200px]' : 'max-h-[300px]'"
      >
        <img
          v-if="obs.obsConnected && currentFrameUrl"
          :src="currentFrameUrl"
          alt="OBS 实时监看画面"
          class="w-full h-full object-contain select-none"
        />
        <div
          v-else
          class="flex flex-col items-center gap-2 text-center px-4"
        >
          <Monitor class="size-7 text-muted-foreground/60" />
          <p class="text-xs text-muted-foreground">
            {{
              !obs.obsConnected
                ? '连接 OBS 后可实时预览当前节目画面'
                : '点击「开启实时监看」或右上角拍照按钮预览当前 OBS 画面'
            }}
          </p>
        </div>

        <div
          v-if="obs.obsConnected && currentFrameUrl && lastUpdatedAt"
          class="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/65 text-[10px] font-mono tabular-nums text-white/85"
        >
          {{ liveEnabled && refreshRate !== 'manual' ? `${refreshRate} FPS 实时监看` : '单帧快照' }}
        </div>
      </div>
    </div>

    <!-- 场景缩略图切换墙 -->
    <div
      v-if="showSceneWall"
      class="space-y-2"
    >
      <div class="flex-between gap-2">
        <div class="flex items-center gap-2">
          <span class="text-xs font-semibold text-foreground">场景缩略图切换墙</span>
          <Badge
            v-if="obs.obsScenes.length > 0"
            variant="secondary"
            size="xs"
            class="tabular-nums"
          >
            {{ obs.obsScenes.length }}
          </Badge>
        </div>
        <Button
          v-if="obs.obsConnected && obs.obsScenes.length > 0"
          type="button"
          size="xs"
          variant="ghost"
          class="gap-1 text-muted-foreground"
          :disabled="loadingThumbs"
          @click="refreshAllSceneThumbs"
        >
          <RefreshCw
            class="size-3"
            :class="{ 'animate-spin': loadingThumbs }"
          />
          刷新缩略图
        </Button>
      </div>

      <div
        v-if="obs.obsScenes.length > 0"
        class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2"
      >
        <button
          v-for="scene in obs.obsScenes"
          :key="scene"
          type="button"
          :disabled="obs.isSwitchingScene"
          class="group relative rounded-md border overflow-hidden text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          :class="
            scene === obs.currentObsScene
              ? 'border-primary ring-1 ring-primary/40 bg-primary/5'
              : 'border-border bg-card hover:border-primary/50'
          "
          @click="scene !== obs.currentObsScene && obs.switchToScene(scene)"
        >
          <div class="relative aspect-video w-full bg-muted/60 overflow-hidden">
            <img
              v-if="sceneThumbs[scene]"
              :src="sceneThumbs[scene]"
              :alt="scene"
              class="w-full h-full object-cover transition-transform duration-150 group-hover:scale-[1.03]"
            />
            <div
              v-else
              class="w-full h-full flex-center text-[11px] text-muted-foreground"
            >
              {{ loadingThumbs ? '加载中...' : '暂无缩略图' }}
            </div>
            <Badge
              v-if="scene === obs.currentObsScene"
              variant="default"
              size="xs"
              class="absolute top-1.5 left-1.5"
            >
              当前
            </Badge>
          </div>
          <div class="px-2 py-1.5 flex items-center justify-between gap-1">
            <span
              class="text-xs font-medium truncate"
              :class="scene === obs.currentObsScene ? 'text-primary' : 'text-foreground'"
              :title="scene"
            >
              {{ scene }}
            </span>
          </div>
        </button>
      </div>

      <div
        v-else
        class="py-4 text-center text-xs text-muted-foreground rounded-md border border-dashed border-border"
      >
        {{ obs.obsConnected ? '未检测到 OBS 场景' : '连接 OBS 后将自动加载可用场景与预览缩略图' }}
      </div>
    </div>
  </div>
</template>
