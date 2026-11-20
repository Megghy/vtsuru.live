<script setup lang="ts">
import { computed, toRef } from 'vue'

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

const topSubtitle = computed(() => {
  if (props.current.active) {
    return props.current.subtitle
  }
  return props.countText
})
</script>

<template>
  <div class="size-full flex flex-col p-3 box-border text-white bg-transparent overflow-hidden tabular-nums">
    <!-- 顶部标题与计数 -->
    <div class="flex-between gap-2 pb-2 mb-2 border-b border-white/15 shrink-0">
      <div class="flex items-center gap-2 min-w-0">
        <span
          class="size-2 rounded-full shrink-0 transition-all"
          :class="
            current.active
              ? 'bg-emerald-500 shadow-[0_0_8px_rgba(34,197,94,0.9)] animate-pulse'
              : 'bg-slate-400/90 shadow-[0_0_6px_rgba(0,0,0,0.6)]'
          "
        />
        <span class="text-base font-bold truncate drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)]">
          {{ title }}
        </span>
      </div>
      <span
        v-if="countText"
        class="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-black/35 backdrop-blur-xs text-white/95 drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]"
      >
        {{ countText }}
      </span>
    </div>

    <!-- 当前处理项 -->
    <div class="flex items-baseline gap-2 pb-2 shrink-0 min-w-0">
      <div
        class="text-sm font-bold truncate drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)]"
        :class="current.active ? 'text-white' : 'text-white/75'"
      >
        {{ current.active ? current.title : current.emptyText }}
      </div>
      <div
        v-if="current.active && topSubtitle"
        class="text-xs text-white/85 shrink-0 truncate max-w-[40%] drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)]"
      >
        {{ topSubtitle }}
      </div>
    </div>

    <div
      v-if="current.active && (current.badges?.length ?? 0) > 0"
      class="flex flex-wrap gap-1.5 pb-2 shrink-0"
    >
      <span
        v-for="(badge, index) in current.badges ?? []"
        :key="`current-${index}-${badge.text}`"
        class="bg-black/35 px-1.5 py-px rounded-full backdrop-blur-xs whitespace-nowrap text-[11px] data-[tone=accent]:text-blue-100 data-[tone=danger]:text-rose-200 data-[tone=success]:text-emerald-200"
        :data-tone="badge.tone ?? 'muted'"
      >
        {{ badge.text }}
      </span>
    </div>

    <div
      ref="listContainerRef"
      class="flex-1 min-h-0 overflow-hidden"
    >
      <template v-if="items.length > 0">
        <div
          ref="listInnerRef"
          class="flex flex-col gap-1.5 pointer-events-none"
          :class="{ animating: isMoreThanContainer }"
        >
          <TransitionGroup
            name="obs-minimal-transition"
            tag="div"
            class="flex flex-col gap-1.5"
          >
            <div
              v-for="(item, index) in items"
              :key="item.id"
              class="flex items-center gap-2 py-0.5"
            >
              <div
                class="min-w-5 text-center text-sm font-bold text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)] shrink-0"
                :class="
                  index === 0
                    ? '!text-amber-300 [text-shadow:0_0_6px_rgba(252,211,77,0.9),0_0_14px_rgba(252,211,77,0.6),0_2px_6px_rgba(0,0,0,0.9)]'
                    : index === 1
                      ? '!text-slate-300 [text-shadow:0_0_6px_rgba(203,213,225,0.9),0_0_14px_rgba(203,213,225,0.5),0_2px_6px_rgba(0,0,0,0.9)]'
                      : index === 2
                        ? '!text-amber-600 [text-shadow:0_0_6px_rgba(217,119,6,0.9),0_0_14px_rgba(217,119,6,0.5),0_2px_6px_rgba(0,0,0,0.9)]'
                        : ''
                "
              >
                {{ index + 1 }}
              </div>
              <div class="flex-1 min-w-0">
                <div
                  class="text-[15px] font-semibold truncate drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]"
                  :title="item.primary"
                >
                  {{ item.primary }}
                </div>
                <div
                  v-if="(item.badges?.length ?? 0) > 0"
                  class="flex gap-1.5 mt-0.5 text-[11px] opacity-95 drop-shadow-[0_2px_6px_rgba(0,0,0,0.85)] flex-wrap"
                >
                  <span
                    v-for="(badge, badgeIndex) in item.badges ?? []"
                    :key="`${item.id}-${badgeIndex}-${badge.text}`"
                    class="bg-black/35 px-1.5 py-px rounded-full backdrop-blur-xs whitespace-nowrap data-[tone=accent]:text-blue-100 data-[tone=danger]:text-rose-200 data-[tone=success]:text-emerald-200"
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
        class="size-full flex-center !text-white/85 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] [&_svg]:!text-white/60"
        :description="emptyText"
      />
    </div>

    <div
      v-if="footerTags.length > 0"
      class="mt-2 pt-1.5 border-t border-white/10 shrink-0 flex flex-col gap-1 text-[11px] text-slate-200 drop-shadow-[0_2px_6px_rgba(0,0,0,0.85)]"
    >
      <div class="grid grid-cols-2 gap-1.5">
        <div
          v-for="tag in footerTags"
          :key="tag.type"
          class="min-w-0 inline-flex items-center gap-1 px-2 py-0.75 rounded-full bg-black/35 backdrop-blur-xs"
        >
          <span class="text-[10px] tracking-wider text-slate-300/75 uppercase opacity-80 shrink-0">{{ tag.label }}</span>
          <span class="text-xs font-semibold text-slate-100 truncate">{{ tag.value }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.obs-minimal-transition-enter-active,
.obs-minimal-transition-leave-active {
  transition:
    opacity 0.25s ease,
    transform 0.25s ease;
}

.obs-minimal-transition-enter-from,
.obs-minimal-transition-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

@keyframes obs-minimal-vertical-ping-pong {
  0% {
    transform: translateY(0);
  }
  100% {
    transform: translateY(v-bind(animationTranslateYCss));
  }
}

.animating {
  animation-name: obs-minimal-vertical-ping-pong;
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
