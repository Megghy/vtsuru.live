<script setup lang="ts">
import { useIntervalFn } from '@vueuse/core'
import { Activity, AlertTriangle, BookmarkPlus, Flame } from 'lucide-vue-next'
import { computed, ref } from 'vue'

import { isTauri } from '@/shared/config'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { SimpleTooltip } from '@/shared/ui/tooltip'

import { computeDanmakuPulse } from '../core/pulse'
import { useLiveDashboard } from '../store/useLiveDashboard'

const dashboard = useLiveDashboard()
const inTauri = isTauri()
const tick = ref(Date.now())

useIntervalFn(() => {
  tick.value = Date.now()
}, 5000)

const pulse = computed(() => {
  void tick.value
  return computeDanmakuPulse(dashboard.rawMessages, tick.value)
})

const sparklinePoints = computed(() => {
  const buckets = pulse.value.buckets
  const max = Math.max(4, pulse.value.peakBucket)
  const w = 96
  const h = 18
  return buckets
    .map((val, idx) => {
      const x = (idx / Math.max(1, buckets.length - 1)) * w
      const y = h - Math.round((val / max) * (h - 2)) - 1
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
})

function markSpike() {
  const topWord = pulse.value.hotWords[0]?.text
  const label = topWord ? `弹幕热词：${topWord}` : `弹幕波峰 (${pulse.value.currentPerMin}/分)`
  void dashboard.addMarker(label, 'manual', undefined, inTauri)
}
</script>

<template>
  <div class="flex items-center gap-2 px-2 py-1 border-b border-border/80 bg-muted/25 text-[11px] shrink-0 min-w-0">
    <SimpleTooltip content="近 3 分钟弹幕速率曲线（每 10 秒统计）">
      <div class="flex items-center gap-1.5 shrink-0">
        <Activity
          class="size-3 shrink-0"
          :class="pulse.isSpike ? 'text-amber-500' : 'text-muted-foreground'"
        />
        <svg
          width="96"
          height="18"
          viewBox="0 0 96 18"
          class="overflow-visible shrink-0"
        >
          <polyline
            :points="sparklinePoints"
            fill="none"
            :stroke="pulse.isSpike ? '#f59e0b' : 'currentColor'"
            :class="pulse.isSpike ? '' : 'text-primary/80'"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        <span
          class="tabular-nums font-medium"
          :class="pulse.isSpike ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'"
        >
          {{ pulse.currentPerMin }}/分
        </span>
      </div>
    </SimpleTooltip>

    <div class="flex items-center gap-1 flex-1 min-w-0 overflow-x-auto no-scrollbar">
      <SimpleTooltip
        v-for="word in pulse.hotWords"
        :key="word.text"
        :content="`近 1 分钟出现 ${word.count} 次，点击筛选`"
      >
        <Badge
          :variant="word.isAlert ? 'destructive' : 'secondary'"
          size="xs"
          class="gap-0.5 shrink-0 max-w-36 truncate cursor-pointer"
          @click="dashboard.search = word.text"
        >
          <AlertTriangle
            v-if="word.isAlert"
            class="size-2.5 shrink-0"
          />
          <Flame
            v-else
            class="size-2.5 shrink-0 text-amber-500"
          />
          <span class="truncate">{{ word.text }}</span>
          <span class="tabular-nums opacity-80">×{{ word.count }}</span>
        </Badge>
      </SimpleTooltip>
      <span
        v-if="!pulse.hotWords.length"
        class="text-muted-foreground/70 truncate"
      >
        暂无集中刷屏热词
      </span>
    </div>

    <SimpleTooltip
      v-if="pulse.isSpike || pulse.hotWords.length > 0"
      content="记录当前热词/波峰为高光打点（客户端同步保存回放/切片）"
    >
      <Button
        size="xs"
        :variant="pulse.isSpike ? 'secondary' : 'ghost'"
        class="gap-1 px-1.5 h-5 text-[11px] shrink-0"
        :class="pulse.isSpike ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'"
        @click="markSpike"
      >
        <BookmarkPlus class="size-3" />
        <span>{{ pulse.isSpike ? '波峰打点' : '打点' }}</span>
      </Button>
    </SimpleTooltip>
  </div>
</template>
