<script setup lang="ts">
import { HourglassOutline, TimerOutline } from '@vicons/ionicons5'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import BlockCard from '../BlockCard.vue'

interface BlockConfig {
  title?: string
  target?: string
  style?: 'cards' | 'inline'
  showSeconds?: boolean
  doneText?: string
  framed?: boolean
  backgrounded?: boolean
}

const props = defineProps<{ blockProps: unknown; userInfo?: unknown; biliInfo?: unknown }>()

const cfg = computed<BlockConfig>(() => {
  const o =
    props.blockProps && typeof props.blockProps === 'object' && !Array.isArray(props.blockProps)
      ? (props.blockProps as any)
      : {}
  return {
    title: typeof o.title === 'string' ? o.title : '',
    target: typeof o.target === 'string' ? o.target : '',
    style: o.style === 'cards' || o.style === 'inline' ? o.style : 'cards',
    showSeconds: typeof o.showSeconds === 'boolean' ? o.showSeconds : true,
    doneText: typeof o.doneText === 'string' ? o.doneText : '已到达',
    framed: typeof o.framed === 'boolean' ? o.framed : false,
    backgrounded: typeof o.backgrounded === 'boolean' ? o.backgrounded : false,
  }
})

function parseTarget(raw: string): number | null {
  const v = raw.trim()
  if (!v) return null
  const ms = Date.parse(v)
  if (Number.isFinite(ms)) return ms
  const normalized = v.replace(' ', 'T')
  const ms2 = Date.parse(normalized)
  if (Number.isFinite(ms2)) return ms2
  return null
}

const now = ref(Date.now())
let timer: number | null = null
onMounted(() => {
  timer = window.setInterval(() => {
    now.value = Date.now()
  }, 1000)
})
onBeforeUnmount(() => {
  if (timer !== null) window.clearInterval(timer)
  timer = null
})

const targetMs = computed(() => parseTarget(cfg.value.target ?? ''))
const diff = computed(() => {
  if (!targetMs.value) return null
  return targetMs.value - now.value
})

const breakdown = computed(() => {
  const ms = diff.value
  if (ms === null) return null
  if (ms <= 0) return { done: true, days: 0, hours: 0, minutes: 0, seconds: 0 }
  const totalSec = Math.floor(ms / 1000)
  const days = Math.floor(totalSec / 86400)
  const hours = Math.floor((totalSec % 86400) / 3600)
  const minutes = Math.floor((totalSec % 3600) / 60)
  const seconds = totalSec % 60
  return { done: false, days, hours, minutes, seconds }
})
</script>

<template>
  <BlockCard
    class="@container relative overflow-hidden rounded-[var(--radius)]"
    :class="{ 'bg-popover': cfg.backgrounded }"
    :framed="cfg.framed"
    :backgrounded="cfg.backgrounded"
    :content-style="{ padding: 0 }"
  >
    <div
      class="flex flex-col items-center justify-center p-5 min-h-[140px] @max-[420px]:px-2.5 @max-[420px]:py-4"
      :class="{
        'rounded-[var(--radius)] bg-card/54 backdrop-blur-md': !cfg.backgrounded,
      }"
    >
      <!-- 集成式标题区 -->
      <div class="flex items-center gap-1.5 mb-5 px-2 pb-1 border-b border-border text-muted-foreground">
        <component
          :is="TimerOutline"
          class="size-3.5"
        />
        <span class="text-xs font-bold uppercase tracking-normal">{{ cfg.title || '倒计时' }}</span>
      </div>

      <div
        v-if="!targetMs"
        class="p-5 text-xs text-muted-foreground"
      >
        未设置目标时间
      </div>

      <div
        v-else-if="breakdown?.done"
        class="flex flex-col items-center gap-3"
      >
        <div>
          <component
            :is="HourglassOutline"
            class="size-8 text-primary"
          />
        </div>
        <div class="text-lg font-extrabold tracking-normal">
          {{ cfg.doneText || '已到达' }}
        </div>
      </div>

      <template v-else>
        <!-- 数字展示区 -->
        <div
          v-if="cfg.style === 'cards'"
          class="grid items-start gap-1 w-full @max-[420px]:gap-0.5"
          :class="
            cfg.showSeconds
              ? 'max-w-[340px] grid-cols-[minmax(44px,1fr)_auto_minmax(44px,1fr)_auto_minmax(44px,1fr)_auto_minmax(44px,1fr)] @max-[420px]:grid-cols-[minmax(38px,1fr)_auto_minmax(38px,1fr)_auto_minmax(38px,1fr)_auto_minmax(38px,1fr)]'
              : 'max-w-[250px] grid-cols-[minmax(44px,1fr)_auto_minmax(44px,1fr)_auto_minmax(44px,1fr)] @max-[420px]:grid-cols-[minmax(38px,1fr)_auto_minmax(38px,1fr)_auto_minmax(38px,1fr)]'
          "
        >
          <div class="flex flex-col items-center min-w-0">
            <div class="font-mono text-[38px] font-extrabold leading-none tabular-nums @max-[420px]:text-[30px]">
              {{ breakdown?.days ?? 0 }}
            </div>
            <div class="text-[10px] font-semibold text-muted-foreground mt-1.5">天</div>
          </div>

          <div class="text-[28px] font-light text-muted-foreground mt-0.5 select-none @max-[420px]:text-[22px]">:</div>

          <div class="flex flex-col items-center min-w-0">
            <div class="font-mono text-[38px] font-extrabold leading-none tabular-nums @max-[420px]:text-[30px]">
              {{ breakdown?.hours?.toString().padStart(2, '0') ?? '00' }}
            </div>
            <div class="text-[10px] font-semibold text-muted-foreground mt-1.5">时</div>
          </div>

          <div class="text-[28px] font-light text-muted-foreground mt-0.5 select-none @max-[420px]:text-[22px]">:</div>

          <div class="flex flex-col items-center min-w-0">
            <div class="font-mono text-[38px] font-extrabold leading-none tabular-nums @max-[420px]:text-[30px]">
              {{ breakdown?.minutes?.toString().padStart(2, '0') ?? '00' }}
            </div>
            <div class="text-[10px] font-semibold text-muted-foreground mt-1.5">分</div>
          </div>

          <template v-if="cfg.showSeconds">
            <div class="text-[28px] font-light text-muted-foreground mt-0.5 select-none @max-[420px]:text-[22px]">
              :
            </div>
            <div class="flex flex-col items-center min-w-0">
              <div
                class="font-mono text-[38px] font-extrabold leading-none tabular-nums text-primary @max-[420px]:text-[30px]"
              >
                {{ breakdown?.seconds?.toString().padStart(2, '0') ?? '00' }}
              </div>
              <div class="text-[10px] font-semibold text-muted-foreground mt-1.5">秒</div>
            </div>
          </template>
        </div>

        <div
          v-else
          class="text-2xl font-bold tabular-nums text-foreground flex flex-wrap justify-center gap-x-1 gap-y-0.5 [&>small]:text-xs [&>small]:text-muted-foreground [&>small]:mr-2 [&>small]:uppercase"
        >
          <span>{{ breakdown?.days ?? 0 }}</span> <small>天</small>
          <span>{{ breakdown?.hours?.toString().padStart(2, '0') }}</span> <small>时</small>
          <span>{{ breakdown?.minutes?.toString().padStart(2, '0') }}</span> <small>分</small>
          <template v-if="cfg.showSeconds">
            <span>{{ breakdown?.seconds?.toString().padStart(2, '0') }}</span> <small>秒</small>
          </template>
        </div>
      </template>
    </div>
  </BlockCard>
</template>
