<script setup lang="ts">
import { toRef } from 'vue'

import { Empty } from '@/shared/ui/empty'

import type { ObsDisplayCurrent, ObsDisplayFooterTag, ObsDisplayItem } from './obsDisplay'
import { useObsListAnimation } from './useObsListAnimation'

const props = withDefaults(
  defineProps<{
    title: string
    countText: string
    current: ObsDisplayCurrent
    items: ObsDisplayItem[]
    footerTags?: ObsDisplayFooterTag[]
    speedMultiplier?: number
    emptyText: string
  }>(),
  {
    footerTags: () => [],
    speedMultiplier: 1,
  },
)

const { listContainerRef, listInnerRef, isMoreThanContainer, animationTranslateYCss, animationDurationCss } =
  useObsListAnimation(toRef(props, 'items'), toRef(props, 'speedMultiplier'))
</script>

<template>
  <div class="size-full flex flex-col min-h-[150px] min-w-[250px] max-h-screen bg-gradient-to-br from-white/85 to-[#f5f5fa]/85 rounded-2xl text-slate-800 shadow-md overflow-hidden border border-black/5 font-sans">
    <div class="px-4 py-2.5 flex items-center justify-between bg-white/60 border-b border-black/6 shrink-0">
      <h2 class="m-0 text-base font-semibold text-slate-800">
        {{ title }}
      </h2>
      <span class="text-xs text-slate-600 bg-slate-200/70 px-2.5 py-1 rounded-2xl font-medium">{{ countText }}</span>
    </div>

    <div
      class="flex items-center px-4 py-3 mx-3 my-2.5 rounded-xl gap-2.5 border shrink-0 transition-all"
      :class="
        current.active
          ? 'bg-emerald-50/90 border-emerald-500/30 shadow-[0_4px_12px_rgba(16,185,129,0.1)]'
          : 'bg-white/50 border-black/4'
      "
    >
      <div
        class="size-2 rounded-full shrink-0 transition-all"
        :class="
          current.active
            ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse'
            : 'bg-slate-300'
        "
      />
      <div class="flex-1 min-w-0">
        <template v-if="current.active">
          <div>
            <div
              class="text-[15px] font-semibold text-slate-900 truncate"
              :title="current.title"
            >
              {{ current.title }}
            </div>
            <div class="flex items-center gap-1.5 flex-wrap min-w-0 mt-1">
              <img
                v-if="current.avatarUrl && !current.hideAvatar"
                class="size-4.5 rounded-full object-cover"
                :src="current.avatarUrl"
                referrerpolicy="no-referrer"
              />
              <span
                v-if="current.subtitle"
                class="text-xs text-slate-500"
              >
                {{ current.subtitle }}
              </span>
              <span
                v-for="(badge, index) in current.badges ?? []"
                :key="`current-${index}-${badge.text}`"
                class="text-[11px] leading-none px-2 py-1 rounded-full whitespace-nowrap bg-slate-200/72 text-slate-600 data-[tone=accent]:text-blue-700 data-[tone=accent]:bg-blue-100/60 data-[tone=success]:text-emerald-700 data-[tone=success]:bg-emerald-100/50 data-[tone=warning]:text-amber-700 data-[tone=warning]:bg-amber-100/55 data-[tone=danger]:text-rose-700 data-[tone=danger]:bg-pink-100/60"
                :data-tone="badge.tone ?? 'muted'"
              >
                {{ badge.text }}
              </span>
            </div>
          </div>
        </template>
        <div
          v-else
          class="text-[13px] text-slate-400"
        >
          {{ current.emptyText }}
        </div>
      </div>
    </div>

    <div
      ref="listContainerRef"
      class="flex-1 overflow-hidden px-3 mb-2 relative"
    >
      <template v-if="items.length > 0">
        <div
          ref="listInnerRef"
          class="pointer-events-none"
          :class="{ animating: isMoreThanContainer }"
        >
          <TransitionGroup
            name="obs-fresh-transition"
            tag="div"
            class="flex flex-col gap-2 relative"
          >
            <div
              v-for="(item, index) in items"
              :key="item.id"
              class="flex items-center gap-2.5 px-3 py-2.5 bg-white/70 rounded-xl border border-slate-400/14 shadow-[0_6px_20px_rgba(15,23,42,0.04)]"
            >
              <div
                class="size-7 rounded-[10px] flex items-center justify-center font-bold shrink-0 transition-colors"
                :class="
                  index === 0
                    ? 'bg-amber-400/16 text-amber-700'
                    : index === 1
                      ? 'bg-slate-300/75 text-slate-600'
                      : index === 2
                        ? 'bg-orange-400/16 text-orange-700'
                        : 'bg-slate-200/85 text-slate-500'
                "
              >
                {{ index + 1 }}
              </div>
              <div class="flex-1 min-w-0">
                <div
                  class="text-[15px] font-bold text-slate-900 truncate"
                  :title="item.primary"
                >
                  {{ item.primary }}
                </div>
                <div
                  v-if="(item.badges?.length ?? 0) > 0"
                  class="flex gap-1.5 mt-1 flex-wrap"
                >
                  <span
                    v-for="(badge, badgeIndex) in item.badges ?? []"
                    :key="`${item.id}-${badgeIndex}-${badge.text}`"
                    class="text-[11px] leading-none px-2 py-1 rounded-full whitespace-nowrap bg-slate-200/72 text-slate-600 data-[tone=accent]:text-blue-700 data-[tone=accent]:bg-blue-100/60 data-[tone=success]:text-emerald-700 data-[tone=success]:bg-emerald-100/50 data-[tone=warning]:text-amber-700 data-[tone=warning]:bg-amber-100/55 data-[tone=danger]:text-rose-700 data-[tone=danger]:bg-pink-100/60"
                    :data-tone="badge.tone ?? 'muted'"
                  >
                    {{ badge.text }}
                  </span>
                </div>
              </div>
            </div>
          </TransitionGroup>
        </div>
      </template>
      <Empty
        v-else
        :description="emptyText"
        class="size-full flex-center"
      />
    </div>

    <div
      v-if="footerTags.length > 0"
      class="shrink-0 px-3 pb-3"
    >
      <div class="flex flex-wrap gap-1.5">
        <div
          v-for="tag in footerTags"
          :key="tag.type"
          class="inline-flex flex-col gap-0.5 px-2 py-1.5 rounded-[10px] border border-slate-400/16 bg-white/74 data-[type=prefix]:bg-blue-100/72 data-[type=keyword]:bg-blue-100/72 data-[type=allow]:bg-emerald-100/72 data-[type=sc]:bg-pink-100/68 data-[type=gift]:bg-pink-100/68 data-[type=price]:bg-yellow-100/70 data-[type=gift-names]:bg-purple-100/70 data-[type=medal]:bg-red-100/68"
          :data-type="tag.type"
        >
          <span class="text-[10px] text-slate-500">{{ tag.label }}</span>
          <span class="text-xs font-semibold text-slate-800 whitespace-nowrap">{{ tag.value }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.obs-fresh-transition-enter-active,
.obs-fresh-transition-leave-active {
  transition:
    opacity 0.3s ease,
    transform 0.3s ease;
}

.obs-fresh-transition-enter-from,
.obs-fresh-transition-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

.obs-fresh-transition-leave-active {
  position: absolute;
  width: 100%;
}

.obs-fresh-transition-move {
  transition: transform 0.3s ease;
}

@keyframes obs-fresh-vertical-ping-pong {
  0% {
    transform: translateY(0);
  }
  100% {
    transform: translateY(v-bind(animationTranslateYCss));
  }
}

.animating {
  animation-name: obs-fresh-vertical-ping-pong;
  animation-duration: v-bind(animationDurationCss);
  animation-timing-function: ease-in-out;
  animation-iteration-count: infinite;
  animation-direction: alternate;
  pointer-events: auto;
}

.animating:hover {
  animation-play-state: paused;
}
</style>
