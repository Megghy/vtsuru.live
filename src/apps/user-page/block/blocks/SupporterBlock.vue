<script setup lang="ts">
import {
  ArrowForwardOutline,
  CafeOutline,
  CardOutline,
  CashOutline,
  FlashOutline,
  Heart as HeartIcon,
  LogoTwitch,
  LogoYoutube,
} from '@vicons/ionicons5'
import { computed } from 'vue'

import BlockCard from '../BlockCard.vue'

type Platform = 'afdian' | 'kofi' | 'patreon' | 'paypal' | 'twitch' | 'youtube' | 'fanbox' | 'other'

interface SupportItem {
  platform?: Platform
  url: string
  label?: string
}

interface BlockConfig {
  title?: string
  description?: string
  items?: SupportItem[]
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
    title: typeof o.title === 'string' ? o.title : '支持',
    description: typeof o.description === 'string' ? o.description : '',
    items: Array.isArray(o.items) ? o.items : [],
    framed: typeof o.framed === 'boolean' ? o.framed : true,
    backgrounded: typeof o.backgrounded === 'boolean' ? o.backgrounded : true,
  }
})

function normalize(items: SupportItem[]) {
  return items
    .filter((it) => it && typeof it.url === 'string' && it.url.trim().length)
    .map((it) => {
      const url = it.url.trim()
      const platform = (it.platform || 'other').toLowerCase() as Platform
      const label = typeof it.label === 'string' && it.label.trim().length ? it.label.trim() : ''
      return { url, platform, label }
    })
}

function getIcon(p: Platform) {
  if (p === 'afdian') return FlashOutline
  if (p === 'kofi') return CafeOutline
  if (p === 'patreon') return HeartIcon
  if (p === 'paypal') return CardOutline
  if (p === 'twitch') return LogoTwitch
  if (p === 'youtube') return LogoYoutube
  if (p === 'fanbox') return CardOutline
  return CashOutline
}

const items = computed(() => normalize(cfg.value.items ?? []))

function platformLabel(p: Platform) {
  if (p === 'afdian') return 'Afdian'
  if (p === 'kofi') return 'Ko-fi'
  if (p === 'patreon') return 'Patreon'
  if (p === 'paypal') return 'PayPal'
  if (p === 'twitch') return 'Twitch'
  if (p === 'youtube') return 'YouTube'
  if (p === 'fanbox') return 'Fanbox'
  return '支持'
}

function getStyle(p: Platform) {
  const presets: Record<Platform, { bg: string; fg: string; readable?: string }> = {
    afdian: { bg: '#946ce6', fg: '#ffffff' },
    kofi: { bg: '#ff5f5f', fg: '#ffffff' },
    patreon: { bg: '#ff424d', fg: '#ffffff' },
    paypal: { bg: '#003087', fg: '#ffffff' },
    twitch: { bg: '#9146FF', fg: '#ffffff' },
    youtube: { bg: '#ff0000', fg: '#ffffff' },
    fanbox: { bg: '#fff015', fg: '#000000' },
    other: {
      bg: 'var(--primary)',
      fg: 'var(--primary-foreground)',
      readable: 'var(--primary)',
    },
  }
  return presets[p]
}
</script>

<template>
  <BlockCard
    class="supporter-card"
    :framed="cfg.framed"
    :backgrounded="cfg.backgrounded"
    :content-style="{ padding: 0 }"
  >
    <div class="relative text-foreground">
      <div class="flex items-center gap-3 px-6 py-5 border-b border-border bg-secondary/50">
        <div class="size-8 rounded-[var(--radius)] bg-primary/12 text-primary flex items-center justify-center text-lg">
          <component
            :is="HeartIcon"
            class="size-4.5"
          />
        </div>
        <span class="text-sm font-extrabold uppercase tracking-normal opacity-80 text-foreground">{{ cfg.title }}</span>
      </div>

      <div
        v-if="cfg.description"
        class="px-6 pt-4 text-sm text-muted-foreground whitespace-pre-wrap"
      >
        {{ cfg.description }}
      </div>

      <div
        v-if="items.length > 0"
        class="grid grid-cols-[repeat(auto-fit,minmax(min(280px,100%),1fr))] gap-3 p-3 sm:p-6"
      >
        <a
          v-for="(it, idx) in items"
          :key="idx"
          class="group relative flex items-center gap-4 p-4 rounded-[var(--radius)] bg-secondary/50 text-foreground no-underline border border-transparent overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--accent-color)] hover:shadow-md focus-visible:outline-2 focus-visible:outline-primary"
          :href="it.url"
          target="_blank"
          rel="noopener noreferrer"
          :aria-label="`${it.label || platformLabel(it.platform)}（新窗口打开）`"
          :style="{
            '--accent-color': getStyle(it.platform).bg,
            '--accent-text': getStyle(it.platform).fg,
            '--accent-readable': getStyle(it.platform).readable ?? getStyle(it.platform).bg,
          }"
        >
          <div
            class="absolute inset-0 bg-[var(--accent-color)] opacity-0 transition-opacity duration-300 group-hover:opacity-5 pointer-events-none"
          />
          <div
            class="relative z-1 size-12 rounded-[var(--radius)] bg-secondary flex items-center justify-center text-2xl text-[var(--accent-readable)] transition-all duration-300 group-hover:scale-110 group-hover:bg-[var(--accent-color)] group-hover:text-[var(--accent-text)]"
          >
            <component
              :is="getIcon(it.platform)"
              class="size-6"
            />
          </div>
          <div class="relative z-1 flex-1 flex flex-col">
            <span class="font-bold text-base leading-snug">{{ it.label || platformLabel(it.platform) }}</span>
            <span class="text-xs text-muted-foreground mt-0.5">前往 {{ platformLabel(it.platform) }} 支持</span>
          </div>
          <div
            class="relative z-1 text-xl opacity-30 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-1 group-hover:text-[var(--accent-readable)]"
          >
            <component
              :is="ArrowForwardOutline"
              class="size-5"
            />
          </div>
        </a>
      </div>
      <div
        v-else
        class="p-6 text-center text-muted-foreground text-xs"
      >
        暂无支持链接
      </div>
    </div>
  </BlockCard>
</template>
