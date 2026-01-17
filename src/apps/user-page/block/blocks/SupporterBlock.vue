<script setup lang="ts">
import { NIcon } from 'naive-ui'
import { computed } from 'vue'
import { ArrowForwardOutline, CafeOutline, CardOutline, CashOutline, FlashOutline, Heart as HeartIcon, LogoTwitch, LogoYoutube } from '@vicons/ionicons5'
import BlockCard from '../BlockCard.vue'

type Platform = 'afdian' | 'kofi' | 'patreon' | 'paypal' | 'twitch' | 'youtube' | 'fanbox' | 'other'

// ... existing code ...
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

const props = defineProps<{ blockProps: unknown, userInfo?: unknown, biliInfo?: unknown }>()

const cfg = computed<BlockConfig>(() => {
  const o = (props.blockProps && typeof props.blockProps === 'object' && !Array.isArray(props.blockProps))
    ? (props.blockProps as any)
    : {}
  return {
    title: typeof o.title === 'string' ? o.title : 'SUPPORT',
    description: typeof o.description === 'string' ? o.description : '',
    items: Array.isArray(o.items) ? o.items : [],
    framed: typeof o.framed === 'boolean' ? o.framed : true,
    backgrounded: typeof o.backgrounded === 'boolean' ? o.backgrounded : true,
  }
})

function normalize(items: SupportItem[]) {
  return items
    .filter(it => it && typeof it.url === 'string' && it.url.trim().length)
    .map((it) => {
      const url = it.url.trim()
      const platform = (it.platform || 'other').toLowerCase() as Platform
      const label = (typeof it.label === 'string' && it.label.trim().length) ? it.label.trim() : ''
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
  return 'Support'
}

function getStyle(p: Platform) {
  const presets: Record<string, { bg: string, fg: string }> = {
    afdian: { bg: '#946ce6', fg: '#ffffff' },
    kofi: { bg: '#ff5f5f', fg: '#ffffff' },
    patreon: { bg: '#ff424d', fg: '#ffffff' },
    paypal: { bg: '#003087', fg: '#ffffff' },
    twitch: { bg: '#9146FF', fg: '#ffffff' },
    youtube: { bg: '#ff0000', fg: '#ffffff' },
    fanbox: { bg: '#fff015', fg: '#000000' },
    other: { bg: 'var(--n-primary-color)', fg: '#ffffff' },
  }
  return presets[p] || presets.other
}
</script>

<template>
  <BlockCard class="supporter-card" :framed="cfg.framed" :backgrounded="cfg.backgrounded" :content-style="{ padding: 0 }">
    <div class="supporter-block">
      <div class="block-header">
        <div class="header-icon">
          <NIcon :component="HeartIcon" />
        </div>
        <span class="header-title">{{ cfg.title }}</span>
      </div>

      <div v-if="cfg.description" class="block-desc">
        {{ cfg.description }}
      </div>

      <div v-if="items.length > 0" class="links-grid">
        <a
          v-for="(it, idx) in items"
          :key="idx"
          class="support-card"
          :href="it.url"
          target="_blank"
          rel="noopener noreferrer"
          :style="{
            '--accent-color': getStyle(it.platform).bg,
            '--accent-text': getStyle(it.platform).fg
          }"
        >
          <div class="card-glow" />
          <div class="icon-box">
            <NIcon :component="getIcon(it.platform)" />
          </div>
          <div class="card-content">
            <span class="platform-name">{{ it.label || platformLabel(it.platform) }}</span>
            <span class="action-text">Support on {{ platformLabel(it.platform) }}</span>
          </div>
          <div class="arrow-icon">
            <NIcon :component="ArrowForwardOutline" />
          </div>
        </a>
      </div>
      <div v-else class="empty-state">
        Check back later for support links!
      </div>
    </div>
  </BlockCard>
</template>

<style scoped>
.supporter-block {
  position: relative;
}

.block-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px 24px;
  border-bottom: 1px solid var(--n-divider-color);
  background: var(--n-action-color);
}

.header-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: rgba(var(--n-primary-color-rgb), 0.12);
  color: var(--n-primary-color);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
}

.header-title {
  font-weight: 800;
  font-size: 14px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  opacity: 0.8;
}

.block-desc {
  padding: 16px 24px 0;
  font-size: 14px;
  opacity: 0.7;
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
  background: var(--n-action-color);
  border-radius: 12px;
  text-decoration: none;
  color: var(--n-text-color);
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  border: 1px solid transparent;
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
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.support-card:hover .card-glow {
  opacity: 0.05;
}

.icon-box {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: var(--n-fill-color);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  color: var(--accent-color);
  position: relative;
  z-index: 1;
  transition: transform 0.3s;
}

.support-card:hover .icon-box {
  transform: scale(1.1);
  background: var(--accent-color);
  color: #fff;
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
  opacity: 0.6;
  margin-top: 2px;
}

.arrow-icon {
  font-size: 20px;
  opacity: 0.3;
  position: relative;
  z-index: 1;
  transition: all 0.3s;
}

.support-card:hover .arrow-icon {
  opacity: 1;
  transform: translateX(4px);
  color: var(--accent-color);
}

.empty-state {
  padding: 24px;
  text-align: center;
  opacity: 0.5;
}
</style>
