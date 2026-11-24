<script setup lang="ts">
import { Camera, Crosshair, Image as ImageIcon, RotateCcw } from 'lucide-vue-next'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { useOBSStore } from '@/apps/client/store/useOBSStore'
import { useVtsStore } from '@/apps/client/store/useVtsStore'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Switch } from '@/shared/ui/switch'

const props = defineProps<{
  positionX: number
  positionY: number
  rotation: number
  size: number
}>()

const emit = defineEmits<{
  'update:positionX': [value: number]
  'update:positionY': [value: number]
  'update:rotation': [value: number]
  'update:size': [value: number]
}>()

const vts = useVtsStore()
const obs = useOBSStore()

const stageRef = ref<HTMLDivElement | null>(null)
const showObsBackdrop = ref(true)
const obsBackdropUrl = ref('')
const loadingBackdrop = ref(false)
const liveSyncVts = ref(false)
const outlinePoints = ref<string>('')

let dragMode: 'move' | 'rotate' | null = null
let activePointerId: number | null = null
let unsubscribeOutline: (() => void) | null = null
let syncTimer: ReturnType<typeof setTimeout> | null = null

const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val))
const round3 = (val: number) => Number(val.toFixed(3))
const round1 = (val: number) => Number(val.toFixed(1))

const avatarLeftPct = computed(() => clamp(((props.positionX + 1) / 2) * 100, -10, 110))
const avatarTopPct = computed(() => clamp(((1 - props.positionY) / 2) * 100, -10, 110))
const avatarScale = computed(() => clamp(0.55 + props.size / 180, 0.18, 1.55))

function scheduleLiveSync() {
  if (!liveSyncVts.value || !vts.connected) return
  if (syncTimer) return
  syncTimer = setTimeout(() => {
    syncTimer = null
    if (!liveSyncVts.value || !vts.connected) return
    void vts
      .moveModel(
        {
          timeInSeconds: 0.08,
          positionX: props.positionX,
          positionY: props.positionY,
          rotation: props.rotation,
          size: props.size,
        },
        { silent: true },
      )
      .catch(() => {})
  }, 80)
}

function updatePositionFromPointer(e: PointerEvent) {
  const el = stageRef.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  const normX = clamp(((e.clientX - rect.left) / rect.width) * 2 - 1, -1.2, 1.2)
  const normY = clamp(1 - ((e.clientY - rect.top) / rect.height) * 2, -1.2, 1.2)
  emit('update:positionX', round3(normX))
  emit('update:positionY', round3(normY))
  scheduleLiveSync()
}

function updateRotationFromPointer(e: PointerEvent) {
  const el = stageRef.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  const cx = rect.left + (avatarLeftPct.value / 100) * rect.width
  const cy = rect.top + (avatarTopPct.value / 100) * rect.height
  const rad = Math.atan2(e.clientY - cy, e.clientX - cx)
  // 顶部手柄对应 -90deg，VTS 正角度为逆时针旋转
  const cssDeg = (rad * 180) / Math.PI + 90
  let vtsDeg = -cssDeg
  while (vtsDeg > 180) vtsDeg -= 360
  while (vtsDeg < -180) vtsDeg += 360
  emit('update:rotation', round1(vtsDeg))
  scheduleLiveSync()
}

function onStagePointerDown(e: PointerEvent) {
  if (e.button !== 0) return
  dragMode = 'move'
  activePointerId = e.pointerId
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  updatePositionFromPointer(e)
}

function onRotateHandleDown(e: PointerEvent) {
  if (e.button !== 0) return
  e.stopPropagation()
  dragMode = 'rotate'
  activePointerId = e.pointerId
  stageRef.value?.setPointerCapture(e.pointerId)
  updateRotationFromPointer(e)
}

function onStagePointerMove(e: PointerEvent) {
  if (!dragMode || activePointerId !== e.pointerId) return
  if (dragMode === 'move') updatePositionFromPointer(e)
  else if (dragMode === 'rotate') updateRotationFromPointer(e)
}

function onStagePointerUp(e: PointerEvent) {
  if (activePointerId !== e.pointerId) return
  dragMode = null
  activePointerId = null
  if (stageRef.value?.hasPointerCapture(e.pointerId)) {
    stageRef.value.releasePointerCapture(e.pointerId)
  }
}

function onStageWheel(e: WheelEvent) {
  e.preventDefault()
  const delta = e.deltaY < 0 ? 3 : -3
  const next = clamp(round1(props.size + delta), -100, 100)
  emit('update:size', next)
  scheduleLiveSync()
}

async function captureObsBackdrop() {
  if (!obs.obsConnected || !obs.currentObsScene || loadingBackdrop.value) return
  loadingBackdrop.value = true
  try {
    const res = await obs.getSourceScreenshot({
      sourceName: obs.currentObsScene,
      width: 640,
      height: 360,
    })
    if (res.ok && res.imageData) {
      obsBackdropUrl.value = res.imageData
    }
  } finally {
    loadingBackdrop.value = false
  }
}

const quickPositions = [
  { label: '居中标准', x: 0, y: 0, rot: 0, size: 0 },
  { label: '左下游戏', x: -0.55, y: -0.22, rot: 0, size: -28 },
  { label: '右下游戏', x: 0.55, y: -0.22, rot: 0, size: -28 },
  { label: '近景特写', x: 0, y: -0.18, rot: 0, size: 32 },
]

function applyQuick(q: { x: number; y: number; rot: number; size: number }) {
  emit('update:positionX', q.x)
  emit('update:positionY', q.y)
  emit('update:rotation', q.rot)
  emit('update:size', q.size)
  scheduleLiveSync()
}

async function startOutlineSubscription() {
  unsubscribeOutline?.()
  unsubscribeOutline = null
  outlinePoints.value = ''
  if (!vts.connected) return
  unsubscribeOutline = await vts.subscribeModelOutline((data) => {
    if (!data.convexHull?.length) {
      outlinePoints.value = ''
      return
    }
    outlinePoints.value = data.convexHull
      .map((pt) => {
        const px = clamp(((pt.x + 1) / 2) * 160, 0, 160)
        const py = clamp(((1 - pt.y) / 2) * 90, 0, 90)
        return `${px.toFixed(1)},${py.toFixed(1)}`
      })
      .join(' ')
  })
}

watch(
  () => obs.obsConnected,
  (connected) => {
    if (connected && showObsBackdrop.value) {
      void captureObsBackdrop()
    }
  },
  { immediate: true },
)

onMounted(() => {
  if (vts.connected) {
    void startOutlineSubscription()
  }
})

onBeforeUnmount(() => {
  if (syncTimer) {
    clearTimeout(syncTimer)
    syncTimer = null
  }
  unsubscribeOutline?.()
  unsubscribeOutline = null
})
</script>

<template>
  <div class="space-y-2">
    <!-- 顶部工具栏 -->
    <div class="flex-between gap-2 flex-wrap">
      <div class="flex items-center gap-1.5 flex-wrap">
        <span class="text-xs font-semibold text-foreground">16:9 交互机位舞台</span>
        <Badge
          variant="outline"
          size="xs"
          class="font-mono tabular-nums"
        >
          X {{ positionX.toFixed(2) }} · Y {{ positionY.toFixed(2) }} · {{ rotation.toFixed(0) }}° · S {{ size.toFixed(0) }}
        </Badge>
      </div>

      <div class="flex items-center gap-2 flex-wrap text-xs">
        <label
          v-if="vts.connected"
          class="flex items-center gap-1.5 cursor-pointer select-none"
        >
          <Switch
            :checked="liveSyncVts"
            @update:checked="(v) => (liveSyncVts = v)"
          />
          <span class="text-muted-foreground">实时同步 VTS</span>
        </label>

        <Button
          v-if="obs.obsConnected"
          type="button"
          size="xs"
          :variant="showObsBackdrop && obsBackdropUrl ? 'secondary' : 'outline'"
          class="gap-1"
          :disabled="loadingBackdrop"
          @click="
            () => {
              showObsBackdrop = true
              void captureObsBackdrop()
            }
          "
        >
          <Camera class="size-3" />
          {{ obsBackdropUrl ? '刷新 OBS 底图' : '加载 OBS 底图' }}
        </Button>

        <Button
          v-if="obsBackdropUrl"
          type="button"
          size="icon-xs"
          variant="ghost"
          :title="showObsBackdrop ? '隐藏底图' : '显示底图'"
          @click="showObsBackdrop = !showObsBackdrop"
        >
          <ImageIcon class="size-3.5" />
        </Button>
      </div>
    </div>

    <!-- 16:9 交互画布 -->
    <div
      ref="stageRef"
      class="relative aspect-video w-full rounded-lg border border-border bg-neutral-950 overflow-hidden select-none touch-none cursor-crosshair"
      @pointerdown="onStagePointerDown"
      @pointermove="onStagePointerMove"
      @pointerup="onStagePointerUp"
      @pointercancel="onStagePointerUp"
      @wheel="onStageWheel"
    >
      <!-- OBS 实时截图底图 -->
      <img
        v-if="showObsBackdrop && obsBackdropUrl"
        :src="obsBackdropUrl"
        alt="OBS 场景底图"
        class="absolute inset-0 w-full h-full object-cover opacity-55 pointer-events-none"
      />

      <!-- 九宫格与中心参考线 -->
      <svg
        viewBox="0 0 160 90"
        class="absolute inset-0 w-full h-full pointer-events-none"
        preserveAspectRatio="none"
      >
        <line x1="53.3" y1="0" x2="53.3" y2="90" stroke="rgba(255,255,255,0.12)" stroke-width="0.4" />
        <line x1="106.6" y1="0" x2="106.6" y2="90" stroke="rgba(255,255,255,0.12)" stroke-width="0.4" />
        <line x1="0" y1="30" x2="160" y2="30" stroke="rgba(255,255,255,0.12)" stroke-width="0.4" />
        <line x1="0" y1="60" x2="160" y2="60" stroke="rgba(255,255,255,0.12)" stroke-width="0.4" />
        <line x1="80" y1="0" x2="80" y2="90" stroke="rgba(255,255,255,0.2)" stroke-dasharray="2 2" stroke-width="0.4" />
        <line x1="0" y1="45" x2="160" y2="45" stroke="rgba(255,255,255,0.2)" stroke-dasharray="2 2" stroke-width="0.4" />

        <!-- VTS 实时模型真实轮廓 (convexHull) -->
        <polygon
          v-if="outlinePoints"
          :points="outlinePoints"
          fill="rgba(16, 185, 129, 0.14)"
          stroke="rgba(52, 211, 153, 0.75)"
          stroke-width="0.8"
          stroke-dasharray="2.5 1.5"
        />
      </svg>

      <!-- 可拖拽/旋转/缩放的皮套机位框 -->
      <div
        class="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none"
        :style="{
          left: `${avatarLeftPct}%`,
          top: `${avatarTopPct}%`,
          transform: `translate(-50%, -50%) rotate(${(-rotation).toFixed(1)}deg) scale(${avatarScale.toFixed(3)})`,
        }"
      >
        <!-- 顶部旋转手柄 -->
        <div
          class="absolute -top-6 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-auto cursor-grab active:cursor-grabbing"
          title="拖动旋转角度"
          @pointerdown="onRotateHandleDown"
        >
          <div class="size-3.5 rounded-full bg-primary border-2 border-white shadow" />
          <div class="w-px h-2.5 bg-primary/80" />
        </div>

        <!-- 人物剪影框架 -->
        <div class="w-20 h-28 rounded-lg border-2 border-primary bg-primary/20 shadow-sm flex flex-col items-center justify-center gap-1 backdrop-blur-[1px]">
          <div class="size-7 rounded-full border-2 border-primary/90 bg-primary/25" />
          <div class="w-12 h-11 rounded-t-2xl border-2 border-primary/90 bg-primary/20" />
        </div>
      </div>

      <!-- 左下角操作提示 -->
      <div class="absolute bottom-1.5 left-2 px-1.5 py-0.5 rounded bg-black/65 text-[10px] text-white/80 pointer-events-none">
        拖动定位 · 滚轮缩放 · 顶圆点旋转
      </div>
    </div>

    <!-- 快捷机位预设胶囊 -->
    <div class="flex items-center gap-1.5 flex-wrap">
      <span class="text-[11px] text-muted-foreground flex items-center gap-1">
        <Crosshair class="size-3" />
        快捷构图:
      </span>
      <Button
        v-for="q in quickPositions"
        :key="q.label"
        type="button"
        size="xs"
        variant="outline"
        @click="applyQuick(q)"
      >
        {{ q.label }}
      </Button>
      <Button
        type="button"
        size="xs"
        variant="ghost"
        class="gap-1 text-muted-foreground"
        @click="emit('update:rotation', 0)"
      >
        <RotateCcw class="size-3" />
        角度归零
      </Button>
    </div>
  </div>
</template>
