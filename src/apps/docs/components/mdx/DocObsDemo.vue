<script setup lang="ts">
import { Clock, Flame, Minus, Plus, RotateCcw, Sparkles, Target } from 'lucide-vue-next'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import { Button } from '@/shared/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'

const props = withDefaults(
  defineProps<{
    kind?: 'clock' | 'counter' | 'goal'
  }>(),
  {
    kind: 'counter',
  },
)

// 受苦计数器演示状态
const deathCount = ref(42)

// 目标耐久加钟演示状态
const guardCount = ref(7)
const guardTarget = 10
const extraSeconds = ref(3600)

const goalPercent = computed(() => Math.min(100, Math.round((guardCount.value / guardTarget) * 100)))
const countdownFormatted = computed(() => {
  const h = String(Math.floor(extraSeconds.value / 3600)).padStart(2, '0')
  const m = String(Math.floor((extraSeconds.value % 3600) / 60)).padStart(2, '0')
  const s = String(extraSeconds.value % 60).padStart(2, '0')
  return `${h}:${m}:${s}`
})

// 时钟演示状态
const clockStyle = ref<'swiss' | 'retro' | 'minimal'>('swiss')
const nowStr = ref('21:45:18')
let timer = 0

function updateClock() {
  const d = new Date()
  nowStr.value = [d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, '0')).join(':')
}

onMounted(() => {
  if (props.kind === 'clock') {
    updateClock()
    timer = window.setInterval(updateClock, 1000)
  }
})

onBeforeUnmount(() => {
  if (timer) window.clearInterval(timer)
})
</script>

<template>
  <div class="my-5 overflow-hidden rounded-lg border border-border bg-card">
    <div class="flex-between border-b border-border bg-muted/40 px-3.5 py-2">
      <div class="flex items-center gap-2 text-xs font-semibold text-foreground">
        <Sparkles class="size-3.5 text-brand" />
        <span>实时交互演示（模拟 OBS 透明源效果）</span>
      </div>
      <span class="rounded-sm bg-brand-soft px-1.5 py-0.5 text-[10px] font-medium text-brand">可点击体验</span>
    </div>

    <div class="grid gap-4 p-4 sm:grid-cols-[1fr_auto] sm:items-center bg-inset/45">
      <!-- 1. 受苦计数器 -->
      <template v-if="kind === 'counter'">
        <div class="flex items-center gap-4 rounded-lg border border-dashed border-border bg-background/80 p-4">
          <div class="flex size-10 items-center justify-center rounded-lg bg-amber-500/12 text-amber-500">
            <Flame class="size-5" />
          </div>
          <div>
            <div class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              BOSS 战受苦次数
            </div>
            <div class="mt-0.5 font-mono text-2xl font-bold tabular-nums text-foreground">
              {{ String(deathCount).padStart(3, '0') }}
            </div>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="减 1"
            @click="deathCount = Math.max(0, deathCount - 1)"
          >
            <Minus class="size-3.5" />
          </Button>
          <Button
            class="gap-1"
            @click="deathCount += 1"
          >
            <Plus class="size-3.5" />
            死亡 +1
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="重置"
            @click="deathCount = 42"
          >
            <RotateCcw class="size-3.5" />
          </Button>
        </div>
      </template>

      <!-- 2. 目标与耐久加钟 -->
      <template v-else-if="kind === 'goal'">
        <div class="space-y-2.5 rounded-lg border border-dashed border-border bg-background/80 p-4">
          <div class="flex-between text-xs">
            <span class="inline-flex items-center gap-1.5 font-semibold text-foreground">
              <Target class="size-3.5 text-pink-500" />
              本月舰长目标
            </span>
            <span class="font-mono font-bold tabular-nums text-foreground">
              {{ guardCount }} / {{ guardTarget }} ({{ goalPercent }}%)
            </span>
          </div>
          <div class="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              class="h-full rounded-full bg-brand transition-[width] duration-200"
              :style="{ width: `${goalPercent}%` }"
            />
          </div>
          <div class="flex-between text-[11px] text-muted-foreground">
            <span>耐久剩余倒计时</span>
            <span class="font-mono font-semibold tabular-nums text-foreground">{{ countdownFormatted }}</span>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            @click="
              guardCount = Math.min(guardTarget + 5, guardCount + 1);
              extraSeconds += 1800
            "
          >
            模拟上舰 (+30 分钟)
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="重置"
            @click="
              guardCount = 7;
              extraSeconds = 3600
            "
          >
            <RotateCcw class="size-3.5" />
          </Button>
        </div>
      </template>

      <!-- 3. 时钟风格切换 -->
      <template v-else>
        <div class="flex items-center justify-center rounded-lg border border-dashed border-border bg-background/80 p-4">
          <div
            class="inline-flex items-center gap-2.5 px-4 py-2 rounded-md transition-colors duration-150"
            :class="{
              'font-mono text-2xl font-bold tracking-tight text-foreground': clockStyle === 'swiss',
              'font-mono text-2xl font-bold tracking-widest text-amber-500 bg-zinc-950/90 border border-amber-500/30 shadow-inner':
                clockStyle === 'retro',
              'text-xl font-medium tracking-wide text-muted-foreground': clockStyle === 'minimal',
            }"
          >
            <Clock class="size-4 opacity-70" />
            <span class="tabular-nums">{{ nowStr }}</span>
          </div>
        </div>
        <ToggleGroup
          :model-value="clockStyle"
          type="single"
          class="grid grid-cols-3"
          @update:model-value="(val) => val && (clockStyle = val as 'swiss' | 'retro' | 'minimal')"
        >
          <ToggleGroupItem value="swiss">瑞士</ToggleGroupItem>
          <ToggleGroupItem value="retro">辉光</ToggleGroupItem>
          <ToggleGroupItem value="minimal">极简</ToggleGroupItem>
        </ToggleGroup>
      </template>
    </div>
  </div>
</template>
