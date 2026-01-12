<script setup lang="ts">
import { NCard, NFlex, NIcon, NText } from 'naive-ui'
import { computed } from 'vue'
import { CashOutline, HeartOutline } from '@vicons/ionicons5'

type Platform = 'afdian' | 'kofi' | 'patreon' | 'paypal' | 'other'

interface SupportItem {
  platform?: Platform
  url: string
  label?: string
}

interface BlockConfig {
  title?: string
  description?: string
  items?: SupportItem[]
}

const props = defineProps<{ blockProps: unknown, userInfo?: unknown, biliInfo?: unknown }>()

const cfg = computed<BlockConfig>(() => {
  const o = (props.blockProps && typeof props.blockProps === 'object' && !Array.isArray(props.blockProps))
    ? (props.blockProps as any)
    : {}
  return {
    title: typeof o.title === 'string' ? o.title : '支持我',
    description: typeof o.description === 'string' ? o.description : '',
    items: Array.isArray(o.items) ? o.items : [],
  }
})

function normalize(items: SupportItem[]) {
  return items
    .filter(it => it && typeof it.url === 'string' && it.url.trim().length)
    .map((it) => {
      const url = it.url.trim()
      const platform = (it.platform === 'afdian' || it.platform === 'kofi' || it.platform === 'patreon' || it.platform === 'paypal' || it.platform === 'other')
        ? it.platform
        : 'other'
      const label = (typeof it.label === 'string' && it.label.trim().length) ? it.label.trim() : ''
      return { url, platform, label }
    })
}

const items = computed(() => normalize(cfg.value.items ?? []))

function platformLabel(p: Platform) {
  if (p === 'afdian') return '爱发电'
  if (p === 'kofi') return 'Ko-fi'
  if (p === 'patreon') return 'Patreon'
  if (p === 'paypal') return 'PayPal'
  return '支持'
}

function getStyle(p: Platform) {
  const presets: Record<Platform, { bg: string, fg: string }> = {
    afdian: { bg: '#946ce6', fg: '#ffffff' },
    kofi: { bg: '#ff5f5f', fg: '#ffffff' },
    patreon: { bg: '#ff424d', fg: '#ffffff' },
    paypal: { bg: '#003087', fg: '#ffffff' },
    other: { bg: 'rgba(0, 0, 0, 0.55)', fg: '#ffffff' },
  }
  return presets[p]
}
</script>

<template>
  <NCard size="small">
    <template #header>
      {{ cfg.title || '支持' }}
    </template>

    <NText v-if="cfg.description" depth="3" style="display:block; margin-bottom: 10px; white-space: pre-wrap">
      {{ cfg.description }}
    </NText>

    <NText v-if="items.length === 0" depth="3">
      未配置赞助链接
    </NText>

    <NFlex v-else justify="center" wrap style="gap: 10px">
      <a
        v-for="(it, idx) in items"
        :key="idx"
        class="support"
        :href="it.url"
        target="_blank"
        rel="noopener noreferrer"
        :style="{
          '--support-bg': getStyle(it.platform).bg,
          '--support-fg': getStyle(it.platform).fg,
        }"
      >
        <NIcon :size="18">
          <component :is="it.platform === 'other' ? CashOutline : HeartOutline" />
        </NIcon>
        <span class="label">
          {{ it.label || platformLabel(it.platform) }}
        </span>
      </a>
    </NFlex>
  </NCard>
</template>

<style scoped>
.support {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 999px;
  background: var(--support-bg);
  color: var(--support-fg);
  text-decoration: none;
  border: 1px solid rgba(0, 0, 0, 0.08);
}
.label {
  font-weight: 800;
  color: var(--support-fg);
}
</style>

