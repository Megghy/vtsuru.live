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
      bg: 'var(--vtsuru-page-primary)',
      fg: 'var(--vtsuru-page-primary-readable)',
      readable: 'var(--vtsuru-page-primary-readable)',
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
    <div class="supporter-block">
      <div class="block-header">
        <div class="header-icon">
          <component :is="HeartIcon" />
        </div>
        <span class="header-title">{{ cfg.title }}</span>
      </div>

      <div
        v-if="cfg.description"
        class="block-desc"
      >
        {{ cfg.description }}
      </div>

      <div
        v-if="items.length > 0"
        class="links-grid"
      >
        <a
          v-for="(it, idx) in items"
          :key="idx"
          class="support-card"
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
          <div class="card-glow" />
          <div class="icon-box">
            <component :is="getIcon(it.platform)" />
          </div>
          <div class="card-content">
            <span class="platform-name">{{ it.label || platformLabel(it.platform) }}</span>
            <span class="action-text">前往 {{ platformLabel(it.platform) }} 支持</span>
          </div>
          <div class="arrow-icon">
            <component :is="ArrowForwardOutline" />
          </div>
        </a>
      </div>
      <div
        v-else
        class="empty-state"
      >
        暂无支持链接
      </div>
    </div>
  </BlockCard>
</template>

<style scoped>
.supporter-block {
  position: relative;
  color: var(--vtsuru-block-fg);
}

.block-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px 24px;
  border-bottom: var(--vtsuru-page-border-width) var(--vtsuru-page-border-style) var(--vtsuru-block-border);
  background: var(--vtsuru-block-bg-muted);
}

.header-icon {
  width: 32px;
  height: 32px;
  border-radius: var(--vtsuru-page-radius);
  background: color-mix(in srgb, var(--vtsuru-page-primary) 12%, transparent);
  color: var(--vtsuru-page-primary-readable, var(--vtsuru-page-primary));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
}

.header-title {
  color: var(--vtsuru-block-fg);
  font-weight: 800;
  font-size: 14px;
  text-transform: uppercase;
  letter-spacing: 0;
  opacity: 0.8;
}

.block-desc {
  padding: 16px 24px 0;
  font-size: 14px;
  color: var(--vtsuru-block-fg-muted);
  white-space: pre-wrap;
}

.links-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(280px, 100%), 1fr));
  gap: 12px;
  padding: clamp(12px, 3vw, 24px);
}

.support-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: var(--vtsuru-block-bg-muted);
  border-radius: var(--vtsuru-page-radius);
  text-decoration: none;
  color: var(--vtsuru-block-fg);
  transition:
    border-color 0.2s ease,
    transform 0.2s ease,
    box-shadow 0.2s ease;
  border: var(--vtsuru-page-border-width) var(--vtsuru-page-border-style) transparent;
  position: relative;
  overflow: hidden;
}

.card-glow {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--accent-color);
  opacity: 0;
  transition: opacity 0.3s;
  z-index: 0;
}

.support-card:hover {
  transform: translateY(-2px);
  border-color: var(--accent-color);
  box-shadow: var(--vtsuru-page-shadow);
}

.support-card:hover .card-glow {
  opacity: 0.05;
}

.icon-box {
  width: 48px;
  height: 48px;
  border-radius: var(--vtsuru-page-radius);
  background: var(--vtsuru-block-bg-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  color: var(--accent-readable);
  position: relative;
  z-index: 1;
  transition: transform 0.3s;
}

.support-card:focus-visible {
  outline: 2px solid var(--vtsuru-page-primary);
  outline-offset: 2px;
}

.support-card:hover .icon-box {
  transform: scale(1.1);
  background: var(--accent-color);
  color: var(--accent-text);
}

.card-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
  z-index: 1;
}

.platform-name {
  font-weight: 700;
  font-size: 16px;
  line-height: 1.2;
}

.action-text {
  font-size: 12px;
  color: var(--vtsuru-block-fg-muted);
  margin-top: 2px;
}

.arrow-icon {
  font-size: 20px;
  opacity: 0.3;
  position: relative;
  z-index: 1;
  transition:
    color 0.2s ease,
    opacity 0.2s ease,
    transform 0.2s ease;
}

.support-card:hover .arrow-icon {
  opacity: 1;
  transform: translateX(4px);
  color: var(--accent-readable);
}

.empty-state {
  padding: 24px;
  text-align: center;
  color: var(--vtsuru-block-fg-muted);
}

@media (prefers-reduced-motion: reduce) {
  .support-card,
  .card-glow,
  .icon-box,
  .arrow-icon {
    transition: none;
  }
  .support-card:hover,
  .support-card:hover .icon-box,
  .support-card:hover .arrow-icon {
    transform: none;
  }
}
</style>
