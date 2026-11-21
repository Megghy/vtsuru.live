<script setup lang="ts">
import { MessageSquareText } from 'lucide-vue-next'
import { computed, defineAsyncComponent } from 'vue'

import { useAccount } from '@/api/account'
import { resolveFontFamilyCss, useGoogleFont } from '@/apps/user-page/googleFonts'

import type { ObsModuleLayer } from '../types'
import { getObsModuleById } from '../types'

const props = defineProps<{
  layer: ObsModuleLayer
  ownerUserId?: number
  authToken?: string
  mode: 'edit' | 'preview' | 'live'
}>()

const account = useAccount()

const directModuleComponents: Record<string, ReturnType<typeof defineAsyncComponent>> = {
  'music-request': defineAsyncComponent(() => import('@/apps/obs/pages/request/MusicRequestOBS.vue')),
  'live-request': defineAsyncComponent(() => import('@/apps/obs/pages/request/LiveRequestOBS.vue')),
  'live-request-today': defineAsyncComponent(() => import('@/apps/obs/pages/request/LiveRequestProcessedOBS.vue')),
  queue: defineAsyncComponent(() => import('@/apps/obs/pages/QueueOBS.vue')),
  'live-lottery': defineAsyncComponent(() => import('@/apps/obs/pages/LiveLotteryOBS.vue')),
  'question-display': defineAsyncComponent(() => import('@/apps/obs/pages/QuestionDisplayOBS.vue')),
  'danmaku-vote': defineAsyncComponent(() => import('@/apps/obs/pages/DanmakuVoteOBS.vue')),
}

const meta = computed(() => getObsModuleById(props.layer.module.moduleId))
const resolvedDirectComponent = computed(() => directModuleComponents[props.layer.module.moduleId])

const effectiveUserId = computed(() => {
  if (props.ownerUserId && props.ownerUserId > 0) return props.ownerUserId
  if (account.value.id > 0) return account.value.id
  return undefined
})

const effectiveToken = computed(() => {
  const fromProp = props.authToken?.trim()
  if (fromProp) return fromProp
  return account.value.token?.trim() || ''
})

const directComponentProps = computed(() => {
  const mod = props.layer.module
  const base = {
    id: effectiveUserId.value,
    active: true,
    visible: true,
  }
  switch (mod.moduleId) {
    case 'music-request':
    case 'live-request':
    case 'live-request-today':
    case 'queue':
      return {
        ...base,
        themeStyle: mod.style || 'classic',
        speedMultiplier: mod.speedMultiplier ?? 1,
      }
    case 'live-lottery':
      return {
        ...base,
        themeStyle: mod.style || 'slate',
        mode: mod.lotteryMode || 'card',
      }
    case 'danmaku-vote':
      return {
        ...base,
        token: effectiveToken.value || undefined,
        theme: mod.style || undefined,
        position: 'fill',
        layout: mod.voteLayout || 'auto',
        max: mod.maxDisplay ?? 6,
        inlineMode: true,
        previewMode: props.mode === 'edit',
        borderRadiusOverride:
          props.layer.maskShape && props.layer.maskShape !== 'none'
            ? 0
            : Math.max(0, props.layer.borderRadius ?? 20),
        fontFamilyOverride: mod.voteFontFamily || undefined,
        showResultsOverride: typeof mod.voteShowResults === 'boolean' ? mod.voteShowResults : null,
        disableShadow: !!props.layer.disableShadow,
      }
    case 'question-display':
      return {
        ...base,
        // 矩形模式同步图层圆角（拉到 0 彻底直角）；使用异形遮罩时归零内圆角避免与 clip-path 冲突
        borderRadiusOverride:
          props.layer.maskShape && props.layer.maskShape !== 'none'
            ? 0
            : Math.max(0, props.layer.borderRadius ?? 0),
      }
    default:
      return base
  }
})

// 弹幕机在播出态采用同源隔离 iframe，彻底隔绝其全局 YouTube CSS 与用户 customCss
const danmujiLiveUrl = computed(() => {
  if (props.layer.module.moduleId !== 'danmuji') return ''
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const url = new URL('/obs/danmuji', origin || 'http://localhost')
  const mod = props.layer.module
  if (effectiveToken.value) url.searchParams.set('token', effectiveToken.value)
  if (mod.danmujiPreset) url.searchParams.set('preset', mod.danmujiPreset)
  if (mod.danmujiFontSize) url.searchParams.set('fontSize', String(mod.danmujiFontSize))
  if (mod.danmujiFontFamily) url.searchParams.set('fontFamily', mod.danmujiFontFamily)
  if (typeof mod.danmujiOpacity === 'number') url.searchParams.set('opacity', String(mod.danmujiOpacity))
  if (typeof mod.danmujiReverse === 'boolean') url.searchParams.set('reverse', String(mod.danmujiReverse))
  if (typeof mod.danmujiPinned === 'boolean') url.searchParams.set('pinned', String(mod.danmujiPinned))
  if (typeof mod.danmujiAutoHide === 'number' && mod.danmujiAutoHide > 0) {
    url.searchParams.set('autoHide', String(mod.danmujiAutoHide))
  }
  if (typeof mod.danmujiPinnedMinPrice === 'number') {
    url.searchParams.set('pinnedMinPrice', String(mod.danmujiPinnedMinPrice))
  }
  return url.toString()
})

const mockDanmujiMessages = [
  { id: 1, name: '星月旅人', role: 'guard', badge: '舰长', text: '晚上好呀！今天背景排版好好看！', color: '#38bdf8' },
  { id: 2, name: '小橘子', role: 'normal', badge: '', text: '前排打卡，今天唱什么歌~', color: '#cbd5e1' },
  { id: 3, name: '云端守望者', role: 'sc', badge: 'SC ¥50', text: '加油加油，祝今天直播顺利开心！', color: '#fbbf24' },
  { id: 4, name: '白露未晞', role: 'normal', badge: '', text: '666666 这个弹幕机位置刚刚好', color: '#cbd5e1' },
]

const danmujiPreviewFont = computed(() =>
  props.layer.module.moduleId === 'danmuji' ? props.layer.module.danmujiFontFamily || undefined : undefined,
)
useGoogleFont(danmujiPreviewFont)
const danmujiPreviewFontCss = computed(() => resolveFontFamilyCss(danmujiPreviewFont.value))

const danmujiPreviewMessages = computed(() => {
  return props.layer.module.danmujiReverse === false
    ? mockDanmujiMessages.toReversed()
    : mockDanmujiMessages
})
</script>

<template>
  <div
    class="obs-module-layer relative w-full h-full overflow-hidden"
    :class="{ 'obs-no-shadow': layer.disableShadow }"
  >
    <!-- 1. 弹幕机：编辑态无污染高保真预览 + 播出态同源隔离 iframe -->
    <template v-if="layer.module.moduleId === 'danmuji'">
      <div
        v-if="mode === 'edit'"
        class="w-full h-full flex flex-col justify-end p-3 gap-2 select-none"
        :style="{
          opacity: layer.module.danmujiOpacity ?? 1,
          fontSize: `${layer.module.danmujiFontSize ?? 18}px`,
          fontFamily: danmujiPreviewFontCss,
        }"
      >
        <div
          v-if="layer.module.danmujiPinned"
          class="flex items-center gap-2 rounded-full bg-amber-500/90 text-slate-950 px-3 py-1 text-xs font-semibold w-fit mb-auto"
          :class="layer.disableShadow ? '' : 'shadow-md'"
        >
          <span>SC ¥50</span>
          <span class="opacity-80">云端守望者</span>
        </div>

        <div
          v-for="msg in danmujiPreviewMessages"
          :key="msg.id"
          class="flex items-start gap-2 leading-snug transition-colors"
          :class="[
            layer.module.danmujiPreset === 'bubble'
              ? 'rounded-xl bg-slate-900/85 border border-white/15 px-3 py-2'
              : layer.module.danmujiPreset === 'minimal'
                ? 'px-1 py-0.5'
                : 'px-2 py-1 rounded-md bg-black/35',
            !layer.disableShadow && layer.module.danmujiPreset === 'bubble' ? 'shadow-md' : '',
          ]"
        >
          <div
            v-if="layer.module.danmujiPreset !== 'minimal'"
            class="w-7 h-7 rounded-full shrink-0 flex-center text-xs font-bold text-white"
            :style="{ backgroundColor: msg.role === 'sc' ? '#d97706' : msg.role === 'guard' ? '#0284c7' : '#475569' }"
          >
            {{ msg.name.slice(0, 1) }}
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-1.5 flex-wrap">
              <span
                v-if="msg.badge"
                class="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-sky-500/25 text-sky-200 leading-none"
                :class="msg.role === 'sc' ? '!bg-amber-500/30 !text-amber-200' : ''"
              >
                {{ msg.badge }}
              </span>
              <span class="font-semibold text-[0.88em]" :style="{ color: msg.color }">{{ msg.name }}</span>
            </div>
            <div
              class="text-white break-words"
              :style="layer.disableShadow ? undefined : { textShadow: '0 1px 4px rgba(0,0,0,0.85)' }"
            >
              {{ msg.text }}
            </div>
          </div>
        </div>

        <div class="absolute top-2 right-2 flex items-center gap-1 rounded bg-black/60 text-white/85 px-2 py-0.5 text-[11px]">
          <MessageSquareText class="w-3 h-3 text-sky-400" />
          <span>弹幕机预览（播出态实时接入）</span>
        </div>
      </div>

      <iframe
        v-else-if="effectiveToken"
        :src="danmujiLiveUrl"
        class="w-full h-full border-0 bg-transparent"
      />
      <div
        v-else
        class="w-full h-full flex-center bg-black/40 text-white/80 text-xs px-4 text-center"
      >
        弹幕机需要账号 token，请使用编辑器复制的完整 OBS 播放链接
      </div>
    </template>

    <!-- 2. 其余 7 个站内 OBS 业务组件直接同上下文挂载 -->
    <template v-else-if="resolvedDirectComponent">
      <div
        v-if="mode === 'edit'"
        class="pointer-events-none absolute inset-0 border border-dashed border-sky-400/35 bg-sky-500/5"
      >
        <span class="absolute bottom-1.5 right-2 text-[11px] font-medium text-sky-300/85 bg-slate-950/65 px-1.5 py-0.5 rounded">
          {{ meta?.name ?? layer.module.moduleId }}
        </span>
      </div>
      <div class="relative w-full h-full">
        <component :is="resolvedDirectComponent" v-bind="directComponentProps" />
      </div>
    </template>

    <div
      v-else
      class="w-full h-full flex-center bg-muted/60 text-muted-foreground text-xs border border-dashed border-border"
    >
      未知站内组件: {{ layer.module.moduleId }}
    </div>
  </div>
</template>

<style scoped>
.obs-no-shadow :deep(*) {
  box-shadow: none !important;
  text-shadow: none !important;
}
.obs-no-shadow :deep(.drop-shadow),
.obs-no-shadow :deep(.drop-shadow-sm),
.obs-no-shadow :deep(.drop-shadow-md),
.obs-no-shadow :deep(.drop-shadow-lg) {
  filter: none !important;
}
</style>
