<script setup lang="ts">
import { NCard, NFlex, NStatistic, NText } from 'naive-ui'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

interface BlockConfig {
  title?: string
  target?: string
  style?: 'cards' | 'inline'
  showSeconds?: boolean
  doneText?: string
}

const props = defineProps<{ blockProps: unknown, userInfo?: unknown, biliInfo?: unknown }>()

const cfg = computed<BlockConfig>(() => {
  const o = (props.blockProps && typeof props.blockProps === 'object' && !Array.isArray(props.blockProps))
    ? (props.blockProps as any)
    : {}
  return {
    title: typeof o.title === 'string' ? o.title : '',
    target: typeof o.target === 'string' ? o.target : '',
    style: (o.style === 'cards' || o.style === 'inline') ? o.style : 'cards',
    showSeconds: typeof o.showSeconds === 'boolean' ? o.showSeconds : true,
    doneText: typeof o.doneText === 'string' ? o.doneText : '已到达',
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
  <NCard size="small">
    <template #header>
      {{ cfg.title || '倒计时' }}
    </template>

    <NText v-if="!targetMs" depth="3">
      未设置目标时间
    </NText>

    <NText v-else-if="breakdown?.done" depth="2" strong>
      {{ cfg.doneText || '已到达' }}
    </NText>

    <template v-else>
      <NFlex v-if="cfg.style === 'cards'" justify="space-between" wrap style="gap: 12px">
        <NStatistic label="天" :value="breakdown?.days ?? 0" />
        <NStatistic label="小时" :value="breakdown?.hours ?? 0" />
        <NStatistic label="分钟" :value="breakdown?.minutes ?? 0" />
        <NStatistic v-if="cfg.showSeconds" label="秒" :value="breakdown?.seconds ?? 0" />
      </NFlex>

      <NText v-else>
        {{ breakdown?.days ?? 0 }} 天 {{ breakdown?.hours ?? 0 }} 小时 {{ breakdown?.minutes ?? 0 }} 分
        <template v-if="cfg.showSeconds">
          {{ breakdown?.seconds ?? 0 }} 秒
        </template>
      </NText>
    </template>
  </NCard>
</template>

