<script setup lang="ts">
import { ArrowDownToLine } from 'lucide-vue-next'
import { computed, ref } from 'vue'

import { Button } from '@/shared/ui/button'
import { Slider } from '@/shared/ui/slider'
import { Switch } from '@/shared/ui/switch'

const props = defineProps<{
  dropX: number
  dropSize: number
  randomX: boolean
  disabledTest?: boolean
}>()

const emit = defineEmits<{
  'update:dropX': [value: number]
  'update:dropSize': [value: number]
  'update:randomX': [value: boolean]
  testDrop: []
}>()

const trackRef = ref<HTMLDivElement | null>(null)
let dragging = false
let pointerId: number | null = null

const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val))

const markerLeftPct = computed(() => clamp(((props.dropX + 1) / 2) * 100, 4, 96))
const bubblePx = computed(() => Math.round(14 + clamp(props.dropSize, 0.05, 1) * 24))

function updateXFromPointer(e: PointerEvent) {
  const el = trackRef.value
  if (!el || props.randomX) return
  const rect = el.getBoundingClientRect()
  const norm = clamp(((e.clientX - rect.left) / rect.width) * 2 - 1, -1, 1)
  emit('update:dropX', Number(norm.toFixed(2)))
}

function onPointerDown(e: PointerEvent) {
  if (props.randomX || e.button !== 0) return
  dragging = true
  pointerId = e.pointerId
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  updateXFromPointer(e)
}

function onPointerMove(e: PointerEvent) {
  if (!dragging || pointerId !== e.pointerId) return
  updateXFromPointer(e)
}

function onPointerUp(e: PointerEvent) {
  if (pointerId !== e.pointerId) return
  dragging = false
  pointerId = null
  if (trackRef.value?.hasPointerCapture(e.pointerId)) {
    trackRef.value.releasePointerCapture(e.pointerId)
  }
}
</script>

<template>
  <div class="space-y-2 pt-2 border-t border-border/60">
    <!-- 可视化水平落点轨道 -->
    <div
      ref="trackRef"
      class="relative h-12 rounded-md border border-border bg-muted/40 overflow-hidden select-none touch-none"
      :class="randomX ? 'cursor-default' : 'cursor-ew-resize'"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
    >
      <!-- 刻度与中心线 -->
      <div class="absolute inset-y-0 left-1/2 w-px bg-border/80 pointer-events-none" />
      <div class="absolute inset-y-0 left-1/4 w-px bg-border/40 pointer-events-none" />
      <div class="absolute inset-y-0 left-3/4 w-px bg-border/40 pointer-events-none" />

      <div class="absolute bottom-0.5 inset-x-2 flex-between text-[9px] font-mono text-muted-foreground/70 pointer-events-none">
        <span>-1.0 左</span>
        <span>0 居中</span>
        <span>+1.0 右</span>
      </div>

      <!-- 随机区间高亮带 -->
      <div
        v-if="randomX"
        class="absolute inset-y-1.5 left-[8%] right-[8%] rounded border border-dashed border-primary/60 bg-primary/15 flex-center pointer-events-none"
      >
        <span class="text-[11px] font-medium text-primary">
          随机水平落点区间（尺寸 {{ Math.round(dropSize * 100) }}%）
        </span>
      </div>

      <!-- 可拖动落点圆球 -->
      <div
        v-else
        class="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none flex flex-col items-center"
        :style="{ left: `${markerLeftPct}%` }"
      >
        <div
          class="rounded-full border-2 border-primary bg-primary/25 shadow-sm flex-center"
          :style="{ width: `${bubblePx}px`, height: `${bubblePx}px` }"
        >
          <div class="size-1.5 rounded-full bg-primary" />
        </div>
      </div>
    </div>

    <!-- 控件行：随机开关 + 尺寸滑块 + 试掉按钮 -->
    <div class="flex items-center gap-3 flex-wrap text-xs">
      <label class="flex items-center gap-1.5 cursor-pointer select-none shrink-0">
        <Switch
          :checked="randomX"
          @update:checked="(v) => emit('update:randomX', v)"
        />
        <span class="text-muted-foreground">随机 X</span>
      </label>

      <span
        v-if="!randomX"
        class="text-[11px] font-mono tabular-nums text-muted-foreground shrink-0"
      >
        X = {{ dropX.toFixed(2) }}
      </span>

      <div class="flex items-center gap-2 flex-1 min-w-[160px] max-w-[260px]">
        <span class="text-muted-foreground shrink-0">尺寸</span>
        <Slider
          class="flex-1 min-w-0"
          :model-value="[Math.round(dropSize * 100)]"
          :min="5"
          :max="100"
          :step="2"
          @update:model-value="(v) => v?.[0] !== undefined && emit('update:dropSize', Number((v[0] / 100).toFixed(2)))"
        />
        <span class="text-[11px] font-mono tabular-nums text-muted-foreground w-9 text-right shrink-0">
          {{ Math.round(dropSize * 100) }}%
        </span>
      </div>

      <Button
        type="button"
        size="xs"
        variant="outline"
        class="gap-1 ml-auto"
        :disabled="disabledTest"
        @click="emit('testDrop')"
      >
        <ArrowDownToLine class="size-3" />
        试掉一次
      </Button>
    </div>
  </div>
</template>
